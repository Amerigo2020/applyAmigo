import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
register("./api-cloudflare-loader.mjs", import.meta.url);
const { api, readBody } = await import("../lib/server/http.ts");
const { readWorkspace, mutateWorkspace } = await import("../lib/server/store.ts");
const actions = await import("../lib/server/actions.ts");
const { z } = await import("zod");
const { env } = await import("./api-env.mjs");
const alice = { id: "test-alice", email: "alice@example.test", name: "Alice" };
const bob = { id: "test-bob", email: "bob@example.test", name: "Bob" };
function request(path, method = "GET", body, id = alice.id, origin = "https://app.example.test") {
  return new Request(`https://app.example.test/api/${path}`, { method, headers: { "oai-authenticated-user-id": id, "oai-authenticated-user-email": `${id}@example.test`, "content-type": "application/json", origin }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
test("API authentication and same-origin guard reject missing or foreign identities", async () => {
  assert.equal((await api(new Request("https://app.example.test/api/workspace"), () => Promise.resolve({}))).status, 401);
  assert.equal((await api(request("profile", "PUT", {}, alice.id, "https://evil.example.test"), () => Promise.resolve({}))).status, 403);
  const response = await api(request("workspace"), () => Promise.resolve({ ok: true }));
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
});
test("D1-backed storage isolates users and retains simultaneous writes", async () => {
  await mutateWorkspace(alice, workspace => { workspace.profile.name = "Alice Private"; });
  assert.equal((await readWorkspace(bob)).profile.name, "");
  await Promise.all([mutateWorkspace(alice, workspace => { workspace.profile.skills.push("Python"); }), mutateWorkspace(alice, workspace => { workspace.profile.languages.push("Deutsch"); })]);
  const saved = await readWorkspace(alice);
  assert.deepEqual(saved.profile.skills, ["Python"]); assert.deepEqual(saved.profile.languages, ["Deutsch"]);
  assert.deepEqual((await readWorkspace(bob)).profile.skills, []);
});
test("foreign job and draft IDs cannot be read or mutated", async () => {
  const response = await actions.addJob(request("jobs", "POST", { company: "Example", title: "Private job" }), alice);
  const job = await response.json();
  const foreign = await api(request(`jobs/${job.id}`, "PATCH", { notes: "attack" }, bob.id), user => actions.patchJob(request(`jobs/${job.id}`, "PATCH", { notes: "attack" }), user, job.id));
  assert.equal(foreign.status, 404);
  assert.equal((await readWorkspace(alice)).jobs.find(item => item.id === job.id).notes, "");
});
test("malformed and oversized JSON bodies produce bounded client errors", async () => {
  const invalid = new Request("https://app.example.test/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  await assert.rejects(() => readBody(invalid, z.object({})), /gültiges JSON/);
  const huge = new Request("https://app.example.test/api/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x".repeat(300001) }) });
  await assert.rejects(() => readBody(huge, z.object({})), /groß/);
});
test("source validation rejects arbitrary origins and preserves supported EU boards", () => {
  assert.throws(() => actions.boardForSource({ provider: "ashby", company: "Bad", board: "https://127.0.0.1/private" }), /Adresse/);
  assert.equal(actions.boardForSource({ provider: "lever", company: "Example", board: "https://jobs.eu.lever.co/example" }).region, "eu");
});
test("approval survives notes with unchanged policy and is revoked by a real policy change", async () => {
  const user = { id: "workflow-user", name: "Workflow", email: "workflow@example.test" };
  const workspace = await actions.demo(user); const job = workspace.jobs[0];
  const draft = await (await actions.addDraft(request("drafts", "POST", { jobId: job.id, variant: "robotics", language: "de" }), user)).json();
  await actions.patchDraft(request(`drafts/${draft.id}`, "PATCH", { approve: true }), user, draft.id);
  const updated = await actions.patchJob(request(`jobs/${job.id}`, "PATCH", { stage: "ready", aiPolicy: "unknown", notes: "Interview vorbereiten" }), user, job.id);
  assert.equal(updated.stage, "ready");
  assert.ok((await readWorkspace(user)).drafts[0].approvedAt);
  const changed = await actions.patchJob(request(`jobs/${job.id}`, "PATCH", { stage: "ready", aiPolicy: "prohibited", notes: "Neue Regel" }), user, job.id);
  assert.equal(changed.stage, "draft"); assert.equal(changed.aiPolicy, "prohibited");
  assert.equal((await readWorkspace(user)).drafts[0].approvedAt, null);
  await assert.rejects(() => actions.patchDraft(request(`drafts/${draft.id}`, "PATCH", { approve: true }), bob, draft.id), /nicht gefunden/);
});
test("sources support bulk enable and remove without accessing another user's source", async () => {
  const user = { id: "sources-user", name: "Sources", email: "sources@example.test" };
  const saved = await actions.saveSources(request("sources", "POST", { provider: "lever", company: "Example", board: "https://jobs.eu.lever.co/example", enabled: true }), user);
  const source = saved.sources[0]; assert.match(source.board, /jobs.eu.lever.co/);
  const disabled = await actions.saveSources(request("sources", "POST", { sources: [{ ...source, enabled: false }] }), user);
  assert.equal(disabled.sources[0].enabled, false);
  await assert.rejects(() => actions.saveSources(request("sources", "POST", { sources: [source] }), bob), /nicht gefunden/);
  assert.deepEqual((await actions.saveSources(request("sources", "POST", { sources: [] }), user)).sources, []);
});
test("AI drafting requires positive policy and operator config; prompt export observes same rules", async () => {
  const user = { id: "model-user", name: "Model", email: "model@example.test" };
  const workspace = await actions.demo(user); const job = workspace.jobs[0];
  const body = { jobId: job.id, variant: "research", language: "en", useAi: true };
  await assert.rejects(() => actions.addDraft(request("drafts", "POST", body), user), /erlaubt/);
  await actions.patchJob(request(`jobs/${job.id}`, "PATCH", { aiPolicy: "allowed" }), user, job.id);
  await assert.rejects(() => actions.addDraft(request("drafts", "POST", body), user), /keinen Modellanbieter/);
  const prompt = await actions.exportPrompt(request(`jobs/${job.id}/prompt?variant=research&language=en`), user, job.id);
  assert.equal(prompt.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.match(await prompt.text(), /Alex Beispiel/);
});
test("parallel AI requests reserve one paid call atomically and enforce capacity first", async () => {
  const user = { id: "model-concurrency", name: "Model", email: "model@example.test" };
  const workspace = await actions.demo(user); const job = workspace.jobs[0];
  await actions.patchJob(request(`jobs/${job.id}`, "PATCH", { aiPolicy: "allowed" }), user, job.id);
  env.MODEL_API_KEY = "test-key"; env.MODEL_BASE_URL = "https://api.example.test/v1"; env.MODEL_NAME = "test-model";
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ text: "I am Alex Beispiel and I want to work on this project.", evidenceQuotes: ["Alex Beispiel"] }) } }] }); };
  try {
    const body = { jobId: job.id, variant: "research", language: "en", useAi: true };
    const results = await Promise.allSettled([actions.addDraft(request("drafts", "POST", body), user), actions.addDraft(request("drafts", "POST", body), user)]);
    assert.equal(calls, 1); assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.find(result => result.status === "rejected").reason.status, 429);
    assert.ok(!("modelUsage" in await readWorkspace(user)));
    const fullUser = { id: "model-full", name: "Full", email: "full@example.test" };
    const full = await actions.demo(fullUser); const fullJob = full.jobs[0];
    await mutateWorkspace(fullUser, current => { current.jobs[0].aiPolicy = "allowed"; current.drafts = Array.from({ length: 500 }, (_, i) => ({ id: `d-${i}`, jobId: fullJob.id, variant: "research", language: "en", text: "Saved draft", warnings: [], mode: "template", approvedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" })); });
    await assert.rejects(() => actions.addDraft(request("drafts", "POST", { ...body, jobId: fullJob.id }), fullUser), /500/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; delete env.MODEL_API_KEY; delete env.MODEL_BASE_URL; delete env.MODEL_NAME; }
});

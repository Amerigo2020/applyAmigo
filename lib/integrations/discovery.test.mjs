import test from "node:test";
import assert from "node:assert/strict";
import { detectBoard, apiUrlForBoard, discoverJobs, parsePersonioXml, DISCOVERY_LIMITS } from "./discovery.ts";

const board = { provider: "ashby", slug: "demo", company: "Demo" };
const posting = { id: "job-123", title: "Working Student AI", location: "Munich", descriptionPlain: "Python and API integration", jobUrl: "https://jobs.ashbyhq.com/demo/job-123", employmentType: "PartTime" };
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("board detection refuses URL tricks and only builds allowlisted API hosts", () => {
  for (const input of [
    "http://jobs.ashbyhq.com/demo", "https://jobs.ashbyhq.com.evil.test/demo",
    "https://evil.test/jobs.ashbyhq.com/demo", "https://user@jobs.ashbyhq.com/demo",
    "https://jobs.ashbyhq.com:8443/demo", "https://jobs.ashbyhq.com/a%2Fb",
    "https://jobs.ashbyhq.com/%2e%2e", "https://127.0.0.1/demo",
    "https://x.jobs.personio.com.evil.test/", "https://jobs.ashbyhq.com/%ZZ",
  ]) assert.equal(detectBoard(input), null, input);
  const ashby = detectBoard("https://jobs.ashbyhq.com/Tools%20for%20Humanity", "Tools for Humanity");
  assert.equal(ashby?.slug, "Tools for Humanity");
  assert.match(apiUrlForBoard(ashby), /^https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/Tools%20for%20Humanity/);
  const lever = detectBoard("https://jobs.eu.lever.co/acme/123");
  assert.equal(apiUrlForBoard(lever), "https://api.eu.lever.co/v0/postings/acme?mode=json");
  assert.equal(detectBoard("https://boards.greenhouse.io/embed/job_board?for=acme")?.slug, "acme");
  assert.equal(apiUrlForBoard(detectBoard("https://demo.jobs.personio.de/job/123")), "https://demo.jobs.personio.de/xml");
});

test("live JSON mapping uses feed values and preserves missing salary", async () => {
  const requests = [];
  const result = await discoverJobs([board], { fetch: async (url, init) => {
    requests.push({ url, init });
    return jsonResponse({ jobs: [posting] });
  } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.redirect, "manual");
  assert.equal(result.jobs[0].title, posting.title);
  assert.equal(result.jobs[0].verification, "live-listing");
  assert.equal(result.jobs[0].compensation, undefined);
  assert.deepEqual(result.errors, []);
});

test("Greenhouse preserves updated date separately from initial publication", async () => {
  const result = await discoverJobs([{ provider: "greenhouse", slug: "demo", company: "Demo" }], { fetch: async () => jsonResponse({ jobs: [{
    id: 123, title: "Student", location: { name: "Munich" }, content: "&lt;p&gt;Python &amp;amp; ROS2&lt;/p&gt;",
    first_published: "2026-01-01T00:00:00Z", updated_at: "2026-10-13T00:00:00Z",
  }] }) });
  assert.equal(result.jobs[0].description, "Python & ROS2");
  assert.match(result.jobs[0].postedAt, /^2026-01-01/);
  assert.match(result.jobs[0].updatedAt, /^2026-10-13/);
});

test("Lever descriptions include requirements and all locations", async () => {
  const result = await discoverJobs([{ provider: "lever", slug: "demo", company: "Demo" }], { fetch: async () => jsonResponse([{
    id: "abc", text: "Research Student", categories: { location: "Zurich", allLocations: ["Munich"], commitment: "Part-time" },
    descriptionPlain: "Research", lists: [{ text: "Requirements", content: "<li>Python</li>" }], additionalPlain: "English", createdAt: 0,
  }]) });
  assert.match(result.jobs[0].location, /Munich/);
  assert.match(result.jobs[0].description, /Requirements Python English/);
  assert.equal(result.jobs[0].postedAt, "1970-01-01T00:00:00.000Z");
});

test("Personio CDATA and nested descriptions cannot replace the job title", () => {
  const personio = { provider: "personio", slug: "demo", company: "Demo" };
  const jobs = parsePersonioXml(`<workzag-jobs><position><id>123</id><jobDescriptions><jobDescription><name>Requirements</name><value><![CDATA[<p>Python</p> literal </position>]]></value></jobDescription></jobDescriptions><name><![CDATA[Werkstudent Robotik]]></name><office>München</office><additionalOffices><office>Garching</office></additionalOffices><schedule>part-time</schedule></position></workzag-jobs>`, personio, "2026-10-13T00:00:00Z");
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].title, "Werkstudent Robotik");
  assert.match(jobs[0].description, /Python/);
  assert.equal(jobs[0].location, "München; Garching");
  assert.equal(jobs[0].url, "https://demo.jobs.personio.com/job/123");
  assert.throws(() => parsePersonioXml('<!DOCTYPE x><workzag-jobs/>', personio, "now"), /INVALID_RESPONSE/);
  assert.throws(() => parsePersonioXml('<workzag-jobs><position><id>bad</id><name>Invalid</name></position></workzag-jobs>', personio, "now"), /INVALID_RESPONSE/);
});

test("failed boards stay errors and never masquerade as zero vacancies", async () => {
  let calls = 0;
  const boards = [board, { ...board, slug: "second" }, { ...board, slug: "third" }];
  const result = await discoverJobs(boards, { fetch: async () => {
    calls++;
    if (calls === 1) return jsonResponse({ error: "rate limited" }, 429);
    if (calls === 2) return new Response("<html>blocked</html>");
    return jsonResponse({ jobs: [posting] });
  } });
  assert.equal(result.jobs.length, 1);
  assert.deepEqual(result.errors.map((error) => error.code), ["RATE_LIMITED", "INVALID_RESPONSE"]);
  assert.equal(result.errors[0].retryable, true);
});

test("redirects, large streams, invalid boards, and request limits are bounded", async () => {
  let count = 0;
  const result = await discoverJobs([board], { fetch: async () => {
    count++;
    return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } });
  } });
  assert.equal(count, 1);
  assert.equal(result.errors[0].code, "REDIRECT_BLOCKED");
  const large = await discoverJobs([board], { fetch: async () => new Response("x", { headers: { "content-length": String(DISCOVERY_LIMITS.maxResponseBytes + 1) } }) });
  assert.equal(large.errors[0].code, "RESPONSE_TOO_LARGE");
  const tooMany = await discoverJobs(Array.from({ length: 9 }, () => board), { fetch: async () => { throw new Error("must not fetch"); } });
  assert.equal(tooMany.errors[0].code, "LIMIT_EXCEEDED");
  const invalid = await discoverJobs([{ ...board, slug: "../../private" }], { fetch: async () => { throw new Error("must not fetch"); } });
  assert.equal(invalid.errors[0].code, "INVALID_BOARD");
});

test("timeouts cancel and surfaced truncation never implies completeness", async () => {
  const result = await discoverJobs([board], { timeoutMs: 100, fetch: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  }) });
  assert.equal(result.errors[0].code, "TIMEOUT");
  const truncated = await discoverJobs([board], { maxJobsPerBoard: 1, fetch: async () => jsonResponse({ jobs: [posting, { ...posting, id: "job-456" }] }) });
  assert.equal(truncated.jobs.length, 1);
  assert.equal(truncated.boards[0].warnings.length, 1);
});

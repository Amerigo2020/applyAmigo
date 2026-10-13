import { env } from "cloudflare:workers";
import { z } from "zod";
import { createJob, DomainError, fillDemo, invalidateApprovals, latestDraft, makeDraft, requireDraftable, scoreJob, updateDraft } from "../domain";
import { detectBoard, discoverJobs, extractJobKeywords, type AtsBoard } from "../integrations";
import { buildDraftPrompt, generateModelDraft, getModelConfig } from "../model";
import type { Source, Workspace } from "../types";
import { json, readBody, type Identity } from "./http";
import { mutateWorkspace, readWorkspace } from "./store";
import { blocksSchema, draftPatchSchema, draftSchema, jobPatchSchema, jobSchema, profileSchema, sourceSchema, sourcesSchema } from "./validation";

const configured = () => getModelConfig(env as unknown as Record<string, unknown>);
function publicWorkspace(workspace: Workspace) { return { ...workspace, aiConfigured: Boolean(configured()) }; }
function findJob(workspace: Workspace, id: string) { const job = workspace.jobs.find(item => item.id === id); if (!job) throw new DomainError("Die Stelle wurde nicht gefunden.", 404); return job; }
function requireCapacity(workspace: Workspace) { if (workspace.jobs.length >= 250) throw new DomainError("Maximal 250 Stellen pro Arbeitsbereich. Exportiere deine Daten, bevor du weitere Stellen sammelst."); }
function checkSalary(job: { salaryMin?: number | null; salaryMax?: number | null }) { if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) throw new DomainError("Die Gehaltsuntergrenze darf nicht über der Obergrenze liegen."); }
export async function getWorkspace(user: Identity) { return publicWorkspace(await readWorkspace(user)); }
export async function saveProfile(request: Request, user: Identity) {
  const { profile } = await readBody(request, z.object({ profile: profileSchema }).strict());
  const result = await mutateWorkspace(user, workspace => {
    if (JSON.stringify(workspace.profile) !== JSON.stringify(profile)) invalidateApprovals(workspace);
    workspace.profile = profile;
    workspace.jobs.forEach(job => { job.match = scoreJob(profile, job); });
  }); return publicWorkspace(result.workspace);
}
export async function addJob(request: Request, user: Identity) {
  const input = await readBody(request, jobSchema); checkSalary(input);
  const result = await mutateWorkspace(user, workspace => {
    requireCapacity(workspace);
    if (input.url && workspace.jobs.some(job => job.url === input.url)) throw new DomainError("Diese Stellenadresse ist bereits gespeichert.", 409);
    const job = createJob(workspace.profile, { ...input, skills: input.skills ?? extractJobKeywords(`${input.title}\n${input.description ?? ""}`) });
    workspace.jobs.push(job); return job;
  }); return json(result.value, 201);
}
export async function patchJob(request: Request, user: Identity, id: string) {
  const input = await readBody(request, jobPatchSchema);
  const result = await mutateWorkspace(user, workspace => {
    const job = findJob(workspace, id); checkSalary({ ...job, ...input });
    if (input.url && workspace.jobs.some(other => other.id !== id && other.url === input.url)) throw new DomainError("Diese Stellenadresse ist bereits gespeichert.", 409);
    const affectsDraft = Object.entries(input).some(([key, value]) => key !== "stage" && key !== "notes" && JSON.stringify(job[key as keyof typeof job]) !== JSON.stringify(value));
    const effectiveStage = affectsDraft && job.stage === "ready" && input.stage === "ready" ? "draft" : input.stage;
    if (affectsDraft) invalidateApprovals(workspace, id);
    if (effectiveStage === "ready" && (!latestDraft(workspace, id)?.approvedAt || input.aiPolicy === "prohibited" || job.aiPolicy === "prohibited")) throw new DomainError("Gib zuerst den aktuellen Entwurf frei. Erst dann ist die Bewerbung bereit.");
    Object.assign(job, input, ...(effectiveStage ? [{ stage: effectiveStage }] : []), { updatedAt: new Date().toISOString() });
    job.match = scoreJob(workspace.profile, job); return job;
  }); return result.value;
}

function canonicalBoard(board: AtsBoard): string {
  const slug = encodeURIComponent(board.slug);
  if (board.provider === "ashby") return `https://jobs.ashbyhq.com/${slug}`;
  if (board.provider === "greenhouse") return `https://job-boards.${board.region === "eu" ? "eu." : ""}greenhouse.io/${slug}`;
  if (board.provider === "lever") return `https://jobs.${board.region === "eu" ? "eu." : ""}lever.co/${slug}`;
  return `https://${board.slug}.jobs.personio.${board.personioTld ?? "de"}`;
}
export function boardForSource(source: Pick<Source, "provider" | "board" | "company">): AtsBoard {
  let value = source.board.trim();
  if (!/^https?:\/\//i.test(value)) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)) throw new DomainError("Die Board-Kennung ist ungültig. Verwende die öffentliche ATS-Adresse.");
    value = canonicalBoard({ provider: source.provider, slug: value, company: source.company });
  }
  const detected = detectBoard(value, source.company);
  if (!detected || detected.provider !== source.provider) throw new DomainError("Die Adresse passt nicht zu Ashby, Greenhouse, Lever oder Personio.");
  return detected;
}
function buildSource(input: z.infer<typeof sourceSchema>, existing: Source[]): Source {
  const previous = input.id ? existing.find(source => source.id === input.id) : undefined;
  if (input.id && !previous) throw new DomainError("Die Quelle wurde nicht gefunden.", 404);
  const company = input.company ?? previous?.company ?? "";
  const urlBoard = input.url ? detectBoard(input.url, company || undefined) : null;
  const provider = input.provider ?? urlBoard?.provider ?? previous?.provider;
  const board = input.board ?? input.url ?? previous?.board;
  if (!provider || !board || !(company || urlBoard?.company)) throw new DomainError("Ergänze Anbieter, Board-Adresse und Unternehmen.");
  const source: Source = { id: previous?.id ?? crypto.randomUUID(), provider, board, company: company || urlBoard!.company, enabled: input.enabled ?? previous?.enabled ?? true };
  source.board = canonicalBoard(boardForSource(source)); return source;
}
export async function getSources(user: Identity) { return { sources: (await readWorkspace(user)).sources }; }
export async function saveSources(request: Request, user: Identity) {
  const input = await readBody(request, sourcesSchema);
  const result = await mutateWorkspace(user, workspace => {
    const next = "sources" in input ? input.sources.map(source => buildSource(source, workspace.sources)) : (() => {
      const source = buildSource(input, workspace.sources);
      return [...workspace.sources.filter(item => item.id !== source.id), source];
    })();
    if (next.length > 8) throw new DomainError("Du kannst höchstens acht Quellen gleichzeitig speichern.");
    if (new Set(next.map(source => `${source.provider}:${source.board}`)).size !== next.length || new Set(next.map(source => source.id)).size !== next.length) throw new DomainError("Diese Quelle ist bereits gespeichert.", 409);
    workspace.sources = next; return { sources: next };
  }); return result.value;
}
export async function scan(user: Identity) {
  const started = new Date().toISOString();
  const reservation = await mutateWorkspace(user, workspace => {
    if (!workspace.sources.some(source => source.enabled)) throw new DomainError("Aktiviere zuerst mindestens eine Stellenquelle.");
    if (workspace.lastScanAt && Date.now() - Date.parse(workspace.lastScanAt) < 30_000) throw new DomainError("Der letzte Scan läuft noch oder ist gerade beendet. Warte kurz vor dem nächsten Scan.", 429);
    workspace.lastScanAt = started; return workspace.sources.filter(source => source.enabled);
  });
  const sources = reservation.value;
  const discovered = await discoverJobs(sources.map(boardForSource), { maxJobsPerBoard: 50, timeoutMs: 20000 });
  const result = await mutateWorkspace(user, workspace => {
    for (const found of discovered.jobs) {
      const source = sources.find(item => { const board = boardForSource(item); return board.provider === found.provider && board.slug === found.boardSlug; });
      if (!source || !workspace.sources.some(current => current.id === source.id && current.enabled && current.board === source.board)) continue;
      const existing = workspace.jobs.find(job => job.url === found.url);
      const facts = { company: found.company, title: found.title, location: found.location, url: found.url, description: found.description.slice(0, 8000), employmentType: found.employmentType, skills: extractJobKeywords(`${found.title}\n${found.description}`), lastCheckedAt: found.fetchedAt };
      if (existing) {
        if (["title", "company", "description"].some(key => existing[key as "title"] !== facts[key as "title"])) invalidateApprovals(workspace, existing.id);
        Object.assign(existing, facts, { updatedAt: found.fetchedAt }); existing.match = scoreJob(workspace.profile, existing);
      } else if (workspace.jobs.length < 250) workspace.jobs.push(createJob(workspace.profile, { ...facts, source: `${found.provider}:${found.boardSlug}` }));
    }
    workspace.lastScanAt = discovered.fetchedAt;
    return { jobs: workspace.jobs, errors: discovered.errors, scannedAt: discovered.fetchedAt, warnings: [...discovered.boards.flatMap(board => board.warnings), ...(workspace.jobs.length >= 250 ? ["Das Limit von 250 gespeicherten Stellen ist erreicht. Weitere Treffer wurden nicht übernommen."] : [])] };
  }); return result.value;
}
export async function addDraft(request: Request, user: Identity) {
  const input = await readBody(request, draftSchema);
  if (input.useAi) {
    // Reserve capacity before any paid network request. The CAS makes parallel calls safe.
    const reservation = await mutateWorkspace(user, workspace => {
      const job = findJob(workspace, input.jobId); requireDraftable(workspace.profile, job);
      if (job.aiPolicy !== "allowed") throw new DomainError("Bestätige zuerst, dass KI-Unterstützung für diese Bewerbung erlaubt ist.");
      if (!configured()) throw new DomainError("Der Betreiber hat keinen Modellanbieter eingerichtet. Nutze die Vorlage ohne Sprachmodell.", 501);
      if (workspace.drafts.length >= 500) throw new DomainError("Das Limit von 500 Entwürfen ist erreicht.");
      const now = Date.now(); const date = new Date(now).toISOString().slice(0, 10);
      const usage = workspace.modelUsage;
      if (usage && usage.availableAt > now) throw new DomainError("Ein KI-Aufruf läuft noch oder wurde gerade beendet. Warte eine Minute vor dem nächsten Versuch.", 429);
      const count = usage?.date === date ? usage.count : 0;
      if (count >= 50) throw new DomainError("Du hast das Tageslimit von 50 KI-Aufrufen erreicht. Vorlagen bleiben verfügbar.", 429);
      workspace.modelUsage = { date, count: count + 1, availableAt: now + 60_000 };
    });
    const before = reservation.workspace; const job = findJob(before, input.jobId);
    const config = configured()!;
    const snapshot = JSON.stringify({ profile: before.profile, job, draft: latestDraft(before, job.id) });
    let generated: Awaited<ReturnType<typeof generateModelDraft>>;
    try { generated = await generateModelDraft(config, before.profile, job, input.variant, input.language); }
    catch (error) { throw new DomainError(error instanceof Error ? error.message : "Das Modell konnte keinen Entwurf erstellen.", 502); }
    const result = await mutateWorkspace(user, workspace => {
      const current = findJob(workspace, input.jobId);
      if (JSON.stringify({ profile: workspace.profile, job: current, draft: latestDraft(workspace, current.id) }) !== snapshot) throw new DomainError("Profil oder Bewerbung wurden während der Erstellung geändert. Erstelle einen neuen Entwurf.", 409);
      const draft = makeDraft(workspace.profile, current, input.variant, input.language);
      draft.text = generated.text; draft.warnings = generated.warnings; draft.mode = "ai";
      if (workspace.drafts.length >= 500) throw new DomainError("Das Limit von 500 Entwürfen ist erreicht.");
      invalidateApprovals(workspace, current.id); workspace.drafts.push(draft); current.stage = "draft"; current.updatedAt = draft.updatedAt; return draft;
    }); return json(result.value, 201);
  }
  const result = await mutateWorkspace(user, workspace => {
    const job = findJob(workspace, input.jobId);
    if (workspace.drafts.length >= 500) throw new DomainError("Das Limit von 500 Entwürfen ist erreicht.");
    const draft = makeDraft(workspace.profile, job, input.variant, input.language);
    invalidateApprovals(workspace, job.id); workspace.drafts.push(draft); job.stage = "draft"; job.updatedAt = draft.updatedAt; return draft;
  }); return json(result.value, 201);
}
export async function patchDraft(request: Request, user: Identity, id: string) {
  const input = await readBody(request, draftPatchSchema);
  return (await mutateWorkspace(user, workspace => updateDraft(workspace, id, input))).value;
}
export async function saveBlocks(request: Request, user: Identity) {
  const { blocks } = await readBody(request, blocksSchema);
  const result = await mutateWorkspace(user, workspace => {
    if (new Set(blocks.map(block => block.id)).size !== blocks.length) throw new DomainError("Ein Zeitblock wurde doppelt angegeben.");
    const intervals: { date: string; start: number; end: number }[] = [];
    for (const block of blocks) {
      findJob(workspace, block.jobId);
      const [h, m] = block.startTime.split(":").map(Number); const start = h * 60 + m, end = start + block.durationMinutes;
      if (end > 1440 || intervals.some(other => other.date === block.date && start < other.end && end > other.start)) throw new DomainError("Zeitblöcke dürfen sich nicht überschneiden oder über Mitternacht reichen.");
      intervals.push({ date: block.date, start, end });
    }
    workspace.blocks = blocks;
  }); return publicWorkspace(result.workspace);
}
export async function demo(user: Identity) { const result = await mutateWorkspace(user, workspace => Object.assign(workspace, fillDemo(workspace))); return publicWorkspace(result.workspace); }
export async function exportWorkspace(user: Identity) { return json({ format: "applyAmigo", version: 1, exportedAt: new Date().toISOString(), workspace: await getWorkspace(user) }, 200, { "Content-Disposition": 'attachment; filename="applyAmigo-export.json"' }); }
export async function exportPrompt(request: Request, user: Identity, jobId: string) {
  const workspace = await readWorkspace(user); const job = findJob(workspace, jobId); requireDraftable(workspace.profile, job);
  if (job.aiPolicy !== "allowed") throw new DomainError("Bestätige zuerst, dass KI-Unterstützung für diese Bewerbung erlaubt ist.");
  const query = new URL(request.url).searchParams;
  const variant = z.enum(["robotics", "startup", "research"]).parse(query.get("variant") || "robotics");
  const language = z.enum(["de", "en"]).parse(query.get("language") || "de");
  const prompt = buildDraftPrompt(workspace.profile, job, variant, language);
  return new Response(`${prompt.instructions}\n\n${prompt.input}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="applyAmigo-prompt.txt"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

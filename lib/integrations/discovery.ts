/**
 * Worker-compatible adaptation of OpenJobs adapters/{ashby,greenhouse,lever,personio}.mjs.
 * Copyright (c) 2026 Santiago Fernández de Valderrama (original career-ops work).
 * Copyright (c) 2026 Outscal (modifications and additions in OpenJobs).
 * MIT. Upstream cdcc533521afb61f4e60657b3dbe06e484ccddcf.
 * See licenses/OpenJobs-LICENSE and THIRD_PARTY_NOTICES.md.
 */

export type AtsProvider = "ashby" | "greenhouse" | "lever" | "personio";

export interface AtsBoard {
  provider: AtsProvider;
  slug: string;
  company: string;
  region?: "eu" | "global";
  personioTld?: "de" | "com";
}

export interface DiscoveredJob {
  id: string;
  externalId: string;
  provider: AtsProvider;
  boardSlug: string;
  company: string;
  title: string;
  location: string;
  description: string;
  url: string;
  applyUrl: string;
  employmentType: string;
  remote: boolean;
  department: string;
  postedAt?: string;
  updatedAt?: string;
  fetchedAt: string;
  compensation?: string;
  // Listing presence is confirmed; suitability and application eligibility are not.
  verification: "live-listing";
}

export type DiscoveryErrorCode =
  | "INVALID_BOARD" | "LIMIT_EXCEEDED" | "HTTP_ERROR" | "RATE_LIMITED"
  | "TIMEOUT" | "NETWORK_ERROR" | "INVALID_RESPONSE" | "RESPONSE_TOO_LARGE"
  | "REDIRECT_BLOCKED" | "FEED_UNAVAILABLE";

export interface DiscoveryError {
  provider?: AtsProvider;
  boardSlug?: string;
  company?: string;
  code: DiscoveryErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
}

export interface BoardDiscoveryResult {
  board: AtsBoard;
  jobs: DiscoveredJob[];
  fetchedAt: string;
  error?: DiscoveryError;
  warnings: string[];
}

export interface DiscoveryResult {
  jobs: DiscoveredJob[];
  boards: BoardDiscoveryResult[];
  errors: DiscoveryError[];
  fetchedAt: string;
}

export interface DiscoveryOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxJobsPerBoard?: number;
}

export const DISCOVERY_LIMITS = Object.freeze({
  maxBoards: 8,
  concurrency: 4,
  timeoutMs: 25_000,
  maxResponseBytes: 4 * 1024 * 1024,
  maxJobsPerBoard: 500,
});

const PROVIDERS = new Set(["ashby", "greenhouse", "lever", "personio"]);
const SLUG = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,99}$/;
const DNS_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const JOB_ID = /^[a-zA-Z0-9_-]{1,100}$/;
const GREENHOUSE_HOSTS = new Set([
  "boards.greenhouse.io", "job-boards.greenhouse.io",
  "boards.eu.greenhouse.io", "job-boards.eu.greenhouse.io",
]);

function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export function validateBoard(value: unknown): value is AtsBoard {
  const board = record(value);
  return PROVIDERS.has(string(board.provider))
    && typeof board.slug === "string" && SLUG.test(board.slug)
    && (board.provider !== "personio" || DNS_SLUG.test(board.slug))
    && typeof board.company === "string" && board.company.trim().length > 0 && board.company.length <= 150
    && (board.region === undefined || board.region === "eu" || board.region === "global")
    && (board.personioTld === undefined || board.personioTld === "de" || board.personioTld === "com");
}

export function detectBoard(input: string, company?: string): AtsBoard | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const first = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? "");
    let board: AtsBoard | null = null;
    if (host === "jobs.ashbyhq.com") board = { provider: "ashby", slug: first, company: company || first };
    if (GREENHOUSE_HOSTS.has(host)) {
      const slug = first === "embed" ? url.searchParams.get("for") || "" : first;
      board = { provider: "greenhouse", slug, company: company || slug, region: host.includes(".eu.") ? "eu" : "global" };
    }
    if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
      board = { provider: "lever", slug: first, company: company || first, region: host.includes(".eu.") ? "eu" : "global" };
    }
    const personio = host.match(/^([a-z0-9-]+)\.jobs\.personio\.(com|de)$/);
    if (personio) board = { provider: "personio", slug: personio[1], company: company || personio[1], personioTld: personio[2] as "de" | "com" };
    return validateBoard(board) ? board : null;
  } catch { return null; }
}

export function boardUrl(board: AtsBoard): string {
  if (!validateBoard(board)) throw new Error("INVALID_BOARD");
  const slug = encodeURIComponent(board.slug);
  switch (board.provider) {
    case "ashby": return `https://jobs.ashbyhq.com/${slug}`;
    case "greenhouse": return `https://job-boards.${board.region === "eu" ? "eu." : ""}greenhouse.io/${slug}`;
    case "lever": return `https://jobs.${board.region === "eu" ? "eu." : ""}lever.co/${slug}`;
    case "personio": return `https://${board.slug}.jobs.personio.${board.personioTld || "com"}`;
  }
}

// No caller-supplied API URLs. Never fetch a job description URL returned by a feed.
export function apiUrlForBoard(board: AtsBoard): string {
  if (!validateBoard(board)) throw new Error("INVALID_BOARD");
  const slug = encodeURIComponent(board.slug);
  switch (board.provider) {
    case "ashby": return `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
    case "greenhouse": return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    case "lever": return `https://api.${board.region === "eu" ? "eu." : ""}lever.co/v0/postings/${slug}?mode=json`;
    case "personio": return `${boardUrl(board)}/xml`;
  }
}

function decodeEntities(value: string): string {
  return value.replace(/&#(x[\da-f]+|\d+);/gi, (_, raw: string) => {
    const code = raw[0].toLowerCase() === "x" ? parseInt(raw.slice(1), 16) : Number(raw);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
  }).replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&");
}

// Returns plain text only. Consumers must render it as React text, never HTML.
export function htmlToPlainText(value: string): string {
  return decodeEntities(decodeEntities(value)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ").trim().slice(0, 50_000);
}

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function listedUrl(value: unknown, fallback: string): string {
  try {
    const url = new URL(string(value));
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || !hostname.includes(".") || /^\d+(?:\.\d+){3}$/.test(hostname)
      || hostname.startsWith("[") || /\.(?:local|localhost|internal|test|invalid)$/.test(hostname)) return fallback;
    return url.href;
  } catch { return fallback; }
}

function isRemote(title: string, location: string, workplace: string, flag?: unknown): boolean {
  return flag === true || /\bremote\b|\banywhere\b|work from home|work_at_home|remote_work/i.test(`${title} ${location} ${workplace}`);
}

function compensationText(job: Record<string, unknown>): string | undefined {
  const compensation = record(job.compensation);
  const summaries = [string(compensation.summary)];
  for (const tier of array(compensation.compensationTiers)) {
    for (const raw of array(record(tier).components)) {
      const component = record(raw);
      if (component.compensationType !== "Salary") continue;
      const summary = string(component.summary);
      if (summary) summaries.push(summary);
      else if (typeof component.minValue === "number" && typeof component.maxValue === "number"
        && Number.isFinite(component.minValue) && Number.isFinite(component.maxValue)
        && typeof component.currencyCode === "string" && typeof component.interval === "string") {
        summaries.push(`${component.minValue} bis ${component.maxValue} ${component.currencyCode} / ${component.interval}`);
      }
    }
  }
  return [...new Set(summaries.filter(Boolean))].join("; ").slice(0, 1000) || undefined;
}

function normalizeJsonJob(raw: unknown, board: AtsBoard, fetchedAt: string): DiscoveredJob | null {
  const job = record(raw);
  const externalId = typeof job.id === "number" && Number.isSafeInteger(job.id) ? String(job.id) : string(job.id);
  if (!JOB_ID.test(externalId) || job.isListed === false) return null;
  const categories = record(job.categories);
  const title = string(board.provider === "lever" ? job.text : job.title).trim().slice(0, 500);
  if (!title) return null;
  let location = string(job.location) || string(record(job.location).name) || string(job.locationName);
  if (board.provider === "lever") location = [string(categories.location), ...array(categories.allLocations).map(string)].filter(Boolean).join("; ");
  if (board.provider === "ashby") location = [location, ...array(job.secondaryLocations).map((item) => string(record(item).location))].filter(Boolean).join("; ");
  const canonical = board.provider === "greenhouse"
    ? `${boardUrl(board)}/jobs/${externalId}` : `${boardUrl(board)}/${externalId}`;
  const url = listedUrl(job.jobUrl || job.absolute_url || job.hostedUrl || job.applyUrl, canonical);
  const applyUrl = listedUrl(job.applyUrl, url);
  const lists = array(job.lists).map((item) => `${string(record(item).text)} ${string(record(item).content)}`).join(" ");
  const body = board.provider === "lever"
    ? `${string(job.descriptionPlain) || string(job.description)} ${lists} ${string(job.additionalPlain) || string(job.additional)}`
    : string(job.descriptionPlain) || string(job.descriptionHtml) || string(job.content);
  return {
    id: `${board.provider}:${board.slug}:${externalId}`,
    externalId, provider: board.provider, boardSlug: board.slug, company: board.company,
    title, location: location.slice(0, 1000), description: htmlToPlainText(body), url, applyUrl,
    employmentType: string(job.employmentType) || string(categories.commitment),
    remote: isRemote(title, location, string(job.workplaceType), job.isRemote),
    department: string(job.department) || string(job.departmentName) || string(job.teamName)
      || string(categories.team) || string(categories.department) || string(record(array(job.departments)[0]).name),
    postedAt: isoDate(job.publishedAt ?? job.first_published ?? job.createdAt),
    updatedAt: isoDate(job.updated_at || job.updatedAt),
    fetchedAt, compensation: compensationText(job), verification: "live-listing",
  };
}

// OpenJobs childText/splitPositions port, with bounded input, CDATA masking,
// tag boundaries, valid IDs, and nested description names kept out of title fields.
function childText(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return "";
  return decodeEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
}

export function parsePersonioXml(xml: string, board: AtsBoard, fetchedAt: string): DiscoveredJob[] {
  if (!validateBoard(board) || board.provider !== "personio") throw new Error("INVALID_BOARD");
  if (xml.length > DISCOVERY_LIMITS.maxResponseBytes || !/<workzag-jobs\b/.test(xml)
    || (!/<\/workzag-jobs\s*>/.test(xml) && !/<workzag-jobs\b[^>]*\/>/.test(xml))
    || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("INVALID_RESPONSE");
  const cdata: string[] = [];
  const safeXml = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, value: string) => {
    cdata.push(value);
    return `__APPLYAMIGO_CDATA_${cdata.length - 1}__`;
  });
  const restore = (text: string) => text.replace(/__APPLYAMIGO_CDATA_(\d+)__/g, (_, index: string) => cdata[Number(index)] ?? "");
  const jobs: DiscoveredJob[] = [];
  for (const match of safeXml.matchAll(/<position\b[^>]*>([\s\S]*?)<\/position>/gi)) {
    const block = match[1];
    const descriptions = childText(block, "jobDescriptions");
    const scalar = block.replace(/<jobDescriptions\b[^>]*>[\s\S]*?<\/jobDescriptions>/gi, "");
    const externalId = childText(scalar, "id");
    const title = htmlToPlainText(restore(childText(scalar, "name")));
    if (!/^\d{1,20}$/.test(externalId) || !title) continue;
    const location = [...new Set([...scalar.matchAll(/<office\b[^>]*>([\s\S]*?)<\/office>/gi)]
      .map((office) => htmlToPlainText(restore(office[1]))))].filter(Boolean).join("; ");
    const employmentType = [...new Set([childText(scalar, "employmentType"), childText(scalar, "schedule")])].filter(Boolean).join(" / ");
    const url = `${boardUrl(board)}/job/${externalId}`;
    jobs.push({
      id: `personio:${board.slug}:${externalId}`, externalId, provider: "personio", boardSlug: board.slug,
      company: board.company, title, location, url, applyUrl: url,
      description: htmlToPlainText(restore(descriptions)), employmentType,
      remote: isRemote(title, location, childText(scalar, "occupation")),
      department: childText(scalar, "department"), postedAt: isoDate(childText(scalar, "createdAt")),
      fetchedAt, verification: "live-listing",
    });
  }
  if (/<position\b/.test(safeXml) && !jobs.length) throw new Error("INVALID_RESPONSE");
  return jobs;
}

class FeedError extends Error {
  code: DiscoveryErrorCode;
  status?: number;
  constructor(code: DiscoveryErrorCode, status?: number) { super(code); this.code = code; this.status = status; }
}

async function boundedText(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length")) > DISCOVERY_LIMITS.maxResponseBytes) throw new FeedError("RESPONSE_TOO_LARGE");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > DISCOVERY_LIMITS.maxResponseBytes) { await reader.cancel(); throw new FeedError("RESPONSE_TOO_LARGE"); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

const ERROR_MESSAGES: Record<DiscoveryErrorCode, string> = {
  INVALID_BOARD: "Die Stellenquelle ist ungültig oder wird nicht unterstützt.",
  LIMIT_EXCEEDED: "Pro Suche können höchstens acht Stellenquellen abgefragt werden.",
  HTTP_ERROR: "Die Stellenquelle hat einen HTTP-Fehler zurückgegeben.",
  RATE_LIMITED: "Die Stellenquelle begrenzt gerade die Anfragen. Versuche es später erneut.",
  TIMEOUT: "Die Stellenquelle hat nicht rechtzeitig geantwortet.",
  NETWORK_ERROR: "Die Stellenquelle ist derzeit nicht erreichbar.",
  INVALID_RESPONSE: "Die Antwort der Stellenquelle konnte nicht zuverlässig gelesen werden.",
  RESPONSE_TOO_LARGE: "Die Stellenliste überschreitet das Größenlimit dieser Suche.",
  REDIRECT_BLOCKED: "Die Stellenquelle leitet auf eine andere Adresse weiter. Die Weiterleitung wurde nicht aufgerufen.",
  FEED_UNAVAILABLE: "Der öffentliche Stellenfeed ist nicht verfügbar oder wurde deaktiviert.",
};

function errorFor(code: DiscoveryErrorCode, board?: AtsBoard, status?: number): DiscoveryError {
  return { code, message: ERROR_MESSAGES[code], provider: board?.provider, boardSlug: board?.slug,
    company: board?.company, status, retryable: ["TIMEOUT", "NETWORK_ERROR", "RATE_LIMITED"].includes(code) || (status !== undefined && status >= 500) };
}

async function discoverBoard(board: AtsBoard, options: DiscoveryOptions): Promise<BoardDiscoveryResult> {
  const fetchedAt = new Date().toISOString();
  const result: BoardDiscoveryResult = { board, fetchedAt, jobs: [], warnings: [] };
  if (!validateBoard(board)) return { ...result, error: errorFor("INVALID_BOARD") };
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(options.timeoutMs || DISCOVERY_LIMITS.timeoutMs, 100), DISCOVERY_LIMITS.timeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetch || globalThis.fetch)(apiUrlForBoard(board), {
      method: "GET", redirect: "manual", signal: controller.signal,
      headers: { Accept: board.provider === "personio" ? "application/xml,text/xml" : "application/json" },
    });
    if (response.status >= 300 && response.status < 400) throw new FeedError("REDIRECT_BLOCKED", response.status);
    if (!response.ok) throw new FeedError(response.status === 429 ? "RATE_LIMITED"
      : response.status === 404 || response.status === 410 ? "FEED_UNAVAILABLE" : "HTTP_ERROR", response.status);
    const text = await boundedText(response);
    let jobs: DiscoveredJob[];
    if (board.provider === "personio") jobs = parsePersonioXml(text, board, fetchedAt);
    else {
      let payload: unknown;
      try { payload = JSON.parse(text); } catch { throw new FeedError("INVALID_RESPONSE"); }
      const rows = board.provider === "lever" ? payload : record(payload).jobs;
      if (!Array.isArray(rows)) throw new FeedError("INVALID_RESPONSE");
      jobs = rows.map((row) => normalizeJsonJob(row, board, fetchedAt)).filter((row): row is DiscoveredJob => row !== null);
      if (rows.length && !jobs.length) throw new FeedError("INVALID_RESPONSE");
      if (rows.length > jobs.length) result.warnings.push("Einträge ohne gültige Kennung oder Titel wurden ausgelassen.");
    }
    const missingDescriptions = jobs.filter((job) => !job.description).length;
    if (missingDescriptions) result.warnings.push(`${missingDescriptions} Stellen enthalten im Feed keinen Beschreibungstext. Anforderungen müssen auf der Originalseite geprüft werden.`);
    const cap = Math.min(Math.max(options.maxJobsPerBoard || DISCOVERY_LIMITS.maxJobsPerBoard, 1), DISCOVERY_LIMITS.maxJobsPerBoard);
    if (jobs.length > cap) result.warnings.push(`Es werden höchstens ${cap} Stellen dieser Quelle angezeigt. Die Liste ist unvollständig.`);
    result.jobs = [...new Map(jobs.map((job) => [job.id, job])).values()].slice(0, cap);
  } catch (cause) {
    const code = controller.signal.aborted ? "TIMEOUT" : cause instanceof FeedError ? cause.code
      : cause instanceof Error && cause.message === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "NETWORK_ERROR";
    result.error = errorFor(code, board, cause instanceof FeedError ? cause.status : undefined);
  } finally { clearTimeout(timeout); }
  return result;
}

export async function discoverJobs(boards: readonly AtsBoard[], options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
  const fetchedAt = new Date().toISOString();
  if (!Array.isArray(boards) || boards.length > DISCOVERY_LIMITS.maxBoards) {
    return { jobs: [], boards: [], errors: [errorFor("LIMIT_EXCEEDED")], fetchedAt };
  }
  const results: BoardDiscoveryResult[] = [];
  for (let offset = 0; offset < boards.length; offset += DISCOVERY_LIMITS.concurrency) {
    results.push(...await Promise.all(boards.slice(offset, offset + DISCOVERY_LIMITS.concurrency).map((board) => discoverBoard(board, options))));
  }
  return { jobs: [...new Map(results.flatMap((result) => result.jobs).map((job) => [job.id, job])).values()],
    boards: results, errors: results.flatMap((result) => result.error ? [result.error] : []), fetchedAt };
}

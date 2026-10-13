import { ZodError, type ZodType } from "zod";
import { DomainError } from "../domain";
export interface Identity { id: string; name: string; email: string }
export function identity(request: Request): Identity {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!id || !email || id.length > 300 || email.length > 320) throw new DomainError("Melde dich zuerst mit ChatGPT an.", 401);
  let name = request.headers.get("oai-authenticated-user-full-name") || email;
  if (request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") { try { name = decodeURIComponent(name); } catch { name = email; } }
  return { id, name: name.slice(0, 200), email };
}
export function requireSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (site === "cross-site" || (origin && origin !== new URL(request.url).origin) || (!origin && site !== "same-origin")) throw new DomainError("Diese Änderung muss aus deinem geöffneten Arbeitsbereich kommen.", 403);
}
export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) throw new DomainError("Sende die Daten als JSON.", 415);
  const max = 300_000;
  if (Number(request.headers.get("content-length")) > max) throw new DomainError("Die Anfrage ist zu groß. Kürze den Lebenslauf oder die Stellenbeschreibung.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DomainError("Die Anfrage enthält keine Daten.", 400);
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const item = await reader.read(); if (item.done) break;
    length += item.value.length;
    if (length > max) { await reader.cancel(); throw new DomainError("Die Anfrage ist zu groß.", 413); }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new DomainError("Die Anfrage enthält kein gültiges JSON.", 400); }
  return schema.parse(parsed);
}
export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "oai-authenticated-user-id", ...extra } });
}
export async function api(request: Request, action: (user: Identity) => Promise<unknown>): Promise<Response> {
  try { const user = identity(request); requireSameOrigin(request); const result = await action(user); return result instanceof Response ? result : json(result); }
  catch (error) {
    if (error instanceof DomainError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: "Einige Angaben sind ungültig oder zu lang.", details: error.issues.map(issue => issue.path.join(".")).filter(Boolean).slice(0, 8) }, 400);
    console.error("applyAmigo API error", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Die Daten konnten gerade nicht verarbeitet werden. Bitte versuche es erneut." }, 503);
  }
}

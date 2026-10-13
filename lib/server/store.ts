import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { workspaces } from "../../db/schema";
import { DomainError, emptyWorkspace } from "../domain";
import type { Workspace } from "../types";
import type { Identity } from "./http";
export interface StoredWorkspace extends Workspace { modelUsage?: { date: string; count: number; availableAt: number } }

async function readRow(userId: string) {
  const db = getDb();
  let row = await db.select().from(workspaces).where(eq(workspaces.userId, userId)).get();
  if (!row) {
    await db.insert(workspaces).values({ userId, data: JSON.stringify(emptyWorkspace()), revision: 0, updatedAt: new Date().toISOString() }).onConflictDoNothing();
    row = await db.select().from(workspaces).where(eq(workspaces.userId, userId)).get();
  }
  if (!row) throw new DomainError("Der Arbeitsbereich konnte nicht geladen werden.", 503);
  return row;
}
export async function readWorkspace(user: Identity): Promise<Workspace> {
  const row = await readRow(user.id);
  return expose(JSON.parse(row.data) as StoredWorkspace, user);
}
export function expose(workspace: Workspace, user: Identity): Workspace {
  return { profile: workspace.profile, jobs: workspace.jobs, drafts: workspace.drafts, sources: workspace.sources, blocks: workspace.blocks, lastScanAt: workspace.lastScanAt, user: { name: user.name, email: user.email }, aiConfigured: false };
}
/** Callback may run again on conflict. Do not perform network calls or other side effects in it. */
export async function mutateWorkspace<T>(user: Identity, change: (workspace: StoredWorkspace) => T): Promise<{ workspace: Workspace; value: T }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await readRow(user.id);
    const workspace = JSON.parse(row.data) as StoredWorkspace;
    const value = change(workspace);
    const data = JSON.stringify({ ...workspace, user: { name: "", email: "" }, aiConfigured: false });
    if (new TextEncoder().encode(data).length > 1_700_000) throw new DomainError("Dein Arbeitsbereich ist zu groß. Kürze lange Stellenbeschreibungen oder exportiere deine Daten.", 413);
    const updated = await getDb().update(workspaces).set({ data, revision: row.revision + 1, updatedAt: new Date().toISOString() }).where(and(eq(workspaces.userId, user.id), eq(workspaces.revision, row.revision))).returning({ id: workspaces.userId });
    if (updated.length) return { workspace: expose(workspace, user), value };
  }
  throw new DomainError("Dein Arbeitsbereich wurde gleichzeitig geändert. Lade ihn neu und versuche es noch einmal.", 409);
}

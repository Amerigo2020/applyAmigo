import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../drizzle/0000_kind_snowbird.sql", import.meta.url), "utf8"));
function prepare(sql, params = []) {
  return {
    bind(...values) { return prepare(sql, values); },
    async raw() { return sqlite.prepare(sql).all(...params).map(row => Object.values(row)); },
    async all() { return { success: true, results: sqlite.prepare(sql).all(...params), meta: {} }; },
    async run() { return { success: true, results: [], meta: sqlite.prepare(sql).run(...params) }; },
  };
}
export const env = { DB: { prepare } };

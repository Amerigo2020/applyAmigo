import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
const root = new URL("../", import.meta.url);
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2), root).href;
  if (specifier.startsWith(".") || specifier.startsWith("file:")) {
    const url = new URL(specifier, context.parentURL ?? root);
    for (const extension of ["", ".ts", "/index.ts"]) {
      const candidate = new URL(url.href + extension);
      if (candidate.pathname.endsWith(".ts") && existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "module", source: ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}

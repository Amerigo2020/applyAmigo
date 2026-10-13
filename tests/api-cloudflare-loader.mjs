export function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return { url: new URL("./api-env.mjs", import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}

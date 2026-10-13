import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCoverage, countOccurrences, variantForms, extractJobKeywords } from "./keyword-match.ts";

test("career-ops port preserves boundaries, synonyms, and conservative acronym variants", () => {
  const evidence = "Built Python services with FastAPI. Python remains my primary language. Deployed on k8s. Owned CI/CD pipelines. Wrote C++ modules and JavaScript. Strong in machine learning and PostgreSQL. Set up observability once.";
  const result = analyzeCoverage(["Python", "FastAPI", "Kubernetes", "CI/CD", "C++", "Machine Learning", "Postgres", "observability", "Java", "gRPC"], evidence);
  assert.equal(result.coveragePct, 80);
  assert.deepEqual(result.missing, ["Java", "gRPC"]);
  assert.ok(result.thin.includes("observability"));
  assert.ok(!result.thin.includes("Python"));
  assert.ok(!variantForms("aws").includes("aw"));
  assert.equal(countOccurrences("Java", "JavaScript"), 0);
  assert.equal(countOccurrences("Java", "Javakenntnisse"), 0);
});

test("missing evidence is a gap, not an invented skill", () => {
  const keywords = extractJobKeywords("Python, ROS2 and reinforcement learning required. APIs are a plus.");
  assert.ok(keywords.includes("Python"));
  assert.ok(keywords.includes("ROS2"));
  assert.ok(keywords.includes("API"));
  const result = analyzeCoverage(keywords, "B.Sc. Wirtschaftsinformatik. Gründer eines Beispielprojekts.");
  assert.equal(result.coveragePct, 0);
  assert.deepEqual(result.present, []);
  assert.equal(result.missing.length, keywords.length);
  assert.equal(analyzeCoverage([], "").coveragePct, 0);
});

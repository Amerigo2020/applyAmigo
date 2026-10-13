/**
 * Pure TypeScript port of career-ops keyword-match.mjs.
 * Copyright (c) 2026 Santiago Fernández de Valderrama. MIT.
 * Upstream: 8aafd1252c14d08b00f0c4e8c2f7f778db80bce9.
 * See licenses/career-ops-LICENSE and THIRD_PARTY_NOTICES.md.
 * A coverage diagnostic, never evidence of a candidate's experience.
 */

export const SYNONYMS: readonly (readonly string[])[] = [
  ["javascript", "js"],
  ["typescript", "ts"],
  ["kubernetes", "k8s"],
  ["machine learning", "ml"],
  ["ci/cd", "cicd"],
  ["infrastructure as code", "iac"],
  ["natural language processing", "nlp"],
  ["large language model", "large language models", "llm"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp"],
  ["postgresql", "postgres"],
];

export function normalizeText(value: string): string {
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

export function countOccurrences(term: string, text: string): number {
  const normalized = normalizeText(term);
  if (!normalized) return 0;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Unicode boundaries prevent matching Java inside JavaScript or German compounds.
  const expression = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "gu");
  return normalizeText(text).match(expression)?.length ?? 0;
}

export function variantForms(term: string): string[] {
  const normalized = normalizeText(term);
  const forms = new Set([normalized]);
  if (normalized.length < 3) return [...forms];
  if (!normalized.endsWith("s")) forms.add(normalized + "s");
  else if (normalized.length > 3) forms.add(normalized.slice(0, -1));
  return [...forms];
}

export function expandTerms(keyword: string): string[] {
  const forms = variantForms(keyword);
  const terms = new Set(forms);
  for (const group of SYNONYMS) {
    if (!forms.some((form) => group.includes(form))) continue;
    for (const member of group) {
      for (const variant of variantForms(member)) terms.add(variant);
    }
  }
  return [...terms];
}

export function keywordCount(keyword: string, text: string): number {
  return expandTerms(keyword).reduce((count, term) => count + countOccurrences(term, text), 0);
}

export interface KeywordCoverage {
  total: number;
  presentCount: number;
  coveragePct: number;
  present: string[];
  thin: string[];
  missing: string[];
}

export function analyzeCoverage(keywords: readonly string[], cvText: string): KeywordCoverage {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of keywords.slice(0, 100)) {
    const keyword = String(raw).trim().slice(0, 100);
    const key = normalizeText(keyword);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(keyword);
  }
  const present: string[] = [];
  const thin: string[] = [];
  const missing: string[] = [];
  const evidence = cvText.slice(0, 100_000);
  for (const keyword of cleaned) {
    const count = keywordCount(keyword, evidence);
    if (count === 0) missing.push(keyword);
    else {
      present.push(keyword);
      if (count === 1) thin.push(keyword);
    }
  }
  return {
    total: cleaned.length,
    presentCount: present.length,
    coveragePct: cleaned.length ? Math.round((present.length / cleaned.length) * 100) : 0,
    present,
    thin,
    missing,
  };
}

// applyAmigo's explicit dictionary. Presence in a posting does not imply a must-have.
const JOB_KEYWORDS = [
  "Python", "TypeScript", "JavaScript", "Java", "C++", "C#", "Rust", "SQL",
  "React", "Next.js", "Node.js", "FastAPI", "Docker", "Kubernetes", "Git",
  "Linux", "CI/CD", "AWS", "GCP", "Azure", "PostgreSQL", "API",
  "PyTorch", "TensorFlow", "OpenCV", "HuggingFace", "LangChain", "RAG",
  "LLM", "Machine Learning", "Reinforcement Learning", "Computer Vision",
  "ROS", "ROS2", "MuJoCo", "Isaac Sim", "SLAM", "Sensor Fusion",
  "Imitation Learning", "Robotics", "Robotik", "Deutsch", "German", "English",
] as const;

export function extractJobKeywords(description: string): string[] {
  const text = description.slice(0, 100_000);
  return JOB_KEYWORDS.filter((keyword) => keywordCount(keyword, text) > 0);
}

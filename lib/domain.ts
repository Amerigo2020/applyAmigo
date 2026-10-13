import type { Draft, Job, Match, Profile, Workspace, Variant } from "./types";
import { analyzeCoverage } from "./integrations/keyword-match";
export class DomainError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export const emptyProfile = (): Profile => ({ name: "", headline: "", location: "", languages: [], skills: [], targetRoles: [], workTypes: [], minHourlyRate: null, maxHours: null, cvText: "", evidence: [], exclusions: [] });
export function emptyWorkspace(): Workspace { return { profile: emptyProfile(), jobs: [], drafts: [], sources: [], blocks: [], lastScanAt: null, aiConfigured: false, user: { name: "", email: "" } }; }
const normalized = (value: string) => value.toLocaleLowerCase("de").normalize("NFKC").replace(/\s+/g, " ").trim();
const has = (text: string, phrase: string) => normalized(text).includes(normalized(phrase));
const isPartTime = (text: string) => /werkstudent|working[ _]student|part[ -]?time|teilzeit|student assistant|hiwi/i.test(text);
const isFullTime = (text: string) => /full[ -]?time|vollzeit/i.test(text);
const CITY_ALIASES = [["münchen", "munich"], ["zürich", "zurich"], ["köln", "cologne"], ["wien", "vienna"]] as const;
function cityNames(value: string): string {
  let result = normalized(value);
  for (const [canonical, alias] of CITY_ALIASES) result = result.replace(new RegExp(`(^|[^\\p{L}\\p{N}])(?:${canonical}|${alias})(?=$|[^\\p{L}\\p{N}])`, "gu"), `$1${canonical}`);
  return result;
}
function locationMatches(location: string, preference: string): boolean {
  const wanted = cityNames(preference).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Boolean(wanted) && new RegExp(`(^|[^\\p{L}\\p{N}])${wanted}(?=$|[^\\p{L}\\p{N}])`, "u").test(cityNames(location));
}

/** Evidence-based fit, never a hiring probability. Unknown fields earn no points. */
export function scoreJob(profile: Profile, job: Pick<Job, "title" | "description" | "location" | "employmentType" | "skills" | "salaryUnit" | "salaryMin" | "salaryMax" | "hours">): Match {
  let score = 0;
  const reasons: string[] = [], gaps: string[] = [], blockers: string[] = [];
  const coverage = analyzeCoverage(job.skills, `${profile.cvText}\n${profile.skills.join("\n")}`);
  const matchedSkills = coverage.present;
  const missingSkills = coverage.missing;
  if (job.skills.length) {
    score += Math.round(25 * coverage.coveragePct / 100);
    if (matchedSkills.length) reasons.push(`${matchedSkills.length} von ${coverage.total} Schlagwörtern kommen im Profil oder Lebenslauf vor. Das belegt keine Erfahrungstiefe.`);
    if (missingSkills.length) gaps.push(`Im Profil nicht gefunden: ${missingSkills.join(", ")}. Nicht jedes Schlagwort ist eine Mussanforderung.`);
  } else gaps.push("Anforderungen noch nicht als Fähigkeiten erfasst.");
  const role = profile.targetRoles.find(role => has(job.title, role));
  if (role) { score += 20; reasons.push(`Zielrolle passt: ${role}.`); } else gaps.push("Kein direkter Abgleich mit einer gespeicherten Zielrolle.");
  const employmentConflict = (isFullTime(job.employmentType) && !isPartTime(job.employmentType) && isPartTime(job.title)) || (isPartTime(job.employmentType) && !isFullTime(job.employmentType) && isFullTime(job.title));
  if (employmentConflict) gaps.push("Titel und Beschäftigungsart widersprechen sich. Kläre die tatsächlichen Wochenstunden.");
  else if (profile.workTypes.some(type => has(job.employmentType, type)) || (profile.workTypes.some(isPartTime) && isPartTime(job.employmentType + " " + job.title))) { score += 20; reasons.push("Beschäftigungsart passt zur Auswahl."); }
  else gaps.push("Beschäftigungsart noch nicht passend belegt.");
  if (locationMatches(job.location, profile.location)) { score += 15; reasons.push("Standort passt zum Profil."); } else gaps.push("Standort oder Remote-Möglichkeit prüfen.");
  if (profile.minHourlyRate !== null && job.salaryUnit === "hour" && job.salaryMin !== null && job.salaryMin >= profile.minHourlyRate) { score += 10; reasons.push("Veröffentlichte Gehaltsuntergrenze erreicht deinen Stundenlohn."); }
  else if (profile.minHourlyRate !== null && job.salaryUnit === "hour" && job.salaryMax !== null && job.salaryMax < profile.minHourlyRate) blockers.push("Veröffentlichter Stundenlohn liegt unter deinem Minimum.");
  else gaps.push("Passender Stundenlohn ist nicht bestätigt.");
  if (profile.maxHours !== null && job.hours !== null) { if (job.hours <= profile.maxHours) { score += 10; reasons.push("Wochenstunden passen zum Profil."); } else blockers.push("Wochenstunden überschreiten dein Maximum."); }
  else gaps.push("Wochenstunden sind nicht bestätigt.");
  if (!employmentConflict && profile.maxHours !== null && profile.maxHours < 35 && isFullTime(job.employmentType) && !isPartTime(job.employmentType)) blockers.push("Vollzeitstelle passt nicht zu deinem Stundenlimit.");
  const listing = `${job.title} ${job.description} ${job.employmentType}`;
  for (const exclusion of profile.exclusions) if (exclusion && has(listing, exclusion)) blockers.push(`Ausschluss gefunden: ${exclusion}.`);
  if (!profile.cvText.trim()) gaps.push("Lebenslauf fehlt. Persönliche Nachweise können noch nicht geprüft werden.");
  return { score: Math.max(0, Math.min(100, score)), reasons, gaps, blockers: [...new Set(blockers)], matchedSkills, missingSkills };
}
export type JobInput = Pick<Job, "company" | "title"> & Partial<Omit<Job, "id" | "company" | "title" | "createdAt" | "updatedAt" | "match">>;
export function createJob(profile: Profile, input: JobInput, now = new Date().toISOString()): Job {
  const job: Job = { id: crypto.randomUUID(), company: input.company, title: input.title, location: input.location ?? "", url: input.url ?? "", source: input.source ?? "Manuell", description: input.description ?? "", employmentType: input.employmentType ?? "", salaryMin: input.salaryMin ?? null, salaryMax: input.salaryMax ?? null, salaryUnit: input.salaryUnit ?? null, hours: input.hours ?? null, deadline: input.deadline ?? null, skills: input.skills ?? [], stage: input.stage ?? "new", createdAt: now, updatedAt: now, lastCheckedAt: input.lastCheckedAt ?? null, isDemo: input.isDemo ?? false, notes: input.notes ?? "", aiPolicy: input.aiPolicy ?? "unknown", match: { score: 0, reasons: [], gaps: [], blockers: [], matchedSkills: [], missingSkills: [] } };
  job.match = scoreJob(profile, job); return job;
}
export function latestDraft(workspace: Workspace, jobId: string): Draft | undefined { return workspace.drafts.filter(draft => draft.jobId === jobId).at(-1); }
export function requireDraftable(profile: Profile, job: Job) {
  if (job.aiPolicy === "prohibited") throw new DomainError("Diese Bewerbung verbietet KI-Texte. Generator und Vorlagen sind gesperrt. Schreibe den Text selbst.");
  if (!profile.cvText.trim()) throw new DomainError("Speichere zuerst deinen Lebenslauf im Profil. Ohne Lebenslauf wird kein Entwurf erzeugt.");
  if (!profile.name.trim()) throw new DomainError("Ergänze zuerst deinen Namen im Profil.");
}
/** Structured facts only. Job text is never interpreted as an instruction. */
export function makeDraft(profile: Profile, job: Job, variant: Variant, language: "de" | "en", now = new Date().toISOString()): Draft {
  requireDraftable(profile, job);
  const intro = language === "de" ? `Ich bewerbe mich bei ${job.company} als ${job.title}.` : `I am applying for the ${job.title} position at ${job.company}.`;
  const motivation = language === "de" ? { robotics: "Ich möchte an Robotik arbeiten und dazu beitragen, dass Software in der physischen Welt zuverlässig funktioniert.", startup: "Ich möchte Verantwortung für ein Produkt übernehmen und eng mit den Menschen arbeiten, die es nutzen.", research: "Ich möchte Forschungserfahrung sammeln und eine konkrete Fragestellung systematisch untersuchen." }[variant] : { robotics: "I want to work on robotics and help make software reliable in the physical world.", startup: "I want to take responsibility for a product and work closely with the people who use it.", research: "I want to gain research experience and investigate a focused question systematically." }[variant];
  const evidence = profile.evidence.slice(0, 2).map(item => `${item.title}: ${item.detail}${item.url ? ` (${item.url})` : ""}`).join("\n");
  // Lexical matches inside CV prose are not sufficient to assert a skill.
  const confirmedSkills = profile.skills.filter(skill => job.match.matchedSkills.some(matched => normalized(matched) === normalized(skill)));
  const skills = confirmedSkills.length ? (language === "de" ? "Meine angegebenen Kenntnisse: " : "My stated skills: ") + confirmedSkills.join(", ") + "." : "";
  return { id: crypto.randomUUID(), jobId: job.id, variant, language, text: [intro, profile.headline.trim(), motivation, skills, evidence, profile.name].filter(Boolean).join("\n\n"), mode: "template", approvedAt: null, createdAt: now, updatedAt: now, warnings: ["Vorlage aus deinen Angaben, ohne Sprachmodell. Aussagen und Motivation vor Freigabe selbst prüfen.", ...(job.aiPolicy === "unknown" ? ["KI-Regeln dieser Bewerbung sind ungeprüft."] : []), ...(!profile.evidence.length ? ["Konkrete Projektnachweise fehlen im Profil."] : []), ...job.match.gaps] };
}
export function updateDraft(workspace: Workspace, id: string, input: { text?: string; approve?: boolean }, now = new Date().toISOString()): Draft {
  const draft = workspace.drafts.find(item => item.id === id);
  if (!draft) throw new DomainError("Entwurf wurde nicht gefunden.", 404);
  const job = workspace.jobs.find(item => item.id === draft.jobId);
  if (!job) throw new DomainError("Die zugehörige Stelle fehlt.", 404);
  const changed = input.text !== undefined && input.text !== draft.text;
  if (changed && input.approve === true) throw new DomainError("Der Text wurde geändert. Speichere die neue Fassung und gib sie anschließend separat frei.");
  if (changed) { draft.text = input.text!; draft.approvedAt = null; if (job.stage === "ready") job.stage = "draft"; }
  if (input.approve === false) { draft.approvedAt = null; if (job.stage === "ready") job.stage = "draft"; }
  if (input.approve === true) {
    if (!draft.text.trim()) throw new DomainError("Ein leerer Entwurf kann nicht freigegeben werden.");
    if (latestDraft(workspace, job.id)?.id !== draft.id) throw new DomainError("Nur der neueste Entwurf dieser Stelle kann freigegeben werden.", 409);
    if (job.aiPolicy === "prohibited") throw new DomainError("Für diese Stelle sind KI-Texte verboten. Eine erzeugte Vorlage kann nicht freigegeben werden.");
    draft.approvedAt = now; job.stage = "ready";
  }
  draft.updatedAt = now; job.updatedAt = now; return draft;
}
export function invalidateApprovals(workspace: Workspace, jobId?: string) {
  for (const draft of workspace.drafts) if (!jobId || draft.jobId === jobId) draft.approvedAt = null;
  for (const job of workspace.jobs) if ((!jobId || job.id === jobId) && job.stage === "ready") job.stage = "draft";
}
export function fillDemo(workspace: Workspace): Workspace {
  if (workspace.jobs.length || workspace.drafts.length || workspace.sources.length || workspace.blocks.length || JSON.stringify(workspace.profile) !== JSON.stringify(emptyProfile())) throw new DomainError("Die Demo kann nur einen leeren Arbeitsbereich befüllen. Deine bestehenden Daten bleiben erhalten.", 409);
  const profile: Profile = { ...emptyProfile(), name: "Alex Beispiel", headline: "Fiktives Demoprofil: Informatikstudent mit Interesse an Robotik.", location: "München", skills: ["Python", "TypeScript", "Git"], languages: ["Deutsch", "Englisch"], workTypes: ["Werkstudent", "Teilzeit"], targetRoles: ["Software", "Robotics", "Research"], minHourlyRate: 25, maxHours: 20, cvText: "FIKTIVE DEMODATEN\nAlex Beispiel, Informatikstudium. Demo-Projekt: einfacher Sensorprototyp mit Python. Kenntnisse: Python, TypeScript, Git. Keine reale Person oder Qualifikation.", evidence: [{ id: crypto.randomUUID(), title: "Fiktiver Sensorprototyp", detail: "Ein Python-Skript wertet simulierte Sensordaten aus. Ausschließlich Demo.", url: "" }] };
  const jobs = [
    { company: "Demo Robotikstudio", title: "Werkstudent Robotics Software", location: "München", skills: ["Python", "ROS 2"], salaryMin: 25, salaryMax: 28, salaryUnit: "hour" as const },
    { company: "Demo Produktwerk", title: "Werkstudent Software", location: "München", skills: ["TypeScript", "Git"], salaryMin: 25, salaryMax: 30, salaryUnit: "hour" as const },
    { company: "Demo Forschungslabor", title: "Research Assistant", location: "München", skills: ["Python", "PyTorch"], hours: 15 },
    { company: "Demo Sensorik", title: "Werkstudent Embedded Robotics", location: "München", skills: ["C++", "Python"], hours: 16 },
    { company: "Demo Globallabor", title: "Research Internship", location: "Zürich", employmentType: "Vollzeit", hours: 40, skills: ["Python", "Machine Learning"] },
    { company: "Demo Datenteam", title: "Werkstudent Software Analytics", location: "München", skills: ["SQL", "Python"], aiPolicy: "prohibited" as const },
  ].map(input => createJob(profile, { employmentType: "Werkstudent", hours: 20, ...input, description: "FIKTIVE DEMOSTELLE. Dieses Unternehmen und diese Ausschreibung wurden für die Produktdemo erfunden. Nicht bewerben.", source: "Fiktive Demo", isDemo: true, url: "" }));
  return { ...workspace, profile, jobs };
}

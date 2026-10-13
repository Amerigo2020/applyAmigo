export type Stage = "new" | "saved" | "draft" | "ready" | "applied" | "interview" | "rejected" | "archived";
export type Variant = "robotics" | "startup" | "research";
export type Provider = "ashby" | "greenhouse" | "lever" | "personio";
export interface Evidence { id: string; title: string; detail: string; url: string; }
export interface Profile {
  name: string; headline: string; location: string; languages: string[];
  skills: string[]; targetRoles: string[]; workTypes: string[];
  minHourlyRate: number | null; maxHours: number | null;
  cvText: string; evidence: Evidence[]; exclusions: string[];
}
export interface Match {
  score: number; reasons: string[]; gaps: string[]; blockers: string[];
  matchedSkills: string[]; missingSkills: string[];
}
export interface Job {
  id: string; company: string; title: string; location: string; url: string;
  source: string; description: string; employmentType: string;
  salaryMin: number | null; salaryMax: number | null; salaryUnit: "hour" | "month" | "year" | null;
  hours: number | null; deadline: string | null; skills: string[];
  stage: Stage; createdAt: string; updatedAt: string; lastCheckedAt: string | null;
  match: Match; isDemo: boolean; notes: string; aiPolicy: "allowed" | "unknown" | "prohibited";
}
export interface Draft {
  id: string; jobId: string; variant: Variant; language: "de" | "en";
  text: string; warnings: string[]; mode: "template" | "ai";
  approvedAt: string | null; createdAt: string; updatedAt: string;
}
export interface Source { id: string; provider: Provider; board: string; company: string; enabled: boolean; }
export interface SprintBlock { id: string; jobId: string; date: string; startTime: string; durationMinutes: number; task: string; done: boolean; }
export interface Workspace {
  profile: Profile; jobs: Job[]; drafts: Draft[]; sources: Source[];
  blocks: SprintBlock[]; lastScanAt: string | null; aiConfigured: boolean; user: { name: string; email: string };
}
export interface ApiError { error: string; details?: string[]; }

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Bookmark, Check, Clock3, MapPin, X, type LucideIcon } from "lucide-react";
import type { Job, Stage } from "@/lib/types";

export const stageLabels: Record<Stage, string> = { new: "Entdeckt", saved: "Merkliste", draft: "Entwurf", ready: "Freigegeben", applied: "Beworben", interview: "Gespräch", rejected: "Absage", archived: "Archiviert" };
export const stageOptions = Object.entries(stageLabels) as [Stage, string][];
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function shortDate(value: string) { return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value)); }
export function deadlineDays(value: string | null) { if (!value) return null; return Math.ceil((new Date(value.length === 10 ? `${value}T23:59:59` : value).getTime() - Date.now()) / 86400000); }
export function downloadText(name: string, text: string, type = "text/plain;charset=utf-8") { const url = URL.createObjectURL(new Blob([text], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export function Logo({ small = false }: { small?: boolean }) {
  return <span className={`brand ${small ? "brand-small" : ""}`}><svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="currentColor"/><path d="m9 29 9-19h5l8 19h-7l-4-11-4 11Z" fill="#eef5e7"/><path d="m18 28 7-5 4 6H18Z" fill="#a5c8b0"/></svg><span>apply<span className="brand-light">Amigo</span><span className="brand-dot">.</span></span></span>;
}

export function MatchRing({ score, compact = false }: { score: number; compact?: boolean }) {
  const safeScore = Math.min(100, Math.max(0, score));
  return <span className={`match-ring ${compact ? "compact" : ""}`} title={`${safeScore} von 100 Punkten Profilpassung. Keine Erfolgswahrscheinlichkeit.`} aria-label={`${safeScore} von 100 Punkten Profilpassung`}><strong>{safeScore}</strong><small>/100</small></span>;
}

export function EmptyState({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={25}/></span><h3>{title}</h3><p>{description}</p>{children && <div className="empty-actions">{children}</div>}</div>;
}

export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`app-modal ${wide ? "modal-wide" : ""}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="modal-title"><div className="modal-shell"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Dialog schließen" onClick={onClose}><X size={21}/></button></div>{children}</div></dialog>;
}

export function JobCard({ job, onOpen, onSave, busy }: { job: Job; onOpen: () => void; onSave: () => void; busy: boolean }) {
  const days = deadlineDays(job.deadline);
  return <article className="job-card"><div className="job-topline"><div className={`company-avatar company-tone-${job.company.length % 5}`} aria-hidden="true">{job.company.split(/\s/).slice(0, 2).map(part => part[0]).join("")}</div><div className="company-info"><span>{job.company}</span><span className="company-source">{job.isDemo ? "Fiktives Beispiel" : job.source || "Eigene Stelle"}</span></div><button className={`icon-button bookmark ${job.stage !== "new" ? "bookmarked" : ""}`} disabled={busy || job.stage !== "new"} aria-label={job.stage === "new" ? `${job.title} merken` : "Bereits in deinen Bewerbungen"} onClick={onSave}>{job.stage !== "new" ? <Check size={18}/> : <Bookmark size={18}/>}</button></div><button className="job-title-button" onClick={onOpen}><h3>{job.title}</h3></button><div className="job-metadata"><span><MapPin size={13}/>{job.location || "Ort offen"}</span><span><Clock3 size={13}/>{job.employmentType || "Arbeitsmodell offen"}</span></div><div className="job-tags">{job.match.matchedSkills.slice(0, 2).map(skill => <span className="tag match-tag" key={skill}>{skill}</span>)}{job.match.matchedSkills.length === 0 && job.skills.slice(0, 2).map(skill => <span className="tag" key={skill}>{skill}</span>)}{job.salaryMin !== null && <span className="tag salary-tag">ab {job.salaryMin.toLocaleString("de-DE")} €{job.salaryUnit === "hour" ? "/h" : job.salaryUnit === "month" ? "/Monat" : job.salaryUnit === "year" ? "/Jahr" : ""}</span>}</div><div className="job-card-footer"><div className="match-label"><MatchRing score={job.match.score} compact/><span>Profilpassung{job.match.blockers.length > 0 && <small className="attention-text">{job.match.blockers.length} Hürde prüfen</small>}</span></div><button className="text-button job-details" onClick={onOpen}>Ansehen <ArrowUpRight size={16}/></button></div>{job.deadline && <div className={`deadline-strip ${days !== null && days <= 7 ? "urgent" : ""}`}><Clock3 size={12}/>{days !== null && days < 0 ? "Frist abgelaufen" : `Frist ${shortDate(job.deadline)}`}{days !== null && days >= 0 && days <= 7 ? ` · noch ${days} ${days === 1 ? "Tag" : "Tage"}` : ""}</div>}</article>;
}

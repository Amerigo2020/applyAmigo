import test from "node:test";
import assert from "node:assert/strict";
import { createJob, emptyWorkspace, fillDemo, makeDraft, scoreJob, updateDraft, invalidateApprovals } from "../lib/domain.ts";

test("fit exposes unknown skills and salary without implying success probability", () => {
  const workspace = fillDemo(emptyWorkspace());
  const job = createJob(workspace.profile, { company: "Example", title: "Robotics", skills: ["Python", "ROS2"], employmentType: "Vollzeit", hours: 40 });
  assert.ok(job.match.missingSkills.includes("ROS2"));
  assert.ok(job.match.blockers.some(item => item.includes("Stunden")));
  assert.ok(job.match.gaps.some(item => item.includes("Stundenlohn")));
  assert.ok(job.match.score < 100);
  const blank = scoreJob(emptyWorkspace().profile, job);
  assert.equal(blank.score, 0);
});
test("AI prohibition and missing CV block template generation", () => {
  const workspace = fillDemo(emptyWorkspace());
  const prohibited = workspace.jobs.find(job => job.aiPolicy === "prohibited");
  assert.throws(() => makeDraft(workspace.profile, prohibited, "robotics", "de"), /verbietet/);
  assert.throws(() => makeDraft({ ...workspace.profile, cvText: "" }, workspace.jobs[0], "robotics", "de"), /Lebenslauf/);
});
test("keyword coverage never converts a CV mention into a template skills claim", () => {
  const workspace = fillDemo(emptyWorkspace());
  workspace.profile.cvText += "\nNoch keine Kenntnisse in ROS2.";
  const job = createJob(workspace.profile, { company: "Example", title: "Robotics", skills: ["ROS2"] });
  assert.ok(job.match.matchedSkills.includes("ROS2"));
  const draft = makeDraft(workspace.profile, job, "robotics", "de");
  assert.ok(!draft.text.includes("ROS2"));
});
test("only current draft can be approved; edits and profile updates revoke approval", () => {
  const workspace = fillDemo(emptyWorkspace()); const job = workspace.jobs[0];
  const first = makeDraft(workspace.profile, job, "robotics", "de"); workspace.drafts.push(first);
  updateDraft(workspace, first.id, { approve: true }); assert.equal(job.stage, "ready");
  updateDraft(workspace, first.id, { text: first.text + "\nÄnderung" }); assert.equal(first.approvedAt, null); assert.equal(job.stage, "draft");
  assert.throws(() => updateDraft(workspace, first.id, { text: "Andere Version", approve: true }), /separat/);
  const second = makeDraft(workspace.profile, job, "robotics", "de"); workspace.drafts.push(second);
  assert.throws(() => updateDraft(workspace, first.id, { approve: true }), /neueste/);
  updateDraft(workspace, second.id, { approve: true }); invalidateApprovals(workspace);
  assert.equal(second.approvedAt, null); assert.equal(job.stage, "draft");
});
test("demo is fictional and never overwrites an existing profile", () => {
  const workspace = fillDemo(emptyWorkspace()); assert.equal(workspace.jobs.length, 6); assert.ok(workspace.jobs.every(job => job.isDemo));
  assert.match(workspace.profile.cvText, /FIKTIVE DEMODATEN/);
  assert.throws(() => fillDemo(workspace), /leeren/);
  const other = emptyWorkspace(); other.profile.location = "München"; assert.throws(() => fillDemo(other), /leeren/);
});
test("location matching accepts only explicit city aliases in either language", () => {
  for (const [german, english] of [["München", "Munich"], ["Zürich", "Zurich"], ["Köln", "Cologne"], ["Wien", "Vienna"]]) {
    for (const [profileCity, jobCity] of [[german, english], [english, german]]) {
      const profile = { ...emptyWorkspace().profile, location: profileCity };
      const job = createJob(profile, { company: "Example", title: "Job", location: `${jobCity}, Europe` });
      assert.equal(job.match.score, 15);
      assert.ok(job.match.reasons.includes("Standort passt zum Profil."));
      assert.ok(!job.match.gaps.some(gap => gap.includes("Standort")));
    }
  }
  const profile = { ...emptyWorkspace().profile, location: "München" };
  for (const location of ["Munichberg", "Garching", "Bavaria", "Berlin"]) assert.equal(createJob(profile, { company: "Example", title: "Job", location }).match.score, 0);
});
test("contradictory student title and full-time ATS type require clarification without fit points", () => {
  const profile = { ...emptyWorkspace().profile, workTypes: ["Werkstudent"], maxHours: 20 };
  const conflicting = createJob(profile, { company: "Example", title: "Working Student Integrations", employmentType: "FullTime" });
  assert.equal(conflicting.match.score, 0);
  assert.ok(conflicting.match.gaps.some(gap => gap.includes("widersprechen")));
  assert.ok(!conflicting.match.reasons.some(reason => reason.includes("Beschäftigungsart")));
  assert.ok(!conflicting.match.blockers.some(blocker => blocker.includes("Vollzeitstelle")));
  const student = createJob(profile, { company: "Example", title: "Working Student Integrations", employmentType: "PartTime" });
  assert.equal(student.match.score, 20);
  const fullTime = createJob(profile, { company: "Example", title: "Software Engineer", employmentType: "FullTime" });
  assert.ok(fullTime.match.blockers.some(blocker => blocker.includes("Vollzeitstelle")));
  const explicitHours = createJob(profile, { company: "Example", title: "Working Student Integrations", employmentType: "FullTime", hours: 40 });
  assert.ok(explicitHours.match.blockers.some(blocker => blocker.includes("Wochenstunden")));
});

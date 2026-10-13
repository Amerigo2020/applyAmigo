# Release verification, 0.1.0

Verified on 2026-10-13 in the isolated release worktree.

* 33 automated tests passed. Coverage includes ATS adapters, keyword matching, city aliases, contradictory employment data, JSON limits, user isolation through SQLite, concurrent D1 updates, approval invalidation, source configuration and model call reservations.
* TypeScript check and the production Sites build passed.
* The optional model adapter was tested with simulated Responses and error payloads. No paid model call or live provider credential was used.
* Browser checks at 1440 by 960 and 390 by 844 CSS pixels passed. All six views fit the mobile viewport without horizontal document overflow.
* The browser flow loaded fictional demo data, configured a real Ashby feed, scanned it, created a manual test job, generated and edited a template, saved and approved it, and observed approval invalidation after a profile change.
* A 25 minute block was saved and persisted across navigation and reload. A specific calendar day's add action preselected that same date.
* Workspace JSON export returned the saved profile, jobs, draft and sprint block. UI export was exercised.
* A second scan used the driveblocks Personio preset and visibly reported missing descriptions from its live feed.
* Source review found no application sending transport, real personal CV or provider credentials in tracked source. Third party license notices are retained.

Read-only live feed checks retrieved Ashby, Greenhouse, Lever and Personio data. Listing counts are transient and are not product fixtures. The demo vacancies are explicitly fictional.

The production gateway and persistent hosted database are supplied by Sites. Local loopback sign-in is a development identity only. A public GitHub release needs the repository owner chosen by the user. This document does not claim that a configured live language model is factually reliable; every output still needs human review.

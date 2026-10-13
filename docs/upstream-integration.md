# Upstream integration

Audit date: 2026-10-13.

The application uses real adapted functionality from both projects, without executing their command line agents. This document distinguishes imported logic from functionality that remains outside this release.

| Project | Audited commit | Reused functionality |
| --- | --- | --- |
| [OpenJobs](https://github.com/outscal/OpenJobs/tree/cdcc533521afb61f4e60657b3dbe06e484ccddcf) | `cdcc533521afb61f4e60657b3dbe06e484ccddcf` | ATS feed adapters and field mappings |
| [career-ops](https://github.com/career-ops-hq/career-ops/tree/8aafd1252c14d08b00f0c4e8c2f7f778db80bce9) | `8aafd1252c14d08b00f0c4e8c2f7f778db80bce9` | Pure keyword coverage and synonym matching |

Both repositories include MIT licenses. OpenJobs is a fork of career-ops and preserves Santiago Fernández de Valderrama's copyright together with Outscal's modification notice. The exact license files are in `licenses/`. Imported modules carry provenance comments. No company dataset or user profile from either project is shipped.

## Architecture and adaptation

OpenJobs provides an ATS adapter registry consumed by a Node harvester. Each adapter detects a board, fetches its public feed, and maps title, location, link, department, dates, and work type. Its CLI uses local data files and CSV outputs. applyAmigo ports the useful adapters to `lib/integrations/discovery.ts`, where only standard `fetch`, `URL`, `Response`, `TextDecoder`, and timers are used. There is no filesystem, subprocess, shell, browser automation, or installed agent at runtime.

career-ops is a larger local job evaluation and application preparation system with configurable profiles, matching, templates, browser tooling, and a tracker. The pure functions in its `keyword-match.mjs` can be reused independently of that architecture. `lib/integrations/keyword-match.ts` ports those functions directly. Coverage measures mentions in user-provided evidence. It is not a hiring probability, an ATS guarantee, or proof that the candidate possesses a missing skill. Missing keywords remain gaps and are never inserted as invented achievements.

The upstream instruction files were read as repository documentation for the audit. Their workflow instructions and personal examples do not become applyAmigo policy.

## APIs

```ts
detectBoard(url: string, company?: string): AtsBoard | null
discoverJobs(boards: readonly AtsBoard[], options?: DiscoveryOptions): Promise<DiscoveryResult>
analyzeCoverage(keywords: readonly string[], cvText: string): KeywordCoverage
extractJobKeywords(description: string): string[]
```

`AtsBoard` contains `provider`, `slug`, and `company`, with optional `region` and `personioTld`. `DiscoveryResult` contains normalized jobs, a result for every queried board, structured errors, and a retrieval timestamp. Each successful job has its original provider identity and URL. API consumers can map these integration types into the app's domain types without coupling the adapters to application storage.

Source errors are not converted to successful empty lists. An unreachable feed, timeout, disabled feed, unexpected payload, redirect, response limit, or rate limit is explicit. A successful genuinely empty feed remains an empty result with no error. There are no fabricated or fallback vacancies.

## Request boundaries

* Maximum eight boards per call, four concurrent requests, one request per board, no automatic retries.
* Maximum 25 seconds per board, including body reading. The application can select a shorter timeout.
* Maximum four MiB of response bytes per board, enforced on declared length and streaming body size.
* Maximum 500 returned jobs per board. API callers can lower this to 100. Truncation is reported as a board warning.
* HTTPS only. Board slugs are validated and API hosts are constructed internally. Credentials, ports, arbitrary hostnames, and embedded path traversal are rejected.
* Redirects are observed but never followed. Feed-provided description and application URLs are not fetched by the adapter.
* Only GET requests are made to public job feeds. No credentials or candidate documents are sent to ATS services.
* Listing descriptions are converted to text and must be rendered as text, not `dangerouslySetInnerHTML`.

| Provider | Request | Notes |
| --- | --- | --- |
| Ashby | `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` | All published board listings, optional unmodified salary summaries. |
| Greenhouse | `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | European public board URLs recognized. Initial publication and last update remain separate. |
| Lever | `https://api.lever.co/v0/postings/{slug}?mode=json` | EU tenants use `api.eu.lever.co`. Description includes requirements lists and additional text. |
| Personio | `https://{slug}.jobs.personio.{de|com}/xml` | Public XML only. A disabled XML feed is reported; no undocumented HTML fallback. |

## Known scope

Personio tenants may disable XML and will then need another source. Some ATS listings omit pay, hours, deadlines, or detailed descriptions. Those values remain unknown. Multi-office Greenhouse enrichment and pagination of additional sources are outside this port. The tool does not verify that a job's requirements match the user simply because it is live. The upstream mass harvesting CLI, complete company dataset, auto-application tools, Gmail access, CV generation scripts, and browser submission are not enabled.

## Verification

Run the focused tests with Node 22:

```sh
node --experimental-strip-types --test lib/integrations/discovery.test.mjs lib/integrations/keyword-match.test.mjs
```

Tests cover allowlisted host construction, encoded URL attacks, EU routing, field normalization, description extraction, Personio CDATA boundaries, source error isolation, redirects, body caps, deadlines, result truncation, keyword boundaries, synonyms, and missing evidence.

Read-only live smoke checks on 2026-10-13 successfully retrieved eight Ashby listings from Dataleap, 63 Greenhouse listings from Agile Robots, 34 Lever listings from Netlight, and three Personio listings from driveblocks. The returned Personio feed omitted the descriptions of two English postings; those omissions are now explicitly surfaced as warnings. A removed QuantCo Lever feed returned a structured `FEED_UNAVAILABLE` error with HTTP 404. Counts describe that verification run only and are not embedded as product data.

# applyAmigo

A focused workspace for finding opportunities and preparing applications. Reuses public ATS discovery from [OpenJobs](https://github.com/outscal/OpenJobs) and keyword matching from [career-ops](https://github.com/career-ops-hq/career-ops), with a new responsive interface and persistent user workspaces.

## What works

* Discover real vacancies from Ashby, Greenhouse, Lever and Personio boards. Source failures and missing information remain visible.
* Reuse a profile, CV text and evidence. See a transparent fit score and missing requirements for each opportunity.
* Track applications through saved, draft, ready, applied and interview stages.
* Prepare German or English drafts for robotics, startups and research. Edit, review and approve each draft yourself.
* Plan a 14 day sprint with one application per time block. Export your workspace as JSON and your drafts as text.

There is no application submission or email transport. Opening the original application portal does not submit anything. The applied status records an action you performed externally.

## Run locally

Requirements: Node.js 22.13 or later, npm and Git. Windows, macOS and Linux are supported.

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_kind_snowbird.sql
npm run dev -- --port 5186 --hostname 127.0.0.1
```

Apply each pending SQL migration only once. Local data lives in ignored `.wrangler/state`. The first build produces the Wrangler configuration required by the migration command. Subsequent starts need only the dev command unless schema or bindings changed.

Open `http://127.0.0.1:5186` and select Sign in with ChatGPT. Loopback development uses a fictional local identity. The explicitly activated demo also uses fictional people and vacancies. Neither is used in a hosted deployment.

Production authentication is provided by the Sites hosting gateway. Its trusted user headers partition every D1 read and write. If self hosting outside Sites, supply an authenticated gateway that strips client supplied identity headers. Do not expose the Worker directly while trusting arbitrary request headers.

## Optional model adapter

Templates work without an API key. To enable model drafted applications, configure all three server variables:

```text
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_NAME=<a model available in your provider account>
MODEL_API_KEY=<server secret>
```

Use the deployment's secret configuration. For development, use an ignored `.dev.vars` file. OpenAI uses the Responses API with `store: false`; other HTTPS providers can use the compatible Chat Completions interface. Provider capabilities differ. No model or paid account is provisioned by the app.

The user must explicitly mark AI as allowed for the opportunity and opt into model generation. This sends the profile, CV evidence and job description to the configured provider. A prohibited AI policy blocks both generation and prompt export. No key is sent to the browser. Provider errors do not expose response bodies. Generation is limited to one provider request per minute and 50 per UTC day per workspace, including failed attempts.

The adapter checks quoted evidence and numerical tokens, but cannot establish that every generated statement is true. Human review is required before approval. Edits to the draft or its underlying facts invalidate approval. An approval never sends an application.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

The tests cover the source adapters, keyword coverage, model request contract, user isolation and application state transitions. Model tests use a simulated provider. Live inference requires an operator supplied key and has not been included in the release verification.

## Deployment

The app uses React 19, Vinext and Cloudflare D1. `.openai/hosting.json` stores the Site identity and `DB` binding. Sites applies committed Drizzle migrations when deploying the matching built artifact. Source code contains no user CV, personal applications or credentials. Workspaces are stored separately in D1.

For a separate installation, register your own Site and replace the Site identity rather than publishing to the repository's existing project. Preserve the Sites build integration in `build/` and `vite.config.ts`.

## Current limits

* Configure up to eight company boards. Discovery does not search every job on the web and runs when requested.
* A scan retrieves up to 50 jobs per board; truncation is shown. Up to 250 jobs and 500 drafts fit in each workspace, subject to its storage limit.
* CV input is text, Markdown or pasted text. PDF parsing, email sync and automatic form filling are outside version 0.1.
* Missing pay, hours, dates and requirements remain unknown. The fit score is a heuristic, not a hiring probability.
* Some Personio XML feeds are disabled or incomplete. The app reports that instead of inventing listings.

## License and provenance

MIT. Upstream notices and exact source commits are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [licenses](licenses) and [the integration notes](docs/upstream-integration.md). The interface, application state and API are new code. The upstream command line agents and automatic submission features are not executed.

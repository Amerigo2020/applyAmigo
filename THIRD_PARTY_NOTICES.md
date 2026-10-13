# Third party notices

applyAmigo includes adapted source from the following MIT licensed projects. Their original license texts are distributed in `licenses/`. These notices credit the software copyright holders.

## OpenJobs

Repository: https://github.com/outscal/OpenJobs

Pinned commit: `cdcc533521afb61f4e60657b3dbe06e484ccddcf`

Copyright (c) 2026 Santiago Fernández de Valderrama (original career-ops work)

Copyright (c) 2026 Outscal (modifications and additions in this fork — Outscal-Jobs)

License: [MIT, original text](licenses/OpenJobs-LICENSE)

Adapted files: `adapters/ashby.mjs`, `adapters/greenhouse.mjs`, `adapters/lever.mjs`, `adapters/personio.mjs` into `lib/integrations/discovery.ts`. The adaptation includes provider field mappings, public feed endpoints, remote indicators, and the Personio scalar and position extraction approach. applyAmigo adds its own validation, response limits, plain text conversion, error isolation, regional Lever handling, and typed results. The upstream company dataset is not bundled.

## career-ops

Repository: https://github.com/career-ops-hq/career-ops

Pinned commit: `8aafd1252c14d08b00f0c4e8c2f7f778db80bce9`

Copyright (c) 2026 Santiago Fernández de Valderrama

License: [MIT, original text](licenses/career-ops-LICENSE)

Adapted file: pure matching functions from `keyword-match.mjs` into `lib/integrations/keyword-match.ts`. Included logic covers synonyms, normalized text, boundary matching, plural forms, and keyword coverage. CLI, filesystem, CV mutation, and process execution code are excluded. applyAmigo adds Unicode boundaries, input limits, and an explicit technical keyword dictionary.

The source repositories' instruction files describe their own products. They are not installed as instructions, executed, or allowed to change applyAmigo user policy.

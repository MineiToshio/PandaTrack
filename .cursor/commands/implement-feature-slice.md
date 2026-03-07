# Implement feature packet slice

Implement a single slice from a feature packet with minimal, reviewable changes.

## Inputs

- `feature_packet`: packet id or chat reference (example: `FEAT-0008`, "auth core packet")
- `slice`: slice number or chat reference (example: `2`, "Slice 2 - Auth entry pages")

## Steps

1. Resolve packet and slice
- Open `docs/product/feature-packets/README.md` first.
- Identify the primary packet using the routing index.
- Read only the selected packet and, if strictly necessary, up to 2 related packets.
- Locate the requested slice in `Implementation Slices`.

2. Build implementation contract
- Treat as binding for this execution:
  - Slice `Goal`, `Scope`, `Exit criteria`, and current `Status`
  - Relevant `FR`, `BR`, `AC`, and `Test Plan` from the packet
- If packet details conflict with user instructions from this chat, follow the user and update the packet in the same change.

3. Implement only the requested slice
- Keep changes minimal and scoped.
- Follow repository rules in `AGENTS.md` and `.cursor/rules/*.mdc`.
- Respect architecture and code organization conventions.
- Do not include unrelated refactors.

4. Keep docs synchronized
- If implementation changes behavior, update the same feature packet in the same change.
- If objective/core flow changed materially, create a new packet and add `Supersedes` / `Superseded by` links.
- If architecture changed, update/create ADR per `.cursor/rules/adr-decision-records.mdc`.
- Use canonical status terminology (must match script parsing):
  - Packet status: `Ready`, `In Progress`, `Done`, `Blocked`
  - Slice status: `Planned`, `In Progress`, `Done`, `Blocked`
- Update packet and slice metadata in the same change:
  - `Status`
  - `Last updated` date
- Required status transitions when implementing a slice:
  - Set packet `Status` to `In Progress` when working on any non-finalized slice.
  - Set selected slice `Status` to `In Progress` while execution is ongoing.
  - Set selected slice `Status` to `Done` only when its exit criteria are met.
  - Set selected slice `Status` to `Blocked` when progress cannot continue due to dependency or decision.
  - If all slices are `Done`, set packet `Status` to `Done`.
  - If at least one slice is `Done` and others are pending, packet stays `In Progress`.
- Keep `Progress notes` stable and product-level.
- Do not add volatile implementation details to the packet (exact file paths, env vars, internal wiring).

5. Validate
- Run:
  - `npm run type-check`
  - `npm run lint`
  - minimal affected build check (or `npm run build` if needed)

## Output format

Return:

1. `Implemented`: what was completed for this slice
2. `Files changed`: path + short reason
3. `Validation`: command results and failures if any
4. `Exit criteria`: each criterion as `met` / `not met`
5. `Slice status update`: updated `Status` + `Last updated` + short stable `Progress notes`
6. `Packet sync`: what was updated in docs (or `no packet changes`)
7. `Functional test steps`: manual step-by-step checks to validate behavior in the app
8. `Test cases`: concise test cases (`Given / When / Then`) covering happy path, edge cases, and failure paths for the implemented slice

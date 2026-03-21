# Cursor commands

Project-specific commands are in `.cursor/commands/`. Type `/` in Agent Chat to see them.

## release-tag-and-notes

Creates a new version tag (from the latest tag + major/minor/patch), pushes it to GitHub, and generates release notes for the GitHub Release.

**You can pass context after the command**, e.g.:

- `/release-tag-and-notes minor https://app.vercel.app/preview` – bump type and preview URL

**What it does:**

1. Fetches tags from GitHub and computes the next version.
2. Asks for missing info: preview URL (required), bump type (major/minor/patch), and whether it's a pre-release.
3. Switches to `main`, pulls to update it (stops and asks the user to resolve conflicts if any).
4. Creates an annotated tag (`-a`) on `main`'s HEAD and pushes it to `origin`.
5. Builds a changelog from commits between the **previous tag** and the **new tag** (tag-to-tag).
6. Returns markdown ready for copy/paste into the GitHub Release description, with a `[SCREENSHOTS]` placeholder.

See `.cursor/commands/release-tag-and-notes.md` for the full step-by-step instructions the agent follows.

## implement-feature-slice

Implements one slice issue from GitHub with minimal scoped changes and GitHub-sync enforcement.

**You can pass context after the command**, e.g.:

- `/implement-feature-slice 45`

**What it does:**

1. Resolves the target slice issue from GitHub by issue number.
2. Reads the slice ticket, parent epic, and the linked `PRD`, `FRD`, `Blueprint`, and `Work Order`.
3. Uses the docs as the implementation contract and GitHub as the execution-tracking layer.
4. Implements only that slice using the linked Work Order as the primary execution scope.
5. Updates tracking to `In Progress` instead of `Done`, so manual verification can happen afterward.
6. Runs validation checks and reports exit-criteria status.
   - Use `npm run validate-build` for build validation (not `npm run build`; that one runs migrate deploy and is for the Vercel pipeline).
7. Returns functional test steps and test cases so implementation can be manually verified.

See `.cursor/commands/implement-feature-slice.md` for the full command behavior.

## mark-ticket-done

Marks one GitHub slice ticket as done and cascades completion upward through the linked product docs and Epic when all siblings are complete.

**You can pass context after the command**, e.g.:

- `/mark-ticket-done 74`

**What it does:**

1. Resolves the target slice issue from GitHub by issue number.
2. Closes the slice and moves its GitHub Project status to `Done`.
3. Marks the linked `Work Order` doc as `DONE`.
4. If all sibling `Work Orders` are `DONE`, also marks the parent `Blueprint` as `DONE`.
5. If all sibling `Blueprints` are complete, also marks the parent `FRD` as `DONE`.
6. If all sibling `FRDs` are complete, also marks the parent `PRD` as `DONE`.
7. Syncs the parent Epic checklist and, if all slices are complete, also marks the Epic as `Done`.

See `.cursor/commands/mark-ticket-done.md` for the full command behavior.

## create-frd-package

Creates a new FRD package under an existing PRD and mirrors it into GitHub using the hybrid workflow.

**You can pass context after the command**, e.g.:

- `/create-frd-package prd-01-collector-mvp Add order tracking with partial payments and split shipments`
- `/create-frd-package docs/product/prd-00-pre-release-validation Add a public referral flow for the waitlist`

**What it does:**

1. Reads the target PRD and nearby product docs for context.
2. Reviews the codebase and current GitHub planning to avoid duplication.
3. Asks exhaustive clarification questions in Spanish before drafting.
4. Creates the new `FRD`, its `Blueprints`, and its `Work Orders` using `docs/templates/*`.
5. Creates or updates the matching GitHub Epic from the FRD.
6. Creates one GitHub ticket per Work Order, following the hybrid tracking rules.

See `.cursor/commands/create-frd-package.md` for the full command behavior.

## enrich-work-order-context

Deepens one existing Work Order through a structured discovery pass before updating the docs upward.

**You can pass context after the command**, e.g.:

- `/enrich-work-order-context 75`
- `/enrich-work-order-context WO-06 quiero aterrizar mejor validaciones, UX y seguridad`
- `/enrich-work-order-context docs/product/prd-01-collector-mvp/frd-04-store-domain/bp-01-store-public-trust-system/work-orders/wo-06-store-governance-flows.md`

**What it does:**

1. Resolves the target Work Order from a path, Work Order id, or linked GitHub slice issue.
2. Reads the parent `Blueprint`, `FRD`, and `PRD`, plus nearby context that may affect scope.
3. Acts as product, UX/UI, senior full-stack, security, and QA reviewer to find missing decisions.
4. Asks grouped questions in Spanish with concrete options and recommendations.
5. Waits for explicit approval before editing any docs.
6. Updates the `Work Order` and synchronizes approved changes upward into the `Blueprint`, `FRD`, and `PRD` only where appropriate.

See `.cursor/commands/enrich-work-order-context.md` for the full command behavior.

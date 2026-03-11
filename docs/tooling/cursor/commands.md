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
- `/implement-feature-slice https://github.com/MineiToshio/PandaTrack/issues/45`

**What it does:**

1. Resolves the target slice issue from GitHub by issue number or URL.
2. Reads the slice issue and its parent epic via GitHub MCP.
3. Implements only that slice using epic/slice scope and acceptance criteria as contract.
4. Updates epic/slice issue tracking in GitHub in the same change if behavior differs.
5. Uses GitHub Project `Status` as execution status source of truth.
6. Runs validation checks and reports exit-criteria status.
   - Use `npm run validate-build` for build validation (not `npm run build`; that one runs migrate deploy and is for the Vercel pipeline).
7. Returns functional test steps and test cases so implementation can be manually verified.

See `.cursor/commands/implement-feature-slice.md` for the full command behavior.

## create-feature-epic-and-slices

Creates a new feature epic in GitHub and decomposes it into small, functional slice sub-issues.

**You can pass context after the command**, e.g.:

- `/create-feature-epic-and-slices Add split shipment support for one purchase`
- `/create-feature-epic-and-slices Build store trust signals and seller notes for collectors`

**What it does:**

1. Reads the official epic template from `docs/templates/feature-epic-template.md`.
2. Reviews the feature brief and asks clarifying questions before planning when anything important is ambiguous.
3. Expands scope thoughtfully to include validations, state handling, analytics, Sentry, and integration concerns when relevant.
4. Creates one `type:epic` issue and multiple `type:slice` sub-issues in GitHub.
5. Keeps slices small, functional, and independently testable instead of splitting incomplete partial work.

See `.cursor/commands/create-feature-epic-and-slices.md` for the full command behavior.

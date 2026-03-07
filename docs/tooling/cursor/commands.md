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

Implements one `Implementation Slice` from a feature packet with minimal scoped changes and packet-sync enforcement.

**You can pass context after the command**, e.g.:

- `/implement-feature-slice FEAT-0008 slice 2`
- `/implement-feature-slice auth packet slice "verify lifecycle gate"`

**What it does:**

1. Resolves the packet using `docs/product/feature-packets/README.md` (routing index first).
2. Reads only the necessary packet(s) and selects the requested slice.
3. Implements only that slice using `Goal`, `Scope`, and `Exit criteria` as contract.
4. Updates the feature packet in the same change if implementation behavior differs.
5. Runs validation checks and reports exit-criteria status.

See `.cursor/commands/implement-feature-slice.md` for the full command behavior.

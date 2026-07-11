# Release tag and release notes

Create a new version tag from the latest tag, push it to GitHub, and generate release notes (changelog) ready for copy/paste into a GitHub Release.

This command does **not** publish the GitHub Release itself. It creates and pushes the tag and returns the release notes for the user to paste manually into the GitHub Release form.

## Inputs

Inline invocation text maps to these inputs. Mapping is **format-based, not order-based**, so the values may appear in any order:

1. `bump_type` (required): exactly one of the keywords `major`, `minor`, or `patch`. Recognized by matching one of those three keywords.
2. `preview_url` (required): live URL of this release (e.g. Vercel preview or production). Recognized by its URL format (`http://` or `https://`).
3. `pre_release` (optional): whether this version is a pre-release. Recognized by words such as `pre-release`, `prerelease`, `alpha`, or `beta` in the invocation text. Pre-releases are tagged with a semver suffix (`v<X.Y.Z>-beta.N`) and get "(Pre-release)" in the changelog title. The final release of that version later uses the bare `v<X.Y.Z>` tag.

If a required input is missing, ask for it once in Spanish at the start and wait for the answer. Do not assume values.

## Core behavior

- **Language:** all conversation with the user (questions, explanations, errors, confirmations) is in **Spanish**. All generated content (tag message, changelog, release notes) is in **English**. Do not translate generated content to Spanish.
- **Punctuation:** generated content must use plain ASCII punctuation. No em dashes and no curly quotes in the tag message or release notes.
- **Version source of truth:** the git tag is the only version marker in this repository. This command does not bump `package.json` or any other in-repo version field.
- **Where to tag:** the tag is always created on `main`'s HEAD, and only after every gate in the steps below passes.
- **Nothing irreversible without approval:** the tag is created and pushed only after the user explicitly approves the version, tag message, changelog, and exact commands in Step 6.
- **Stability:** if any git command in the steps fails in a way not covered by a specific rule, report the error in Spanish and stop. Do not guess another branch or version.

## Steps

### 1. Preconditions and release-content sanity gate

Record the current branch name so it can be restored at the end.

Require a clean working tree:

```bash
git status --porcelain
```

If the output is not empty, **stop** and tell the user in Spanish that the working tree has uncommitted changes they must commit or stash manually first. Never stash, discard, or force-checkout on the user's behalf.

Fetch the remote and verify the release content is actually on `main`:

```bash
git fetch origin
git rev-list --count main..<current-branch>
```

If the current branch is ahead of `main` (count greater than 0), the work the user wants to release is probably not merged yet. **Stop** and explain in Spanish that `main` does not contain the current branch's commits, so tagging `main` now would release the wrong content. Never tag `main` while the described work is unmerged.

### 2. Fetch tags and reconcile local vs remote

```bash
git fetch origin --tags
```

List candidate version tags:

```bash
git tag -l 'v[0-9]*' --sort=-v:refname
```

Then validate each candidate strictly: keep only tags that parse as `vX.Y.Z` (final release) or `vX.Y.Z-beta.N` (pre-release). Discard anything else (e.g. `wip-backup`, `v2-experiment`).

Compare against the remote:

```bash
git ls-remote --tags origin
```

Reconciliation rules:

- If a valid version tag exists **locally but not remotely**, a previous run most likely failed or was blocked during push. Tell the user in Spanish and, after their confirmation, **resume by pushing that existing tag** (continue at Step 5 using that tag and its range) instead of computing a new version. Never re-bump past an unpushed tag; versions must not be skipped.
- If no local tag passes validation, confirm with the user in Spanish that this is really the first release before treating it as one, especially when non-version tags exist. Do not silently assume first release.

Identify two reference points from the validated list:

- the **latest tag of any kind** (final or pre-release), used for version computation in Step 3
- the **latest final (non-suffixed) tag**, used as the default changelog base in Step 5

### 3. Compute the new version

**Suffix-stripping rule:** suffixed pre-release tags never consume the bare version number. Before any bump math, strip the pre-release suffix from the latest tag (e.g. `v0.2.0-beta.2` is treated as version `0.2.0`).

Then compute the new tag:

- **Final release while a pre-release of a pending version exists** (latest tag is `v<X.Y.Z>-beta.N` and the bare `v<X.Y.Z>` does not exist yet): the default is to finalize that pending version as bare `v<X.Y.Z>` with no new bump. Confirm this with the user in Spanish. If the user instead wants a new version, apply `bump_type` to the stripped version `X.Y.Z`.
- **New bump (final release)**: apply `bump_type` to the stripped latest version:
  - **patch**: increment the third number (e.g. 0.1.0 to 0.1.1).
  - **minor**: increment the second number, reset the third to 0 (e.g. 0.1.0 to 0.2.0).
  - **major**: increment the first number, set the second and third to 0 (e.g. 0.1.0 to 1.0.0).
- **Pre-release** (`pre_release` confirmed):
  - if the latest tag is not a pre-release, apply `bump_type` to the stripped latest version and append `-beta.1` (e.g. from `v0.1.0` with `minor`, the tag is `v0.2.0-beta.1`).
  - if the latest tag is already a pre-release (`v<X.Y.Z>-beta.N`), the **default is to increment the suffix on the same version**, ignoring `bump_type`: the new tag is `v<X.Y.Z>-beta.N+1`. Only apply `bump_type` to the stripped version `X.Y.Z` (yielding `v<new-X.Y.Z>-beta.1`) when the user explicitly confirms they want to target a higher version instead of continuing the current pre-release. Confirm this in Spanish before proceeding, mirroring the finalize confirmation above.

If there are no tags (confirmed first release), use `0.1.0`, or `1.0.0` if the user chose `major`, with `-beta.1` appended when `pre_release` was confirmed.

The tag name is `v` + version, plus the pre-release suffix when applicable (e.g. `v0.1.1`, `v0.2.0-beta.1`).

**Existing-tag safety stop:** if the computed tag already exists locally or remotely (per Step 2), something is inconsistent with the reconciliation above. **Stop** and report in Spanish which tag collides. Do not auto-bump past it silently; let the user decide how to proceed.

### 4. Switch to main and update it

```bash
git checkout main
git pull --ff-only origin main
```

After the pull, local `main` must be identical to `origin/main`. If `--ff-only` fails (diverged local `main`), or the pull fails for any reason, or `main` does not exist, **stop**, report the problem in Spanish, and ask the user to resolve it before continuing. Do not merge and do not tag.

### 5. Generate the changelog and tag message (before tagging)

**Reference range:** from the changelog base tag to `main`'s current HEAD, which is where the new tag will point.

Choosing the base tag:

- **Final release:** the base is the latest **final (non-suffixed) tag**, so the notes cover everything since the last stable release, including work already described in that version's pre-releases.
- **Pre-release:** the base is the latest tag **of any kind for that version** (e.g. cutting `v0.2.0-beta.3` starts from `v0.2.0-beta.2`). If this is the first pre-release of the version, the base is the latest final tag.

```bash
git log <base_tag>..main --pretty=format:"%s" --no-merges
```

**First release** (no previous tag): the changelog covers all commits on `main`:

```bash
git log main --pretty=format:"%s" --no-merges
```

If the list is empty or not useful (e.g. unclear messages), either summarize `git log --oneline` output over the same range in user-friendly language, or ask the user in Spanish for a short list of changes and turn it into the changelog bullets.

**Changelog content:** write for **end users**, not developers, in **English** with plain ASCII punctuation. Prefer plain language and product/feature terms. Avoid jargon, internal IDs, or technical details unless necessary. Group items in a clear order (new features first, then changes, then fixes).

**Changelog structure** (slight variations are fine, keep the same style and sections):

- **Title:** `## ` + the full tag name (e.g. `## v0.2.0` or `## v0.2.0-beta.1`); if `pre_release` was confirmed, also add ` (Pre-release)` on the same line.
- **Short intro:** one sentence describing the release (e.g. "First pre-release with public landing and waitlist").
- **Sections:** use `### Added`, `### Changed`, `### Fixed` as needed. Only include sections that have items. Each item is a single user-friendly line.
- **Preview:** one line: `Preview: <preview_url>`.
- **Screenshots:** do not ask the user for screenshots. Add a single placeholder line so they remember to add one later:

  `[SCREENSHOTS]`

  (They can replace it with an image in Markdown when editing the release on GitHub.)

Example:

```markdown
## v0.1.0-beta.1 (Pre-release)

First pre-release with public landing and waitlist.

### Added
- Landing page with product presentation and CTAs
- Waitlist sign-up (email collection)
- Basic i18n (ES/EN), theme (light/dark), and responsive layout
- Analytics and error monitoring wiring

Preview: https://example.vercel.app

[SCREENSHOTS]
```

**Tag message:** draft a short, clear one-line description of the release in English (what the release is about, not a full changelog). Example: `Waitlist improvements and landing copy updates`.

### 6. Confirmation gate (mandatory)

Before creating or pushing anything, show the user in Spanish:

- the new version and tag name
- the target branch (`main`) and the exact commit SHA the tag will point to
- the proposed annotated tag message
- the full changelog
- the exact commands that will run:

```bash
git tag -a <tag-name> -m "<tag message>"
git push origin <tag-name>
```

where `<tag-name>` is the computed tag, including the pre-release suffix when applicable (e.g. `v0.1.1` or `v0.2.0-beta.1`).

Wait for explicit approval in Spanish (for example "si, procede", "aprobado", "dale"). The tag message is part of what gets approved. If the user requests changes, update the changelog or tag message and ask again. Do not tag or push without this approval.

### 7. Create the annotated tag and push it

Only after approval:

```bash
git tag -a <tag-name> -m "<approved tag message>"
git push origin <tag-name>
```

If the push fails or a hook denies it, do not retry destructively and do not delete or re-create tags. Report it under `Blocked requirements` in the final response, including the resume path: re-running the command will detect the unpushed local tag in Step 2 and offer to push it.

### 8. Return to the original branch

```bash
git checkout <original-branch>
```

Restore the branch recorded in Step 1 so the user is not left on `main`.

## Output format

Return in Spanish:

1. `Release summary`: version, tag name, target commit SHA, and whether the tag was pushed.
2. `Changelog`: the full release notes in a single markdown block (in English), ready for copy/paste into the GitHub Release description. Remind the user to replace `[SCREENSHOTS]` and to mark the release as pre-release on GitHub when applicable. State that this command did not publish the GitHub Release itself.
3. `Blocked requirements`: any push denied by a hook, failed push, or other external update that could not be completed, with its resume path. Write `ninguno` when there are none.

If the command stops early at any gate (missing input, dirty tree, unmerged branch, no valid version tags, computed tag collision, diverged `main`), state in Spanish exactly which gate failed, what the user must do to proceed, and confirm that nothing was tagged or pushed.

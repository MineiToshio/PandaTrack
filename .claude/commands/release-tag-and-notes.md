# Release tag and release notes

Create a new version tag from the latest tag, push it to GitHub, and generate release notes (changelog) ready for copy/paste into a GitHub Release.

## Before you start

Gather or decide the following. **Ask the user for any missing value before proceeding; do not assume.**

1. **Preview URL**  
   Live URL of this release (e.g. Vercel preview or production). **Required.** If the user did not provide it, ask: *"¿Cuál es la URL del preview/producción para esta release?"* and wait for the answer.

2. **Version bump type**  
   One of: **major** (e.g. 0.1.0 → 1.0.0), **minor** (e.g. 0.1.0 → 0.2.0), **patch** (e.g. 0.1.0 → 0.1.1). If the user did not specify, ask: *"¿Qué tipo de versión es esta: major, minor o patch?"* and wait.

3. **Pre-release?**  
   Whether this version is a pre-release (e.g. alpha/beta). If unclear, ask. Use this only to decide whether to add "(Pre-release)" in the changelog title, not for the tag name.

**Language:** All **generated content** (tag message, changelog, release notes) must be in **English**. All **conversation** with the user (questions, explanations, error messages, reminders) must be in **Spanish**.

**Where to tag:** The tag is **always** created from `main`. Switch to `main`, pull to update it, then create the tag on `main`'s HEAD. If you are on another branch, checkout `main` first. If `git pull` on `main` reports conflicts, stop and ask the user to resolve them before continuing. The changelog is computed between the **previous tag** and the **new tag**.

---

## Steps

### 1. Fetch all tags from GitHub

From the project root, run:

```bash
git fetch origin --tags
```

Then list tags to get the latest version:

```bash
git tag -l --sort=-v:refname
```

Parse the latest tag (e.g. `v0.1.0` → `0.1.0`). If there are no tags, treat the next version as `0.1.0` (or `1.0.0` if the user chose major).

### 2. Compute the new version

From the latest tag and the chosen bump type:

- **Patch**: increment third number (e.g. 0.1.0 → 0.1.1).
- **Minor**: increment second, reset third to 0 (e.g. 0.1.0 → 0.2.0).
- **Major**: increment first, set second and third to 0 (e.g. 0.1.0 → 1.0.0).

Tag name must be `v` + version (e.g. `v0.1.1`).

### 3. Switch to main and update it

Checkout `main` and pull so the branch is up to date. The tag will be created on `main`'s HEAD.

```bash
git checkout main
git pull origin main
```

If `git pull` reports merge conflicts or fails due to conflicts, **stop**. Tell the user that there are conflicts on `main` and they must resolve them (e.g. resolve locally and push, or fix on the remote) before continuing. Do not attempt to create or push the tag until conflicts are resolved.

### 4. Create an annotated tag

Create the tag with `-a` and a short, clear message **in English** (e.g. what this release is about, not a full changelog):

```bash
git tag -a v<X.Y.Z> -m "<Short one-line description of the release>"
```

Example: `git tag -a v0.1.1 -m "Waitlist improvements and landing copy updates"`

### 5. Push the tag to GitHub

```bash
git push origin v<X.Y.Z>
```

If the user has a hook that blocks destructive or push commands, they will need to approve this.

### 6. Generate the changelog

**Reference range:** from the **previous tag** (by version/date) to the **new tag** you just created. The changelog describes what is in this release compared to the previous one.

Get the list of commits:

```bash
git log <previous_tag>..v<X.Y.Z> --pretty=format:"%s" --no-merges
```

If there is no previous tag (first release), use `main` as base:

```bash
git log main..v<X.Y.Z> --pretty=format:"%s" --no-merges
```

**If the list is empty or not useful** (e.g. only "Merge..." or unclear messages), either:
- Use `git log <previous_tag>..v<X.Y.Z> --oneline` and summarize the changes in user-friendly language, or
- Ask the user for a short list of changes and turn that into the changelog bullets.

**Changelog content:** Write for **end users**, not developers. Use **English** only. Prefer plain language and product/feature terms. Avoid jargon, internal IDs, or technical details unless necessary. Group items in a clear order (e.g. new features first, then changes, then fixes).

### 7. Format the release notes (changelog)

Use this structure **in English**. Slight variations are fine, but keep the same style and sections.

- **Title:** `## vX.Y.Z` and, if it’s a pre-release, add ` (Pre-release)` on the same line.
- **Short intro:** One sentence describing the release (e.g. “First pre-release with public landing and waitlist”).
- **Sections:** Use `### Added`, `### Changed`, `### Fixed` as needed. Only include sections that have items. Each item is a single line, user-friendly.
- **Preview:** One line: `Preview: <URL>` (the preview URL the user provided).
- **Screenshots:** Do **not** ask the user for screenshots. Add a single placeholder line so they remember to add one later:

  `[SCREENSHOTS]`

  (They can replace it with an image in Markdown when editing the release on GitHub.)

Example:

```markdown
## v0.1.0 (Pre-release)

First pre-release with public landing and waitlist.

### Added
- Landing page with product presentation and CTAs
- Waitlist sign-up (email collection)
- Basic i18n (ES/EN), theme (light/dark), and responsive layout
- Analytics and error monitoring wiring

Preview: https://example.vercel.app

[SCREENSHOTS]
```

### 8. Return the changelog to the user

- Output the full changelog in a single markdown block (in **English**).
- In **Spanish**, say clearly that it is ready for copy/paste into the GitHub Release description and remind them to replace `[SCREENSHOTS]` and to mark as pre-release if applicable.

---

## Extra rules

- **No assumptions:** If preview URL or bump type were not given, ask once at the beginning (in Spanish) and wait for the user's reply before continuing.
- **Single run:** Run the steps in order; only push the tag after creating it locally.
- **Language:** **Chat in Spanish** (questions, explanations, errors, reminders). **Generated content in English** (tag message, changelog, release notes). Do not translate the changelog or tag message to Spanish.
- **Stability:** If `git fetch`/`git pull` fails, or `main` does not exist, or pull on `main` results in conflicts, report the error in Spanish and stop; ask the user to resolve conflicts before continuing. Do not guess another branch or version.
- **Pre-release label:** Use "(Pre-release)" in the changelog title only when the user confirmed this version is a pre-release.

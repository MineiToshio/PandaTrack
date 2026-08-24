---
title: "ADR 0039 - Comparison between collectors ships as a disabled placeholder that collects nothing, and its enabling preconditions are legal before they are technical"
date: 2026-08-23
status: accepted
session: collector-progression Progreso section implementation (FRD-12, WO-04, 2026-08-23)
owner: Sergio Minei
trigger: FR-12-39 requires the Progreso section to show a visible placeholder for comparison between collectors, and every obvious way to build one (a soft opt-in, a waiting list, a "notify me" toggle) would start collecting a consent this product cannot yet gather properly under Ley 29733
updates: docs/product/prd-02-collector-app/frd-12-collector-progression/frd-12-collector-progression.md
extends: ADR 0035 (collector progression point ledger)
---

# ADR 0039 - Comparison between collectors ships as a disabled placeholder that collects nothing, and its enabling preconditions are legal before they are technical

## Context

Rank and medals are private by construction. `FR-12-18` and `BR-12-02` scope every progression query to the session `userId`, and the `Progreso` section carries no user parameter anywhere in its route contract, so one collector's progression is not addressable by another. That is the shipped product.

`FR-12-39` nonetheless requires the section to show a **visible placeholder** naming comparison between collectors. The requirement is deliberate: the feature is a plausible next step, collectors will ask for it, and a surface that simply omits it says nothing about whether it is coming, whether it exists for other people, or whether the collector is missing something.

The pressure this creates is the reason for the record. Every ordinary way to build a "coming soon" surface collects something: a `notify me` toggle, a waiting-list email, an opt-in preference stored for later, even a click event recorded as interest. Each of those is a consent, and this product cannot gather a consent for a social feature properly yet. There is no age gate, no informed-consent flow under **Ley 29733**, no real account deletion path, and no formally constituted operator to be the data controller of a surface where one person's data is shown to another (see `project_legal_company_posture`, and the Out of Scope section of `FRD-12`). Collecting the consent first and building the legal ground under it later is the wrong order, and it is the kind of wrong order that is hard to undo, because the collected records already exist.

A second, quieter problem is arithmetic. The FRD sets **50 users with an active opt-in** as the population floor. Below that, a comparison surface reports mostly that nobody is there, and the backfilled owner sits permanently and unreachably on top of any table from day one. That is not a ranking; it is a mirror with one face in it.

## Decision

### 1. The placeholder ships **disabled** and collects nothing at all

The `Resumen` tab renders a sunken, dashed card titled `"Comparación entre coleccionistas"` with the copy `"Próximamente: compara con otros coleccionistas."` It is inert in the strongest sense the word allows:

- it is **not a link** and has no `href`, so there is nowhere for it to lead;
- it is **not a control**: no button, no toggle, no input, nothing focusable;
- it stores **no preference**, including a negative one; there is no "not interested" to record either;
- it fires **no analytics event of its own**. Interest is not measured here, because measuring interest in a feature gated on consent is itself a form of pre-collection.

The same `.soon` sunken treatment is reused by the medal detail's own switched-off figure (`FR-12-27`), so the app has **one** visual pattern for "this exists but is off" rather than two that a collector would have to learn separately.

### 2. The preconditions for enabling it are legal before they are technical

A future FRD may build comparison between collectors only once **all** of the following hold:

1. at least **50 users with an active opt-in** (the population floor above);
2. an **age gate**;
3. **informed consent under Ley 29733**;
4. **real account deletion**, not deactivation;
5. a **formally constituted operator** to act as data controller.

None of these is a build task, and four of the five cannot be satisfied by writing code. This ordering is the decision: the engineering work is gated on the legal ground existing, not the other way around.

### 3. Privacy stays a property of the data layer, not of the placeholder

Nothing about this decision relies on the placeholder being inert to keep progression private. `BR-12-02`'s scoping is what does that: every query takes the session `userId` and no route carries a user parameter. If this ADR were reversed tomorrow, the placeholder alone changing would not expose anything, because there is no addressable surface behind it to expose.

## Alternatives considered

1. **A "notify me when this arrives" opt-in on the placeholder.**

- Pros: measures real demand, gives the future feature a launch audience, and costs almost nothing to build.
- Cons: it is a consent, gathered before the age gate, the Ley 29733 flow, the deletion path and the operator exist. The records would sit in the database as evidence of a consent nobody could properly demonstrate was informed.
- Why not chosen: `BR-12-21` forbids collecting any preference here, explicitly including an opt-in, and the reason is exactly this ordering problem.

2. **Omit the placeholder entirely until the feature is real.**

- Pros: the cleanest possible surface, nothing to explain, no dead card.
- Cons: silence answers none of the collector's questions, and it makes the private-by-default posture look like an oversight rather than a choice. It also loses the chance to say, in the product's own voice, that comparison is not happening yet.
- Why not chosen: `FR-12-39` requires a **visible** placeholder, and a stated absence is more honest than an unexplained one.

3. **A greyed-out mock of the future comparison surface (a fake leaderboard).**

- Pros: communicates the shape of what is coming better than a sentence can.
- Cons: a table with plausible-looking rows is indistinguishable from real data that happens to be dimmed, which is the exact failure the medal detail's own `.soon` block was amended to avoid: nothing on screen may read as a value.
- Why not chosen: it invents data about people who did not consent to appear, even as an illustration.

## Consequences

### Positive

- The collector is told, in plain words, that comparison is not happening yet, without the product asking for anything in exchange for saying so.
- No consent record exists that would later have to be honoured, migrated or explained under a legal regime it was not gathered under.
- The five preconditions are written down where the next person to pick this up will find them, so "can we just ship a leaderboard" has a documented answer rather than a fresh argument.
- One `.soon` pattern serves both switched-off surfaces in `FRD-12`, so a third one later has a precedent to follow.

### Negative

- Real demand for the feature goes unmeasured; the decision to build it will have to be made on judgement rather than on a signup count.
- A dead card occupies space on the `Resumen` tab for as long as the preconditions are unmet, which may be a long time.
- Collectors who want the feature have no way to say so from inside the app, and will say so through support channels instead.

### Neutral

- The placeholder's copy and treatment are fixed by `FRD-12` and `FDD-12 § 2.3`; changing either is a documentation change first, not a UI tweak.

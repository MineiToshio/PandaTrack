# Rank art generation guide v6 (FRD-12)

Guide for generating the 10 collector-progression rank emblems. Companion to `medal-art-guide.md`,
and deliberately written to sit beside it while staying impossible to confuse with it. Verified
against the real ladder (`src/lib/data/progression/rankLadder.ts`), the real names and lore
(`src/i18n/locales/es/progress.json`), the real rendering code (`src/components/core/RankEmblem.tsx`,
`docs/design/components.md`), and the 24 shipped medals in `public/medals/`. No em dash appears
anywhere in this file, including inside the prompts.

**This is v5, and it inverts the rule that produced v4.** Until this round the motif was derived from
the rank NAME. That is how the plates ended up holding a shrine gateway, a reservation tag, a book, a
compass rose and a magnifying glass, and it is why the owner rejected the bottom half of the ladder
outright: _"esa puerta para mí no significa nada, nunca me imaginé eso"_, _"el segundo parece un papel
roto"_, _"el 4 y el 5 me parecen fatales"_, _"del 1 al 5 no me gustan para nada, cámbialas"_. The
diagnosis is not craft, it is subject matter. An everyday object painted with care is still an
everyday object, and nobody climbs a ladder to reach one.

So from v5 the order is reversed, and the reversal is part of the process, not a one time fix:

> **The image leads. The name follows.** Each rung is designed first as a fantasy artefact, and only
> then is a rank name written to fit what the emblem shows.

The owner asked for this in those words: _"prefiero que cambies el nombre del rango a que le pongas
una imagen que es meh"_, _"toma elementos de fantasía épica, que sea épico, que llame la atención, que
la gente diga: quiero llegar a este rango porque este rango es para la gente que es súper épica"_, and
_"que forme aura"_.

**What v5 keeps, because the owner approved it in v3 and v4:** the ten silhouettes and their order
(disc, framed disc, octagonal plate, shield, ornamented shield, laurel shield, small wings, medium
wings, crown with large wings, creature), the semi-realistic painted game asset style with real
materials and no drawn outline (section 1b), the wing built as ONE solid slab with notches cut into
its trailing edge (section 1d), and rank 10 as a living creature rather than a bigger badge (section
1f).

**What v5 changes:**

1. **Every motif becomes a fantasy artefact, and all ten belong to one mythology** (section 4b). The
   ladder is now the life of a single crystal: found asleep in the rock at rank 1, cut and blazing at
   rank 7, alive and winged at rank 10.
2. **Seven of the ten names are rewritten** to fit the new artefacts (section 1a). Kōhai and Senpai
   del gremio survive because the club flavour is worth keeping at the bottom of the ladder.
3. **The colour ladder is rebuilt from scratch** (section 1e). Ten distinct colour masses at 32 px,
   and the red plus silver of ranks 4 and 5 that the owner rejected is gone from the whole set.
4. **Light becomes a ladder of its own** (section 1h): nothing on ranks 1 to 3, one spark on 4 to 6, a
   clear glow on 7 to 9, a full aura only on rank 10, and never a glow that leaks past the silhouette.
5. **Ranks 4 and 5 are rebuilt as true heater shields**, with the heart shaped outline the owner
   rejected banned by name inside the prompt.

Deliverables of this round: the ten emblems in `art-drafts/v5/final/`, the review sheet
`art-drafts/v5/ranks-v5-board.png`, the silhouette test `art-drafts/v5/qc-strip.png`, the canonical
prompt of each rank in `art-drafts/v5/prompts/`, and the exact text that produced each shipped image
in `art-drafts/v5/prompts-as-generated/`. Every attempt is kept under
`art-drafts/v5/raw/<slug>-take<N>/` with its `codex.log`.

**One caveat, stated up front.** The image generation quota ran out partway through the round, after
the ten emblems had rendered and before a planned refinement pass on ranks 1, 3, 4, 5 and 10. Those
five refinements are already written into `build_prompts.py` and into `art-drafts/v5/prompts/`; they
have never been rendered. Section 7d lists exactly what each one fixes. The ten images that ship with
this version all come from take 1, whose text is preserved verbatim in `prompts-as-generated/`.

## 0. Why ranks do not look like medals

A medal and a rank answer different questions. A medal says "you did this specific thing once"; a
rank says "this is what you are now".

The 24 shipped medals are all the same visual idea: a solid geometric plate packed with a full-bleed
comic sunburst in four or five saturated colours, carrying an illustrated object in the middle, inside
a thin bevelled rim, drawn flat with a heavy black keyline. At thumbnail size a medal reads as a small
confetti disc: high chroma, high frequency, no dominant shape.

Since v3 the separation is no longer only compositional, it is **material**. A medal is printed. A
rank is **cast, forged and set with stone**, rendered as a physical object with light on it. Put one
of each side by side and the difference is instant, which is what QC step 8 measures.

| Axis      | Medals (24)                              | Ranks (10)                                            |
| --------- | ---------------------------------------- | ----------------------------------------------------- |
| Rendering | Flat cel colour, heavy black keyline     | Semi-realistic painted material, no keyline           |
| Colour    | Four or five saturated hues, full bleed  | One deep enamel field plus one metal                  |
| Shape     | Fixed plate, never changes across the 24 | Changes at every single rung, that is the whole point |
| Reads as  | A sticker                                | An object                                             |

## 1. Art direction

### 1a. The names come from the images now

This is the rule change of the round, so it is worth stating flatly: a rank name in v5 is a **caption
for its artefact**, not a brief for it. The artefacts were designed first, as a set, without looking
at the old names; then each one was named for what it holds.

Two names survive the rewrite, and both survive on purpose. **Kōhai** (rank 1) and **Senpai del
gremio** (rank 4) are the club vocabulary this niche reads fluently, they carry the social ladder that
gives the whole set its flavour, and they still describe the artefacts under them: the newcomer who
just dug up their first shard, and the one whose light the newer ones follow. Everything else moved.

| #   | `rankKey`                | Artefact                     | Nombre (es)                   | Name (en)             |
| --- | ------------------------ | ---------------------------- | ----------------------------- | --------------------- |
| 1   | `kohai`                  | The shard asleep in the rock | Kōhai                         | Kohai                 |
| 2   | `preorder-hunter`        | The salvaged blade           | **Buscador de reliquias**     | Relic Seeker          |
| 3   | `volume-keeper`          | The chained grimoire         | **Escriba del grimorio**      | Grimoire Scribe       |
| 4   | `guild-senpai`           | The summoning orb            | Senpai del gremio             | Guild Senpai          |
| 5   | `first-print-hunter`     | The reforged blade           | **Portador del filo**         | Bladebearer           |
| 6   | `limited-run-curator`    | The ether hourglass          | **Guardián de las horas**     | Warden of Hours       |
| 7   | `club-sensei`            | The awakened crystal         | **Invocador del cristal**     | Crystal Summoner      |
| 8   | `rare-edition-archivist` | The guardian's helm          | **Centinela de esmeralda**    | Emerald Sentinel      |
| 9   | `collection-shisho`      | The keys of the sanctum      | **Gran maestro de la bóveda** | Vault Grandmaster     |
| 10  | `guild-legend`           | The ether bird               | **Leyenda viva, Rango S**     | Living Legend, Rank S |

**Role noun uniqueness, checked.** Kōhai, Buscador, Escriba, Senpai, Portador, Guardián, Invocador,
Centinela, Gran maestro, Leyenda. Ten different role nouns with no repetition at all, which v4 never
achieved (it carried `Cazador` twice). In English: Kohai, Seeker, Scribe, Senpai, Bladebearer, Warden,
Summoner, Sentinel, Grandmaster, Legend.

**Sensei was dropped, deliberately.** The owner listed Sensei among the names he liked, and it is gone
anyway, because rank 7 stopped being about teaching the moment its artefact became a blazing summoning
crystal. `Invocador del cristal` is the caption that emblem earns. If the owner wants the word back,
the cheapest fix is to rename rank 7 and leave the art alone, since the art no longer depends on the
name. That is the point of the new rule.

**The lore lines were rewritten with the names**, because a lore line whose rank name changed is a
line about a different thing. They are in `src/i18n/locales/{es,en}/progress.json` and quoted in
section 4a. Three of them carry the crystal thread on purpose: rank 1 finds it (_"Tu primera pieza,
todavía dormida en la roca."_), rank 7 wakes it (_"La esquirla que hallaste al principio ya arde en
tus manos."_), rank 10 sets it free (_"El cristal ya no necesita vitrina: tiene alas."_).

**The `rankKey` identifiers do not change.** Rank 2 stays `preorder-hunter`, rank 3 stays
`volume-keeper`, rank 7 stays `club-sensei`, rank 8 stays `rare-edition-archivist`, rank 9 stays
`collection-shisho`. They are identifiers, not copy: no user sees them, nothing in the database stores
them (the cache stores `rankIndex`), and renaming them would churn code, tests and art paths for zero
product value. After v5 the mismatch between key and name is wide on purpose, and it is documented
here so nobody later "fixes" it.

### 1b. The style, unchanged from v3

Semi-realistic painted game asset, in the visual language of Japanese role-playing game equipment
icons and rank insignia: Final Fantasy, Granblue Fantasy, Octopath Traveler. Concretely, and every one
of these is in the prompt spine:

1. **Materials have surface character.** Casting grain in the bronze, verdigris in the recesses, a
   brushed grain on the steel, small nicks on the leaf edges, glassy depth in the enamel, internal
   facets in the gems. Not a colour swatch: a surface.
2. **Volume is real.** Bevelled edges, chamfers, undercuts, ambient occlusion darkening every recess.
3. **One dramatic light.** Warm key from the upper left, cool rim light grazing the lower right, crisp
   specular glints on the raised edges, soft self shadowing where one part overlaps another.
4. **No outline.** Separation between materials comes from value, from the bevel and from a thin dark
   seam where two parts meet. The words "bold thick dark outline" are **banned** from every prompt.
5. **Noble palette.** Rich and deep, slightly muted, never neon.
6. **Named negatives.** Every prompt explicitly forbids: flat vector art, sticker art, a thick black
   cartoon keyline, cel shading, comic book flat colour, glossy plastic toy shine, a western cartoon
   look, an esports mascot logo, clip art, a chibi mascot.

Point 6 is not padding. The generator has a strong prior toward badge-logo art, and it takes the
explicit negative list to keep it off. Removing point 6 is how v2 happens again.

### 1c. Ten shapes, unchanged from v3

The owner's verdict on the silhouette ladder was one sentence: _"Las formas me gustan cómo están."_ So
it is copied over rung for rung. Each step adds exactly one new structural idea and never takes one
away, so the ten in a row read as one object being rebuilt richer and richer:

| #   | Silhouette            | The one thing this rung adds                                    |
| --- | --------------------- | --------------------------------------------------------------- |
| 1   | Plain disc            | Baseline. The humblest object on the ladder.                    |
| 2   | Disc inside a frame   | A second outer band, and the first rivets.                      |
| 3   | Octagonal plate       | The circle breaks. The outline becomes faceted.                 |
| 4   | Shield                | The plate becomes a shield, and grows a foot.                   |
| 5   | Shield with a crest   | A pointed crest rises above the shield, carrying the first gem. |
| 6   | Shield with laurel    | Two laurel branches flank the shield.                           |
| 7   | Small wings           | **Wings appear.** Nothing before this rung has a wing on it.    |
| 8   | Medium wings, big gem | The wings grow, and one large showpiece cabochon lands.         |
| 9   | Crown and large wings | The crest becomes a crown, the wings reach their full span.     |
| 10  | Legendary             | The badge stops being a badge. See 1f.                          |

Three of those are loud on purpose: **the shield at 4**, **the wings at 7**, and **the break at 10**.
The rest are quiet steps that make the loud ones land.

### 1d. The wing, rebuilt

The owner: _"Las de rango 8, 9 y 10: no me gusta cómo está la forma de las alas, no me convence."_

He is right, and the reason is structural rather than stylistic. v3 asked for each wing to be "a
horizontal fan of no more than four long straight tapering feather blades in one stepped row, with a
visible gap between blade and blade". That specification has two failure modes and v3 hit both: the
generator kept softening the row of blades back into bird plumage, which is precisely the thing the
owner had already rejected once (_"tipo ALAS DE MILITARES"_), and at 32 px the gaps between the
blades close and the whole wing turns into a grey smear on each side.

**v4 inverts the construction.** The wing is no longer several positive shapes with gaps between them;
it is **one solid slab of metal with notches cut out of its trailing edge**. The blade count is
expressed as an absence, not as a presence.

Stated as it appears in the prompts:

- **One single closed silhouette per wing.** Trace it and you draw one continuous line. No slot, no
  gap, no daylight anywhere inside the wing.
- **Low and wide.** The long axis is horizontal, the wing is at least three times wider from root to
  tip than it is tall, and the tip points outward and slightly **downward**, about ten degrees below
  the horizontal. It is never raised into a V and never sweeps above the top of the emblem.
- **Blades are notches.** Exactly N clean triangular bites taken out of the lower trailing edge, so
  the wing reads as N plus 1 broad fused blades that are visibly one piece.
- **Bolted, not glued.** The wing meets the shield through a rectangular root plate carrying exactly
  two rivets, so it reads as built into the frame.
- **Named negatives**: never a thin spike, never a dart, never a spear head, never a sword blade,
  never a row of separate blades with daylight between them, no plumage, no soft feathers, no curved
  bird wing, no down, no free floating feather.

Why this survives the thumbnail: at 32 px the only wing information that can possibly reach the eye is
the **outer contour**. A notch cut into a solid contour is still visible as a scallop; a gap between
two thin positives is not, because both positives and the gap fall below one pixel. Making the wing
low and wide also feeds rule 19: the emblem gains mass sideways instead of stacking a V on top.

The escalation across the three winged ranks is the notch count and the root:

| Rank | Wing size                          | Notches | Blades read | Root                               |
| ---- | ---------------------------------- | ------- | ----------- | ---------------------------------- |
| 7    | Short, just past the shield's side | 1       | 2           | Rivet plate with one emerald       |
| 8    | Out to the full square footprint   | 2       | 3           | Rivet plate with a gold inlay line |
| 9    | The largest on the ladder          | 3       | 4           | Broad shoulder plate with a gem    |
| 10   | The creature's own wings           | 3       | 4           | Grown from the body, no joint      |

### 1e. The colour ladder, rebuilt

The v3 and v4 ladder reused one colour across three rungs at a time (teal on 1 to 3, crimson on 4 and
5, blue on 6 and 7) and produced only six colour masses for ten ranks. Worse, one of those masses was
the one the owner rejected by name: _"el 4 y el 5, no me gusta el color, ese rojo con plateado no va
bien"_. v5 gives every rung its own mass and its own metal, and red is not used anywhere on the
ladder at all.

| #   | Metal                            | Field                        | Accent               | Colour mass at 32 px |
| --- | -------------------------------- | ---------------------------- | -------------------- | -------------------- |
| 1   | Old cast bronze, verdigris       | Grey blue slate STONE, matte | Dull pale crystal    | Brown and grey       |
| 2   | Blackened iron, dark bronze rim  | Deep moss green enamel       | Worn pale steel      | Dark green           |
| 3   | Polished brass and yellow copper | Calm honey amber enamel      | Near black leather   | Amber                |
| 4   | Warm brass gold                  | Deep teal turquoise enamel   | Smoked glass, cyan   | Teal                 |
| 5   | Pale champagne gold              | Deep royal cobalt enamel     | Ivory steel          | Royal blue           |
| 6   | Rich yellow gold, laurel         | Pearl ivory enamel           | Dark antique bronze  | Cream and gold       |
| 7   | Gold over dark gunmetal          | Polished black obsidian      | Cyan white crystal   | Black with cyan      |
| 8   | Satin platinum, gold edging      | Deep emerald enamel          | Green white light    | Emerald              |
| 9   | Ice crystal over platinum        | Deep glacier blue enamel     | Ivory and pale gold  | Ice blue             |
| 10  | White gold                       | None, see 1f                 | Amethyst, white core | Violet               |

Ten masses, no two neighbours alike, and the two green rungs (2 and 8) sit six apart and differ by
three values of brightness plus their metal. Violet is still reserved for rank 10 alone, which is the
finding from v1 that has survived every round: the top rank has to own a colour nothing else on the
ladder or in the 24 medals uses.

The ascent is legible as a sequence and not only as ten separate pieces: **earth** (bronze, iron,
copper) climbs into **jewels** (teal, cobalt, ivory gold), which climb into **power** (obsidian with a
lit core, emerald, ice), which ends in **violet**. Metal follows the same curve: bronze, iron, brass,
gold, platinum, crystal.

### 1f. Rank 10 is not a better badge, it is a different kind of thing

The owner: _"El único que cambiaría es el último, leyenda del gremio: dale una nueva iteración."_

v3's rank 10 was a crowned winged star. It broke the system on four counts (no shield, no enamel, an
aura, an exclusive colour) but all four are **differences of degree**: it was still a symmetrical
metal ornament in the same family as rank 9, only more of it. A top rank that is only "more" is a rank
you can imagine the next one after.

From v4 on, and unchanged in v5, rank 10 is **alive**. It is a heraldic firebird forged out of the same metal as the ranks below
it, holding a burning amethyst crystal at its breast. Every rank from 1 to 9 is an object you are
given; rank 10 is a creature that has none of the parts the others are built from: no plate, no rim,
no enamel field, no motif set into a frame, no rivet, no laurel, no crown.

That is the categorical break, and it is what makes the rung feel unreachable rather than merely
expensive. It also closes the ladder's own story: wings appear at rank 7 as hardware bolted onto a
shield, they grow at 8 and 9, and at 10 it turns out they belong to something.

Constraints it still obeys: bilateral symmetry, a solid silhouette on both themes, one violet colour
mass at 32 px, and no face. The head is a stylised bird head with no eyes, which keeps it clear of
rule 16 (nothing may read as a character) and keeps it legible when the whole emblem is 32 px wide.

In v5 the creature is refined rather than redesigned: it now carries the crystal of rank 1 in its chest explicitly, its tail ends in a violet gem so it holds mass low, and it is the only rung allowed a full aura (section 1h). The owner's verdict on this rung and on rank 9 was the reason both survived the round: _"los rangos 9 y 10 son los que más me gustan de todos"_.

**The alternative that was built and rejected in v4.** A second concept was generated in full and measured
against the same tests: a floating amethyst relic, its white gold setting split open into two claws,
crowned above and tailed below. It is in `art-drafts/v5/alternates/guild-legend-relic.png`. It was
rejected for two measurable reasons: its colour mass at 32 px is roughly half pale gold, which puts it
back in the same family as ranks 8 and 9, and its vocabulary (a crown over a gem) is the vocabulary of
rank 9 with the volume turned up, which is exactly the degree-not-kind failure the round was supposed
to fix.

### 1g. The ribbon: evaluated and rejected

REF-1, the reference set the owner passed in round 2, puts a coloured banderole across the bottom of
every emblem. It is not adopted, for three reasons in order of weight:

1. **It is a text slot with the text removed.** In REF-1 the ribbon exists to carry the rank name.
   PandaTrack draws the rank name in HTML beside the emblem (`ranks.*.name`, plus `rank.position`
   saying "Rango N de 10"). A ribbon with nothing written on it reads as a place where a word was
   deleted. Round 4 proved this the hard way: rank 7's first take drew an open scroll with a blank
   face and it came back looking exactly like an empty name banner, which is why the motif was
   replaced (section 7c).
2. **It costs a third of the footprint.** A ribbon is a wide horizontal element. The emblem renders
   into a square, `rounded-full` slot at 38 to 148 px, so anything that pushes the composition wide is
   paid for in emblem size.
3. **At 32 px it is a smear.** A thin horizontal band under a dense object closes into the object.

The ribbon's real structural job, giving the emblem visual weight low down so it does not read as a
top-heavy V, **is kept** and solved differently: ranks 4 through 9 carry a sculpted foot or bracket
base under the shield point, and rank 10 carries a three blade tail. That is rule 19, and it is
measured, not eyeballed.

### 1h. The light ladder, which is what "aura" means here

The owner asked for aura: _"que forme aura"_. Round 1 already proved what happens when a glow is
requested without a budget: the light bleeds into the contour, and at 32 px the emblem stops having a
silhouette at all. So in v5 light is a **ladder of its own**, rationed rung by rung, and it is always
contained.

| Ranks  | Level      | What is lit                                                                             |
| ------ | ---------- | --------------------------------------------------------------------------------------- |
| 1 to 3 | None       | Nothing. Every bright pixel is the key light on metal, stone, glass                     |
| 4 to 6 | One spark  | One small source: a point inside the orb, a seam in a blade, the sand in an hourglass   |
| 7 to 9 | Clear glow | One strong source that spills onto the metal around it inside the emblem                |
| 10     | Full aura  | The creature is lit from within, and one thin line of light traces its whole outer edge |

The hard rule is the same at every level and it is written into every prompt verbatim: **the light may
light the emblem's own surfaces, and it may never leave the outer contour.** No bloom, no haze, no
glow cloud, no rays, no fog, no soft halo. The outer edge stays crisp against the transparent
background.

This also earns the ladder something the previous versions did not have: a reason for rank 7 to feel
like a jump. It is the rung where the object stops being inert. The frame going from gold to platinum
is a difference of price; the crystal catching fire is a difference of kind.

## 2. Hard rules

Constraints, not guidance. A render that misses one is regenerated, not accepted. Rules keep their
numbers across versions so the round 1, 2 and 3 findings stay traceable.

1. **Transparent background.** PNG with a real alpha channel. No canvas colour, no scene, no drop
   shadow, no cast shadow on the ground. Self shadowing on the object itself is wanted.
2. **1024 by 1024 px, RGBA**, emblem centred, upright, front facing, bilaterally symmetrical. No
   rotation, no three quarter perspective. Canvas size is normalized in post (section 5) and never
   trusted from the prompt.
3. **All four canvas corners visibly empty**, verified by sampling the alpha channel, never by
   instruction.
4. **The motif is the biggest recognizable shape**, at a minimum share of the emblem width: **46 to 48
   percent on ranks 1 to 3, 44 to 50 percent on ranks 4 and 6, 62 percent of the shield HEIGHT on rank
   5 (an upright sword is measured tall, not wide), 34 to 42 percent on ranks 7 to 9** (where the wings
   carry the recognition instead). Rank 10 has no separate motif.
5. **Every ornament is capped by an explicit number of separate pieces.** What collapses at thumbnail
   size is not the motif, it is the frame: the more small separate pieces an ornament has, the sooner
   the gaps between them close and the whole thing becomes a smear. Therefore: **laurel branches, no
   more than five leaves per branch. Wing notches, exactly two at rank 7 and three at ranks 8, 9 and 10. Crown spires, exactly three. Rivets, exactly as stated per rank.** A prompt that
   says "wreath", "laurel" or "wing" without a number attached is a broken prompt.
6. **Never combine more than two sources of fine points.** Sparks, embers, floating shards, smoke and
   separate flame tongues are **banned on all ten ranks**, rank 10 included.
7. **No gem, stud, boss or finial that is not one of the rank's regulation parts.** Gems go only into
   the crest peak, the crown spires, the wing roots and the base. Nothing floats, nothing is scattered,
   nothing is added for richness.
8. **Large, obvious negative gaps between every separate piece.** A visible transparent gap between
   each leaf and the next, and between the frame and the shield. If the gaps are not obvious at full
   size they do not exist at 32 px. **The wings are the deliberate exception and the reason for rule
   22**: they are one solid piece, so they have no internal gaps to lose.
9. **The width to height ratio is measured in post, not requested.** Target 1.00, tolerance plus or
   minus 0.08.
10. **Pale ranks need a solid silhouette under the glow.** On platinum, crystal and white gold, every
    bright shape carries a distinctly darker underside and a dark recess beneath its highlight, so the
    emblem still reads as a filled shape on a white surface.
11. **One enamel colour behind the motif, and the field stays plain.** No comic sunburst, no radiating
    stripes, no rainbow, no starburst, no multicolour pattern, and no carved scrollwork or filigree on
    the field. Glassy depth, a reflection and a slight value shift are wanted; a pattern is not. That
    is the medals' language and borrowing it makes a rank look like a medal.
12. **No drawn outline anywhere.** Contrast on a light theme is carried by rule 10 (dark undersides
    and dark recesses), which is a rendering instruction rather than a drawing one.
13. **Every rank keeps a saturated accent.** `RankEmblem` draws a **locked** rank on a flat
    `--surface-elevated` plate with a muted ring, so a colourless emblem risks reading as locked while
    unlocked.
14. **No outer ring, no closed circular frame, no halo ring, no plate behind the emblem.**
    `RankEmblem` paints the band ring itself in the rank's `--rank-band-*` token and that ring carries
    state (`conquered` / `current` / `locked` / `top`). A ring drawn into the art would collide with it
    and lie about state.
15. **No text, no numbers, no letters, no watermark, no signature, no logo, no banner scroll.** See
    section 1g. The numeral is drawn by the app.
16. **No existing characters, franchises, trademarks or copyrighted material.** Every motif in section
    4 is a generic object. Rank 10 is a creature and therefore the highest risk rung: it carries no
    face, no eyes and no clothing, and it must read as an insignia bird, never as a cartoon animal, a
    mascot or a known summon.
17. **One object per rank, never repeated, and never a medal's object.** Read the medal filenames in
    `public/medals/` and the object column of `medal-art-guide.md` before choosing any motif, not
    after. The four adjacencies to check on this batch are listed in section 4c.
18. **The motif is always cream or ivory, never the frame's metal.** The motif has to fight the enamel
    field behind it, and metal on enamel does not have enough separation once the image is 32 px. The
    motif may carry a small accent of the frame metal as a detail, never as its body.
19. **The silhouette must use the whole safe circle, not only its top half.** Ranks 4 to 9 carry a
    sculpted foot or bracket base under the shield point and rank 10 carries a tail, so every emblem
    approaches a radially balanced shape.
20. **The enamel colour may never sit in the chroma key family, and the key is chosen per emblem.**
    The generator produces transparency by rendering on a flat key colour and removing it, so an
    enamel close to that key gets deleted along with the background. **Deep forest green stays banned
    as a field colour.** Each prompt names the key furthest from **that emblem's own palette**:
    **bright magenta `#FF00FF` for the teal, blue, indigo and ice ranks (1, 2, 3, 6, 7, 8, 9)** and
    **bright green `#00FF00` for the crimson and violet ranks (4, 5, 10)**. Every prompt additionally
    requires an edge connected flood fill from the four canvas borders, never a global colour match.
21. **The motif must be derivable from the rank name without being told.** New in v4, and the reason
    this round exists. Before a motif is written into a prompt it has to pass one test: show the
    emblem to somebody who knows only the rank name, and they should be able to explain why that
    object is on it. "It is a nice fantasy object" is not a reason. The one line justification for
    each of the ten lives in section 4b and is part of the spec, not commentary.
22. **A wing is one solid piece.** New in v4. Blades are notches cut out of a single slab, never
    separate shapes with gaps between them; the wing is low, wide and swept slightly downward. Full
    statement in section 1d.

### 2a. Banned prompt phrases

Treat any of these appearing in a prompt as a defect in the prompt, regardless of how the render
looks.

Banned because they caused round 1 and round 2: `full wreath` / `full laurel wreath` (unbounded piece
count) · `dissolving into sparks` · `bursting outward` · `filigree` · `intricate` · `ornate` ·
`detailed` · `floating shards` · `embers` · `glowing white` used without a solid silhouette behind it ·
any ornament named without a number.

Banned because they caused round 2's style rejection: `bold thick dark outlines` · `heavy black
keyline` · `hard-edged cel shadows` · `flat saturated colour` · `cel shading` · `two-tone silhouette` ·
`1990s shonen anime style` · `sticker`.

Banned because they caused round 3's wing rejection, and this is the v4 addition: `a fan of feather
blades` · `feather blades in one stepped row` · `a gap between each blade and the next` (applied to a
wing) · `feathered wing` · `plumage`. Every one of those pushes the generator back toward a bird.

## 3. The prompt spine

One spine, shared verbatim by all ten, plus a per-rank body. The spine is written once in
`art-drafts/v5/build_prompts.py`, which generates the prompt files in `art-drafts/v5/prompts/`, so a
style fix lands on all of them instead of being hand-copied into ten text files. **Never edit a
generated prompt file directly.**

Assembly order, per rank:

```
1. File instruction        Use your image generation tool to create ONE image and save it in the
                           current directory as exactly "<rankKey>.png".
2. Transparency block      The per-emblem chroma key, plus the edge-connected flood fill requirement
                           and the "no hole inside the artwork" check. See rule 20.
3. Body                    SUBJECT / SHAPE / MATERIALS / MOTIF. Unique per rank, section 4.
4. WINGS               Ranks 7 to 10 only, generated by one shared function. Section 1d.
5. LIGHT                   The rung's light level, and the rule that the glow may never leave the
                           outer contour. Section 1h. New in v5.
6. STYLE                   The recipe of section 1b, including the negative list. Identical for all.
7. COMPOSITION             Centred, upright, symmetrical, 1 to 1, mass low as well as high, corners
                           empty. Identical for all.
8. NEVER INCLUDE           No text, no ribbon, no sparks, no outer ring, no franchise, no scenery.
9. OUTPUT                  1024 by 1024, PNG with a real alpha channel.
```

The `WINGS` paragraph is generated by one function (`wings(size, notches, root)`) shared by ranks 7 to
10, so the construction rule of section 1d cannot drift between them. It is carried into v5 unchanged.

The `LIGHT` paragraph is generated the same way, by one of four functions (`light_none`,
`light_spark`, `light_glow`, `light_aura`), all of which end with the same hard edge sentence. That is
how the aura ladder of section 1h is enforced instead of hoped for.

**STYLE, verbatim:**

```
STYLE. Render it as a semi-realistic painted game asset in the visual language of Japanese role-playing
game equipment icons and rank insignia (the polished fantasy emblem look of Final Fantasy, Granblue
Fantasy and Octopath Traveler). It must read as a real physical object that was cast, sculpted and then
painted by hand: believable materials with visible surface character, real volume with bevelled edges
and chamfers, ambient occlusion darkening every recess and every undercut, one dramatic warm key light
from the upper left, a cool rim light grazing the lower right edge, crisp specular glints along the
raised edges, and soft self shadowing where one part overlaps another. The palette is noble and slightly
muted, rich and deep rather than neon. Separation between two materials comes from value, from the bevel
and from a thin dark seam where they meet, NOT from a drawn outline. DO NOT draw any of the following:
flat vector art, sticker art, a thick black cartoon keyline around the shapes, cel shading, hard-edged
comic book flat colour, glossy plastic toy shine, a western cartoon or Saturday morning cartoon look, an
esports mascot logo, clip art, a chibi mascot.
```

**COMPOSITION, verbatim:**

```
COMPOSITION. The emblem is centered, upright, front facing and bilaterally symmetrical, with no rotation
and no three quarter perspective. It fills a SQUARE footprint: its full width and its full height are
each about 90 percent of the canvas, so its width to height ratio is 1 to 1, and every extremity stays
inside a centered circle at 90 percent of the canvas diameter. The emblem carries visible mass in the
lower half of that circle as well as the upper half, so its outline approaches a balanced round shape and
never a narrow V. All four corners of the canvas are empty and transparent.
```

**NEVER INCLUDE, verbatim:**

```
NEVER INCLUDE. No text, no numbers, no letters, no watermark, no signature and no logo. No ribbon, no
banderole, no scroll banner and no name plate: the rank name is drawn by the application beside the
emblem. No sparks, no embers, no floating fragments, no scattered small pieces, no smoke and no separate
flame tongues. No second concentric ring, halo ring, circular frame or plate drawn around the outside of
the emblem. No existing character, franchise, trademark or copyrighted material of any kind: an original
generic design only. No background scenery and no cast shadow on the ground.
```

**WINGS, as generated for rank 8 (the other winged ranks differ only in the three parameters):**

```
WINGS. Exactly TWO wings, one on each side, in the language of military aviation insignia HARDWARE and
never of a bird. Each wing is ONE SINGLE SOLID SLAB of metal: if you traced its outline you would draw
one single continuous closed line, and there is no gap, no slot and no background visible anywhere inside
it. It is thick and heavy, clearly larger than the previous rank's, its tip reaching out to the full width
of the square footprint. The wing is LOW and WIDE: its long axis is horizontal, it is at least THREE times
wider from root to tip than it is tall, its tip points outward and slightly DOWNWARD at about ten degrees
below the horizontal, and it is never raised into a V and never swept up above the top of the emblem. Its
lower trailing edge is cut by exactly 2 deep V shaped notches, each notch a clean triangular bite taken out
of the solid metal, so the wing reads as 3 broad fused blades that are visibly ONE single piece rather than
3 separate blades stacked side by side. The wing is bolted onto the shield by ONE rectangular root plate
carrying exactly TWO round rivets and inlaid with a gold line, so the wings read as built into the frame
rather than glued behind it. The wing is never a thin spike, never a dart, never a spear head, never a
sword blade and never a row of separate blades with daylight between them. There is absolutely no plumage,
no soft feathers, no curved bird wing, no down, no separate small feathers and no free floating feather
anywhere.
```

## 4. The 10 ranks

### 4a. Summary table

Names and lore are quoted verbatim from `src/i18n/locales/es/progress.json`, thresholds from
`rankLadder.ts`. Ranks 9 and 10 additionally carry a merit lock (45 percent and 60 percent of the
shipped album), which is a gameplay gate and changes nothing about the art.

| #   | `rankKey`                | Nombre (es)               | Lore (es)                                                   | Silhouette         | Artefact                   | Destination file                          |
| --- | ------------------------ | ------------------------- | ----------------------------------------------------------- | ------------------ | -------------------------- | ----------------------------------------- |
| 1   | `kohai`                  | Kōhai                     | Tu primera pieza, todavía dormida en la roca.               | Plain disc         | Raw shard in cracked stone | `public/ranks/kohai.png`                  |
| 2   | `preorder-hunter`        | Buscador de reliquias     | Rescatas lo que otros dieron por perdido.                   | Disc in a frame    | Chipped sword in a stone   | `public/ranks/preorder-hunter.png`        |
| 3   | `volume-keeper`          | Escriba del grimorio      | Tu colección ya tiene su propio libro.                      | Octagonal plate    | Chained grimoire           | `public/ranks/volume-keeper.png`          |
| 4   | `guild-senpai`           | Senpai del gremio         | Otros empiezan a seguir tu luz.                             | Heater shield      | Summoning orb in a claw    | `public/ranks/guild-senpai.png`           |
| 5   | `first-print-hunter`     | Portador del filo         | El acero roto vuelve entero, y esta vez es tuyo.            | Ornamented shield  | The reforged blade         | `public/ranks/first-print-hunter.png`     |
| 6   | `limited-run-curator`    | Guardián de las horas     | Sabes esperar, y esperar bien es medio oficio.              | Shield with laurel | Ether hourglass            | `public/ranks/limited-run-curator.png`    |
| 7   | `club-sensei`            | Invocador del cristal     | La esquirla que hallaste al principio ya arde en tus manos. | Small wings        | The awakened crystal       | `public/ranks/club-sensei.png`            |
| 8   | `rare-edition-archivist` | Centinela de esmeralda    | Custodias lo que ya no se reimprime.                        | Medium wings       | The guardian's horned helm | `public/ranks/rare-edition-archivist.png` |
| 9   | `collection-shisho`      | Gran maestro de la bóveda | Nada entra ni sale de la bóveda sin tu llave.               | Crown, large wings | Two crossed crystal keys   | `public/ranks/collection-shisho.png`      |
| 10  | `guild-legend`           | Leyenda viva, Rango S     | El cristal ya no necesita vitrina: tiene alas.              | Creature           | The ether bird             | `public/ranks/guild-legend.png`           |

### 4b. The ten artefacts, and why each one is there

This is the section the round exists for. In v4 this table answered "why is this object the one the
NAME implies". In v5 it answers two harder questions: **why would anyone want to reach this**, and
**why do these ten look like they come from the same world**.

They come from the same world because they are one story. A collector's hoard, in this mythology, is a
hoard of crystals, and the ladder is the life of a single one of them.

| #   | Artefact                                                                     | Why it is there                                                                                                                                       |
| --- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A raw crystal shard still locked in a slab of cracked slate                  | The beginning of the story and the humblest thing on the ladder: something dug out of the ground, not granted. It is dull, unlit and still half rock. |
| 2   | An ancient chipped sword driven point first into a block of stone            | The first thing you keep rather than find. A relic somebody else abandoned, salvaged and stood upright. Rescue, not purchase.                         |
| 3   | A thick tome chained shut, an amber cabochon set in its clasp                | The legendary registry of a hoard, which is the one place where the fantasy and the product are literally the same object: this app is that book.     |
| 4   | A dark summoning orb held in three brass talons, one cyan spark inside it    | The first artefact that holds power instead of memory. The spark is small on purpose: at rank 4 you have power, you do not command it.                |
| 5   | The sword of rank 2, reforged whole, upright, one seam of gold light in it   | The ladder's first payoff. The broken thing you kept five rungs ago comes back complete, and the seam of light says the forge did it, not time.       |
| 6   | An hourglass whose sand glows, held inside a laurel wreath                   | Importing is measured in months, so the wait is made sacred instead of hidden. The laurel says patience is the honour, not the loot.                  |
| 7   | The crystal of rank 1, cut free, set in gold talons, blazing on black glass  | The jump of the whole ladder. What you found asleep at rank 1 is awake, and it is the only light in a black field so it cannot be missed.             |
| 8   | An empty horned helm of a guardian order, lit behind the visor slit          | Power needs a keeper. Faceless, wearer-less armour still standing watch is the cheapest way to say "this rank guards something" without a mascot.     |
| 9   | Two ceremonial keys crossed in an X, ice light running along their shafts    | The rung the owner already liked best, kept and elevated. Nothing enters or leaves the sanctum without the grandmaster, and he holds both keys.       |
| 10  | A heraldic bird of amethyst and white gold, the crystal blazing in its chest | The crystal from rank 1 has grown a body. Nine ranks are objects you are given; this one is alive, which is what makes it feel unreachable.           |

Three internal rhymes hold the set together and each one is deliberate:

- **The crystal** appears at 1 (asleep, in rock), at 7 (cut and burning) and at 10 (alive, in a chest).
- **The blade** appears at 2 (broken, in stone) and at 5 (reforged, whole, lit).
- **The guard** appears at 8 (the helm), 9 (the keys) and 10 (the creature it was all guarding).

Where the epic and the collecting nod collided, the epic won, exactly as briefed. Rank 3 is the one
place they did not collide at all, and that is why the grimoire earned its rung.

### 4c. Collisions checked against the 24 medals

Rule 17, applied to this batch. The v5 artefacts move away from the medal set rather than toward it,
because the medals are all everyday objects (a box, a display case, a moon, a shopfront) and v5's are
not. Three adjacencies remain and each is separated by an explicit negative in the prompt:

| Rank artefact             | Nearest medal                                  | How they are kept apart                                                                                                   |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 3, chained grimoire       | `first-photo-order`, a photo becoming a record | The tome is closed, chained and locked, with no page, no screen, no photo and no writing on it.                           |
| 6, ether hourglass        | `patience-120`, the long wait                  | The medal draws a calendar in flat colour; the rank draws a physical glass and bronze hourglass lit from inside a laurel. |
| 7, crystal on black glass | `collection-50`, a glass display cabinet       | One free standing crystal held in talons, never a cabinet, never a shelf, never a box.                                    |

The two motifs that used to collide hardest, v4's shrine gateway against `first-store` and v4's
reliquary casket against `first-order`, are gone with the objects themselves.

### 4d. The ten bodies

The full assembled prompt of each rank is one file, and the files are generated, never hand edited:
run `python3 art-drafts/v5/build_prompts.py` to rebuild `art-drafts/v5/prompts/*.txt`. Two folders,
and the difference matters:

- `prompts/` holds the **canonical** v5 text, including the five refinements of section 7d that have
  not been rendered yet.
- `prompts-as-generated/` holds the exact text that produced each image currently in `final/`.

Per rank, the parts that are unique to it are the chroma key, the SHAPE extras, the MATERIALS, the
MOTIF and the LIGHT level. Everything else comes from the shared spine of section 3.

| #   | File                                 | Chroma key | Shape extras                             | Light level |
| --- | ------------------------------------ | ---------- | ---------------------------------------- | ----------- |
| 1   | `rank-01-kohai.txt`                  | Magenta    | None, one unbroken rim                   | None        |
| 2   | `rank-02-preorder-hunter.txt`        | Magenta    | Outer band, 4 rivets                     | None        |
| 3   | `rank-03-volume-keeper.txt`          | Green      | Octagon frame, 2 rivets                  | None        |
| 4   | `rank-04-guild-senpai.txt`           | Magenta    | Border band, 4 rivets                    | One spark   |
| 5   | `rank-05-first-print-hunter.txt`     | Magenta    | Arched crest, 2 volutes, 1 pendant       | One spark   |
| 6   | `rank-06-limited-run-curator.txt`    | Green      | Laurel wreath, 1 gem                     | One spark   |
| 7   | `rank-07-club-sensei.txt`            | Magenta    | 1 spire crest, bracket, wings, 2 notches | Clear glow  |
| 8   | `rank-08-rare-edition-archivist.txt` | Magenta    | 1 spire crest, base, wings, 3 notches    | Clear glow  |
| 9   | `rank-09-collection-shisho.txt`      | Magenta    | 3 spire crown, pendant, wings, 3 notches | Clear glow  |
| 10  | `rank-10-guild-legend.txt`           | Green      | No frame at all, wings and 3 blade tail  | Full aura   |

The chroma key is chosen per rank as the hue furthest from that emblem's own palette, which is rule
20: a green keyed emerald rank or a magenta keyed violet rank comes back with holes bitten out of it.

## 5. Post-process: the footprint is measured, never requested

The reference implementation is `art-drafts/v5/normalize.py`, byte identical to v3's and v4's. Treat it as a
mandatory deterministic post-process, not an optional tidy-up. It targets the **bounding box**, with
the safe circle as a **cap**:

0. **Snap the near-opaque matte to fully opaque.** The generator returns a soft matte where the body
   of the artwork sits at alpha 250 to 254 and almost no pixel is a true 255. Snap anything at or
   above alpha 200 to 255, so the only partial alpha left is the real antialiased contour.
1. **Despill the contour only.** Pull the chroma key out of pixels below alpha 100 and nothing else.
   Without that ceiling the despill rewrites the whole emblem and strips rank 10's own violet.
2. **Close interior alpha holes.** Flood fill the alpha channel inward from the four canvas borders;
   every transparent region the fill does not reach is enclosed by the artwork and is set back to
   opaque. This repairs a chroma key bite through an enamel field automatically, and it must run
   before the bounding box is measured or a punched hole would move the box.
3. **Trim to the alpha bounding box** and **recentre on a square canvas** whose side is the larger
   bounding-box dimension.
4. **Measure the true maximum radius** from the canvas centre to any opaque pixel, not the
   bounding-box corner, which is usually transparent and would overshrink the art.
5. **Take the smaller of two scales:** the one that puts the bounding box at `TARGET_BBOX` (890 px),
   and the one that puts the farthest pixel at `MAX_RADIUS` (99 percent of the canvas radius, 507 px).
   Report which of the two bound the result.
6. **Recomposite centred on a fresh 1024 by 1024 RGBA canvas.**
7. **Verify by measuring again.** Print the output bounding box, the achieved radius, which constraint
   bound it, and the maximum alpha found in each 48 px corner. Do not eyeball any of it.

Because the winged ranks and the phoenix are bound by the radius rather than the box, they reach
almost the full inscribed circle of the PNG. **The app must therefore inset the artwork inside the
plate** (8 percent matches the inset `RankEmblem` already uses for its inner ring). The inset is
uniform across all ten, so it does not reintroduce a size difference.

## 6. QC checklist

Run on every finished PNG. `art-drafts/v5/qc.py` prints the measurements and writes `qc-strip.png`,
the visual half of the check. Steps 6 and 7 are **blocking and mandatory before anything is shown to
the owner**.

1. **1024 by 1024, RGBA, genuinely transparent.** Check the alpha channel, not "it looks white".
2. **All four corners empty.** Sample the corner regions; maximum alpha must be zero.
3. **Footprint and safe circle verified by measurement** (section 5 step 7), not by looking.
4. **Ratio inside tolerance.** 1.00 plus or minus 0.08.
5. **Piece counts match section 4 exactly.** Count the rivets, the leaves per branch, the wing notches,
   the gems, the crown spires and the tail blades in the actual pixels.
6. **Greyscale silhouette test at 64, 32 and 16 px. Blocking.** Desaturate, shrink, and look at each
   rank beside its immediate neighbour. **If two adjacent ranks are not distinguishable at 32 px in
   greyscale, regenerate. Do not deliver.**
7. **Thumbnail test in colour at 56 px and 38 px. Blocking.** The real dashboard and mini-ladder
   sizes. The motif must still be identifiable and the frame must still show gaps rather than a solid
   ring.
8. **Distinguishable from a medal.** Put the emblem next to three `public/medals/*.png` at identical
   size. A rank must read as a rendered metal object; a medal reads as a flat illustrated plate.
9. **No cartoon regression.** Look for a black keyline around the shapes, flat unshaded colour fields,
   or plastic gloss. Any of the three means the style negatives failed and the render is a reject.
10. **No banned element.** Re-read rules 6, 7, 11, 14 and 15 against the actual pixels: no sparks, no
    floating gems, no pattern on the field, no second concentric ring, no text, no ribbon.
11. **No character.** Rule 16. On this batch that means rank 10 specifically: no eyes, no face, no
    known creature.
12. **Both themes.** View on a near-black and a near-white background. Platinum, crystal and white
    gold are where rule 10 fails first.
13. **Motif collisions.** The three adjacencies in section 4c, checked against the actual medal PNGs.
14. **New in v5: the want test**, which replaces v4's name test now that the name follows the image.
    Look at the emblem with the name covered and ask whether somebody would want to reach it. An
    object that is merely well painted fails: this is the exact test v4 failed on ranks 1 to 5.
15. **New in v5: the light test.** Check that the rung's light level matches section 1h, and then check
    the contour: if any glow crosses the outer silhouette as bloom, haze or rays, the render is a
    reject no matter how good it looks at full size.
16. **New in v4: the wing test.** Shrink a winged rank to 32 px and look at the wing. If it has become
    a soft grey bar with no scalloped edge, the notches were drawn as separate blades and the render is
    a reject.

Optimization, once all ten are approved: follow the medals' precedent from `medal-art-guide.md`
section 5 and resize to 512 by 512 with a 256-colour quantization, still well above the largest render
slot (`xl`, 148 px). **Not done yet**: the files in `art-drafts/v5/final/` are the full 1024 px
masters, on purpose, so the owner judges the craft and not the compression.

## 7. Round history

### 7a. Rounds 1 and 2, 2026-08-25: rejected

Round 1 (wide winged crests at a 3 to 2 ratio) failed on structure: a "full laurel wreath" rendered as
15 to 30 contiguous leaves and was a blob at 64 px, rank 10 stacked three sources of fine points at
once, the prompt could hold neither the ratio nor the canvas size, and a 3 to 2 emblem lost a third of
its area to a square slot before anything was drawn. Those became rules 4, 5, 6, 9 and 10.

Round 2 (flat cel-shaded badges) failed on style. The owner: _"El senpai del gremio se ve demasiado
caricatura, y caricatura AMERICANA, ni siquiera caricatura anime"_, _"Me gustaría que parezca un juego
RPG, tipo FINAL FANTASY"_, _"Me gustaba más el modelo anterior que mostraste, que era así tipo alas,
pero tipo ALAS DE MILITARES"_ and _"que mientras va avanzando el rango, la forma vaya cambiando"_.
That produced v3: the semi-realistic material render of section 1b and the ten evolving silhouettes of
section 1c.

### 7b. Round 3 (v3), 2026-08-25: accepted on style, rejected on content

The owner's verdict, verbatim, and it is the brief for v4:

- _"Estamos mucho mejor, de un 3 pasamos a un 7 u 8."_
- _"Las formas me gustan cómo están."_ (silhouettes and materials approved, carried over unchanged)
- _"El único que cambiaría es el último, leyenda del gremio: dale una nueva iteración."_
- _"Lo que no me convence son las figuras que están dentro de las placas. ¿Por qué un kōhai es una
  llave? ¿Por qué el cazador de preventas es una flecha? Senpai del gremio, ¿por qué me sale esa cosa?
  No me cuadran. Quítalas, busca una mejor forma de hacerlo, que tengan al menos sentido con el nombre
  del rango. Y que sean un poco más estilo anime, o más bien RPG, Final Fantasy."_
- _"Las de rango 8, 9 y 10: no me gusta cómo está la forma de las alas, no me convence."_
- On the names: eight approved, _"archivista me suena extraño"_ and _"no tengo ni idea de qué significa
  shishō"_.

The diagnosis behind the motif complaint is worth writing down, because it is a process failure and
not a taste failure. v3's motifs were chosen for **silhouette quality first** (an hourglass is
perfectly symmetric, a fan is the boldest wedge available, a balance scale is symmetric by nature) and
their meaning was reverse engineered afterwards. That is why the justification column of v3 reads like
a set of riddles. Rule 21 inverts the order: the meaning is chosen first from the name, and only then
is a drawable object found for it. Every motif in section 4b was picked that way.

### 7c. Round 4 (v4), 2026-08-25

Fifteen generations for eleven emblems, all logged under `art-drafts/v4/raw/`: eleven first takes,
three wing retakes (ranks 7, 8 and 9) and one further retake of rank 7.

Rejected on take 1 and regenerated:

- **Rank 7's open scroll.** The motif was semantically right (the sensei hands down the manual) and
  rendered as a blank banner across the shield, which is the exact thing rule 15 forbids: a name plate
  with the name deleted. Replaced with the lit stone lantern. **Lesson, and it is now in 1g: any motif
  whose natural drawing is a wide horizontal band with a blank face will come back as a ribbon.**
- **The wings on ranks 7, 8 and 9.** Take 1 was generated with the notch wording but without the "one
  single closed silhouette" and "three times wider than tall" clauses, and the generator split every
  wing back into separate blades, upswept. The wording of section 1d is take 2's, and it is the version
  that holds.

- **Rank 7's field, again.** Take 2 fixed the motif and the wings and then filled the blue enamel with
  carved scrollwork, which is rule 11. Take 3 adds the same "the enamel field is completely smooth and
  plain" sentence that rank 6 already carried, and ships. **Lesson: the plain-field clause is not
  optional on any rank whose motif is a small upright object; the generator fills the empty blue with
  ornament unless it is told not to.**

Accepted on take 1: ranks 1, 2, 3, 4, 5, 6 and 10, plus the rejected rank 10 alternative. Accepted on
take 2: ranks 8 and 9.

**Measured on the shipped batch** (`python3 art-drafts/v4/qc.py`): all ten are 1024 by 1024 RGBA with
a maximum corner alpha of 0; nine bounding boxes sit at the 890 px target and rank 10 is bound by the
safe circle instead at 772 px with its farthest pixel at radius 508 of 507, which is the phoenix
filling the inscribed circle rather than the square; ratios run from 0.97 to 1.05, all inside the plus
or minus 0.08 tolerance of rule 9. The silhouette test at 64, 32 and 16 px, in colour on both themes
and in greyscale, is `art-drafts/v4/qc-strip.png`: no two adjacent rungs collapse into the same blob at
32 px, and the last band of that strip puts four ranks beside three medals at 72 px, where the two
families stay unmistakably different.

### 7d. Round 5 (v5), 2026-08-25

The round that changed the rule instead of the pictures. The owner's verdict on v4, rung by rung:
ranks 1 to 5 _"no me gustan para nada, cámbialas"_, ranks 6 to 8 _"no me molestan pero tampoco me
parecen increíbles ni me emocionan"_, ranks 9 and 10 _"son los que más me gustan de todos"_. Plus
three specifics: the red and silver of ranks 4 and 5 _"no va bien"_, rank 5 _"tiene como forma de
corazón"_ and should be _"un escudo convencional, tal vez con algún ornamento"_, and the whole set
should _"formar aura"_.

What was done:

1. **Ten artefacts were designed first, as one mythology** (section 4b), with no reference to the
   existing names.
2. **The names were written afterwards** to caption those artefacts (section 1a). Seven changed.
3. **The colour ladder was rebuilt** to ten distinct masses with no red anywhere (section 1e).
4. **Light was rationed into four levels** and hard bounded to the silhouette (section 1h).
5. **Ranks 4 and 5 were rebuilt as heater shields** with the heart shape banned by name in the prompt.

Measured result of the batch, from `qc.py`: all ten at 1024 by 1024 RGBA, all four corners at alpha 0
on all ten, eight of ten within 1.04 of a 1 to 1 footprint. The two exceptions are rank 4 at 0.90 and
rank 5 at 0.81, both radius capped by the normalizer, which is why both render visibly smaller than
their neighbours on the board. Ten distinguishable colour masses at 32 px in both themes, and the
greyscale strip separates all ten silhouettes.

**The refinement pass that did not render.** The image generation quota was exhausted right after the
ten emblems landed (`usage_limit_reached`, roughly two and a half hours of lockout), so the second
take of five rungs never ran. The corrected prompts are already written and sitting in `prompts/`.
Running `./gen.sh <slug> 2` for these five is the first thing the next round should do:

| #   | Slug                         | What take 2 fixes                                                                                                                                                                                                    |
| --- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `rank-01-kohai`              | The shard reads as a grey rock chip. Take 2 makes it plainly a translucent crystal, paler than the stone, and grows it from 40 to 46 percent of the disc.                                                            |
| 3   | `rank-03-volume-keeper`      | The amber field came back as molten lava and the tome as red leather, so the book barely separates from the field. Take 2 calms the field, bans red outright and makes the leather near black.                       |
| 4   | `rank-04-guild-senpai`       | The orb is too small, its spark is invisible and the lower half of the field is empty. Take 2 grows the orb to 50 percent, makes the cyan spark plainly visible and stands the claw on a base.                       |
| 5   | `rank-05-first-print-hunter` | The crest reads as a curtain rod and the emblem is narrow (0.81). Take 2 replaces the bar with a low arched crest, widens the volutes to a square footprint, and makes the gold seam in the fuller actually visible. |
| 10  | `rank-10-guild-legend`       | The wings and tail are sprays of thin splinters. Take 2 asks for broad solid slabs, a clearer bird head and a breast crystal grown from 20 to 26 percent.                                                            |

Nothing on this list is a rejection of the concept; every one of them is a rendering miss against a
prompt that already says the right thing or a wording tightened after seeing the result. The ten
images that ship with v5 are all take 1.

### 7e. Round 6 (v6), 2026-08-25

v5 shipped every rank from take 1, because the image quota ran out before the refinement pass. v6 is
that pass and nothing else: five rungs re-rendered (1, 3, 4, 5 and 10), the other five carried over
from v5 byte for byte. Four of the five landed on the first attempt of the round: rank 1 reads as cut
crystal instead of stone, rank 3's tome contrasts against the amber with no lava red left, rank 4's
orb fills the shield and its cyan spark is visible, rank 5 is a straight shield with an arched crest.

Rank 10 did not. Three rounds running, the owner rejected it for the same defect, in the same words:
**the wings came back as separate leaves with background light between them**, when the brief asks for
one solid plate, and the wing rose into a V instead of sitting low and wide.

That verdict was made measurable rather than argued. For every row of the silhouette that has opaque
pixels, count the transparent runs between its first and last opaque pixel, and average over those
rows (`gaps/row`, measured on a 512 px resize). A fan of separate feathers charges one gap per leaf on
every row it spans; a solid plate charges none. Rank 10 measured **1.38**, against **0.36** for rank 7
and **0.31** for rank 8, the two winged rungs the owner had already accepted.

The metric alone is not enough to accept by, because it also charges a bird for the ordinary daylight
between a drooping wing tip and its tail, which no shield ever has. So a second measurement isolates
the named defect: drop the run that contains the centre column (the body and tail) and count how many
SEPARATE opaque runs are left on each side (`split_runs/row`). One solid wing contributes exactly one
run per side and scores 0; a wing built of separate leaves scores one extra run per leaf. Rank 10
measured **0.41** there, against 0.03 and 0.01 for ranks 7 and 8.

The prompt was rewritten around that one failure (`art-drafts/v6/prompts/rank-10-guild-legend.txt`),
which is the only prompt in the set with a rule ahead of the subject: any horizontal line across the
emblem must enter the artwork and leave it without crossing background in between; each wing is ONE
plate whose outline is a single closed line; **the leaf count is expressed as NOTCHES cut into the
trailing edge, never as separate pieces**; the wing is at least three times wider than tall, with its
tip pointing outward and slightly DOWN; the tail is one fan cut by two notches rather than three loose
blades; and every forbidden wing shape the failed attempts had actually drawn is named.

Five takes were generated from it (the budget allowed eight; the run stopped when the criteria were
met rather than spending the rest). Every take fixed the defect. Measured after normalization:

| Take | `gaps/row` | `split_runs/row` | Verdict                                                                    |
| ---- | ---------- | ---------------- | -------------------------------------------------------------------------- |
| v5/v6 before | 1.38 | 0.41 | The rejected render: separate leaves, wing in a V                          |
| 1    | 0.50       | 0.12             | Solid, but the wings droop into a short cape rather than reading low and wide |
| **2**| **0.38**   | **0.07**         | **Shipped.** One notched plate per wing, low and wide, tips angled down      |
| 3    | 0.65       | 0.12             | The widest and most bird-like, but more gold than the family's wing language |
| 4    | 0.12       | 0.00             | The best number and the wrong object: one unbroken membrane, a bat wing (§2a) |
| 5    | 0.54       | 0.20             | Solid, but its notches cut through in places                                 |

Take 2 ships. It lands on the same number the accepted rank 7 measures (0.38 against 0.36), it is the
one that reads as the same forge as ranks 8 and 9 (white-gold frame around a faceted amethyst field),
and its wing is unmistakably one piece: the three blades are notches bitten out of its trailing edge.
QC records `voids=0` — not one pixel of enclosed background anywhere inside the artwork — corners at
alpha 0, a 889x870 footprint against the set's 890, and a silhouette still readable at 32 px and 16 px.

Take 4's number is the lesson worth keeping: a metric can be gamed by drawing a blob. The measurement
decides which candidates are ELIGIBLE; the family, and the brief's own banned shapes, decide which
eligible one ships.

Measured across the whole shipped set (`art-drafts/v6/silhouette.py final/*.png`), rank 10 is no
longer the outlier it was; it now sits tighter than four of the nine rungs below it:

| Rank | Key                      | `gaps/row` | `split_runs/row` |
| ---- | ------------------------ | ---------- | ---------------- |
| 1    | `kohai`                  | 0.00       | 0.00             |
| 2    | `preorder-hunter`        | 0.00       | 0.00             |
| 3    | `volume-keeper`          | 0.00       | 0.00             |
| 4    | `guild-senpai`           | 0.00       | 0.00             |
| 5    | `first-print-hunter`     | 0.73       | 0.12             |
| 6    | `limited-run-curator`    | 0.71       | 0.15             |
| 7    | `club-sensei`            | 0.36       | 0.03             |
| 8    | `rare-edition-archivist` | 0.31       | 0.01             |
| 9    | `collection-shisho`      | 0.97       | 0.23             |
| 10   | `guild-legend`           | **0.38**   | **0.07**         |

## 8. Where everything lives

| Artifact                              | Path                                              |
| ------------------------------------- | ------------------------------------------------- |
| The ten masters                       | `art-drafts/v6/final/*.png`                       |
| Review sheet for the owner            | `art-drafts/v6/ranks-v6-board.png`                |
| Silhouette and QC strip               | `art-drafts/v6/qc-strip.png`                      |
| Canonical prompt, rank 10 (v6)        | `art-drafts/v6/prompts/rank-10-guild-legend.txt`  |
| Canonical prompts, ranks 1-9          | `art-drafts/v5/prompts/*.txt`                     |
| Text that produced the v5 art         | `art-drafts/v5/prompts-as-generated/*.txt`        |
| Prompt generator                      | `art-drafts/v5/build_prompts.py`                  |
| One generation                        | `art-drafts/v6/gen.sh <slug> [take]`              |
| Every attempt, kept                   | `art-drafts/v6/raw/<slug>-take<N>/`               |
| Normalizer                            | `art-drafts/v6/normalize.py`                      |
| QC                                    | `art-drafts/v6/qc.py`                             |
| Board builder                         | `art-drafts/v6/board.py`                          |
| Publisher (512 px + quantize)         | `art-drafts/v6/publish.py`                        |
| Silhouette metrics                    | `art-drafts/v6/silhouette.py`                     |
| Integration screenshots               | `art-drafts/v6/screens/`                          |
| Rejected rank 10 concept              | `art-drafts/v4/alternates/guild-legend-relic.png` |
| Previous rounds, preserved            | `art-drafts/v3/`, `art-drafts/v4/`, `art-drafts/v5/` |

What v5 landed in the repository beyond the images is the copy: the ten new names and their lore in
`src/i18n/locales/{es,en}/progress.json`, the rank table in `frd-12-collector-progression.md`, the
merit lock line in `fdd-12-collector-progression.md`, and every rank name and lore string inside
`prototype/collector-progression.html`.

## 9. Integration: complete

**Done, 2026-08-25**, the same shape the medals took (`medal-art-guide.md` §5), and with the same two
operations: resize the 1024 px master to **512** (the largest slot any surface renders a rank in is
`xl`, 148 CSS px, so 512 still covers a 2x screen with room over), then palette-quantize to 256
colours with `Image.Quantize.FASTOCTREE`, which keeps a real alpha channel. `art-drafts/v6/publish.py`
does both, asserts the result kept its transparency and stayed under the 150 KB budget, and prints
every before/after. The ten files went from ~12 MB of masters to **696 KB** total, largest 97 KB
(`kohai`), and live in `public/ranks/`.

**No catalogue column was added.** `resolveRankArtSrc(rankIndex)`, exported from
`src/components/core/RankEmblem.tsx`, turns a 1-based ladder position into `/ranks/<rankKey>.png` via
`RANK_KEYS` and nothing else. That is the difference from the medals, where each row carries an
`imageKey`: the ladder is a fixed, ordered ten whose keys already key the translation namespaces
(`ranks.<rankKey>.name`, `.lore`), so a second hand-maintained mapping could only drift out of step
with them. Installing art is dropping a file into `public/ranks/` named after its rank key, and no
call site changed: every surface already passes `rankIndex`.

The three design decisions the artwork forced (no numeral on the plate, the band ring merged into the
plate's own border, and locked = the real art desaturated with no padlock), plus the summit no longer
being exempt from its own locked state, are recorded in `fdd-12-collector-progression.md` under
`RankEmblem`, and the component contract in `docs/design/components.md`.

**Verified live** against the owner's real dev data, read-only, in both themes at 1440x950 and
390x844: the `Resumen` hero (`lg`/`xl`), the `Rangos` ladder (all ten rungs), the dashboard widget
(`sm`/`md`), and the rank-up celebration. Screenshots in `art-drafts/v6/screens/`. Two of those sets
are marked `harness-`: the owner's account stands at rank 1 with 0 points, so the `conquered` state
and the celebration cannot appear on their real data. Those two were captured with a single input
forced in a temporary local edit that was reverted immediately after (the ladder page rendered with
`currentRankIndex={6}`, and the celebration mounted with a fixed rank-7 payload). Nothing was written
to the database in any of it.

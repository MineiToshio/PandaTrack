"""Builds the v5 rank prompts from one shared spine plus a per-rank block.

v5 inverts the rule that produced v4. Until now the motif was derived from the rank NAME, which
kept landing on everyday objects: a shrine gate, a reservation tag, a book, a compass rose, a
magnifying glass. The owner rejected all five: an everyday object painted with care is still an
everyday object and nobody wants to climb toward one. From v5 on the IMAGE LEADS AND THE NAME
FOLLOWS: each rung is first designed as a fantasy artefact, and the rank name is written afterwards
to fit the artefact.

What v5 keeps from v3/v4, because the owner approved it:

  * the silhouette ladder (disc, framed disc, octagonal plate, shield, crested shield, laurel
    shield, small wings, medium wings, crown plus large wings, creature),
  * the semi-realistic painted game asset style with real materials, real volume and no drawn
    outline,
  * the wing built as ONE solid slab with notches cut into its trailing edge.

What v5 changes:

  1. every motif becomes a fantasy artefact belonging to ONE mythology (the Crystal cycle),
  2. the whole colour ladder is redesigned so no two rungs share a colour mass at 32 px, and the
     red plus silver of ranks 4 and 5 is gone,
  3. light becomes a ladder of its own: none on 1 to 3, one spark on 4 to 6, a clear glow on 7 to
     9, a full aura only on 10, and never a glow that leaks past the silhouette,
  4. ranks 4 and 5 are rebuilt as true heater shields, with the heart shaped outline banned by
     name.

The mythology, so the ten pieces look like they come from the same world: a collector's hoard is a
hoard of crystals, and this ladder is the life of ONE crystal. Rank 1 finds it dull and asleep in
the rock, rank 7 has it awake and blazing in a golden cradle, and rank 10 is the crystal alive,
wearing wings. Everything between them is the order that guards it.

The spine is written once here so a style fix lands on all ten at once.
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "prompts")

STYLE = (
    "STYLE. Render it as a semi-realistic painted game asset in the visual language of Japanese "
    "role-playing game equipment icons and rank insignia (the polished fantasy emblem look of Final Fantasy, "
    "Granblue Fantasy and Octopath Traveler). It must read as a real physical object that was cast, sculpted "
    "and then painted by hand: believable materials with visible surface character, real volume with bevelled "
    "edges and chamfers, ambient occlusion darkening every recess and every undercut, one dramatic warm key "
    "light from the upper left, a cool rim light grazing the lower right edge, crisp specular glints along the "
    "raised edges, and soft self shadowing where one part overlaps another. The palette is noble and slightly "
    "muted, rich and deep rather than neon. Separation between two materials comes from value, from the bevel "
    "and from a thin dark seam where they meet, NOT from a drawn outline. "
    "DO NOT draw any of the following: flat vector art, sticker art, a thick black cartoon keyline around the "
    "shapes, cel shading, hard-edged comic book flat colour, glossy plastic toy shine, a western cartoon or "
    "Saturday morning cartoon look, an esports mascot logo, clip art, a chibi mascot."
)

COMPOSITION = (
    "COMPOSITION. The emblem is centered, upright, front facing and bilaterally symmetrical, with no rotation "
    "and no three quarter perspective. It fills a SQUARE footprint: its full width and its full height are each "
    "about 90 percent of the canvas, so its width to height ratio is 1 to 1, and every extremity stays inside a "
    "centered circle at 90 percent of the canvas diameter. The emblem carries visible mass in the lower half of "
    "that circle as well as the upper half, so its outline approaches a balanced round shape and never a narrow "
    "V. All four corners of the canvas are empty and transparent."
)

BANS = (
    "NEVER INCLUDE. No text, no numbers, no letters, no runic writing, no alphabet of any kind, no watermark, "
    "no signature and no logo. No ribbon, no banderole, no scroll banner and no name plate: the rank name is "
    "drawn by the application beside the emblem. No sparks, no embers, no floating fragments, no scattered "
    "small pieces, no smoke and no separate flame tongues. No second concentric ring, halo ring, circular frame "
    "or plate drawn around the outside of the emblem. No existing character, franchise, trademark or "
    "copyrighted material of any kind: an original generic design only. No background scenery and no cast "
    "shadow on the ground."
)

CANVAS = (
    "OUTPUT. Square canvas, 1024 by 1024 pixels, PNG with a real transparent alpha channel, no background "
    "colour behind the emblem."
)

# The light ladder. The owner asked for "aura", and round 1 proved that an unbounded glow eats the
# silhouette, which is the one thing this art cannot afford at 32 px. So light is rationed by rung
# and it is always CONTAINED: it may light the emblem's own materials, it may never leave the
# outer contour.
HARD_EDGE = (
    "Outside the emblem's outer contour there is no light at all: no bloom, no haze, no glow cloud, no rays, "
    "no fog, no coloured mist and no soft halo. The outer edge of the emblem stays crisp, hard and perfectly "
    "readable against the transparent background, and the glow never blurs, swells or softens the silhouette."
)


def light_none():
    return (
        "LIGHT. This emblem gives off NO light of its own. Every bright area on it is the studio key light "
        "reflecting off metal, glass or stone. Nothing in it is a lamp, a flame, a lit rune or a glowing gem, "
        "and it must read as a heavy, dark, unenchanted object that has not woken up yet. " + HARD_EDGE
    )


def light_spark(where):
    return (
        f"LIGHT. This emblem is only faintly enchanted and it carries exactly ONE small light source: {where} "
        f"That light is small and contained: it brightens only the material immediately touching it, it does "
        f"not wash over the frame, it does not tint the whole emblem, and everything else on the emblem is lit "
        f"by the studio key light alone. " + HARD_EDGE
    )


def light_glow(where):
    return (
        f"LIGHT. This emblem is clearly enchanted and it carries ONE strong light source: {where} That light "
        f"spills onto the material around it inside the emblem: nearby metal picks up a coloured sheen along "
        f"its bevels, the recesses beside it are filled with coloured light instead of black shadow, and the "
        f"contrast between the lit centre and the darker outer frame is what makes the piece feel powerful. "
        f"The glow is bright but it stays INSIDE the emblem and it never becomes a soft cloud. " + HARD_EDGE
    )


def light_aura(where):
    return (
        f"LIGHT. This is the only emblem of the whole ladder with a full aura, and it is lit from within: "
        f"{where} Its light floods the whole creature from the inside, so every plate and every blade glows "
        f"along its inner edge, the violet material turns hot white violet wherever the light strikes it, and "
        f"one thin bright line of light traces the entire outer edge of the creature like a rim light. The "
        f"aura is expressed through the object's OWN surfaces, never as fog around it. " + HARD_EDGE
    )


def wings(size, notches, root):
    """The v4 wing, kept verbatim in v5 because the owner approved it, and stated once here.

    ONE solid plate per side, with the blade count expressed as deep notches CUT INTO its trailing
    edge. A notch cut into a solid survives downscaling; a gap between two thin positives does not.
    """
    blades = notches + 1
    return (
        f"WINGS. Exactly TWO wings, one on each side, in the language of military aviation insignia HARDWARE "
        f"and never of a bird. Each wing is ONE SINGLE SOLID SLAB of metal: if you traced its outline you would "
        f"draw one single continuous closed line, and there is no gap, no slot and no background visible "
        f"anywhere inside it. It is thick and heavy, {size} "
        f"The wing is LOW and WIDE: its long axis is horizontal, it is at least THREE times wider from root to "
        f"tip than it is tall, its tip points outward and slightly DOWNWARD at about ten degrees below the "
        f"horizontal, and it is never raised into a V and never swept up above the top of the emblem. Its lower "
        f"trailing edge is cut by exactly {notches} deep V shaped notches, each notch a clean triangular bite "
        f"taken out of the solid metal, so the wing reads as {blades} broad fused blades that are visibly ONE "
        f"single piece rather than {blades} separate blades stacked side by side. {root} "
        f"The wing is never a thin spike, never a dart, never a spear head, never a sword blade and never a "
        f"row of separate blades with daylight between them. There is absolutely no plumage, no soft feathers, "
        f"no curved bird wing, no down, no separate small feathers and no free floating feather anywhere."
    )


# Ranks 4 to 9 are all built on the same shield. Stated once, with the heart shape banned by name,
# because that is exactly what rank 5 came back as in v4.
def heater(extra):
    return (
        "SHAPE. The core of the emblem is ONE heater shield: its top edge is a SINGLE STRAIGHT HORIZONTAL "
        "LINE from corner to corner, its two upper corners are square, its sides run straight down for the "
        "upper half and then curve inward to meet at ONE rounded point at the bottom. The outline of that "
        "shield is never lobed, never scalloped, never notched at the top, never split into two humps and "
        "NEVER heart shaped. " + extra
    )


def key_block(key_name, key_hex, palette):
    return (
        f"CRITICAL TRANSPARENCY REQUIREMENT. This artwork's palette is {palette}. If you build the "
        f"transparency by rendering on a chroma key background and removing it, the key MUST be "
        f"{key_name} (pure {key_hex}), which is the hue furthest from this emblem's own colours, and the removal "
        f"MUST be an edge connected flood fill starting from the four canvas borders, never a global colour "
        f"match. No pixel enclosed by the emblem's outer contour may become transparent: the inside of the "
        f"emblem is 100 percent opaque everywhere. Before saving, verify there is no hole anywhere inside the "
        f"artwork and fix it if there is."
    )


MAGENTA = ("BRIGHT MAGENTA", "#FF00FF")
GREEN = ("BRIGHT GREEN", "#00FF00")

RANKS = [
    dict(
        n=1,
        key="kohai",
        name="Kohai",
        artifact="La esquirla dormida",
        chroma=MAGENTA + ("aged brown bronze with a grey blue slate stone field and a dull pale crystal shard",),
        body=(
            "SUBJECT. A single collectible guild rank medallion: a plain struck circular disc holding a piece of "
            "raw rock, and nothing else. This is deliberately the humblest, heaviest and most earthbound emblem "
            "of the whole ladder: something dug out of the ground, not something granted.\n\n"
            "SHAPE. The outer contour of the whole image is one perfect simple circle. One thick heavy sculpted "
            "circular rim occupying about one fifth of the disc diameter, with a chamfered outer edge and a "
            "stepped inner edge, encloses a single field that fills the rest of the disc. The rim is one "
            "continuous unbroken band: no rivets, no gems, no leaves, no laurel, no wings, no crest, no points "
            "and no ornament of any kind attached to it.\n\n"
            "MATERIALS. The metal is old cast bronze, a muted desaturated reddish brown, clearly brown and NOT "
            "gold, with no yellow tones and no golden shine: a weathered surface with visible casting grain, "
            "fine scratches, small nicks on the edge and dark green verdigris settled into every recess. The "
            "field is NOT enamel: it is a slab of rough grey blue slate stone, matte and unpolished, with fine "
            "mineral speckle, a faint diagonal grain and no shine at all.\n\n"
            "MOTIF. Growing out of the middle of the stone field, ONE raw uncut crystal shard: a single tall "
            "angular prism standing upright, pointed at the top, wider at its base where it is still swallowed "
            "by the rock, its surfaces large flat fracture planes with hard glassy edges between them. It is "
            "unmistakably a CRYSTAL and never a grey chip of rock: translucent pale ice blue, cloudy inside, "
            "clearly PALER, cooler and glassier than the grey stone around it, so it separates from the rock "
            "instantly even at thumbnail size. It is completely unlit, with no inner light, no glow and no "
            "sparkle, and it is clearly the same crystal that later ranks will cut, set and awaken. The stone "
            "around its base is split by exactly THREE short cracks radiating outward. Nothing else: no gems, "
            "no metal setting, no tools, no pedestal, no plant and no second shard. The shard is about 46 "
            "percent of the disc width and about 55 percent of its height, and it casts a soft shadow onto the "
            "stone below and to the right of it."
        ),
    ),
    dict(
        n=2,
        key="preorder-hunter",
        name="Buscador de reliquias",
        artifact="La hoja hallada",
        chroma=MAGENTA + ("blackened iron and dark bronze with a deep moss green enamel field and a pale steel blade",),
        body=(
            "SUBJECT. A single collectible guild rank medallion: the same circular disc as the first rank, now "
            "mounted inside a second outer band, so the disc has gained a frame. Inside it, a broken relic "
            "weapon that somebody pulled out of the ground and decided to keep.\n\n"
            "SHAPE. The outer contour of the whole image is still one perfect simple circle. From the outside "
            "inward there are exactly three parts: ONE outer band of dark hammered metal about one seventh of "
            "the diameter carrying exactly FOUR round rivets at the top, the bottom, the left and the right; "
            "then ONE thinner smooth inner rim; then the field. No gems, no leaves, no laurel, no wings, no "
            "crest and no points anywhere on either band.\n\n"
            "MATERIALS. The outer band is blackened wrought iron, cold and dark, with visible hammer marks and "
            "specks of orange rust caught in its low spots. The inner rim is dark bronze. The field is deep "
            "moss green vitreous enamel, dark and forest coloured, with real glassy depth and a faint "
            "reflection sliding across it.\n\n"
            "MOTIF. Centred on the enamel field, ONE ancient sword driven point first into a low block of "
            "cracked stone that sits at the bottom of the field. Only the upper part of the weapon is visible "
            "above the stone: a straight tapering blade with exactly TWO chipped bites missing from its edges, "
            "then one straight simple crossguard with slightly flared ends, then a wrapped grip and one round "
            "pommel at the top. The blade is pale worn steel with a scarred surface, the guard and pommel are "
            "dark bronze, and the stone is grey and plain. Nothing else: no chain, no rope, no flowers, no "
            "second weapon, no shield and no light. The whole motif is about 46 percent of the disc width and "
            "it is sculpted in low relief with a soft shadow on the enamel."
        ),
    ),
    dict(
        n=3,
        key="volume-keeper",
        name="Escriba del grimorio",
        artifact="El grimorio encadenado",
        chroma=GREEN + ("polished copper and brass with a warm amber enamel field and a dark leather tome",),
        body=(
            "SUBJECT. A single collectible guild rank plate: an eight sided plaque, a step up in craft from the "
            "two round discs below it. Inside it, the sealed book in which an order writes down everything it "
            "owns.\n\n"
            "SHAPE. The outer contour of the whole image is one regular OCTAGON with eight equal straight "
            "sides and eight blunt corners, standing flat side up. One thick chamfered octagonal frame about "
            "one sixth of the plate width, carrying exactly TWO round rivets, one at the middle of the top side "
            "and one at the middle of the bottom side, encloses an octagonal field. No gems, no leaves, no "
            "laurel, no wings, no crest and no points.\n\n"
            "MATERIALS. The frame is polished brass and yellow copper, clearly a warm YELLOW metal rather than "
            "a red one, richer and cleaner than the bronze and iron of the ranks below, with a fine brushed "
            "grain and dark patina in its recesses. The field is calm honey amber vitreous enamel, even and "
            "glassy, the colour of honey held to a window. That field is NOT fire, NOT lava and NOT molten "
            "metal: it has no flames, no glowing streaks, no embers and no light of its own, and there is no "
            "red, no crimson, no scarlet and no burgundy anywhere in this emblem.\n\n"
            "MOTIF. Centred on the field, ONE thick closed tome standing upright with its front cover facing "
            "the viewer square on. Its cover is very dark, almost black oiled leather, several values DARKER "
            "than the amber field behind it so the book reads as a clean dark shape at thumbnail size, with a "
            "metal corner piece on each of its four corners. ONE heavy chain crosses the cover horizontally across its middle and is closed by "
            "ONE square clasp at the centre, and set into that clasp is ONE round polished cabochon gem of dark "
            "amber. Along the right edge of the tome the stacked page edges are visible, gilded. The cover "
            "carries no writing, no letters, no symbol and no drawing of any kind: only the corners, the chain "
            "and the clasp. Nothing else: no open pages, no quill, no ink, no ribbon bookmark, no candle and no "
            "second book. The tome is about 48 percent of the plate width."
        ),
    ),
    dict(
        n=4,
        key="guild-senpai",
        name="Senpai del gremio",
        artifact="El orbe de invocacion",
        chroma=MAGENTA + ("warm brass gold with a deep teal turquoise enamel field and a dark smoked glass orb",),
        body=(
            "SUBJECT. A single collectible guild rank shield: the ladder leaves the flat plate behind and "
            "becomes armour for the first time. Inside it, the first artefact of this order that actually holds "
            "power: a summoning orb resting in its claw.\n\n"
            + heater(
                "The shield is bordered by ONE broad sculpted band about one seventh of its width carrying "
                "exactly FOUR round rivets, one near each upper corner and one on each side at the waist. "
                "Nothing is attached above, below or beside the shield: no crest, no crown, no wings, no laurel "
                "and no pendant. This is the plainest shield of the ladder."
            )
            + "\n\n"
            "MATERIALS. The frame is warm brass gold, honey coloured and softly polished, with sharp bevels and "
            "dark recesses. There is no cold silver, no chrome, no steel grey and NO RED anywhere in this "
            "emblem. The field is deep teal turquoise vitreous enamel, saturated and marine, clearly darker at "
            "its edges and glassy in the centre.\n\n"
            "MOTIF. Centred on the field, ONE perfectly round orb, large and heavy, about 50 percent of the "
            "shield width, held from below in a cradle of exactly THREE curved brass talons. The talons are "
            "separate and finger like: they rise from a small stepped brass base that rests on the lower part "
            "of the field, they curve up around the orb and they grip its lower half without covering its "
            "front. They never merge into a single flame shape, a leaf, a heart or a fleur de lis. The base "
            "and the talons fill the lower third of the field so no part of the field is left empty. The orb "
            "is dark smoked glass, almost black at its rim, polished to a deep reflective surface, and "
            "suspended at its centre there is ONE clear point of pale cyan light with a small tight cyan halo "
            "around it, seen through the glass and plainly visible even at thumbnail size. Nothing else: no "
            "chain, no runes, no wings, no second orb and no rays."
        ),
        light=light_spark(
            "the pinhead of pale cyan light suspended deep inside the smoked glass orb, seen through the glass."
        ),
    ),
    dict(
        n=5,
        key="first-print-hunter",
        name="Portador del filo",
        artifact="El filo reforjado",
        chroma=MAGENTA + ("pale champagne gold with a deep royal cobalt blue enamel field and an ivory steel blade",),
        body=(
            "SUBJECT. A single collectible guild rank shield, the same armour as the rank below but now "
            "ornamented, wider and clearly finer. Inside it, the broken sword of the second rank returned whole: "
            "reforged, complete, and awake for the first time.\n\n"
            + heater(
                "That shield is bordered by ONE broad sculpted band with a fine beaded inner edge. Attached to "
                "the emblem there are exactly THREE ornaments and no more: ONE low arched crest sitting "
                "directly on the top edge of the shield and no wider than the shield, carrying ONE faceted gem "
                "at its middle and one small blunt finial at each of its two ends, which must never read as a "
                "curtain rod, a hanging bar or a scroll rod; ONE LARGE scrolled volute at each side of the "
                "shield at the waist, mirrored left and right, each one broad, heavy and reaching well outward "
                "so that the emblem ends up as WIDE as it is TALL and fills a square footprint; and ONE small "
                "faceted pendant drop hanging just below the shield's bottom point. There are no wings, no "
                "laurel, no crown and no rays."
            )
            + "\n\n"
            "MATERIALS. The frame, the crest, the volutes and the pendant are pale champagne gold: a warm "
            "soft gold, satin brushed on its flats and mirror bright on its bevels. There is no cold silver, no "
            "chrome, no pewter, no steel grey and absolutely NO RED anywhere in this emblem. The field is deep "
            "royal cobalt blue vitreous enamel, rich and saturated, darkening toward its edges.\n\n"
            "MOTIF. Centred on the field, ONE straight double edged sword standing perfectly upright with its "
            "point at the top: a long tapering blade with a shallow fuller running down its middle, ONE "
            "straight crossguard with slightly flared ends low on the blade, a wrapped grip and ONE faceted "
            "round pommel at the very bottom. The blade is ivory pale polished steel and the guard, grip "
            "fittings and pommel are champagne gold. Running the whole length of the fuller there is ONE thin "
            "continuous line of warm gold light, like a seam of metal still cooling inside the forge. It is a "
            "narrow line, never a flame and never a halo, but it is BRIGHT and plainly visible, the single "
            "point of light on the whole emblem, and it still reads at thumbnail size. Nothing else on the "
            "field: no flames, no runes, no second sword, no wreath and no rays. The sword is about 62 percent "
            "of the shield height."
        ),
        light=light_spark(
            "the single hairline seam of warm gold light running down the fuller of the blade, and nothing else."
        ),
    ),
    dict(
        n=6,
        key="limited-run-curator",
        name="Guardian de las horas",
        artifact="La clepsidra de eter",
        chroma=GREEN + ("rich yellow gold with a pearl ivory enamel field and a dark bronze hourglass",),
        body=(
            "SUBJECT. A single collectible guild rank shield crowned with a laurel wreath, the highest honour "
            "the ladder gives to a person who is still only a person. Inside it, the hourglass that measures "
            "the long wait an order accepts in exchange for something worth owning.\n\n"
            + heater(
                "That shield sits inside ONE laurel wreath: exactly TWO laurel branches, one on each side, "
                "rising from ONE small knot at the very bottom of the emblem and curving up and outward around "
                "the shield until their tips nearly meet near the top, leaving a clear gap between the two "
                "tips. Each branch carries broad sculpted laurel leaves in a single row, all of them attached "
                "to the branch, none of them floating free. Above the shield's top edge sits ONE small faceted "
                "gem in a simple mount. There are no wings, no crown, no rays and no ribbon."
            )
            + "\n\n"
            "MATERIALS. The shield frame, the laurel and the gem mount are rich yellow gold, warm and deeply "
            "polished, with real weight and dark recesses between the leaves. The field is pearl ivory enamel, "
            "pale and softly luminous like the inside of a shell, so this rank reads as a bright cream and gold "
            "mass. The gem above the shield is a pale golden topaz.\n\n"
            "MOTIF. Centred on the pale field, ONE hourglass standing upright: TWO clear glass bulbs, the upper "
            "one wide and the lower one wide, meeting at a narrow waist, held between ONE flat plate at the top "
            "and ONE flat plate at the bottom which are joined by exactly THREE slender vertical columns "
            "arranged around the glass. The frame of the hourglass is dark antique bronze, clearly darker than "
            "the pale field so the shape reads instantly. The upper bulb holds pale luminous sand, ONE thin "
            "straight stream of it falls through the waist, and a small mound of it has gathered in the lower "
            "bulb. The sand glows a soft warm white gold and its light stays inside the glass. Nothing else: no "
            "wings on the hourglass, no chain, no stand, no scythe, no numbers and no second hourglass. The "
            "hourglass is about 44 percent of the shield width."
        ),
        light=light_spark(
            "the pale luminous sand inside the two glass bulbs and the thin stream falling between them, whose "
            "light stays trapped inside the glass."
        ),
    ),
    dict(
        n=7,
        key="club-sensei",
        name="Invocador del cristal",
        artifact="El cristal despierto",
        chroma=MAGENTA + ("gold and dark steel over a polished black obsidian field with a blazing cyan white crystal",),
        body=(
            "SUBJECT. A single collectible guild rank emblem where the ladder stops being armour and starts "
            "being power: the shield has grown its first pair of wings. Inside it, the crystal of the first "
            "rank at last cut free of the rock, set upright in gold, and burning.\n\n"
            + heater(
                "That shield is bordered by ONE heavy sculpted band. Above its top edge sits ONE simple pointed "
                "crest of a single blunt spire holding ONE faceted gem. Below its bottom point sits ONE small "
                "sculpted bracket. From the shield's sides grow TWO wings, described below. There is no crown, "
                "no laurel and no rays."
            )
            + "\n\n"
            "MATERIALS. The frame, the crest and the wings are gold over dark gunmetal steel: gold on every "
            "raised edge and bevel, dark steel in the flats, so the emblem reads as a dark heavy object with "
            "gold light running along all its edges. The field is polished black obsidian, a true deep black "
            "glass with a mirror surface and one faint sweep of reflection across it. The crest gem is a pale "
            "cyan sapphire.\n\n"
            "MOTIF. Centred on the black field, ONE large faceted crystal standing upright: a tall six sided "
            "prism, pointed at the top and pointed at the bottom, held at its waist by exactly TWO curved gold "
            "talons that rise from the lower part of the field. It is unmistakably the same crystal that was "
            "dull and buried in the lowest rank, now cut, polished and blazing: cyan white, translucent, with "
            "sharp internal facets and a white hot core, and it is the brightest thing in the whole image. "
            "Nothing else on the field: no runes, no chain, no second crystal, no altar and no rays. The "
            "crystal is about 34 percent of the emblem width."
        ),
        light=light_glow(
            "the cyan white crystal at the centre, blazing from its core. The black obsidian around it takes a "
            "cool cyan sheen, the two gold talons holding it glow along their inner edges, and the inner edge "
            "of the shield frame catches that same cyan light."
        ),
        wings=(
            "as long as half the shield is wide, the smallest pair on the ladder.",
            2,
            "The wing is bolted onto the shield by ONE small sculpted shoulder plate carrying exactly ONE round "
            "rivet, so the wings read as built into the frame rather than glued behind it.",
        ),
    ),
    dict(
        n=8,
        key="rare-edition-archivist",
        name="Centinela de esmeralda",
        artifact="El yelmo del custodio",
        chroma=MAGENTA + ("platinum with gold trim over a deep emerald green enamel field",),
        body=(
            "SUBJECT. A single collectible guild rank emblem: the same winged shield as the rank below with "
            "wider wings and finer metal. Inside it, the empty helm of the order that guards the crystal, worn "
            "by nobody and still standing watch.\n\n"
            + heater(
                "That shield is bordered by ONE heavy sculpted band with a fine gold inner line. Above its top "
                "edge sits ONE pointed crest of a single tall spire holding ONE round faceted gem. Below its "
                "bottom point sits ONE sculpted base of two small scrolled brackets. From the shield's sides "
                "grow TWO wings, described below. There is no crown, no laurel and no rays."
            )
            + "\n\n"
            "MATERIALS. The frame, the crest, the base and the wings are satin platinum, a pale neutral white "
            "metal, edged with a thin line of gold along every bevel, and every pale shape carries a distinctly "
            "darker underside beneath its highlight so the emblem stays a solid silhouette on a white "
            "background. The field is deep emerald green vitreous enamel, saturated and jewel like, glowing "
            "faintly from within as if lit from behind. The crest gem is a green emerald.\n\n"
            "MOTIF. Centred on the emerald field, ONE ceremonial guardian helm seen strictly from the front and "
            "perfectly symmetrical: a smooth rounded helm bowl, ONE narrow horizontal visor slit across it, ONE "
            "vertical nasal bar below the slit, and exactly TWO smooth curved horns sweeping up and outward "
            "from its temples, thick at the root and tapering to blunt tips. The helm is EMPTY armour: it has "
            "no eyes, no face, no mouth, no skin, no expression and no skull, and it must never read as a "
            "creature or a mask with a face. Behind the visor slit there is ONE thin bar of green white light. "
            "The helm is polished platinum with gold edging along its brow and its horns. Nothing else on the "
            "field: no body, no armour below the neck, no crossed weapons, no wreath and no second helm. The "
            "helm is about 42 percent of the emblem width."
        ),
        light=light_glow(
            "the bar of green white light burning behind the helm's visor slit, backed by the emerald field "
            "which glows softly from within. The platinum around the helm picks up a cool green sheen along its "
            "bevels."
        ),
        wings=(
            "as long as the shield is wide, clearly larger than the pair one rank below.",
            3,
            "The wing is bolted onto the shield by ONE broad sculpted shoulder plate carrying exactly TWO round "
            "rivets, so the wings read as built into the frame rather than glued behind it.",
        ),
    ),
    dict(
        n=9,
        key="collection-shisho",
        name="Gran maestro de la boveda",
        artifact="Las llaves del sagrario",
        chroma=MAGENTA + (
            "pale prismatic ice crystal over platinum with a deep glacier blue field, sapphires and ivory keys",
        ),
        body=(
            "SUBJECT. A single collectible guild rank emblem, the highest a mortal member of the order reaches. "
            "The crest has become a CROWN, the wings are the largest on the ladder, and the whole frame has "
            "crystallised. Inside it, the two keys that open the sanctum where the crystal is kept.\n\n"
            + heater(
                "Above the shield, replacing the simple crest, ONE small crown of exactly THREE broad pointed "
                "spires, the middle spire tallest, each spire thick and clearly separated from the next. Below "
                "the shield's bottom point, ONE sculpted base of two scrolled brackets and ONE hanging faceted "
                "pendant, so the emblem carries mass low as well as high. Exactly THREE faceted gems in total: "
                "one in the middle crown spire and one at each wing root. From the shield's sides grow TWO "
                "wings, described below. No laurel, no leaves and no rays."
            )
            + "\n\n"
            "MATERIALS. The frame, the crown and the wings are pale prismatic ice crystal grown over a platinum "
            "armature: translucent blue white crystal with internal fractures catching the light, faceted like "
            "cut glass, refracting into faint rainbow edges, mounted on satin platinum. Every pale shape "
            "carries a distinctly darker underside and a dark recess beneath its highlight, so the emblem reads "
            "as a solid silhouette against a white background and never dissolves into a pale haze. The field "
            "is DEEP glacier blue enamel, clearly and obviously darker than the crystal frame, with glassy "
            "depth, so the motif on it reads instantly at thumbnail size. The three gems are pale faceted "
            "sapphires.\n\n"
            "MOTIF. Centred on the deep blue field, exactly TWO large ceremonial keys crossed over each other "
            "in a wide X, their round ornate bows at the top left and the top right and their toothed wards at "
            "the bottom left and the bottom right, bound where they cross by ONE small square collar. Each key "
            "has a thick round bow, a straight fluted shaft and exactly TWO square teeth at its end, and along "
            "the middle of each shaft runs ONE narrow channel filled with ice white light. They are sculpted in "
            "warm ivory cream with pale crystal at their bows, so they stand clear of the blue field. Nothing "
            "else: no keyhole, no lock, no chain, no ring of keys and no third key. The crossed pair measures "
            "about 40 percent of the whole emblem width."
        ),
        light=light_glow(
            "the two narrow channels of ice white light running along the shafts of the crossed keys, and the "
            "cold light held inside the crystal frame itself, which glows faintly along its internal fractures."
        ),
        wings=(
            "the largest on the ladder, long and broad, its tip reaching the full width of the square footprint.",
            3,
            "The wing is bolted onto the shield by ONE broad sculpted shoulder plate carrying exactly TWO round "
            "rivets and a faceted gem, so the wings read as built into the frame rather than glued behind it.",
        ),
    ),
    dict(
        n=10,
        key="guild-legend",
        name="Leyenda viva, Rango S",
        artifact="El ave de eter",
        chroma=GREEN + ("royal amethyst violet over white gold, with a white hot crystal core",),
        body=(
            "SUBJECT. A single collectible guild rank emblem at the very top of the ladder, and it deliberately "
            "breaks everything the nine ranks below it obey. There is no shield, no plate, no enamel field and "
            "no motif set into a frame, because this emblem is not an object any more: it is ALIVE. The crystal "
            "that the lowest rank found asleep in a rock has grown a body. It is one heraldic firebird forged "
            "out of amethyst and white gold, carrying that same crystal, now white hot, at its breast.\n\n"
            "SHAPE. ONE phoenix seen strictly from the front and perfectly symmetrical, its wings spread wide "
            "and low to both sides so the whole creature fills a square footprint. Its body is one compact "
            "sculpted torso with broad shoulders, heavy enough to carry the wings. Its head is small and "
            "stylised but unmistakably the head of a bird, held straight up on a short neck, with a short "
            "straight beak and a crest of exactly THREE short blades rising from the back of the skull, with "
            "NO visible eyes and no face detail of any kind. Below the body, a tail of exactly THREE long straight blades fanning "
            "downward and slightly outward, the middle one the longest and ending in ONE faceted violet gem, so "
            "the creature carries as much mass below its centre as above it and its outline approaches a full "
            "circle rather than a V. Each tail blade is a broad solid plank of violet crystal, never a thin "
            "needle and never a spray of splinters. Set into the centre of its breast, ONE large faceted "
            "crystal, at least 26 percent of the emblem width, blazing white hot at its core: it is the brightest point of the whole "
            "image and the only light source in it. Nothing else: no shield, no enamel field, no laurel, no "
            "crown, no rays, no sparks, no flame tongues, no perch and no branch.\n\n"
            "MATERIALS. Every blade of the wings, the tail and the crest is royal amethyst violet: a deep "
            "saturated purple, glassy and vitreous like enamel poured over metal, each blade edged with one "
            "thin bright line of white gold along its bevel. The body is white gold with a satin brushed "
            "surface, sharp polished bevels and deep dark recesses, turning hot white violet wherever the "
            "crystal's light falls on it. Violet is the signature colour of this rank alone and it must "
            "dominate the image, so that even shrunk to a 32 pixel thumbnail the emblem reads as a violet mass "
            "with one white core. Every bright shape carries a distinctly darker underside beneath its "
            "highlight, so the emblem reads as a strong solid silhouette against a white background as well as "
            "a black one.\n\n"
            "MOTIF. There is no separate motif on this rank: the creature IS the motif. It must read as an "
            "original heraldic insignia bird, never as a cartoon animal, never as a cute mascot, never as a "
            "realistic ornithological bird and never as any existing character from any franchise."
        ),
        light=light_aura(
            "the huge faceted crystal set in its breast burns white hot and violet at its edges."
        ),
        wings=(
            "as long as the creature's whole body and as deep from front edge to trailing edge as the body is "
            "tall, spread out to both sides. It is a BROAD heavy slab, never a spray of thin splinters and "
            "never a fan of separate needles.",
            3,
            "The wings grow straight out of the shoulders of the body as one continuous forged piece, with no "
            "visible joint, no bolt and no separate root plate.",
        ),
    ),
]


def build(rank):
    parts = [
        f'Use your image generation tool to create ONE image and save it in the current directory as '
        f'exactly "{rank["key"]}.png".',
        key_block(*rank["chroma"]),
        rank["body"],
    ]
    if "wings" in rank:
        parts.append(wings(*rank["wings"]))
    parts.append(rank.get("light", light_none()))
    parts += [STYLE, COMPOSITION, BANS, CANVAS]
    return "\n\n".join(parts) + "\n"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for rank in RANKS:
        path = os.path.join(OUT, f"rank-{rank['n']:02d}-{rank['key']}.txt")
        text = build(rank)
        assert "—" not in text, path
        with open(path, "w") as fh:
            fh.write(text)
        print(f"{os.path.basename(path):34s} {len(text):5d} chars")

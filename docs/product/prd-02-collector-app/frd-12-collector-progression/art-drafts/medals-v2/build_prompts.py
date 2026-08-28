#!/usr/bin/env python3
"""Prompt generator for medal art v2 (the RPG relanguage of FRD-12's album).

One spine, shared verbatim by every medal, plus a per-medal body. A style fix lands on all of
them instead of being hand copied into thirty text files. Never edit a generated prompt file
directly: edit this script and re-run it.

    python3 art-drafts/medals-v2/build_prompts.py

Writes art-drafts/medals-v2/prompts/<medalKey>.txt, one file per medal.
"""

from pathlib import Path

OUT = Path(__file__).resolve().parent / "prompts"

# ---------------------------------------------------------------------------------------------
# The series ladder: plate shape and enamel field colour. Shape is inherited from the shipped
# album (medal-art-guide.md section 0) and only the field colour is new.
# ---------------------------------------------------------------------------------------------

SERIES = {
    "first-steps": dict(
        shape="a perfect CIRCLE, a struck coin seen dead on",
        field="warm honey amber enamel, glassy and deep",
        key="MAGENTA",
    ),
    "the-wait": dict(
        shape="a DIAMOND, a square standing on one of its corners, its four edges perfectly straight",
        field="deep royal indigo enamel, glassy and deep, the colour of a night sea",
        key="GREEN",
    ),
    "the-display-case": dict(
        shape="a regular PENTAGON standing on its flat bottom edge with a single point at the top",
        field="deep wine burgundy enamel, glassy and deep, the colour of a cabinet's velvet lining",
        key="GREEN",
    ),
    "explorer": dict(
        shape="a SHORT AND WIDE heraldic shield, clearly wider than it is tall, with a flat top edge "
        "and a shallow rounded point at the bottom, never a tall pointed shield and never a heart shape",
        field="deep jade green enamel, glassy and deep",
        key="MAGENTA",
    ),
    "chronicler": dict(
        shape="a regular HEXAGON with a flat top edge and a flat bottom edge",
        field="warm sepia bronze brown enamel, glassy and deep, the colour of old parchment held to a lamp",
        key="MAGENTA",
    ),
    "secrets": dict(
        shape="a five pointed STAR with short, thick, blunt points, never thin spikes",
        field="polished black obsidian, glassy and deep, almost no colour in it at all",
        key="MAGENTA",
    ),
}

# ---------------------------------------------------------------------------------------------
# The rarity ladder. This is the round's central invention: rarity stops being a DRAWING STYLE
# and becomes the MATERIAL of the frame, the count of pieces on it, and the amount of light in
# the plate. Three channels, all of which survive greyscale and 32 px.
# ---------------------------------------------------------------------------------------------

RARITY = {
    "normal": dict(
        metal="BLACKENED IRON with a warm grey cast: matte, with visible casting grain and a little "
        "soot darkening every recess. It is the humblest metal in the album and it is not shiny",
        rim="ONE single plain bevelled band running all the way around the plate, with a fine milled "
        "(reeded) texture cut into its outermost edge like the edge of a struck coin. No studs, no "
        "rivets, no second band, no gem, nothing set into it anywhere",
        light="LIGHT. There is NO emitted light in this medal at all. Every bright pixel on it is the key "
        "light falling on metal, enamel or stone. Nothing glows, nothing is lit from within.",
    ),
    "first-print": dict(
        metal="POLISHED BRASS AND RED COPPER: warm, yellow gold in the highlights, coppery in the "
        "midtones, with a little verdigris in the deepest recesses",
        rim="ONE single bevelled band running all the way around the plate, with a fine milled (reeded) "
        "texture cut into its outermost edge like the edge of a struck coin, and EXACTLY FOUR round "
        "domed rivets set into that band, evenly spaced around it. Exactly four, no more and no fewer. "
        "No second band, no gem",
        light="LIGHT. There is NO emitted light in this medal at all. Every bright pixel on it is the key "
        "light falling on metal, enamel or stone. Nothing glows, nothing is lit from within.",
    ),
    "limited": dict(
        metal="SATIN SILVER STEEL: cool, brushed, with a fine directional grain and crisp bright "
        "specular edges. Clearly a more precious and more finely finished metal than brass",
        rim="TWO concentric bands, an outer one and an inner one, separated by a clearly visible dark "
        "recessed seam so that at a glance the frame plainly reads as DOUBLE. The outermost edge carries "
        "the same fine milled (reeded) coin texture. No rivets, no gem",
        light="LIGHT. ONE small spark of light, and only one: a single contained point of cool white light "
        "on the motif itself. It is small. It does not spread, it does not haze, and it never crosses the "
        "outer contour of the plate.",
    ),
    "holo": dict(
        metal="PALE SILVER under a PRISMATIC CRYSTAL GLAZE: the frame is cut from a clear faceted mineral "
        "laid over pale metal, and an iridescent sheen of cyan, rose and pale gold slides across it as if "
        "it were a rare foil card. Never a flat rainbow stripe: an iridescence that follows the facets",
        rim="ONE band running all the way around the plate, cut into EXACTLY EIGHT flat crystal FACETS so "
        "the frame catches the light in eight separate planes. The outermost edge carries the same fine "
        "milled (reeded) coin texture. No rivets, no gem",
        light="LIGHT. A CLEAR GLOW: the motif is lit from within with a cool white light strong enough to "
        "spill onto the enamel and onto the inner face of the frame around it, and the prismatic frame "
        "catches that light in its facets. The glow may light the medal's own surfaces and it may NEVER "
        "leave the outer contour of the plate. No bloom, no haze, no rays, no fog, no halo outside the plate.",
    ),
    "signed": dict(
        metal="WARM ANTIQUE GOLD, polished to a deep buttery shine, with darker antiqued gold sunk into "
        "every recess. It is unmistakably the richest metal in the album",
        rim="TWO concentric bands, an outer one and an inner one, separated by a clearly visible dark "
        "recessed seam, with the outermost edge carrying the same fine milled (reeded) coin texture, plus "
        "ONE single raised setting on the TOP edge of the frame holding ONE amber topaz cabochon. That "
        "cabochon sits INSIDE the plate's own outline and never sticks out past it. Exactly one gem, "
        "nowhere else on the medal",
        light="LIGHT. A FULL AURA, and it is contained: the motif is lit from within, that light spills "
        "across the enamel and the gold, and ONE thin clean line of warm light traces the whole outer edge "
        "of the plate. The light may light the medal's own surfaces and it may NEVER leave the outer "
        "contour. No bloom, no haze, no rays, no fog, no glow cloud outside the plate.",
    ),
}

# ---------------------------------------------------------------------------------------------
# The shared spine.
# ---------------------------------------------------------------------------------------------

STYLE = """STYLE. Render it as a semi-realistic painted game asset in the visual language of Japanese role-playing
game equipment icons and collectible insignia (the polished fantasy emblem look of Final Fantasy, Granblue
Fantasy and Octopath Traveler). It must read as a real physical object that was struck, cast and then enamelled
by hand: believable materials with visible surface character, real volume with bevelled edges and chamfers,
ambient occlusion darkening every recess and every undercut, one dramatic warm key light from the upper left, a
cool rim light grazing the lower right edge, crisp specular glints along the raised edges, and soft self
shadowing where one part overlaps another. The palette is noble and slightly muted, rich and deep rather than
neon. Separation between two materials comes from value, from the bevel and from a thin dark seam where they
meet, NOT from a drawn outline. DO NOT draw any of the following: flat vector art, sticker art, a thick black
cartoon keyline around the shapes, cel shading, hard-edged comic book flat colour, comic speed lines, an impact
starburst behind the subject, pixel art, screentone dots, manga ink hatching, glossy plastic toy shine, a
western cartoon or Saturday morning cartoon look, an esports mascot logo, clip art, a chibi mascot."""

COMPOSITION = """COMPOSITION. The plate is centered, upright, front facing and bilaterally symmetrical, with no rotation
and no three quarter perspective: you are looking at it straight on, the way you look at a coin lying face up.
It fills a SQUARE footprint, its full width and its full height each about 88 percent of the canvas, and EVERY
point of its outline stays inside a centered circle at 85 percent of the canvas diameter, because the
application displays every medal through a circular crop. The motif is the biggest recognizable shape inside
the plate and takes up between 45 and 55 percent of the plate's width. All four corners of the canvas are empty
and transparent."""

FAMILY = """ONE SOLID PLATE. The medal is ONE single closed silhouette. If you traced its outline you would draw one
single continuous closed line, and there is no gap, no slot, no notch and no background visible anywhere inside
it. It has no wings, no laurel branches, no crown, no spires, no ribbon, no chain, no foot and no hanging
pendant: nothing at all sticks out of the geometric plate. This is what separates a medal from a rank emblem in
this product, and it is not negotiable."""

NEVER = """NEVER INCLUDE. No text, no numbers, no letters, no roman numerals, no watermark, no signature and no logo.
No ribbon, no banderole, no scroll banner and no name plate. No sparks, no embers, no floating fragments, no
scattered small pieces, no smoke and no separate flame tongues. No second concentric ring, halo ring, circular
frame or plate drawn around the OUTSIDE of the medal: the application paints a coloured rarity ring around the
artwork itself and a drawn one would collide with it. No animal, no bird, no creature and no character of any
kind, and no face, no eyes and no hands. No existing character, franchise, trademark or copyrighted material of
any kind: an original generic design only. No background scenery and no cast shadow on the ground."""

OUTPUT = """OUTPUT. One PNG image, 1024 by 1024 pixels, RGBA, with a real alpha channel."""


def transparency(key: str) -> str:
    return f"""TRANSPARENCY. Render the medal on a flat, uniform, fully saturated pure {key} background, then remove that
background so the file ships with a real alpha channel. Remove it with an edge connected flood fill starting from
the four canvas borders, never with a global colour match, so that no pixel INSIDE the artwork is ever deleted.
Nothing in the medal itself may be anywhere near pure {key}. The finished PNG has no canvas colour, no scene, no
drop shadow and no cast shadow on the ground; self shadowing on the object itself is wanted."""


def build(medal: dict) -> str:
    s = SERIES[medal["series"]]
    r = RARITY[medal["rarity"]]
    return "\n\n".join(
        [
            f'Use your image generation tool to create ONE image and save it in the current directory as '
            f'exactly "{medal["key"]}.png".',
            transparency(s["key"]),
            f"SUBJECT. ONE single collectible medal: a struck, enamelled metal plate, and nothing else.",
            f"PLATE. The plate is cut into {s['shape']}. Its face is filled edge to edge with {s['field']}. "
            f"That enamel field is completely SMOOTH and PLAIN: it may have glassy depth, a soft reflection and a "
            f"slight value shift, but it carries no pattern, no sunburst, no radiating stripes, no carved "
            f"scrollwork and no filigree of any kind.",
            f"FRAME. The raised rim around the plate is made of {r['metal']}. {r['rim']}.",
            f"MOTIF. {medal['motif']} It is rendered in cream ivory and pale stone with only small accents of "
            f"the frame's own metal, never in the frame's metal as its body, so it separates cleanly from the "
            f"enamel behind it. It sits raised off the field with its own bevel and its own drop of ambient "
            f"occlusion under it.",
            r["light"],
            FAMILY,
            STYLE,
            COMPOSITION,
            NEVER,
            OUTPUT,
        ]
    )


# ---------------------------------------------------------------------------------------------
# The twenty-eight medals.
# ---------------------------------------------------------------------------------------------

MEDALS = [
    # --- Primeros pasos, circle, honey amber ---------------------------------------------------
    dict(key="first-order", series="first-steps", rarity="normal",
         motif="A sturdy wooden shipping crate seen from the front, its lid tipped open and leaning back, "
               "packing straw just visible over the rim, one plain iron band across its front."),
    dict(key="first-payment", series="first-steps", rarity="normal",
         motif="A drawstring leather coin pouch, plump and cinched shut at the neck, standing upright, with "
               "ONE single struck coin leaning against its base."),
    dict(key="first-arrival", series="first-steps", rarity="normal",
         motif="A parcel bound in cord with the cord cut and fallen open, its wrapping peeled back at the top "
               "corners to show one plain object inside."),
    dict(key="first-order-closed", series="first-steps", rarity="first-print",
         motif="A round wax seal, freshly struck and still domed, pressed over the join of a folded packet, "
               "with a plain incised ring around its edge and no writing or emblem inside it."),
    dict(key="first-review", series="first-steps", rarity="normal",
         motif="A squat inkpot with a single quill standing upright in it, and ONE small five pointed star "
               "struck into the shoulder of the pot."),
    dict(key="first-photo-order", series="first-steps", rarity="normal",
         motif="A boxy folding plate camera standing on its own base, its lens a small polished disc, with ONE "
               "rectangular plate sliding out of its side that is turning into a filing card."),
    dict(key="first-store", series="first-steps", rarity="normal",
         motif="A shop's arched doorway seen straight on, its double doors standing open, a plain awning above "
               "it and a single worn step below it."),
    dict(key="first-preorder", series="first-steps", rarity="normal",
         motif="A flat brass claim tag hanging from a short hook, with a punched hole at its top and a plain "
               "incised line across its middle, and no writing on it at all."),

    # --- La espera, diamond, deep indigo -------------------------------------------------------
    dict(key="patience-60", series="the-wait", rarity="first-print",
         motif="A heavy ship's anchor standing upright, point down, resting on a neat coil of rope."),
    dict(key="patience-120", series="the-wait", rarity="limited",
         motif="A waning crescent moon hanging above THREE carved wave crests, the waves stacked as three "
               "solid curling shapes and never as loose spray."),
    dict(key="patience-200", series="the-wait", rarity="holo",
         motif="A tall lighthouse tower standing on a small rock, its lamp room lit at the top, with three "
               "plain horizontal bands around the tower."),
    dict(key="split-arrival", series="the-wait", rarity="first-print",
         motif="ONE parcel cleanly cleft into two halves, the two halves standing slightly apart and held "
               "together by three links of a short chain running between them."),

    # --- La vitrina, pentagon, wine burgundy ---------------------------------------------------
    dict(key="collection-10", series="the-display-case", rarity="normal",
         motif="ONE stone shelf slab with THREE small carved figurines standing on it in a row, each a "
               "different simple silhouette."),
    dict(key="collection-50", series="the-display-case", rarity="first-print",
         motif="A two tier wooden cabinet with its glass doors standing open, both tiers packed with small "
               "boxes and small standing forms, never a single free standing crystal."),
    dict(key="collection-150", series="the-display-case", rarity="holo",
         motif="A three tier stepped display plinth, every step lined with small standing forms, with ONE "
               "larger figure crowning the top step."),
    dict(key="arrivals-25", series="the-display-case", rarity="limited",
         motif="A courier's leather satchel, its flap thrown open, with ONE round struck postmark disc set "
               "into the flap and the corner of one parcel showing inside."),

    # --- Explorador, short wide shield, jade ---------------------------------------------------
    dict(key="variety-3", series="explorer", rarity="normal",
         motif="THREE different small artefacts standing side by side on one stone step: a flat sealed card "
               "case, a small stuffed charm, and a carved cubic die."),
    dict(key="countries-3", series="explorer", rarity="first-print",
         motif="A small stone sphere held inside THREE brass armillary rings, the rings crossing over it like "
               "an explorer's globe, standing on a short base."),
    dict(key="variety-6", series="explorer", rarity="limited",
         motif="A six sided standing lantern with a small ring handle on top, each of its SIX panes etched "
               "with a different small collectible silhouette."),
    dict(key="stores-10", series="explorer", rarity="holo",
         motif="A folded paper map spread open, its creases visible, with EXACTLY FIVE pin markers stuck "
               "across it, each pin a small round headed nail."),

    # --- Cronista, hexagon, sepia --------------------------------------------------------------
    dict(key="clean-record-1", series="chronicler", rarity="normal",
         motif="A rectangular stone tally tablet standing upright, with four neat incised rows of plain tick "
               "marks cut into it, and one bronze stylus lying across its foot."),
    dict(key="store-charted-1", series="chronicler", rarity="first-print",
         motif="A stone waymarker obelisk driven into a small mound, with one plain brass plate set into its "
               "front face and no writing on that plate."),
    dict(key="reviews-5", series="chronicler", rarity="limited",
         motif="A bronze hand bell standing mouth down, with EXACTLY FIVE small five pointed stars struck "
               "evenly around the flare of its rim."),
    dict(key="clean-record-10", series="chronicler", rarity="holo",
         motif="A bronze rack holding FIVE capped scroll cases standing upright side by side, each case a "
               "plain cylinder with a domed cap."),

    # --- Secretas, star, obsidian --------------------------------------------------------------
    dict(key="midnight-order", series="secrets", rarity="first-print",
         motif="A waning crescent moon with a single tall candle burnt down to a stub standing in its cradle, "
               "carrying ONE solid teardrop shaped flame and no separate flame tongues."),
    dict(key="swift-arrival", series="secrets", rarity="limited",
         motif="ONE solid struck lightning bolt, a single thick zigzag ingot pointing downward, with a plain "
               "collar band around its upper end."),
    dict(key="same-day-settle", series="secrets", rarity="holo",
         motif="A balance scale with a straight beam and two shallow pans hanging perfectly level, both pans "
               "empty, standing on a short pillar."),
    dict(key="year-streak", series="secrets", rarity="signed",
         motif="A young tree with one straight trunk and ONE single solid rounded canopy, growing out of a "
               "cracked stone plinth, with one plain bronze band around its trunk."),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for medal in MEDALS:
        (OUT / f"{medal['key']}.txt").write_text(build(medal) + "\n", encoding="utf-8")
    print(f"wrote {len(MEDALS)} prompts into {OUT}")


if __name__ == "__main__":
    main()

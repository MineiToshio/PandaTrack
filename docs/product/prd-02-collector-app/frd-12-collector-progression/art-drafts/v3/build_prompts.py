"""Builds the ten v3 rank prompts from one shared spine plus a per-rank block.

The spine is written once here so a style fix lands on all ten at the same time instead of
being hand-copied into ten text files. Section 3 of `rank-art-guide.md` quotes this file.
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "prompts")

# The style spine. This is the whole v3 change: a rendered, semi-realistic JRPG object
# instead of the flat cel-shaded badge of v2 that the owner read as an American cartoon.
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
    "NEVER INCLUDE. No text, no numbers, no letters, no watermark, no signature and no logo. No ribbon, no "
    "banderole, no scroll and no name plate: the rank name is drawn by the application beside the emblem. No "
    "sparks, no embers, no floating fragments, no scattered small pieces, no smoke and no separate flame "
    "tongues. No second concentric ring, halo ring, circular frame or plate drawn around the outside of the "
    "emblem. No existing character, franchise, trademark or copyrighted material of any kind: an original "
    "generic design only. No background scenery and no cast shadow on the ground."
)

CANVAS = (
    "OUTPUT. Square canvas, 1024 by 1024 pixels, PNG with a real transparent alpha channel, no background "
    "colour behind the emblem."
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


RANKS = [
    dict(
        n=1,
        key="kohai",
        name="Kohai",
        chroma=("BRIGHT MAGENTA", "#FF00FF", "aged brown bronze with a deep teal enamel field and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank medallion: a plain struck circular disc and nothing else. "
            "This is deliberately the humblest and plainest emblem of the whole ladder.\n\n"
            "SHAPE. The outer contour of the whole image is one perfect simple circle. One thick heavy sculpted "
            "circular rim occupying about one fifth of the disc diameter, with a chamfered outer edge and a "
            "stepped inner edge, encloses a single field that fills the rest of the disc. The rim is one "
            "continuous unbroken band: no rivets, no gems, no leaves, no laurel, no wings, no crest, no points "
            "and no ornament of any kind attached to it.\n\n"
            "MATERIALS. The metal is old cast bronze, a muted desaturated reddish brown, clearly brown and NOT "
            "gold, with no yellow tones and no golden shine: a weathered surface with visible casting grain, "
            "fine scratches, small nicks on the edge and dark green verdigris patina settled into every recess, "
            "the raised edges rubbed slightly brighter where a thumb would touch them. The field is deep teal "
            "vitreous enamel with real glassy depth, darker at the outer edge and slightly lighter in the "
            "centre, with a faint reflection sliding across it.\n\n"
            "MOTIF. Centred on the enamel field, one bold heraldic key standing upright, with a round bow, a "
            "straight shaft and a single square tooth, sculpted in low relief and finished in warm ivory cream, "
            "never in the rim's own bronze, measuring about 45 percent of the whole disc width so it stays "
            "readable at thumbnail size, with a soft cast shadow of the key falling onto the enamel just below "
            "and to the right of it."
        ),
    ),
    dict(
        n=2,
        key="preorder-hunter",
        name="Cazador de preventas",
        chroma=("BRIGHT MAGENTA", "#FF00FF", "brown bronze and dark iron with a deep teal enamel field and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank medallion: the same plain circular disc as the first rank, "
            "now mounted inside a second outer band, so the disc has gained a frame.\n\n"
            "SHAPE. The outer contour of the whole image is still one perfect simple circle. From the outside "
            "in: one broad flat outer band of dark iron carrying exactly FOUR large round dome headed rivets, "
            "one at the top, one at the bottom, one on each side, each rivet about 8 percent of the emblem "
            "diameter so it stays visible at thumbnail size and each separated from the next by a long empty "
            "stretch of plain band; then a narrow sculpted bronze rim; then the enamel field. Nothing else is "
            "attached: no leaves, no laurel, no wings, no crest and no points.\n\n"
            "MATERIALS. The outer band is dark blackened iron with a hammered surface. The inner rim is cast "
            "bronze, cleaned and lightly polished so it catches the light more than the first rank did, still "
            "clearly brown and NOT gold, with patina remaining only in the recesses. The field is deep teal "
            "vitreous enamel with glassy depth.\n\n"
            "MOTIF. Centred on the enamel field, one bold heraldic admission ticket seen straight on: an upright "
            "rectangle with a zigzag perforated tear running along its bottom edge and one round punched hole "
            "near its top, pierced through its centre by ONE slim straight arrow running from the lower left to "
            "the upper right, the arrowhead a single solid triangle and the fletching two simple vanes. The whole "
            "motif is sculpted in low relief and finished in warm ivory cream, never in the rim's own metal, and "
            "measures about 45 percent of the whole disc width so it stays readable at thumbnail size. The face of "
            "the ticket is plain: no writing, no numbers and no pattern on it."
        ),
    ),
    dict(
        n=3,
        key="volume-keeper",
        name="Guardian del tomo",
        chroma=("BRIGHT MAGENTA", "#FF00FF", "polished copper bronze with a deep teal enamel field and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank plate. The circle finally breaks: the disc has been cut "
            "into a faceted octagonal plate.\n\n"
            "SHAPE. The outer contour of the whole image is a regular OCTAGON with eight equal straight edges "
            "and slightly softened corners, flat side up. A thick sculpted octagonal rim occupying about one "
            "fifth of the plate width, each of its eight facets catching the light at a different angle, "
            "encloses a single field that fills the rest of the plate. Exactly TWO large round dome headed "
            "rivets sit on the rim, one on the lower left facet and one on the lower right facet, each about 8 "
            "percent of the emblem width. Nothing else is attached: no leaves, no laurel, no wings, no crest and "
            "no points.\n\n"
            "MATERIALS. The metal is polished copper bronze, a warm reddish brown with bright hard specular "
            "highlights running along every facet edge and darker patina still sitting in the recesses, clearly "
            "brown and NOT yellow gold. The field is deep teal vitreous enamel with glassy depth.\n\n"
            "MOTIF. Centred on the enamel field, exactly THREE thick upright book spines standing side by side "
            "in a row, the middle one slightly taller, one short ribbon bookmark hanging from the middle spine, "
            "sculpted in low relief and finished in warm ivory cream, never in the rim's own metal, measuring "
            "about 45 percent of the whole plate width so it stays readable at thumbnail size."
        ),
    ),
    dict(
        n=4,
        key="guild-senpai",
        name="Senpai del gremio",
        chroma=("BRIGHT GREEN", "#00FF00", "gunmetal steel and silver with a deep crimson enamel field and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank badge. This rank is a deliberate jump: the plate becomes a "
            "SHIELD and the metal stops being brown.\n\n"
            "SHAPE. The outer contour of the whole image is a BROAD ROUND SHOULDERED shield, drawn as wide as "
            "it is tall: its top edge is one wide shallow arc, its shoulders are generously wide and fully "
            "rounded, its sides bulge outward at the middle and only then taper to a short blunt point at the "
            "bottom, so the whole silhouette is close to a circle that has been pulled to a point at its base "
            "and it fills its square footprint corner to corner. Directly below that bottom point sits one "
            "small sculpted foot made of two short scrolled brackets, so the emblem carries mass low as well as "
            "high. A thick sculpted bevelled border, about one sixth of the shield width, runs all the way "
            "around and encloses a single field. Exactly THREE large round dome headed rivets are set into the "
            "border, one at each upper shoulder and one just above the bottom point. Nothing else is attached: "
            "no leaves, no laurel, no wings, no crest and no points.\n\n"
            "MATERIALS. The border is blued gunmetal steel with a brushed grain, small dents and hammer marks, "
            "and a bright polished silver bevel along its inner and outer edges, cool grey with cold white "
            "highlights and absolutely no brown and no gold. The field is deep crimson red vitreous enamel with "
            "glassy depth.\n\n"
            "MOTIF. Centred on the enamel field, one hanging paper lantern: an upright rounded oval body with "
            "exactly two horizontal ribs across it, a small cap on top and a short hanging loop above that, "
            "sculpted in low relief and finished in warm ivory cream, never in the border's own metal, measuring "
            "about 42 percent of the whole shield width so it stays readable at thumbnail size."
        ),
    ),
    dict(
        n=5,
        key="first-print-hunter",
        name="Cazador de primera edicion",
        chroma=("BRIGHT GREEN", "#00FF00", "polished silver with a deep crimson enamel field, one red gem and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank badge: the same shield as the previous rank, which has now "
            "grown a crest.\n\n"
            "SHAPE. A heater shield with two rounded upper shoulders, tapering sides and one point at the "
            "bottom, and rising directly above its flat top edge, ONE single pointed crest: a broad triangular "
            "sculpted peak, wide at its base where it merges into the shield and coming to one clean point, "
            "about one quarter of the shield height, with a faceted gem set into its centre. A thick sculpted "
            "bevelled border runs around the shield. Exactly TWO large round dome headed rivets are set into the "
            "border, one at each upper shoulder. Nothing else is attached: no leaves, no laurel and no wings.\n\n"
            "MATERIALS. The metal is polished silver, cool grey with cold white specular highlights, a brushed "
            "grain on the flat areas, fine scratches and darkened recesses, with absolutely no brown and no "
            "gold. The field is deep crimson red vitreous enamel with glassy depth. The single gem in the crest "
            "is a faceted deep red stone with bright internal facets, at least 10 percent of the emblem width so "
            "it survives downscaling.\n\n"
            "MOTIF. Centred on the enamel field, one round magnifying lens held over a single upright collector "
            "card whose top corner is lifted slightly away from the surface, drawn as a clean circle overlapping "
            "a clean rectangle, sculpted in low relief and finished in warm ivory cream, never in the border's "
            "own metal, measuring about 42 percent of the whole shield width. The card is completely blank and "
            "plain: no fingerprint, no ridges, no swirl pattern, no ink and no stain anywhere in the image."
        ),
    ),
    dict(
        n=6,
        key="limited-run-curator",
        name="Curador de tirada limitada",
        chroma=("BRIGHT MAGENTA", "#FF00FF", "warm gold with a deep royal blue enamel field and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank crest: the crested shield of the previous rank, now framed "
            "by two laurel branches, and the metal has become gold.\n\n"
            "SHAPE. A heater shield with two rounded upper shoulders, tapering sides and one point at the "
            "bottom, with ONE broad triangular sculpted crest peak rising above its flat top edge and a faceted "
            "gem set into that peak. Flanking the shield, exactly TWO laurel branches, one on each side, curving "
            "from a small boss below the shield's point up to the level of its shoulders. Each branch carries NO "
            "MORE THAN FIVE separate leaf shapes, every leaf large, broad and thick, with a clearly visible "
            "empty transparent gap between each leaf and the next and between the branches and the shield, so "
            "the frame never fuses into a solid mass when the image is shrunk. There are absolutely no wings, no "
            "feathers and no rays.\n\n"
            "MATERIALS. The metal is rich warm gold with a brushed grain on the flat faces, bright specular "
            "glints along every bevel, small nicks on the leaf edges and deep shadow in the recesses: warm and "
            "noble, not a flat yellow. The field is deep royal blue vitreous enamel with glassy depth. The "
            "single gem in the crest peak is a faceted deep green emerald, at least 10 percent of the emblem "
            "width.\n\n"
            "MOTIF. The enamel field is completely smooth and plain: no scrollwork, no filigree, no carved "
            "flourishes and no ornament of any kind on it. Centred on that field, one glass dome cloche "
            "standing on a low round base, and inside the dome ONE small collectible toy figure, drawn as a "
            "plain rounded featureless object with a round head and a simple rounded body, with NO face, NO "
            "hair, NO clothing, NO dress and NO human detail whatsoever: it must read as a toy, never as a "
            "person or a character. The whole motif is sculpted in low relief and finished in warm ivory cream, "
            "never in gold, and measures about 40 percent of the whole emblem width."
        ),
    ),
    dict(
        n=7,
        key="club-sensei",
        name="Sensei del club",
        chroma=("BRIGHT MAGENTA", "#FF00FF", "gold and steel grey with a deep royal blue enamel field and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank crest. This rank is a deliberate jump: WINGS appear for "
            "the first time on the whole ladder, and they are small.\n\n"
            "SHAPE. A crested heater shield exactly like the previous rank, and behind it, spreading from just "
            "below its shoulders, exactly TWO SMALL metal wings in the style of a military aviation pilot "
            "insignia: each wing is a short horizontal fan of NO MORE THAN THREE long straight tapering feather "
            "blades arranged in one stepped row, blade edges parallel and crisp, with a clearly visible empty "
            "transparent gap between each blade and the next. The wingtips reach only a little past the "
            "shield's sides, so the whole emblem stays inside a square footprint. Below the shield's point, one "
            "small sculpted foot with a faceted gem, to give the emblem weight at the bottom. Exactly THREE "
            "faceted gems in total on the whole emblem: one in the crest peak, one at each wing root. There are "
            "no laurel branches on this rank, no leaves and no rays.\n\n"
            "MATERIALS. The shield and crest are rich warm gold with a brushed grain, bright specular glints "
            "and deep shadow in the recesses. The wing blades are cold steel grey with a polished top surface "
            "and a darker underside, so they separate from the gold by value alone. The field is deep royal blue "
            "vitreous enamel with glassy depth. The three gems are faceted deep green emeralds, each at least 8 "
            "percent of the emblem width.\n\n"
            "MOTIF. Centred on the enamel field, one open folding fan: a wide half circle wedge with exactly "
            "four visible ribs and a short handle at the bottom, sculpted in low relief and finished in warm "
            "ivory cream, never in gold, measuring about 40 percent of the whole emblem width."
        ),
    ),
    dict(
        n=8,
        key="rare-edition-archivist",
        name="Archivista de edicion rara",
        chroma=("BRIGHT MAGENTA", "#FF00FF", "white platinum with gold accents, a deep indigo enamel field, one green gem and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank emblem: the winged crested shield, one step larger and one "
            "material more precious, with one big showpiece gem.\n\n"
            "SHAPE. A crested heater shield carried by exactly TWO MEDIUM metal wings in the style of a military "
            "aviation pilot insignia: each wing is a horizontal fan of NO MORE THAN FOUR long straight tapering "
            "feather blades arranged in one stepped row, blade edges parallel and crisp, with a clearly visible "
            "empty transparent gap between each blade and the next, and the wings sweeping slightly upward so "
            "the emblem stays inside a square footprint. Set into the crest peak above the shield, ONE large "
            "round polished cabochon gem, at least 14 percent of the emblem width, the single showpiece of the "
            "design. Below the shield's point, a sculpted base of two short scrolled brackets so the emblem "
            "carries as much mass low as it does high. No laurel, no leaves, no rays and no gems anywhere except "
            "the one in the crest.\n\n"
            "MATERIALS. The frame is white platinum, a pale cool silver white with a satin brushed surface, "
            "crisp polished bevels and warm gold inlay lines running along the wing roots and the shield "
            "border. Every pale shape carries a darker underside and a clearly darker recess beneath its "
            "highlight, so the emblem still reads as a strong solid silhouette against a white background and "
            "never dissolves into a pale haze. The field is deep indigo vitreous enamel with glassy depth. The "
            "cabochon is a deep polished green stone with a single sharp specular highlight and a soft glow "
            "inside it.\n\n"
            "MOTIF. Centred on the enamel field, one vault drawer half pulled open in three quarter relief with "
            "a single card rising out of it, sculpted in low relief and finished in warm ivory cream, never in "
            "platinum, measuring about 34 percent of the whole emblem width."
        ),
    ),
    dict(
        n=9,
        key="collection-shisho",
        name="Shisho de la coleccion",
        chroma=("BRIGHT MAGENTA", "#FF00FF", "pale ice crystal over platinum with an ice blue field and an ivory motif"),
        body=(
            "SUBJECT. A single collectible guild rank emblem. The crest peak becomes a CROWN and the wings grow "
            "large, and the whole frame has crystallised.\n\n"
            "SHAPE. A heater shield carried by exactly TWO LARGE metal wings in the style of a military aviation "
            "pilot insignia: each wing is a long horizontal fan of NO MORE THAN FOUR long straight tapering "
            "feather blades in one stepped row, blade edges parallel and crisp, with a clearly visible empty "
            "transparent gap between each blade and the next, the wings sweeping upward and outward but still "
            "inside a square footprint. Above the shield, replacing the simple crest peak, ONE small crown of "
            "exactly THREE broad pointed spires, the middle spire tallest, each spire thick and clearly "
            "separated from the next. Below the shield's point, a sculpted base of two scrolled brackets and one "
            "hanging faceted pendant, so the emblem carries mass low as well as high. Exactly THREE faceted gems "
            "in total: one in the middle crown spire and one at each wing root. No laurel, no leaves and no "
            "rays.\n\n"
            "MATERIALS. The frame is pale prismatic ice crystal grown over a platinum armature: translucent "
            "blue white crystal with internal fractures catching the light, faceted like cut glass, refracting "
            "into faint rainbow edges, mounted on satin platinum. Every pale shape carries a distinctly darker "
            "underside and a dark recess beneath its highlight, so the emblem reads as a solid silhouette "
            "against a white background and never dissolves into a pale haze. The field is a deep ice blue "
            "enamel, clearly darker than the crystal frame, with glassy depth. The three gems are pale faceted "
            "sapphires.\n\n"
            "MOTIF. Centred on the enamel field, one balance scale in perfect equilibrium: an upright central "
            "post, one straight horizontal beam, and one shallow pan hanging from each end with a single card "
            "resting flat on each pan, sculpted in low relief and finished in warm ivory cream, never in "
            "crystal, measuring about 34 percent of the whole emblem width."
        ),
    ),
    dict(
        n=10,
        key="guild-legend",
        name="Leyenda del gremio, Rango S",
        chroma=("BRIGHT GREEN", "#00FF00", "royal amethyst violet and white gold with a white hot core"),
        body=(
            "SUBJECT. A single collectible guild rank emblem at the very top of the ladder. It deliberately "
            "breaks the pattern of every rank below it: the shield is gone, the wings have become the subject, "
            "and the emblem is a crowned winged star that looks like a legendary reward item.\n\n"
            "SHAPE. At the centre, ONE large faceted gemstone star of exactly EIGHT points, wide and radially "
            "balanced, with a white hot glowing core at its middle. Behind and around it, exactly EIGHT broad "
            "straight rays fanning out evenly in every direction, each ray thick at its base and coming to one "
            "clean point, with a wide empty transparent gap between each ray and the next. Growing from the "
            "sides of the star, exactly TWO GREAT metal wings in the style of a military aviation pilot "
            "insignia: each wing is a long fan of NO MORE THAN FIVE long straight tapering feather blades in one "
            "stepped row, blade edges parallel and crisp, with a clearly visible empty transparent gap between "
            "each blade and the next, sweeping upward and outward. Above the star, ONE crown of exactly FIVE "
            "broad pointed spires, the middle spire tallest. Below the star, a long sculpted tail of exactly "
            "THREE downward feather blades, so the emblem carries as much mass below the centre as above it and "
            "its outline approaches a full circle rather than a V. Nothing else: no shield, no enamel field, no "
            "laurel, no leaves, no sparks and no separate flame tongues.\n\n"
            "MATERIALS. The wings, crown, rays and tail are white gold: a pale warm precious metal with a satin "
            "brushed surface, sharp polished bevels and deep dark recesses, edged with a thin line of royal "
            "violet. The star is deep royal amethyst violet, faceted like a cut gemstone, dark and saturated at "
            "its outer facets and blazing white hot at its centre, throwing a violet glow onto the metal nearest "
            "to it. Every bright shape carries a distinctly darker underside beneath its highlight, so the "
            "emblem reads as a strong solid silhouette against a white background. Violet is the signature "
            "colour of this rank alone.\n\n"
            "MOTIF. There is no separate motif on this rank: the crowned winged star IS the motif."
        ),
    ),
]

HEADER = (
    'Use your image generation tool to create ONE image and save it in the current directory as exactly '
    '"{key}.png". Do not write any other file. Do not explain, just generate and save.\n\n'
)


def build(rank):
    key_name, key_hex, palette = rank["chroma"]
    parts = [
        HEADER.format(key=rank["key"]),
        key_block(key_name, key_hex, palette),
        "",
        "Image prompt:",
        "",
        rank["body"],
        "",
        STYLE,
        "",
        COMPOSITION,
        "",
        BANS,
        "",
        CANVAS,
    ]
    return "\n".join(parts).strip() + "\n"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for rank in RANKS:
        path = os.path.join(OUT, f"rank-{rank['n']:02d}-{rank['key']}.txt")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(build(rank))
        print(f"{path}  {len(build(rank))} chars")

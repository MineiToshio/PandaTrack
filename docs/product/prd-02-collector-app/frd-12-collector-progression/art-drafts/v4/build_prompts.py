"""Builds the v4 rank prompts from one shared spine plus a per-rank block.

v4 keeps the v3 style spine and the v3 silhouette ladder verbatim (the owner approved both) and
changes exactly three things:

  1. every MOTIF is redrawn so the object is derivable from the rank NAME and its lore,
  2. the wings on ranks 7 to 10 become one solid notched plate per side instead of a fan of
     separate blades,
  3. rank 10 stops being a winged star and becomes a living creature.

The spine is written once here so a style fix lands on all of them at the same time instead of
being hand-copied into eleven text files. Section 3 of `rank-art-guide.md` quotes this file.
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
    "NEVER INCLUDE. No text, no numbers, no letters, no watermark, no signature and no logo. No ribbon, no "
    "banderole, no scroll banner and no name plate: the rank name is drawn by the application beside the emblem. "
    "No sparks, no embers, no floating fragments, no scattered small pieces, no smoke and no separate flame "
    "tongues. No second concentric ring, halo ring, circular frame or plate drawn around the outside of the "
    "emblem. No existing character, franchise, trademark or copyrighted material of any kind: an original "
    "generic design only. No background scenery and no cast shadow on the ground."
)

CANVAS = (
    "OUTPUT. Square canvas, 1024 by 1024 pixels, PNG with a real transparent alpha channel, no background "
    "colour behind the emblem."
)


def wings(size, notches, root):
    """The v4 wing, stated once and scaled per rank.

    v3 drew each wing as a fan of three or four SEPARATE tapering blades. At 32 px the gaps between
    those blades close and the wing becomes a grey bar, and at full size the generator kept sliding
    them back toward soft bird plumage, which is what the owner rejected. v4 inverts the construction:
    ONE solid plate per side, with the blade count expressed as deep notches CUT INTO its trailing
    edge. A notch cut into a solid survives downscaling as a scalloped contour; a gap between two thin
    positives does not. The sweep is low and outward instead of upswept, which also feeds rule 19.
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
        chroma=MAGENTA + ("aged brown bronze with a deep teal enamel field and an ivory motif",),
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
            "MOTIF. Centred on the enamel field, ONE simple wooden gateway seen straight on from the front, of "
            "the kind that stands at the entrance of a Japanese shrine: exactly TWO thick upright posts, ONE "
            "long straight top beam resting across their tops and slightly overhanging them at both ends, and "
            "ONE shorter straight beam a little lower down, parallel to the first. Four bold pieces, nothing "
            "else: no roof tiles, no rope, no lantern, no door leaf, no wall, no window, no sign and no shop "
            "front. It is sculpted in low relief and finished in warm ivory cream, never in the rim's own "
            "bronze, and its width is about 45 percent of the whole disc width so it stays readable at "
            "thumbnail size, with a soft cast shadow falling onto the enamel just below and to the right of it."
        ),
    ),
    dict(
        n=2,
        key="preorder-hunter",
        name="Cazador de preventas",
        chroma=MAGENTA + ("brown bronze and dark iron with a deep teal enamel field and an ivory motif",),
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
            "MOTIF. Centred on the enamel field, ONE large reservation tag of the kind a shop hangs on an item "
            "that is already claimed: a broad flat plaque, wide and generous rather than thin, its top cut to a "
            "shallow point like a house roof with ONE round punched eyelet through that point, its bottom edge "
            "cut in a bold zigzag perforation of about five big teeth, hanging from ONE short thick cord that "
            "loops up from the eyelet and ends in a small ring at the top. The face of the plaque is completely "
            "blank: no writing, no numbers, no barcode and no pattern on it. It is sculpted in low relief and "
            "finished in warm ivory cream, never in the rim's own metal, and measures about 45 percent of the "
            "whole disc width so it stays readable at thumbnail size."
        ),
    ),
    dict(
        n=3,
        key="volume-keeper",
        name="Guardian del tomo",
        chroma=MAGENTA + ("warm polished copper bronze with a deep teal enamel field and an ivory motif",),
        body=(
            "SUBJECT. A single collectible guild rank plate. The circle finally breaks: the disc has been cut "
            "into a faceted octagonal plate.\n\n"
            "SHAPE. The outer contour of the whole image is a regular OCTAGON with eight equal straight edges "
            "and slightly softened corners, flat side up. A thick sculpted octagonal rim occupying about one "
            "fifth of the plate width, each of its eight facets catching the light at a different angle, "
            "encloses a single field that fills the rest of the plate. Exactly TWO large round dome headed "
            "rivets sit on the rim, one on the lower left facet and one on the lower right facet, each about 8 "
            "percent of the emblem width. Nothing else is attached: no leaves, no laurel, no wings, no crest "
            "and no points.\n\n"
            "MATERIALS. The metal is polished copper bronze, a warm reddish brown with bright hard specular "
            "highlights running along every facet edge and darker patina still sitting in the recesses, clearly "
            "brown and NOT yellow gold. The field is deep teal vitreous enamel with glassy depth.\n\n"
            "MOTIF. Centred on the enamel field, ONE single very thick heavy tome standing upright and closed, "
            "seen straight on from the front so its front cover faces the viewer, its spine on the left, its "
            "block of pages showing as a thick stack of layers on the right. Exactly TWO broad clasp straps run "
            "horizontally across the cover and close on the page edge with a simple square lock plate, and ONE "
            "short flat bookmark ribbon hangs straight down from the bottom of the block. The cover is plain: no "
            "writing, no crest, no filigree and no ornament on it. It is sculpted in low relief and finished in "
            "warm ivory cream, never in the rim's own metal, and measures about 45 percent of the whole plate "
            "width. It must read as ONE single book, never as a shelf and never as a row of several books."
        ),
    ),
    dict(
        n=4,
        key="guild-senpai",
        name="Senpai del gremio",
        chroma=GREEN + ("cool grey gunmetal and silver with a deep crimson enamel field and an ivory motif",),
        body=(
            "SUBJECT. A single collectible guild rank badge. This rank is a deliberate jump: the plate becomes a "
            "SHIELD and the metal stops being brown.\n\n"
            "SHAPE. The outer contour of the whole image is a BROAD ROUND SHOULDERED shield, drawn as wide as it "
            "is tall: its top edge is one wide shallow arc, its shoulders are generously wide and fully rounded, "
            "its sides bulge outward at the middle and only then taper to a short blunt point at the bottom, so "
            "the whole silhouette is close to a circle that has been pulled to a point at its base and it fills "
            "its square footprint corner to corner. Directly below that bottom point sits one small sculpted "
            "foot made of two short scrolled brackets, so the emblem carries mass low as well as high. A thick "
            "sculpted bevelled border, about one sixth of the shield width, runs all the way around and encloses "
            "a single field. Exactly THREE large round dome headed rivets are set into the border, one at each "
            "upper shoulder and one just above the bottom point. Nothing else is attached: no leaves, no laurel, "
            "no wings, no crest and no points.\n\n"
            "MATERIALS. The border is blued gunmetal steel with a brushed grain, small dents and hammer marks, "
            "and a bright polished silver bevel along its inner and outer edges, cool grey with cold white "
            "highlights and absolutely no brown and no gold. The field is deep crimson red vitreous enamel with "
            "glassy depth.\n\n"
            "MOTIF. Centred on the enamel field, ONE navigator's compass rose: a bold eight pointed star of "
            "direction, its four main points long, broad and sharply tapered, the four diagonal points clearly "
            "shorter and narrower, all eight radiating from ONE small round hub at the centre. The top point is "
            "the longest of the four and carries a small notch at its tip so the rose visibly points somewhere. "
            "Nothing else: no ring around it, no compass housing, no needle, no map, no pin marker, no signpost "
            "and no lettering of any kind. It is sculpted in low relief and finished in warm ivory cream, never "
            "in the border's own metal, and measures about 42 percent of the whole shield width."
        ),
    ),
    dict(
        n=5,
        key="first-print-hunter",
        name="Cazador de primera edicion",
        chroma=GREEN + ("polished silver with a deep crimson enamel field, one red gem and an ivory motif",),
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
            "MOTIF. Centred on the enamel field, ONE large round magnifying glass held over ONE single upright "
            "collector card. The glass is the dominant piece: a thick bold circular lens with a heavy sculpted "
            "bezel and a short straight handle running down to the lower right, and it overlaps the card so that "
            "the card's top left corner sticks out above it and its bottom right corner sticks out below. The "
            "card is a plain rectangle with ONE corner visibly lifted and curling away from the surface. The "
            "card is completely blank: no fingerprint, no ridges, no swirl pattern, no writing, no ink and no "
            "stain anywhere in the image. The whole motif is sculpted in low relief and finished in warm ivory "
            "cream, never in the border's own metal, and measures about 42 percent of the whole shield width."
        ),
    ),
    dict(
        n=6,
        key="limited-run-curator",
        name="Curador de tirada limitada",
        chroma=MAGENTA + ("rich warm gold with a deep royal blue enamel field, one emerald and an ivory motif",),
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
            "flourishes and no ornament of any kind on it. Centred on that field, ONE glass bell jar standing on "
            "ONE low round stepped plinth, the jar drawn as a tall clean dome with a small knob on top and a "
            "bright curved reflection sliding down its left side, and standing inside it ONE single faceted "
            "crystal shard, upright, pointed at the top, clearly smaller than the jar. Nothing else is inside "
            "the jar. No shelves, no cabinet, no display case, no doors, no figures, no toys, no person, no "
            "face. The whole motif is sculpted in low relief and finished in warm ivory cream, never in gold, "
            "and measures about 40 percent of the whole emblem width."
        ),
    ),
    dict(
        n=7,
        key="club-sensei",
        name="Sensei del club",
        chroma=MAGENTA + ("rich warm gold and cold steel grey with a deep royal blue enamel field and an ivory motif",),
        body=(
            "SUBJECT. A single collectible guild rank crest. This rank is a deliberate jump: WINGS appear for "
            "the first time on the whole ladder, and they are small.\n\n"
            "SHAPE. A crested heater shield exactly like the previous rank, with wings spreading from just below "
            "its shoulders. Below the shield's point, one small sculpted foot with a faceted gem, to give the "
            "emblem weight at the bottom. Exactly THREE faceted gems in total on the whole emblem: one in the "
            "crest peak, one at each wing root. There are no laurel branches on this rank, no leaves and no "
            "rays.\n\n"
            + wings(
                size="its root as tall as the shield's shoulder and its tip reaching only a little past the "
                "shield's side, so the whole emblem stays inside a square footprint.",
                notches=1,
                root="The wing is bolted onto the shield by ONE rectangular root plate carrying exactly TWO "
                "round rivets and a faceted gem, so the wings read as built into the frame rather than glued "
                "behind it.",
            )
            + "\n\n"
            "MATERIALS. The shield and crest are rich warm gold with a brushed grain, bright specular glints and "
            "deep shadow in the recesses. The wing plates are cold steel grey with a polished upper surface and "
            "a clearly darker underside, so they separate from the gold by value alone. The field is deep royal "
            "blue vitreous enamel with glassy depth. The three gems are faceted deep green emeralds, each at "
            "least 8 percent of the emblem width.\n\n"
            "MOTIF. The enamel field is completely smooth and plain: no scrollwork, no filigree, no carved "
            "flourishes, no vines, no curls and no ornament of any kind on it. Centred on that field, ONE "
            "standing stone lantern of the kind that lights a Japanese "
            "garden path, seen straight on from the front and built of exactly four stacked pieces: a wide "
            "flared roof cap with a small pointed finial on top, under it a square light box whose front face is "
            "pierced by ONE tall arched window opening that glows with a warm light from inside, under that one "
            "short thick pillar, and at the bottom one low round stepped base. The roof is clearly the widest "
            "piece and the glowing window is the brightest point of the motif. No hanging cord, no chain, no "
            "hook, no paper, no ribs, no flame tongue outside the window and no lamp post. It is sculpted in "
            "relief and finished in warm ivory cream, never in gold, and measures about 40 percent of the whole "
            "emblem width."
        ),
    ),
    dict(
        n=8,
        key="rare-edition-archivist",
        name="Custodio de edicion rara",
        chroma=MAGENTA + ("pale platinum white and gold with a deep indigo enamel field, one green cabochon and an ivory motif",),
        body=(
            "SUBJECT. A single collectible guild rank emblem: the winged crested shield, one step larger and one "
            "material more precious, with one big showpiece gem.\n\n"
            "SHAPE. A crested heater shield carried by two wings. Set into the crest peak above the shield, ONE "
            "large round polished cabochon gem, at least 14 percent of the emblem width, the single showpiece of "
            "the design. Below the shield's point, a sculpted base of two short scrolled brackets so the emblem "
            "carries as much mass low as it does high. No laurel, no leaves, no rays and no gems anywhere except "
            "the one in the crest.\n\n"
            + wings(
                size="clearly larger than the previous rank's, its tip reaching out to the full width of the "
                "square footprint.",
                notches=2,
                root="The wing is bolted onto the shield by ONE rectangular root plate carrying exactly TWO "
                "round rivets and inlaid with a gold line, so the wings read as built into the frame rather than "
                "glued behind it.",
            )
            + "\n\n"
            "MATERIALS. The frame is white platinum, a pale cool silver white with a satin brushed surface, "
            "crisp polished bevels and warm gold inlay lines running along the wing roots and the shield border. "
            "Every pale shape carries a darker underside and a clearly darker recess beneath its highlight, so "
            "the emblem still reads as a strong solid silhouette against a white background and never dissolves "
            "into a pale haze. The field is deep indigo vitreous enamel with glassy depth. The cabochon is a "
            "deep polished green stone with a single sharp specular highlight and a soft glow inside it.\n\n"
            "MOTIF. Centred on the enamel field, ONE small reliquary casket, closed and sealed, seen straight on "
            "from the front: a broad rectangular chest with an arched barrel lid, exactly TWO thick vertical "
            "straps running up over the lid, ONE heavy square lock plate centred on the front face, and ONE low "
            "moulded plinth under it. It is closed: no opening, no drawer, no lid lifted, nothing coming out of "
            "it, no cardboard flaps, no parcel and no tape. It is sculpted in low relief and finished in warm "
            "ivory cream, never in platinum, and measures about 34 percent of the whole emblem width."
        ),
    ),
    dict(
        n=9,
        key="collection-shisho",
        name="Gran maestro de la coleccion",
        chroma=MAGENTA + ("pale ice blue crystal over platinum with an ice blue field, sapphires and an ivory motif",),
        body=(
            "SUBJECT. A single collectible guild rank emblem. The crest peak becomes a CROWN and the wings grow "
            "large, and the whole frame has crystallised.\n\n"
            "SHAPE. A heater shield carried by two large wings. Above the shield, replacing the simple crest "
            "peak, ONE small crown of exactly THREE broad pointed spires, the middle spire tallest, each spire "
            "thick and clearly separated from the next. Below the shield's point, a sculpted base of two "
            "scrolled brackets and one hanging faceted pendant, so the emblem carries mass low as well as high. "
            "Exactly THREE faceted gems in total: one in the middle crown spire and one at each wing root. No "
            "laurel, no leaves and no rays.\n\n"
            + wings(
                size="the largest on the ladder, long and broad, its tip reaching the full width of the square "
                "footprint.",
                notches=3,
                root="The wing is bolted onto the shield by ONE broad sculpted shoulder plate carrying exactly "
                "TWO round rivets and a faceted gem, so the wings read as built into the frame rather than glued "
                "behind it.",
            )
            + "\n\n"
            "MATERIALS. The frame is pale prismatic ice crystal grown over a platinum armature: translucent blue "
            "white crystal with internal fractures catching the light, faceted like cut glass, refracting into "
            "faint rainbow edges, mounted on satin platinum. Every pale shape carries a distinctly darker "
            "underside and a dark recess beneath its highlight, so the emblem reads as a solid silhouette "
            "against a white background and never dissolves into a pale haze. The field is a deep ice blue "
            "enamel, clearly darker than the crystal frame, with glassy depth. The three gems are pale faceted "
            "sapphires.\n\n"
            "MOTIF. Centred on the enamel field, exactly TWO large ceremonial master keys crossed over each "
            "other in a wide X, their round ornate bows at the top left and the top right and their toothed "
            "wards at the bottom left and the bottom right, bound where they cross by ONE small square collar. "
            "Each key has a thick round bow, a straight fluted shaft and exactly TWO square teeth at its end. "
            "Nothing else: no keyhole, no lock, no chain, no ring of keys and no third key. They are sculpted in "
            "low relief and finished in warm ivory cream, never in crystal, and the crossed pair measures about "
            "34 percent of the whole emblem width."
        ),
    ),
    dict(
        n=10,
        key="guild-legend",
        name="Leyenda del gremio",
        chroma=GREEN + ("royal amethyst violet over white gold, with a white hot crystal core",),
        body=(
            "SUBJECT. A single collectible guild rank emblem at the very top of the ladder, and it deliberately "
            "breaks everything the nine ranks below it obey. There is no shield, no plate, no enamel field and "
            "no motif set into a frame, because this emblem is not an object any more: it is ALIVE. It is one "
            "heraldic firebird, a phoenix, forged out of the same metal the lower ranks are made of, holding a "
            "burning crystal at its breast.\n\n"
            "SHAPE. ONE phoenix seen strictly from the front and perfectly symmetrical, its wings spread wide "
            "and low to both sides so the whole creature fills a square footprint. Its body is one compact "
            "sculpted torso. Its head is small and stylised, held straight up, with a short straight beak and a "
            "crest of exactly THREE short blades rising from the back of the skull, with NO visible eyes and no "
            "face detail of any kind. Below the body, a tail of exactly THREE long straight blades fanning "
            "downward and slightly outward, the middle one the longest, so the creature carries as much mass "
            "below its centre as above it and its outline approaches a full circle rather than a V. Set into the "
            "centre of its breast, ONE large faceted crystal, at least 20 percent of the emblem width, blazing "
            "white hot at its core: it is the brightest point of the whole image and the only light source in "
            "it. Nothing else: no shield, no enamel field, no laurel, no crown, no rays, no sparks, no flame "
            "tongues, no perch and no branch.\n\n"
            + wings(
                size="as long as the creature's whole body, spread out to both sides.",
                notches=3,
                root="The wings grow straight out of the shoulders of the body as one continuous forged piece, "
                "with no visible joint, no bolt and no separate root plate.",
            )
            + "\n\n"
            "MATERIALS. Every blade of the wings, the tail and the crest is royal amethyst violet: a deep "
            "saturated purple, glassy and vitreous like enamel poured over metal, each blade edged with one thin "
            "bright line of white gold along its bevel. The body is white gold with a satin brushed surface, "
            "sharp polished bevels and deep dark recesses, warmed to violet wherever the crystal's light falls "
            "on it. Violet is the signature colour of this rank alone and it must dominate the image, so that "
            "even shrunk to a 32 pixel thumbnail the emblem reads as a violet mass with one white core. Every "
            "bright shape carries a distinctly darker underside beneath its highlight, so the emblem reads as a "
            "strong solid silhouette against a white background as well as a black one.\n\n"
            "MOTIF. There is no separate motif on this rank: the creature IS the motif. It must read as an "
            "original heraldic insignia bird, never as a cartoon animal, never as a cute mascot, never as a "
            "realistic ornithological bird and never as any existing character from any franchise."
        ),
    ),
    dict(
        n=11,
        key="guild-legend-relic",
        name="Leyenda del gremio, variante reliquia",
        chroma=GREEN + ("royal amethyst violet over white gold, with a white hot crystal core",),
        body=(
            "SUBJECT. A single collectible guild rank emblem at the very top of the ladder, and it deliberately "
            "breaks everything the nine ranks below it obey. There is no shield, no plate and no enamel field: "
            "the frame that held every lower rank has split open and the relic it was built to carry now floats "
            "free inside the broken setting. It reads as a legendary artifact, not as a badge.\n\n"
            "SHAPE. At the centre, ONE very large upright faceted crystal, a tall six sided gemstone coming to a "
            "point at the top and at the bottom, at least 40 percent of the emblem width, blazing white hot at "
            "its core and darkening to deep violet at its outer facets. Around it, the broken setting: exactly "
            "TWO thick curved metal claws, one on the left and one on the right, sweeping outward and upward "
            "away from the crystal like two halves of a shell that were forced apart, each ending in one clean "
            "point, each with a wide empty transparent gap between it and the crystal so nothing touches. Above "
            "the crystal, ONE crown of exactly FIVE broad pointed spires, the middle spire tallest, floating "
            "just clear of the stone. Below it, ONE sculpted tail of exactly THREE straight downward blades, the "
            "middle one longest, so the emblem carries as much mass below its centre as above it. Nothing else: "
            "no shield, no wings, no laurel, no rays, no sparks and no floating fragments.\n\n"
            "MATERIALS. The claws, the crown and the tail are white gold: a pale precious metal with a satin "
            "brushed surface, sharp polished bevels and deep dark recesses, each piece edged with one thin line "
            "of royal violet and warmed to violet wherever the crystal's light falls on it. The crystal is royal "
            "amethyst violet, faceted like a cut gemstone, dark and saturated at its outer facets and blazing "
            "white at its centre. Violet is the signature colour of this rank alone and it must dominate the "
            "image, so that even shrunk to a 32 pixel thumbnail the emblem reads as a violet mass with one white "
            "core. Every bright shape carries a distinctly darker underside beneath its highlight, so the emblem "
            "reads as a strong solid silhouette against a white background as well as a black one.\n\n"
            "MOTIF. There is no separate motif on this rank: the floating relic IS the motif."
        ),
    ),
]


def build():
    os.makedirs(OUT, exist_ok=True)
    for r in RANKS:
        slug = f"rank-{r['n']:02d}-{r['key']}"
        key_name, key_hex, palette = r["chroma"]
        text = "\n\n".join(
            [
                (
                    "Use your image generation tool to create ONE image and save it in the current directory as "
                    f'exactly "{r["key"]}.png".'
                ),
                key_block(key_name, key_hex, palette),
                r["body"],
                STYLE,
                COMPOSITION,
                BANS,
                CANVAS,
            ]
        )
        path = os.path.join(OUT, f"{slug}.txt")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
        print(f"{slug}.txt  {len(text)} chars")


if __name__ == "__main__":
    build()

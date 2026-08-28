"""The v6 contact sheet the owner reviews: `ranks-v6-board.png`.

Same size discipline as v3, v4 and v5 (2400 px wide, 400 px art cell, plus the 56 px and 32 px
strips that actually decide whether the art works), and the same four label lines per cell.

v6 is not a new round of art direction. It is v5 with its five missing refinements finally
rendered: ranks 1, 3, 4, 5 and 10, which v5 shipped from take 1 because the image quota ran out
before the refinement pass. The other five cells are the v5 files, byte for byte. So the board
marks which cell is new, because on a sheet where half the images did not move, "what changed"
is the only question worth answering.
"""

import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.join(HERE, "final")

W = 2400
COLS = 5
CELL = W // COLS
ART = 400
PAD = 48

BG = (23, 25, 29, 255)
BG_ALT = (30, 33, 38, 255)
LIGHT = (247, 246, 243, 255)
INK = (238, 238, 238)
INK_DIM = (152, 156, 164)
INK_DARK = (26, 26, 30)
GOLD = (206, 164, 90)
CYAN = (140, 196, 220)

# key, rank name, artefact, materials, silhouette, light level
RANKS = [
    ("kohai", "Kohai", "La esquirla dormida", "Bronce y pizarra gris", "Disco liso", "Sin luz"),
    ("preorder-hunter", "Buscador de reliquias", "La hoja hallada", "Hierro negro, verde musgo", "Disco con marco", "Sin luz"),
    ("volume-keeper", "Escriba del grimorio", "El grimorio encadenado", "Cobre y laton, ambar", "Placa octogonal", "Sin luz"),
    ("guild-senpai", "Senpai del gremio", "El orbe de invocacion", "Laton dorado, turquesa", "Escudo", "Una chispa"),
    ("first-print-hunter", "Portador del filo", "El filo reforjado", "Oro champan, azul cobalto", "Escudo con ornamento", "Una chispa"),
    ("limited-run-curator", "Guardian de las horas", "La clepsidra de eter", "Oro y marfil perla", "Escudo con laurel", "Una chispa"),
    ("club-sensei", "Invocador del cristal", "El cristal despierto", "Oro sobre obsidiana", "Alas pequenas", "Resplandor"),
    ("rare-edition-archivist", "Centinela de esmeralda", "El yelmo del custodio", "Platino y oro, esmeralda", "Alas medianas", "Resplandor"),
    ("collection-shisho", "Gran maestro de la boveda", "Las llaves del sagrario", "Cristal de hielo, azul glaciar", "Corona y alas grandes", "Resplandor"),
    ("guild-legend", "Leyenda viva, Rango S", "El ave de eter", "Amatista sobre oro blanco", "Criatura", "Aura plena"),
]


def font(size, bold=False):
    name = "Arial Bold.ttf" if bold else "Arial.ttf"
    try:
        return ImageFont.truetype(f"/System/Library/Fonts/Supplemental/{name}", size)
    except OSError:
        return ImageFont.load_default()


F_TITLE = font(58, True)
F_SUB = font(28)
F_KICK = font(22, True)
F_NAME = font(31, True)
F_NOTE = font(22)
F_MOTIF = font(23, True)
F_STRIP = font(30, True)
F_STRIP_SUB = font(22)
F_TINY = font(20)


def load(key):
    return Image.open(os.path.join(FINAL, f"{key}.png")).convert("RGBA")


IMGS = [load(r[0]) for r in RANKS]

# The five rungs re-rendered in this round. Everything else is the v5 file untouched.
NEW = {"kohai", "volume-keeper", "guild-senpai", "first-print-hunter", "guild-legend"}


def tile(img, px, bg):
    cell = Image.new("RGBA", (px, px), bg)
    cell.alpha_composite(img.resize((px, px), Image.LANCZOS))
    return cell


def fit(draw, text, fnt, limit, bold):
    size = fnt.size
    while size > 14:
        f = font(size, bold)
        if draw.textlength(text, font=f) <= limit:
            return f
        size -= 1
    return font(14, bold)


rows = []


def band(height, bg):
    im = Image.new("RGBA", (W, height), bg)
    return im, ImageDraw.Draw(im)


im, d = band(226, BG)
d.text((PAD, 40), "PandaTrack  ·  Escalera de rangos  ·  arte v6", font=F_TITLE, fill=INK)
d.text(
    (PAD, 112),
    "Set completo de diez. Los cinco rangos marcados NUEVO son los renders que faltaban de v5 (1, 3, 4, 5 y "
    "10); los otros cinco son",
    font=F_SUB,
    fill=INK_DIM,
)
d.text(
    (PAD, 150),
    "los mismos archivos de v5, sin tocar. La luz sigue racionada: nada del 1 al 3, una chispa del 4 al 6, "
    "resplandor del 7 al 9, aura plena solo en el 10.",
    font=F_SUB,
    fill=INK_DIM,
)
rows.append(im)

for row in range(2):
    im, d = band(ART + 216, BG if row == 0 else BG_ALT)
    for col in range(COLS):
        i = row * COLS + col
        key, name, motif, note, shape, light = RANKS[i]
        x = col * CELL
        im.alpha_composite(IMGS[i].resize((ART, ART), Image.LANCZOS), (x + (CELL - ART) // 2, 16))
        tx = x + PAD // 2
        limit = CELL - PAD
        kicker = f"RANGO {i + 1}  ·  {shape.upper()}"
        # The badge is part of the kicker line, so it has to be reserved out of the line's budget
        # BEFORE the type is fitted. Fitting the text to the full cell and then appending the badge
        # is how rank 5, whose "ESCUDO CON ORNAMENTO" is the longest kicker on the sheet, ended up
        # with the badge sitting on top of its own last three letters.
        f_kick = fit(d, kicker, F_KICK, limit - (98 if key in NEW else 0), True)
        d.text((tx, ART + 30), kicker, font=f_kick, fill=GOLD)
        if key in NEW:
            bx = tx + d.textlength(kicker, font=f_kick) + 14
            d.rounded_rectangle((bx, ART + 26, bx + 84, ART + 52), radius=6, fill=(58, 96, 74))
            d.text((bx + 13, ART + 31), "NUEVO", font=font(19, True), fill=(168, 226, 186))
        d.text((tx, ART + 62), name, font=fit(d, name, F_NAME, limit, True), fill=INK)
        d.text((tx, ART + 106), motif, font=fit(d, motif, F_MOTIF, limit, True), fill=(196, 206, 220))
        d.text((tx, ART + 140), note, font=fit(d, note, F_NOTE, limit, False), fill=INK_DIM)
        d.text((tx, ART + 174), f"luz: {light.lower()}", font=fit(d, f"luz: {light.lower()}", F_NOTE, limit, False), fill=CYAN)
    rows.append(im)

step = (W - PAD * 2) // 10

im, d = band(150, BG)
d.text((PAD, 26), "56 px", font=F_STRIP, fill=INK)
d.text((PAD + 100, 32), "tamano real del widget del dashboard", font=F_STRIP_SUB, fill=INK_DIM)
for i, img in enumerate(IMGS):
    im.alpha_composite(tile(img, 56, BG), (PAD + i * step, 74))
rows.append(im)

im, d = band(140, BG_ALT)
d.text((PAD, 22), "32 px", font=F_STRIP, fill=INK)
d.text((PAD + 100, 28), "prueba de miniatura: cada rango debe seguir siendo distinto", font=F_STRIP_SUB, fill=INK_DIM)
for i, img in enumerate(IMGS):
    im.alpha_composite(tile(img, 32, BG_ALT), (PAD + i * step, 70))
    d.text((PAD + i * step + 40, 76), str(i + 1), font=F_TINY, fill=INK_DIM)
rows.append(im)

im, d = band(150, LIGHT)
d.text((PAD, 26), "56 px", font=F_STRIP, fill=INK_DARK)
d.text((PAD + 100, 32), "tema claro: el contorno tiene que aguantar sobre fondo blanco", font=F_STRIP_SUB, fill=(110, 112, 118))
for i, img in enumerate(IMGS):
    im.alpha_composite(tile(img, 56, LIGHT), (PAD + i * step, 74))
rows.append(im)

im, d = band(112, BG)
d.text(
    (PAD, 22),
    "Cerrado el repaso que v5 dejo pendiente. Rango 1: la esquirla ya lee como cristal tallado y no como "
    "piedra. Rango 3: el tomo contrasta contra el ambar y no queda rastro de lava ni de rojo.",
    font=F_STRIP_SUB,
    fill=(150, 130, 90),
)
d.text(
    (PAD, 52),
    "Rango 4: el orbe ocupa el escudo entero y la chispa cian se ve. Rango 5: escudo recto con cresta "
    "arqueada. Rango 10: cada ala ya es UNA placa maciza con muescas en el borde de fuga (0,38 huecos por "
    "fila, frente a 1,38 antes y 0,36 del rango 7).",
    font=F_STRIP_SUB,
    fill=(150, 130, 90),
)
rows.append(im)

total = sum(r.height for r in rows)
board = Image.new("RGBA", (W, total), BG)
y = 0
for r in rows:
    board.paste(r, (0, y))
    y += r.height
out = os.path.join(HERE, "ranks-v6-board.png")
board.convert("RGB").save(out)
print("board:", board.size, out)

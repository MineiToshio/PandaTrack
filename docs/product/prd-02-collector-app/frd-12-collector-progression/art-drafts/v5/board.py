"""The v5 contact sheet the owner reviews: `ranks-v5-board.png`.

Same size discipline as v3 and v4 (2400 px wide, 400 px art cell, plus the 56 px and 32 px strips
that actually decide whether the art works). v5 adds a fourth label line per cell, the light level,
because rationed light is the new axis of this round.
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
d.text((PAD, 40), "PandaTrack  ·  Escalera de rangos  ·  arte v5", font=F_TITLE, fill=INK)
d.text(
    (PAD, 112),
    "Ahora manda la imagen y el nombre viene detras. Diez artefactos de una sola mitologia: la vida de un "
    "cristal,",
    font=F_SUB,
    fill=INK_DIM,
)
d.text(
    (PAD, 150),
    "de la esquirla dormida en la roca al ave que la lleva encendida en el pecho. La luz esta racionada: "
    "nada del 1 al 3, una chispa del 4 al 6, resplandor del 7 al 9, aura plena solo en el 10.",
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
        d.text((tx, ART + 30), f"RANGO {i + 1}  ·  {shape.upper()}", font=F_KICK, fill=GOLD)
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

im, d = band(96, BG)
d.text(
    (PAD, 26),
    "Repaso pendiente (la cuota de generacion de imagen se agoto a mitad de ronda): los rangos 1, 3, 4, 5 y 10 "
    "tienen ya escrita una version corregida en prompts/, sin renderizar todavia.",
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
out = os.path.join(HERE, "ranks-v5-board.png")
board.convert("RGB").save(out)
print("board:", board.size, out)

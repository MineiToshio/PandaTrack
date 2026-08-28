"""The v3 contact sheet the owner reviews: `ranks-v3-board.png`.

Deliberately large. Previous rounds were shown on a 1560 px sheet and the owner could not judge the
craft at that size, so this one is 2400 px wide with a 400 px cell per rank, plus the two strips that
actually decide whether the art works: 56 px (the dashboard widget) and 32 px (the thumbnail test).
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

RANKS = [
    ("kohai", "Kohai", "Bronce envejecido, esmalte turquesa", "Disco liso"),
    ("preorder-hunter", "Cazador de preventas", "Bronce y hierro, 4 remaches", "Disco con marco"),
    ("volume-keeper", "Guardian del tomo", "Bronce pulido, 2 remaches", "Placa octogonal"),
    ("guild-senpai", "Senpai del gremio", "Acero pavonado y plata, esmalte carmesi", "Escudo"),
    ("first-print-hunter", "Cazador de primera edicion", "Plata pulida, gema roja", "Escudo con cresta"),
    ("limited-run-curator", "Curador de tirada limitada", "Oro, esmalte azul, esmeralda", "Escudo con laurel"),
    ("club-sensei", "Sensei del club", "Oro y acero, 3 esmeraldas", "Alas pequenas"),
    ("rare-edition-archivist", "Archivista de edicion rara", "Platino con oro, cabujon verde", "Alas medianas"),
    ("collection-shisho", "Shisho de la coleccion", "Cristal de hielo sobre platino", "Corona y alas grandes"),
    ("guild-legend", "Leyenda del gremio", "Oro blanco y amatista, nucleo blanco", "Forma legendaria"),
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


def fit(draw, text, fnt, limit):
    """Shrink a label until it fits its cell, so a long rank name never runs into its neighbour."""
    size = fnt.size
    while size > 14:
        f = font(size, fnt is F_NAME)
        if draw.textlength(text, font=f) <= limit:
            return f
        size -= 1
    return font(14, fnt is F_NAME)


rows = []


def band(height, bg):
    im = Image.new("RGBA", (W, height), bg)
    return im, ImageDraw.Draw(im)


# Header
im, d = band(190, BG)
d.text((PAD, 44), "PandaTrack  ·  Escalera de rangos  ·  arte v3", font=F_TITLE, fill=INK)
d.text(
    (PAD, 116),
    "Ilustracion semirrealista de RPG japones. La forma evoluciona peldano a peldano: "
    "disco, placa, escudo, cresta, laurel, alas y leyenda.",
    font=F_SUB,
    fill=INK_DIM,
)
rows.append(im)

# Two rows of five
for row in range(2):
    im, d = band(ART + 150, BG if row == 0 else BG_ALT)
    for col in range(COLS):
        i = row * COLS + col
        key, name, note, shape = RANKS[i]
        x = col * CELL
        im.alpha_composite(IMGS[i].resize((ART, ART), Image.LANCZOS), (x + (CELL - ART) // 2, 16))
        tx = x + PAD // 2
        limit = CELL - PAD
        d.text((tx, ART + 30), f"RANGO {i + 1}  ·  {shape.upper()}", font=F_KICK, fill=GOLD)
        d.text((tx, ART + 62), name, font=fit(d, name, F_NAME, limit), fill=INK)
        d.text((tx, ART + 104), note, font=fit(d, note, F_NOTE, limit), fill=INK_DIM)
    rows.append(im)

# 56 px strip, dark
im, d = band(150, BG)
d.text((PAD, 26), "56 px", font=F_STRIP, fill=INK)
d.text((PAD + 100, 32), "tamano real del widget del dashboard", font=F_STRIP_SUB, fill=INK_DIM)
step = (W - PAD * 2) // 10
for i, img in enumerate(IMGS):
    im.alpha_composite(tile(img, 56, BG), (PAD + i * step, 74))
    d.text((PAD + i * step, 134 - 0), "", font=F_TINY, fill=INK_DIM)
rows.append(im)

# 32 px strip, dark
im, d = band(140, BG_ALT)
d.text((PAD, 22), "32 px", font=F_STRIP, fill=INK)
d.text((PAD + 100, 28), "prueba de miniatura: cada rango debe seguir siendo distinto", font=F_STRIP_SUB, fill=INK_DIM)
for i, img in enumerate(IMGS):
    im.alpha_composite(tile(img, 32, BG_ALT), (PAD + i * step, 70))
    d.text((PAD + i * step + 40, 76), str(i + 1), font=F_TINY, fill=INK_DIM)
rows.append(im)

# 56 px strip, light theme
im, d = band(150, LIGHT)
d.text((PAD, 26), "56 px", font=F_STRIP, fill=INK_DARK)
d.text((PAD + 100, 32), "tema claro: el contorno tiene que aguantar sobre fondo blanco", font=F_STRIP_SUB, fill=(110, 112, 118))
for i, img in enumerate(IMGS):
    im.alpha_composite(tile(img, 56, LIGHT), (PAD + i * step, 74))
rows.append(im)

total = sum(r.height for r in rows)
board = Image.new("RGBA", (W, total), BG)
y = 0
for r in rows:
    board.paste(r, (0, y))
    y += r.height
out = os.path.join(HERE, "ranks-v3-board.png")
board.convert("RGB").save(out)
print("board:", board.size, out)

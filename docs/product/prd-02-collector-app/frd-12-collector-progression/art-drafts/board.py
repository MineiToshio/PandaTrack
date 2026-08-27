"""Contact sheet for the round 2 rank test batch."""

import os
from PIL import Image, ImageDraw, ImageFont

SP = os.path.dirname(os.path.abspath(__file__))
FINAL = os.path.join(SP, "final")
MEDALS = "/Users/Shared/Proyectos/pandatrack/public/medals"

RANKS = [
    ("kohai.png", "Rango 1  Kohai", "TRAMO I  APRENDIZ", "bronce mate  ·  0 remaches"),
    ("guild-senpai.png", "Rango 4  Senpai del gremio", "TRAMO I  APRENDIZ", "bronce pulido  ·  3 remaches"),
    ("club-sensei.png", "Rango 7  Sensei del club", "TRAMO II  VETERANO", "oro + gemas  ·  3 gemas"),
    ("guild-legend.png", "Rango 10  Leyenda del gremio", "TRAMO III  LEYENDA", "plasma rosa  ·  rompe la regla"),
]
MEDAL_FILES = ["first-order.png", "collection-150.png"]

DARK = (24, 26, 30, 255)
LIGHT = (247, 247, 245, 255)
INK = (232, 232, 232)
INK_DIM = (150, 152, 158)
INK_DARK = (30, 30, 34)
W = 1560
PAD = 40


def font(size, bold=False):
    for p in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


F_TITLE = font(30, True)
F_H = font(19, True)
F_N = font(17, True)
F_S = font(14)
F_XS = font(12)


def load(name):
    return Image.open(os.path.join(FINAL, name)).convert("RGBA")


def thumb(img, px):
    return img.resize((px, px), Image.LANCZOS)


def on_bg(img, px, bg):
    tile = Image.new("RGBA", (px, px), bg)
    tile.alpha_composite(thumb(img, px))
    return tile


def grey(img, px):
    t = thumb(img, px)
    g = t.convert("LA").convert("RGBA")
    g.putalpha(t.getchannel("A"))
    return g


imgs = [load(r[0]) for r in RANKS]
medals = [Image.open(os.path.join(MEDALS, m)).convert("RGBA") for m in MEDAL_FILES]

rows = []


def band(height, bg):
    im = Image.new("RGBA", (W, height), bg)
    return im, ImageDraw.Draw(im)


# Header
im, d = band(96, DARK)
d.text((PAD, 26), "PandaTrack  ·  Rangos v2  ·  lote de prueba", font=F_TITLE, fill=INK)
d.text((PAD, 64), "1, 4, 7 y 10. Tres tramos, dos saltos y un tope que rompe el sistema.", font=F_S, fill=INK_DIM)
rows.append(im)

# Row 1: large, dark
CELL = (W - PAD * 2) // 4
im, d = band(CELL + 96, DARK)
for i, (name, title, tramo, note) in enumerate(RANKS):
    x = PAD + i * CELL
    im.alpha_composite(thumb(imgs[i], CELL - 24), (x + 12, 8))
    d.text((x + 12, CELL - 4), title, font=F_N, fill=INK)
    d.text((x + 12, CELL + 20), tramo, font=F_XS, fill=(214, 168, 92))
    d.text((x + 12, CELL + 40), note, font=F_XS, fill=INK_DIM)
rows.append(im)

# Row 2: 84 px on light (theme check)
im, d = band(150, LIGHT)
d.text((PAD, 16), "84 px sobre tema claro  ·  prueba de contorno", font=F_H, fill=INK_DARK)
for i in range(4):
    im.alpha_composite(on_bg(imgs[i], 84, LIGHT), (PAD + i * 130, 46))
rows.append(im)

# Row 3+4: 56 and 32 on dark
im, d = band(190, DARK)
d.text((PAD, 14), "56 px  ·  widget del dashboard", font=F_H, fill=INK)
for i in range(4):
    im.alpha_composite(on_bg(imgs[i], 56, DARK), (PAD + i * 100, 44))
d.text((PAD, 118), "32 px  ·  prueba de miniatura", font=F_H, fill=INK)
for i in range(4):
    im.alpha_composite(on_bg(imgs[i], 32, DARK), (PAD + i * 100, 148))
rows.append(im)

# Row 5: greyscale
im, d = band(210, DARK)
d.text((PAD, 14), "Escala de grises  ·  64 px y 32 px  ·  si no se distinguen sin color, falla", font=F_H, fill=INK)
for i in range(4):
    im.alpha_composite(grey(imgs[i], 64), (PAD + i * 110, 48))
for i in range(4):
    im.alpha_composite(grey(imgs[i], 32), (PAD + i * 110, 136))
d.text((PAD + 460, 140), "16 px", font=F_XS, fill=INK_DIM)
for i in range(4):
    im.alpha_composite(grey(imgs[i], 16), (PAD + 520 + i * 40, 138))
rows.append(im)

# Row 6: ranks vs medals
im, d = band(200, DARK)
d.text((PAD, 14), "Rangos junto a medallas  ·  72 px  ·  no deben confundirse", font=F_H, fill=INK)
x = PAD
for i in range(4):
    im.alpha_composite(on_bg(imgs[i], 72, DARK), (x, 48))
    d.text((x, 126), "rango", font=F_XS, fill=(214, 168, 92))
    x += 92
x += 40
d.line([(x - 22, 44), (x - 22, 140)], fill=(70, 72, 78), width=2)
for m in medals:
    im.alpha_composite(on_bg(m, 72, DARK), (x, 48))
    d.text((x, 126), "medalla", font=F_XS, fill=(120, 190, 220))
    x += 92
d.text((PAD, 160), "El rango es metal acunado: un aro grueso y un solo color plano. La medalla es una lamina ilustrada a todo color.", font=F_S, fill=INK_DIM)
rows.append(im)

total = sum(r.height for r in rows)
board = Image.new("RGBA", (W, total), DARK)
y = 0
for r in rows:
    board.paste(r, (0, y))
    y += r.height
board.convert("RGB").save(os.path.join(FINAL, "ranks-v2-board.png"))
print("board:", board.size)

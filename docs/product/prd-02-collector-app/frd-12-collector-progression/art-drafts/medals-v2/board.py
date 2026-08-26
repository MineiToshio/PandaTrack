#!/usr/bin/env python3
"""Builds the ONE review sheet the owner decides from: medals-v2-board.png.

Three bands, in the order the decision is actually made:
  1. The rarity system, five grades on one series shape, in colour and again in 32 px greyscale.
  2. Before and after, three pairs against the shipped art in public/medals/.
  3. The new album, grouped by series, every piece that has been rendered so far.

    .venv/bin/python board.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

def _repo_root(start: Path) -> Path:
    """Walk up until the folder holding `public/medals`, so the scripts survive being moved."""
    for candidate in [start, *start.parents]:
        if (candidate / "public" / "medals").is_dir():
            return candidate
    raise SystemExit("repo root not found above " + str(start))


HERE = Path(__file__).resolve().parent
ROOT = _repo_root(HERE)
FINAL = HERE / "final"
# The art band 2 compares against is the set that shipped BEFORE this round, kept here on
# purpose: `public/medals/` now holds the v2 pieces, so reading "antes" from there would put
# the same image on both sides of the comparison.
SHIPPED = HERE / "before"
OUT = HERE / "medals-v2-board.png"

W = 2400
BG = (18, 19, 24)
INK = (240, 240, 245)
DIM = (150, 152, 165)
LINE = (52, 54, 64)

FONT_DIR = Path("/System/Library/Fonts")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for name in (["HelveticaNeue.ttc"] if not bold else ["HelveticaNeue.ttc"]):
        p = FONT_DIR / name
        if p.exists():
            return ImageFont.truetype(str(p), size, index=1 if bold else 0)
    return ImageFont.load_default()


F_TITLE = font(64, True)
F_H1 = font(40, True)
F_H2 = font(30, True)
F_BODY = font(24)
F_SMALL = font(20)
F_TINY = font(17)


def load(path: Path, size: int) -> Image.Image | None:
    if not path.exists():
        return None
    return Image.open(path).convert("RGBA").resize((size, size), Image.LANCZOS)


def paste(canvas: Image.Image, img: Image.Image, x: int, y: int) -> None:
    canvas.alpha_composite(img, (x, y))


def centered(d: ImageDraw.ImageDraw, text: str, cx: int, y: int, f, fill) -> int:
    w = d.textlength(text, font=f)
    d.text((cx - w / 2, y), text, font=f, fill=fill)
    return int(f.size * 1.35)


def wrapped(d: ImageDraw.ImageDraw, text: str, cx: int, y: int, f, fill, max_w: int) -> int:
    words, line, lines = text.split(), "", []
    for word in words:
        probe = f"{line} {word}".strip()
        if d.textlength(probe, font=f) > max_w and line:
            lines.append(line)
            line = word
        else:
            line = probe
    if line:
        lines.append(line)
    for i, ln in enumerate(lines):
        centered(d, ln, cx, y + int(i * f.size * 1.3), f, fill)
    return int(len(lines) * f.size * 1.3)


# --- content -----------------------------------------------------------------------------------

RARITY_STRIP = [
    ("clean-record-1", "normal", "Hierro ennegrecido", "1 banda lisa · sin luz"),
    ("store-charted-1", "primera edición", "Latón y cobre pulido", "1 banda + 4 remaches · sin luz"),
    ("reviews-5", "limitada", "Acero plateado satinado", "2 bandas concéntricas · 1 chispa"),
    ("clean-record-10", "holográfica", "Cristal prismático", "1 banda en 8 facetas · resplandor"),
    ("year-streak", "firmada", "Oro viejo cálido", "2 bandas + cabujón · aura"),
]

BEFORE_AFTER = ["first-order", "patience-200", "clean-record-1"]

SERIES = [
    ("Primeros pasos · círculo · ámbar",
     ["first-order", "first-payment", "first-arrival", "first-order-closed",
      "first-review", "first-photo-order", "first-store", "first-preorder"]),
    ("La espera · rombo · índigo",
     ["patience-60", "patience-120", "patience-200", "split-arrival"]),
    ("La vitrina · pentágono · borgoña",
     ["collection-10", "collection-50", "collection-150", "arrivals-25"]),
    ("Explorador · escudo · jade",
     ["variety-3", "countries-3", "variety-6", "stores-10"]),
    ("Cronista · hexágono · sepia",
     ["clean-record-1", "store-charted-1", "reviews-5", "clean-record-10"]),
    ("Secretas · estrella · obsidiana",
     ["midnight-order", "swift-arrival", "same-day-settle", "year-streak"]),
]

NAMES = {
    "first-order": ("Primer pedido", "normal"),
    "first-payment": ("Primer pago", "normal"),
    "first-arrival": ("Primera llegada", "normal"),
    "first-order-closed": ("Círculo cerrado", "primera ed."),
    "first-review": ("Primera reseña", "normal"),
    "first-photo-order": ("Del papel a la ficha", "normal"),
    "first-store": ("Puerta nueva", "normal"),
    "first-preorder": ("Pre-reserva anotada", "normal · NUEVA"),
    "patience-60": ("Dos meses de espera", "primera ed."),
    "patience-120": ("La espera larga", "limitada"),
    "patience-200": ("La espera imposible", "holográfica"),
    "split-arrival": ("Llega por partes", "primera ed."),
    "collection-10": ("Diez piezas", "normal"),
    "collection-50": ("Media centena", "primera ed."),
    "collection-150": ("Vitrina llena", "holográfica"),
    "arrivals-25": ("Puerto conocido", "limitada"),
    "variety-3": ("Gustos amplios", "normal"),
    "countries-3": ("Tres fronteras", "primera ed. · NUEVA"),
    "variety-6": ("Colección mixta", "limitada"),
    "stores-10": ("Mapa propio", "holográfica"),
    "clean-record-1": ("Ficha impecable", "normal"),
    "store-charted-1": ("Tienda cartografiada", "primera ed. · REEMPLAZA"),
    "reviews-5": ("Voz de confianza", "limitada · NUEVA"),
    "clean-record-10": ("Archivo limpio", "holográfica"),
    "midnight-order": ("Turno de madrugada", "primera ed."),
    "swift-arrival": ("Llegó volando", "limitada · NUEVA"),
    "same-day-settle": ("Cuentas al día", "holográfica"),
    "year-streak": ("Un año contigo", "firmada"),
}

PENDING = "sin renderizar"


def placeholder(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, size - 6, size - 6], radius=int(size * 0.24), outline=LINE, width=3)
    d.text((size / 2 - d.textlength(PENDING, font=F_TINY) / 2, size / 2 - 10), PENDING, font=F_TINY, fill=(88, 90, 102))
    return img


def main() -> None:
    H = 4400
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    d = ImageDraw.Draw(canvas)
    y = 56

    d.text((80, y), "Medallas v2", font=F_TITLE, fill=INK)
    y += 78
    d.text((80, y), "Propuesta: el álbum pasa al lenguaje RPG de los rangos. 28 medallas, 6 series, "
                    "todas evaluables hoy.", font=F_BODY, fill=DIM)
    y += 60
    d.line([80, y, W - 80, y], fill=LINE, width=2)
    y += 44

    # --- band 1: rarity -------------------------------------------------------------------------
    d.text((80, y), "1 · La rareza ya no es un estilo de dibujo: es el material del marco",
           font=F_H1, fill=INK)
    y += 54
    d.text((80, y), "Antes, una medalla «primera edición» era literalmente un dibujo manga en "
                    "blanco y negro. Ahora las cinco se pintan igual y se distinguen por metal, "
                    "número de piezas y cantidad de luz.", font=F_SMALL, fill=DIM)
    y += 56

    cell = (W - 160) // 5
    art = 300
    top = y
    for i, (key, grade, metal, rule) in enumerate(RARITY_STRIP):
        cx = 80 + cell * i + cell // 2
        img = load(FINAL / f"{key}.png", art) or placeholder(art)
        paste(canvas, img, cx - art // 2, top)
        yy = top + art + 14
        yy += centered(d, grade.upper(), cx, yy, F_H2, INK)
        yy += centered(d, metal, cx, yy, F_SMALL, (214, 190, 140))
        wrapped(d, rule, cx, yy, F_TINY, DIM, cell - 40)
    y = top + art + 150

    # greyscale 32 px proof row
    d.text((80, y), "Las mismas cinco a 32 px y en escala de grises (así se ve una medalla bloqueada):",
           font=F_SMALL, fill=DIM)
    y += 38
    for i, (key, _, _, _) in enumerate(RARITY_STRIP):
        cx = 80 + cell * i + cell // 2
        src = FINAL / f"{key}.png"
        if src.exists():
            small = Image.open(src).convert("RGBA").resize((32, 32), Image.LANCZOS)
            grey = small.convert("LA").convert("RGBA")
            canvas.alpha_composite(grey.resize((96, 96), Image.NEAREST), (cx - 48, y))
            canvas.alpha_composite(small.resize((96, 96), Image.NEAREST), (cx + 60, y))
    y += 130
    d.line([80, y, W - 80, y], fill=LINE, width=2)
    y += 44

    # --- band 2: before / after ------------------------------------------------------------------
    d.text((80, y), "2 · Antes y después", font=F_H1, fill=INK)
    y += 54
    d.text((80, y), "Mismo dato, misma serie, mismo medalKey. Solo cambia el arte.",
           font=F_SMALL, fill=DIM)
    y += 50

    art = 260
    top = y
    group = (W - 160) // 3
    for i, key in enumerate(BEFORE_AFTER):
        gx = 80 + group * i
        cx = gx + group // 2
        before = load(SHIPPED / f"{key}.png", art)
        after = load(FINAL / f"{key}.png", art) or placeholder(art)
        if before:
            paste(canvas, before, cx - art - 30, top)
        paste(canvas, after, cx + 30, top)
        d.text((cx - art - 30 + art // 2 - d.textlength("ANTES", font=F_SMALL) / 2, top + art + 12),
               "ANTES", font=F_SMALL, fill=(190, 120, 120))
        d.text((cx + 30 + art // 2 - d.textlength("DESPUÉS", font=F_SMALL) / 2, top + art + 12),
               "DESPUÉS", font=F_SMALL, fill=(130, 200, 150))
        centered(d, NAMES[key][0], cx, top + art + 48, F_H2, INK)
    y = top + art + 110
    d.line([80, y, W - 80, y], fill=LINE, width=2)
    y += 44

    # --- band 3: the album -----------------------------------------------------------------------
    d.text((80, y), "3 · El álbum completo, por serie", font=F_H1, fill=INK)
    y += 54
    d.text((80, y), "Cada serie llega al mínimo de cuatro y llena su fila. Primeros pasos crece a ocho "
                    "para cerrar sus dos filas.", font=F_SMALL, fill=DIM)
    y += 52

    art = 176
    col = (W - 160) // 8
    for title, keys in SERIES:
        d.text((80, y), title, font=F_H2, fill=(214, 190, 140))
        y += 46
        for i, key in enumerate(keys):
            cx = 80 + col * i + col // 2
            img = load(FINAL / f"{key}.png", art) or placeholder(art)
            paste(canvas, img, cx - art // 2, y)
            name, grade = NAMES[key]
            yy = y + art + 8
            yy += wrapped(d, name, cx, yy, F_SMALL, INK, col - 16)
            wrapped(d, grade, cx, yy, F_TINY, DIM, col - 16)
        y += art + 108

    d.line([80, y, W - 80, y], fill=LINE, width=2)
    y += 30
    d.text((80, y), "28 medallas · 10 normal, 7 primera edición, 5 limitada, 5 holográfica, 1 firmada · "
                    "4 nuevas, 1 reemplazada, 12 que dejan de estar en PRÓXIMAMENTE",
           font=F_BODY, fill=DIM)

    y += 60

    canvas = canvas.crop((0, 0, W, min(H, y)))
    canvas.convert("RGB").save(OUT, quality=94)
    print(f"wrote {OUT} ({canvas.size[0]}x{canvas.size[1]})")


if __name__ == "__main__":
    main()

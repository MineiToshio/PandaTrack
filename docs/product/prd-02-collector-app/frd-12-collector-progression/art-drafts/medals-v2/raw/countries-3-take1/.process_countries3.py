from collections import deque
from pathlib import Path

from PIL import Image


SOURCE = Path(
    "/Users/sergio/.codex/generated_images/01a03c6f-5790-7283-97ac-b7ade512d336/"
    "exec-0f0d74d5-7c5b-4186-84f4-c6c001ea68e4.png"
)
OUTPUT = Path("countries-3.png")
CANVAS_SIZE = 1024
SOURCE_SIZE = 715
PURE_MAGENTA = (255, 0, 255)


def is_border_magenta(rgb: tuple[int, int, int]) -> bool:
    red, green, blue = rgb
    return (
        red >= 140
        and blue >= 140
        and green <= 140
        and abs(red - blue) <= 100
        and min(red, blue) - green >= 45
    )


source = Image.open(SOURCE).convert("RGB")
source = source.resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.LANCZOS)

# Place the generated square on an exact pure-magenta canvas. Scaling keeps every
# visible shield point inside a centered circle with an 85% canvas diameter.
canvas = Image.new("RGB", (CANVAS_SIZE, CANVAS_SIZE), PURE_MAGENTA)
offset = ((CANVAS_SIZE - SOURCE_SIZE) // 2,) * 2
canvas.paste(source, offset)
pixels = canvas.load()

# Four-border connected flood fill. Only pixels reachable from a canvas border
# through magenta-like neighbors enter the removal mask; enclosed pixels cannot.
visited = bytearray(CANVAS_SIZE * CANVAS_SIZE)
queue: deque[tuple[int, int]] = deque()


def enqueue(x: int, y: int) -> None:
    index = y * CANVAS_SIZE + x
    if visited[index] or not is_border_magenta(pixels[x, y]):
        return
    visited[index] = 1
    queue.append((x, y))


for coordinate in range(CANVAS_SIZE):
    enqueue(coordinate, 0)
    enqueue(coordinate, CANVAS_SIZE - 1)
    enqueue(0, coordinate)
    enqueue(CANVAS_SIZE - 1, coordinate)

while queue:
    x, y = queue.popleft()
    if x:
        enqueue(x - 1, y)
    if x + 1 < CANVAS_SIZE:
        enqueue(x + 1, y)
    if y:
        enqueue(x, y - 1)
    if y + 1 < CANVAS_SIZE:
        enqueue(x, y + 1)

# Normalize the connected chroma region to exact #FF00FF before extracting it.
rgba = canvas.convert("RGBA")
rgba_pixels = rgba.load()
for y in range(CANVAS_SIZE):
    row = y * CANVAS_SIZE
    for x in range(CANVAS_SIZE):
        if visited[row + x]:
            rgba_pixels[x, y] = (255, 0, 255, 0)

rgba.save(OUTPUT, format="PNG", optimize=True)

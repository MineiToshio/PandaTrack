---
title: S17 — Desacople total + archivado del subproyecto (la última)
last_updated: 2026-06-17
owner: Sergio Minei
status: done (docs + cambios de `src/`/`.cursor`/`.claude` autorizados por Sergio, sin commitear — Sergio commitea)
scope: barrido de referencias + re-apuntado a hogares permanentes + move docs/redesign → docs/subprojects/redesign + guardia cero-dep + cierre del subproyecto
---

# S17 — Desacople total del taller + archivado

## Objetivo

Hacer que `docs/redesign/` deje de ser una **dependencia viva** del proyecto principal y
pase a ser **historial preservado**, sin links colgantes ni reglas sin fuente. La vara:
después de S17 se podría reconstruir TODO leyendo solo `docs/product/` + `docs/design/`, y
ninguna ruta del proyecto principal apunta ya al path viejo `docs/redesign/`.

Encaje en el cierre del subproyecto: **S14** graduó el sistema a `docs/design/`; **S15**
capturó el diseño por FRD (FDD + prototype); **S16** dejó los FRD/WO rebuild-complete. S17
suelta el taller: corta el cordón y lo archiva.

## Decisión de archivado (gate de Sergio)

No se borra. El rediseño fue un mini-proyecto **implementado** (no un experimento descartado),
así que se **preserva navegable** como historial. Se crea un hogar para subproyectos internos:

- Carpeta nueva: **`docs/subprojects/`** (encaja con la taxonomía de `docs/`; usa el término
  "subproyecto" ya presente en el repo; no suena a cementerio).
- `docs/redesign/` → **movido tal cual** a `docs/subprojects/redesign/` (180 archivos, sin tocar
  los internos).
- Índice nuevo `docs/subprojects/README.md` con tabla de subproyectos + estado (vocabulario
  extensible: **Implementado** · Descartado · En investigación · En pausa). `redesign` =
  **Implementado**.
- El server `demo-screens` de `.claude/launch.json` se **elimina** (el `frd-prototypes` ya sirve
  el repo entero, incluido el demo preservado, si hace falta verlo).

Detalle clave: los docs/reglas permanentes quedan **aislados** del subproyecto (ver "Disposición
aplicada — con corrección de principio"): sin rutas ni links hacia él, solo menciones históricas en
prosa. El subproyecto es historial, no fuente de reglas.

## Barrido (Fase A) — inventario

**37 archivos · 87 líneas** referenciaban `docs/redesign` fuera de esa carpeta (el "~92" de la
consigna era por líneas; verificado: 87 líneas / 37 archivos). Cero refs en `e2e/`, `AGENTS.md`,
`CLAUDE.md`, `package.json`. Los 14 ADRs ya estaban graduados completos en `docs/design/decisions/`.
Durante la ejecución aparecieron 3 links relativos vivos adicionales (`../../../redesign/…`) en
FDDs de PRD-00/PRD-01 que también se re-apuntaron.

## Disposición aplicada (Fase B) — con corrección de principio

**Principio (aclarado por Sergio tras la 1ª pasada):** los docs/reglas permanentes NO deben
**depender** del subproyecto. Nada de "leé la spec acá", "seguí la regla del subproyecto" ni
"implementá como dice el subproyecto". A lo sumo una **mención histórica en prosa, sin ruta**
("se decidió/destiló en el subproyecto de rediseño"). La autoridad es `docs/design/` +
`docs/product/` + `src/`.

La 1ª pasada de Fase B re-apuntó ~60 breadcrumbs a `docs/subprojects/redesign/…` como links
vivos — eso violaba el principio. La **2ª pasada (corrección)** los quitó:

- **Contenido de sistema → `docs/design/`** (specs tokens/states/motion/voice, ADRs del Modal):
  se mantiene (hogar permanente correcto).
- **Reglas cursor** (`design-system-playbook`, `modal-canonical-pattern`, `frd-design-documentation`):
  se **eliminaron** las listas "historical workshop reference" / "source-of-truth: demo+Modal.md"
  y el warning "no copies del demo (ruta)". Reemplazadas por nota histórica sin ruta. `frd-design`
  §9 ya NO manda citar "workshop raw material" como fuente viva.
- **ADRs graduados** (0009, 0010, 0012, 0013, 0014): `updates:`/Demo/Insumo/Origen/notas de proceso
  → **des-rutados** a mención histórica ("subproyecto de rediseño, histórico"). Specs de sistema ya
  apuntaban a `docs/design/`. Cuerpos append-only intactos.
- **docs/design** (PLAYBOOK, components, decisions/README): bloques de referencia histórica al
  taller **eliminados**; el workflow del PLAYBOOK apunta solo al **prototipo por FRD**.
- **docs/product** (8 FDD + 4 FRD + 8 prototipos): intros des-rutadas; bullets "Workshop raw
  material" → "(historical): distilled from the redesign subproject; see git history"; links
  inline (dashboard, landing) → prosa sin link.
- **src** (`globals.css`, `Modal.tsx`, `ModalDialog.tsx`): comentarios de provenance des-rutados;
  Spec/ADRs del Modal → `docs/design/`.
- **`.claude/launch.json`**: server `demo-screens` **eliminado** (el `frd-prototypes` ya sirve el
  repo entero, incluido el demo preservado, si hace falta).

Resultado: **cero rutas/links** hacia el subproyecto desde zonas permanentes; solo menciones de
prosa sin ruta.

## Segunda capa — referencias por nombre de archivo (no solo rutas)

Tras una primera versión que solo limpiaba _rutas_, un barrido definitivo (cruzando los basenames que
existen SOLO en el subproyecto contra los docs permanentes) encontró **~78 líneas más** que citaban
artefactos del taller por **nombre corto** (`tokens.md`, `directions.md`, `demo-screens.html`,
`methodology.md`, `s4-gaps.md`, `cross-cutting-changes.md`, `lessons-learned.md`, `principles.md`,
`screens/*.md`, `modules/*.md`, `components/Modal.md`, etc.) — en ADRs, el PLAYBOOK y ~13 comentarios de
`src/`. Decisión de Sergio: **aislamiento total** → todas des-rutadas a prosa histórica (preservando el
hecho y el número de sección, quitando el nombre de archivo). El contenido de sistema apunta a su hogar
permanente (`tokens.md` → `docs/design/tokens-css.md`, `voice-library.md` → `docs/design/ux-copy.md`,
`motion-system.md` → `docs/design/motion.md`, etc.).

Criterio fino: la guardia bloquea **nombres de archivo** (`.md`/`.html`) y rutas del taller, pero
**permite** términos históricos en prosa ("el red-team del subproyecto", "atelier-gaps gap #1") — la
mención histórica que sí es aceptable.

## Guardia cero-dep

`src/test/redesign-archive-guard.test.ts` — réplica del patrón de `design-token-guard.test.ts`
(sin deps, sin plugins). Escanea `docs/`, `src/`, `.cursor/`, `.claude/`, `AGENTS.md`, `CLAUDE.md` y
falla si, fuera del allowlist mínimo (la carpeta preservada `docs/subprojects/redesign/` + el archivo de
la guardia), un archivo permanente referencia al subproyecto por:

- **Ruta:** `docs/redesign`, `subprojects/redesign` (absoluta o relativa), `_notes/`.
- **Nombre de artefacto del taller** (boundary-anchored, para no matchear nombres permanentes más largos
  como `tokens-css.md` o `wo-02-delivery-create.md`): `demo-screens`, `directions.md`, `tokens.md`,
  `methodology.md`, `principles.md`, `lessons-learned.md`, `cross-cutting-changes.md`, `s4-gaps.md`,
  `atelier-gaps.md`, `voice-library.md`, `motion-system.md`, etc., y el layout `screens/…md`,
  `modules/…md`, `` `components/<Name>.md` ``.

Las **menciones en prosa sin ruta ni nombre de archivo** no disparan la guardia. Aislamiento enforced:
prosa histórica sí, dependencia por ruta/archivo no.

## Verificación

- Grep global: **cero** rutas (`docs/redesign`/`subprojects/redesign`) y **cero** nombres de archivo del
  taller (boundary-anchored) fuera de `docs/subprojects/redesign/`. `src/` no importa ni lee del subproyecto.
- `npm run test` (incl. la nueva guardia) · `type-check` · `lint` · `validate-build`: ver resultado
  registrado en el cierre de la sesión.
- Criterio dueño: reconstruible leyendo solo `docs/product/` + `docs/design/`; los breadcrumbs al
  subproyecto preservado son históricos, no load-bearing.

## Resultado

Subproyecto de rediseño **COMPLETO**. Sistema en `docs/design/`, diseño por FRD en
`docs/product/.../{fdd,prototype}`, historial preservado en `docs/subprojects/redesign/`.

---
title: S15 — Prototipos por FRD + FDDs (registro de diseño en docs/product)
session: 15
type: docs-only (no toca src/; lee docs/redesign como fuente)
status: ✅ completa (8 FRDs con UI cubiertos) · SIN commitear (Sergio commitea)
last_updated: 2026-06-16
owner: Sergio Minei
branch: redesign
---

# S15 — Prototipos por FRD + FDDs

Penúltima fase de cierre del subproyecto de rediseño. Objetivo: dejar el **registro de
diseño de cada FRD con UI dentro de su propia carpeta** en `docs/product/`, para que
`docs/redesign/` (el taller) quede como artefacto desechable (su archivado es S17). Por cada
FRD con UI = **dos artefactos complementarios**:

1. **`prototype/<slug>.html`** — el HTML, referencia visual self-contained extraída del demo
   (verdad del pixel).
2. **`fdd-XX-<slug>.md`** — el doc de diseño en texto ("el prototipo en palabras"): layout,
   color, formas, tipografía, componentes, interacciones, estados, motion y copy de las
   pantallas del FRD, citando `docs/design/` para las reglas de sistema y el prototype para
   la verdad visual.

Juntos = el diseño del FRD reconstruible sin depender de `docs/redesign/`.

**Fuera de alcance de S15:** NO es alineación funcional de FRDs/WOs (eso es S16); NO es el
barrido/archivado de `docs/redesign/` (S17). `docs/redesign/` solo se lee. Los showcases de
**sistema** (modales M01, estados S10, componentes/tokens) ya viven en `docs/design/` (S14)
— no van a ningún FRD; en S15 solo van las pantallas de **producto** por FRD.

## Convención (ratificada en el gate de Sergio)

El gate corrigió la estructura del piloto: **sin subcarpeta `design/`**. El FDD y la carpeta
`prototype/` van **directo dentro de la carpeta del FRD**, y el FDD **espeja el nombre del
FRD** con prefijo `fdd-`:

```text
docs/product/<prd>/frd-XX-<slug>/
  frd-XX-<slug>.md          # contrato funcional (existente)
  fdd-XX-<slug>.md          # el FDD — "el prototipo en palabras"
  prototype/
    <slug>.html             # referencia visual self-contained (abre solo)
  bp-01-<slug>/             # blueprint + work-orders (existente)
```

- Idioma: prosa en **inglés** (convención de docs del repo), copy de UI citado **verbatim en
  `es`**.
- FDD = 9 secciones (overview+pantallas · layout por pantalla · tratamiento visual ·
  componentes · interacciones+estados · copy+voz · responsive · a11y · fuentes) + frontmatter
  product-doc (`id: FDD-XX`, `type: FDD`, `parent: FRD-XX`, `prototype:`, `demo_anchors:`).
- Regla de oro: **REFERENCIAR** `docs/design/` para el sistema, **DESCRIBIR** lo específico
  del FRD, **CITAR** el prototype para el pixel.
- Convención fijada como regla: [`.cursor/rules/frd-design-documentation.mdc`](../../tooling/cursor/rules.md)
  (+ índice `docs/tooling/cursor/rules.md` + nota en `docs/development/file-organization.md`).

## FRDs cubiertos (8)

| FRD                         | Carpeta                                     | Prototype (pantallas)                          | FDD                                     |
| --------------------------- | ------------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| FRD-08 Entregas             | `prd-01/frd-08-delivery-management`         | `delivery-management.html` (19)                | `fdd-08-delivery-management.md`         |
| FRD-05 Pedidos/pagos/envíos | `prd-01/frd-05-order-payment-shipment`      | `order-payment-shipment.html` (55)             | `fdd-05-order-payment-shipment.md`      |
| FRD-04 Tiendas              | `prd-01/frd-04-store-domain`                | `store-domain.html` (25)                       | `fdd-04-store-domain.md`                |
| FRD-07 Ajustes              | `prd-01/frd-07-user-settings`               | `user-settings.html` (17)                      | `fdd-07-user-settings.md`               |
| FRD-03 Shell del colector   | `prd-01/frd-03-collector-app-shell`         | `collector-app-shell.html` (dashboard + shell) | `fdd-03-collector-app-shell.md`         |
| FRD-01 Acceso a la cuenta   | `prd-01/frd-01-account-access-and-recovery` | `account-access-and-recovery.html` (8)         | `fdd-01-account-access-and-recovery.md` |
| FRD-01 Landing (PRD-00)     | `prd-00/frd-01-pre-release-landing`         | `pre-release-landing.html` (2)                 | `fdd-01-pre-release-landing.md`         |
| FRD-04 Legal (PRD-00)       | `prd-00/frd-04-public-legal-transparency`   | `public-legal-transparency.html` (3)           | `fdd-04-public-legal-transparency.md`   |

**FRD-06 (Dashboard & recordatorios)** no recibe FDD/prototype propio: el dashboard es
placeholder/fuera de scope del MVP y su shell vive en FRD-03 (decisión del mapeo de S15).

## Cómo se hicieron los prototypes (self-contained, replicable)

- Se inlinearon el `<style>` y el `<script>` compartidos del demo (`demo-screens.html`); se
  incluyeron **solo las `<section>` del FRD** (mapeo demo → FRD: `#s7-*`+base → órdenes;
  `#s6-*`+base → tiendas; `#s8-*`+base → ajustes; `#s9-*`+base → entregas; `#dashboard` →
  shell; subset `#s11-*` → landing / auth / legal).
- Header del demo reemplazado por uno enfocado (un grupo "Pantallas" autogenerado de los ids
  incluidos).
- `PALETTE_DEFAULT='velvet'`; claves de localStorage con sufijo por FRD (no chocan con el demo
  maestro); fallback del router apuntado a la home del FRD (el slice no tiene `#dashboard`
  salvo el shell), así los cross-links fuera de alcance no dejan la página en blanco.
- Generados con un extractor por rangos de línea; **verificación**: estructura balanceada
  (1 `<head>`/`<style>`/`<body>`/`<main>`, 3 scripts), conteo de `<section>` == ids esperados,
  y spot-check en preview (`npx serve` repo-root, puerto 5610) de órdenes (dark) y landing
  (light) — Velvet default, iconos Lucide, 0 errores de consola.

## Ejecución

- **Pasada 1 (piloto + gate):** FRD-08, formato propuesto + regla. Gate de Sergio → corrección
  de estructura (sin `design/`, FDD al nivel del FRD con nombre espejo).
- **Pasada 2:** prototypes de los 6 FRDs restantes generados mecánicamente; los 7 FDDs
  restantes redactados (uno por FRD) siguiendo el FDD-08 como plantilla exacta.

## Validación

Docs-only (sin comandos de app). Verificado: cada prototype abre standalone en el preview
(light + dark, Velvet, sin errores); los 8 FDD tienen las 9 secciones, frontmatter correcto y
**todos los links relativos resuelven** (a `docs/design/`, glosario, FRD hermano y prototype).
No se commiteó nada (Sergio revisa y commitea).

## Notas

- Se agregó el server `frd-prototypes` (puerto 5610, sirve repo-root) a `.claude/launch.json`
  para verificar cualquier prototype; quitable si molesta.
- Algunos FDD anotan honestamente dónde el prototype del taller quedó incompleto vs el
  contrato del FRD (p. ej. settings: el cropper circular del avatar y el medidor de fuerza de
  contraseña no están dibujados en el demo) — documentado como target del FRD con el prototype
  marcado como snapshot del taller.

## Estado

✅ Completa. 8 FRDs con UI con prototype + FDD. Próxima: **S16** (alineación funcional
FRDs/WOs/blueprints) y **S17** (barrido + archivado de `docs/redesign/`).

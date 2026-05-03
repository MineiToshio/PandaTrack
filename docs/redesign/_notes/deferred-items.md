---
title: Items diferidos del subproyecto de rediseño
last_updated: 2026-05-02
owner: Sergio Minei
status: vigente
---

# Items diferidos del subproyecto de rediseño

Registro de propuestas que aparecieron durante el subproyecto pero que **no entran en el alcance actual** por decisión humana. Cada item incluye origen, decisión, y dónde se va a resolver.

## 1. Sprite sheet completo de la mascota Felix

**Origen.** El agente que cerró S5 (App Shell) propuso una sesión nueva "S6 — Assets y sprites" para producir el sprite sheet de la mascota (5 estados: idle, walking, peeking, celebrating, sleeping) más OG images y favicon, motivado por que `<MascotBubble>` quedó renderizando un placeholder en S5.

**Decisión humana 2026-05-02.** **Diferir fuera del subproyecto.**

**Por qué.**

- El sprite de Felix requiere arte humano real (pixel art profesional o ilustración). Un agente generándolo procedural sale mediocre y termina reemplazándose igual.
- El placeholder actual de `<MascotBubble>` es aceptable hasta que exista arte definitivo.
- Inflar el subproyecto con una sesión de assets retrasa los módulos de negocio (Tiendas, Órdenes, Entregas) que son el corazón del rediseño.

**Dónde se resuelve.** **FRD aparte "Asistente Felix"** que el humano va a definir post-rediseño. Ese FRD cubre:

- Render final (pixel art vs AI hi-res — decisión de S1 fue diferir a S6, ahora se difiere al FRD).
- 5 estados de la mascota con sprite sheets / animaciones.
- Comportamiento conversacional contextual (qué dice, cuándo, library de copy, triggers, settings de usuario, analytics).
- Reglas de aparición fuera de las posiciones canónicas ya definidas en `directions.md` §4.10.

**Nombre de la mascota.** "Felix" surgió de la implementación de S5; la decisión final del nombre (Bento, Ito, Boro, Mochi, Tomo, Kuma, Felix u otro) queda al FRD.

## 2. OG images con paleta Velvet + favicon nuevo

**Origen.** Mismo agente de S5, mismo razonamiento.

**Decisión humana 2026-05-02.** **Diferir a S10 (Onboarding + Landing).**

**Por qué.**

- OG images solo aplican a las pantallas que se comparten (landing, auth) — no al app shell `(app)`.
- Hace más sentido rediseñarlas en la sesión donde se rediseñan landing y onboarding completos (S10).
- El `OgImageTemplate.tsx` actual sigue funcionando con tokens nuevos (consume CSS variables que ya están en Velvet).
- Favicon es trivial — 5 minutos de trabajo cuando se decida la imagen final.

**Dónde se resuelve.** **S10 — Onboarding + Landing**, con scope ampliado para incluir OG images + favicon.

## 3. `<CommandPalette>` ⌘K

**Origen.** Mencionado en specs S4 como aspiracional.

**Decisión humana** (heredada de assumptions S2). **Diferir a post-rediseño** o a S6+ si surge necesidad real durante implementación de módulos.

**Dónde se resuelve.** Sin sesión asignada. Si un módulo lo necesita, se levanta como gap en ese momento.

---

## Convención

Cualquier item nuevo que se identifique durante el subproyecto y que el humano decida no resolver dentro del alcance se suma a este archivo con el mismo formato (origen, decisión, por qué, dónde se resuelve).

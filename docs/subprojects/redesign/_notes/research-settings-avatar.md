---
title: Research — Settings layout + StoreAvatar spec + theme/mascota toggles
session: 02-postresearch
last_updated: 2026-05-01
---

# Research — Settings + componentes

Investigacion sobre los supuestos S1–S7 (settings), T2 (StoreAvatar) y T5 (theme toggle). Cada seccion cierra con una recomendacion y un nivel de confianza (Alta / Media / Baja).

---

## A. Layout Settings desktop

Pregunta: tabs verticales (Opcion A actual) vs cards stackeadas igual que mobile (Opcion B).

### Hallazgos

- **Tabs verticales** son el patron dominante en SaaS premium con cuentas que crecen en complejidad: Vercel (Project Settings, Account Settings), Linear (Workspace + My Settings), Stripe Dashboard (Settings -> sidebar de secciones), GitHub (Profile/Account/Appearance/Notifications/Billing), Notion (Settings & members con sub-grupos). El usuario joven 18–25 acostumbrado a estos productos ya tiene el modelo mental.
- **Cards stackeadas** (estilo iCloud web, Cash App, Robinhood) funcionan cuando hay <=4 secciones cortas o cuando el publico es generalista, no power user. Escalan mal: con 8+ secciones obliga a scroll largo, pierde "una sola decision activa por viewport" (principio §2 del rediseño), y la jerarquia visual se aplana porque cada card compite con la siguiente.
- **Mixto / sub-secciones expandidas** (Slack preferences, Figma settings) anida temas relacionados dentro del mismo panel — util cuando hay >12 nodos. Hoy PandaTrack tiene 3 secciones; ese patron es over-engineering.
- **Mobile-friendly al cambiar viewport.** Tabs verticales colapsan limpiamente a las cards stackeadas que ya tiene mobile (el contenido NO cambia, solo el chrome de navegacion). Cards stackeadas en desktop generan re-layout cuando el viewport ya es ancho (desperdicia cols 7-12).
- **Escalabilidad futura.** Notifications, Billing, Integrations, Connected accounts, Sessions/Devices son secciones probables en S3+. Tabs verticales crecen sin redisenio; cards stackeadas requieren "paginacion vertical" y rompen el escaneo.
- Senial estetica: tabs verticales transmiten "este producto sabe lo que hace". Cards stackeadas en desktop suelen leerse como "diseño mobile-first sin pulir el desktop".

### Recomendacion + confianza

- **Mantener Opcion A: tabs verticales (cols 1-3) + contenido (cols 4-12).** Confianza: **Alta**.
- Justificaciones secundarias:
  - El shell `(app)/layout` ya tiene sidebar 240px — los tabs verticales internos del settings se leen como un "drill-down" coherente y no compiten con el sidebar global porque viven dentro del card area del contenido.
  - Cuando lleguen Notifications/Billing/Integrations el agregado es trivial (una row mas en la sidebar de tabs, sin redisenar el resto).
  - Confirma S1.

---

## B. StoreAvatar spec final

### B1. Sizes

Encuesta de uso en la app (lo-fi S2):

- 24px: chip inline en breadcrumb / token reference / order row dense.
- 32px: order list dense default, payment row.
- 40px: order list comoda, delivery list, store row en combobox.
- 56px: store detail header, order detail header, profile-style avatars en cards grandes.

Comparativa con design systems:

- Pajamas (GitLab): 16/24/32/48/64/96.
- Uber Base: drops second letter at 24.
- Shadcn / Radix: estandar 24/32/40/48/64.

**Decision:** sizes **24 / 32 / 40 / 56**. NO incluir 48 — colisiona con 40 (delivery list) y 56 (header) sin caso de uso real. NO incluir 16 — la letra fallback no es legible y la receta del border 28% se pierde por sub-pixel rendering. Si en S5 aparece un caso "16px en breadcrumb compacto", se reemplaza por el icono `store` de Lucide en vez del avatar. Confianza: **Alta**.

### B2. Una letra o dos

- GitHub: 1 letra (default avatar de github.com/identicons usa hash, no letra; pero avatares custom de orgs y bots con fallback usan 1 char).
- Notion: 1 letra (workspace icon fallback).
- Slack: 1–2 dependiendo del tamaño (drop a 1 letra cuando size <32).
- Apple Mail / iMessage contacts: 2 letras (initials de first+last).
- Uber Base / Shadcn: 2 letras hasta 24, drop a 1.
- **Realidad de las tiendas en PandaTrack:** los nombres son brand names ("Mandarake", "Mercari", "Surugaya", "Mr. Toys", "AliExpress") — NO son personas con first+last. Una sola letra ("M", "S") + tinte indigo + border 28% se lee como **monograma de marca**, lo cual encaja con el tono "Bento Atelier" sereno. Dos letras se leen como **iniciales de persona** y rompen la lectura como tienda.

**Decision:** **una sola letra**, primera del nombre, en mayuscula. Casos especiales: si el nombre arranca con simbolo o numero, se usa la primera letra alfabetica disponible; si no hay ninguna, fallback al icono `store` de Lucide. Confianza: **Alta**. Confirma OL5.

### B3. Logo no cuadrado

Opciones evaluadas: letterbox (bordes blancos), `object-fit: contain` con padding interno, `object-fit: cover` (recorte agresivo).

**Decision:** `object-fit: contain` con **padding interno 12.5% del lado** (3px en avatar 24, 7px en avatar 56) sobre el background `--surface-elevated` (sin tinte indigo, porque ya hay logo). El logo se centra y respira; se evita el recorte de cover (que mutilaria un wordmark) y el letterbox blanco (que rompe el tema dark). El border `--border` 1px se mantiene para separar el avatar de la card. Confianza: **Media-Alta** — vale la pena validar con 5–10 logos reales en S6 antes de cerrar el padding exacto.

### B4. Logo con transparencia

Si el logo viene con alpha channel (PNG/SVG con fondo transparente): el background del avatar es `--surface-elevated` siempre, **nunca el tinte indigo del fallback**. Razon: el tinte indigo es la senial "no hay logo, esto es un monograma". Si el logo flota sobre indigo se pierde la regla de "indigo = no hay imagen", y el contraste de logos coloridos contra indigo se vuelve inestable.

**Decision:** logo con o sin transparencia siempre se renderiza sobre `--surface-elevated`. Si el logo es un wordmark blanco que se pierde en light mode, la pipeline de upload debe detectarlo y avisar al usuario en S3 (out of scope para spec actual; documentar como gap). Confianza: **Alta** para la regla; **Baja** para detalles del pipeline de upload.

### B5. Status indicator (descartado o aprobado)

Pregunta original: avatar con dot de status (tienda activa / con problemas).

**Descartado.** Razones:

- Hoy no existe el concepto "tienda con problemas" en el modelo de datos. Inventarlo solo para justificar el dot es feature creep.
- Si en S4+ aparece un caso real (ej. "tienda archivada"), la senial debe ir en **chip de la row** (consistente con order status), no en el avatar — el avatar es identidad, no estado.
- Reservar la esquina inferior-derecha del avatar para un futuro use case de mayor valor (notification dot del shell user avatar).

Confianza: **Alta**.

### Spec final del componente (props, estados, sizes)

```tsx
type StoreAvatarSize = 24 | 32 | 40 | 56;

interface StoreAvatarProps {
  store: { name: string; logoUrl?: string | null };
  size: StoreAvatarSize;
  shape?: "circle" | "rounded"; // default: circle (mobile / lists), rounded (desktop store header)
  className?: string;
}
```

- **Default shape:** `circle` en mobile y en cualquier list/row. `rounded` (radius-lg, 12px) solo en desktop store header (mas contenedor que avatar).
- **Render con logo:** `<img src={logoUrl} alt={store.name}>` con `object-fit: contain`, padding interno 12.5%, background `--surface-elevated`, border 1px `--border`.
- **Render sin logo:** background `color-mix(in oklch, var(--accent) 14%, var(--surface-elevated))`, border 1px `color-mix(in oklch, var(--accent) 28%, var(--border))`, letra inicial color `var(--accent)`, `font-display` 600, line-height 1, font-size = 0.5 \* size (12 / 16 / 20 / 28).
- **Edge cases:**
  - logo broken / 404 → fallback automatico a la receta sin logo (componente captura `onError` del img).
  - nombre vacio → letra "?" en `--text-muted`, sin tinte indigo.
- **Estados:** ningun estado interactivo (no hover, no focus, no active) — el avatar es display-only. El interactivo lo aporta el wrapper (row clickable, link).
- **Performance (alta densidad):** la receta usa solo CSS variables y un img tag o un span — render cost equivalente a un Tailwind div estandar. Lista densa 50 rows = 50 nodes ligeros, sin layout thrashing. Validado mentalmente; confirmar con React Profiler en S6.

Confianza global del spec: **Alta**.

---

## C. Theme toggle ubicacion

### Hallazgos

- **Shell-only:** Linear (toggle accesible via command palette `theme`), Notion (toggle en sidebar bottom expandible). Pro: una sola fuente de verdad. Contra: discoverability baja para usuarios que no usan keyboard.
- **Settings-only:** GitHub (Profile -> Appearance), Cursor (Settings -> Theme). Pro: settings es donde el usuario "espera configurarlo". Contra: requiere 2 clicks (sidebar -> settings -> tab) cada vez que cambia animo o luz ambiente.
- **Ambos lugares:** Vercel (toggle en topbar + Account Settings -> Appearance), Slack (Preferences -> Themes con shortcut + tema rapido en menu de usuario), VS Code (command palette + settings JSON). Es el patron mas comun en apps premium maduras.
- **Auto-detect-only:** sites publicos / blogs (`prefers-color-scheme`). No aplica a un producto autenticado donde el usuario espera control explicito.
- **"System" como opcion default:** estandar en Vercel, Linear, Notion, Stripe, GitHub. Es la expectativa de la generacion 18–25 que vive con auto-dark del OS de noche.

### Recomendacion + confianza

- **Mantener T5: ambos lugares (shell + settings).** Confianza: **Alta**.
- Detalles:
  - Shell: icon button con icono `sun` / `moon` / `monitor` segun estado actual; click cicla light → dark → system. Tooltip "Tema: {actual}".
  - Settings -> Preferences: row dedicada "Tema" con tres chips toggle (Claro / Oscuro / Sistema).
  - Misma fuente de verdad: `localStorage["theme"]` con valor `"light" | "dark" | "system"`. Cambiar en uno se refleja en el otro al instante.
  - **No genera confusion** porque ambos muestran exactamente el mismo valor; consistency cost es bajo (un solo handler compartido).
  - Default initial value: `"system"`.
- Confirma S4 y T5.

---

## D. Toggle "Mostrar mascota" ubicacion

### Hallazgos

- **D1 — Preferences (current):** la mascota es preferencia personal, settings es donde se espera. Ironia explicita ("el toggle vive donde la mascota no aparece") es divertida pero no compromete la UX.
- **D2 — Seccion "Apariencia" nueva:** uniría theme + mascota bajo el mismo paraguas visual. Ventaja: discoverability (theme y mascota son los dos toggles "esteticos"). Desventaja: agregar una cuarta seccion solo para 2 rows infla el chrome.
- **D3 — Click derecho en la mascota:** discoverable solo para usuarios que prueban context menu. Bajo descubrimiento. Tampoco existe en mobile.
- **D4 — Long-press en la bubble mobile:** cool factor alto pero no descubrible sin onboarding. Riesgo de toggle accidental al intentar mover la mascota.
- **Comparativa con apps con personalidad:** Duolingo no expone toggle del owl (solo "Reduce Motion" del OS desactiva animaciones). Discord no expone toggle de Wumpus. GitHub no expone toggle de Octocat. **Ninguna app premium expone un toggle dedicado para esconder su mascota.**
- Pero PandaTrack si lo necesita por una razon especifica: la mascota tiene **bubble idle 56×56 que ocupa pixel real** en cada pantalla. Esconderla es legitimo (usuarios mayores, sesiones de concentracion, accessibility por movimiento). No es comparable con un Wumpus que solo aparece en empty states.

### Recomendacion + confianza

- **D1 (Preferences) + bonus discoverability hint.** Confianza: **Media-Alta**.
- Detalle:
  - Toggle vive en `settings -> Preferences`, row "Mostrar mascota" con switch + helper "Tu compañera panda aparece en una esquina y celebra tus logros."
  - **Discoverability extra:** la mascota misma muestra un menu contextual minimo en hover (desktop) / long-press (mobile) con dos acciones: "Ocultar mascota" + "Configurar". "Ocultar" = toggle off (mismo state que Preferences). "Configurar" = link a `settings#mostrar-mascota`. Esto resuelve el caso "estoy harto de ella ahora" sin obligar a abrir settings, y mantiene Preferences como fuente de verdad.
  - NO se crea seccion "Apariencia" — overengineering para 2 rows.
- Confirma S3 con la enmienda del menu contextual de la mascota.

---

## E. Cooldown del username — UX

### Hallazgos

- **Discord:** rate-limited tras 2 cambios/hora en username; el UI muestra error genérico al intentar editar (frustracion documentada en issues; no hay chip preventivo). Pattern reactivo, no anticipativo.
- **GitHub:** sin cooldown explicito en username changes para usuarios normales; rate limiting solo via API. El UI no comunica nada hasta el error.
- **Twitter/X:** sin cooldown; handle change instantaneo.
- **El antipatron comun:** esconder el cooldown hasta que el usuario intenta cambiar -> error 429 / "demasiados cambios" sin contexto -> frustracion + ticket de soporte.
- **El patron deseable** (poco visto pero correcto): comunicar el cooldown **antes** de que el usuario intente, con timer visible de cuanto falta para poder cambiarlo.
- Riesgo de E1 (chip warning visible siempre): ruido visual permanente para un usuario que solo entra a settings 2 veces al año. Pero la otra cara es que ese mismo usuario probablemente no recuerda que existe el cooldown — la chip lo ahorra del intento fallido.

### Recomendacion + confianza

- **Hibrido E1 + E2 con activacion contextual.** Confianza: **Media-Alta**.
- Regla:
  - Si el usuario **acaba de cambiar el username** (cooldown activo) -> **chip warning visible** con timer "Podras cambiarlo en {days} dias" debajo del valor actual. Persistente todo el periodo.
  - Si el cooldown ya expiró -> **sin chip**, solo el pencil icon estandar para editar.
  - En estado "intentando editar" con cooldown activo: input deshabilitado + chip warning + helper text "Cambiaste tu usuario hace poco. Podras cambiarlo de nuevo en {days} dias.".
- Esto es estrictamente la opcion E1 cuando aplica, y E0 (nada) cuando no aplica. Evita el "ruido permanente" del miedo originario porque la chip solo aparece durante los 30 dias post-cambio. Para un usuario nuevo, la primera vez que cambia username NO ve la chip — solo aparece despues del cambio, cuando se vuelve relevante.
- Confirma S5 con la enmienda de "solo durante el periodo activo".

---

## F. "Cerrar sesion en todos los dispositivos"

### Hallazgos

- WorkOS / Auth0 / FusionAuth recomiendan exponer session revocation visiblemente en account settings.
- web.dev best practices: sign-out functionality debe ser claramente visible, no escondida.
- Pero **"cerrar sesion en todos los dispositivos"** es un superset de logout: implica revocacion de tokens en backend.
  - Vercel: visible siempre en Account -> Sessions con lista de dispositivos.
  - GitHub: visible siempre en Settings -> Sessions con boton "Sign out other sessions".
  - Stripe Dashboard: visible siempre en Settings -> Security.
  - Linear: solo aparece si hay >1 sesion activa.
- **Mostrarlo siempre con label estatico** ("Cerrar sesion en todos los dispositivos") + ejecutarlo cuando se clickea es el patron mas comun. Mostrarlo deshabilitado cuando solo hay 1 sesion activa es engineering excesivo y requiere consultar el numero de sesiones (round-trip extra).
- Mostrarlo **condicional a la capability** (presente solo si el backend lo soporta) es defensible para PandaTrack: el supuesto S7 dice "si la capability existe". Si la capability NO existe, ocultar el boton evita falsa promesa.

### Recomendacion + confianza

- **Mostrarlo siempre que la capability exista en el backend (regla del condicional al feature, no al numero de sesiones).** Confianza: **Alta**.
- Detalle:
  - Si `account.capabilities.signOutAllDevices === true` -> render del boton ghost destructive al pie de la seccion Account.
  - Si la capability no existe (backend no implementado todavia) -> el boton no se renderiza. El usuario nunca ve un boton roto.
  - Confirmacion modal antes de ejecutar: "Vamos a cerrar tu sesion en todos los dispositivos, incluido este. Tendras que volver a iniciar sesion." con CTA "Cerrar todo" + "Volver".
  - Tras confirmar -> redirect a `/login` con toast "Sesiones cerradas en todos los dispositivos.".
- Confirma S7 con la enmienda explicita de "siempre que la capability exista, no condicionado al numero de sesiones".

---

## Resumen ejecutivo

| Decision                                | Recomendacion                                                                       | Confianza  |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| A. Layout settings desktop              | Opcion A: tabs verticales (cols 1-3) + contenido (cols 4-12). Confirma S1.          | Alta       |
| B1. StoreAvatar sizes                   | 24 / 32 / 40 / 56. No 48, no 16.                                                    | Alta       |
| B2. Una vs dos letras                   | Una letra (monograma de marca, no iniciales de persona). Confirma OL5.              | Alta       |
| B3. Logo no cuadrado                    | `object-fit: contain` con padding interno 12.5% sobre `--surface-elevated`.         | Media-Alta |
| B4. Logo con transparencia              | Siempre sobre `--surface-elevated`, nunca sobre tinte indigo.                       | Alta       |
| B5. Status indicator                    | Descartado para S2.                                                                 | Alta       |
| C. Theme toggle ubicacion               | Ambos: shell + settings, misma fuente de verdad. Default `system`. Confirma T5/S4.  | Alta       |
| D. Toggle "Mostrar mascota"             | Preferences + menu contextual mascota como discoverability bonus. Confirma S3.      | Media-Alta |
| E. Cooldown username                    | Chip warning solo durante el periodo activo, no permanente. Enmienda S5.            | Media-Alta |
| F. Cerrar sesion todos los dispositivos | Visible si la capability existe; no condicional al numero de sesiones. Confirma S7. | Alta       |

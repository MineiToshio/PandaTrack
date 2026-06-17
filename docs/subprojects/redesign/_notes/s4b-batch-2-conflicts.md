# S4B Batch 2 — Backward-compatibility conflicts

Decisions made during S4 implementation when the new API conflicted with existing consumers.

## 1. Select — custom popover deferred to S12

**Spec:** Custom popover with keyboard nav, type-to-select, grouped options, `onChange(value: string)`.
**Conflict:** 7+ consumers use native `<select>` with `children` and native `ChangeEvent` handler.
**Decision:** Dual-mode `Select`:

- `options` prop present → new controlled mode (custom popover, `onChange(value: string)`).
- `children` prop present → native mode (preserves legacy `<select>` API with Velvet tokens).
  **Native `size` attribute:** Omitted from `SelectNativeProps` via `Omit<SelectHTMLAttributes, "size">` to avoid type collision with design-system `size: "sm" | "md" | "lg"`.
  **S12 delta:** Bottom-sheet on mobile (> 6 options) and Floating UI positioning.

## 2. IconButton — API incompatibility

**Spec:** `icon: ReactNode`, `label: string` (mandatory aria-label), new variants `"primary" | "secondary" | "ghost" | "destructive-ghost"`.
**Conflict:** 8 consumers use `Icon: LucideIcon`, `iconClassName: string`, `variant: "standard" | "outline"`.
**Decision:**

- Both `icon: ReactNode` and `Icon: LucideIcon` accepted (icon takes precedence).
- `iconClassName` accepted and silently ignored (icon is passed as ReactNode by new consumers).
- `"outline"` → maps to "secondary" styling; `"standard"` → maps to "ghost" styling.
- `aria-label` remains required via the `"aria-label": string` prop type.

## 3. Label — legacy size and color props

**Spec:** `size: "sm" | "md"`, no `color` or `spacing`.
**Conflict:** Consumers pass `size="xs"`, `size="2xs"`, `size="lg"`, `color="title"`, `spacing="tight"`.
**Decision:** Expanded `LabelSize` to include `"xs" | "2xs" | "lg"` (all render as caption or body). Added `color?: string` and `spacing?: string` to `LabelProps` — silently accepted, no visual effect. These props are legacy CVA artifacts with no S4 equivalent.

## 4. DateInput — new file, no breaking change to DatePickerInput

**Spec:** `value: "YYYY-MM-DD" | null` (ISO string), `min/max` ISO strings.
**Conflict:** Existing `DatePickerInput.tsx` uses `Date | null`.
**Decision:** Created `DateInput.tsx` (new file) coexisting with `DatePickerInput.tsx`. No consumers migrated in S4; migration deferred to S12 per-page refactor.

## 5. Textarea — onChange signature kept native

**Spec:** Proposed `(value: string) => void`.
**Conflict:** Same pattern as Input — existing consumers use `React.ChangeEvent<HTMLTextAreaElement>`.
**Decision:** Kept native `onChange: ChangeEventHandler<HTMLTextAreaElement>` via `TextareaHTMLAttributes`. Normalized `\r\n → \n` before calling it. S12 delta documented.

import { COLLECTOR_PRIMARY_SECTION_CLASSNAME } from "@/lib/styles";

/**
 * Sibling settings surfaces (Profile, Account, Preferences) and other collector primary panels.
 * Implemented by {@link COLLECTOR_PRIMARY_SECTION_CLASSNAME} in `src/lib/styles.ts`.
 */
export const SETTINGS_SECTION_SURFACE_CLASSNAME = COLLECTOR_PRIMARY_SECTION_CLASSNAME;

/**
 * Form section headings inside settings cards (e.g. "Cambiar contraseña").
 * Uses `font-semibold` to sit clearly above `<Label>` (`font-medium`) field labels inside the same form.
 * Pair with `Typography` `size="sm"` when the title is not a `<label>`.
 */
export const SETTINGS_FIELD_GROUP_TITLE_CLASSNAME = "font-semibold text-foreground";

/**
 * Eyebrow label for display-only data blocks inside settings sections (e.g. email address display).
 * Small, uppercase, tracked: clearly reads as a "category label above a value", not a heading.
 * Pair with `Typography` `size="2xs"` and place above the prominent data value.
 */
export const SETTINGS_DISPLAY_BLOCK_EYEBROW_CLASSNAME = "font-semibold uppercase tracking-[0.07em] text-text-muted";

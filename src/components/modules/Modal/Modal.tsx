"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import type { ModalProps } from "./Modal.types";
import ModalDialog from "./ModalDialog";
import ModalSheet from "./ModalSheet";

/**
 * # Modal — canonical adaptive modal (ADR 0008 + Extension)
 *
 * **THIS IS THE ONLY MODAL COMPONENT IN THE APP.** Any confirm dialog,
 * destructive prompt, info overlay, form-in-modal, or decision overlay
 * across PandaTrack MUST consume this component. Do not create new modal
 * components. Do not roll a dialog from scratch with a portal + div.
 * Do not copy the visual from legacy modals you may find in the demo
 * HTML — those have been mapped to this same canonical pattern.
 *
 * If you need behavior this component does not yet support, extend it
 * here (add a prop, a tone, a size) — do not fork it.
 *
 * ## Adaptive behavior
 * - **Desktop (≥768px)**: renders `<ModalDialog>` — centered hand-rolled
 *   dialog with Semantic Depth visual contract.
 * - **Mobile (<768px)**: renders `<ModalSheet>` — bottom sheet using Vaul
 *   for drag-to-dismiss + iOS safe area + scroll lock. Same Semantic
 *   Depth language (icon-circle, tones, backdrop blur).
 *
 * The choice is automatic via `useIsMobile()`. Consumers see a single
 * public API.
 *
 * ## Visual contract (Semantic Depth, both variants)
 * - Backdrop `blur(8px)` with light/dark calibrated tints.
 * - Icon-circle 48px tonal (default `--accent`, destructive, warning, info).
 * - Border-radius 20px (`--radius-2xl`); top corners only on mobile sheet.
 * - Spring enter (`280ms linear stops`) on desktop, slide-up on mobile.
 * - `prefers-reduced-motion` → fade only, no scale.
 * - Focus trap, Esc to close, backdrop click / drag-down to close (when
 *   `dismissible`).
 *
 * ## API summary
 * - Required: `isOpen`, `onClose`, `title`.
 * - Visual: `icon` + `tone` (header), `size` (`md` 460px / `lg` 768px —
 *   desktop only), `subtitle` (or legacy `description`).
 * - Actions: `primaryAction`, `secondaryAction`, `tertiaryAction`.
 * - Behavior: `dismissible` (default `true`), `role` (`dialog` |
 *   `alertdialog`).
 * - Backward-compat aliases preserved: `description`,
 *   `closeOnBackdropClick`, `closeButtonLabel`.
 *
 * ## When to use which `tone`
 * - `default` — informational, neutral confirm, form modal.
 * - `destructive` — irreversible action (delete, cancel order, remove store).
 * - `warning` — caution / non-destructive but sensitive (report, flag, dispute).
 * - `info` — explanatory / decision with multiple non-destructive paths.
 *
 * ## Related
 * - Spec: `docs/design/components.md` + `docs/design/interface-patterns.md` (Modals & overlays).
 * - ADRs: `docs/design/decisions/0008-modal-enhancement.md`,
 *   `docs/design/decisions/0010-ui-primitive-libraries-policy.md`.
 * - Cursor rules: `.agents/rules/modal-canonical-pattern.mdc`,
 *   `.agents/rules/ui-libs-policy.mdc`.
 */
export default function Modal(props: ModalProps) {
  const isMobile = useIsMobile();
  return isMobile ? <ModalSheet {...props} /> : <ModalDialog {...props} />;
}

import type { ReactNode } from "react";
import Card from "@/components/core/Card";
import Eyebrow from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";

export type DetailSidebarProps = {
  /** Slot 1: stats / key metadata of the resource. Omitted if `null`/`undefined`. */
  resumen?: ReactNode;
  /** Slot 2: action CTAs (reversible only — destructive irreversibles go to header overflow). */
  acciones?: ReactNode;
  /** Slot 3: viewer's private note. Always rendered when provided. */
  notaPrivada?: ReactNode;
  /** Optional fourth slot for governance / admin cards. Rendered after notaPrivada. */
  governance?: ReactNode;
  /** Localized labels for slot eyebrows. */
  labels?: {
    resumen?: string;
    acciones?: string;
    notaPrivada?: string;
    notaPrivadaEyebrow?: string;
    governance?: string;
  };
  /** Localized aria-label for the wrapping `<aside>`. */
  ariaLabel?: string;
  className?: string;
};

const DEFAULT_LABELS = {
  resumen: "Resumen",
  acciones: "Acciones",
  notaPrivada: "Tu nota privada",
  notaPrivadaEyebrow: "TU NOTA PRIVADA · solo tú la ves",
  governance: "Gestión",
};

/**
 * DetailSidebar — three (+ optional governance) slot wrapper for resource detail pages.
 * Order is fixed: Resumen · Acciones · Nota privada · Gestión (when present).
 * Mobile: stacks below main column. Desktop: sticky aside.
 *
 * ADR 0003 D7 — sidebar order is inviolable, nota privada always lives in sidebar (not body).
 * ADR 0001 D6 — irreversible actions go to header overflow, NOT to `acciones`.
 */
export default function DetailSidebar({
  resumen,
  acciones,
  notaPrivada,
  governance,
  labels,
  ariaLabel = "Resource information",
  className,
}: DetailSidebarProps) {
  const merged = { ...DEFAULT_LABELS, ...(labels ?? {}) };

  return (
    <aside
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col gap-4",
        "md:[position:sticky] md:[top:calc(var(--app-banner-offset,0px)_+_var(--header-h-desktop,4rem)_+_var(--space-4,1rem))] md:gap-6",
        className,
      )}
    >
      {resumen != null && (
        <Card variant="elevated" padding="md" as="section" aria-label={merged.resumen}>
          <Eyebrow as="h2" className="mb-3">
            {merged.resumen}
          </Eyebrow>
          <div className="flex flex-col gap-3">{resumen}</div>
        </Card>
      )}
      {acciones != null && (
        <Card variant="elevated" padding="md" as="section" aria-label={merged.acciones}>
          <Eyebrow as="h2" className="mb-3">
            {merged.acciones}
          </Eyebrow>
          <div className="flex flex-col gap-2">{acciones}</div>
        </Card>
      )}
      {notaPrivada != null && (
        // `outlined` (surface, no elevation) so the inner textarea — which uses
        // `--surface-elevated` — visually stands out against the card body, matching
        // the HTML demo where the private note card is non-elevated.
        <Card variant="outlined" padding="md" as="section" aria-label={merged.notaPrivada}>
          <Eyebrow as="h2" className="mb-3">
            {merged.notaPrivadaEyebrow}
          </Eyebrow>
          {notaPrivada}
        </Card>
      )}
      {governance != null && (
        <Card variant="elevated" padding="md" as="section" aria-label={merged.governance}>
          <Eyebrow as="h2" className="mb-3">
            {merged.governance}
          </Eyebrow>
          <div className="flex flex-col gap-3">{governance}</div>
        </Card>
      )}
    </aside>
  );
}

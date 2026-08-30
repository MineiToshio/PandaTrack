import type { ComponentType, ReactNode, SVGProps } from "react";
import Card from "@/components/core/Card";
import Eyebrow, { type EyebrowTone } from "@/components/core/Eyebrow";
import { cn } from "@/lib/styles";

const TOP_ACCENT_VAR: Record<EyebrowTone, string> = {
  muted: "var(--text-muted)",
  accent: "var(--accent)",
  cool: "var(--accent-cool)",
  warm: "var(--accent-warm)",
  success: "var(--success)",
  warning: "var(--warning)",
  destructive: "var(--destructive)",
};

type SlotAccent = {
  /** Lucide icon shown inside the chip eyebrow for this slot. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Chip tone for the eyebrow. When set the slot eyebrow renders as a tinted pill. */
  tone?: EyebrowTone;
  /** Top accent border (2px) coordinated with the eyebrow tone. */
  topAccent?: EyebrowTone;
};

export type DetailSidebarProps = {
  /** Slot 1: stats / key metadata of the resource. Omitted if `null`/`undefined`. */
  resumen?: ReactNode;
  /** Slot 2: action CTAs (reversible only — destructive irreversibles go to header overflow). */
  acciones?: ReactNode;
  /**
   * Slot 3: viewer's private note. Rendered DIRECTLY without a wrapping Card — the consumer's
   * component (typically `<PrivateNoteCard>`) provides its own card chrome (surface + chip + top
   * border). Sibling card spacing is preserved by the aside flex gap.
   */
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
  /** S8 accent treatment per slot. Apply chip eyebrow + top-border tone independently. */
  accents?: {
    resumen?: SlotAccent;
    acciones?: SlotAccent;
    governance?: SlotAccent;
  };
  /** Localized aria-label for the wrapping `<aside>`. */
  ariaLabel: string;
  className?: string;
};

const DEFAULT_LABELS = {
  resumen: "Resumen",
  acciones: "Acciones",
  notaPrivada: "Tu nota privada",
  notaPrivadaEyebrow: "TU NOTA PRIVADA · solo tú la ves",
  governance: "Gestión",
};

function slotStyle(accent: SlotAccent | undefined) {
  if (!accent?.topAccent) return undefined;
  return { borderTop: `2px solid color-mix(in oklch, ${TOP_ACCENT_VAR[accent.topAccent]} 55%, transparent)` };
}

function SlotEyebrow({ accent, children }: { accent: SlotAccent | undefined; children: ReactNode }) {
  if (accent?.tone) {
    return (
      <Eyebrow as="h2" variant="chip" tone={accent.tone} icon={accent.icon} className="mb-3">
        {children}
      </Eyebrow>
    );
  }
  return (
    <Eyebrow as="h2" className="mb-3">
      {children}
    </Eyebrow>
  );
}

/**
 * DetailSidebar — three (+ optional governance) slot wrapper for resource detail pages.
 * Order is fixed: Resumen · Acciones · Nota privada · Gestión (when present).
 * Mobile: stacks below main column. Desktop: sticky aside.
 *
 * ADR 0003 D7 — sidebar order is inviolable, nota privada always lives in sidebar (not body).
 * ADR 0001 D6 — irreversible actions go to header overflow, NOT to `acciones`.
 *
 * Note: the `notaPrivada` slot intentionally has no wrapping `<Card>` so the consumer's
 * card-styled component (e.g. `<PrivateNoteCard>`) sits flush in the sidebar without
 * double-card nesting. Resumen / acciones / governance are wrapped because they receive
 * raw content.
 */
export default function DetailSidebar({
  resumen,
  acciones,
  notaPrivada,
  governance,
  labels,
  accents,
  ariaLabel,
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
        <Card
          variant="elevated"
          padding="md"
          as="section"
          aria-label={merged.resumen}
          style={slotStyle(accents?.resumen)}
        >
          <SlotEyebrow accent={accents?.resumen}>{merged.resumen}</SlotEyebrow>
          <div className="flex flex-col gap-3">{resumen}</div>
        </Card>
      )}
      {acciones != null && (
        <Card
          variant="elevated"
          padding="md"
          as="section"
          aria-label={merged.acciones}
          style={slotStyle(accents?.acciones)}
        >
          <SlotEyebrow accent={accents?.acciones}>{merged.acciones}</SlotEyebrow>
          <div className="flex flex-col gap-2">{acciones}</div>
        </Card>
      )}
      {notaPrivada}
      {governance != null && (
        <Card
          variant="elevated"
          padding="md"
          as="section"
          aria-label={merged.governance}
          style={slotStyle(accents?.governance)}
        >
          <SlotEyebrow accent={accents?.governance}>{merged.governance}</SlotEyebrow>
          <div className="flex flex-col gap-3">{governance}</div>
        </Card>
      )}
    </aside>
  );
}

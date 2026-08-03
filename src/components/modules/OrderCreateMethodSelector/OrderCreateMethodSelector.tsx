"use client";

import Link from "next/link";
import { ChevronRight, Image as ImageIcon, Info, PenLine } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import Chip from "@/components/core/Chip";
import Modal from "@/components/modules/Modal/Modal";
import { getPosthogDataAttributes } from "@/lib/analytics/posthogDataAttributes";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import {
  isPhotoBagExhausted,
  type PhotoCounterSnapshot,
} from "@/app/[locale]/(app)/orders/_components/share/photoCounterContract";

type OrderCreateMethod = "image" | "manual";

type OrderCreateMethodSelectorBaseProps = {
  locale: string;
  className?: string;
  /**
   * The collector's photo balance, read server-side by whichever surface mounts the selector.
   * `null` when the surface has no balance to show (it is not worth a query there), which hides
   * the counter line exactly like the uncapped case does.
   */
  photoCounter?: PhotoCounterSnapshot | null;
  /**
   * Preselects a store on the manual form (`OrderCreateForm` reads the `store` query param).
   * The image flow resolves its store from the image itself, so this only affects the manual card.
   */
  storeId?: string;
};

type OrderCreateMethodSelectorInlineProps = OrderCreateMethodSelectorBaseProps & {
  /** Cards render directly in the caller's layout (empty state body). No dialog chrome. */
  presentation: "inline";
};

type OrderCreateMethodSelectorOverlayProps = OrderCreateMethodSelectorBaseProps & {
  /** Cards render inside the canonical `Modal` (desktop dialog / mobile sheet, ADR 0008). */
  presentation: "overlay";
  isOpen: boolean;
  onClose: () => void;
};

export type OrderCreateMethodSelectorProps =
  OrderCreateMethodSelectorInlineProps | OrderCreateMethodSelectorOverlayProps;

/**
 * The single "Nuevo pedido" entry point: one component with two presentations, never two rival
 * create flows. `inline` hosts the two cards directly in the orders empty state; `overlay` wraps
 * the same cards in the canonical `Modal` when the triggering surface already has content (FAB,
 * toolbar button, dashboard header button).
 *
 * Card selection is a plain navigation (no intermediate confirmation, FDD S5.5) tracked
 * declaratively via `data-ph-event`/`data-ph-props` — see `POSTHOG_EVENTS.ORDER.CREATE_METHOD_SELECTED`.
 */
export default function OrderCreateMethodSelector(props: OrderCreateMethodSelectorProps) {
  const { locale, className, photoCounter = null, storeId } = props;
  const t = useTranslations("orders.createEntry");
  // `null` means there is nothing to say about a balance (an uncapped collector, or a surface that
  // does not read it), so the line stays hidden rather than showing a placeholder number.
  const remaining = photoCounter?.remaining ?? null;
  const isExhausted = isPhotoBagExhausted(photoCounter);

  const imageHref = `/${locale}${ROUTES.ordersNew}/image`;
  const manualHref = storeId ? `/${locale}${ROUTES.ordersNew}?store=${storeId}` : `/${locale}${ROUTES.ordersNew}`;

  const handleCardClick = () => {
    if (props.presentation === "overlay") props.onClose();
  };

  const cards = (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <SelectorCard
        href={imageHref}
        method="image"
        icon={<ImageIcon size={20} aria-hidden />}
        title={t("fromImage.title")}
        badge={t("fromImage.badge")}
        description={t("fromImage.description")}
        onClick={handleCardClick}
        // With an empty bag the image card is not a route worth opening, so it renders inert while
        // still stating the zero. The manual card next to it is never blocked.
        isDisabled={isExhausted}
        notes={
          <>
            <SelectorCardNote icon={<Info size={13} aria-hidden />}>{t("fromImage.noStoreNeeded")}</SelectorCardNote>
            {remaining !== null && (
              <SelectorCardNote icon={<ImageIcon size={13} aria-hidden />}>
                {t("fromImage.photosRemaining", { count: remaining })}
              </SelectorCardNote>
            )}
          </>
        }
      />
      <SelectorCard
        href={manualHref}
        method="manual"
        icon={<PenLine size={20} aria-hidden />}
        title={t("manual.title")}
        description={t("manual.description")}
        onClick={handleCardClick}
      />
    </div>
  );

  if (props.presentation === "inline") {
    return cards;
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={t("title")} subtitle={t("subtitle")} size="md">
      {cards}
    </Modal>
  );
}

type SelectorCardProps = {
  href: string;
  method: OrderCreateMethod;
  icon: ReactNode;
  title: string;
  badge?: string;
  description: string;
  notes?: ReactNode;
  onClick: () => void;
  isDisabled?: boolean;
};

function SelectorCard({
  href,
  method,
  icon,
  title,
  badge,
  description,
  notes,
  onClick,
  isDisabled = false,
}: SelectorCardProps) {
  const surfaceClassName = cn(
    "flex flex-col gap-2 rounded-[var(--radius-xl)] p-4 text-left transition-colors",
    "[background:var(--surface-elevated)] [border:1px_solid_var(--border)]",
    isDisabled ? "opacity-60" : "hover:[border-color:var(--border-strong)]",
  );

  const body = (
    <>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full [color:var(--accent)] [background:color-mix(in_oklch,var(--accent)_10%,transparent)]"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold [color:var(--text-primary)]">{title}</span>
            {badge && (
              <Chip variant="success" size="sm">
                {badge}
              </Chip>
            )}
          </div>
        </div>
        {!isDisabled && <ChevronRight size={16} aria-hidden className="shrink-0 [color:var(--text-muted)]" />}
      </div>
      <p className="text-[13px] leading-[1.5] [color:var(--text-secondary)]">{description}</p>
      {notes && <div className="flex flex-col gap-1">{notes}</div>}
    </>
  );

  if (isDisabled) {
    // Rendered as plain content rather than a disabled link: a link with no destination is still
    // reachable by keyboard and still announces as a link, which would promise a route that leads
    // nowhere. The notes carry the reason (a zero counter) as text.
    return (
      <div className={surfaceClassName} aria-disabled="true">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={surfaceClassName}
      {...getPosthogDataAttributes(POSTHOG_EVENTS.ORDER.CREATE_METHOD_SELECTED, { method })}
    >
      {body}
    </Link>
  );
}

function SelectorCardNote({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] [color:var(--text-muted)]">
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      {children}
    </span>
  );
}

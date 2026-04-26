import type { ReactNode } from "react";
import { SectionAccentBar } from "@/components/modules/SectionAccentBar";
import { cn, COLLECTOR_CARD_SURFACE_CLASSNAME } from "@/lib/styles";
import type { LucideProps } from "lucide-react";

/** Same look for all panel title modes (Resumen, listas, etc.): compact `text-sm` / `sm:text-base`, no h2/span drift. */
const PANEL_HEADER_TITLE_CLASS = "m-0 text-text-title text-sm font-semibold leading-tight tracking-tight sm:text-base";

type SectionSurfaceCardBaseProps = {
  children: ReactNode;
  className?: string;
  /**
   * Right side of the header row (e.g. a ghost button). Wrap actions in `shrink-0` if needed.
   */
  headerEnd?: ReactNode;
};

type SectionSurfaceCardWithTitle = SectionSurfaceCardBaseProps & {
  title: string;
  /** Renders the title in the document outline; default matches compact panel look (`span`). */
  titleId?: string;
  titleAs?: "span" | "h2" | "h3";
  /**
   * Override accent bar color/gradient (Tailwind). Defaults to primary→highlight.
   * Ignored when `icon` is provided.
   */
  accentBarClassName?: string;
  /**
   * Replace the accent bar with a Lucide icon component.
   * Pass the component reference (e.g. `ShoppingBag`), not an element.
   * The card renders it at `size-4` — use the `iconClassName` prop for color.
   */
  icon?: React.ComponentType<LucideProps>;
  /** Tailwind class for the icon color. Defaults to `text-primary`. */
  iconClassName?: string;
  headerStart?: undefined;
};

type SectionSurfaceCardWithStart = SectionSurfaceCardBaseProps & {
  /**
   * Full left block of the header (accent, heading, or custom). Replaces `title` + default accent.
   */
  headerStart: ReactNode;
  title?: undefined;
  titleId?: never;
  titleAs?: never;
};

export type SectionSurfaceCardProps = SectionSurfaceCardWithTitle | SectionSurfaceCardWithStart;

function TitleWithAccent({
  title,
  titleId,
  titleAs = "span",
  accentBarClassName,
  icon: Icon,
  iconClassName = "text-primary",
}: {
  title: string;
  titleId?: string;
  titleAs: "span" | "h2" | "h3";
  accentBarClassName?: string;
  icon?: React.ComponentType<LucideProps>;
  iconClassName?: string;
}) {
  const lead = Icon ? (
    <Icon className={cn("size-4 shrink-0", iconClassName)} aria-hidden />
  ) : (
    <SectionAccentBar className={accentBarClassName} />
  );

  if (titleAs === "h2") {
    return (
      <>
        {lead}
        <h2
          id={titleId}
          tabIndex={titleId ? -1 : undefined}
          className={cn(PANEL_HEADER_TITLE_CLASS, "min-w-0 outline-none")}
        >
          {title}
        </h2>
      </>
    );
  }
  if (titleAs === "h3") {
    return (
      <>
        {lead}
        <h3
          id={titleId}
          tabIndex={titleId ? -1 : undefined}
          className={cn(PANEL_HEADER_TITLE_CLASS, "min-w-0 outline-none")}
        >
          {title}
        </h3>
      </>
    );
  }
  return (
    <>
      {lead}
      <span id={titleId} className={PANEL_HEADER_TITLE_CLASS}>
        {title}
      </span>
    </>
  );
}

/**
 * Titled surface card (`bg-surface-2`, border, header row, body `children`).
 * Use `title` (and optional `titleAs` / `titleId`) or a custom `headerStart` for the left header cluster.
 */
export default function SectionSurfaceCard(props: SectionSurfaceCardProps) {
  const { children, className, headerEnd } = props;
  const accentBarClassName = "title" in props && props.title != null ? props.accentBarClassName : undefined;

  const icon = "title" in props && props.title != null ? props.icon : undefined;
  const iconClassName = "title" in props && props.title != null ? props.iconClassName : undefined;

  return (
    <div
      className={cn(
        COLLECTOR_CARD_SURFACE_CLASSNAME,
        "flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pt-3 sm:pb-5",
        className,
      )}
    >
      <header className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          {"headerStart" in props && props.headerStart != null ? (
            props.headerStart
          ) : "title" in props && props.title != null ? (
            <div className="flex items-center gap-2">
              <TitleWithAccent
                title={props.title}
                titleId={props.titleId}
                titleAs={props.titleAs ?? "span"}
                accentBarClassName={accentBarClassName}
                icon={icon}
                iconClassName={iconClassName}
              />
            </div>
          ) : null}
        </div>
        {headerEnd != null && headerEnd !== false && <div className="flex shrink-0 items-center">{headerEnd}</div>}
      </header>
      <div className="border-border -mx-4 border-t sm:-mx-5" aria-hidden />
      {children}
    </div>
  );
}

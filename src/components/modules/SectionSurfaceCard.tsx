import type { ReactNode } from "react";
import { SectionAccentBar } from "@/components/modules/SectionAccentBar";
import { cn } from "@/lib/styles";

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
   */
  accentBarClassName?: string;
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
}: {
  title: string;
  titleId?: string;
  titleAs: "span" | "h2" | "h3";
  accentBarClassName?: string;
}) {
  if (titleAs === "h2") {
    return (
      <>
        <SectionAccentBar className={accentBarClassName} />
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
        <SectionAccentBar className={accentBarClassName} />
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
      <SectionAccentBar className={accentBarClassName} />
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

  return (
    <div
      className={cn(
        "border-border bg-surface-2 flex flex-col gap-3 rounded-2xl border px-4 pt-3 pb-4 shadow-sm sm:px-5 sm:pt-3 sm:pb-5",
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
              />
            </div>
          ) : null}
        </div>
        {headerEnd != null && headerEnd !== false && <div className="flex shrink-0 items-center">{headerEnd}</div>}
      </header>
      {children}
    </div>
  );
}

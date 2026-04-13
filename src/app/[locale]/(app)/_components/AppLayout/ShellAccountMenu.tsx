"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronUp, LogOut, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import SignOutButton from "@/components/modules/auth/SignOutButton";
import { POSTHOG_EVENTS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/styles";
import type { AppShellUserIdentity } from "./types";

const AVATAR_SIZE_CLASSNAME = {
  sm: "h-9 w-9 text-sm",
  md: "h-10 w-10 text-sm",
  lg: "h-11 w-11 text-base",
} as const;

type ShellAccountMenuProps = {
  locale: string;
  user: AppShellUserIdentity;
  signOutLabel: string;
  surface: "desktop" | "drawer";
  className?: string;
  onItemSelect?: () => void;
};

type AccountAvatarProps = {
  user: AppShellUserIdentity;
  size?: keyof typeof AVATAR_SIZE_CLASSNAME;
  className?: string;
  withChrome?: boolean;
};

function getDisplayName(user: AppShellUserIdentity): string {
  const username = user.username.trim();
  if (username) return username;
  const fallbackName = user.name?.trim();
  if (fallbackName) return fallbackName;
  return "User";
}

function getAvatarFallback(user: AppShellUserIdentity): string {
  return getDisplayName(user).charAt(0).toUpperCase() || "U";
}

function AccountAvatar({ user, size = "md", className, withChrome = true }: AccountAvatarProps) {
  return (
    <span
      className={cn(
        "text-text-title relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
        withChrome && "bg-primary/15 border-border border",
        AVATAR_SIZE_CLASSNAME[size],
        className,
      )}
      aria-hidden="true"
    >
      {user.image ? (
        <Image src={user.image} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span>{getAvatarFallback(user)}</span>
      )}
    </span>
  );
}

export function SidebarRailAccountPreview({
  user,
  label,
  onOpen,
}: {
  user: AppShellUserIdentity;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-muted inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      onClick={onOpen}
    >
      <AccountAvatar user={user} size="sm" withChrome={false} />
    </button>
  );
}

export default function ShellAccountMenu({
  locale,
  user,
  signOutLabel,
  surface,
  className,
  onItemSelect,
}: ShellAccountMenuProps) {
  const pathname = usePathname() ?? "";
  const t = useTranslations("appLayout");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayName = getDisplayName(user);
  const secondaryName = user.name?.trim() && user.name.trim() !== displayName ? user.name.trim() : null;

  useEffect(() => {
    if (!open || surface !== "desktop") return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, surface]);

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    posthog.capture(POSTHOG_EVENTS.APP_SHELL.ACCOUNT_MENU_TOGGLED, {
      action: nextOpen ? "opened" : "closed",
      surface,
      route: pathname,
    });
  };

  const handleItemSelect = () => {
    setOpen(false);
    onItemSelect?.();
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`shell-account-menu-${surface}`}
        aria-label={t("account.triggerLabel", { username: displayName })}
        className={cn(
          "focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 w-full cursor-pointer items-center gap-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          surface === "desktop"
            ? open
              ? "bg-muted/95 rounded-xl px-2 py-2 shadow-[inset_0_0_0_1px_var(--color-border)]"
              : "hover:bg-muted/85 active:bg-muted/95 rounded-xl px-2 py-2"
            : open
              ? "border-border bg-muted/80 rounded-2xl border px-3 py-3 shadow-[inset_0_0_0_1px_var(--color-border)]"
              : "border-border bg-card hover:bg-muted/60 active:bg-muted/80 rounded-2xl border px-3 py-3",
        )}
        onClick={handleToggle}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center">
          <AccountAvatar user={user} size="sm" withChrome={false} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-text-title truncate text-sm font-semibold">{displayName}</span>
          {secondaryName ? <span className="text-text-muted truncate text-xs">{secondaryName}</span> : null}
        </span>
        <ChevronUp
          className={cn("text-text-muted h-4 w-4 shrink-0 transition-transform", !open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={`shell-account-menu-${surface}`}
          className={cn(
            "border-border bg-popover overflow-hidden border shadow-xl",
            surface === "desktop"
              ? "absolute bottom-full left-0 z-20 mb-3 w-max max-w-[calc(100vw-2rem)] min-w-[18.5rem] rounded-[1.75rem]"
              : "mt-2 rounded-2xl",
          )}
        >
          <div className="from-primary/20 via-highlight/12 to-info/20 flex items-center gap-3 bg-linear-to-br px-4 py-4">
            <AccountAvatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="text-text-title truncate text-sm font-semibold">{displayName}</p>
              <p className="text-text-muted truncate text-xs">{t("account.identityCaption")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-2">
            <Link
              href={`/${locale}${ROUTES.settings}`}
              className="focus-visible:ring-ring focus-visible:ring-offset-background text-text-body hover:bg-muted hover:text-foreground inline-flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              onClick={handleItemSelect}
              data-ph-event={POSTHOG_EVENTS.APP_SHELL.ACCOUNT_MENU_ITEM_CLICKED}
              data-ph-props={JSON.stringify({ destination: "settings", surface })}
            >
              <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("account.settings")}</span>
            </Link>

            <SignOutButton
              locale={locale}
              label={signOutLabel}
              variant="ghost"
              size="md"
              className="text-text-body hover:bg-muted hover:text-foreground h-auto min-h-11 w-full justify-start gap-3 rounded-xl px-3 py-2"
              onSignOut={handleItemSelect}
              icon={<LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />}
            />
          </div>

          <div className="border-border flex flex-nowrap items-center justify-center gap-2 border-t px-4 py-3">
            <Link
              href={`/${locale}${ROUTES.privacy}`}
              target="_blank"
              rel="noreferrer"
              className="focus-visible:ring-ring focus-visible:ring-offset-background text-text-muted hover:text-foreground inline-flex items-center rounded-md text-[11px] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              onClick={handleItemSelect}
              data-ph-event={POSTHOG_EVENTS.APP_SHELL.ACCOUNT_MENU_ITEM_CLICKED}
              data-ph-props={JSON.stringify({ destination: "privacy", surface })}
            >
              {t("account.privacy")}
            </Link>
            <span className="text-text-muted text-xs" aria-hidden="true">
              ·
            </span>
            <Link
              href={`/${locale}${ROUTES.terms}`}
              target="_blank"
              rel="noreferrer"
              className="focus-visible:ring-ring focus-visible:ring-offset-background text-text-muted hover:text-foreground inline-flex items-center rounded-md text-[11px] whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              onClick={handleItemSelect}
              data-ph-event={POSTHOG_EVENTS.APP_SHELL.ACCOUNT_MENU_ITEM_CLICKED}
              data-ph-props={JSON.stringify({ destination: "terms", surface })}
            >
              {t("account.terms")}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

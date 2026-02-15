"use client";

import AnchorLink from "@/components/core/AnchorLink";
import { X } from "lucide-react";
import { cn } from "@/lib/styles";
import { buttonVariants } from "@/components/core/Button/buttonVariants";
import IconButton from "@/components/core/IconButton";
import Logo from "@/components/core/Logo";
import HeaderNav, { HeaderNavItem } from "./HeaderNav";
import { POSTHOG_EVENTS } from "@/lib/constants";

type BurgerMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  items: HeaderNavItem[];
  ctaLabel: string;
};

export default function BurgerMenu({ isOpen, onClose, items, ctaLabel }: BurgerMenuProps) {
  return (
    <div className={cn("fixed inset-0 z-50 md:hidden", isOpen ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        type="button"
        aria-label="Close menu"
        className={cn(
          "bg-background/80 absolute inset-0 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "border-border bg-surface text-foreground absolute top-0 right-0 h-full w-80 max-w-[85vw] border-l transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-full flex-col p-6">
          <div className="flex items-center justify-between">
            <Logo className="text-text-title" />
            <IconButton Icon={X} variant="outline" size="sm" aria-label="Close menu" onClick={onClose} />
          </div>
          <div className="mt-8 flex-1">
            <HeaderNav items={items} className="flex-col items-start gap-4 text-base" onNavigate={onClose} />
          </div>
          <AnchorLink
            href="#waitlist"
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}
            posthogEvent={POSTHOG_EVENTS.LANDING.MOBILE_MENU_NAV_CLICKED}
            posthogProps={{
              destination: "waitlist",
              cta_type: "primary",
            }}
            onClick={() => {
              onClose();
            }}
          >
            {ctaLabel}
          </AnchorLink>
        </div>
      </aside>
    </div>
  );
}

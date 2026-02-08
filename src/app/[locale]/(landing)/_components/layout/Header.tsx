"use client";

import Logo from "@/components/core/Logo";
import HeaderNav from "./HeaderNav";
import Link from "next/link";
import { cn } from "@/lib/styles";
import { buttonVariants } from "@/components/core/Button";
import { useTranslations } from "next-intl";
import IconButton from "@/components/core/IconButton";
import { Menu } from "lucide-react";

export default function Header() {
  const t = useTranslations("header");

  return (
    <header className="border-border bg-background text-foreground w-full border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <div className="hidden md:flex">
          <HeaderNav />
        </div>
        <div className="flex items-center gap-3">
          <Link href="#get-started" className={cn(buttonVariants({ variant: "primary" }))}>
            {t("getStarted")}
          </Link>
          <IconButton Icon={Menu} variant="outline" className="md:hidden" aria-label="Open menu" />
        </div>
      </div>
    </header>
  );
}

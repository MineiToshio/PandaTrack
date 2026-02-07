import Logo from "@/components/core/Logo";
import HeaderNav from "./HeaderNav";
import Link from "next/link";
import { cn } from "@/lib/styles";
import { buttonVariants } from "@/components/core/Button";

export default function Header() {
  return (
    <header className="border-border bg-background text-foreground w-full border-b">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <HeaderNav />
        <Link href="#get-started" className={cn(buttonVariants({ variant: "primary" }))}>
          Get started
        </Link>
      </div>
    </header>
  );
}

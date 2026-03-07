"use client";

import Link from "next/link";
import Heading from "@/components/core/Heading";
import GoogleSignInButton from "./GoogleSignInButton";

type AuthFormLayoutProps = {
  title: string;
  googleVariant: "signIn" | "signUp";
  callbackURL: string;
  footerLinkHref: string;
  footerLinkLabel: string;
  dividerLabel: string;
  children: React.ReactNode;
};

/**
 * Shared layout for sign-in and sign-up pages: full-screen centering,
 * title, Google CTA, "or" divider, and footer link. Form content is passed as children.
 */
export default function AuthFormLayout({
  title,
  googleVariant,
  callbackURL,
  footerLinkHref,
  footerLinkLabel,
  dividerLabel,
  children,
}: AuthFormLayoutProps) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center">
          <Heading as="h1" size="sm" className="text-text-title">
            {title}
          </Heading>
        </header>

        <GoogleSignInButton callbackURL={callbackURL} variant={googleVariant} />

        <div className="relative">
          <div className="border-border absolute inset-0 flex items-center" aria-hidden>
            <span className="border-border w-full border-t" />
          </div>
          <div className="text-text-muted relative flex justify-center text-xs">
            <span className="bg-background px-2">{dividerLabel}</span>
          </div>
        </div>

        {children}

        <p className="text-text-muted text-center text-sm">
          <Link
            href={footerLinkHref}
            className="text-link focus-visible:ring-ring rounded hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {footerLinkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}

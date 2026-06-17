import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GoogleSignInButton from "./GoogleSignInButton";

type AuthFootLink = {
  prefix: string;
  linkHref: string;
  linkLabel: string;
};

type AuthFormLayoutProps = {
  title: string;
  description?: string;
  /** Optional top back-link (e.g. forgot-password → sign-in). */
  backLink?: { href: string; label: string };
  googleVariant?: "signIn" | "signUp";
  callbackURL?: string;
  dividerLabel?: string;
  /** Optional bottom foot line: plain prefix + accent link. */
  foot?: AuthFootLink;
  children: React.ReactNode;
};

/**
 * Auth card (`.auth-card`): optional back-link, head (h1 + subtitle),
 * optional Google + divider, form content, optional foot link. The page
 * centering + minibar live in `(auth)/layout.tsx`.
 */
export default function AuthFormLayout({
  title,
  description,
  backLink,
  googleVariant,
  callbackURL,
  dividerLabel,
  foot,
  children,
}: AuthFormLayoutProps) {
  return (
    <div className="auth-card">
      {backLink ? (
        <Link href={backLink.href} className="auth-back">
          <ArrowLeft aria-hidden="true" /> {backLink.label}
        </Link>
      ) : null}

      <div className="auth-head">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>

      {googleVariant && callbackURL ? (
        <>
          <GoogleSignInButton callbackURL={callbackURL} variant={googleVariant} />
          {dividerLabel ? <div className="auth-divider">{dividerLabel}</div> : null}
        </>
      ) : null}

      {children}

      {foot ? (
        <p className="auth-foot">
          {foot.prefix} <Link href={foot.linkHref}>{foot.linkLabel}</Link>
        </p>
      ) : null}
    </div>
  );
}

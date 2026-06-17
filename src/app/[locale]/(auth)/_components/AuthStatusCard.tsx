import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/styles";

type AuthStatusTone = "accent" | "warning" | "success";

type AuthStatusCardProps = {
  /** Lucide icon shown in the tonal status tile. */
  icon: ReactNode;
  tone?: AuthStatusTone;
  title: ReactNode;
  description: ReactNode;
  /** Optional informational note (`.auth-note`). */
  note?: ReactNode;
  /** Optional bottom navigational link (`.auth-foot`). */
  footLink?: { href: string; label: string };
  children?: ReactNode;
};

/**
 * Auth status card (`.auth-card`) for verification screens: tonal status icon +
 * head + action (children) + optional note + optional foot link. Page centering
 * + minibar are provided by `(auth)/layout.tsx`.
 */
export default function AuthStatusCard({
  icon,
  tone = "accent",
  title,
  description,
  note,
  footLink,
  children,
}: AuthStatusCardProps) {
  return (
    <div className="auth-card">
      <span
        className={cn("auth-status-icon", tone === "warning" && "tone-warning", tone === "success" && "tone-success")}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="auth-head">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
      {note ? (
        <div className="auth-note">
          <Info aria-hidden="true" />
          <span>{note}</span>
        </div>
      ) : null}
      {footLink ? (
        <p className="auth-foot">
          <Link href={footLink.href}>{footLink.label}</Link>
        </p>
      ) : null}
    </div>
  );
}

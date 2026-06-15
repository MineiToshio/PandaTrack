import PublicMinibar from "@/app/[locale]/_components/public/PublicMinibar";

/**
 * Public auth shell: slim minibar + centered card area with an accent glow.
 * Each auth page renders only its `.auth-card`; this layout owns the `<main>`.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mk-public flex min-h-screen flex-col">
      <PublicMinibar />
      <main className="auth-wrap flex-1">
        <div className="auth-glow" aria-hidden="true" />
        {children}
      </main>
    </div>
  );
}

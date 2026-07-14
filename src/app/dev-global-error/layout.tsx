/**
 * Minimal root layout for the dev-only global-error harness. The harness segment lives outside
 * `/{locale}` (like `global-error.tsx` itself), and the production build requires every page to
 * sit under a root layout that renders `<html>`/`<body>`. It intentionally mirrors the bare
 * shell that `global-error.tsx` provides in a real catastrophic failure: no fonts, no theme
 * script, no providers.
 */
export default function DevGlobalErrorLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

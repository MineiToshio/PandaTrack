import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `logoStorage.ts` and `avatarStorage.ts` both start with `import "server-only";`, and that bare
 * specifier is resolved by Next.js's own bundler aliasing, which Vitest's Vite-based transform does
 * not have (confirmed: importing either file directly from a test fails at Vite's import-analysis
 * step, before any `vi.mock` can intercept it, exactly like `geminiProvider.ts`'s own documented
 * reason for avoiding the same import). A behavioral test of their exported functions is therefore
 * not reachable; this static guard checks the one fact that matters instead: each file's `S3Client`
 * constructor call actually wires in the shared R2 request handler (`src/lib/r2RequestHandler.ts`),
 * which is what carries the connection/request timeouts asserted for real in
 * `src/lib/_tests/r2RequestHandler.test.ts`.
 */
const REPO_ROOT = process.cwd();
const TARGET_FILES = ["src/lib/store/logoStorage.ts", "src/lib/user/avatarStorage.ts"];

describe("R2 storage clients wire in the shared timeout-bearing request handler", () => {
  it.each(TARGET_FILES)("%s imports and passes createR2RequestHandler() to its S3Client", (relativePath) => {
    const content = readFileSync(join(REPO_ROOT, relativePath), "utf8");

    expect(
      /import\s*\{[^}]*createR2RequestHandler[^}]*\}\s*from\s*["']@\/lib\/r2RequestHandler["']/.test(content),
      `${relativePath} must import createR2RequestHandler from "@/lib/r2RequestHandler".`,
    ).toBe(true);

    // Bounded to the `new S3Client(...)` call itself (up to its closing `});`), not a bare
    // substring search over the whole file: a `[^}]*` class would stop at the nested
    // `credentials: { ... }` object's own closing brace before ever reaching `requestHandler`.
    const constructorCallMatch = content.match(/new S3Client\(\{[\s\S]*?\n\s*\}\);/);
    expect(constructorCallMatch, `${relativePath} must construct an S3Client.`).not.toBeNull();
    expect(
      /requestHandler:\s*createR2RequestHandler\(\)/.test(constructorCallMatch?.[0] ?? ""),
      `${relativePath} must pass requestHandler: createR2RequestHandler() to its S3Client ` +
        "constructor. Without it, the AWS SDK's default handler leaves both connection and " +
        "request timeouts disabled, so a hung connection to R2 blocks the caller forever.",
    ).toBe(true);
  });
});

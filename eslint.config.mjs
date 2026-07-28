import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Repo convention: a leading underscore marks an intentionally-unused destructured
      // arg or variable (e.g. discarding a prop before spreading the rest), so it should
      // not be flagged as dead code.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".agents/**",
    // Transient full-repo copies created by agent worktrees; linting them
    // multiplies every warning by the number of active worktrees.
    ".claude/worktrees/**",
    // Local, git-ignored one-off migration/maintenance scripts (see .gitignore).
    // They are throwaway tooling, not part of the shipped codebase, so they are
    // excluded from linting just as they are from version control.
    "scripts/local/**",
  ]),
]);

export default eslintConfig;

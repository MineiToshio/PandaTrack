#!/usr/bin/env node
/**
 * Claude Code hook: PreToolUse → Edit | Write
 *
 * When the agent is about to edit a code file (.ts, .tsx, .js, .jsx, .mjs, .cjs),
 * injects a reminder into the model context to consult the applicable
 * .cursor/rules/*.mdc files before proceeding. Does not block the edit.
 *
 * Non-code files (docs, config, JSON, etc.) pass through silently.
 */

import path from "node:path";

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const RULES_REMINDER = [
  "CODING RULES CHECK — you are about to edit a code file.",
  "Before proceeding, confirm you have:",
  "  1. Consulted docs/tooling/cursor/rules.md to identify which .cursor/rules/*.mdc files apply to this change.",
  "  2. Read every matching rule file.",
  "Baseline rules that always apply to code changes:",
  "  - coding-standards.mdc",
  "  - docs-and-standards.mdc",
  "  - project-structure.mdc",
  "  - validation-checklist.mdc",
  "Scenario rules (read when relevant):",
  "  - react-next-components.mdc · tailwind-semantic-html.mdc · theme-light-dark.mdc (UI changes)",
  "  - prisma-data-layer.mdc · prisma-migration-workflow.mdc (DB/schema changes)",
  "  - testing-strategy.mdc (any behavior change)",
  "  - next-intl-translation-apis.mdc (any translation touch)",
  "  - github-tracking-sync.mdc (feature work with a matching issue)",
].join("\n");

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const payload = JSON.parse(raw || "{}");

  // Support both Cursor (file_path) and Claude Code (tool_input.file_path) payloads
  const filePath = payload.file_path ?? payload.tool_input?.file_path;

  if (!filePath || typeof filePath !== "string") {
    process.stdout.write(JSON.stringify({ decision: "approve", permission: "allow" }) + "\n");
    process.exit(0);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!CODE_EXTENSIONS.has(ext)) {
    process.stdout.write(JSON.stringify({ decision: "approve", permission: "allow" }) + "\n");
    process.exit(0);
  }

  // Inject reminder into model context for code files
  const out = {
    decision: "approve",
    permission: "allow",
    reason: RULES_REMINDER,
    agent_message: RULES_REMINDER,
  };
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}

main();

#!/usr/bin/env node
/**
 * Claude Code hook: PreToolUse → Read
 * Blocks the agent from reading sensitive files (.env, .env.local, etc.)
 * to avoid leaking secrets into the model context.
 *
 * Emits the Claude Code PreToolUse schema (`hookSpecificOutput.permissionDecision`);
 * the legacy `{ permission }` field is not honored by Claude Code.
 */

import path from "node:path";

const SENSITIVE_BASENAMES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
  ".env.production",
  ".env.production.local",
];

function isSensitive(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  const base = path.basename(filePath);
  if (base === ".env.example") return false;
  if (SENSITIVE_BASENAMES.includes(base)) return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  return false;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const payload = JSON.parse(raw || "{}");
  // Claude Code passes tool_input.file_path; Cursor passes file_path directly
  const filePath = payload.file_path ?? payload.tool_input?.file_path;

  if (isSensitive(filePath)) {
    const out = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Reading this file is blocked to protect secrets (.env files are excluded from the model context).",
      },
    };
    process.stdout.write(JSON.stringify(out) + "\n");
    process.exit(0);
  }

  const out = {
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow" },
  };
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}

main();

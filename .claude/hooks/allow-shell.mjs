#!/usr/bin/env node
/**
 * Claude Code hook: PreToolUse → Bash
 * Allows most commands; requires user approval for destructive operations
 * (e.g. prisma force-reset, git push --force) before they run.
 *
 * Emits the Claude Code PreToolUse schema (`hookSpecificOutput.permissionDecision`);
 * the legacy `{ permission }` field is not honored by Claude Code.
 */

/** Patterns that require explicit approval. Each has a regex and a short label for the message. */
const DANGEROUS_PATTERNS = [
  { pattern: /prisma\s+.*--force-reset|prisma\s+.*force-reset/i, label: "Prisma DB force reset" },
  { pattern: /npm\s+run\s+db-reset|npx\s+prisma\s+db\s+push\s+.*--force-reset/i, label: "DB reset script / Prisma force reset" },
  { pattern: /git\s+push\s+.*(--force|-f\b|--force-with-lease)/i, label: "Git push --force" },
  { pattern: /git\s+reset\s+--hard/i, label: "Git reset --hard" },
];

function requiresApproval(command) {
  if (!command || typeof command !== "string") return null;
  const trimmed = command.trim();
  for (const { pattern, label } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) return label;
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const payload = JSON.parse(raw || "{}");
  // Claude Code passes tool_input.command; Cursor passes command directly
  const command = payload.command ?? payload.tool_input?.command;
  const reason = requiresApproval(command);

  if (reason) {
    const out = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: `This command was flagged as destructive (${reason}) and may cause data loss or overwrite history. Approve only if intended.`,
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

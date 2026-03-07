#!/usr/bin/env node
/**
 * Cursor hook: beforeReadFile
 * Blocks the agent from reading sensitive files (.env, .env.local, etc.)
 * to avoid leaking secrets into the model context.
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
  const filePath = payload.file_path;

  if (isSensitive(filePath)) {
    const out = {
      permission: "deny",
      user_message: "Reading this file is blocked to protect secrets.",
    };
    process.stdout.write(JSON.stringify(out) + "\n");
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({ permission: "allow" }) + "\n");
  process.exit(0);
}

main();

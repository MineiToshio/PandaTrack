#!/usr/bin/env node
/**
 * Claude Code hook: PostToolUse → Edit | Write
 * Runs Prettier on the file the agent just edited so formatting stays consistent.
 * Reads JSON from stdin (tool_input.file_path); runs Prettier on the file; exits 0.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const payload = JSON.parse(raw || "{}");
  // Claude Code passes tool_input.file_path; Cursor passes file_path directly
  const filePath = payload.file_path ?? payload.tool_input?.file_path;
  if (!filePath || typeof filePath !== "string") process.exit(0);

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const configPath = path.join(projectRoot, ".prettierrc.json");
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  if (!fs.existsSync(resolvedPath)) process.exit(0);

  try {
    execFileSync("npx", ["prettier", "--config", configPath, "--write", resolvedPath], {
      cwd: projectRoot,
      stdio: "pipe",
      timeout: 12000,
    });
  } catch {
    // Prettier errors (e.g. syntax) should not block the edit; fail open
  }
  process.exit(0);
}

main();

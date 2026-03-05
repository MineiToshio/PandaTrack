#!/usr/bin/env node
/**
 * Cursor hook: afterFileEdit
 * Runs Prettier on the file(s) the agent just edited so formatting stays consistent.
 * Reads JSON from stdin (file_path, edits); runs Prettier on file_path; exits 0.
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const payload = JSON.parse(raw || "{}");
  const filePath = payload.file_path;
  if (!filePath || typeof filePath !== "string") process.exit(0);

  const projectRoot = process.env.CURSOR_PROJECT_DIR || process.cwd();
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

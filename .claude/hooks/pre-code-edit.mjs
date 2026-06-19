#!/usr/bin/env node
/**
 * Claude Code hook: PreToolUse → Edit | Write
 *
 * Replicates Cursor's per-file rule auto-attach. When the agent is about to
 * edit a file, this reads the `globs` frontmatter of every rule in
 * `.agents/rules/*.mdc`, finds the rules whose globs match the edited path, and
 * injects them into the model context via `hookSpecificOutput.additionalContext`
 * (the only PreToolUse field that reliably reaches the model on an "allow").
 *
 * Always-apply rules are loaded session-wide through CLAUDE.md, so this hook
 * focuses on the glob-scoped rules that are only relevant for specific files.
 * Never blocks the edit; fail-open on any error.
 */

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const RULES_DIR = path.join(REPO_ROOT, ".agents", "rules");
const RULES_INDEX = "docs/tooling/agents/rules.md";
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".html"]);

function allow(additionalContext) {
  const out = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      ...(additionalContext ? { additionalContext } : {}),
    },
  };
  process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}

/** Parse the YAML-ish frontmatter block of a rule file (description, globs, alwaysApply). */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    if (!kv) continue;
    const value = kv[2].trim().replace(/^["']|["']$/g, "");
    fm[kv[1]] = value;
  }
  return fm;
}

/** Convert one glob pattern (no commas, may contain {a,b}, **, *) to a RegExp. */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** → any path segment(s)
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++; // swallow the trailing slash of **/
      } else {
        re += "[^/]*";
      }
    } else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) {
        // Unbalanced brace — treat literally instead of looping forever.
        re += "\\{";
        continue;
      }
      const alts = glob
        .slice(i + 1, end)
        .split(",")
        .map((a) => a.replace(/[.+^${}()|[\]\\]/g, "\\$&"));
      re += "(" + alts.join("|") + ")";
      i = end;
    } else if (".+^$()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
}

/** Split a comma-separated globs list without breaking commas inside `{a,b}` alternations. */
function splitGlobs(globsStr) {
  const out = [];
  let current = "";
  let depth = 0;
  for (const ch of globsStr) {
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** True if the repo-relative path matches the rule's comma-separated globs string. */
function matchesGlobs(relPath, globsStr) {
  if (!globsStr) return false;
  return splitGlobs(globsStr)
    .map((g) => g.trim())
    .filter(Boolean)
    .some((g) => {
      try {
        return globToRegExp(g).test(relPath);
      } catch {
        return false;
      }
    });
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const payload = JSON.parse(raw || "{}");

  // Claude Code nests under tool_input; keep Cursor's top-level shape as fallback.
  const filePath = payload.tool_input?.file_path ?? payload.file_path;
  if (!filePath || typeof filePath !== "string") allow();

  const relPath = path.relative(REPO_ROOT, path.resolve(REPO_ROOT, filePath));
  const ext = path.extname(relPath).toLowerCase();

  let ruleFiles = [];
  try {
    ruleFiles = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".mdc"));
  } catch {
    allow();
  }

  const matched = [];
  for (const file of ruleFiles) {
    if (file.startsWith("_")) continue; // skip manifests
    const fm = parseFrontmatter(fs.readFileSync(path.join(RULES_DIR, file), "utf8"));
    if (fm.alwaysApply === "true") continue; // already loaded session-wide via CLAUDE.md
    if (matchesGlobs(relPath, fm.globs)) {
      matched.push({ file, description: fm.description ?? "" });
    }
  }

  if (matched.length === 0 && !CODE_EXTENSIONS.has(ext)) allow();

  const lines = [
    `RULE CHECK — editing \`${relPath}\`.`,
    "Always-apply rules are already in context. Additional repository rules scoped to this file:",
  ];
  if (matched.length > 0) {
    for (const m of matched) {
      lines.push(`  - .agents/rules/${m.file}${m.description ? ` — ${m.description}` : ""}`);
    }
    lines.push(`Read any you have not yet read before editing. Full index: ${RULES_INDEX}.`);
  } else {
    lines.push(`  (none scoped to this path) — confirm baseline rules still hold. Index: ${RULES_INDEX}.`);
  }

  allow(lines.join("\n"));
}

main().catch(() => allow());

// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

const script = path.resolve("scripts/cleanup-worktrees.sh");
let scratch: string;
let repo: string;
function git(...args: string[]) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: "pipe" });
}
function worktree(name: string) {
  const location = path.join(scratch, name);
  git("worktree", "add", "-b", name, location, "staging");
  return location;
}
function runCleanup(target: string, ...args: string[]) {
  return execFileSync("bash", [target, ...args], {
    cwd: repo,
    env: { ...process.env, TMPDIR: path.join(scratch, "tmp") },
    encoding: "utf8",
  });
}
function cleanup(...args: string[]) {
  return runCleanup(script, ...args);
}
beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), "worktree-cleanup-test-"));
  repo = path.join(scratch, "main repo");
  mkdirSync(repo);
  mkdirSync(path.join(scratch, "tmp"));
  git("init", "-b", "staging");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Cleanup Test");
  git("config", "commit.gpgsign", "false");
  writeFileSync(path.join(repo, "tracked.txt"), "Initial");
  git("add", "tracked.txt");
  git("commit", "-m", "Initial");
});
afterEach(() => rmSync(scratch, { recursive: true, force: true }));

it("removes a merged clean worktree and branch, preserves the main checkout, and is idempotent", () => {
  const location = worktree("merged-clean");
  execFileSync("git", ["-C", location, "commit", "--allow-empty", "-m", "Merged"]);
  git("merge", "--ff-only", "merged-clean");
  mkdirSync(path.join(location, "node_modules"));
  writeFileSync(path.join(location, "node_modules", "cache"), "Disposable");
  writeFileSync(path.join(repo, ".git", "info", "exclude"), "node_modules/\n");
  expect(existsSync(location)).toBe(true);
  cleanup();
  expect(existsSync(location)).toBe(false);
  expect(git("branch", "--list", "merged-clean").trim()).toBe("");
  expect(existsSync(repo)).toBe(true);
  expect(cleanup()).toContain("Space released");
});

it("preserves unmerged commits and untracked or tracked changes", () => {
  const unmerged = worktree("unmerged");
  execFileSync("git", ["-C", unmerged, "commit", "--allow-empty", "-m", "Unmerged"]);
  const dirty = worktree("dirty");
  writeFileSync(path.join(dirty, "untracked.txt"), "Keep me");
  const tracked = worktree("tracked-dirty");
  writeFileSync(path.join(tracked, "tracked.txt"), "Changed");
  const output = cleanup();
  expect(existsSync(tracked)).toBe(true);
  expect(output).toContain("CONSERVADO");
  expect(existsSync(unmerged)).toBe(true);
  expect(existsSync(path.join(dirty, "untracked.txt"))).toBe(true);
  expect(git("branch", "--list", "unmerged", "dirty").trim()).not.toBe("");
});

it("preserves locked and detached worktrees and supports dry-run", () => {
  const clean = worktree("clean");
  const locked = worktree("locked");
  git("worktree", "lock", locked);
  const detached = path.join(scratch, "detached");
  git("worktree", "add", "--detach", detached, "staging");
  cleanup("--dry-run");
  expect(existsSync(clean)).toBe(true);
  cleanup();
  expect(existsSync(clean)).toBe(false);
  expect(existsSync(locked)).toBe(true);
  expect(existsSync(detached)).toBe(true);
});

it("limits tmp deletion to the project prefix and preserves Git repositories", () => {
  const artifact = path.join(scratch, "tmp", "pandatrack-cache");
  const unrelated = path.join(scratch, "tmp", "other-cache");
  const copy = path.join(scratch, "tmp", "pandatrack-copy");
  mkdirSync(artifact);
  mkdirSync(unrelated);
  mkdirSync(copy);
  mkdirSync(path.join(copy, ".git"));
  // Avoid sweeping the real shared /private/tmp during a test.
  const output = cleanup("--tmp", "--dry-run");
  expect(output).toContain(artifact);
  expect(output).not.toContain(unrelated);
  expect(output).toContain("Git metadata");
  expect(existsSync(artifact)).toBe(true);
});

it("deletes only disposable tmp artifacts in an isolated pair of temporary roots", () => {
  // Substitute only the shared root, so this integration test never sweeps real /private/tmp.
  const privateTmp = path.join(scratch, "private-tmp");
  mkdirSync(privateTmp);
  const isolatedScript = path.join(scratch, "cleanup.sh");
  writeFileSync(isolatedScript, readFileSync(script, "utf8").replaceAll("/private/tmp", privateTmp));
  const artifact = path.join(scratch, "tmp", "pandatrack-cache");
  const other = path.join(privateTmp, "funko-tracker-cache");
  const archive = path.join(privateTmp, "pandatrack-archive.tar");
  mkdirSync(artifact);
  mkdirSync(other);
  writeFileSync(archive, "Disposable");
  const dirty = path.join(privateTmp, "pandatrack-active");
  git("worktree", "add", "-b", "active", dirty, "staging");
  writeFileSync(path.join(dirty, "untracked.txt"), "Keep");
  runCleanup(isolatedScript, "--tmp");
  expect(existsSync(artifact)).toBe(false);
  expect(existsSync(archive)).toBe(false);
  expect(existsSync(other)).toBe(true);
  expect(existsSync(dirty)).toBe(true);
});

it("rejects an unknown base before deleting anything and accepts an explicit base", () => {
  const location = worktree("explicit-base");
  expect(() => cleanup("missing-base")).toThrow();
  expect(existsSync(location)).toBe(true);
  cleanup("staging");
  expect(existsSync(location)).toBe(false);
});

it("allows cleanup through the hook without bypassing compound destructive commands", () => {
  for (const [command, decision] of [
    ["scripts/cleanup-worktrees.sh --tmp", "allow"],
    ["./scripts/cleanup-worktrees.sh staging --dry-run", "allow"],
    ["scripts/cleanup-worktrees.sh; git reset --hard", "ask"],
    ["git push --force", "ask"],
  ]) {
    const result = execFileSync("node", [path.resolve(".claude/hooks/allow-shell.mjs")], {
      input: JSON.stringify({ tool_input: { command } }),
      encoding: "utf8",
    });
    expect(JSON.parse(result).hookSpecificOutput.permissionDecision).toBe(decision);
  }
});

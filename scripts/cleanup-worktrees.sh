#!/bin/bash
# Bash 3.2 compatible (macOS). Run from any checkout of the target repository.
set -euo pipefail
export GIT_OPTIONAL_LOCKS=0
base=staging
dry_run=false
clean_tmp=false
base_set=false
for argument in "$@"; do
  case "$argument" in
    --dry-run) dry_run=true ;;
    --tmp) clean_tmp=true ;;
    --help|-h) echo 'Usage: scripts/cleanup-worktrees.sh [base-branch] [--tmp] [--dry-run]'; exit 0 ;;
    -*) echo "Unknown option: $argument" >&2; exit 1 ;;
    *) if $base_set; then echo 'Only one base branch is supported.' >&2; exit 1; fi
       base="$argument"; base_set=true ;;
  esac
done
git rev-parse --is-inside-work-tree >/dev/null
git check-ref-format "refs/heads/$base" >/dev/null
git show-ref --verify --quiet "refs/heads/$base" || { echo "Missing local base branch: $base" >&2; exit 1; }
# NUL-delimited records avoid Git path quoting and support spaces and newlines.
IFS= read -r -d '' first_record < <(git worktree list --porcelain -z)
main=${first_record#worktree }
cd "$main"
main=$(pwd -P)
protected_paths=("$main")
failed=0
before=$(df -Pk . | awk 'END {print $4}')
echo 'Disk before (KiB):'
df -Pk .

# Keep the tool call alive with observable progress, but never detach deletion.
# Callers must poll their running process instead of imposing a two-minute timeout.
run_with_progress() {
  "$@" &
  local operation=$!
  while kill -0 "$operation" 2>/dev/null; do
    echo "Cleanup in progress (PID $operation)..."
    sleep 2
  done
  wait "$operation"
}

clean_worktree() {
  local location="$1" branch="$2" locked="$3" status head
  protected_paths+=("$location")
  if [ "$location" = "$main" ]; then return; fi
  if [ -n "$locked" ]; then
    echo "CONSERVADO: $location (locked: $locked)"; return
  fi
  if [ -z "$branch" ]; then
    echo "CONSERVADO: $location (detached HEAD or bare repository)"; return
  fi
  if [ "$branch" = "refs/heads/$base" ]; then
    echo "CONSERVADO: $location (base branch)"; return
  fi
  if [ ! -d "$location" ] || [ -L "$location" ]; then
    echo "CONSERVADO: $location (missing directory or symlink)"; return
  fi
  if ! head=$(git -C "$location" rev-parse --verify HEAD) ||
     ! git merge-base --is-ancestor "$branch" "refs/heads/$base" ||
     [ "$head" != "$(git rev-parse --verify "$branch")" ]; then
    echo "CONSERVADO: $location (branch is not merged into $base or HEAD differs)"; return
  fi
  if ! status=$(git -C "$location" status --porcelain --untracked-files=all --ignore-submodules=none); then
    echo "CONSERVADO: $location (cannot inspect working tree)"; failed=1; return
  fi
  if [ -n "$status" ]; then
    echo "CONSERVADO: $location (uncommitted or untracked changes)"; return
  fi
  if $dry_run; then echo "DRY-RUN: remove $location and ${branch#refs/heads/}"; return; fi
  echo "Removing merged clean worktree: $location"
  # A failed Git removal is never followed by rm: locks and new changes must survive.
  if ! run_with_progress git worktree remove --force -- "$location"; then
    echo "CONSERVADO: $location (git worktree remove failed)"; failed=1; return
  fi
  # Git normally removes the directory itself. Never delete a newly recreated path.
  if [ -e "$location" ] || [ -L "$location" ]; then
    echo "CONSERVADO: $location (path reappeared after removal)"; failed=1; return
  fi
  if git merge-base --is-ancestor "$branch" "refs/heads/$base"; then
    git branch -D -- "${branch#refs/heads/}" || failed=1
  else
    echo "CONSERVADO: $branch (branch changed during cleanup)"; failed=1
  fi
}

location='' branch='' locked=''
while IFS= read -r -d '' field; do
  case "$field" in
    'worktree '*) location=${field#worktree } ;;
    'branch '*) branch=${field#branch } ;;
    locked*) locked=${field#locked}; locked=${locked:-locked} ;;
    '') clean_worktree "$location" "$branch" "$locked"
        location='' branch='' locked='' ;;
  esac
done < <(git worktree list --porcelain -z)

if $clean_tmp; then
  tmp_roots=()
  for root in "${TMPDIR:-/private/tmp}" /private/tmp; do
    [ -d "$root" ] || continue
    root=$(cd "$root" && pwd -P)
    duplicate=false
    for previous in "${tmp_roots[@]+${tmp_roots[@]}}"; do
      if [ "$root" = "$previous" ]; then duplicate=true; fi
    done
    $duplicate && continue
    tmp_roots+=("$root")
    for artifact in "$root"/pandatrack-*; do
      [ -e "$artifact" ] || [ -L "$artifact" ] || continue
      protected=false
      for checkout in "${protected_paths[@]}"; do
        case "$checkout/" in "$artifact/"*) protected=true ;; esac
      done
      if $protected; then echo "CONSERVADO: $artifact (contains a registered checkout)"; continue; fi
      # Repository copies need a separate review: prefix alone cannot prove they are merged.
      if [ ! -L "$artifact" ] && [ -d "$artifact" ]; then
        if ! metadata=$(find "$artifact" -name .git -print -prune 2>/dev/null); then
          echo "CONSERVADO: $artifact (cannot inspect temporary directory)"; failed=1; continue
        fi
        if [ -n "$metadata" ] || git -C "$artifact" rev-parse --git-dir >/dev/null 2>&1; then echo "CONSERVADO: $artifact (Git metadata)"; continue; fi
      fi
      if $dry_run; then echo "DRY-RUN: remove temporary artifact $artifact"; continue; fi
      echo "Removing temporary artifact: $artifact"
      run_with_progress rm -rf -- "$artifact" || failed=1
    done
  done
fi
if ! $dry_run; then git worktree prune || failed=1; fi
after=$(df -Pk . | awk 'END {print $4}')
echo 'Disk after (KiB):'
df -Pk .
echo "Space released (df available-space delta): $((after - before)) KiB"
exit "$failed"

#!/usr/bin/env bash
# Manually refresh the Premier League data on the site — same thing the daily
# GitHub Action does, but on demand from your own machine.
#
# Usage:
#   ./scripts/update_pl.sh
#
# What it does:
#   1. Syncs main with the remote (git pull --rebase) so the daily Action's
#      auto-updates don't cause a rejected push later.
#   2. Runs scripts/update_pl_data.py to pull fresh standings/fixtures/facts
#      (data/pl.json) and the full-season results grid (data/pl-results.json).
#   3. If anything changed, commits those files and pushes to main —
#      GitHub Pages picks it up within a minute or so.
#   4. If nothing changed, says so and exits without committing.
#
# If the push still races with a remote update, it re-syncs and regenerates
# once (generated files are deterministic, so this cleanly resolves conflicts).

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Syncing with remote..."
git pull --rebase --autostash

echo "Fetching latest Premier League data..."
python3 scripts/update_pl_data.py

if git diff --quiet -- data/pl.json data/pl-results.json; then
  echo "No changes — data was already up to date."
  exit 0
fi

git add data/pl.json data/pl-results.json
git commit -m "Manual PL data update"

if ! git push; then
  echo "Push rejected — remote moved. Re-syncing and regenerating..."
  git fetch origin
  if ! git rebase origin/main; then
    # Only the deterministic data files can conflict — regenerate and continue.
    python3 scripts/update_pl_data.py
    git add data/pl.json data/pl-results.json
    GIT_EDITOR=true git rebase --continue
  fi
  git push
fi

echo "Done — PL data updated and pushed to main."

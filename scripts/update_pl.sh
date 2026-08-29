#!/usr/bin/env bash
# Manually refresh the Premier League data on the site — same thing the daily
# GitHub Action does, but on demand from your own machine.
#
# Usage:
#   ./scripts/update_pl.sh
#
# What it does:
#   1. Runs scripts/update_pl_data.py to pull fresh standings/fixtures/facts
#      into data/pl.json.
#   2. If anything changed, commits just that file and pushes to main —
#      GitHub Pages picks it up within a minute or so.
#   3. If nothing changed, says so and exits without committing.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Fetching latest Premier League data..."
python3 scripts/update_pl_data.py

if git diff --quiet -- data/pl.json; then
  echo "No changes — data/pl.json was already up to date."
  exit 0
fi

git add data/pl.json
git commit -m "Manual PL data update"
git push

echo "Done — data/pl.json updated and pushed to main."

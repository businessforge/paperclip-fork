# Business Forge — paperclip insurance fork

This repo is an insurance fork of [paperclip/paperclip](https://github.com/paperclip/paperclip) per the Q13 fork-as-insurance strategy in `H:\task-files\bf-product-price-plans.md`.

## Purpose

- Stay in sync with upstream via automated weekly workflow
- Switch to deploying from this fork if upstream license changes (AGPL/BSL), upstream abandons, or BF needs to patch/diverge

## Sync mechanism

`.github/workflows/sync-upstream.yml` runs weekly (Mondays 09:00 UTC) and on-demand via `workflow_dispatch`. Uses the default `GITHUB_TOKEN`.

**Known limitation:** When upstream commits modify `.github/workflows/*` files, sync fails because the default `GITHUB_TOKEN` lacks `workflow` scope. Fork stays on last-successful-sync state until those changes are manually merged. Not a blocker for insurance purposes — early warning is actually useful.

**Manual sync:** Run `gh repo sync businessforge/paperclip-fork` from a CLI authenticated with `workflow` scope.

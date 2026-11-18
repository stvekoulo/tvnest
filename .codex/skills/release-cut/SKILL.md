---
name: release-cut
description: Use when preparing, cutting, tagging, publishing, or verifying a TVNest release or its release assets.
---

# Release Cut

Full contract and rationale: `docs/architecture/release-pipeline.md`.

The tag workflow (`.github/workflows/build-windows.yml`) verifies that the Git
tag matches `package.json` and publishes the Windows installer to GitHub
Releases once packaging and layout verification succeed.

## Preflight

Work from clean, current `master` with the intended remote named explicitly.
Confirm `package.json` contains bare semver, the exact `v<version>` tag does not
exist locally or remotely, typechecks and tests are green, and all notes
validate:

```bash
pnpm run typecheck:ci
pnpm run test:unit:ci
pnpm run release:notes:validate
```

## Generate and Tag

1. Set `version` in `package.json` and `apps/web/package.json`.
2. Run `pnpm run release:notes:changelog`.
3. Consume notes only after reviewing generated output:
   `node tools/release/build-release-notes.mjs --consume`.
4. Stage release-owned files (`package.json`, `apps/web/package.json`,
   `CHANGELOG.md`, `.changes`), commit, and create the exact tag:

```bash
git commit -m "chore(release): v1.1.0"
git tag v1.1.0
```

## Push and External Effects

Push the named remote's `master` branch first, then push only the exact
`v<version>` tag as a second command. Never use broad `git push --tags`.

The `.codex` and `.claude` copies of this skill must remain byte-identical.

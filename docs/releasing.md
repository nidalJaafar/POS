# Releasing a new version

Releases are built and published by GitHub Actions. You never build on the shop laptop: it downloads a ready-to-run release.

## Cut a release

From an up-to-date `main` with no uncommitted changes:

```bash
npm version patch        # 1.0.0 → 1.0.1: bumps package.json, commits, tags v1.0.1
git push --follow-tags   # pushing the tag starts the release workflow
```

Use `npm version minor` for new features and `npm version major` for big changes. Never create tags by hand. The workflow refuses a tag that doesn't match `package.json`.

## What the pipeline does

`.github/workflows/release.yml` runs on every `v*.*.*` tag:

1. **Tests**: the full CI (`.github/workflows/ci.yml`) on Linux and Windows: typecheck, lint, unit and integration tests, and browser tests. Nothing is published if any of them fail.
2. **Package**: on Windows:
   - builds the app;
   - removes development packages;
   - bundles the exact Node.js runtime it was built with (checksum-verified from nodejs.org).
3. **Smoke test**: unzips the package into an empty folder, runs the database migrations and a backup against a scratch database, and starts the app with its bundled Node. It then checks `/api/health` reports the new version and that the main pages load.
4. **Publish**: creates the GitHub release `vX.Y.Z` with release notes generated from the commits since the last tag.

Every push to `main` and every pull request also runs the CI on Linux and Windows.

## What a release contains

| Asset | Contents |
| --- | --- |
| `sunflower-pos-vX.Y.Z-win-x64.zip` | `release.json`, `node/node.exe`, `app/` (build, production `node_modules`, migrations, scripts) and `start.cmd` |
| `sunflower-pos-vX.Y.Z-win-x64.zip.sha256` | SHA-256 of the zip, checked before installing |
| `release.json` | Version, commit, build time and Node version, small enough to check for updates cheaply |

A release never contains the shop's data: no `.env` files, photos (`public/uploads`) or backups.

## Running a release by hand

1. Unzip it, for example into `C:\SunflowerPOS\releases\v1.0.1`.
2. Put the shop's `.env.local` in its `app\` folder. It holds `DATABASE_URL`, the printer ids and `UPLOADS_DIR` pointing at the shared photos folder.
3. In `app\`, run `..\node\node.exe node_modules\prisma\build\index.js migrate deploy`.
4. Run `start.cmd`. It takes a backup, then starts the POS on port 3000.

The updater (next step) automates exactly these steps, keeps the previous version for rollback, and checks `/api/health` after starting.

## Notes

- The repository is private, so the laptop needs a read-only GitHub token to download releases: a fine-grained token limited to this repository with **Contents: Read-only**.
- **GitHub Actions minutes:** in a private repository, Windows runners count double against the free monthly allowance. A release uses about 50 billed minutes and a CI run about 30.
- **If a release fails:** open the run under **Actions**. Failed browser tests upload their screenshots and traces as an artifact. Fix the problem, then release the next patch version; don't move tags.

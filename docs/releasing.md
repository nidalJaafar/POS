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
3. **Smoke test**: unzips the package into an empty folder, runs the database migrations and a backup against a scratch database, and starts the app with its bundled Node. It then checks `/api/health` reports the new version and that the main pages load. It then installs the package the way the laptop is set up and lets the updater update itself from the latest published release on GitHub.
4. **Publish**: creates the GitHub release `vX.Y.Z` with release notes generated from the commits since the last tag.

Every push to `main` and every pull request also runs the CI on Linux and Windows.

## What a release contains

| Asset | Contents |
| --- | --- |
| `sunflower-pos-vX.Y.Z-win-x64.zip` | `release.json`, `node/node.exe`, `app/` (build, production `node_modules`, migrations, scripts) and `start.cmd` |
| `sunflower-pos-vX.Y.Z-win-x64.zip.sha256` | SHA-256 of the zip, checked before installing |
| `release.json` | Version, commit, build time and Node version, small enough to check for updates cheaply |

A release never contains the shop's data: no `.env` files, photos (`public/uploads`) or backups.

## How the shop laptop updates

The laptop runs `C:\SunflowerPOS\launch.cmd` at startup. It runs the updater (`scripts/updater.js boot`) from the installed release, then starts the POS.

- **Check:** the updater asks GitHub for the latest release. Without internet, or if GitHub is down, the POS starts as usual on the installed version.
- **Download:** a newer version is downloaded and its checksum verified.
- **Install:**
  1. Unzip into `releases\<version>` and copy in the shop's settings from `shared\.env.local`.
  2. Back up the data.
  3. Run the new version's database migrations.
  4. Start it on a spare port and check `/api/health`.
- **Switch:** only a version that passes the check becomes current. Anything else leaves the current version running, and the sidebar shows "Update failed".
- **Cleanup:** the previous version is kept for `updater.js rollback`, and the last three versions stay on disk.

**Rule for database changes:** releases must keep the database working for the previous version. Add tables and columns, and give new required columns a default. Drop or rename only in a later release. A rollback switches code, not the database.

## First install on the laptop

One time, at the shop, from an unzipped release (any version from 1.0.2):

```bat
cd <unzipped release>
node\node.exe app\scripts\updater.js install --from-app "<current app folder>" --token <read-only GitHub token>
```

This:
- creates `C:\SunflowerPOS` with shared folders for settings, photos and backups;
- copies the current app's `.env.local` and photos (the old app folder is left untouched);
- installs the release and applies its migrations;
- writes `launch.cmd`.

Then point the startup script at `C:\SunflowerPOS\launch.cmd`.

Other commands, all run with the installed release's `node.exe`:

```bat
updater.js check      rem is there a newer version?
updater.js status     rem installed versions and the last update result
updater.js rollback   rem go back to the previous version, then restart the POS
```

## Notes

- The repository is private, so the laptop needs a read-only GitHub token to download releases: a fine-grained token limited to this repository with **Contents: Read-only**. It's stored in `C:\SunflowerPOS\shared\updater.json`; to replace it, edit that file. While GitHub refuses the token, the sidebar says "Updates paused".
- **GitHub Actions minutes:** in a private repository, Windows runners count double against the free monthly allowance. A release uses about 50 billed minutes and a CI run about 30.
- **If a release fails:** open the run under **Actions**. Failed browser tests upload their screenshots and traces as an artifact. Fix the problem, then release the next patch version; don't move tags.

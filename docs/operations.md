# Running the POS

Everyday commands for the shop laptop and for development. Run them from the app folder.

## Health check

```bash
npm run doctor
```

Checks the database connection, pending migrations, the uploads folder and item images, the production build, the receipt printer and the age of the latest backup. Every problem it prints comes with the command that fixes it.

## Backups

```bash
npm run backup
```

Saves every item, order and item image into a folder named `sunflower-backup-<date>_<time>` inside the backup folder.

- **Automatic:** `npm run start` takes a backup before starting the POS, so the laptop gets one every time it boots. If the backup fails (for example the database is still starting), the error is logged and the POS starts anyway. `npm run doctor` reports a failed last backup.
- **Where:** `backups/` in the app folder, unless `BACKUP_DIR` is set in `.env.local`. Point it somewhere safer, such as a OneDrive, Google Drive or USB folder: `BACKUP_DIR="D:/SunflowerBackups"`. Use forward slashes in `.env.local`: inside quotes a backslash followed by `n` becomes a line break (`D:\new` would break).
- **How many:** the 10 newest backups are always kept, plus the newest backup of each day for the last 60 days. Change these with `BACKUP_KEEP` and `BACKUP_KEEP_DAYS` in `.env.local`.
- **Missing photos don't stop backups.** If an item's image file is missing, the backup still runs and lists the missing images as warnings; `npm run uploads:check` shows which items need a new photo.
- A backup is written to a temporary folder and only renamed when it's complete, so a half-written backup never looks like a real one.

### Restoring a backup

Stop the POS first (on Windows a running app keeps the image folder locked), then run, from the app folder:

```bash
npm run restore -- --from "<backup folder>\sunflower-backup-2026-10-17_09-00-00" --replace
```

where `<backup folder>` is `backups` or your `BACKUP_DIR`. This replaces all items, orders and images with the backup's contents. Before replacing anything it saves the current data as a new backup, so a wrong choice can be undone the same way. It checks the whole backup first, and if any step fails, nothing is changed.

## Item images

```bash
npm run uploads:check                  # items with a missing image, and images no item uses
npm run uploads:check -- --move-unused # move unused images into <backup folder>/unused-uploads-<time>/
```

## Receipt printer

```bash
npm run printer:list   # USB devices with their ids, for PRINTER_VID / PRINTER_PID in .env.local
npm run printer:test   # print a test receipt and open the cash drawer
```

## Database

```bash
npm run db:migrate   # apply schema changes after updating the app
npm run db:status    # show which migrations are applied
npm run db:studio    # browse and edit the data in the browser
```

## Updating the app on the laptop

```bash
npm run backup
npm install
npm run db:migrate
npm run build
npm run doctor
```

Then restart the POS.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run check` | Typecheck, lint and all unit/integration tests |
| `npm test` | Unit and integration tests (starts a throwaway Postgres in Docker/Podman) |
| `npm run test:unit` | Unit tests only; no Docker needed |
| `npm run test:watch` | Same, re-running on change |
| `npm run test:e2e` | Browser tests against a production build (`npm run test:e2e:install` once first) |
| `npm run test:e2e:ui` | Browser tests in Playwright's interactive UI |
| `npm run test:db:up` / `test:db:down` | Start or remove the throwaway test database on port 55432 |
| `npm run format` | Format the code with Prettier |
| `npm run db:seed -- --yes-add-fake-orders` | Add ~3000 fake orders to a local development database (refuses to run without the flag) |

Without Docker or Podman (for example on Windows), start any PostgreSQL on port 55432 with user `postgres` and password `postgres`, and set `TEST_DB_EXTERNAL=1` before running the tests. Every push and pull request runs all tests on both Linux and Windows (`.github/workflows/ci.yml`).

Tests never touch the real database or `public/uploads`: they refuse to run unless `DATABASE_URL` points at the test database on port 55432, and uploads go to a temporary folder. The browser tests use their own database and build folder (`.next-e2e`), so they can run next to `npm run dev`. Don't run them on the shop laptop.

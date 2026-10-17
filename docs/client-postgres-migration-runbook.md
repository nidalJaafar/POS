# Client PostgreSQL Migration Runbook

This runbook moves Sunflower Crafts POS from Supabase to local PostgreSQL on the client's Windows laptop.

## Before The Visit

1. Confirm the refactored app builds locally.
2. Get `SUPABASE_URL` and Supabase service-role key from the Supabase dashboard.
3. Put those credentials in your local `.env.local` as `SUPABASE_URL` and `SUPABASE_API_KEY` only while exporting.
4. Run `npm run migration:export`.
5. Confirm `migration-package/data/items.json`, `orders.json`, `items_orders.json`, `uploads/`, and `manifest.json` exist. The export now refuses packages with broken references (order lines pointing at missing orders or items, the same item twice in one order), so a successful export is restorable.
6. On your development machine (bash), test the restore against the throwaway test database (needs Docker or Podman). Nothing here touches a real database:

   ```bash
   npm run test:db:up
   DATABASE_URL="$(npm run -s test:db:url)" UPLOADS_DIR=/tmp/restore-check npm run migration:restore -- --replace
   npm run test:db:down
   ```
7. Download the PostgreSQL Windows installer.
8. Download the Node.js LTS Windows installer if the client's Node version is unknown.
9. Prepare a USB drive or local copy containing the app folder, `migration-package/`, PostgreSQL installer, and Node.js installer.

## Backup Existing Install

Before replacing anything on the client laptop:

1. Copy the old app folder to a backup folder.
2. Copy the old `.env.local` to the backup folder.
3. Copy the old VB startup script to the backup folder.
4. Confirm the backups are readable before continuing.

## PostgreSQL Windows Install

1. Run the PostgreSQL installer as administrator.
2. Keep the default port `5432`.
3. Set a strong password and store it privately.
4. Keep PostgreSQL Server selected.
5. Finish installation.
6. Open Windows Services.
7. Confirm the PostgreSQL service startup type is `Automatic`.
8. Start the service if it is not already running.

If Node.js is installed or updated, close and reopen Command Prompt or PowerShell so PATH changes are available.

## Database Setup

Open Command Prompt or PowerShell in the app folder.

Create `.env.local`:

```env
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/sunflower_crafts_pos"
```

Create the database with pgAdmin or `createdb`:

```powershell
createdb -U postgres sunflower_crafts_pos
```

If `createdb` is not on PATH, use pgAdmin to create a database named `sunflower_crafts_pos`.

## App Setup

Verify Node and npm are available:

```powershell
node -v
npm -v
```

Before restoring data, confirm `.env.local` has `DATABASE_URL` pointing to `localhost:5432/sunflower_crafts_pos`.

```powershell
npm install
npm run db:migrate
npm run migration:restore
```

`npm install` also generates the database client. `migration:restore` refuses to run if the database already has items or orders. Only add `--replace` (`npm run migration:restore -- --replace`) when you mean to overwrite them; the current data is backed up first. It checks every image and row count before committing; if anything fails, the database and `public/uploads` stay as they were.

Confirm the row counts printed by `npm run migration:restore` match `migration-package/manifest.json`, then continue:

```powershell
npm run build
npm run doctor
npm run start
```

`npm run doctor` must report 0 problems. `npm run start` takes a backup of the database and images first (see `docs/operations.md`).

Open the POS in the browser and verify pages load.

## Startup Script

Use the backed-up VB startup script if rollback is needed.

Use this behavior:

```vbscript
Set WshShell = CreateObject("WScript.Shell")
WScript.Sleep 20000
WshShell.CurrentDirectory = "C:\path\to\sunflower-crafts-pos"
WshShell.Run "cmd /c npm run start", 0, False
```

PostgreSQL should be started by Windows Services, not by this script.

## Reboot Test

1. Restart Windows.
2. Confirm PostgreSQL service is running.
3. Confirm the POS starts automatically.
4. Confirm item images load from `/uploads`.
5. Create a test order.
6. Complete the test order.
7. Confirm completed orders and dashboard still load.
8. Confirm a new folder appeared in `backups/` (created on startup).

## Rollback

1. Stop the new app process.
2. Restore the old app folder from the backup or point the startup script back to the backed-up old folder.
3. Restore the old `.env.local` from the backup.
4. Restore the old VB startup script from the backup if it was changed.
5. Reboot or manually start the previous app.
6. Leave PostgreSQL installed but unused until the issue is fixed.

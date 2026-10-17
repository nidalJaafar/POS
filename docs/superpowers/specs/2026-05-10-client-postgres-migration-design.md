# Client PostgreSQL Migration Design

**Date:** 2026-05-10
**Project:** Sunflower Crafts POS
**Goal:** Move the client's existing Supabase-backed POS data and images to a local PostgreSQL database on a Windows laptop with the smallest practical onsite failure window.

## Context

The current repository has been refactored away from Supabase toward local PostgreSQL:

- Supabase client and operations files are deleted.
- Prisma 7, `pg`, and `@prisma/adapter-pg` are added.
- `DATABASE_URL` is now required at runtime.
- Prisma migrations create `items`, `orders`, and `items_orders`.
- Item images are stored locally under `public/uploads`.
- `scripts/migrate-remote-images.js` can rewrite remote image URLs after data already exists in local Postgres.
- `scripts/seed.js` creates fake development orders and must not be used for the client migration.

The client laptop runs Windows. The client is non-technical, so the migration must be done by the developer onsite and must survive laptop reboots. The existing deployment uses a VB startup script that runs `npm run start` when Windows starts.

## Recommended Approach

Use a prepared offline migration package with native PostgreSQL installed on Windows as an auto-starting Windows service.

This is preferred over Docker because native PostgreSQL has fewer runtime dependencies and starts automatically through Windows Services. It is preferred over a live onsite Supabase migration because the export can be tested before commuting to the client.

## Architecture

The migration has four bounded parts:

1. **Pre-visit export package**
   - Export Supabase `items`, `orders`, and `items_orders` using Supabase API credentials or dashboard access.
   - Download all item images from Supabase Storage or each remote item URL.
   - Transform `items.image` values from remote Supabase URLs to local `/uploads/<filename>` paths.
   - Write a portable `migration-package` folder.

2. **Local Windows runtime**
   - Install native PostgreSQL on Windows.
   - Configure it as an automatic Windows service.
   - Create a local database named `sunflower_crafts_pos`.
   - Configure the app with a local `DATABASE_URL`.

3. **Restore tooling**
   - Run Prisma migrations to create the schema.
   - Restore exported rows into local Postgres while preserving original IDs.
   - Copy images into `public/uploads`.
   - Reset Postgres sequences after inserting explicit IDs.

4. **Verification and rollback**
   - Test restore locally before the visit.
   - Back up the existing app folder and startup script onsite before changing anything.
   - Verify data, images, order creation, order completion, app startup, and reboot behavior.
   - If the migration fails, restore the old app folder and old startup script.

## Migration Package Format

The export should produce this structure:

```text
migration-package/
  data/
    items.json
    orders.json
    items_orders.json
  uploads/
    <downloaded image files>
  manifest.json
```

`manifest.json` should include:

- export timestamp
- Supabase project URL
- row counts for each table
- image count
- list of warnings, if any
- source-to-local image path mappings

## Data Rules

The restore must preserve existing IDs:

- `items.id`
- `orders.id`
- `items_orders.id`

Preserving IDs keeps all relationships intact and reduces risk. After import, the restore script must reset sequences for all three tables so future inserts continue after the highest restored ID.

The export or restore must reject invalid production data before the client visit. These local Prisma fields are required:

- `items.name`
- `items.image`
- `items.price`
- `orders.status`
- `items_orders.order_id`
- `items_orders.item_id`
- `items_orders.quantity`

If Supabase contains null or invalid values for any required field, the export script should fail with exact row IDs and field names so the data can be corrected before deployment.

## Image Migration

The main path should download images during export, before the client visit. Each item image should become a local path:

```text
/uploads/<filename>
```

If two images share the same filename, the export script should generate a unique filename and record the mapping in `manifest.json`.

`scripts/migrate-remote-images.js` remains useful as a fallback only. It can migrate any remaining `http` image values after the local database is restored, but it depends on internet access and should not be the primary migration method.

## Existing Script Reuse

### `scripts/migrate-remote-images.js`

Use as a reference and fallback.

Reusable parts:

- local `DATABASE_URL` loading
- Prisma client setup with `@prisma/adapter-pg`
- `public/uploads` directory creation
- remote image download and local path update pattern

Limitations:

- It only works after items already exist in local Postgres.
- It does not export Supabase rows.
- It does not preserve a migration manifest.
- It logs per-image failures but does not fail the whole migration for missing images.

The new export script should reuse the same image download idea, but move the work earlier into the pre-visit package creation step.

### `scripts/seed.js`

Do not use for the client migration.

It creates synthetic orders for development testing. It can be useful only to test charts and performance locally, but it must not run on the client laptop because it would pollute real sales data.

## New Tooling To Add

Add these scripts:

- `scripts/export-supabase-data.js`
- `scripts/restore-local-postgres.js`

Add these package commands:

```json
{
  "migration:export": "node scripts/export-supabase-data.js",
  "migration:restore": "node scripts/restore-local-postgres.js",
  "db:migrate": "prisma migrate deploy"
}
```

`migration:export` should require old Supabase credentials. Use the Supabase service-role key for the export package because it must read all production rows and storage objects under developer control before the client visit:

```env
SUPABASE_URL="https://<project>.supabase.co"
SUPABASE_API_KEY="<service-role-key>"
```

`migration:restore` should require local Postgres:

```env
DATABASE_URL="postgresql://postgres:<password>@localhost:5432/sunflower_crafts_pos"
```

## Onsite Windows Deployment Flow

1. Back up the existing app folder, `.env.local`, and VB startup script.
2. Install native PostgreSQL for Windows.
3. Confirm PostgreSQL service startup type is automatic.
4. Create the `sunflower_crafts_pos` database.
5. Copy the new app folder and migration package to the laptop.
6. Create `.env.local` with local `DATABASE_URL`.
7. Run `npm install`.
8. Run `npx prisma generate`.
9. Run `npm run db:migrate`.
10. Run `npm run migration:restore`.
11. Run `npm run build`.
12. Run `npm run start` manually and verify the POS.
13. Update the VB startup script if needed.
14. Reboot Windows and verify PostgreSQL and the POS app start automatically.

The VB startup script should include a short delay before starting the app so PostgreSQL has time to finish booting. PostgreSQL itself should be started by the Windows service, not by the VB script.

## Verification Checklist

Before the visit:

- Export package exists and includes data, uploads, and manifest.
- Restore succeeds against a clean local Postgres database.
- Row counts match the manifest.
- No `items.image` values point to Supabase or `http` URLs.
- `npm run build` succeeds.

Onsite:

- Items page loads.
- Item images load from `/uploads`.
- Pending orders load.
- Completed orders load.
- Dashboard loads.
- Creating a new order works.
- Completing an order works.
- Printer behavior is checked if the printer is connected.
- Reboot starts PostgreSQL automatically.
- Existing VB startup starts the app automatically, or the updated script does.

## Rollback Plan

Do not delete the current production app folder during migration. Rename it with a date suffix and keep its `.env.local` and startup script.

If migration fails onsite:

1. Stop the new app process.
2. Restore the old app folder path or point the startup script back to it.
3. Restore the old `.env.local`.
4. Reboot or manually start the old app.
5. Leave PostgreSQL installed but unused until the issue is fixed.

## Success Criteria

The migration is complete when the client laptop runs the refactored app using local PostgreSQL, all prior Supabase data and images are present, new orders can be created, completed orders can be printed, and the app starts automatically after a Windows reboot without requiring client action.

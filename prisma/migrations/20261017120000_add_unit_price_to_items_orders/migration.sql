-- AlterTable: snapshot the item price on each order line
ALTER TABLE "items_orders" ADD COLUMN "unit_price" DOUBLE PRECISION;

-- Backfill existing rows with the item's current price (the best value available)
UPDATE "items_orders" SET "unit_price" = "items"."price"
FROM "items" WHERE "items"."id" = "items_orders"."item_id";

ALTER TABLE "items_orders" ALTER COLUMN "unit_price" SET NOT NULL;

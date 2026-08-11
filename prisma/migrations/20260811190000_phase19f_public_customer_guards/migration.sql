-- Public/customer invariants that must hold even if a future endpoint forgets a UI-level check.

CREATE OR REPLACE FUNCTION "guard_customer_identity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."phone" IS NOT NULL AND btrim(NEW."phone") <> '' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW."shopId" || ':customer-phone:' || NEW."phone", 0));
  END IF;
  IF NEW."email" IS NOT NULL AND btrim(NEW."email") <> '' THEN
    NEW."email" := lower(btrim(NEW."email"));
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW."shopId" || ':customer-email:' || NEW."email", 0));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Customer" c
    WHERE c."shopId" = NEW."shopId"
      AND c."id" <> NEW."id"
      AND (
        (NEW."phone" IS NOT NULL AND btrim(NEW."phone") <> '' AND c."phone" = NEW."phone")
        OR
        (NEW."email" IS NOT NULL AND btrim(NEW."email") <> '' AND lower(c."email") = NEW."email")
      )
  ) THEN
    RAISE EXCEPTION 'EJM_CUSTOMER_IDENTITY_DUPLICATE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Customer_identity_guard" ON "Customer";
CREATE TRIGGER "Customer_identity_guard"
BEFORE INSERT OR UPDATE OF "phone", "email", "shopId" ON "Customer"
FOR EACH ROW
EXECUTE FUNCTION "guard_customer_identity"();

CREATE OR REPLACE FUNCTION "guard_verified_online_order"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."channel" = 'ONLINE' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "Shop" s
      WHERE s."id" = NEW."shopId"
        AND s."isActive" = TRUE
        AND s."verificationStatus" = 'VERIFIED'
        AND s."storefrontEnabled" = TRUE
        AND s."publicOrderingEnabled" = TRUE
    ) THEN
      RAISE EXCEPTION 'EJM_PUBLIC_SHOP_NOT_VERIFIED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Order_verified_online_shop_guard" ON "Order";
CREATE TRIGGER "Order_verified_online_shop_guard"
BEFORE INSERT ON "Order"
FOR EACH ROW
EXECUTE FUNCTION "guard_verified_online_order"();

CREATE OR REPLACE FUNCTION "guard_customer_artwork_limit"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  asset_count INTEGER;
BEGIN
  -- Serialize assets per request so concurrent uploads cannot both pass the count.
  PERFORM 1 FROM "CustomerProductionRequest" r
  WHERE r."id" = NEW."requestId" AND r."shopId" = NEW."shopId" AND r."buyerId" = NEW."buyerId"
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'EJM_CUSTOMER_PRODUCTION_REQUEST_NOT_FOUND';
  END IF;

  SELECT COUNT(*) INTO asset_count
  FROM "CustomerProductionAsset" a
  WHERE a."requestId" = NEW."requestId" AND a."shopId" = NEW."shopId" AND a."buyerId" = NEW."buyerId";

  IF asset_count >= 6 THEN
    RAISE EXCEPTION 'EJM_CUSTOMER_ARTWORK_LIMIT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "CustomerProductionAsset_limit_guard" ON "CustomerProductionAsset";
CREATE TRIGGER "CustomerProductionAsset_limit_guard"
BEFORE INSERT ON "CustomerProductionAsset"
FOR EACH ROW
EXECUTE FUNCTION "guard_customer_artwork_limit"();

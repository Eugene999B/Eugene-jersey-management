-- Release 37 commercial subscription enforcement.
-- Existing shops without a configured ShopSubscriptionContract retain legacy access.

CREATE OR REPLACE FUNCTION "ejm_assert_subscription_access"(
  p_shop_id TEXT,
  p_feature TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_contract RECORD;
  v_snapshot JSONB;
  v_features JSONB;
  v_status TEXT;
  v_due_at TIMESTAMP(3);
  v_grace_ends_at TIMESTAMP(3);
  v_grace_days INTEGER;
BEGIN
  SELECT
    c."subscriptionStatus",
    c."trialEndsAt",
    c."renewalAt",
    c."graceEndsAt",
    c."termsSnapshot"
  INTO v_contract
  FROM "ShopSubscriptionContract" c
  WHERE c."shopId" = p_shop_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_snapshot := v_contract."termsSnapshot";
  IF COALESCE((v_snapshot ->> 'isConfigured')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  v_features := CASE
    WHEN jsonb_typeof(v_snapshot -> 'features') = 'array' THEN v_snapshot -> 'features'
    ELSE '[]'::JSONB
  END;

  -- Empty feature arrays remain migration-compatible. Once features are configured,
  -- the assigned plan becomes authoritative.
  IF p_feature IS NOT NULL
    AND jsonb_array_length(v_features) > 0
    AND NOT (v_features ? p_feature)
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'EJM_SUBSCRIPTION_FEATURE_REQUIRED:' || p_feature;
  END IF;

  v_status := v_contract."subscriptionStatus"::TEXT;
  v_grace_days := GREATEST(COALESCE(NULLIF(v_snapshot ->> 'gracePeriodDays', '')::INTEGER, 0), 0);

  IF v_status = 'CANCELLED' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EJM_SUBSCRIPTION_CANCELLED';
  END IF;

  IF v_status = 'SUSPENDED' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EJM_SUBSCRIPTION_SUSPENDED';
  END IF;

  IF v_status = 'TRIAL' THEN
    v_due_at := COALESCE(v_contract."trialEndsAt", v_contract."renewalAt");
  ELSE
    v_due_at := v_contract."renewalAt";
  END IF;

  v_grace_ends_at := COALESCE(
    v_contract."graceEndsAt",
    CASE WHEN v_due_at IS NULL THEN NULL ELSE v_due_at + make_interval(days => v_grace_days) END
  );

  IF v_status = 'PAST_DUE' THEN
    IF v_grace_ends_at IS NULL OR CURRENT_TIMESTAMP > v_grace_ends_at THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EJM_SUBSCRIPTION_EXPIRED';
    END IF;
    RETURN v_snapshot;
  END IF;

  IF v_due_at IS NOT NULL AND CURRENT_TIMESTAMP > v_due_at THEN
    IF v_grace_ends_at IS NULL OR CURRENT_TIMESTAMP > v_grace_ends_at THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EJM_SUBSCRIPTION_EXPIRED';
    END IF;
  END IF;

  RETURN v_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION "ejm_enforce_product_subscription_limit"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot JSONB;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ejm-product-limit:' || NEW."shopId", 0));
  v_snapshot := "ejm_assert_subscription_access"(NEW."shopId", 'INVENTORY');

  IF v_snapshot IS NULL OR NULLIF(v_snapshot ->> 'maxProducts', '') IS NULL THEN
    RETURN NEW;
  END IF;

  v_limit := (v_snapshot ->> 'maxProducts')::INTEGER;
  SELECT COUNT(*) INTO v_count FROM "Product" p WHERE p."shopId" = NEW."shopId";

  IF v_count >= v_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'EJM_SUBSCRIPTION_PRODUCT_LIMIT:' || v_limit::TEXT;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Product_subscription_limit" ON "Product";
CREATE TRIGGER "Product_subscription_limit"
BEFORE INSERT ON "Product"
FOR EACH ROW
EXECUTE FUNCTION "ejm_enforce_product_subscription_limit"();

CREATE OR REPLACE FUNCTION "ejm_enforce_order_subscription_limit"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_snapshot JSONB;
  v_limit INTEGER;
  v_count INTEGER;
  v_month_start TIMESTAMP(3);
  v_month_end TIMESTAMP(3);
  v_feature TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ejm-order-limit:' || NEW."shopId", 0));
  v_feature := CASE WHEN NEW."channel"::TEXT = 'POS' THEN 'POS' ELSE 'STOREFRONT' END;
  v_snapshot := "ejm_assert_subscription_access"(NEW."shopId", v_feature);

  IF v_snapshot IS NULL OR NULLIF(v_snapshot ->> 'maxOrdersPerMonth', '') IS NULL THEN
    RETURN NEW;
  END IF;

  v_limit := (v_snapshot ->> 'maxOrdersPerMonth')::INTEGER;
  v_month_start := date_trunc('month', COALESCE(NEW."createdAt", CURRENT_TIMESTAMP));
  v_month_end := v_month_start + INTERVAL '1 month';

  SELECT COUNT(*)
  INTO v_count
  FROM "Order" o
  WHERE o."shopId" = NEW."shopId"
    AND o."createdAt" >= v_month_start
    AND o."createdAt" < v_month_end;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'EJM_SUBSCRIPTION_ORDER_LIMIT:' || v_limit::TEXT;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Order_subscription_limit" ON "Order";
CREATE TRIGGER "Order_subscription_limit"
BEFORE INSERT ON "Order"
FOR EACH ROW
EXECUTE FUNCTION "ejm_enforce_order_subscription_limit"();

-- Phase 2 keeps every existing tenant operational while adding explicit per-business module control.
ALTER TABLE "Shop"
ADD COLUMN "enabledModules" TEXT[] NOT NULL
DEFAULT ARRAY['PRINTING_PRODUCTION', 'SUPPLIERS_PURCHASING', 'ONLINE_SELLING', 'MARKETPLACE']::TEXT[];

-- Sales/POS and inventory are ESM core capabilities. Keep subscription status and
-- usage limits enforced, but do not require optional feature flags for these two paths.
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

  -- Empty feature arrays remain migration-compatible. POS and INVENTORY are core;
  -- every other configured feature remains authoritative.
  IF p_feature IS NOT NULL
    AND p_feature NOT IN ('POS', 'INVENTORY')
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

-- Once inventory has been posted, the costing fields are historical evidence for
-- the exact stock movements that were committed. Prevent later/stale edits from
-- making the snapshot disagree with the physical inventory ledger.
CREATE OR REPLACE FUNCTION "prevent_posted_production_cost_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."inventoryPostedAt" IS NOT NULL THEN
    IF NEW."inventoryPostedAt" IS DISTINCT FROM OLD."inventoryPostedAt"
      OR NEW."designProductionBriefId" IS DISTINCT FROM OLD."designProductionBriefId"
      OR NEW."designJobId" IS DISTINCT FROM OLD."designJobId"
      OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
      OR NEW."garmentInventoryItemId" IS DISTINCT FROM OLD."garmentInventoryItemId"
      OR NEW."materialInventoryItemId" IS DISTINCT FROM OLD."materialInventoryItemId"
      OR NEW."garmentCost" IS DISTINCT FROM OLD."garmentCost"
      OR NEW."materialUsedAreaMm2" IS DISTINCT FROM OLD."materialUsedAreaMm2"
      OR NEW."materialUsedMetres" IS DISTINCT FROM OLD."materialUsedMetres"
      OR NEW."materialWasteMetres" IS DISTINCT FROM OLD."materialWasteMetres"
      OR NEW."materialCost" IS DISTINCT FROM OLD."materialCost"
      OR NEW."wasteCost" IS DISTINCT FROM OLD."wasteCost"
      OR NEW."labourCost" IS DISTINCT FROM OLD."labourCost"
      OR NEW."designCharge" IS DISTINCT FROM OLD."designCharge"
      OR NEW."pressingCharge" IS DISTINCT FROM OLD."pressingCharge"
      OR NEW."additionalServicesCost" IS DISTINCT FROM OLD."additionalServicesCost"
      OR NEW."totalCost" IS DISTINCT FROM OLD."totalCost"
      OR NEW."revenue" IS DISTINCT FROM OLD."revenue"
      OR NEW."profit" IS DISTINCT FROM OLD."profit"
      OR NEW."marginPercent" IS DISTINCT FROM OLD."marginPercent"
    THEN
      RAISE EXCEPTION 'POSTED_PRODUCTION_COST_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ProductionCostSnapshot_posted_immutable" ON "ProductionCostSnapshot";
CREATE TRIGGER "ProductionCostSnapshot_posted_immutable"
BEFORE UPDATE ON "ProductionCostSnapshot"
FOR EACH ROW
EXECUTE FUNCTION "prevent_posted_production_cost_mutation"();

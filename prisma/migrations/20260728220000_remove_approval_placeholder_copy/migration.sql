-- Remove obsolete second-administrator wording without overwriting any customised plan description.
UPDATE "SubscriptionPlan"
SET "description" = 'Migration placeholder. Configure and save commercial terms before offering this plan publicly.'
WHERE "tier" = 'FREE'
  AND "description" = 'Migration placeholder. Submit and approve commercial terms before offering this plan publicly.';

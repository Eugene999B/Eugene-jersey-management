CREATE OR REPLACE FUNCTION ejm_normalize_and_protect_subscription_invoice_terms()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."billingCycle" = 'YEARLY'::"BillingCycle" THEN
      NEW."periodEnd" := NEW."periodStart" + INTERVAL '1 year';
    ELSE
      NEW."periodEnd" := NEW."periodStart" + INTERVAL '1 month';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."shopId" IS DISTINCT FROM OLD."shopId"
     OR NEW."contractId" IS DISTINCT FROM OLD."contractId"
     OR NEW."invoiceNumber" IS DISTINCT FROM OLD."invoiceNumber"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."amount" IS DISTINCT FROM OLD."amount"
     OR NEW."billingCycle" IS DISTINCT FROM OLD."billingCycle"
     OR NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
     OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd"
     OR NEW."dueAt" IS DISTINCT FROM OLD."dueAt"
     OR NEW."planVersion" IS DISTINCT FROM OLD."planVersion"
     OR NEW."planName" IS DISTINCT FROM OLD."planName"
     OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."termsSnapshot" IS DISTINCT FROM OLD."termsSnapshot" THEN
    RAISE EXCEPTION 'EJM_SUBSCRIPTION_INVOICE_TERMS_IMMUTABLE'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ejm_subscription_invoice_10_terms_guard ON "SubscriptionInvoice";
CREATE TRIGGER ejm_subscription_invoice_10_terms_guard
BEFORE INSERT OR UPDATE ON "SubscriptionInvoice"
FOR EACH ROW
EXECUTE FUNCTION ejm_normalize_and_protect_subscription_invoice_terms();

CREATE OR REPLACE FUNCTION ejm_protect_subscription_invoice_terminal_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" IN ('PAID'::"SubscriptionInvoiceStatus", 'VOID'::"SubscriptionInvoiceStatus")
     AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RETURN OLD;
  END IF;

  IF OLD."status" = 'PAID'::"SubscriptionInvoiceStatus"
     AND (NEW."paidAt" IS NULL OR NEW."paidAt" IS DISTINCT FROM OLD."paidAt") THEN
    RAISE EXCEPTION 'EJM_SUBSCRIPTION_INVOICE_PAID_AT_IMMUTABLE'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD."status" = 'VOID'::"SubscriptionInvoiceStatus"
     AND (NEW."voidedAt" IS NULL OR NEW."voidReason" IS NULL) THEN
    RAISE EXCEPTION 'EJM_SUBSCRIPTION_INVOICE_VOID_AUDIT_REQUIRED'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ejm_subscription_invoice_terminal_state_guard ON "SubscriptionInvoice";
DROP TRIGGER IF EXISTS ejm_subscription_invoice_20_terminal_state_guard ON "SubscriptionInvoice";
CREATE TRIGGER ejm_subscription_invoice_20_terminal_state_guard
BEFORE UPDATE ON "SubscriptionInvoice"
FOR EACH ROW
EXECUTE FUNCTION ejm_protect_subscription_invoice_terminal_state();

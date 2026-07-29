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
CREATE TRIGGER ejm_subscription_invoice_terminal_state_guard
BEFORE UPDATE ON "SubscriptionInvoice"
FOR EACH ROW
EXECUTE FUNCTION ejm_protect_subscription_invoice_terminal_state();

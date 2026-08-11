-- Phase 19G: serialize cutter queue creation against profile retirement and block unsafe destructive changes.

CREATE OR REPLACE FUNCTION "guard_machine_job_insert_state"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  duplicate_job_id TEXT;
BEGIN
  -- Serialize job creation against profile deactivation/deletion.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW."shopId" || ':machine-profile:' || NEW."machineProfileId", 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM "ShopMachineProfile" profile
    WHERE profile."id" = NEW."machineProfileId"
      AND profile."shopId" = NEW."shopId"
      AND profile."isActive" = TRUE
      AND profile."outputFormat" = 'HPGL'
      AND profile."connectionMode" = 'WEB_SERIAL'
  ) THEN
    RAISE EXCEPTION 'MACHINE_JOB_SOURCE_INVALID';
  END IF;

  -- Serialize identical queue submissions. An explicit resend remains available
  -- after the prior job has left the active queue; two active identical jobs are
  -- never useful and are unsafe around double-clicks/retries.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW."shopId" || ':machine-job:' || NEW."machineProfileId" || ':' || NEW."payloadHash", 0)
  );

  SELECT job."id"
  INTO duplicate_job_id
  FROM "MachineProductionJob" job
  WHERE job."shopId" = NEW."shopId"
    AND job."machineProfileId" = NEW."machineProfileId"
    AND job."payloadHash" = NEW."payloadHash"
    AND job."status" IN ('PREPARED', 'SENDING', 'FAILED')
  ORDER BY job."createdAt" DESC
  LIMIT 1;

  IF duplicate_job_id IS NOT NULL THEN
    RAISE EXCEPTION 'MACHINE_JOB_DUPLICATE:%', duplicate_job_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "MachineProductionJob_insert_guard" ON "MachineProductionJob";
CREATE TRIGGER "MachineProductionJob_insert_guard"
BEFORE INSERT ON "MachineProductionJob"
FOR EACH ROW
EXECUTE FUNCTION "guard_machine_job_insert_state"();

CREATE OR REPLACE FUNCTION "guard_machine_profile_destructive_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_shop_id TEXT;
  target_profile_id TEXT;
BEGIN
  target_shop_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."shopId" ELSE NEW."shopId" END;
  target_profile_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;

  -- Same lock key as machine-job inserts closes insert-vs-retire/delete races.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(target_shop_id || ':machine-profile:' || target_profile_id, 0)
  );

  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM "MachineProductionJob" job
      WHERE job."shopId" = OLD."shopId"
        AND job."machineProfileId" = OLD."id"
    ) THEN
      RAISE EXCEPTION 'EJM_MACHINE_PROFILE_HAS_HISTORY';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."isActive" = TRUE AND NEW."isActive" = FALSE THEN
    IF EXISTS (
      SELECT 1
      FROM "MachineProductionJob" job
      WHERE job."shopId" = OLD."shopId"
        AND job."machineProfileId" = OLD."id"
        AND job."status" IN ('PREPARED', 'SENDING', 'FAILED')
    ) THEN
      RAISE EXCEPTION 'EJM_MACHINE_PROFILE_HAS_OPEN_JOBS';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ShopMachineProfile_destructive_guard" ON "ShopMachineProfile";
CREATE TRIGGER "ShopMachineProfile_destructive_guard"
BEFORE UPDATE OF "isActive" OR DELETE ON "ShopMachineProfile"
FOR EACH ROW
EXECUTE FUNCTION "guard_machine_profile_destructive_change"();
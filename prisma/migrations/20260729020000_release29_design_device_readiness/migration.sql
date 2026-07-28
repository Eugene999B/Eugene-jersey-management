ALTER TABLE "ShopMachineProfile"
  ADD COLUMN "manufacturer" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "deviceType" TEXT NOT NULL DEFAULT 'CUTTER_PLOTTER',
  ADD COLUMN "connectionMode" TEXT NOT NULL DEFAULT 'VENDOR_FILE',
  ADD COLUMN "usbVendorId" INTEGER,
  ADD COLUMN "usbProductId" INTEGER;

UPDATE "ShopMachineProfile"
SET
  "deviceType" = CASE
    WHEN "outputFormat" = 'PRINT_RIP' THEN 'LARGE_FORMAT_PRINTER'
    ELSE 'CUTTER_PLOTTER'
  END,
  "connectionMode" = CASE
    WHEN "outputFormat" = 'HPGL' THEN 'WEB_SERIAL'
    WHEN "outputFormat" = 'PRINT_RIP' THEN 'SYSTEM_PRINT'
    ELSE 'VENDOR_FILE'
  END;

CREATE INDEX "ShopMachineProfile_shopId_deviceType_idx"
  ON "ShopMachineProfile"("shopId", "deviceType");

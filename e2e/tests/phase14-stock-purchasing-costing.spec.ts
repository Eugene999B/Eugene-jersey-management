import { expect, test, type Locator } from "@playwright/test";

const LOGIN_ID = "EJM-E2E-OWNER";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const login = page.getByPlaceholder("Click, then enter Login ID or email");
  const secret = page.getByPlaceholder("Click, then enter password");
  await login.click();
  await login.fill(LOGIN_ID);
  await secret.click();
  await secret.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
}

function formForButton(page: import("@playwright/test").Page, buttonName: string) {
  return page.getByRole("button", { name: buttonName, exact: true }).locator("xpath=ancestor::form");
}

async function selectContaining(select: Locator, text: string) {
  const option = select.locator("option").filter({ hasText: text }).first();
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`Could not find selectable option containing: ${text}`);
  await select.selectOption(value);
}

async function productionResourceId(page: import("@playwright/test").Page, heading: string) {
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
  await expect(article).toBeVisible();
  return article.locator('input[name="id"]').first().inputValue();
}

test("production stock receives purchases and posts true job cost exactly once", async ({ page }) => {
  test.setTimeout(220_000);
  const suffix = Date.now().toString(36);
  const garmentStockName = `Phase 14 stock tee ${suffix}`;
  const vinylStockName = `Phase 14 stock HTV ${suffix}`;
  const supplierName = `Phase 14 supplier ${suffix}`;
  const materialName = `Phase 14 recipe HTV ${suffix}`;
  const garmentName = `Phase 14 recipe tee ${suffix}`;
  const placementName = `Phase 14 recipe chest ${suffix}`;
  const designName = `Phase 14 cost job ${suffix}`;

  await signIn(page);
  await page.goto("/dashboard/production-stock");
  await expect(page.getByRole("heading", { name: "Production stock & true job cost", exact: true })).toBeVisible();

  const addGarment = formForButton(page, "Add stock item");
  await addGarment.getByLabel("Stock kind").selectOption("GARMENT");
  await addGarment.getByLabel("Item name").fill(garmentStockName);
  await addGarment.getByLabel("Colour").fill("Black");
  await addGarment.getByLabel("Exact size").fill("M");
  await addGarment.getByLabel("Stock unit").selectOption("PIECE");
  await addGarment.getByLabel("Opening quantity").fill("2");
  await addGarment.getByLabel(/Unit cost/).fill("25");
  await addGarment.getByLabel("Low-stock level").fill("1");
  await addGarment.getByRole("button", { name: "Add stock item", exact: true }).click();
  await expect(page.getByText(garmentStockName, { exact: true })).toBeVisible();

  const addVinyl = formForButton(page, "Add stock item");
  await addVinyl.getByLabel("Stock kind").selectOption("VINYL");
  await addVinyl.getByLabel("Item name").fill(vinylStockName);
  await addVinyl.getByLabel("Colour").fill("White");
  await addVinyl.getByLabel("Exact size").fill("");
  await addVinyl.getByLabel("Stock unit").selectOption("METRE");
  await addVinyl.getByLabel("Opening quantity").fill("3");
  await addVinyl.getByLabel(/Unit cost/).fill("12");
  await addVinyl.getByLabel("Low-stock level").fill("0.5");
  await addVinyl.getByRole("button", { name: "Add stock item", exact: true }).click();
  const vinylRow = page.getByRole("row").filter({ hasText: vinylStockName });
  await expect(vinylRow).toContainText("3 metre");
  await expect(vinylRow).toContainText("12.00");

  await page.goto("/dashboard/suppliers");
  const supplierForm = formForButton(page, "Save supplier");
  await supplierForm.locator('input[name="name"]').fill(supplierName);
  await supplierForm.locator('input[name="contactName"]').fill("Phase 14 buyer");
  await supplierForm.getByRole("button", { name: "Save supplier", exact: true }).click();
  await expect(page.getByRole("heading", { name: supplierName, exact: true })).toBeVisible();

  const poForm = formForButton(page, "Send purchase order");
  await poForm.locator('select[name="supplierId"]').selectOption({ label: supplierName });
  await selectContaining(poForm.locator('select[name="productionInventoryItemId"]'), vinylStockName);
  await poForm.locator('input[name="description"]').fill(`White HTV restock ${suffix}`);
  await poForm.locator('input[name="quantity"]').fill("2");
  await poForm.locator('input[name="unitCost"]').fill("14");
  await poForm.getByRole("button", { name: "Send purchase order", exact: true }).click();

  const po = page.getByRole("article").filter({ hasText: `White HTV restock ${suffix}` });
  await expect(po).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await po.getByRole("button", { name: "Receive & post stock", exact: true }).click();
  await expect(po.getByText("Received", { exact: true })).toBeVisible();

  await page.goto("/dashboard/production-stock");
  const receivedVinylRow = page.getByRole("row").filter({ hasText: vinylStockName });
  await expect(receivedVinylRow).toContainText("5 metre");
  await expect(receivedVinylRow).toContainText("12.80");
  const supplierBalancePanel = page.getByRole("heading", { name: "Supplier balances & payments", exact: true }).locator("xpath=ancestor::section");
  await expect(supplierBalancePanel).toContainText(supplierName);
  await expect(supplierBalancePanel).toContainText("28.00");

  await page.goto("/dashboard/designs/materials");
  const material = formForButton(page, "Add material recipe");
  await material.getByLabel("Material name").fill(materialName);
  await material.getByLabel("Material type").fill("Heat-transfer vinyl");
  await material.getByLabel("Colour").fill("White");
  await material.getByLabel("Roll width (mm)").fill("500");
  await material.getByLabel("Remaining length (m)").fill("20");
  await material.getByLabel("Cost per metre").fill("12.8");
  await material.getByLabel("Blade / profile").fill("45 degree blade");
  await material.getByLabel("Cutter force").fill("90");
  await material.getByLabel("Cutter speed").fill("300");
  await material.getByLabel("Cut passes").fill("1");
  await material.getByLabel("Press temperature (°C)").fill("150");
  await material.getByLabel("Press duration (seconds)").fill("12");
  await material.getByLabel("Pressure").fill("Medium");
  await material.getByLabel("Peel method").fill("Warm");
  await material.getByLabel("Repress (seconds)").fill("2");
  await material.getByRole("button", { name: "Add material recipe", exact: true }).click();
  const materialId = await productionResourceId(page, materialName);

  const garment = formForButton(page, "Add garment profile");
  await garment.getByLabel("Garment profile").fill(garmentName);
  await garment.getByLabel("Garment type").fill("T-shirt");
  await garment.getByLabel("Colour").fill("Black");
  await garment.getByLabel("Fabric").fill("100% cotton");
  await garment.getByLabel("Available sizes").fill("S, M, L");
  await garment.getByLabel("Maximum safe press temperature (°C)").fill("170");
  await garment.getByLabel("Garment cost").fill("25");
  await garment.getByLabel("Default selling price").fill("80");
  await garment.getByRole("button", { name: "Add garment profile", exact: true }).click();
  const garmentId = await productionResourceId(page, garmentName);

  const placement = formForButton(page, "Add placement template");
  await placement.getByLabel("Placement name").fill(placementName);
  await placement.getByLabel("Location code").fill("LEFT_CHEST");
  await placement.getByLabel("Garment profile").selectOption({ label: garmentName });
  await placement.getByLabel("Default width (mm)").fill("100");
  await placement.getByLabel("Default height (mm)").fill("100");
  await placement.getByLabel("Size-specific dimensions").fill("M: 110x105");
  await placement.getByRole("button", { name: "Add placement template", exact: true }).click();
  const placementId = await productionResourceId(page, placementName);

  const briefId = await page.evaluate(async ({ title, garmentId, placementId, materialId }) => {
    const designResponse = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        canvas: {
          version: 6,
          jobName: title,
          customer: "",
          material: "htv",
          sheet: "custom",
          customWidth: 300,
          customHeight: 500,
          copies: 1,
          mirror: true,
          showGrid: true,
          snap: true,
          weedBox: true,
          registrationMarks: false,
          contourOffset: 0,
          layers: [{ id: "phase14-artwork", kind: "rectangle", name: "Cost artwork", visible: true, locked: false, x: 100, y: 100, width: 80, height: 60, rotation: 0, color: "#111827" }],
        },
      }),
    });
    const design = await designResponse.json() as { design?: { id: string }; error?: string };
    if (!designResponse.ok || !design.design) throw new Error(design.error ?? "Could not create costing design fixture.");
    const briefResponse = await fetch("/api/design-production-briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designJobId: design.design.id, garmentId, garmentSize: "M", placementId, materialId, action: "REVIEW" }),
    });
    const brief = await briefResponse.json() as { brief?: { id: string }; error?: string };
    if (!briefResponse.ok || !brief.brief) throw new Error(brief.error ?? "Could not create costing production brief.");
    return brief.brief.id;
  }, { title: designName, garmentId, placementId, materialId });
  expect(briefId).toBeTruthy();

  await page.goto("/dashboard/production-stock");
  const job = page.getByRole("article").filter({ has: page.getByRole("heading", { name: designName, exact: true }) });
  await expect(job).toBeVisible();
  await selectContaining(job.locator('select[name="garmentInventoryItemId"]'), garmentStockName);
  await selectContaining(job.locator('select[name="materialInventoryItemId"]'), vinylStockName);
  await job.locator('input[name="revenue"]').fill("80");
  await job.locator('input[name="materialUsedMetres"]').fill("0.5");
  await job.locator('input[name="materialWasteMetres"]').fill("0.1");
  await job.locator('input[name="labourCost"]').fill("5");
  await job.locator('input[name="designCharge"]').fill("3");
  await job.locator('input[name="pressingCharge"]').fill("2");
  await job.locator('input[name="additionalServicesCost"]').fill("1");
  await job.getByRole("button", { name: "Save true cost", exact: true }).click();

  const costedJob = page.getByRole("article").filter({ has: page.getByRole("heading", { name: designName, exact: true }) });
  await expect(costedJob).toContainText("43.68");
  await expect(costedJob).toContainText("36.32");
  await expect(costedJob).toContainText("45.4%");
  await costedJob.getByRole("button", { name: "Post garment, material use and waste to stock", exact: true }).click();
  await expect(page.getByRole("article").filter({ has: page.getByRole("heading", { name: designName, exact: true }) }).getByText("Inventory posted", { exact: true })).toBeVisible();

  const finalGarment = page.getByRole("row").filter({ hasText: garmentStockName });
  const finalVinyl = page.getByRole("row").filter({ hasText: vinylStockName });
  await expect(finalGarment).toContainText("1 pc");
  await expect(finalVinyl).toContainText("4.4 metre");
  await expect(page.getByRole("button", { name: "Post garment, material use and waste to stock", exact: true })).toHaveCount(0);
});
import { expect, test } from "@playwright/test";

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
  return page.getByRole("button", { name: buttonName }).locator("xpath=ancestor::form");
}

test("saved artwork receives explicit garment production review before cutter handoff", async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  const materialName = `Phase 12 HTV ${suffix}`;
  const garmentName = `Phase 12 tee ${suffix}`;
  const placementName = `Phase 12 chest ${suffix}`;
  const designName = `Phase 12 artwork ${suffix}`;

  await signIn(page);
  await page.goto("/dashboard/designs/materials");

  const material = formForButton(page, "Add material recipe");
  await material.getByLabel("Material name").fill(materialName);
  await material.getByLabel("Material type").fill("Heat-transfer vinyl");
  await material.getByLabel("Colour").fill("White");
  await material.getByLabel("Roll width (mm)").fill("500");
  await material.getByLabel("Remaining length (m)").fill("20");
  await material.getByLabel("Cost per metre").fill("12");
  await material.getByLabel("Blade / profile").fill("45 degree blade");
  await material.getByLabel("Cutter force").fill("90");
  await material.getByLabel("Cutter speed").fill("300");
  await material.getByLabel("Cut passes").fill("1");
  await material.getByLabel("Press temperature (°C)").fill("150");
  await material.getByLabel("Press duration (seconds)").fill("12");
  await material.getByLabel("Pressure").fill("Medium");
  await material.getByLabel("Peel method").fill("Warm");
  await material.getByLabel("Repress (seconds)").fill("3");
  await material.getByRole("button", { name: "Add material recipe" }).click();
  await expect(page.getByRole("heading", { name: materialName })).toBeVisible();

  const garment = formForButton(page, "Add garment profile");
  await garment.getByLabel("Garment profile").fill(garmentName);
  await garment.getByLabel("Garment type").fill("T-shirt");
  await garment.getByLabel("Colour").fill("Black");
  await garment.getByLabel("Fabric").fill("100% cotton");
  await garment.getByLabel("Available sizes").fill("S, M, L");
  await garment.getByLabel("Maximum safe press temperature (°C)").fill("170");
  await garment.getByLabel("Garment cost").fill("25");
  await garment.getByLabel("Default selling price").fill("45");
  await garment.getByRole("button", { name: "Add garment profile" }).click();
  await expect(page.getByRole("heading", { name: garmentName })).toBeVisible();

  const placement = formForButton(page, "Add placement template");
  await placement.getByLabel("Placement name").fill(placementName);
  await placement.getByLabel("Location code").fill("LEFT_CHEST");
  await placement.getByLabel("Garment profile").selectOption({ label: garmentName });
  await placement.getByLabel("Default width (mm)").fill("100");
  await placement.getByLabel("Default height (mm)").fill("100");
  await placement.getByLabel("Size-specific dimensions").fill("M: 110x105");
  await placement.getByRole("button", { name: "Add placement template" }).click();
  await expect(page.getByRole("heading", { name: placementName })).toBeVisible();

  const designId = await page.evaluate(async ({ title }) => {
    const response = await fetch("/api/designs", {
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
          layers: [{
            id: "phase12-artwork",
            kind: "rectangle",
            name: "Chest artwork",
            visible: true,
            locked: false,
            x: 100,
            y: 100,
            width: 80,
            height: 60,
            rotation: 0,
            color: "#111827",
          }],
        },
      }),
    });
    const result = await response.json() as { design?: { id: string }; error?: string };
    if (!response.ok || !result.design) throw new Error(result.error ?? "Could not create Phase 12 design fixture.");
    return result.design.id;
  }, { title: designName });

  await page.goto(`/dashboard/designs/workflow?design=${encodeURIComponent(designId)}`);
  await expect(page.getByRole("heading", { name: "Guided production" })).toBeVisible();
  await expect(page.getByLabel("Saved Design Studio artwork")).toHaveValue(designId);

  await page.getByRole("button", { name: new RegExp(garmentName) }).click();
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(placementName) }).click();
  await page.getByRole("button", { name: new RegExp(materialName) }).click();

  await expect(page.getByText("80.0 × 60.0 mm").first()).toBeVisible();
  await expect(page.getByText("110.0 × 105.0 mm")).toBeVisible();
  await expect(page.getByText("500.0 mm roll · Mirror")).toBeVisible();
  await expect(page.getByText(`Garment: ${garmentName}`)).toBeVisible();
  await expect(page.getByText("Exact size: M")).toBeVisible();

  await page.getByRole("button", { name: "Approve production review" }).click();
  await expect(page.getByText(/Production review approved/)).toBeVisible();
  const cutterLink = page.getByRole("link", { name: /Continue to cutter/ });
  await expect(cutterLink).toBeVisible();
  await cutterLink.click();

  await expect(page.getByRole("heading", { name: "Cutter operations" })).toBeVisible();
  await expect(page.getByText("Reviewed guided-production job selected")).toBeVisible();
});

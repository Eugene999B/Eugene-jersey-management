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

test("owner configures real production material, garment, placement and heat press rules", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  await page.goto("/dashboard/designs/materials");
  await expect(page.getByRole("heading", { name: "Materials, garments & press recipes" })).toBeVisible();

  const heatPress = formForButton(page, "Save heat press profile");
  await heatPress.getByLabel("Press name").fill("Phase 11 manual clamshell");
  await heatPress.getByLabel("Plate width (mm)").fill("380");
  await heatPress.getByLabel("Plate height (mm)").fill("380");
  await heatPress.getByLabel("Minimum temperature (°C)").fill("80");
  await heatPress.getByLabel("Maximum temperature (°C)").fill("220");
  await heatPress.getByLabel("Pressure control").fill("Manual pressure knob");
  await heatPress.getByLabel("Timer control").fill("Built-in countdown timer");
  await heatPress.getByRole("button", { name: "Save heat press profile" }).click();
  await expect(page.getByText("Production library saved")).toBeVisible();

  const material = formForButton(page, "Add material recipe");
  await material.getByLabel("Material name").fill("Phase 11 white HTV");
  await material.getByLabel("Material type").fill("Heat-transfer vinyl");
  await material.getByLabel("Colour").fill("White");
  await material.getByLabel("Roll width (mm)").fill("500");
  await material.getByLabel("Remaining length (m)").fill("20");
  await material.getByLabel("Cost per metre").fill("14.5");
  await material.getByLabel("Blade / profile").fill("45 degree blade");
  await material.getByLabel("Cutter force").fill("90");
  await material.getByLabel("Cutter speed").fill("300");
  await material.getByLabel("Cut passes").fill("1");
  await material.getByLabel("Press temperature (°C)").fill("150");
  await material.getByLabel("Press duration (seconds)").fill("12");
  await material.getByLabel("Pressure").fill("Medium");
  await material.getByLabel("Peel method").fill("Warm");
  await material.getByLabel("Repress (seconds)").fill("3");
  await material.getByLabel("Compatible fabrics").fill("Cotton, Poly-cotton");
  await material.getByRole("button", { name: "Add material recipe" }).click();
  await expect(page.getByRole("heading", { name: "Phase 11 white HTV" })).toBeVisible();
  await expect(page.getByText("150 °C · 12s · Medium")).toBeVisible();

  const garment = formForButton(page, "Add garment profile");
  await garment.getByLabel("Garment profile").fill("Phase 11 black tee");
  await garment.getByLabel("Garment type").fill("T-shirt");
  await garment.getByLabel("Colour").fill("Black");
  await garment.getByLabel("Fabric").fill("100% cotton");
  await garment.getByLabel("Available sizes").fill("S, M, L, XL");
  await garment.getByLabel("Maximum safe press temperature (°C)").fill("170");
  await garment.getByLabel("Garment cost").fill("25");
  await garment.getByLabel("Default selling price").fill("45");
  await garment.getByRole("button", { name: "Add garment profile" }).click();
  const savedGarment = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Phase 11 black tee", exact: true }) });
  await expect(savedGarment.getByRole("heading", { name: "Phase 11 black tee", exact: true })).toBeVisible();
  await expect(savedGarment.getByText("Maximum 170 °C", { exact: true })).toBeVisible();

  const placement = formForButton(page, "Add placement template");
  await placement.getByLabel("Placement name").fill("Phase 11 left chest");
  await placement.getByLabel("Location code").fill("LEFT_CHEST");
  await placement.getByLabel("Garment profile").selectOption({ label: "Phase 11 black tee" });
  await placement.getByLabel("Default width (mm)").fill("100");
  await placement.getByLabel("Default height (mm)").fill("100");
  await placement.getByLabel("Size-specific dimensions").fill("S: 90x90\nM: 100x100\nL: 110x110");
  await placement.getByRole("button", { name: "Add placement template" }).click();
  const savedPlacement = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Phase 11 left chest" }) });
  await expect(savedPlacement.getByRole("heading", { name: "Phase 11 left chest" })).toBeVisible();
  await expect(savedPlacement.getByText(/S: 90×90/)).toBeVisible();
  await expect(savedPlacement.getByText(/M: 100×100/)).toBeVisible();
  await expect(savedPlacement.getByText(/L: 110×110/)).toBeVisible();

  await page.getByRole("link", { name: "Cutter operations" }).first().click();
  await expect(page.getByRole("heading", { name: "Cutter operations" })).toBeVisible();
  await expect(page.getByText(/verified material recipe/)).toBeVisible();
});

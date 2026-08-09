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

test("owner configures real production material, garment, placement and heat press rules", async ({ page }) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/dashboard/designs/materials");
  await expect(page.getByRole("heading", { name: "Materials, garments & press recipes" })).toBeVisible();

  await page.getByLabel("Press name").fill("Phase 11 manual clamshell");
  await page.getByLabel("Plate width (mm)").fill("380");
  await page.getByLabel("Plate height (mm)").fill("380");
  await page.getByLabel("Minimum temperature (°C)").fill("80");
  await page.getByLabel("Maximum temperature (°C)").fill("220");
  await page.getByLabel("Pressure control").fill("Manual pressure knob");
  await page.getByLabel("Timer control").fill("Built-in countdown timer");
  await page.getByRole("button", { name: "Save heat press profile" }).click();
  await expect(page.getByText("Production library saved")).toBeVisible();

  await page.getByLabel("Material name").first().fill("Phase 11 white HTV");
  await page.getByLabel("Material type").first().fill("Heat-transfer vinyl");
  await page.getByLabel("Colour").first().fill("White");
  await page.getByLabel("Roll width (mm)").first().fill("500");
  await page.getByLabel("Remaining length (m)").first().fill("20");
  await page.getByLabel("Cost per metre").first().fill("14.5");
  await page.getByLabel("Blade / profile").first().fill("45 degree blade");
  await page.getByLabel("Cutter force").first().fill("90");
  await page.getByLabel("Cutter speed").first().fill("300");
  await page.getByLabel("Cut passes").first().fill("1");
  await page.getByLabel("Press temperature (°C)").first().fill("150");
  await page.getByLabel("Press duration (seconds)").first().fill("12");
  await page.getByLabel("Pressure").first().fill("Medium");
  await page.getByLabel("Peel method").first().fill("Warm");
  await page.getByLabel("Repress (seconds)").first().fill("3");
  await page.getByLabel("Compatible fabrics").first().fill("Cotton, Poly-cotton");
  await page.getByRole("button", { name: "Add material recipe" }).click();
  await expect(page.getByRole("heading", { name: "Phase 11 white HTV" })).toBeVisible();
  await expect(page.getByText("150 °C · 12s · Medium")).toBeVisible();

  await page.getByLabel("Garment profile").first().fill("Phase 11 black tee");
  await page.getByLabel("Garment type").first().fill("T-shirt");
  await page.getByLabel("Colour").nth(1).fill("Black");
  await page.getByLabel("Fabric").first().fill("100% cotton");
  await page.getByLabel("Available sizes").first().fill("S, M, L, XL");
  await page.getByLabel("Maximum safe press temperature (°C)").first().fill("170");
  await page.getByLabel("Garment cost").first().fill("25");
  await page.getByLabel("Default selling price").first().fill("45");
  await page.getByRole("button", { name: "Add garment profile" }).click();
  await expect(page.getByRole("heading", { name: "Phase 11 black tee" })).toBeVisible();
  await expect(page.getByText("Maximum 170 °C")).toBeVisible();

  await page.getByLabel("Placement name").first().fill("Phase 11 left chest");
  await page.getByLabel("Location code").first().fill("LEFT_CHEST");
  await page.getByLabel("Garment profile").last().selectOption({ label: "Phase 11 black tee" });
  await page.getByLabel("Default width (mm)").first().fill("100");
  await page.getByLabel("Default height (mm)").first().fill("100");
  await page.getByLabel("Size-specific dimensions").first().fill("S: 90x90\nM: 100x100\nL: 110x110");
  await page.getByRole("button", { name: "Add placement template" }).click();
  await expect(page.getByRole("heading", { name: "Phase 11 left chest" })).toBeVisible();
  await expect(page.getByText(/S: 90×90.*M: 100×100.*L: 110×110/)).toBeVisible();

  await page.getByRole("link", { name: "Cutter operations" }).first().click();
  await expect(page.getByRole("heading", { name: "Cutter operations" })).toBeVisible();
  await expect(page.getByText(/verified material recipe/)).toBeVisible();
});

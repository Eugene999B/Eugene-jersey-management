import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-R25-OWNER");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

test("routes a DTF printer through its system or RIP workflow without false direct-device claims", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/dashboard/designs");

  const profileSelect = page.getByLabel("Active machine");
  let printerOption = profileSelect.locator("option", { hasText: "E2E DTF Printer" });
  if (await printerOption.count() === 0) {
    await page.getByRole("button", { name: "Add machine profile" }).click();
    await page.getByLabel("Profile name").fill("E2E DTF Printer");
    await page.getByLabel("Manufacturer").fill("DemoPrint");
    await page.getByLabel("Model").fill("DTF 600 Pro");
    await page.getByLabel("Device category").selectOption("DTF_PRINTER");
    await page.getByLabel("Output format").selectOption("PRINT_RIP");
    await expect(page.getByLabel("Connection and production route")).toHaveValue("SYSTEM_PRINT");
    await page.getByLabel("Bed width mm").fill("600");
    await page.getByLabel("Bed height mm").fill("1000");
    await page.getByLabel("Mirror by default").uncheck();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Machine profile saved")).toBeVisible();
    printerOption = profileSelect.locator("option", { hasText: "E2E DTF Printer" });
  }

  await expect(printerOption).toHaveCount(1);
  const value = await printerOption.getAttribute("value");
  expect(value).toBeTruthy();
  await profileSelect.selectOption(value ?? "");

  await expect(page.getByText("DemoPrint DTF 600 Pro").first()).toBeVisible();
  await expect(page.getByText("DTF printer · Print / RIP", { exact: true })).toBeVisible();
  await expect(page.getByText("Operating-system print dialog").first()).toBeVisible();
  await expect(page.getByText(/The operating system or vendor\/RIP software selects and identifies the physical printer/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Test serial connection" })).toHaveCount(0);

  await page.getByRole("button", { name: "Use machine bed" }).click();
  await expect(page.getByLabel("Width mm")).toHaveValue("600");
  await expect(page.getByLabel("Height mm")).toHaveValue("1000");
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full-colour SVG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
});

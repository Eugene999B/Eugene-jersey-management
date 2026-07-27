import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page, loginIdValue: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill(loginIdValue);
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
}

test.describe.serial("shop machine profiles and cut-path export", () => {
  test("owner creates a shop HPGL profile and exports validated cut paths", async ({ page }) => {
    await signIn(page, "EJM-E2E-OWNER");
    await page.goto("/dashboard/designs");

    const profileSelect = page.getByLabel("Active machine");
    let browserCutterOption = profileSelect.locator("option", { hasText: "E2E Browser Cutter" });

    if (await browserCutterOption.count() === 0) {
      await page.getByRole("button", { name: "Add machine profile" }).click();
      await page.getByLabel("Profile name").fill("E2E Browser Cutter");
      await page.getByLabel("Output format").selectOption("HPGL");
      await page.getByLabel("Bed width mm").fill("320");
      await page.getByLabel("Bed height mm").fill("500");
      await page.getByLabel("Units per mm").fill("40");
      await page.getByLabel("Serial baud").fill("19200");
      await page.getByLabel("Shop default").check();
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByText("Machine profile saved")).toBeVisible();
      browserCutterOption = profileSelect.locator("option", { hasText: "E2E Browser Cutter" });
    }

    await expect(browserCutterOption).toHaveCount(1);
    const browserCutterValue = await browserCutterOption.getAttribute("value");
    expect(browserCutterValue).toBeTruthy();
    await profileSelect.selectOption(browserCutterValue ?? "");
    await expect(profileSelect.locator("option:checked")).toHaveText(/E2E Browser Cutter/);

    await page.getByRole("button", { name: "Use machine bed" }).click();
    await expect(page.getByLabel("Width mm")).toHaveValue("320");
    await expect(page.getByLabel("Height mm")).toHaveValue("500");
    await page.getByRole("button", { name: "Rectangle", exact: true }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export HPGL" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.plt$/);

    await page.getByLabel("Job name").fill("Release 21 cutter test");
    await page.getByRole("button", { name: "Save project" }).click();
    await expect(page.getByText(/Saved version 1 to this shop/)).toBeVisible();
  });

  test("designer can use active profiles but cannot manage shop machine settings", async ({ page }) => {
    await signIn(page, "EJM-E2E-DESIGNER");
    await page.goto("/dashboard/designs");

    const profileSelect = page.getByLabel("Active machine");
    await expect(profileSelect).toBeVisible();
    const browserCutterOption = profileSelect.locator("option", { hasText: "E2E Browser Cutter" });
    await expect(browserCutterOption).toHaveCount(1);
    const browserCutterValue = await browserCutterOption.getAttribute("value");
    expect(browserCutterValue).toBeTruthy();
    await profileSelect.selectOption(browserCutterValue ?? "");
    await expect(profileSelect.locator("option:checked")).toHaveText(/E2E Browser Cutter/);
    await expect(page.getByRole("button", { name: "Add machine profile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit profile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Owner/manager only" })).toBeDisabled();
  });
});

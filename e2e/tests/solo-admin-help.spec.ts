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
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
}

function settingsLoginId(page: Page) {
  return page.getByRole("main").getByText("EJM-E2E-R25-OWNER", { exact: true });
}

async function addExactOptionItem(page: Page) {
  await page.getByPlaceholder("Search product or SKU").fill("Phase 7 exact option item");
  await page.getByRole("button", { name: "Choose option for Phase 7 exact option item" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose Phase 7 exact option item" });
  await dialog.getByRole("radio", { name: /Size XL.*Colour Black.*Material Cotton.*Sleeve Long/ }).check();
  await dialog.getByRole("button", { name: "Add selected option" }).click();
  await expect(page.locator("#pos-cart").getByText("Phase 7 exact option item", { exact: true })).toBeVisible();
}

test("gives the sole administrator page help and downloadable handbooks", async ({ page }) => {
  await signIn(page, "EJM-E2E-R25-ADMIN");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Help for this administrator page", { exact: true })).toBeVisible();

  const handbookDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download complete handbook", exact: true }).click();
  const handbook = await handbookDownload;
  expect(handbook.suggestedFilename()).toBe("ESM-Complete-Administrator-Handbook.docx");

  await page.goto("/admin/help");
  await expect(page.getByRole("heading", { name: "Help and downloadable handbooks" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Complete administrator handbook/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shops and marketplace/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shop and supplier operations/ })).toBeVisible();
});

test("shows the owner Login ID, online controls, credit guidance and Design Studio notes", async ({ page }) => {
  await signIn(page, "EJM-E2E-R25-OWNER");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard/settings");
  await expect(page.getByRole("heading", { name: "Online shop status" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Login ID" })).toBeVisible();
  await expect(settingsLoginId(page)).toBeVisible();

  await page.getByRole("button", { name: /Offline/ }).click();
  await expect(page).toHaveURL(/storefront=offline/);
  await expect(page.getByText("Online shop status updated successfully.", { exact: true })).toBeVisible();
  await expect(page.getByText("OFFLINE", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Online \+ ordering/ }).click();
  await expect(page).toHaveURL(/storefront=online/);
  await expect(page.getByText("ONLINE", { exact: true })).toBeVisible();

  await page.goto("/dashboard/pos");
  await addExactOptionItem(page);
  const credit = page.getByRole("radio", { name: "Credit", exact: true });
  await credit.click();
  await expect(credit).toContainText("Create debt for only this portion");
  await expect(page.getByText(/Choose an existing customer or enter a new customer name before using credit/)).toBeVisible();
  await expect(page.getByText(/Customer details are required for any credit allocation/)).toBeVisible();

  await page.goto("/dashboard/designs");
  const guideDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download quick guide", exact: true }).click();
  const guide = await guideDownload;
  expect(guide.suggestedFilename()).toBe("ESM-Design-Studio-Quick-Guide.docx");
});

test("keeps the new owner guidance usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "EJM-E2E-R25-OWNER");
  await page.goto("/dashboard/settings");
  await expect(settingsLoginId(page)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/dashboard/designs");
  await expect(page.getByRole("link", { name: "Download quick guide", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

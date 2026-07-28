import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsAdministrator(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-ADMIN");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("administrator edits audited platform governance without exposing provider secrets", async ({ page }) => {
  await signInAsAdministrator(page);
  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Platform Governance" })).toBeVisible();
  await expect(page.getByText("CEO control centre")).toBeVisible();
  await expect(page.getByText(/Paystack, Arkesel, WhatsApp or storage secrets/)).toBeVisible();
  await page.getByLabel("Platform name").fill("EJM Governance Test");
  await page.getByLabel("Support SLA (hours)").fill("36");
  await page.getByLabel("Maintenance or incident notice").fill("Controlled E2E governance notice");
  await page.getByLabel("Governance change reason").fill("Verify audited CEO settings workflow");
  await page.getByRole("button", { name: "Save governance settings" }).click();
  await expect(page.getByRole("status")).toContainText("Governance settings saved");
  await page.reload();
  await expect(page.getByLabel("Platform name")).toHaveValue("EJM Governance Test");
  await expect(page.getByLabel("Support SLA (hours)")).toHaveValue("36");
  await page.setViewportSize({ width: 390, height: 844 });
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport + 1);
});

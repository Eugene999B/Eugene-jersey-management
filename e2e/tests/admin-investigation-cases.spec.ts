import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsSupport(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-SUPPORT");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin\/support$/);
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

test("restricted support administrator investigates a shop and resolves a durable case workflow", async ({ page }) => {
  await signInAsSupport(page);

  await page.goto("/admin/investigate?q=EJM+Browser+Test+Shop");
  await expect(page.getByRole("heading", { name: "Investigation search" })).toBeVisible();
  await page.getByRole("link", { name: "EJM Browser Test Shop" }).click();
  await expect(page).toHaveURL(/\/admin\/investigate\/shops\//);
  await expect(page.getByText("Exact-shop support profile", { exact: true })).toBeVisible();
  await expect(page.getByText("EJM-E2E-SHOP", { exact: true })).toBeVisible();
  await expect(page.getByText(/excludes secret keys, full settlement account numbers/)).toBeVisible();

  await page.getByRole("link", { name: "Open support case", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open a support case" })).toBeVisible();
  await page.getByLabel("Category").selectOption("ACCOUNT_ACCESS");
  await page.getByLabel("Priority").selectOption("HIGH");
  await page.getByLabel("Title").fill("Release 26 browser access investigation");
  await page.getByLabel("Initial investigation summary").fill("The restricted support administrator is verifying the durable case, assignment, note and transition workflow against the seeded shop.");
  await page.getByLabel("Assign to").selectOption({ label: "EJM Browser Support" });
  await page.getByRole("button", { name: "Open support case" }).click();

  await expect(page).toHaveURL(/\/admin\/support\/cases\/[^?]+\?created=true/);
  await expect(page.getByText(/^SUP-\d{8}-[A-Z0-9]+$/)).toBeVisible();
  await expect(page.getByText("The support case was created and added to the audit trail.")).toBeVisible();

  await page.getByPlaceholder("Add evidence, action taken, communication or correction").fill("Verified the owner Login ID and reviewed the read-only shop access evidence.");
  await page.getByRole("button", { name: "Add case note" }).click();
  await expect(page.getByText("Verified the owner Login ID and reviewed the read-only shop access evidence.")).toBeVisible();

  await page.getByLabel("Priority").selectOption("URGENT");
  await page.getByLabel("Status").selectOption("INVESTIGATING");
  await page.getByRole("button", { name: "Save workflow update" }).click();
  await expect(page).toHaveURL(/updated=true/);
  await expect(page.getByText("The case workflow was updated.")).toBeVisible();
  await expect(page.getByText("Urgent", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Investigating", { exact: true }).first()).toBeVisible();

  await page.goto("/admin/support/cases?q=Release+26+browser+access");
  await expect(page.getByText("Release 26 browser access investigation", { exact: true })).toBeVisible();
});

test("investigation and case register remain usable at a 390 pixel viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsSupport(page);
  await page.goto("/admin/investigate?q=EJM-E2E-SHOP");
  await expect(page.getByRole("heading", { name: "Investigation search" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/admin/support/cases");
  await expect(page.getByRole("heading", { name: "Support cases" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New case" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

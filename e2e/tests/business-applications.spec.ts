import { expect, type Page, test } from "@playwright/test";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signInAsApplicationsAdmin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  const loginId = page.getByPlaceholder("Click, then enter Login ID or email");
  const passwordField = page.getByPlaceholder("Click, then enter password");
  await loginId.click();
  await loginId.fill("EJM-E2E-APPLICATIONS");
  await passwordField.click();
  await passwordField.fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await expect(page).toHaveURL(/\/admin\/shops$/);
}

async function submitShopApplication(page: Page) {
  await page.goto("/apply/shop");
  await page.getByLabel("Business name").fill("Release 26 Approved Shop");
  await page.getByLabel("Legal business name").fill("Release 26 Approved Shop Limited");
  await page.getByLabel("Business registration number").fill("R26-SHOP-001");
  await page.getByLabel("Tax identification number").fill("R26-TIN-001");
  await page.getByLabel("Contact name").fill("Release Twenty Six Owner");
  await page.getByLabel("Phone").fill("+233200026001");
  await page.getByLabel("Email").fill("release26-shop-applicant@ejm.test");
  await page.getByLabel("Business address").fill("Application Test Street");
  await page.getByLabel("City or town").fill("Accra");
  await page.getByLabel("Region").fill("Greater Accra");
  await page.getByLabel("Categories").fill("Jerseys, printing and sports equipment");
  await page.getByLabel("Requested services").fill("POS, inventory, Design Studio and marketplace");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit shop application" }).click();
  await expect(page).toHaveURL(/\/apply\/submitted$/);
  const credentials = await page.locator("code").allTextContents();
  expect(credentials).toHaveLength(2);
  return { reference: credentials[0].trim(), token: credentials[1].trim() };
}

async function openStatus(page: Page, reference: string, token: string) {
  await page.goto("/apply/status");
  await page.getByLabel("Application reference").fill(reference);
  await page.getByLabel("Private status token").fill(token);
  await page.getByRole("button", { name: "Open application status" }).click();
  await expect(page).toHaveURL(/\/apply\/status\/result/);
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

test("public shop application becomes a controlled tenant with a working public status", async ({ page }) => {
  const receipt = await submitShopApplication(page);
  expect(receipt.reference).toMatch(/^APP-SHP-\d{8}-[A-Z0-9]+$/);
  expect(receipt.token.length).toBeGreaterThanOrEqual(32);

  await openStatus(page, receipt.reference, receipt.token);
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Release 26 Approved Shop" })).toBeVisible();

  await signInAsApplicationsAdmin(page);
  await page.goto("/admin/applications?q=Release+26+Approved+Shop");
  await page.getByRole("link", { name: receipt.reference }).click();
  await expect(page.getByRole("heading", { name: "Release 26 Approved Shop" })).toBeVisible();
  await page.getByRole("button", { name: "Start or resume review" }).click();
  await expect(page).toHaveURL(/reviewing=true/);

  const approvalForm = page.getByRole("heading", { name: "Approve and create shop" }).locator("..");
  await approvalForm.locator('[name="slug"]').fill("ejm-e2e-approved-shop");
  await approvalForm.locator('[name="staffLoginId"]').fill("EJM-E2E-APPROVED-SHOP");
  await approvalForm.locator('[name="planId"]').selectOption({ label: /E2E Application Plan/ });
  await approvalForm.locator('[name="billingCycle"]').selectOption("MONTHLY");
  await approvalForm.locator('[name="temporaryPassword"]').fill("Temp-EJM-Application-2026!");
  await approvalForm.getByRole("button", { name: "Approve and create shop" }).click();
  await expect(page).toHaveURL(/approved=shop/);
  await expect(page.getByText(/The shop and owner account were created/)).toBeVisible();
  await expect(page.getByText("EJM-E2E-APPROVED-SHOP", { exact: true })).toBeVisible();
  await expect(page.getByText(/Pending/).first()).toBeVisible();

  await openStatus(page, receipt.reference, receipt.token);
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await expect(page.getByText(/Onboarding details will be delivered through a separate secure channel/)).toBeVisible();
});

test("supplier application remains tied to one shop and exposes only an applicant-facing changes request", async ({ page }) => {
  await page.goto("/apply/supplier");
  await page.getByLabel("Business name").fill("Release 26 Supplier Applicant");
  await page.getByLabel("Legal business name").fill("Release 26 Supplier Applicant Limited");
  await page.getByLabel("Business registration number").fill("R26-SUP-001");
  await page.getByLabel("Shop you want to supply").selectOption({ label: /EJM Browser Test Shop/ });
  await page.getByLabel("Contact name").fill("Release Twenty Six Supplier");
  await page.getByLabel("Phone").fill("+233200026002");
  await page.getByLabel("Email").fill("release26-supplier-applicant@ejm.test");
  await page.getByLabel("City or town").fill("Kumasi");
  await page.getByLabel("Categories").fill("Jerseys, vinyl and sports equipment");
  await page.getByLabel("Requested services").fill("Supply the selected verified shop only");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit supplier application" }).click();
  await expect(page).toHaveURL(/\/apply\/submitted$/);
  const credentials = await page.locator("code").allTextContents();
  const reference = credentials[0].trim();
  const token = credentials[1].trim();

  await signInAsApplicationsAdmin(page);
  await page.goto("/admin/applications?q=Release+26+Supplier+Applicant");
  await page.getByRole("link", { name: reference }).click();
  await expect(page.getByText("EJM Browser Test Shop", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Start or resume review" }).click();

  const changesForm = page.getByRole("heading", { name: "Request changes" }).locator("..");
  await changesForm.locator('[name="decisionReason"]').fill("Please provide an updated registration document and confirm the exact products you intend to supply.");
  await changesForm.locator('[name="reviewNotes"]').fill("Internal note: supplier remains scoped to the requested browser test shop.");
  await changesForm.getByRole("button", { name: "Save changes request" }).click();
  await expect(page).toHaveURL(/updated=true/);

  await openStatus(page, reference, token);
  await expect(page.getByText("Changes requested", { exact: true })).toBeVisible();
  await expect(page.getByText(/updated registration document and confirm the exact products/)).toBeVisible();
  await expect(page.getByText(/Internal note/)).not.toBeVisible();
});

test("public application pages remain usable on a 390 pixel viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/apply");
  await expect(page.getByRole("heading", { name: "Apply as a shop or supplier" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/apply/shop");
  await expect(page.getByRole("heading", { name: "Apply for a shop workspace" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/apply/status");
  await expect(page.getByRole("heading", { name: "Check your status" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

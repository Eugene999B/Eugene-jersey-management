import { expect, type Page, test } from "@playwright/test";

const LOGIN_ID = "EJM-E2E-CATALOG";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function signIn(page: Page) {
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

async function addExactOption(page: Page) {
  await page.goto("/dashboard/pos");
  await page.getByPlaceholder("Search product or SKU").fill("Phase 7 exact option item");
  await page.getByRole("button", { name: "Choose option for Phase 7 exact option item" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose Phase 7 exact option item" });
  await dialog.getByRole("radio", { name: /Size XL.*Colour Black.*Material Cotton.*Sleeve Long/ }).check();
  await dialog.getByRole("button", { name: "Add selected option" }).click();
  await expect(page.locator("#pos-cart").getByText("Phase 7 exact option item", { exact: true })).toBeVisible();
}

async function createPaidOrderJob(page: Page) {
  await addExactOption(page);
  await page.getByRole("radio", { name: "Order or job", exact: true }).click();
  await page.getByLabel("Customer name", { exact: true }).fill("Phase 9 Workflow Customer");
  const checkoutResponse = page.waitForResponse((response) => response.url().includes("/api/pos/checkout") && response.request().method() === "POST");
  const receiptPopup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Create order/job & print" }).click();
  const [response, popup] = await Promise.all([checkoutResponse, receiptPopup]);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json() as {
    orderId: string;
    receiptNumber: string;
    checkoutMode: "ORDER_JOB";
    orderStatus: "PENDING";
  };
  expect(payload.checkoutMode).toBe("ORDER_JOB");
  expect(payload.orderStatus).toBe("PENDING");
  await expect(page.getByText(new RegExp(`Order/job created\\. Receipt ${payload.receiptNumber}`))).toBeVisible();
  await popup.close();
  return payload;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

function futureDate(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

test("configures, approves and advances one real order through the workflow control room", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const order = await createPaidOrderJob(page);

  await page.goto(`/dashboard/orders/${order.orderId}`);
  await expect(page.getByRole("heading", { name: order.receiptNumber })).toBeVisible();
  await expect(page.getByText("Order and job control room", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Items and exact options" })).toBeVisible();
  await expect(page.getByText(/Size XL.*Colour Black.*Material Cotton.*Sleeve Long/)).toBeVisible();
  await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();

  const assignee = page.getByLabel("Assigned staff");
  const firstStaffValue = await assignee.locator("option").nth(1).getAttribute("value");
  expect(firstStaffValue).toBeTruthy();
  await assignee.selectOption(firstStaffValue!);
  await page.getByLabel("Priority").selectOption("HIGH");
  await page.getByLabel("Due date", { exact: true }).fill(futureDate(4));
  await page.getByLabel("Approval status").selectOption("PENDING");
  await page.getByLabel("Approval evidence or requested changes").fill("Awaiting final customer confirmation in the shop.");
  await page.getByPlaceholder("Exact work instructions, quality checks, measurements, placement, service steps, or preparation notes").fill("Use the exact XL black cotton long-sleeve option and inspect all selected details before production.");
  await page.getByLabel("Deposit target").fill("50");
  await page.getByLabel("Balance due date").fill(futureDate(3));
  await page.getByLabel("Current internal notes").fill("Keep this internal note private from the customer tracker.");
  await page.getByLabel("Note for this update").fill("Initial job handoff configured by browser acceptance.");
  await page.getByRole("button", { name: "Save workflow" }).click();
  await expect(page.getByRole("status")).toContainText(`Workflow for ${order.receiptNumber} saved`);

  await page.getByRole("button", { name: "Move to In Production" }).click();
  await expect(page.getByRole("alert")).toContainText("Customer approval is required before production can start");

  await page.getByLabel("Approval status").selectOption("APPROVED");
  await page.getByLabel("Approval evidence or requested changes").fill("Customer approved the exact option and work instructions.");
  await page.getByLabel("Note for this update").fill("Customer approval received and recorded.");
  await page.getByRole("button", { name: "Save workflow" }).click();
  await expect(page.getByRole("status")).toContainText(`Workflow for ${order.receiptNumber} saved`);

  await page.getByRole("button", { name: "Move to In Production" }).click();
  await expect(page.getByRole("status")).toContainText("moved to In Production");
  await expect(page.getByRole("heading", { name: "Workflow timeline" })).toBeVisible();
  await expect(page.getByText("Customer approval changed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Order stage changed", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/dashboard/orders");
  const card = page.locator("article").filter({ hasText: order.receiptNumber });
  await expect(card).toContainText("High");
  await expect(card).toContainText("Approved");
  await expect(card).toContainText("Paid GH₵125.00");
  await expect(card.getByRole("link", { name: "Open workflow" })).toBeVisible();

  await card.getByRole("link", { name: "Open workflow" }).click();
  const customerHref = await page.getByRole("link", { name: "Customer view" }).getAttribute("href");
  expect(customerHref).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(customerHref!);
  await expect(page.getByText("Expected date", { exact: true })).toBeVisible();
  await expect(page.getByText("Order updates", { exact: true })).toBeVisible();
  await expect(page.getByText("Order moved to In Production", { exact: true })).toBeVisible();
  await expect(page.getByText("Keep this internal note private from the customer tracker.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Assigned staff", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

import { Buffer } from "node:buffer";
import { expect, test, type Locator, type Page } from "@playwright/test";

const STAFF_LOGIN_ID = "EJM-E2E-OWNER";
const BUYER_PHONE = "+233200000115";
const SHOP_SLUG = "ejm-browser-test-shop";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function selectContaining(select: Locator, text: string) {
  const option = select.locator("option").filter({ hasText: text }).first();
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`Could not find selectable option containing: ${text}`);
  await select.selectOption(value);
}

async function signInStaff(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter credentials" }).click();
  await page.getByPlaceholder("Click, then enter Login ID or email").fill(STAFF_LOGIN_ID);
  await page.getByPlaceholder("Click, then enter password").fill(password());
  await page.getByRole("button", { name: "Open control room" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30_000 });
}

async function signInBuyer(page: Page) {
  await page.goto("/buyer/login?next=/shops");
  await page.getByPlaceholder("Phone number").fill(BUYER_PHONE);
  await page.getByPlaceholder("Password").fill(password());
  await page.getByRole("button", { name: "Continue securely", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/shops", { timeout: 30_000 });
}

test("buyer approves a quoted custom job and staff cannot complete before verified balance", async ({ browser }) => {
  test.setTimeout(220_000);
  const suffix = Date.now().toString(36).toUpperCase();
  const requestedText = `EUGENE-${suffix}`;
  const buyerContext = await browser.newContext();
  const staffContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  const staffPage = await staffContext.newPage();

  try {
    await Promise.all([signInBuyer(buyerPage), signInStaff(staffPage)]);

    await buyerPage.goto("/shops?offer=CUSTOM");
    await expect(buyerPage.getByRole("heading", { name: "ESM Marketplace", exact: true })).toBeVisible();
    await expect(buyerPage.locator('select[name="offer"]')).toHaveValue("CUSTOM");
    const customOffer = buyerPage.getByRole("link").filter({ hasText: "E2E Phase 15 Custom Jersey" }).first();
    await expect(customOffer).toBeVisible();
    await expect(customOffer).toContainText("Custom production");
    await customOffer.click();
    await expect(buyerPage).toHaveURL(new RegExp(`/shop/${SHOP_SLUG}/custom-production`));
    await expect(buyerPage.getByRole("heading", { name: "Request custom production", exact: true })).toBeVisible();

    await selectContaining(buyerPage.getByLabel("Customizable product"), "E2E Phase 15 Custom Jersey");
    await buyerPage.getByLabel("Garment and exact size").selectOption({ label: "E2E Phase 15 Tee · Black · M" });
    await selectContaining(buyerPage.getByLabel("Print placement"), "E2E Phase 15 Left chest");
    await buyerPage.getByLabel("Text / name").fill(requestedText);
    await buyerPage.getByLabel("Number").fill("15");
    await buyerPage.getByLabel("Design notes").fill("Phase 15 browser approval flow. Keep the left-chest placement and spelling exact.");
    const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await buyerPage.locator('input[name="artwork"]').setInputFiles({ name: "phase15-logo.png", mimeType: "image/png", buffer: onePixelPng });
    await buyerPage.getByRole("button", { name: "Submit design request", exact: true }).click();
    await buyerPage.waitForURL(/\/buyer\/production-requests\/[^/?]+$/, { timeout: 30_000 });
    const requestUrl = buyerPage.url();
    await expect(buyerPage.getByText(requestedText, { exact: true })).toBeVisible();
    await expect(buyerPage.getByRole("img", { name: /Customer artwork phase15-logo\.png/ })).toBeVisible();
    await expect(buyerPage.getByText("The shop is preparing your preview and quote.", { exact: true })).toBeVisible();

    await staffPage.goto("/dashboard/customer-production");
    await expect(staffPage.getByRole("heading", { name: "Custom production requests", exact: true })).toBeVisible();
    const requestCard = staffPage.getByRole("article").filter({ hasText: requestedText });
    await expect(requestCard).toBeVisible();
    await expect(requestCard).toContainText("Submitted");
    const quoteForm = requestCard.getByRole("heading", { name: "Issue quoted preview", exact: true }).locator("xpath=ancestor::form");
    await quoteForm.getByLabel(/Quoted total/).fill("80");
    await quoteForm.getByLabel("Deposit amount").fill("0");
    await quoteForm.getByLabel("Preview / quote note").fill("Approve exact size, left-chest placement, spelling and number before production.");
    await quoteForm.getByRole("button", { name: "Send preview v1", exact: true }).click();
    const quotedCard = staffPage.getByRole("article").filter({ hasText: requestedText });
    await expect(quotedCard).toContainText("Preview Ready");
    await expect(quotedCard).toContainText("Waiting for customer approval or changes.");

    await buyerPage.goto(requestUrl);
    await expect(buyerPage.getByRole("img", { name: "Concept preview version 1", exact: true })).toBeVisible();
    await expect(buyerPage.getByText("Preview v1", { exact: true })).toBeVisible();
    await expect(buyerPage.getByText(/80\.00/).first()).toBeVisible();
    await expect(buyerPage.getByText("Approve exact size, left-chest placement, spelling and number before production.", { exact: true })).toBeVisible();
    await buyerPage.getByRole("button", { name: "Approve preview & create order", exact: true }).click();
    await expect(buyerPage).toHaveURL(/approved=1/);
    await expect(buyerPage.getByText("Preview approved. Your order is created; the deposit can now be paid.", { exact: true })).toBeVisible();
    await expect(buyerPage.getByText("Deposit Paid", { exact: true }).first()).toBeVisible();
    await expect(buyerPage.getByRole("button", { name: /Pay deposit/ })).toHaveCount(0);
    await expect(buyerPage.getByRole("button", { name: /Pay remaining balance/ })).toBeVisible();

    await staffPage.reload();
    const depositedCard = staffPage.getByRole("article").filter({ hasText: requestedText });
    await expect(depositedCard).toContainText("Deposit Paid");
    await depositedCard.getByRole("button", { name: "Start production", exact: true }).click();
    const productionCard = staffPage.getByRole("article").filter({ hasText: requestedText });
    await expect(productionCard).toContainText("In Production");
    await productionCard.getByRole("button", { name: "Mark ready & notify customer", exact: true }).click();
    const readyCard = staffPage.getByRole("article").filter({ hasText: requestedText });
    await expect(readyCard).toContainText("Ready");
    await expect(readyCard.getByText("Ready but balance remains", { exact: true })).toBeVisible();
    await expect(readyCard.getByRole("button", { name: "Complete & notify customer", exact: true })).toBeDisabled();

    await buyerPage.goto(requestUrl);
    await expect(buyerPage.getByText("Ready", { exact: true }).first()).toBeVisible();
    await expect(buyerPage.getByText("Your custom production is ready. Pay any remaining balance and follow the shop’s collection/delivery instructions.", { exact: true })).toBeVisible();
    await expect(buyerPage.getByRole("button", { name: /Pay remaining balance/ })).toContainText(/80\.00/);
    await expect(buyerPage.getByText("Production Started", { exact: true })).toBeVisible();
    await expect(buyerPage.getByText("Ready", { exact: true }).last()).toBeVisible();
  } finally {
    await buyerContext.close();
    await staffContext.close();
  }
});

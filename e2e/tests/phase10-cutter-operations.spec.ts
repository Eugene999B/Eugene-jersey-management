import { expect, type Page, test } from "@playwright/test";

const LOGIN_ID = "EJM-E2E-OWNER";
const PROFILE_NAME = "Phase 10 Queue Cutter";
const DESIGN_NAME = "Phase 10 Operator Cut";

function password() {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is required for browser acceptance tests.");
  return value;
}

async function installSerialDeviceMock(page: Page) {
  await page.addInitScript(() => {
    type SerialState = {
      openOptions: Array<{ baudRate: number }>;
      requests: Array<{ filters?: Array<{ usbVendorId: number; usbProductId?: number }> } | undefined>;
      writes: number[][];
      opened: boolean;
    };
    const state: SerialState = { openOptions: [], requests: [], writes: [], opened: false };
    const port = {
      writable: new WritableStream<Uint8Array>({
        write(chunk) {
          state.writes.push(Array.from(chunk));
        },
      }),
      async open(options: { baudRate: number }) {
        state.openOptions.push(options);
        state.opened = true;
      },
      async close() {
        state.opened = false;
      },
      getInfo() {
        return { usbVendorId: 0x1a86, usbProductId: 0x7523 };
      },
    };
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: {
        async requestPort(options?: { filters?: Array<{ usbVendorId: number; usbProductId?: number }> }) {
          state.requests.push(options);
          return port;
        },
      },
    });
    (window as Window & { __ejmPhase10Serial?: SerialState }).__ejmPhase10Serial = state;
  });
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

async function ensureProfileAndSavedDesign(page: Page) {
  await page.goto("/dashboard/designs");
  const profileSelect = page.getByLabel("Active machine");
  let profileOption = profileSelect.locator("option", { hasText: PROFILE_NAME });
  if (await profileOption.count() === 0) {
    await page.getByRole("button", { name: "Add machine profile" }).click();
    await page.getByLabel("Profile name").fill(PROFILE_NAME);
    await page.getByLabel("Manufacturer").fill("SafeCut");
    await page.getByLabel("Model").fill("Roll 320");
    await page.getByLabel("Device category").selectOption("CUTTER_PLOTTER");
    await page.getByLabel("Output format").selectOption("HPGL");
    await page.getByLabel("Connection and production route").selectOption("WEB_SERIAL");
    await page.getByLabel("Bed width mm").fill("320");
    await page.getByLabel("Bed height mm").fill("1000");
    await page.getByLabel("Units per mm").fill("40");
    await page.getByLabel("Serial baud").fill("19200");
    await page.getByLabel("USB vendor ID").fill("0x1A86");
    await page.getByLabel("USB product ID").fill("0x7523");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Machine profile saved")).toBeVisible();
    profileOption = profileSelect.locator("option", { hasText: PROFILE_NAME });
  }
  const profileId = await profileOption.getAttribute("value");
  expect(profileId).toBeTruthy();
  await profileSelect.selectOption(profileId ?? "");
  await page.getByRole("button", { name: "Use machine bed" }).click();
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.getByLabel("Job name").fill(DESIGN_NAME);
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByText(/Saved version \d+ to this shop/)).toBeVisible();
}

test("prepares, sends and protects one saved cutter job", async ({ page }) => {
  test.setTimeout(120_000);
  await installSerialDeviceMock(page);
  await signIn(page);
  await ensureProfileAndSavedDesign(page);

  await page.goto("/dashboard/designs/production");
  await expect(page.getByRole("heading", { name: "Cutter operations" })).toBeVisible();
  await page.getByLabel("Saved design").selectOption({ label: DESIGN_NAME });
  const cutterSelect = page.getByLabel("Direct cutter profile");
  const cutterOption = cutterSelect.locator("option", { hasText: "SafeCut Roll 320" });
  const cutterValue = await cutterOption.getAttribute("value");
  expect(cutterValue).toBeTruthy();
  await cutterSelect.selectOption(cutterValue ?? "");
  await expect(cutterSelect.locator("option:checked")).toHaveText(/SafeCut Roll 320/);

  await page.getByLabel("Loaded roll/sheet width (mm)").fill("320");
  const checks = page.getByRole("checkbox");
  await expect(checks).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await checks.nth(index).check();

  await page.getByRole("button", { name: "Connect configured cutter" }).click();
  await expect(page.getByText(/SafeCut Roll 320 connected at 19200 baud/)).toBeVisible();

  await page.getByRole("button", { name: "Prepare cutter job" }).click();
  await expect(page.locator('p[role="status"]').filter({ hasText: `${DESIGN_NAME} is prepared` })).toBeVisible();
  const queueCard = page.locator("article").filter({ hasText: DESIGN_NAME }).first();
  await expect(queueCard.getByText("Prepared", { exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await queueCard.getByRole("button", { name: "Send once to cutter" }).click();
  await expect(page.locator('p[role="status"]').filter({ hasText: "was written to the cutter once" })).toBeVisible();
  await expect(queueCard.getByText("Sent", { exact: true })).toBeVisible();

  const serialResult = await page.evaluate(() => {
    type SerialState = {
      openOptions: Array<{ baudRate: number }>;
      requests: Array<{ filters?: Array<{ usbVendorId: number; usbProductId?: number }> } | undefined>;
      writes: number[][];
    };
    const state = (window as Window & { __ejmPhase10Serial?: SerialState }).__ejmPhase10Serial;
    if (!state) return null;
    return {
      openOptions: state.openOptions,
      filters: state.requests[0]?.filters,
      payload: new TextDecoder().decode(new Uint8Array(state.writes.flat())),
    };
  });
  expect(serialResult?.openOptions).toContainEqual({ baudRate: 19200 });
  expect(serialResult?.filters).toEqual([{ usbVendorId: 0x1a86, usbProductId: 0x7523 }]);
  expect(serialResult?.payload).toContain("IN;PA;SP1");
  expect(serialResult?.payload.trim().endsWith("SP0;IN;")).toBe(true);

  await page.getByRole("button", { name: "Prepare cutter job" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("already sent to this machine within the last 15 minutes");
  await expect(page.getByRole("button", { name: "Prepare intentional resend" })).toBeVisible();
});

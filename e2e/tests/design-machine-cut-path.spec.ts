import { expect, type Page, test } from "@playwright/test";

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
    (window as Window & { __ejmSerialTestState?: SerialState }).__ejmSerialTestState = state;
  });
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
  test("owner identifies, preflights and sends to a shop HPGL cutter", async ({ page }) => {
    await installSerialDeviceMock(page);
    await signIn(page, "EJM-E2E-OWNER");
    await page.goto("/dashboard/designs");

    await expect(page.getByText("Universal workflow coverage without unsafe protocol claims")).toBeVisible();
    const profileSelect = page.getByLabel("Active machine");
    let browserCutterOption = profileSelect.locator("option", { hasText: "E2E Browser Cutter" });

    if (await browserCutterOption.count() === 0) {
      await page.getByRole("button", { name: "Add machine profile" }).click();
      await page.getByLabel("Profile name").fill("E2E Browser Cutter");
      await page.getByLabel("Manufacturer").fill("DemoCut");
      await page.getByLabel("Model").fill("ProPlot 320");
      await page.getByLabel("Device category").selectOption("CUTTER_PLOTTER");
      await page.getByLabel("Output format").selectOption("HPGL");
      await expect(page.getByLabel("Connection and production route")).toHaveValue("WEB_SERIAL");
      await page.getByLabel("Bed width mm").fill("320");
      await page.getByLabel("Bed height mm").fill("500");
      await page.getByLabel("Units per mm").fill("40");
      await page.getByLabel("Serial baud").fill("19200");
      await page.getByLabel("USB vendor ID").fill("0x1A86");
      await page.getByLabel("USB product ID").fill("0x7523");
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
    await expect(page.getByText("DemoCut ProPlot 320")).toBeVisible();
    await expect(page.getByText("Direct browser serial connection")).toBeVisible();

    await page.getByRole("button", { name: "Test serial connection" }).click();
    await expect(page.getByText(/Connection preflight passed for DemoCut ProPlot 320/)).toBeVisible();
    await expect(page.getByText(/USB VID 1A86 · PID 7523/)).toBeVisible();

    await page.getByRole("button", { name: "Use machine bed" }).click();
    await expect(page.getByLabel("Width mm")).toHaveValue("320");
    await expect(page.getByLabel("Height mm")).toHaveValue("500");
    await page.getByRole("button", { name: "Rectangle", exact: true }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export HPGL" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.plt$/);

    await page.getByRole("button", { name: "Connect serial cutter" }).click();
    await expect(page.getByText(/Port detected at 19200 baud/)).toBeVisible();
    await page.getByRole("button", { name: "Send validated paths to cutter" }).click();
    await expect(page.getByText(/Vector job sent at 19200 baud/)).toBeVisible();

    const serialResult = await page.evaluate(() => {
      type SerialState = {
        openOptions: Array<{ baudRate: number }>;
        requests: Array<{ filters?: Array<{ usbVendorId: number; usbProductId?: number }> } | undefined>;
        writes: number[][];
      };
      const state = (window as Window & { __ejmSerialTestState?: SerialState }).__ejmSerialTestState;
      if (!state) return null;
      const bytes = state.writes.flat();
      return {
        openOptions: state.openOptions,
        firstFilters: state.requests[0]?.filters,
        payload: new TextDecoder().decode(new Uint8Array(bytes)),
      };
    });
    expect(serialResult?.openOptions).toContainEqual({ baudRate: 19200 });
    expect(serialResult?.firstFilters).toEqual([{ usbVendorId: 0x1a86, usbProductId: 0x7523 }]);
    expect(serialResult?.payload).toContain("IN;PA;SP1");

    await page.getByLabel("Job name").fill("Release 29 cutter presentation test");
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
    await expect(page.getByText("DemoCut ProPlot 320")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add machine profile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit profile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Owner/manager only" })).toBeDisabled();
  });
});

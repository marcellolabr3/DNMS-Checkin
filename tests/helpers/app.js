const { expect } = require("@playwright/test");
const { createMockSupabaseScript } = require("../fixtures/mockSupabase");

async function openApp(page, options = {}) {
  await page.route("**/vendor/supabase-js.js**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: createMockSupabaseScript()
    });
  });
  await page.route("**/xlsx.full.min.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.XLSX = window.XLSX || {};"
    });
  });
  await page.addInitScript(() => {
    window.alertMessages = [];
    window.confirmMessages = [];
    window.print = () => {};
    window.alert = (message) => window.alertMessages.push(String(message));
    window.confirm = (message) => {
      window.confirmMessages.push(String(message));
      return true;
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: undefined
    });
  });
  await page.goto(options.path || "/index.html");
  await expect(page.locator("#authCard")).toBeVisible();
}

async function loginAs(page, email, password = "senha123") {
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", password);
  await page.click("#btnLogin");
  await expect(page.locator("#authCard")).toBeHidden();
}

async function getAlerts(page) {
  return page.evaluate(() => window.alertMessages || []);
}

module.exports = {
  openApp,
  loginAs,
  getAlerts
};

const { test, expect } = require("@playwright/test");
const { openApp, loginAs } = require("./helpers/app");

test("janela de recuperacao de senha cabe no viewport", async ({ page }) => {
  await openApp(page);

  await page.click("#btnForgotPassword");
  const box = await page.locator("#forgotPasswordDialog .dialog-body").boundingBox();
  const viewport = page.viewportSize();

  expect(box.width).toBeGreaterThan(Math.min(300, viewport.width * 0.7));
  expect(box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.height).toBeLessThanOrEqual(viewport.height);
});

test("detalhes da crianca nao criam rolagem horizontal", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "responsavel@dnms.test");

  await page.locator("#studentList .list-item").filter({ hasText: "Ana Kids" }).click();
  await expect(page.locator("#studentDetailsDialog")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

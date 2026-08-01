const { test, expect } = require("@playwright/test");
const { openApp, loginAs } = require("./helpers/app");

test("responsavel visualiza apenas suas criancas e abre detalhes", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "responsavel@dnms.test");

  await expect(page.locator("#studentCard")).toBeVisible();
  await expect(page.locator("#studentList")).toContainText("Ana Kids");
  await expect(page.locator("#studentList")).not.toContainText("Bia Juniors");

  await page.locator("#studentList .list-item").filter({ hasText: "Ana Kids" }).click();

  await expect(page.locator("#studentDetailsDialog")).toBeVisible();
  await expect(page.locator("#studentDetailsTitle")).toContainText("Ana Kids");
  await expect(page.locator("#studentDetailsInfo")).toContainText("Responsavel Teste");
});

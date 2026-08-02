const { test, expect } = require("@playwright/test");
const { openApp, loginAs } = require("./helpers/app");

test("dashboard mostra somente as tres proximas escalas", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=upcoming-schedules" });
  await loginAs(page, "admin@dnms.test");

  const schedules = page.locator("#dashboardSchedules .list-item");
  await expect(schedules).toHaveCount(3);
  await expect(page.locator("#dashboardSchedules")).toContainText("Coord 01");
  await expect(page.locator("#dashboardSchedules")).toContainText("Coord 03");
  await expect(page.locator("#dashboardSchedules")).not.toContainText("Coord 04");

  await schedules.first().getByRole("button").click();
  const expandedDetails = schedules.first().locator(".summary");
  await expect(expandedDetails).not.toContainText("Coordenador:");
  await expect(expandedDetails).toContainText("Maternal:");
});

test("card de aniversariante mantem tamanho padrao quando ha apenas um", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=single-birthday" });
  await loginAs(page, "admin@dnms.test");

  const birthdayCards = page.locator("#dashboardBirthdays .dashboard-birthday-item");
  await expect(birthdayCards).toHaveCount(1);
  await expect(birthdayCards.first()).toContainText("Ana Kids");

  const width = await birthdayCards.first().evaluate((node) => node.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(170);
});

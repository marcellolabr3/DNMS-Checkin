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

test("responsavel exclui a propria crianca", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "responsavel@dnms.test");
  await page.evaluate(() => {
    window.__mockDnmsDb.checkins.push({
      id: "checkin-parent-delete",
      student_id: "student-kids",
      room_id: "room-kids",
      room_name_snapshot: "Culto Kids",
      checked_in_at: new Date().toISOString(),
      checked_out_at: null
    });
  });

  const ana = page.locator("#studentList .list-item").filter({ hasText: "Ana Kids" });
  await expect(ana).toBeVisible();
  await ana.getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await expect(page.locator("#btnDeleteStudent")).toBeVisible();
  await page.click("#btnDeleteStudent");

  await expect(page.locator("#studentDialog")).toBeHidden();
  await expect(page.locator("#studentList")).not.toContainText("Ana Kids");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.students.find((item) => item.id === "student-kids"))))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.student_guardians.find((item) => item.student_id === "student-kids"))))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-kids"))))
    .toBe(false);
});

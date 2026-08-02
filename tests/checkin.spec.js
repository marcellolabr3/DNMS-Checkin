const { test, expect } = require("@playwright/test");
const { openApp, loginAs, getAlerts } = require("./helpers/app");

async function openStudentsPanel(page) {
  await page.click("#btnStudentsPanel");
  await expect(page.locator("#studentCard")).toBeVisible();
  const filter = page.locator("#studentClassFilter");
  if (await filter.isVisible()) {
    await filter.selectOption("all");
  }
}

function studentItem(page, name) {
  return page.locator("#studentList .list-item").filter({ hasText: name });
}

test("check-in e checkout manual atualizam o estado da crianca", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  const ana = studentItem(page, "Ana Kids");
  await expect(ana).toBeVisible();
  await ana.getByRole("button", { name: "Check-in" }).click();

  await expect(ana.getByRole("button", { name: "Check-in realizado" })).toBeDisabled();
  await expect(ana.getByRole("button", { name: "Checkout" })).toBeVisible();

  await ana.getByRole("button", { name: "Checkout" }).click();
  await expect(page.locator("#checkoutDialog")).toBeVisible();
  await page.click("#btnConfirmCheckout");

  await expect(page.locator("#checkoutDialog")).toBeHidden();
  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Checkout" })).toHaveCount(0);
  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in realizado" })).toBeDisabled();
});

test("fechar sala faz checkout automatico dos alunos ativos", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();

  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await page.locator("#roomList .list-item").filter({ hasText: "Culto Kids" }).click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();
  await page.click("#btnRoomDialogClose");

  await expect
    .poll(() =>
      page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-kids")?.checked_out_at)
    )
    .not.toBeNull();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids")?.status))
    .toBe("Fechada");
});

test("crianca com check-in ativo em outra sala nao pode fazer novo check-in", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=duplicate-active-checkin" });
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  const ana = studentItem(page, "Ana Kids");
  await expect(ana.getByRole("button", { name: "Checkout" })).toBeVisible();
  await ana.getByRole("button", { name: "Check-in" }).click();

  await expect
    .poll(() => getAlerts(page))
    .toContainEqual(expect.stringContaining("ja possui um check-in ativo"));
});

test("edicao de nascimento substitui o segmento sem deslocar a data", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();

  await page.locator("#studentBirth").evaluate((input) => input.setSelectionRange(0, 0));
  await page.press("#studentBirth", "2");
  await page.press("#studentBirth", "5");
  await expect(page.locator("#studentBirth")).toHaveValue(/25\/04\/\d{4}/);

  await page.press("#studentBirth", "1");
  await page.press("#studentBirth", "2");
  await expect(page.locator("#studentBirth")).toHaveValue(/25\/12\/\d{4}/);
});

test("nome da crianca e salvo com iniciais maiusculas", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "MARIA   clara");
  await page.click("#btnSaveStudent");

  await expect(page.locator("#studentDialog")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids")?.name))
    .toBe("Maria Clara");
});

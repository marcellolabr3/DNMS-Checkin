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

async function openFamiliesPanel(page) {
  await page.click("#btnFamiliesPanel");
  await expect(page.locator("#familiesCard")).toBeVisible();
}

function studentItem(page, name) {
  return page.locator("#studentList .list-item").filter({ hasText: name });
}

function todayIso() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

test("nao cadastra a mesma crianca duas vezes com outro responsavel", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  const existingBirth = await page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids")?.birth_date);
  const [year, month, day] = existingBirth.split("-");
  const beforeCount = await page.evaluate(() => window.__mockDnmsDb.students.length);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "ana   kids");
  await page.fill("#studentBirth", `${day}/${month}/${year}`);
  await page.fill("#studentGuardian", "Responsavel Secundario");
  await page.fill("#studentPhone", "11988880000");
  await page.fill("#studentAddress", "Rua Familia");
  await page.click("#btnSaveStudent");

  await expect(page.locator("#studentDialog")).toBeVisible();
  await expect(page.locator("#studentSavingOverlay")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.students.length))
    .toBe(beforeCount);
  await expect.poll(() => getAlerts(page)).toContain("Esta crianca ja esta cadastrada. Procure a equipe para ajustar os responsaveis.");
});

test("foto da crianca pode ser trocada mais de uma vez", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.setInputFiles("#studentPhoto", {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("primeira-foto")
  });
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  const firstUrl = await page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids")?.photo_url);
  expect(firstUrl).toContain("students/student-kids/profile-");

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.setInputFiles("#studentPhoto", {
    name: "foto.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("segunda-foto")
  });
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  const secondUrl = await page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids")?.photo_url);
  expect(secondUrl).toContain("students/student-kids/profile-");
  expect(secondUrl).not.toBe(firstUrl);
  await expect.poll(() => page.evaluate(() => window.__mockStorageUploads.length)).toBe(2);
});

test("trocar de aba atualiza dados sem novo login", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);
  await expect(studentItem(page, "Ana Kids")).toBeVisible();

  await page.evaluate(() => {
    const student = window.__mockDnmsDb.students.find((item) => item.id === "student-kids");
    student.name = "Ana Atualizada";
  });

  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await page.click("#btnStudentsPanel");

  await expect(studentItem(page, "Ana Atualizada")).toBeVisible();
  await expect(page.locator("#authCard")).toBeHidden();
});

test("lista exibe foto e formulario prioriza nome e endereco", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  const ana = studentItem(page, "Ana Kids");
  await expect(ana.locator(".student-list-photo")).toBeVisible();

  await ana.getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();

  const sizes = await page.evaluate(() => {
    const name = document.querySelector(".student-name-field").getBoundingClientRect().width;
    const birth = document.querySelector(".student-birth-field").getBoundingClientRect().width;
    const address = document.querySelector(".student-address-field").getBoundingClientRect().width;
    const birthInput = document.querySelector("#studentBirth").getBoundingClientRect().width;
    return { name, birth, address, birthInput };
  });
  if (page.viewportSize().width > 420) {
    expect(sizes.name).toBeGreaterThan(sizes.birth);
    expect(sizes.address).toBeGreaterThan(sizes.birth);
  }
  expect(sizes.birthInput).toBeLessThanOrEqual(190);
});

test("familias oculta busca vazia e recolhe cadastro de responsavel", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openFamiliesPanel(page);

  await expect(page.locator("#familyList")).toBeHidden();
  await expect(page.locator("#familyEditor")).toBeHidden();
  await expect(page.locator("#familyCreatePanel")).not.toHaveAttribute("open", "");
  await expect(page.locator("#familyCreateName")).toBeHidden();

  await page.locator("#familyCreatePanel summary").click();
  await expect(page.locator("#familyCreatePanel")).toHaveAttribute("open", "");
  await expect(page.locator("#familyCreateName")).toBeVisible();

  await page.fill("#familySearch", "Responsavel");
  await expect(page.locator("#familyList")).toBeVisible();
  await expect(page.locator("#familyList")).toContainText("Responsavel Teste");
});

test("log gera relatorio de cadastro de criancas", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "relatorio teste");
  await page.fill("#studentBirth", "10/01/2020");
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11999990000");
  await page.fill("#studentAddress", "Rua Relatorio");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  await page.click("#btnLogPanel");
  await expect(page.locator("#logCard")).toBeVisible();
  await page.selectOption("#logReportType", "child_created");
  await page.fill("#logStart", todayIso());
  await page.fill("#logEnd", todayIso());

  await expect(page.locator("#logSummary")).toContainText("Cadastro de criancas");
  await expect(page.locator("#logList")).toContainText("Relatorio Teste");
  await expect(page.locator("#logList")).toContainText("Crianca cadastrada");
  await expect(page.locator("#btnExport")).toBeEnabled();
});

test("sadmin edita qualquer usuario e crianca", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Equipe");
  await expect(page.locator("#familyList")).toContainText("Equipe DNMS");
  await expect(page.locator("#familyEditName")).toBeEnabled();
  await expect(page.locator("#familyEditPhone")).toBeEnabled();
  await expect(page.locator("#familyEditAddress")).toBeEnabled();
  await page.fill("#familyEditAddress", "Rua Atualizada Sadmin");
  await page.click("#btnFamilySaveProfile");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.profiles.find((item) => item.id === "team-1")?.address))
    .toBe("Rua Atualizada Sadmin");

  await openStudentsPanel(page);
  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await expect(page.locator("#btnDeleteStudent")).toBeVisible();
  await page.fill("#studentNotes", "Atualizado pelo SADMIN");
  await page.click("#btnSaveStudent");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids")?.notes))
    .toBe("Atualizado pelo SADMIN");
});

test("exclusao de usuario remove filhos somente quando ele e responsavel principal", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");
  await page.evaluate(() => {
    window.__mockDnmsDb.checkins.push({
      id: "checkin-delete-cascade",
      student_id: "student-kids",
      room_id: "room-kids",
      room_name_snapshot: "Culto Kids",
      checked_in_at: new Date().toISOString(),
      checked_out_at: null
    });
  });
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel Secundario");
  await expect(page.locator("#familyList")).toContainText("Responsavel Secundario");
  await page.fill("#familyDeleteConfirmName", "Responsavel Secundario");
  await page.click("#btnFamilyDeleteUser");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.profiles.find((item) => item.id === "parent-2"))))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.auth_users.find((item) => item.id === "parent-2"))))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.students.find((item) => item.id === "student-kids"))))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.student_guardians.find((item) => item.guardian_id === "parent-2"))))
    .toBe(false);

  await page.fill("#familySearch", "Responsavel Teste");
  await expect(page.locator("#familyList")).toContainText("Responsavel Teste");
  await page.fill("#familyDeleteConfirmName", "Responsavel Teste");
  await page.click("#btnFamilyDeleteUser");
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.profiles.find((item) => item.id === "parent-1"))))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.auth_users.find((item) => item.id === "parent-1"))))
    .toBe(false);
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

test("equipe opera check-in e salas sem editar cadastros", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "equipe@dnms.test");

  await expect(page.locator("#sessionRole")).toContainText("Equipe");
  await openStudentsPanel(page);
  const ana = studentItem(page, "Ana Kids");
  await expect(ana).toBeVisible();
  await expect(ana.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await expect(page.locator("#btnAddStudent")).toBeEnabled();
  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "joao equipe");
  await page.fill("#studentBirth", "10/01/2020");
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11999990000");
  await page.fill("#studentAddress", "Rua Equipe");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();
  const joao = studentItem(page, "Joao Equipe");
  await expect(joao).toBeVisible();
  await expect(joao.getByRole("button", { name: "Editar" })).toHaveCount(0);
  await ana.getByRole("button", { name: "Check-in" }).click();
  await expect(ana.getByRole("button", { name: "Checkout" })).toBeVisible();

  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await expect(page.locator("#btnCreateRoom")).toBeDisabled();
  await expect(page.locator("#btnBulkEditRooms")).toBeDisabled();
  await expect(page.locator("#btnBulkDeleteRooms")).toBeDisabled();
  await page.locator("#roomList .list-item").filter({ hasText: "Culto Kids" }).click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();
  await expect(page.locator("#btnRoomDialogEdit")).toBeHidden();
  await expect(page.locator("#btnRoomDialogClose")).toBeVisible();
});

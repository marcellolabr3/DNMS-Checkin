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

test("responsavel secundario visualiza crianca vinculada a ele", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "secundario@dnms.test");

  await expect(page.locator("#studentCard")).toBeVisible();
  await expect(page.locator("#studentList")).toContainText("Ana Kids");
  await expect(page.locator("#studentList")).not.toContainText("Bia Juniors");
});

test("responsavel visualiza crianca cadastrada por ele mesmo sem vinculo legado", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.students.push({
      id: "student-orphan-owner",
      name: "Sophia Sem Vinculo",
      birth_date: "2018-06-12",
      class_name: "Kids",
      primary_guardian_name: "Responsavel Teste",
      phone: "11988880000",
      address: "Rua Familia",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
  });

  await loginAs(page, "responsavel@dnms.test");

  await expect(page.locator("#studentList")).toContainText("Ana Kids");
  await expect(page.locator("#studentList")).toContainText("Sophia Sem Vinculo");
  await expect(page.locator("#studentList")).not.toContainText("Bia Juniors");
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

test("responsavel atualiza foto da propria crianca", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "responsavel@dnms.test");

  const ana = page.locator("#studentList .list-item").filter({ hasText: "Ana Kids" });
  await expect(ana).toBeVisible();
  await ana.getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();

  await page.setInputFiles("#studentPhoto", {
    name: "foto-responsavel.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("foto-responsavel")
  });
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  const photoUrl = await page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids")?.photo_url);
  expect(photoUrl).toContain("students/student-kids/profile-");
  await expect.poll(() => page.evaluate(() => window.__mockStorageUploads[0]?.size || 0)).toBeGreaterThan(0);
});

test("responsavel cadastra outra crianca diferente", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "responsavel@dnms.test");

  const beforeCount = await page.evaluate(() => window.__mockDnmsDb.students.length);
  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();

  await page.fill("#studentName", "Lucas Teste");
  await page.fill("#studentBirth", "11/02/2021");
  await page.click("#btnSaveStudent");

  await expect(page.locator("#studentDialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__mockDnmsDb.students.length)).toBe(beforeCount + 1);
  await expect(page.locator("#studentList")).toContainText("Lucas Teste");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          window.__mockDnmsDb.student_guardians.find(
            (item) => item.guardian_id === "parent-1" && item.student_id !== "student-kids"
          )
        )
      )
    )
    .toBe(true);
});

test("responsavel vincula outro responsavel e compartilha todas as criancas da rede", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.students.push({
      id: "student-secondary-own",
      name: "Caio Secundario",
      birth_date: "2020-03-15",
      class_name: "Kids",
      primary_guardian_name: "Responsavel Secundario",
      phone: "11955550000",
      address: "Rua Secundaria",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
    window.__mockDnmsDb.student_guardians.push({ student_id: "student-secondary-own", guardian_id: "parent-2" });
  });

  await loginAs(page, "responsavel@dnms.test");
  await expect(page.locator("#studentList")).toContainText("Ana Kids");
  await expect(page.locator("#studentList")).not.toContainText("Caio Secundario");

  await page.click("#sessionRole");
  await expect(page.locator("#myDataDialog")).toBeVisible();
  await page.fill("#familyLinkEmail", "secundario@dnms.test");
  await page.click("#btnLinkFamilyResponsible");
  await expect(page.locator("#familyLinkStatus")).toContainText("Responsavel vinculado");
  await page.locator("#myDataDialog").press("Escape");

  await expect(page.locator("#studentList")).toContainText("Ana Kids");
  await expect(page.locator("#studentList")).toContainText("Caio Secundario");

  const network = await page.evaluate(() => ({
    parentFamily: window.__mockDnmsDb.profiles.find((item) => item.id === "parent-1")?.family_id,
    secondaryFamily: window.__mockDnmsDb.profiles.find((item) => item.id === "parent-2")?.family_id,
    caioLinks: window.__mockDnmsDb.student_guardians
      .filter((item) => item.student_id === "student-secondary-own")
      .map((item) => item.guardian_id)
      .sort(),
    anaLinks: window.__mockDnmsDb.student_guardians
      .filter((item) => item.student_id === "student-kids")
      .map((item) => item.guardian_id)
      .sort()
  }));
  expect(network.parentFamily).toBe(network.secondaryFamily);
  expect(network.caioLinks).toEqual(["parent-1", "parent-2"]);
  expect(network.anaLinks).toEqual(["parent-1", "parent-2"]);
});

test("responsavel cadastra crianca vinculada mesmo quando upload de foto falha", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "responsavel@dnms.test");
  await page.evaluate(() => {
    window.__mockStorageUploadError = "Falha simulada no storage";
  });

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();

  await page.fill("#studentName", "Foto Falha Vinculo");
  await page.fill("#studentBirth", "12/02/2021");
  await page.setInputFiles("#studentPhoto", {
    name: "foto-falha.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("foto-falha")
  });
  await page.click("#btnSaveStudent");

  const student = await page.evaluate(() =>
    window.__mockDnmsDb.students.find((item) => item.name === "Foto Falha Vinculo")
  );
  expect(student?.id).toBeTruthy();
  await expect
    .poll(() =>
      page.evaluate((studentId) =>
        Boolean(
          window.__mockDnmsDb.student_guardians.find(
            (item) => item.guardian_id === "parent-1" && item.student_id === studentId
          )
        ),
        student.id
      )
    )
    .toBe(true);
});

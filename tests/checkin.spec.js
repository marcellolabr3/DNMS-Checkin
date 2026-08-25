const { test, expect } = require("@playwright/test");
const fs = require("fs");
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

function futureIso(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function pastIso(daysBack) {
  return futureIso(-daysBack);
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

test("nome longo da crianca nao perde caracteres durante digitacao", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.locator("#studentName").click();
  await page.keyboard.type("Samuel De Ana Magalhaes Pinheiro", { delay: 5 });

  await expect(page.locator("#studentName")).toHaveValue("Samuel De Ana Magalhaes Pinheiro");
});

test("dados com HTML sao exibidos como texto nas listas, detalhes e etiqueta", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const student = window.__mockDnmsDb.students.find((item) => item.id === "student-kids");
    student.name = 'Ana <img src=x onerror="window.__xssFromName=1"> Kids';
    student.primary_guardian_name = 'Responsavel <b>Teste</b>';
    student.notes = '<script>window.__xssFromNotes=1</script>Observacao';
  });
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await expect(page.locator("#studentList")).toContainText('Ana <img src=x onerror="window.__xssFromName=1"> Kids');
  await expect(page.locator("#studentList img[onerror]")).toHaveCount(0);
  await expect(page.locator("#studentList script")).toHaveCount(0);

  await page.locator("#studentList .list-item").filter({ hasText: "Ana <img" }).click();
  await expect(page.locator("#studentDetailsDialog")).toBeVisible();
  await expect(page.locator("#studentDetailsInfo")).toContainText("<script>window.__xssFromNotes=1</script>Observacao");
  await expect(page.locator("#studentDetailsInfo script")).toHaveCount(0);
  await page.locator("#studentDetailsDialog").evaluate((dialog) => dialog.close());

  await page.locator("#studentList .list-item").filter({ hasText: "Ana <img" }).getByRole("button", { name: "Check-in" }).click();
  await expect(page.locator("#labelPreview")).toContainText('Ana <img src=x onerror="window.__xssFromName=1"> Kids');
  await expect(page.locator("#labelPreview img[onerror]")).toHaveCount(0);
  await expect(page.locator("#labelPreview script")).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.__xssFromName || window.__xssFromNotes))).toBe(false);
});

test("nao cadastra a mesma crianca duas vezes para o mesmo responsavel", async ({ page }) => {
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
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11988880000");
  await page.fill("#studentAddress", "Rua Familia");
  await page.click("#btnSaveStudent");

  await expect(page.locator("#studentDialog")).toBeVisible();
  await expect(page.locator("#studentSavingOverlay")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.students.length))
    .toBe(beforeCount);
  await expect.poll(() => getAlerts(page)).toContain("Esta crianca ja esta cadastrada para este responsavel.");
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

test("admin cria eventos para multiplas turmas com recorrencia mensal", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();

  await page.fill("#roomName", "Culto Multiplo");
  await page.fill("#roomDate", futureIso(3));
  await page.fill("#roomStartTime", "10:00");
  await page.fill("#roomEndTime", "11:00");
  await page.locator('#roomClass input[value="Maternal"]').check();
  await page.locator('#roomClass input[value="Teens"]').check();
  await page.selectOption("#roomRecurrence", "months:2");
  await page.click("#btnCreateRoom");

  await expect
    .poll(() =>
      page.evaluate(() => window.__mockDnmsDb.rooms.filter((room) => room.name === "Culto Multiplo").length)
    )
    .toBe(16);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(new Set(window.__mockDnmsDb.rooms
          .filter((room) => room.name === "Culto Multiplo")
          .map((room) => room.class_target)))
          .sort()
      )
    )
    .toEqual(["Maternal", "Teens"]);
});

test("salas ficam agrupadas por mes e salas vencidas nao aparecem abertas", async ({ page }) => {
  await openApp(page);
  await page.evaluate(({ past, futureA, futureB }) => {
    window.__mockDnmsDb.rooms.push(
      {
        id: "room-old-open",
        name: "Evento Vencido Aberto",
        date: past,
        start_time: "10:00",
        end_time: "11:00",
        class_target: "Kids",
        status: "Aberta",
        opened_at: past + "T10:00:00.000Z",
        closed_at: null
      },
      {
        id: "room-future-a",
        name: "Evento Futuro A",
        date: futureA,
        start_time: "10:00",
        end_time: "11:00",
        class_target: "Kids",
        status: "Programada",
        opened_at: null,
        closed_at: null
      },
      {
        id: "room-future-b",
        name: "Evento Futuro B",
        date: futureB,
        start_time: "10:00",
        end_time: "11:00",
        class_target: "Teens",
        status: "Programada",
        opened_at: null,
        closed_at: null
      }
    );
  }, { past: pastIso(2), futureA: futureIso(35), futureB: futureIso(70) });

  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();

  await expect(page.locator(".room-month-group")).toHaveCount(3);
  await expect(page.locator("#roomList")).not.toContainText("Evento Vencido Aberto");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-old-open")?.status))
    .toBe("Fechada");

  await page.locator(".room-month-group").filter({ hasText: "Evento Futuro A" }).locator("summary").click();
  await page.locator("#roomList .list-item").filter({ hasText: "Evento Futuro A" }).click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();
  await expect(page.locator("#btnRoomDialogOpen")).toBeDisabled();
});

test("abrir selecionadas abre apenas salas aptas de hoje", async ({ page }) => {
  await openApp(page);
  await page.evaluate(({ today, future }) => {
    window.__mockDnmsDb.rooms.push(
      {
        id: "room-bulk-kids",
        name: "Culto Bulk Kids",
        date: today,
        start_time: "00:00",
        end_time: "23:59",
        class_target: "Kids",
        status: "Programada",
        opened_at: null,
        closed_at: null
      },
      {
        id: "room-bulk-juniors",
        name: "Culto Bulk Juniors",
        date: today,
        start_time: "00:00",
        end_time: "23:59",
        class_target: "Juniors",
        status: "Programada",
        opened_at: null,
        closed_at: null
      },
      {
        id: "room-bulk-future",
        name: "Culto Bulk Futuro",
        date: future,
        start_time: "00:00",
        end_time: "23:59",
        class_target: "Kids",
        status: "Programada",
        opened_at: null,
        closed_at: null
      }
    );
  }, { today: todayIso(), future: futureIso(1) });

  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await expect(page.locator("#btnBulkOpenAllRooms")).toHaveCount(0);
  await expect(page.locator("#btnBulkEditRooms")).toHaveText("Abrir selecionadas");
  await expect(page.locator("#btnBulkEditRooms")).toBeDisabled();

  await page.locator("#selectAllRooms").check();
  await expect(page.locator('input[data-select-room="room-bulk-kids"]')).toBeChecked();
  await expect(page.locator('input[data-select-room="room-bulk-juniors"]')).toBeChecked();
  await expect(page.locator('input[data-select-room="room-bulk-future"]')).not.toBeChecked();
  await expect(page.locator('input[data-select-room="room-bulk-future"]')).toBeDisabled();
  await expect(page.locator("#btnBulkEditRooms")).toBeEnabled();

  await page.locator("#btnBulkEditRooms").click();

  await expect
    .poll(() => page.evaluate(() => window.confirmMessages || []))
    .toContain("Abrir 2 sala(s) selecionada(s)?");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-bulk-kids")?.status))
    .toBe("Aberta");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-bulk-juniors")?.status))
    .toBe("Aberta");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-bulk-future")?.status))
    .toBe("Programada");
  await expect(page.locator("#btnBulkEditRooms")).toBeDisabled();
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

test("familias mostra crianca vinculada a responsavel secundario", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel Secundario");

  await expect(page.locator("#familyList")).toContainText("Responsavel Secundario");
  await expect(page.locator("#familyList")).toContainText("Filhos: 1");
  await expect(page.locator("#familyEditor")).toContainText("Ana Kids");
});

test("vincular crianca existente adiciona segundo responsavel sem trocar o principal", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.students.push({
      id: "student-shared",
      name: "Duas Familias",
      birth_date: "2019-08-15",
      class_name: "Kids",
      primary_guardian_name: "Responsavel Teste",
      phone: "11988880000",
      address: "Rua Familia",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
    window.__mockDnmsDb.student_guardians.push({ student_id: "student-shared", guardian_id: "parent-1" });
  });
  await loginAs(page, "admin@dnms.test");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel Secundario");
  await page.selectOption("#familyAssignStudentId", "student-shared");
  await page.click("#btnFamilyAssignStudent");

  await expect(page.locator("#familyEditor")).toContainText("Duas Familias");
  const result = await page.evaluate(() => ({
    primary: window.__mockDnmsDb.students.find((item) => item.id === "student-shared")?.primary_guardian_name,
    links: window.__mockDnmsDb.student_guardians
      .filter((item) => item.student_id === "student-shared")
      .map((item) => item.guardian_id)
      .sort()
  }));
  expect(result.primary).toBe("Responsavel Teste");
  expect(result.links).toEqual(["parent-1", "parent-2"]);

  await page.click("#btnLogPanel");
  await page.selectOption("#logReportType", "changes");
  await expect(page.locator("#logSummary")).toContainText("Alteracoes de dados");
  await expect(page.locator("#logList")).toContainText("Responsavel Secundario vinculado a crianca Duas Familias");
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

  await expect(page.locator("#logSummary")).toContainText("Cadastro de criancas");
  await expect(page.locator("#logList")).toContainText("Relatorio Teste");
  await expect(page.locator("#logList")).toContainText("Crianca cadastrada");
  await expect(page.locator("#btnExport")).toBeEnabled();
});

test("exportacao do log usa formato legivel para planilhas", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "josé exportação");
  await page.fill("#studentBirth", "10/01/2020");
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11999990000");
  await page.fill("#studentAddress", "Rua Exportacao");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  await page.click("#btnLogPanel");
  await expect(page.locator("#logCard")).toBeVisible();
  await page.selectOption("#logReportType", "child_created");

  const downloadPromise = page.waitForEvent("download");
  await page.click("#btnExport");
  const download = await downloadPromise;
  const filePath = await download.path();
  const buffer = fs.readFileSync(filePath);
  const csv = buffer.toString("utf8");

  expect(Array.from(buffer.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  expect(csv).toContain("Data;Relatorio;Acao;Alvo;Autor;Perfil;Detalhes");
  expect(csv).toContain("José Exportação");
  expect(csv).not.toContain("Data,Relatorio,Acao");
});

test("log abre com periodo de hoje e mostra assiduidade", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();
  await page.click("#btnLogPanel");

  await expect(page.locator("#logCard")).toBeVisible();
  await expect(page.locator("#logStart")).toHaveValue(todayIso());
  await expect(page.locator("#logEnd")).toHaveValue(todayIso());
  await expect(page.locator("#logSummary")).toContainText("Frequencia do periodo");
  await expect(page.locator("#logList")).toContainText("Ana Kids");
  await expect(page.locator("#btnExport")).toBeEnabled();
});

test("admin cadastra crianca sempre vinculada ao responsavel selecionado", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "Vinculo Admin");
  await page.fill("#studentBirth", "14/03/2020");
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11999990000");
  await page.fill("#studentAddress", "Rua Vinculo");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  const student = await page.evaluate(() =>
    window.__mockDnmsDb.students.find((item) => item.name === "Vinculo Admin")
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

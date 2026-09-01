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

function shortDateLabel(isoDate) {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

function timeOffset(minutes) {
  const date = new Date(Date.now() + minutes * 60000);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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

test("check-in fica bloqueado antes de 30 minutos do inicio da aula", async ({ page }) => {
  await openApp(page);
  await page.evaluate(
    ({ start, end }) => {
      const room = window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids");
      room.start_time = start;
      room.time = start;
      room.end_time = end;
    },
    { start: timeOffset(31), end: timeOffset(90) }
  );
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  const button = studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in em breve" });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("title", /Check-in disponivel a partir de/);
});

test("check-in fica bloqueado no horario de termino mesmo com sala aberta", async ({ page }) => {
  await openApp(page);
  await page.evaluate(
    ({ start, end }) => {
      const room = window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids");
      room.start_time = start;
      room.time = start;
      room.end_time = end;
      room.status = "Aberta";
    },
    { start: timeOffset(-90), end: timeOffset(-1) }
  );
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  const button = studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in encerrado" });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("title", "Horario de check-in encerrado para esta aula.");
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

test("excluir sala com check-in ativo libera novo check-in em sala recriada", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();
  const originalCheckinId = await page.evaluate(() => window.__mockDnmsDb.checkins[0]?.id);

  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await page.locator("#roomList .list-item").filter({ hasText: "Culto Kids" }).click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();
  await page.click("#btnRoomDialogEdit");
  await expect(page.locator("#btnDeleteRoomFromEdit")).toBeVisible();
  await page.click("#btnDeleteRoomFromEdit");

  await expect
    .poll(() => page.evaluate((id) => window.__mockDnmsDb.checkins.find((item) => item.id === id)?.checked_out_at, originalCheckinId))
    .not.toBeNull();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids"))))
    .toBe(false);

  await page.fill("#roomName", "Culto Recriado");
  await page.fill("#roomDate", todayIso());
  await page.fill("#roomStartTime", "00:00");
  await page.fill("#roomEndTime", "23:59");
  await page.locator('#roomClass input[value="Kids"]').check();
  await page.click("#btnCreateRoom");
  await page.locator("#roomList .list-item").filter({ hasText: "Culto Recriado" }).click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();
  await page.click("#btnRoomDialogOpen");
  await expect(page.locator("#roomDetailsDialog")).toBeHidden();

  await openStudentsPanel(page);
  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" })).toBeEnabled();
  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();

  await expect
    .poll(() =>
      page.evaluate(() => window.__mockDnmsDb.checkins.filter((item) => item.student_id === "student-kids").length)
    )
    .toBe(2);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__mockDnmsDb.checkins.filter((item) => item.student_id === "student-kids" && item.checked_out_at === null).length
      )
    )
    .toBe(1);
});

test("crianca com check-in ativo em outra sala nao pode fazer novo check-in", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=duplicate-active-checkin" });
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  const ana = studentItem(page, "Ana Kids");
  await expect(ana.getByRole("button", { name: "Checkout" })).toBeVisible();
  await expect(ana.getByRole("button", { name: "Check-in realizado" })).toBeDisabled();
});

test("dashboard alerta e encerra check-ins ativos antigos", async ({ page }) => {
  const staleDate = pastIso(1);
  await openApp(page);
  await page.evaluate((date) => {
    const room = window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids");
    room.date = date;
    room.status = "Fechada";
    room.closed_at = `${date}T13:00:00.000Z`;
    window.__mockDnmsDb.checkins.push({
      id: "checkin-old-active",
      student_id: "student-kids",
      room_id: "room-kids",
      room_name_snapshot: "Culto Kids Antigo",
      class_name: "Kids",
      actor_id: "admin-1",
      notes_snapshot: "",
      checked_in_at: `${date}T12:00:00.000Z`,
      checked_out_at: null
    });
  }, staleDate);

  await loginAs(page, "admin@dnms.test");

  await expect(page.locator("#dashboardAlerts")).toContainText("1 check-in(s) antigo(s) ainda ativo(s).");
  await expect(page.locator("#dashboardStaleCheckins")).toContainText("Ana Kids");
  await expect(page.locator("#dashboardStaleCheckins")).toContainText("Culto Kids Antigo");
  await page.click("#btnCheckoutStaleCheckins");

  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.id === "checkin-old-active")?.checked_out_at))
    .not.toBeNull();
  await expect(page.locator("#dashboardStaleCheckins")).toBeEmpty();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.audit_logs.some((item) => item.action_type === "stale_checkins_closed")))
    .toBe(true);
  const alerts = await getAlerts(page);
  expect(alerts).toContain("1 check-in(s) antigo(s) encerrado(s).");
});

test("turma muda somente no ano seguinte ao aniversario", async ({ page }) => {
  const year = new Date().getFullYear();
  await openApp(page);
  await page.evaluate(
    ({ turns7Birth, turns15Birth, turned15LastYearBirth, startedAt, endedAt, today }) => {
      window.__mockDnmsDb.rooms.push(
        {
          id: "room-kids-age-rule",
          name: "Culto Kids",
          date: today,
          start_time: startedAt,
          end_time: endedAt,
          class_target: "Kids",
          status: "Aberta",
          opened_at: today + "T09:00:00.000Z",
          closed_at: null
        },
        {
          id: "room-teens-age-rule",
          name: "Culto Teens",
          date: today,
          start_time: startedAt,
          end_time: endedAt,
          class_target: "Teens",
          status: "Aberta",
          opened_at: today + "T09:00:00.000Z",
          closed_at: null
        }
      );
      window.__mockDnmsDb.students.push(
        {
          id: "student-turns-7",
          name: "Arthur Labre",
          birth_date: turns7Birth,
          class_name: "Juniors",
          primary_guardian_name: "Responsavel Teste",
          phone: "11988880000",
          address: "Rua Familia",
          notes: "",
          is_visitor: false,
          photo_url: ""
        },
        {
          id: "student-turns-15",
          name: "Clara Quinze",
          birth_date: turns15Birth,
          class_name: "Fora da faixa",
          primary_guardian_name: "Responsavel Teste",
          phone: "11988880000",
          address: "Rua Familia",
          notes: "",
          is_visitor: false,
          photo_url: ""
        },
        {
          id: "student-turned-15-last-year",
          name: "Davi Fora",
          birth_date: turned15LastYearBirth,
          class_name: "Teens",
          primary_guardian_name: "Responsavel Teste",
          phone: "11988880000",
          address: "Rua Familia",
          notes: "",
          is_visitor: false,
          photo_url: ""
        }
      );
    },
    {
      turns7Birth: `${year - 7}-12-27`,
      turns15Birth: `${year - 15}-12-31`,
      turned15LastYearBirth: `${year - 16}-12-31`,
      startedAt: timeOffset(-10),
      endedAt: timeOffset(50),
      today: todayIso()
    }
  );

  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await expect(studentItem(page, "Arthur Labre")).toContainText("Turma: Kids");
  await expect(studentItem(page, "Arthur Labre").getByRole("button", { name: "Check-in" })).toBeEnabled();
  await expect(studentItem(page, "Clara Quinze")).toContainText("Turma: Teens");
  await expect(studentItem(page, "Clara Quinze").getByRole("button", { name: "Check-in" })).toBeEnabled();
  await expect(studentItem(page, "Davi Fora")).toContainText("Turma: Fora da faixa");
  await expect(studentItem(page, "Davi Fora").getByRole("button", { name: "Fora da faixa" })).toBeDisabled();

  await studentItem(page, "Arthur Labre").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-turns-7")?.class_name))
    .toBe("Kids");
  await studentItem(page, "Clara Quinze").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-turns-15")?.class_name))
    .toBe("Teens");
});

test("sala vencida aberta faz checkout automatico antes de novo check-in", async ({ page }) => {
  await openApp(page);
  await page.evaluate(
    ({ pastDate, todayDate }) => {
      const oldRoom = window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids");
      oldRoom.date = pastDate;
      oldRoom.status = "Aberta";
      oldRoom.closed_at = null;
      window.__mockDnmsDb.checkins.push({
        id: "checkin-stale-active",
        student_id: "student-kids",
        room_id: oldRoom.id,
        room_name_snapshot: oldRoom.name,
        class_name: "Kids",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${pastDate}T12:00:00.000Z`,
        checked_out_at: null
      });
      window.__mockDnmsDb.rooms.push({
        id: "room-kids-current",
        name: "Culto Kids Atual",
        date: todayDate,
        start_time: oldRoom.start_time,
        end_time: oldRoom.end_time,
        class_target: "Kids",
        status: "Aberta",
        opened_at: `${todayDate}T12:00:00.000Z`,
        closed_at: null
      });
    },
    { pastDate: pastIso(1), todayDate: todayIso() }
  );
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.id === "checkin-stale-active")?.checked_out_at))
    .not.toBeNull();
  await expect(page.locator("#studentList .list-item").filter({ hasText: "Ana Kids" }).getByRole("button", { name: "Checkout" })).toHaveCount(0);
  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" })).toBeEnabled();
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

test("nao cadastra a mesma crianca duas vezes para a mesma familia", async ({ page }) => {
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
  await expect.poll(() => getAlerts(page)).toContain("Esta crianca ja esta cadastrada nesta familia.");
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
  await expect
    .poll(() =>
      page.locator(".room-class-field").evaluate((node) => {
        const style = window.getComputedStyle(node);
        return `${style.gridColumnStart}/${style.gridColumnEnd}`;
      })
    )
    .toBe("1/-1");

  const firstDate = futureIso(3);
  const firstDateLabel = shortDateLabel(firstDate);
  await page.fill("#roomName", "Culto Multiplo");
  await page.fill("#roomDate", firstDate);
  await page.fill("#roomStartTime", "10:00");
  await page.fill("#roomEndTime", "11:00");
  await page.locator('#roomClass input[value="Maternal"]').check();
  await page.locator('#roomClass input[value="Teens"]').check();
  await page.selectOption("#roomRecurrence", "months:2");
  await page.click("#btnCreateRoom");

  await expect
    .poll(() =>
      page.evaluate(() => window.__mockDnmsDb.rooms.filter((room) => room.name.startsWith("Culto Multiplo ")).length)
    )
    .toBe(16);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(new Set(window.__mockDnmsDb.rooms
          .filter((room) => room.name.startsWith("Culto Multiplo "))
          .map((room) => room.class_target)))
          .sort()
      )
    )
    .toEqual(["Maternal", "Teens"]);
  await expect
    .poll(() => page.evaluate((name) => window.__mockDnmsDb.rooms.some((room) => room.name === name), `Culto Multiplo ${firstDateLabel}`))
    .toBe(true);
});

test("evento sem nome usa a data da sala como nome", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();

  const date = futureIso(2);
  await page.fill("#roomName", "");
  await page.fill("#roomDate", date);
  await page.fill("#roomStartTime", "10:00");
  await page.fill("#roomEndTime", "11:00");
  await page.locator('#roomClass input[value="Kids"]').check();
  await page.click("#btnCreateRoom");

  await expect
    .poll(() => page.evaluate((name) => window.__mockDnmsDb.rooms.some((room) => room.name === name), shortDateLabel(date)))
    .toBe(true);
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
  await expect(page.locator("#btnBulkCloseRooms")).toHaveText("Fechar selecionadas");
  await expect(page.locator("#btnBulkDeleteRooms")).toHaveText("Excluir");
  await expect(page.locator("#btnBulkEditRooms")).toBeDisabled();
  await expect(page.locator("#btnBulkCloseRooms")).toBeDisabled();

  await page.locator("#selectAllRooms").check();
  await expect(page.locator('input[data-select-room="room-bulk-kids"]')).toBeChecked();
  await expect(page.locator('input[data-select-room="room-bulk-juniors"]')).toBeChecked();
  await expect(page.locator('input[data-select-room="room-bulk-future"]')).toBeChecked();
  await expect(page.locator('input[data-select-room="room-bulk-future"]')).toBeEnabled();
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
  await expect(page.locator("#selectAllRooms")).toBeEnabled();
  await expect(page.locator('input[data-select-room="room-bulk-kids"]')).toBeEnabled();
  await expect(page.locator('input[data-select-room="room-bulk-juniors"]')).toBeEnabled();
});

test("fechar selecionadas faz checkout automatico das salas abertas", async ({ page }) => {
  await openApp(page);
  await page.evaluate((today) => {
    window.__mockDnmsDb.rooms.push({
      id: "room-bulk-close-juniors",
      name: "Culto Bulk Fechar Juniors",
      date: today,
      start_time: "00:00",
      end_time: "23:59",
      class_target: "Juniors",
      status: "Aberta",
      opened_at: new Date().toISOString(),
      closed_at: null
    });
    window.__mockDnmsDb.checkins.push(
      {
        id: "checkin-bulk-close-kids",
        student_id: "student-kids",
        room_id: "room-kids",
        room_name_snapshot: "Culto Kids",
        class_name: "Kids",
        actor_id: "admin-1",
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      },
      {
        id: "checkin-bulk-close-juniors",
        student_id: "student-juniors",
        room_id: "room-bulk-close-juniors",
        room_name_snapshot: "Culto Bulk Fechar Juniors",
        class_name: "Juniors",
        actor_id: "admin-1",
        checked_in_at: new Date().toISOString(),
        checked_out_at: null
      }
    );
  }, todayIso());

  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await page.locator('input[data-select-room="room-kids"]').check();
  await page.locator('input[data-select-room="room-bulk-close-juniors"]').check();
  await expect(page.locator("#btnBulkCloseRooms")).toBeEnabled();

  await page.locator("#btnBulkCloseRooms").click();

  await expect
    .poll(() => page.evaluate(() => window.confirmMessages || []))
    .toContain("Fechar 2 sala(s) selecionada(s)?");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-kids")?.status))
    .toBe("Fechada");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-bulk-close-juniors")?.status))
    .toBe("Fechada");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.id === "checkin-bulk-close-kids")?.checked_out_at))
    .not.toBeNull();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.id === "checkin-bulk-close-juniors")?.checked_out_at))
    .not.toBeNull();
});

test("dialog de sala fecha automaticamente apos abrir sala", async ({ page }) => {
  await openApp(page);
  await page.evaluate((today) => {
    window.__mockDnmsDb.rooms.push({
      id: "room-dialog-open",
      name: "Culto Dialog",
      date: today,
      start_time: "00:00",
      end_time: "23:59",
      class_target: "Kids",
      status: "Programada",
      opened_at: null,
      closed_at: null
    });
  }, todayIso());

  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await page.locator("#roomList .list-item").filter({ hasText: "Culto Dialog" }).click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();

  await page.locator("#btnRoomDialogOpen").click();

  await expect(page.locator("#roomDetailsDialog")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-dialog-open")?.status))
    .toBe("Aberta");
});

test("dialog de sala fecha automaticamente apos fechar sala", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();
  await page.locator("#roomList .list-item").filter({ hasText: "Culto Kids" }).click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();

  await page.locator("#btnRoomDialogClose").click();

  await expect(page.locator("#roomDetailsDialog")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((room) => room.id === "room-kids")?.status))
    .toBe("Fechada");
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

test("gestao nao exibe gerador antigo de convites por tipo de acesso", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");

  await page.click("#btnInvitePanel");
  await expect(page.locator("#inviteCard")).toBeVisible();
  await expect(page.locator("#presenceQrCard")).toContainText("QR de check-in presencial");
  await expect(page.locator("#presenceQrCard")).not.toHaveAttribute("open", "");
  await expect(page.locator("#btnPrintPresenceQr")).toBeHidden();
  await page.locator("#presenceQrCard summary").click();
  await expect(page.locator("#presenceQrCard img")).toHaveAttribute("src", "qr-checkin-presencial.svg");
  await expect(page.locator("#btnPrintPresenceQr")).toBeVisible();
  await expect(page.locator("#inviteCard")).not.toContainText("Convites");
  await expect(page.locator("#inviteCard")).not.toContainText("Tipo de acesso");
  await expect(page.locator("#manageInviteEmail")).toHaveCount(0);
  await expect(page.locator("#btnGenerateInviteLink")).toHaveCount(0);
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

test("familias mostra rede familiar e criancas compartilhadas da familia", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.profiles.find((item) => item.id === "parent-2").family_id = "parent-1";
    window.__mockDnmsDb.students.push({
      id: "student-secondary-family",
      name: "Filho Secundario",
      birth_date: "2020-06-20",
      class_name: "Kids",
      primary_guardian_name: "Responsavel Secundario",
      phone: "11955550000",
      address: "Rua Secundaria",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
    window.__mockDnmsDb.student_guardians.push({
      student_id: "student-secondary-family",
      guardian_id: "parent-2"
    });
  });
  await loginAs(page, "admin@dnms.test");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel Teste");

  await expect(page.locator("#familyEditor")).toContainText("Rede familiar");
  await expect(page.locator("#familyEditor")).toContainText("Responsavel Teste (selecionado)");
  await expect(page.locator("#familyEditor")).toContainText("Responsavel Secundario");
  await expect(page.locator("#familyEditor")).toContainText("Criancas da familia");
  await expect(page.locator("#familyEditor")).toContainText("Ana Kids");
  await expect(page.locator("#familyEditor")).toContainText("Filho Secundario");
  await expect(page.locator("#familyEditor")).toContainText("Responsavel principal: Responsavel Secundario");
});

test("admin adiciona e remove responsavel da rede familiar pela aba familias", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.students.push({
      id: "student-secondary-family",
      name: "Filho Secundario",
      birth_date: "2020-06-20",
      class_name: "Kids",
      primary_guardian_name: "Responsavel Secundario",
      phone: "11955550000",
      address: "Rua Secundaria",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
    window.__mockDnmsDb.student_guardians.push({
      student_id: "student-secondary-family",
      guardian_id: "parent-2"
    });
  });
  await loginAs(page, "admin@dnms.test");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel Teste");
  await page.fill("#familyNetworkAddEmail", "secundario@dnms.test");
  await page.click("#btnFamilyNetworkAddResponsible");

  await expect(page.locator("#familyEditor")).toContainText("Responsavel Secundario");
  await expect(page.locator("#familyEditor")).toContainText("Filho Secundario");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        secondaryFamily: window.__mockDnmsDb.profiles.find((item) => item.id === "parent-2")?.family_id,
        secondaryChildLinks: window.__mockDnmsDb.student_guardians
          .filter((item) => item.student_id === "student-secondary-family")
          .map((item) => item.guardian_id)
          .sort()
      }))
    )
    .toEqual({
      secondaryFamily: "parent-1",
      secondaryChildLinks: ["parent-1", "parent-2"]
    });

  await page.getByRole("button", { name: "Remover da rede" }).click();

  await expect(page.locator("#familyEditor .family-children-list")).not.toContainText("Filho Secundario");
  await expect
    .poll(() =>
      page.evaluate(() => ({
        secondaryFamily: window.__mockDnmsDb.profiles.find((item) => item.id === "parent-2")?.family_id,
        anaLinks: window.__mockDnmsDb.student_guardians
          .filter((item) => item.student_id === "student-kids")
          .map((item) => item.guardian_id)
          .sort(),
        secondaryChildLinks: window.__mockDnmsDb.student_guardians
          .filter((item) => item.student_id === "student-secondary-family")
          .map((item) => item.guardian_id)
          .sort()
      }))
    )
    .toEqual({
      secondaryFamily: "parent-2",
      anaLinks: ["parent-1"],
      secondaryChildLinks: ["parent-2"]
    });
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
  await expect(page.locator("#logSelectedStudentsSummary")).toBeEmpty();
  await expect(page.locator("#logSummary")).toContainText("Frequencia");
  await expect(page.locator("#logSummary")).toContainText("1 crianca(s) com presenca. 1 check-in(s).");
  await expect(page.locator("#logSummary")).not.toContainText("Total geral");
  await expect(page.locator("#logCounts")).toContainText("Kids: 1 check-in(s)");
  const kidsGroup = page.locator(".attendance-class-group").filter({ hasText: "Kids" });
  await expect(kidsGroup.locator("summary")).toContainText("1 crianca(s) | 1 check-in(s)");
  await expect(kidsGroup.getByText("Ana Kids")).not.toBeVisible();
  await kidsGroup.locator("summary").click();
  await expect(kidsGroup.getByText("Ana Kids")).toBeVisible();
  await expect(page.locator("#btnExport")).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.click("#btnExport");
  const download = await downloadPromise;
  const filePath = await download.path();
  const buffer = fs.readFileSync(filePath);
  const csv = buffer.toString("utf8");
  expect(csv).toContain("Secao;Nome;Total;Criancas;Ativos;Check-outs;Pendentes de impressao");
  expect(csv).toContain("Resumo;Geral;1;1;1;0;1");
  expect(csv).toContain("Aluno;Turma;Presencas;Horarios de check-in");
  expect(csv).toContain("Ana Kids;Kids;1;");

  await page.evaluate(() => {
    window.__lastOpenedUrl = "";
    window.open = (url) => {
      window.__lastOpenedUrl = String(url);
      return null;
    };
  });
  await page.click("#btnShareWhatsapp");
  const whatsappText = await page.evaluate(() => decodeURIComponent(new URL(window.__lastOpenedUrl).searchParams.get("text") || ""));
  expect(whatsappText).toContain("Resumo do evento");
  expect(whatsappText).toContain("Total geral: 1 check-in(s), 1 crianca(s), 1 ativo(s), 0 checkout(s), Impressao pendente: 1");
  expect(whatsappText).toContain("Frequencia detalhada");
  expect(whatsappText).toContain("Ana Kids | Kids |");
});

test("log gera resumo do evento com pendencias de impressao e exporta csv", async ({ page }) => {
  await openApp(page);
  await page.evaluate((today) => {
    window.__mockDnmsDb.checkins.push(
      {
        id: "checkin-summary-active-pending",
        student_id: "student-kids",
        room_id: "room-kids",
        room_name_snapshot: "Culto Kids",
        class_name: "Kids",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${today}T10:00:00.000Z`,
        checked_out_at: null,
        printed_at: null
      },
      {
        id: "checkin-summary-checked-out",
        student_id: "student-juniors",
        room_id: "room-juniors",
        room_name_snapshot: "Culto Juniors",
        class_name: "Juniors",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${today}T10:05:00.000Z`,
        checked_out_at: `${today}T11:00:00.000Z`,
        printed_at: `${today}T10:06:00.000Z`
      }
    );
  }, todayIso());
  await loginAs(page, "admin@dnms.test");

  await expect(page.locator("#dashboardEventSummary")).toContainText("Total geral: 2");
  await expect(page.locator("#dashboardEventSummary")).toContainText("Impressao pendente: 1");

  await page.click("#btnLogPanel");
  await page.selectOption("#logReportType", "event_summary");
  await expect(page.locator("#logSummary")).toContainText("Resumo do evento: Total geral: 2 check-in(s), 2 crianca(s), 1 ativo(s), 1 checkout(s), Impressao pendente: 1.");
  await expect(page.locator("#logCounts")).toContainText("Kids: 1 check-in(s), 1 ativo(s), 0 checkout(s), 1 pendente(s) de impressao");
  await expect(page.locator("#logList")).toContainText("Por turma");
  await expect(page.locator("#logList")).toContainText("Culto Juniors");
  await expect(page.locator("#btnShareWhatsapp")).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.click("#btnExport");
  const download = await downloadPromise;
  const filePath = await download.path();
  const buffer = fs.readFileSync(filePath);
  const csv = buffer.toString("utf8");

  expect(Array.from(buffer.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  expect(csv).toContain("Secao;Nome;Total;Criancas;Ativos;Check-outs;Pendentes de impressao");
  expect(csv).toContain("Resumo;Geral;2;2;1;1;1");
  expect(csv).toContain("Turma;Kids;1;;1;0;1");
  expect(csv).toContain("Sala;Culto Juniors;1;;0;1;0");

  await page.evaluate(() => {
    window.__lastOpenedUrl = "";
    window.open = (url) => {
      window.__lastOpenedUrl = String(url);
      return null;
    };
  });
  await page.click("#btnShareWhatsapp");
  const whatsappText = await page.evaluate(() => decodeURIComponent(new URL(window.__lastOpenedUrl).searchParams.get("text") || ""));
  expect(whatsappText).toContain(`Resumo do evento (${todayIso()})`);
  expect(whatsappText).toContain("Total geral: 2 check-in(s), 2 crianca(s), 1 ativo(s), 1 checkout(s), Impressao pendente: 1");
  expect(whatsappText).toContain("Por turma:");
  expect(whatsappText).toContain("- Kids: 1 check-in(s), 1 ativo(s), 0 checkout(s), 1 pendente(s) de impressao");
  expect(whatsappText).toContain("- Culto Juniors: 1 check-in(s), 0 ativo(s), 1 checkout(s), 0 pendente(s) de impressao");
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

test("sadmin reenvia email de acesso para responsavel cadastrado", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel Teste");
  await expect(page.locator("#familyList")).toContainText("Responsavel Teste");
  await expect(page.locator("#btnFamilyResendAccess")).toBeVisible();
  await page.click("#btnFamilyResendAccess");

  await expect
    .poll(() => page.evaluate(() => window.__lastPasswordResetEmail || ""))
    .toBe("responsavel@dnms.test");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.audit_logs.some((item) => item.action_type === "user_access_resent")))
    .toBe(true);
  const alerts = await getAlerts(page);
  expect(alerts).toContain("Email de acesso reenviado para responsavel@dnms.test.");
});

test("sadmin cadastra responsavel e envia email de primeiro acesso", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");
  await openFamiliesPanel(page);

  await page.locator("#familyCreatePanel summary").click();
  await page.fill("#familyCreateName", "novo responsavel");
  await page.fill("#familyCreateBirth", "12/05/1988");
  await page.selectOption("#familyCreateCivil", "casado");
  await page.fill("#familyCreatePhone", "11933334444");
  await page.fill("#familyCreateEmail", "novo.responsavel@dnms.test");
  await page.fill("#familyCreateAddress", "Rua Primeiro Acesso");
  await page.click("#btnFamilyCreateResponsible");

  await expect(page.locator("#familyCreateStatus")).toContainText(
    "Responsavel Novo Responsavel cadastrado. Email enviado para definir senha no primeiro acesso."
  );
  await expect
    .poll(() => page.evaluate(() => window.__lastSignupEmail || ""))
    .toBe("novo.responsavel@dnms.test");
  await expect
    .poll(() => page.evaluate(() => window.__lastPasswordResetEmail || ""))
    .toBe("novo.responsavel@dnms.test");
  await expect
    .poll(() => page.evaluate(() => window.__lastPasswordResetRedirectTo || ""))
    .toContain("password_recovery=1");
  const created = await page.evaluate(() => {
    const profile = window.__mockDnmsDb.profiles.find((item) => item.email === "novo.responsavel@dnms.test");
    const authUser = window.__mockDnmsDb.auth_users.find((item) => item.email === "novo.responsavel@dnms.test");
    return { profile, authUser, signupMetadata: window.__lastSignupMetadata };
  });
  expect(created.profile).toMatchObject({
    name: "Novo Responsavel",
    role: "responsavel",
    email: "novo.responsavel@dnms.test",
    birth_date: "1988-05-12",
    marital_status: "casado",
    phone: "+55 (11) 93333-4444",
    address: "Rua Primeiro Acesso"
  });
  expect(created.authUser?.id).toBe(created.profile?.id);
  expect(created.signupMetadata).toMatchObject({
    full_name: "Novo Responsavel",
    desired_role: "responsavel",
    birth_date: "1988-05-12",
    marital_status: "casado",
    phone: "+55 (11) 93333-4444"
  });
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

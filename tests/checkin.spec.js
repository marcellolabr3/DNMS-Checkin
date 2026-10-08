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

function birthInputYearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" })).toBeEnabled();
  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();
  await expect.poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.filter((item) => item.student_id === "student-kids").length)).toBe(2);
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.filter((item) => item.student_id === "student-kids" && item.checked_out_at === null).length))
    .toBe(1);
});

test("checkout sem check-in ativo nao fica disponivel e duplo checkout e bloqueado", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Checkout" })).toHaveCount(0);
  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();
  await studentItem(page, "Ana Kids").getByRole("button", { name: "Checkout" }).click();
  await page.click("#btnConfirmCheckout");
  await expect(page.locator("#checkoutDialog")).toBeHidden();

  await page.evaluate(() => {
    const firstCheckin = window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-kids");
    document.querySelector("#checkoutCheckinId").value = firstCheckin?.id || "";
    document.querySelector("#btnConfirmCheckout").click();
  });
  const alerts = await getAlerts(page);
  expect(alerts).toContain("Checkout nao disponivel.");
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

test("sala aberta fecha automaticamente no horario de termino", async ({ page }) => {
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

  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids")?.status))
    .toBe("Fechada");
  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in indisponivel" })).toBeDisabled();
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

test("turma usa progressao anual sem trocar no aniversario durante o ano", async ({ page }) => {
  const yyyy = new Date().getFullYear();
  await openApp(page);
  await page.evaluate(
    ({ startedAt, endedAt, today, yyyy }) => {
      window.__mockDnmsDb.rooms.push(
        {
          id: "room-maternal-annual-rule",
          name: "Culto Maternal",
          date: today,
          start_time: startedAt,
          end_time: endedAt,
          class_target: "Maternal",
          status: "Aberta",
          opened_at: today + "T09:00:00.000Z",
          closed_at: null
        },
        {
          id: "room-kids-annual-rule",
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
          id: "room-juniors-age-rule",
          name: "Culto Juniors",
          date: today,
          start_time: startedAt,
          end_time: endedAt,
          class_target: "Juniors",
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
          id: "student-annual-maternal",
          name: "Ciclo Maternal",
          birth_date: `${yyyy - 4}-12-31`,
          class_name: "Maternal",
          primary_guardian_name: "Responsavel Teste",
          phone: "11988880000",
          address: "Rua Familia",
          notes: "",
          is_visitor: false,
          photo_url: ""
        },
        {
          id: "student-annual-kids",
          name: "Ciclo Kids",
          birth_date: `${yyyy - 7}-12-31`,
          class_name: "Kids",
          primary_guardian_name: "Responsavel Teste",
          phone: "11988880000",
          address: "Rua Familia",
          notes: "",
          is_visitor: false,
          photo_url: ""
        },
        {
          id: "student-annual-juniors",
          name: "Ciclo Juniors",
          birth_date: `${yyyy - 11}-12-31`,
          class_name: "Juniors",
          primary_guardian_name: "Responsavel Teste",
          phone: "11988880000",
          address: "Rua Familia",
          notes: "",
          is_visitor: false,
          photo_url: ""
        },
        {
          id: "student-annual-teens",
          name: "Ciclo Teens",
          birth_date: `${yyyy - 15}-12-31`,
          class_name: "Teens",
          primary_guardian_name: "Responsavel Teste",
          phone: "11988880000",
          address: "Rua Familia",
          notes: "",
          is_visitor: false,
          photo_url: ""
        },
        {
          id: "student-out-of-range",
          name: "Ciclo Fora",
          birth_date: `${yyyy - 16}-01-01`,
          class_name: "Fora da faixa",
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
      startedAt: timeOffset(-10),
      endedAt: timeOffset(50),
      today: todayIso(),
      yyyy
    }
  );

  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await expect(studentItem(page, "Ciclo Maternal")).toContainText("Turma: Maternal");
  await expect(studentItem(page, "Ciclo Kids")).toContainText("Turma: Kids");
  await expect(studentItem(page, "Ciclo Juniors")).toContainText("Turma: Juniors");
  await expect(studentItem(page, "Ciclo Teens")).toContainText("Turma: Teens");
  await expect(studentItem(page, "Ciclo Fora")).toContainText("Turma: Fora da faixa");
  await expect(studentItem(page, "Ciclo Fora").getByRole("button", { name: "Fora da faixa" })).toBeDisabled();

  await studentItem(page, "Ciclo Maternal").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-annual-maternal")?.class_name))
    .toBe("Maternal");
  await studentItem(page, "Ciclo Kids").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-annual-kids")?.class_name))
    .toBe("Kids");
  await studentItem(page, "Ciclo Juniors").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-annual-juniors")?.class_name))
    .toBe("Juniors");
  await studentItem(page, "Ciclo Teens").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-annual-teens")?.class_name))
    .toBe("Teens");
  const classesAroundBirthday = await page.evaluate(() => ({
    beforeBirthday: getClassForBirth(`${new Date().getFullYear() - 7}-12-31`, new Date(`${new Date().getFullYear()}-12-30T12:00:00`)),
    birthday: getClassForBirth(`${new Date().getFullYear() - 7}-12-31`, new Date(`${new Date().getFullYear()}-12-31T12:00:00`)),
    nextYear: getClassForBirth(`${new Date().getFullYear() - 7}-12-31`, new Date(`${new Date().getFullYear() + 1}-01-01T12:00:00`))
  }));
  expect(classesAroundBirthday).toEqual({
    beforeBirthday: "Kids",
    birthday: "Kids",
    nextYear: "Juniors"
  });
});

test("sadmin altera turma oficial sem apagar classificacao automatica", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentAutomaticClass")).toHaveValue("Kids");
  await page.selectOption("#studentOfficialClass", "Teens");
  await page.click("#btnSaveStudent");

  await expect(studentItem(page, "Ana Kids")).toContainText("Turma: Teens");
  await expect(studentItem(page, "Ana Kids")).toContainText("Classificação automática: Kids");
  await expect(studentItem(page, "Ana Kids")).toContainText("Turma oficial: Teens");
  const stored = await page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids"));
  expect(stored.class_name).toBe("Kids");
  expect(stored.official_class_name).toBe("Teens");
});

test("alocacao temporaria define sala efetiva sem alterar turma oficial", async ({ page }) => {
  await openApp(page);
  await page.evaluate(
    ({ today, startedAt, endedAt }) => {
      window.__mockDnmsDb.rooms.push({
        id: "room-maternal-temporary",
        name: "Culto Maternal",
        date: today,
        start_time: startedAt,
        end_time: endedAt,
        class_target: "Maternal",
        status: "Aberta",
        opened_at: today + "T09:00:00.000Z",
        closed_at: null,
        is_test: false,
        max_checkins: null
      });
      window.__mockDnmsDb.students.find((item) => item.id === "student-juniors").official_class_name = "Juniors";
    },
    { today: todayIso(), startedAt: timeOffset(-10), endedAt: timeOffset(50) }
  );
  await loginAs(page, "marvinlabre@gmail.com");
  await openFamiliesPanel(page);
  await page.locator("#temporaryAssignmentPanel summary").click();
  await page.selectOption("#temporaryAssignmentStudent", "student-juniors");
  await page.selectOption("#temporaryAssignmentRoom", "room-maternal-temporary");
  await page.fill("#temporaryAssignmentReason", "ficara nesta sala excepcionalmente");
  await page.click("#btnCreateTemporaryAssignment");

  await openStudentsPanel(page);
  await expect(studentItem(page, "Bia Juniors")).toContainText("Turma: Maternal");
  await studentItem(page, "Bia Juniors").getByRole("button", { name: "Check-in" }).click();
  const result = await page.evaluate(() => ({
    student: window.__mockDnmsDb.students.find((item) => item.id === "student-juniors"),
    checkin: window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-juniors")
  }));
  expect(result.student.official_class_name).toBe("Juniors");
  expect(result.checkin.room_id).toBe("room-maternal-temporary");
  expect(result.checkin.class_name).toBe("Maternal");
});

test("crianca fora da faixa participa quando possui alocacao temporaria", async ({ page }) => {
  await openApp(page);
  await page.evaluate(
    ({ today, startedAt, endedAt }) => {
      window.__mockDnmsDb.rooms.push({
        id: "room-maternal-out-of-range",
        name: "Culto Maternal",
        date: today,
        start_time: startedAt,
        end_time: endedAt,
        class_target: "Maternal",
        status: "Aberta",
        opened_at: today + "T09:00:00.000Z",
        closed_at: null,
        is_test: false,
        max_checkins: null
      });
      window.__mockDnmsDb.students.push({
        id: "student-out-of-range-temporary",
        name: "Joao Fora",
        birth_date: "2009-01-10",
        class_name: "Fora da faixa",
        official_class_name: "Fora da faixa",
        primary_guardian_name: "Responsavel Teste",
        phone: "11988880000",
        address: "Rua Familia",
        notes: "",
        is_visitor: false,
        photo_url: ""
      });
    },
    { today: todayIso(), startedAt: timeOffset(-10), endedAt: timeOffset(50) }
  );
  await loginAs(page, "marvinlabre@gmail.com");
  await openFamiliesPanel(page);
  await page.locator("#temporaryAssignmentPanel summary").click();
  await page.selectOption("#temporaryAssignmentStudent", "student-out-of-range-temporary");
  await page.selectOption("#temporaryAssignmentRoom", "room-maternal-out-of-range");
  await page.click("#btnCreateTemporaryAssignment");

  await openStudentsPanel(page);
  await expect(studentItem(page, "Joao Fora")).toContainText("Turma: Maternal");
  await studentItem(page, "Joao Fora").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.student_id === "student-out-of-range-temporary")?.class_name))
    .toBe("Maternal");
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

test("sala aberta de hoje fecha automaticamente apos horario de termino", async ({ page }) => {
  await openApp(page);
  await page.evaluate(
    ({ todayDate, startTime, endTime }) => {
      const room = window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids");
      room.date = todayDate;
      room.start_time = startTime;
      room.time = startTime;
      room.end_time = endTime;
      room.status = "Aberta";
      room.closed_at = null;
      window.__mockDnmsDb.checkins.push({
        id: "checkin-today-expired-active",
        student_id: "student-kids",
        room_id: room.id,
        room_name_snapshot: room.name,
        class_name: "Kids",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${todayDate}T12:00:00.000Z`,
        checked_out_at: null
      });
    },
    { todayDate: todayIso(), startTime: timeOffset(-90), endTime: timeOffset(-1) }
  );

  await loginAs(page, "admin@dnms.test");

  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids")?.status))
    .toBe("Fechada");
  await expect
    .poll(() =>
      page.evaluate(() => window.__mockDnmsDb.checkins.find((item) => item.id === "checkin-today-expired-active")?.checked_out_at)
    )
    .not.toBeNull();
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

test("alteracao da data de nascimento reclassifica a turma", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentBirth", "20/01/2015");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  await expect(studentItem(page, "Ana Kids")).toContainText("Turma: Juniors");
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.id === "student-kids")?.class_name))
    .toBe("Juniors");
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
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__mockDnmsDb.rooms
          .filter((room) => room.name.startsWith("Culto Multiplo "))
          .every((room) => room.status === "Programada" && !room.opened_at)
      )
    )
    .toBe(true);
});

test("evento criado para hoje permanece programado ate abertura manual", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();

  await page.fill("#roomName", "Culto Manual");
  await page.fill("#roomDate", todayIso());
  await page.fill("#roomStartTime", "00:00");
  await page.fill("#roomEndTime", "23:59");
  await page.fill("#roomMaxCheckins", "12");
  await page.locator('#roomClass input[value="Kids"]').check();
  await page.click("#btnCreateRoom");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const room = window.__mockDnmsDb.rooms.find((item) => item.name.startsWith("Culto Manual "));
        return room ? { status: room.status, openedAt: room.opened_at || null, maxCheckins: room.max_checkins } : null;
      })
    )
    .toEqual({ status: "Programada", openedAt: null, maxCheckins: 12 });
});

test("limite de check-ins da sala bloqueia novas entradas", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const room = window.__mockDnmsDb.rooms.find((item) => item.id === "room-kids");
    room.max_checkins = 1;
    window.__mockDnmsDb.students.push({
      id: "student-kids-limit",
      name: "Caio Kids",
      birth_date: window.__mockDnmsDb.students.find((item) => item.id === "student-kids").birth_date,
      class_name: "Kids",
      primary_guardian_name: "Responsavel Teste",
      phone: "11988880000",
      address: "Rua Familia",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
  });
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.filter((item) => item.room_id === "room-kids").length))
    .toBe(1);

  await studentItem(page, "Caio Kids").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.filter((item) => item.room_id === "room-kids").length))
    .toBe(1);
  const alerts = await getAlerts(page);
  expect(alerts).toContain("Limite de check-ins atingido para esta sala.");
});

test("sala criada hoje abre manualmente, permanece visivel e libera check-in", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();

  await page.fill("#roomName", "Culto Visivel");
  await page.fill("#roomDate", todayIso());
  await page.fill("#roomStartTime", "00:00");
  await page.fill("#roomEndTime", "23:59");
  await page.locator('#roomClass input[value="Kids"]').check();
  await page.click("#btnCreateRoom");

  const roomItem = page.locator("#roomList .list-item").filter({ hasText: "Culto Visivel" });
  await expect(roomItem).toContainText("Status: Programada");
  await roomItem.click();
  await expect(page.locator("#roomDetailsDialog")).toBeVisible();
  await page.click("#btnRoomDialogOpen");
  await expect(page.locator("#roomDetailsDialog")).toBeHidden();
  await expect(roomItem).toContainText("Status: Aberta");

  await openStudentsPanel(page);
  await expect(studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" })).toBeEnabled();
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

test("crianca entra no Maternal a partir do aniversario de 2 anos", async ({ page }) => {
  const today = new Date();
  const birthYear = today.getFullYear() - 2;
  const birthDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${birthYear}`;
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "Bebe Maternal");
  await page.fill("#studentBirth", birthDate);
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11999990000");
  await page.fill("#studentAddress", "Rua Maternal");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  await expect(studentItem(page, "Bebe Maternal")).toContainText("Turma: Maternal");
  await expect
    .poll(() =>
      page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.name === "Bebe Maternal")?.class_name)
    )
    .toBe("Maternal");
});

test("crianca que ainda nao completou 2 anos fica fora da faixa ate o aniversario", async ({ page }) => {
  const birthYear = new Date().getFullYear() - 2;
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "Bebe Antes Aniversario");
  await page.fill("#studentBirth", `31/12/${birthYear}`);
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11999990000");
  await page.fill("#studentAddress", "Rua Antes Aniversario");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  await expect(studentItem(page, "Bebe Antes Aniversario")).toContainText("Turma: Fora da faixa");
  await expect(studentItem(page, "Bebe Antes Aniversario").getByRole("button", { name: "Fora da faixa" })).toBeDisabled();
  const onBirthdayClass = await page.evaluate(() => getClassForBirth(`${new Date().getFullYear() - 2}-12-31`, new Date(`${new Date().getFullYear()}-12-31T12:00:00`)));
  expect(onBirthdayClass).toBe("Maternal");
});

test("cadastro de crianca aceita nascimento com ano de dois digitos", async ({ page }) => {
  const shortYear = String((new Date().getFullYear() - 2) % 100).padStart(2, "0");
  const fullYear = String(new Date().getFullYear() - 2);

  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await page.locator("#btnAddStudent").click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentName", "Bebe Ano Curto");
  await page.fill("#studentBirth", `15/05/${shortYear}`);
  await page.fill("#studentGuardian", "Responsavel Teste");
  await page.fill("#studentPhone", "11999990000");
  await page.fill("#studentAddress", "Rua Ano Curto");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  await expect(studentItem(page, "Bebe Ano Curto")).toContainText("Turma: Maternal");
  const saved = await page.evaluate(() => window.__mockDnmsDb.students.find((item) => item.name === "Bebe Ano Curto"));
  expect(saved.birth_date).toBe(`${fullYear}-05-15`);
  expect(saved.class_name).toBe("Maternal");
});

test("turma defasada no banco e recalculada pelo nascimento", async ({ page }) => {
  await openApp(page);
  await page.evaluate((birthDate) => {
    window.__mockDnmsDb.students.push({
      id: "student-stale-maternal",
      name: "Bebe Defasado",
      birth_date: birthDate,
      class_name: "Fora da faixa",
      primary_guardian_name: "Responsavel Teste",
      phone: "11999990000",
      address: "Rua Maternal",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
    window.__mockDnmsDb.student_guardians.push({
      student_id: "student-stale-maternal",
      guardian_id: "parent-1"
    });
  }, `${new Date().getFullYear() - 2}-03-31`);

  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await expect(studentItem(page, "Bebe Defasado")).toContainText("Turma: Maternal");
});

test("salas passadas ficam no historico ocultavel por ate 16 dias", async ({ page }) => {
  await openApp(page);
  await page.evaluate(({ past, oldPast, futureA, futureB }) => {
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
        id: "room-too-old",
        name: "Evento Antigo Fora Do Historico",
        date: oldPast,
        start_time: "10:00",
        end_time: "11:00",
        class_target: "Kids",
        status: "Fechada",
        opened_at: oldPast + "T10:00:00.000Z",
        closed_at: oldPast + "T11:00:00.000Z"
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
  }, { past: pastIso(2), oldPast: pastIso(17), futureA: futureIso(35), futureB: futureIso(70) });

  await loginAs(page, "admin@dnms.test");
  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomCard")).toBeVisible();

  await expect(page.locator("#roomList")).not.toContainText("Evento Vencido Aberto");
  await expect(page.locator("#pastRoomsPanel")).toBeVisible();
  await expect(page.locator("#pastRoomList")).toContainText("Evento Vencido Aberto");
  await expect(page.locator("#pastRoomList")).not.toContainText("Evento Antigo Fora Do Historico");
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

test("familias mantem nome alinhado no resultado da busca", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel");
  const firstItem = page.locator("#familyList .list-item").first();
  await expect(firstItem).toBeVisible();

  const geometry = await firstItem.evaluate((item) => {
    const name = item.querySelector("strong");
    const itemRect = item.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();
    return {
      nameTop: nameRect.top,
      nameBottom: nameRect.bottom,
      itemTop: itemRect.top,
      itemBottom: itemRect.bottom,
      nameHeight: nameRect.height
    };
  });

  expect(geometry.nameTop).toBeGreaterThanOrEqual(geometry.itemTop + 4);
  expect(geometry.nameBottom).toBeLessThanOrEqual(geometry.itemBottom - 4);
  expect(geometry.nameHeight).toBeGreaterThan(14);
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

test("log inclui cadastro de criancas em alteracoes de dados", async ({ page }) => {
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
  await expect(page.locator('#logReportType option[value="child_created"]')).toHaveCount(0);
  await expect(page.locator('#logReportType option[value="user_deleted"]')).toHaveCount(0);
  await page.selectOption("#logReportType", "changes");

  await expect(page.locator("#logSummary")).toContainText("Alteracoes de dados");
  await expect(page.locator("#logList")).toContainText("Relatorio Teste");
  await expect(page.locator("#logList")).toContainText("Crianca cadastrada");
  await expect(page.locator("#btnExport")).toBeEnabled();
});

test("log mostra campos alterados no cadastro da crianca", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Editar" }).click();
  await expect(page.locator("#studentDialog")).toBeVisible();
  await page.fill("#studentPhone", "11912345678");
  await page.fill("#studentAddress", "Rua Alterada");
  await page.click("#btnSaveStudent");
  await expect(page.locator("#studentDialog")).toBeHidden();

  await page.click("#btnLogPanel");
  await page.selectOption("#logReportType", "changes");

  await expect(page.locator("#logList")).toContainText("Cadastro da crianca Ana Kids alterado");
  await expect(page.locator("#logList")).toContainText("Telefone: +55 (11) 98888-0000 -> +55 (11) 91234-5678");
  await expect(page.locator("#logList")).toContainText("Endereco: Rua Familia -> Rua Alterada");
});

test("log mostra campos alterados no cadastro do responsavel", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await openFamiliesPanel(page);

  await page.fill("#familySearch", "Responsavel Teste");
  await page.fill("#familyEditPhone", "11922223333");
  await page.fill("#familyEditAddress", "Rua Responsavel Alterada");
  await page.click("#btnFamilySaveProfile");

  await page.click("#btnLogPanel");
  await page.selectOption("#logReportType", "changes");

  await expect(page.locator("#logList")).toContainText("Dados do usuario Responsavel Teste alterados");
  await expect(page.locator("#logList")).toContainText("Telefone: +55 (11) 98888-0000 -> +55 (11) 92222-3333");
  await expect(page.locator("#logList")).toContainText("Endereco: Rua Familia -> Rua Responsavel Alterada");
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
  await page.selectOption("#logReportType", "changes");

  const downloadPromise = page.waitForEvent("download");
  await page.click("#btnExport");
  const download = await downloadPromise;
  const filePath = await download.path();
  const buffer = fs.readFileSync(filePath);
  const csv = buffer.toString("utf8");

  expect(Array.from(buffer.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  expect(csv).toContain("Data;Relatorio;Acao;Alvo;Autor;Perfil;Detalhes");
  expect(csv).toContain("Alteracoes de dados");
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
  expect(whatsappText).toContain("Total geral: 1 check-in(s), 1 crianca(s)");
  expect(whatsappText).not.toContain("checkout");
  expect(whatsappText).not.toContain("Impressao pendente");
  expect(whatsappText).toContain("Frequencia detalhada");
  expect(whatsappText).toContain("Ana Kids | Kids |");
});

test("admin extrai dados de criancas por turma e envia por WhatsApp", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.students.push({
      id: "student-out-of-range-extract",
      name: "Joao Fora",
      birth_date: "2009-01-10",
      class_name: "Fora da faixa",
      official_class_name: null,
      primary_guardian_name: "Responsavel Fora",
      phone: "11966660000",
      address: "Rua Fora",
      notes: "Acompanhamento",
      is_visitor: false,
      photo_url: ""
    });
  });
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnLogPanel");
  await page.locator("#studentExtractionPanel summary").click();

  await expect(page.locator("#studentExtractionSummary")).toContainText("3 crianca(s)");
  await page.selectOption("#studentExtractionMode", "class");
  await page.selectOption("#studentExtractionClass", "Fora da faixa");
  await expect(page.locator("#studentExtractionSummary")).toContainText("1 crianca(s) na turma Fora da faixa");
  await expect(page.locator("#studentExtractionList")).toContainText("Joao Fora");

  const downloadPromise = page.waitForEvent("download");
  await page.click("#btnExportStudentsData");
  const download = await downloadPromise;
  const filePath = await download.path();
  const csv = fs.readFileSync(filePath).toString("utf8");
  expect(csv).toContain("Nome;Nascimento;Turma efetiva;Classificacao automatica;Turma oficial");
  expect(csv).toContain("Joao Fora;10/01/2009;Fora da faixa;Fora da faixa;;Responsavel Fora;");
  expect(csv).toContain("Rua Fora;Acompanhamento");

  await page.evaluate(() => {
    window.__lastOpenedUrl = "";
    window.open = (url) => {
      window.__lastOpenedUrl = String(url);
      return null;
    };
  });
  await page.click("#btnShareStudentsWhatsapp");
  const whatsappText = await page.evaluate(() => decodeURIComponent(new URL(window.__lastOpenedUrl).searchParams.get("text") || ""));
  expect(whatsappText).toContain("Extracao de criancas - turma Fora da faixa");
  expect(whatsappText).toContain("Total: 1");
  expect(whatsappText).toContain("Joao Fora | Fora da faixa | Responsavel Fora |");
});

test("sadmin extrai criancas selecionadas usando busca por endereco do cadastro", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.students.push({
      id: "student-selected-extract",
      name: "Lia Selecao",
      birth_date: "2018-05-10",
      class_name: "Kids",
      official_class_name: null,
      primary_guardian_name: "Responsavel Selecao",
      phone: "11977770000",
      address: "Rua Codigo Unico Extracao",
      notes: "",
      is_visitor: false,
      photo_url: ""
    });
  });
  await loginAs(page, "marvinlabre@gmail.com");
  await page.click("#btnLogPanel");
  await page.locator("#studentExtractionPanel summary").click();
  await page.selectOption("#studentExtractionMode", "selected");
  await page.fill("#studentExtractionSearch", "Codigo Unico Extracao");
  await expect(page.locator("#studentExtractionList")).toContainText("Lia Selecao");
  await page.click('input[data-student-extraction-id="student-selected-extract"]');
  await expect(page.locator("#studentExtractionSummary")).toContainText("1 de 1 crianca(s) selecionada(s)");
});

test("log de frequencia mostra presenca atual pelo ultimo estado da crianca", async ({ page }) => {
  await openApp(page);
  await page.evaluate((today) => {
    window.__mockDnmsDb.checkins.push(
      {
        id: "checkin-current-closed",
        student_id: "student-kids",
        room_id: "room-kids",
        room_name_snapshot: "Culto Kids",
        class_name: "Kids",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${today}T12:00:00.000Z`,
        checked_out_at: `${today}T12:20:00.000Z`,
        printed_at: `${today}T12:01:00.000Z`
      },
      {
        id: "checkin-current-duplicate-active",
        student_id: "student-kids",
        room_id: "room-kids",
        room_name_snapshot: "Culto Kids",
        class_name: "Kids",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${today}T12:30:00.000Z`,
        checked_out_at: null,
        printed_at: `${today}T12:31:00.000Z`
      },
      {
        id: "checkin-current-active",
        student_id: "student-kids",
        room_id: "room-kids",
        room_name_snapshot: "Culto Kids",
        class_name: "Kids",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${today}T12:40:00.000Z`,
        checked_out_at: null,
        printed_at: null
      },
      {
        id: "checkin-current-absent",
        student_id: "student-juniors",
        room_id: "room-juniors",
        room_name_snapshot: "Culto Juniors",
        class_name: "Juniors",
        actor_id: "admin-1",
        notes_snapshot: "",
        checked_in_at: `${today}T12:10:00.000Z`,
        checked_out_at: `${today}T12:25:00.000Z`,
        printed_at: `${today}T12:11:00.000Z`
      }
    );
  }, todayIso());

  await loginAs(page, "admin@dnms.test");
  await page.click("#btnLogPanel");

  await expect(page.locator("#logSummary")).toContainText("1 crianca(s) com presenca. 1 check-in(s).");
  await expect(page.locator("#logCounts")).toContainText("Kids: 1 check-in(s)");
  await expect(page.locator("#logList")).toContainText("Ana Kids");
  await expect(page.locator("#logList")).not.toContainText("Bia Juniors");
  const kidsGroup = page.locator(".attendance-class-group").filter({ hasText: "Kids" });
  await kidsGroup.locator("summary").click();
  await expect(kidsGroup.locator(".list-item")).toHaveCount(1);
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
  await expect(page.locator("#dashboardEventSummary")).not.toContainText("Impressao pendente");

  await page.click("#btnLogPanel");
  await page.selectOption("#logReportType", "event_summary");
  await expect(page.locator("#logSummary")).toContainText("Resumo do evento: Total geral: 2 check-in(s), 2 crianca(s).");
  await expect(page.locator("#logCounts")).toContainText("Kids: 1 check-in(s)");
  await expect(page.locator("#logList")).toContainText("Por turma");
  await expect(page.locator("#logList")).toContainText("Culto Juniors");
  await expect(page.locator("#logList")).not.toContainText("Impressao pendente");
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
  expect(whatsappText).toContain("Total geral: 2 check-in(s), 2 crianca(s)");
  expect(whatsappText).toContain("Por turma:");
  expect(whatsappText).toContain("- Kids: 1 check-in(s)");
  expect(whatsappText).toContain("- Culto Juniors: 1 check-in(s)");
  expect(whatsappText).not.toContain("checkout");
  expect(whatsappText).not.toContain("impressao");
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

  await page.click("#btnLogPanel");
  await page.selectOption("#logReportType", "changes");
  await expect(page.locator("#logSummary")).toContainText("Alteracoes de dados");
  await expect(page.locator("#logList")).toContainText("Usuario excluido");
  await expect(page.locator("#logList")).toContainText("Responsavel Teste");
});

test("equipe opera check-in e salas sem editar cadastros", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "equipe@dnms.test");

  await expect(page.locator("#sessionRole")).toContainText("Equipe");
  await page.click("#btnLogPanel");
  await expect(page.locator("#studentExtractionPanel")).toBeHidden();
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

test("sadmin zera check-ins de hoje com confirmacao forte", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");
  await openStudentsPanel(page);

  await studentItem(page, "Ana Kids").getByRole("button", { name: "Check-in" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.length))
    .toBe(1);

  await page.click("#btnHomePanel");
  await expect(page.locator("#btnClearTodayCheckins")).toHaveCount(0);
  await page.click("#btnLogPanel");
  await expect(page.locator("#btnClearTodayCheckinsLog")).toBeVisible();
  await page.click("#btnClearTodayCheckinsLog");

  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.checkins.length))
    .toBe(0);
  const auditState = await page.evaluate(() => ({
    hasClearLog: window.__mockDnmsDb.audit_logs.some((item) => item.action_type === "checkins_cleared"),
    hasCheckinLog: window.__mockDnmsDb.audit_logs.some((item) => item.action_type === "checkin_created")
  }));
  expect(auditState).toEqual({ hasClearLog: true, hasCheckinLog: false });
  const alerts = await getAlerts(page);
  expect(alerts).toContain("Check-ins de hoje zerados: 1.");
});

test("sadmin ve sala teste e zerar check-ins ao navegar direto", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");

  await page.click("#btnLogPanel");
  await expect(page.locator("#btnClearTodayCheckinsLog")).toBeVisible();

  await page.click("#btnRoomsPanel");
  await expect(page.locator("#roomTestField")).toBeVisible();
  await expect(page.locator("#roomIsTest")).toBeVisible();
});

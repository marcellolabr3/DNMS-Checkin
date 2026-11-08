const { test, expect } = require("@playwright/test");
const { openApp, loginAs } = require("./helpers/app");

async function prepareDashboard(page) {
  await openApp(page);
  const today = await page.evaluate(() => formatTodayIso());
  await page.clock.install({time:new Date(`${today}T10:30:00`)});
  await page.evaluate((date) => {
    const db = window.__mockDnmsDb;
    db.rooms.forEach((room) => { room.start_time = "09:00"; room.end_time = "12:00"; });
    db.students[1].is_visitor = true;
    db.students.push(
      {...db.students[0],id:"visitor-today",name:"Carla Visitante",is_visitor:true,notes:" \n\t "},
      {...db.students[0],id:"visitor-absent",name:"Visitante sem check-in",is_visitor:true},
      {...db.students[0],id:"legacy-exited",name:"Registro antigo da sala"},
      {...db.students[0],id:"old-active",name:"Presença de ontem"}
    );
    const stamp = (time) => new Date(`${date}T${time}:00`).toISOString();
    const row = (id, student_id, time, out = null) => ({
      id,student_id,room_id:"room-kids",room_name_snapshot:"Culto Kids",class_name:"Kids",
      checked_in_at:stamp(time),checked_out_at:out ? stamp(out) : null,printed_at:null
    });
    db.checkins.push(
      row("active-ana","student-kids","09:00"),
      row("visitor-first","student-juniors","09:01","09:30"),
      row("visitor-again","student-juniors","09:40","10:00"),
      row("visitor-active","visitor-today","09:05"),
      row("legacy-open","legacy-exited","09:00"),
      row("legacy-latest","legacy-exited","09:30","10:00"),
      {...row("old-open","old-active","09:00"),checked_in_at:new Date(new Date(`${date}T09:00:00`).getTime()-86400000).toISOString()}
    );
  }, today);
}

test("quatro cards abrem listas distintas, sem duplicar visitantes ou contar saídas antigas", async ({page}) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await prepareDashboard(page); await loginAs(page,"admin@dnms.test");
  await expect(page.locator("#dashboardKpis > button")).toHaveCount(4);
  await expect(page.locator("#dashboardKpis .kpi-label")).toHaveText([
    "Presentes agora","Visitantes do dia","Crianças com observação","Salas abertas"
  ]);
  await expect(page.locator("#kpiPresent .kpi-value")).toHaveText("2");
  await expect(page.locator("#kpiVisitors .kpi-value")).toHaveText("2");
  await expect(page.locator("#kpiNotes .kpi-value")).toHaveText("1");

  await page.locator("#kpiPresent").focus(); await page.keyboard.press("Enter");
  await expect(page.locator("#dashboardStudentsDialog")).toBeVisible();
  await expect(page.locator("#dashboardStudentsList > button")).toHaveCount(2);
  await expect(page.locator("#dashboardStudentsList")).toContainText("Ana Kids");
  await expect(page.locator("#dashboardStudentsList")).toContainText("Carla Visitante");
  await expect(page.locator("#dashboardStudentsList")).not.toContainText("Bia Juniors");
  await page.keyboard.press("Escape");
  await expect(page.locator("#kpiPresent")).toBeFocused();

  await page.click("#kpiVisitors");
  await expect(page.locator("#dashboardStudentsList > button")).toHaveCount(2);
  await expect(page.locator("#dashboardStudentsList")).toContainText("Bia Juniors");
  await expect(page.locator("#dashboardStudentsList")).not.toContainText("Ana Kids");
  await expect(page.locator("#dashboardStudentsList")).not.toContainText("Visitante sem check-in");
  await page.getByRole("button",{name:"Fechar lista",exact:true}).click();

  await page.click("#kpiNotes");
  await expect(page.locator("#dashboardStudentsList > button")).toHaveCount(1);
  await expect(page.locator("#dashboardStudentsList")).toContainText("Alergia leve");
  await page.locator("#dashboardStudentsList > button").click();
  await expect(page.locator("#dashboardStudentsDialog")).toBeHidden();
  await expect(page.locator("#studentDetailsDialog")).toBeVisible();
  await expect(page.locator("#studentDetailsTitle")).toHaveText("Ana Kids");
  expect(errors).toEqual([]);
});

test("observações são texto e a lista acompanha mudanças do cadastro e checkout", async ({page}) => {
  await prepareDashboard(page); await loginAs(page,"equipe@dnms.test");
  const note = '<img src=x onerror="window.__injected=true">\nObservação do cadastro';
  await page.evaluate(async (value) => {
    window.__mockDnmsDb.students[0].notes = value;
    await refreshPanelData("dashboard"); render();
  }, note);
  await page.click("#kpiNotes");
  await expect(page.locator(".dashboard-student-note")).toHaveText(note);
  await expect(page.locator("#dashboardStudentsList img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = await page.locator("#dashboardStudentsDialog .dialog-body").boundingBox();
  expect(box.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  await page.evaluate(async () => {
    window.__mockDnmsDb.checkins.find((row) => row.id === "active-ana").checked_out_at = new Date().toISOString();
    await refreshPanelData("dashboard"); render();
  });
  await expect(page.locator("#dashboardStudentsList > button")).toHaveCount(0);
  await expect(page.locator("#dashboardStudentsList")).toContainText("Nenhuma criança presente com observação cadastrada");
  await expect(page.locator("#kpiNotes .kpi-value")).toHaveText("0");
});

test("lista fecha e apaga os dados ao sair e responsáveis não podem abri-la", async ({page}) => {
  await prepareDashboard(page); await loginAs(page,"admin@dnms.test"); await page.click("#kpiNotes");
  await expect(page.locator("#dashboardStudentsList")).toContainText("Alergia leve");
  await page.evaluate(() => handleLogout());
  await expect(page.locator("#dashboardStudentsDialog")).toBeHidden();
  await expect(page.locator("#dashboardStudentsList")).toBeEmpty();
  await loginAs(page,"responsavel@dnms.test");
  await page.evaluate(() => openDashboardStudents("notes"));
  await expect(page.locator("#dashboardStudentsDialog")).toBeHidden();
  await expect(page.locator("#dashboardCard")).toBeHidden();
});

for (const email of ["admin@dnms.test","equipe@dnms.test"]) {
  test(`card de salas aplica filtro e seleção em lote respeita as salas visíveis (${email})`, async ({page}) => {
    await prepareDashboard(page);
    await page.evaluate(() => {
      const db = window.__mockDnmsDb;
      db.rooms.push({...db.rooms[0],id:"scheduled",name:"Sala programada",status:"Programada",opened_at:null});
    });
    await loginAs(page,email); await expect(page.locator("#kpiRooms .kpi-value")).toHaveText("2");
    await page.click("#kpiRooms");
    await expect(page.locator("#roomCard")).toBeVisible();
    await expect(page.locator("#roomStatusFilter")).toHaveValue("open");
    await expect(page.locator("#roomList .list-item")).toHaveCount(2);
    await expect(page.locator("#roomList")).not.toContainText("Sala programada");
    await expect(page.locator("#pastRoomsPanel")).toBeHidden();
    await page.locator("#selectAllRooms").check();
    expect(await page.evaluate(() => [...state.ui.selectedRoomIds].sort())).toEqual(["room-juniors","room-kids"]);
    await page.selectOption("#roomStatusFilter","all");
    await expect(page.locator("#roomList .list-item")).toHaveCount(3);
    await expect(page.locator("#roomList")).toContainText("Sala programada");
  });
}

test("cards vazios mantêm consultas acessíveis e salas permitem limpar o filtro", async ({page}) => {
  await prepareDashboard(page);
  await page.evaluate(() => {
    const db = window.__mockDnmsDb; db.checkins = [];
    db.rooms.forEach((room) => { room.status = "Programada"; room.opened_at = null; });
  });
  await loginAs(page,"admin@dnms.test");
  for (const id of ["kpiPresent","kpiVisitors","kpiNotes"]) {
    await expect(page.locator(`#${id} .kpi-value`)).toHaveText("0");
    await page.click(`#${id}`);
    await expect(page.locator("#dashboardStudentsList > button")).toHaveCount(0);
    await expect(page.locator("#dashboardStudentsList")).toContainText("Nenhum");
    await page.getByRole("button",{name:"Fechar lista",exact:true}).click();
  }
  await page.click("#kpiRooms");
  await expect(page.locator("#roomCurrent")).toHaveText("Nenhuma sala aberta neste momento.");
  await page.selectOption("#roomStatusFilter","all");
  await expect(page.locator("#roomList .list-item")).toHaveCount(2);
});

test("dashboard mostra somente as tres proximas escalas", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=upcoming-schedules" });
  await loginAs(page, "admin@dnms.test");

  const schedules = page.locator("#dashboardSchedules .list-item");
  await expect(schedules).toHaveCount(3);
  await expect(page.locator("#dashboardLessonToday")).toContainText("Coord 01");
  await expect(page.locator("#dashboardSchedules")).not.toContainText("Coord 01");
  await expect(page.locator("#dashboardSchedules")).toContainText("Coord 02");
  await expect(page.locator("#dashboardSchedules")).toContainText("Coord 04");
  await expect(page.locator("#dashboardSchedules")).not.toContainText("Coord 05");

  await schedules.first().click({ position: { x: 16, y: 76 } });
  const expandedDetails = schedules.first().locator(".summary");
  await expect(expandedDetails).not.toContainText("Coordenador:");
  await expect(expandedDetails).not.toContainText("Check-in:");
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

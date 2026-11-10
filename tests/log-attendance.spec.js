const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const { openApp, loginAs } = require("./helpers/app");

test.use({ timezoneId: "America/Sao_Paulo" });

async function prepareHistory(page, email = "admin@dnms.test") {
  await openApp(page);
  await page.evaluate(() => {
    const db = window.__mockDnmsDb;
    db.profiles[0].created_at = "2020-04-05T01:30:00Z";
    db.students[0].created_at = "2020-04-06T12:00:00Z";
    db.students[1].created_at = "invalid";
    // Neither birth dates nor the scheduled event date are insertion dates.
    db.rooms[0].date = "2019-01-01";
    db.rooms[0].created_at = "2020-04-07T12:00:00Z";
    db.students.push({ ...db.students[0], id: "student-no-attendance", name: "João Sem Presença", is_visitor: true });
    db.rooms.push({ ...db.rooms[0], id: "room-evening", name: "Culto da noite" });
    db.rooms.push({ ...db.rooms[0], id: "room-test", name: "Sala de teste", is_test: true });
    const checkin = (id, student, room, date, checkout = true) => ({
      id, student_id: student, room_id: room, class_name: student === "student-juniors" ? "Juniors" : "Kids",
      checked_in_at: date, checked_out_at: checkout ? date : null, printed_at: date
    });
    db.checkins = [
      checkin("ana-first-entry", "student-kids", "room-kids", "2020-04-10T09:00:00-03:00"),
      checkin("ana-reentry", "student-kids", "room-kids", "2020-04-10T09:30:00-03:00"),
      checkin("ana-next-day", "student-kids", "room-kids", "2020-04-11T08:00:00-03:00"),
      checkin("ana-evening", "student-kids", "room-evening", "2020-04-11T19:00:00-03:00"),
      checkin("bia-checkout", "student-juniors", "room-juniors", "2020-04-10T09:10:00-03:00"),
      checkin("test-checkin", "student-kids", "room-test", "2020-04-11T10:00:00-03:00")
    ];
    window.open = (url) => { window.__attendanceShareUrl = String(url); return null; };
  });
  await loginAs(page, email);
  await page.click("#btnLogPanel");
  await expect(page.locator("#logStart")).toHaveValue("2020-04-04");
}

async function exportAttendance(page, format = "json") {
  await page.selectOption("#logExportFormat", format);
  const pending = page.waitForEvent("download");
  await page.click("#btnExport");
  const content = await fs.readFile(await (await pending).path(), "utf8");
  return format === "json" ? JSON.parse(content) : content;
}

for (const email of ["admin@dnms.test", "equipe@dnms.test"]) {
  test(`assiduidade mantém o histórico completo após saídas, sem duplicar reentradas (${email})`, async ({ page }) => {
    await prepareHistory(page, email);
    await expect(page.locator("#logSummary")).toContainText("2 crianca(s) com presenca. 4 presenca(s).");
    await expect(page.locator("#logCounts")).toContainText("Kids: 3 presenca(s)");
    await expect(page.locator("#logCounts")).toContainText("Juniors: 1 presenca(s)");
    const kids = page.locator(".attendance-class-group").filter({ hasText: "Ana Kids" });
    await kids.locator("summary").click();
    await expect(kids.locator(".list-item")).toHaveCount(1);
    await expect(kids).toContainText("Presencas: 3");
    await expect(kids).toContainText("10/04/2020 09:30");
    await expect(kids).toContainText("11/04/2020 08:00");
    await expect(kids).toContainText("11/04/2020 19:00");
    await expect(kids).not.toContainText("10/04/2020 09:00");
    await expect(kids).not.toContainText("11/04/2020 10:00");
    const exported = await exportAttendance(page);
    expect(exported.rows).toContainEqual(["Resumo", "Geral", 4, 2, 0, 4, 0]);
    expect(exported.rows).toContainEqual(["Ana Kids", "Membro", "Kids", 3,
      "10/04/2020 09:30 | 11/04/2020 08:00 | 11/04/2020 19:00"]);
    expect(exported.rows.find((row) => row[0] === "Bia Juniors")?.[3]).toBe(1);
    // Historical attendance does not change the operational definition of present now.
    await page.click("#btnHomePanel");
    await expect(page.locator("#kpiPresent .kpi-value")).toHaveText("0");
  });
}

test("buscar uma criança filtra os totais, datas e exportações da frequência", async ({ page }) => {
  await prepareHistory(page);
  await page.fill("#logStudentFilter", "Ana Kids");
  await expect(page.locator("#logSummary")).toContainText("1 crianca(s) com presenca. 3 presenca(s).");
  await expect(page.locator("#logList")).not.toContainText("Bia Juniors");
  await page.fill("#logStart", "2020-04-11");
  await page.fill("#logEnd", "2020-04-11");
  await expect(page.locator("#logSummary")).toContainText("1 crianca(s) com presenca. 2 presenca(s).");
  const csv = await exportAttendance(page, "csv");
  expect(csv).toContain("Resumo;Geral;2;1;0;2;0");
  expect(csv).toContain("Ana Kids;Membro;Kids;2;11/04/2020");
  expect(csv).not.toContain("Bia Juniors");
  expect(csv).not.toContain("10/04/2020");
  await page.click("#btnShareWhatsapp");
  const text = await page.evaluate(() => new URL(window.__attendanceShareUrl).searchParams.get("text"));
  expect(text).toContain("Total geral: 2 check-in(s), 1 crianca(s)");
  expect(text).toContain("Ana Kids | Membro | Kids | 2 | 11/04/2020");
  expect(text).not.toContain("Bia Juniors");
  expect(text).not.toContain("10/04/2020");
  await page.fill("#logStudentFilter", "");
  await page.selectOption("#logClassFilter", "Juniors");
  await page.click("#btnLogFullPeriod");
  await expect(page.locator("#logList")).toContainText("Bia Juniors");
  await expect(page.locator("#logList")).not.toContainText("Ana Kids");
  await expect(page.locator("#logSummary")).toContainText("1 crianca(s) com presenca. 1 presenca(s).");
});

test("crianças sem presença podem ser buscadas sem acentos, selecionadas e exportadas com zero", async ({ page }) => {
  await prepareHistory(page);
  await expect(page.locator("#logList")).not.toContainText("João Sem Presença");
  await page.fill("#logStudentFilter", "joao sem presenca");
  await expect(page.locator("#logList")).toContainText("João Sem Presença");
  await expect(page.locator("#logSummary")).toContainText("0 crianca(s) com presenca. 0 presenca(s).");
  const exported = await exportAttendance(page);
  expect(exported.rows).toContainEqual(["João Sem Presença", "Visitante", "Kids", 0, ""]);
  expect(exported.rows).toContainEqual(["Resumo", "Geral", 0, 0, 0, 0, 0]);
  await page.fill("#logStudentFilter", "");
  await page.click("#btnLogSelectStudents");
  await page.locator('[data-log-student-id="student-no-attendance"]').check();
  await page.click("#btnApplyLogStudents");
  await expect(page.locator("#logSelectedStudentsSummary")).toContainText("1 crianca(s) selecionada(s)");
  await expect(page.locator("#logList")).toContainText("João Sem Presença");
  await expect(page.locator("#logList")).not.toContainText("Ana Kids");
  await page.click("#btnShareWhatsapp");
  const text = await page.evaluate(() => new URL(window.__attendanceShareUrl).searchParams.get("text"));
  expect(text).toContain("João Sem Presença | Visitante | Kids | 0 | -");
  expect(text).toContain("Total geral: 0 check-in(s), 0 crianca(s)");
});

test("período começa no primeiro cadastro mesmo sem check-ins e pode ser restaurado", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    window.__mockDnmsDb.profiles[0].created_at = "2020-04-05T01:30:00Z";
  });
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnLogPanel");
  await expect(page.locator("#logStart")).toHaveValue("2020-04-04");
  const today = await page.evaluate(() => formatTodayIso());
  await expect(page.locator("#logEnd")).toHaveValue(today);
  await expect(page.locator("#logSummary")).toContainText("Nenhuma frequencia");
  await expect(page.locator("#btnLogSelectStudents")).toBeEnabled();
  await page.fill("#logStart", "2020-05-01");
  await page.fill("#logEnd", "2020-05-31");
  await page.click("#btnHomePanel");
  await page.click("#btnLogPanel");
  await expect.poll(() => page.evaluate(() => panelRefreshContext.inProgress)).toBe(false);
  await expect(page.locator("#logStart")).toHaveValue("2020-05-01");
  await expect(page.locator("#logEnd")).toHaveValue("2020-05-31");
  await page.click("#btnLogFullPeriod");
  await expect(page.locator("#logStart")).toHaveValue("2020-04-04");
  await expect(page.locator("#logEnd")).toHaveValue(today);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("snapshot atrasado respeita as datas editadas e troca de usuário restaura o período padrão", async ({ page }) => {
  await prepareHistory(page);
  await expect.poll(() => page.evaluate(() => panelRefreshContext.inProgress)).toBe(false);
  await page.evaluate(() => {
    const original = supabaseClient.rpc.bind(supabaseClient);
    supabaseClient.rpc = async (name, params) => {
      const response = await original(name, params);
      if (name === "log_report_snapshot") {
        await new Promise((resolve) => { window.__releaseAttendanceSnapshot = resolve; });
      }
      return response;
    };
    requestPanelDataRefresh("log");
  });
  await expect.poll(() => page.evaluate(() => typeof window.__releaseAttendanceSnapshot)).toBe("function");
  await page.fill("#logStart", "2020-04-10");
  await page.fill("#logEnd", "2020-04-10");
  await page.evaluate(() => window.__releaseAttendanceSnapshot());
  await expect.poll(() => page.evaluate(() => panelRefreshContext.inProgress)).toBe(false);
  await expect(page.locator("#logStart")).toHaveValue("2020-04-10");
  await expect(page.locator("#logEnd")).toHaveValue("2020-04-10");
  const periods = await page.evaluate(() => {
    state.session = null;
    render();
    const cleared = [els.logStart.value, els.logEnd.value, logPeriodContext.firstRecordDate];
    state.session = { id: "team-1", role: "equipe" };
    state.checkins = [];
    ensureLogPeriodDefaults();
    return { cleared, start: els.logStart.value, end: els.logEnd.value, today: formatTodayIso() };
  });
  expect(periods.cleared).toEqual(["", "", ""]);
  expect(periods.start).toBe(periods.today);
  expect(periods.end).toBe(periods.today);
});

test("snapshot completo inclui presenças além de mil linhas e preserva a data mais antiga", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const db = window.__mockDnmsDb;
    for (let i = 0; i < 1205; i++) {
      db.checkins.push({ id: `duplicate-${i}`, student_id: "student-kids", room_id: "room-kids",
        class_name: "Kids", checked_in_at: "2020-04-11T12:00:00Z", checked_out_at: "2020-04-11T13:00:00Z" });
    }
    db.checkins.push({ id: "oldest-beyond-limit", student_id: "student-kids", room_id: "room-kids",
      class_name: "Kids", checked_in_at: "2020-04-10T12:00:00Z", checked_out_at: "2020-04-10T13:00:00Z" });
  });
  await loginAs(page, "equipe@dnms.test");
  await page.click("#btnLogPanel");
  await expect(page.locator("#logStart")).toHaveValue("2020-04-10");
  await expect(page.locator("#logSummary")).toContainText("1 crianca(s) com presenca. 2 presenca(s).");
  const exported = await exportAttendance(page);
  expect(exported.rows).toContainEqual(["Ana Kids", "Membro", "Kids", 2, "10/04/2020 09:00 | 11/04/2020 09:00"]);
});

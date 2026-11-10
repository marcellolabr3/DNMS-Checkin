const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const XLSX = require("xlsx");
const { openApp, loginAs } = require("./helpers/app");

test.use({ timezoneId: "America/Sao_Paulo" });

async function prepareHistory(page, email = "admin@dnms.test") {
  await openApp(page);
  await page.evaluate(() => {
    const db = window.__mockDnmsDb;
    db.profiles[0].created_at = "2020-04-05T01:30:00Z";
    db.students[0].created_at = "2020-04-06T12:00:00Z";
    db.students[1].created_at = "invalid";
    db.rooms[0].date = "2019-01-01";
    db.rooms[0].created_at = "2020-04-07T12:00:00Z";
    db.students.push({ ...db.students[0], id: "student-no-attendance", name: "João Sem Presença", is_visitor: true });
    db.rooms.push({ ...db.rooms[0], id: "room-evening", name: "Culto da noite" });
    db.rooms.push({ ...db.rooms[0], id: "room-test", name: "Sala de teste", is_test: true });
    const checkin = (id, student, room, date) => ({
      id, student_id: student, room_id: room, class_name: student === "student-juniors" ? "Juniors" : "Kids",
      checked_in_at: date, checked_out_at: date, printed_at: date
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
  const download = await pending;
  const bytes = await fs.readFile(await download.path());
  if (format === "xlsx") {
    const book = XLSX.read(bytes, { type: "buffer", cellDates: true, cellNF: true, cellStyles: true });
    book.numericSheets = XLSX.read(bytes, { type: "buffer", cellNF: true }).Sheets;
    return book;
  }
  return format === "json" ? JSON.parse(bytes.toString("utf8")) : bytes.toString("utf8");
}

async function expectTotals(page, children, withAttendance, presences) {
  await expect(page.locator("#logAttendanceChildrenCount")).toHaveText(String(children));
  await expect(page.locator("#logAttendanceWithCount")).toHaveText(String(withAttendance));
  await expect(page.locator("#logAttendanceWithoutCount")).toHaveText(String(children - withAttendance));
  await expect(page.locator("#logAttendanceTotalCount")).toHaveText(String(presences));
}

for (const email of ["admin@dnms.test", "equipe@dnms.test"]) {
  test("assiduidade mantém histórico após saída em uma linha por criança (" + email + ")", async ({ page }) => {
    await prepareHistory(page, email);
    await expectTotals(page, 3, 2, 4);
    await expect(page.locator("#logList tbody tr")).toHaveCount(3);
    const ana = page.locator('#logList tr[data-student-id="student-kids"]');
    await expect(ana.locator('td[data-label="Presenças"]')).toHaveText("3");
    await expect(ana.locator('td[data-label="Primeira presença"]')).toHaveText("10/04/2020");
    await expect(ana.locator('td[data-label="Última presença"]')).toHaveText("11/04/2020");
    await expect(ana).not.toContainText("09:30");
    await ana.getByRole("button", { name: "Ver datas de Ana Kids" }).click();
    await expect(page.locator("#logAttendanceDialogList tbody tr")).toHaveCount(3);
    await expect(page.locator("#logAttendanceDialogList")).toContainText("09:30");
    await expect(page.locator("#logAttendanceDialogList")).toContainText("08:00");
    await expect(page.locator("#logAttendanceDialogList")).toContainText("19:00");
    await expect(page.locator("#logAttendanceDialogList")).not.toContainText("09:00");
    await expect(page.locator("#logAttendanceDialogList")).not.toContainText("10:00");
    await page.click("#btnCloseLogAttendance");
    const exported = await exportAttendance(page);
    expect(exported.rows).toContainEqual(["Kids", "Ana Kids", "Membro", 3, "10/04/2020", "11/04/2020"]);
    expect(exported.summary).toMatchObject({ children: 3, withAttendance: 2, withoutAttendance: 1, presences: 4 });
    expect(exported.presences).toHaveLength(5);
    await page.click("#btnHomePanel");
    await expect(page.locator("#kpiPresent .kpi-value")).toHaveText("0");
  });
}

test("filtros de criança e período mantêm CSV uniforme e totais do compartilhamento", async ({ page }) => {
  await prepareHistory(page);
  await page.fill("#logStudentFilter", "Ana Kids");
  await expectTotals(page, 1, 1, 3);
  await page.fill("#logStart", "2020-04-11");
  await page.fill("#logEnd", "2020-04-11");
  await expectTotals(page, 1, 1, 2);
  const csv = await exportAttendance(page, "csv");
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  expect(lines).toHaveLength(2);
  expect(lines[0]).toBe("Turma atual;Criança;Vínculo;Presenças;Primeira presença;Última presença");
  expect(lines[1]).toBe("Kids;Ana Kids;Membro;2;11/04/2020;11/04/2020");
  expect(lines.every((line) => line.split(";").length === 6)).toBe(true);
  expect(csv).not.toMatch(/Resumo|Check-outs|Ativos|\|/);
  await page.click("#btnShareWhatsapp");
  const text = await page.evaluate(() => new URL(window.__attendanceShareUrl).searchParams.get("text"));
  expect(text).toContain("Total de presenças: 2");
  expect(text).toContain("Ana Kids | Membro | Kids | 2 | 11/04/2020 | 11/04/2020");
  expect(text).not.toContain("Bia Juniors");
  expect(text).not.toContain("10/04/2020");
  await page.fill("#logStudentFilter", "");
  await page.selectOption("#logClassFilter", "Juniors");
  await page.fill("#logStart", "2020-04-04");
  await page.fill("#logEnd", await page.evaluate(() => formatTodayIso()));
  await expect(page.locator("#logList")).toContainText("Bia Juniors");
  await expect(page.locator("#logList")).not.toContainText("Ana Kids");
  await expectTotals(page, 1, 1, 1);
});

test("crianças sem presença aparecem com zero e podem ser buscadas ou selecionadas", async ({ page }) => {
  await prepareHistory(page);
  await expect(page.locator("#logList")).toContainText("João Sem Presença");
  await page.fill("#logStudentFilter", "joao sem presenca");
  await expectTotals(page, 1, 0, 0);
  await expect(page.locator("#logList")).toContainText("Sem presença no período");
  await expect(page.locator("#logList button")).toHaveCount(0);
  const exported = await exportAttendance(page);
  expect(exported.rows).toContainEqual(["Kids", "João Sem Presença", "Visitante", 0, "", ""]);
  expect(exported.summary).toMatchObject({ children: 1, withAttendance: 0, withoutAttendance: 1, presences: 0 });
  await page.fill("#logStudentFilter", "");
  await page.click("#btnLogSelectStudents");
  await page.locator('[data-log-student-id="student-no-attendance"]').check();
  await page.click("#btnApplyLogStudents");
  await expect(page.locator("#logSelectedStudentsSummary")).toContainText("1 crianca(s) selecionada(s)");
  await expect(page.locator("#logList")).not.toContainText("Ana Kids");
  await page.click("#btnShareWhatsapp");
  const text = await page.evaluate(() => new URL(window.__attendanceShareUrl).searchParams.get("text"));
  expect(text).toContain("João Sem Presença | Visitante | Kids | 0 | — | —");
  expect(text).toContain("Total de presenças: 0");
});

test("período começa no primeiro cadastro sem botão extra e preserva datas manuais", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { window.__mockDnmsDb.profiles[0].created_at = "2020-04-05T01:30:00Z"; });
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnLogPanel");
  await expect(page.locator("#logStart")).toHaveValue("2020-04-04");
  await expect(page.locator("#logEnd")).toHaveValue(await page.evaluate(() => formatTodayIso()));
  await expect(page.locator("#btnLogFullPeriod")).toHaveCount(0);
  await expectTotals(page, 2, 0, 0);
  await expect(page.locator("#btnExport")).toBeEnabled();
  await page.fill("#logStart", "2020-05-01");
  await page.fill("#logEnd", "2020-05-31");
  await page.click("#btnHomePanel");
  await page.click("#btnLogPanel");
  await expect.poll(() => page.evaluate(() => panelRefreshContext.inProgress)).toBe(false);
  await expect(page.locator("#logStart")).toHaveValue("2020-05-01");
  await expect(page.locator("#logEnd")).toHaveValue("2020-05-31");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("snapshot atrasado respeita datas editadas e troca de usuário limpa o período", async ({ page }) => {
  await prepareHistory(page);
  await expect.poll(() => page.evaluate(() => panelRefreshContext.inProgress)).toBe(false);
  await page.evaluate(() => {
    const original = supabaseClient.rpc.bind(supabaseClient);
    supabaseClient.rpc = async (name, params) => {
      const response = await original(name, params);
      if (name === "log_report_snapshot") await new Promise((resolve) => { window.__releaseAttendanceSnapshot = resolve; });
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
    state.session = null; render();
    const cleared = [els.logStart.value, els.logEnd.value, logPeriodContext.firstRecordDate];
    state.session = { id: "team-1", role: "equipe" }; state.checkins = [];
    ensureLogPeriodDefaults();
    return { cleared, start: els.logStart.value, end: els.logEnd.value, today: formatTodayIso() };
  });
  expect(periods.cleared).toEqual(["", "", ""]);
  expect(periods.start).toBe(periods.today);
  expect(periods.end).toBe(periods.today);
});

test("snapshot completo inclui presenças além de mil linhas", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const db = window.__mockDnmsDb;
    for (let i = 0; i < 1205; i++) db.checkins.push({ id: "duplicate-" + i, student_id: "student-kids", room_id: "room-kids",
      class_name: "Kids", checked_in_at: "2020-04-11T12:00:00Z", checked_out_at: "2020-04-11T13:00:00Z" });
    db.checkins.push({ id: "oldest-beyond-limit", student_id: "student-kids", room_id: "room-kids",
      class_name: "Kids", checked_in_at: "2020-04-10T12:00:00Z", checked_out_at: "2020-04-10T13:00:00Z" });
  });
  await loginAs(page, "equipe@dnms.test"); await page.click("#btnLogPanel");
  await expect(page.locator("#logStart")).toHaveValue("2020-04-10");
  await expectTotals(page, 2, 1, 2);
  const exported = await exportAttendance(page);
  expect(exported.rows).toContainEqual(["Kids", "Ana Kids", "Membro", 2, "10/04/2020", "11/04/2020"]);
});

test("Excel tem três abas, datas nativas, filtros e uma única tabela por criança", async ({ page }) => {
  await prepareHistory(page);
  await page.addScriptTag({ path: require.resolve("xlsx/dist/xlsx.full.min.js") });
  const book = await exportAttendance(page, "xlsx");
  expect(book.SheetNames).toEqual(["Assiduidade", "Presenças", "Resumo"]);
  const sheet = book.Sheets.Assiduidade;
  expect(sheet["!autofilter"].ref).toBe("A1:F4");
  expect(sheet["!cols"][1].wch).toBeGreaterThan(25);
  expect(sheet.B2.v).toBe("Ana Kids");
  expect(sheet.C2.v).toBe("Membro");
  expect(sheet.D2).toMatchObject({ t: "n", v: 3 });
  expect(sheet.E2.t).toBe("d");
  expect(sheet.E2.v.toISOString().slice(0, 10)).toBe("2020-04-10");
  expect(sheet.F2.v.toISOString().slice(0, 10)).toBe("2020-04-11");
  expect(sheet.E2.z).toBe("dd/mm/yyyy");
  expect(sheet.D3.v).toBe(0);
  expect(sheet.E3?.v || "").toBe("");
  expect(book.Sheets["Presenças"]["!autofilter"].ref).toBe("A1:F5");
  expect(book.Sheets["Presenças"].A2.t).toBe("d");
  expect(book.numericSheets["Presenças"].B2.t).toBe("n");
  expect(book.numericSheets["Presenças"].B2.v).toBeCloseTo((9 * 60 + 10) / 1440);
  expect(book.Sheets["Presenças"].B2.z).toBe("hh:mm");
  expect(book.Sheets.Resumo.C2.v).toBe(3);
  expect(book.Sheets.Resumo.C3.v).toBe(2);
  expect(book.Sheets.Resumo.C4.v).toBe(1);
  expect(book.Sheets.Resumo.C5.v).toBe(4);
  expect(book.Sheets.Resumo.F2.t).toBe("d");
  expect(book.Sheets.Resumo.F2.v.toISOString().slice(0, 10)).toBe("2020-04-04");
});

test("mudança de turma não duplica criança e histórico mantém a turma da aula", async ({ page }) => {
  await prepareHistory(page);
  await page.evaluate(async () => {
    window.__mockDnmsDb.checkins.find((item) => item.id === "ana-next-day").class_name = "Maternal";
    await refreshLogSnapshot(); renderLog();
  });
  const exported = await exportAttendance(page);
  expect(exported.rows.filter((row) => row[1] === "Ana Kids")).toEqual([
    ["Kids", "Ana Kids", "Membro", 3, "10/04/2020", "11/04/2020"]
  ]);
  expect(exported.presences).toContainEqual(["11/04/2020", "08:00", "Ana Kids", "Maternal", "Culto Kids", "Membro"]);
  await page.selectOption("#logClassFilter", "Kids");
  await expectTotals(page, 2, 1, 3);
  await page.click("#btnLogAttendancePresences");
  await expect(page.locator("#logList tbody tr")).toHaveCount(3);
  await expect(page.locator("#logList")).toContainText("Maternal");
});

test("detalhes acompanham os filtros e apagam os dados ao sair da sessão", async ({ page }) => {
  await prepareHistory(page);
  await page.getByRole("button", { name: "Ver datas de Ana Kids" }).click();
  await expect(page.locator("#logAttendanceDialog")).toBeVisible();
  await page.evaluate(() => { els.logStudentFilter.value = "Bia"; renderLog(); });
  await expect(page.locator("#logAttendanceDialog")).toBeHidden();
  await expect(page.locator("#logAttendanceDialogList")).toBeEmpty();
  await page.fill("#logStudentFilter", "");
  await page.getByRole("button", { name: "Ver datas de Ana Kids" }).click();
  await page.evaluate(() => { state.session = null; render(); });
  await expect(page.locator("#logAttendanceDialog")).toBeHidden();
  await expect(page.locator("#logAttendanceDialogTitle")).toBeEmpty();
  await expect(page.locator("#logAttendanceDialogList")).toBeEmpty();
  await page.evaluate(() => { state.session = { id: "parent-1", role: "responsavel" }; openLogAttendanceDetails("student-kids"); });
  await expect(page.locator("#logAttendanceDialog")).toBeHidden();
});

test("datas inválidas bloqueiam exportação e abas funcionam por teclado", async ({ page }) => {
  await prepareHistory(page);
  await page.locator("#btnLogAttendanceChildren").focus(); await page.keyboard.press("ArrowRight");
  await expect(page.locator("#btnLogAttendancePresences")).toBeFocused();
  await expect(page.locator("#logList tbody tr")).toHaveCount(4);
  await page.keyboard.press("Home");
  await expect(page.locator("#btnLogAttendanceChildren")).toBeFocused();
  await expect(page.locator("#logList tbody tr")).toHaveCount(3);
  await page.fill("#logStart", "2020-04-12"); await page.fill("#logEnd", "2020-04-10");
  await expect(page.locator("#btnExport")).toBeDisabled();
  await expect(page.locator("#logSummary")).toContainText("data inicial");
});

for (const change of ["filters", "session"]) {
  test("Excel de assiduidade cancela geração quando muda " + change, async ({ page }) => {
    await prepareHistory(page);
    await page.addScriptTag({ path: require.resolve("xlsx/dist/xlsx.full.min.js") });
    await page.selectOption("#logExportFormat", "xlsx");
    await page.evaluate(() => {
      ensureXlsxLoaded = () => new Promise((resolve) => { window.__releaseAttendanceExcel = () => resolve(window.XLSX); });
    });
    let downloads = 0; page.on("download", () => downloads++);
    await page.click("#btnExport");
    await expect.poll(() => page.evaluate(() => typeof window.__releaseAttendanceExcel)).toBe("function");
    if (change === "filters") await page.fill("#logStudentFilter", "Bia");
    else await page.evaluate(() => { state.session = null; render(); });
    await page.evaluate(() => window.__releaseAttendanceExcel());
    await expect.poll(() => page.evaluate(() => window.alertMessages.join(" "))).toContain(change === "filters" ? "filtros" : "Sessão alterada");
    expect(downloads).toBe(0);
    expect(await page.evaluate(() => logCenter.excelExport)).toBeNull();
  });
}

test("crianças com mesmo nome mantêm presenças independentes por cadastro", async ({ page }) => {
  await prepareHistory(page);
  await page.evaluate(async () => {
    const db = window.__mockDnmsDb;
    db.students.find((student) => student.id === "student-no-attendance").name = "Ana Kids";
    db.checkins.push({ ...db.checkins[2], id: "other-ana", student_id: "student-no-attendance" });
    await refreshLogSnapshot(); renderLog();
  });
  await expectTotals(page, 3, 3, 5);
  await expect(page.locator('#logList tr[data-student-id="student-kids"] td[data-label="Presenças"]')).toHaveText("3");
  await expect(page.locator('#logList tr[data-student-id="student-no-attendance"] td[data-label="Presenças"]')).toHaveText("1");
});

test("nomes e eventos com HTML ficam como texto no novo detalhamento", async ({ page }) => {
  await prepareHistory(page);
  await page.evaluate(async () => {
    const db = window.__mockDnmsDb;
    db.students[0].name = '<img src=x onerror="window.__attendanceXss=true">';
    db.checkins.forEach((row) => { row.room_name_snapshot = '<img src=x onerror="window.__attendanceXss=true">'; });
    await refreshLogSnapshot(); renderLog();
  });
  await page.locator('#logList tr[data-student-id="student-kids"] button').click();
  await expect(page.locator("#logAttendanceDialogList")).toContainText("<img src=x");
  await expect(page.locator("#logList img, #logAttendanceDialog img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__attendanceXss)).toBeUndefined();
});

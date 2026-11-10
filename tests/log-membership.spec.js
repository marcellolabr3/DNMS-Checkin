const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const { openApp, loginAs } = require("./helpers/app");
const { verifyBackup } = require("../scripts/restore-log-backup.cjs");

async function prepareLog(page, email = "admin@dnms.test") {
  await openApp(page);
  await page.evaluate(() => {
    const db = window.__mockDnmsDb;
    const year = new Date().getFullYear();
    db.students.forEach((student) => {
      student.birth_date = `${year - 7}-06-20`;
      student.class_name = "Kids";
    });
    db.students[1].name = "Bia Visitante";
    db.students[1].is_visitor = true;
    // O vínculo é da criança: o responsável pode ter outra classificação.
    db.profiles.find((profile) => profile.id === "parent-1").is_visitor = true;
    db.student_guardians.push({ student_id: "student-juniors", guardian_id: "parent-1" });
    const today = db.rooms[0].date;
    db.checkins = [
      { id: "member-old", student_id: "student-kids", checked_in_at: `${today}T09:00:00Z` },
      { id: "member-new", student_id: "student-kids", checked_in_at: `${today}T10:00:00Z` },
      { id: "visitor", student_id: "student-juniors", checked_in_at: `${today}T10:10:00Z` }
    ].map((row) => ({ ...row, room_id: "room-kids", room_name_snapshot: "Culto Kids", class_name: "Kids", checked_out_at: null, printed_at: null }));
    db.audit_logs = [
      { id: "audit-member", action_type: "child_created", target_type: "student", target_id: "student-kids", target_name: "Ana Kids" },
      { id: "audit-visitor", action_type: "checkin_created", target_type: "checkin", target_id: "visitor", target_name: "Bia Visitante" },
      { id: "audit-deleted", action_type: "child_deleted", target_type: "student", target_id: "deleted-child", target_name: "Criança excluída" },
      { id: "audit-parent", action_type: "user_updated", target_type: "profile", target_id: "parent-1", target_name: "Responsavel Teste" },
      { id: "audit-batch", action_type: "stale_checkins_closed", target_type: "checkin", target_id: "member-old", target_name: "Encerramento em lote", metadata: { studentIds: ["student-kids", "student-juniors"] } }
    ].map((row) => ({ ...row, created_at: `${today}T12:00:00Z`, actor_name: "Admin DNMS", actor_role: "admin", details: "Registro de teste" }));
    window.XLSX = {
      read() {},
      utils: {
        sheet_to_json() { return []; },
        aoa_to_sheet(rows) { return { rows }; },
        book_new() { return { sheets: {} }; },
        book_append_sheet(workbook, sheet, name) { workbook.sheets[name] = sheet; }
      },
      writeFile(workbook) { window.__membershipWorkbook = workbook; }
    };
    window.open = (url) => { window.__membershipShareUrl = String(url); return null; };
  });
  await loginAs(page, email);
  await page.click("#btnLogPanel");
}

async function exportLog(page, format) {
  if (await page.locator("#logExportFormat").isDisabled()) await expect(page.locator("#logExportFormat")).toHaveValue(format);
  else await page.selectOption("#logExportFormat", format);
  if (format === "xlsx") {
    await page.evaluate(() => { window.__membershipWorkbook = null; });
    await page.click("#btnExport");
    await expect.poll(() => page.evaluate(() => window.__membershipWorkbook)).not.toBeNull();
    return page.evaluate(() => window.__membershipWorkbook);
  }
  const pending = page.waitForEvent("download");
  await page.click("#btnExport");
  const content = await fs.readFile(await (await pending).path(), "utf8");
  return format === "json" ? JSON.parse(content) : content;
}

function assertChildMatrix(rows, nameHeader) {
  const headerIndex = rows.findIndex((row) => row[0] === nameHeader);
  expect(headerIndex).toBeGreaterThanOrEqual(0);
  expect(rows[headerIndex][1]).toBe("Membro/Visitante");
  const children = rows.slice(headerIndex + 1);
  expect(children.find((row) => row[0] === "Ana Kids")?.[1]).toBe("Membro");
  expect(children.find((row) => row[0] === "Bia Visitante")?.[1]).toBe("Visitante");
}

for (const mode of ["all", "class", "selected", "transition"]) {
  test(`cadastros ${mode} identificam membro e visitante na prévia, CSV, Excel, JSON e compartilhamento`, async ({ page }) => {
    await prepareLog(page);
    await page.selectOption("#logReportType", `extract_${mode}`);
    if (mode === "class") await page.selectOption("#studentExtractionClass", "Kids");
    if (mode === "selected") await page.click("#btnStudentExtractionSelectAll");
    if (mode === "transition") {
      await page.fill("#studentTransitionYear", String(new Date().getFullYear() + 1));
      await expect(page.locator("#studentExtractionList")).toContainText("Kids → Juniors");
    }
    await expect(page.locator("#studentExtractionList")).toContainText("Ana Kids (Membro)");
    await expect(page.locator("#studentExtractionList")).toContainText("Bia Visitante (Visitante)");
    expect(await exportLog(page, "csv")).toMatch(/Nome;Membro\/Visitante;Nascimento/);
    const json = await exportLog(page, "json");
    expect(json.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Ana Kids", membership: "Membro", isVisitor: "Nao" }),
      expect.objectContaining({ name: "Bia Visitante", membership: "Visitante", isVisitor: "Sim" })
    ]));
    if (mode === "transition") expect(json.rows.every((row) => row.transition.nextClass === "Juniors")).toBe(true);
    const workbook = await exportLog(page, "xlsx");
    const sheet = workbook.sheets[mode === "transition" ? "Mudancas" : "Criancas"];
    assertChildMatrix(sheet.rows, "Nome");
    expect(workbook.sheets.Resumo.rows).toContainEqual(["Membros", 1]);
    expect(workbook.sheets.Resumo.rows).toContainEqual(["Visitantes", 1]);
    expect(sheet["!autofilter"].ref).toBe(mode === "transition" ? "A1:N3" : "A1:L3");
    await page.selectOption("#logExportFormat", "csv");
    await page.click("#btnShareWhatsapp");
    const text = await page.evaluate(() => new URL(window.__membershipShareUrl).searchParams.get("text"));
    expect(text).toContain("Ana Kids | Membro |");
    expect(text).toContain("Bia Visitante | Visitante |");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("frequência e resumo distinguem vínculos sem duplicar a quantidade de crianças", async ({ page }) => {
  await prepareLog(page, "equipe@dnms.test");
  expect(await exportLog(page, "csv")).toContain("Bia Visitante;Visitante;Kids;1;");
  assertChildMatrix((await exportLog(page, "json")).rows, "Aluno");
  assertChildMatrix((await exportLog(page, "xlsx")).sheets.Dados.rows, "Aluno");
  await page.selectOption("#logExportFormat", "csv");
  await page.locator(".attendance-class-group > summary").click();
  await expect(page.locator("#logList")).toContainText("Membro/Visitante: Visitante");
  await page.click("#btnShareWhatsapp");
  expect(await page.evaluate(() => new URL(window.__membershipShareUrl).searchParams.get("text"))).toContain("Bia Visitante | Visitante |");
  await page.selectOption("#logReportType", "event_summary");
  await expect(page.locator("#logList")).toContainText("Por vínculo");
  expect(await exportLog(page, "csv")).toContain("Vínculo;Membro;2;1;2;0;2");
  expect((await exportLog(page, "json")).rows).toContainEqual(["Vínculo", "Visitante", 1, 1, 1, 0, 1]);
  expect((await exportLog(page, "xlsx")).sheets.Dados.rows).toContainEqual(["Vínculo", "Membro", 2, 1, 2, 0, 2]);
});

test("responsáveis e filhos preservam os nomes e identificam cada vínculo em famílias mistas", async ({ page }) => {
  await prepareLog(page, "equipe@dnms.test");
  await page.selectOption("#logReportType", "families");
  await page.fill("#logStudentFilter", "Responsavel Teste");
  await expect(page.locator("#logList")).toContainText("Ana Kids (Membro) | Bia Visitante (Visitante)");
  expect(await exportLog(page, "csv")).toContain("Membro/Visitante dos filhos");
  for (const format of ["json", "xlsx"]) {
    const exported = await exportLog(page, format);
    const rows = format === "json" ? exported.rows : exported.sheets.Dados.rows;
    expect(rows[0].slice(-2)).toEqual(["Filhos", "Membro/Visitante dos filhos"]);
    expect(rows[1].slice(-2)).toEqual(["Ana Kids | Bia Visitante", "Ana Kids (Membro) | Bia Visitante (Visitante)"]);
  }
});

for (const table of ["students", "checkins", "audit_logs"]) {
  test(`consulta ${table} inclui vínculo em todos os formatos mesmo com seleção parcial de campos`, async ({ page }) => {
    await prepareLog(page);
    await page.selectOption("#logReportType", "data");
    await expect(page.locator("#logDataTable option")).toHaveCount(5);
    await page.selectOption("#logDataTable", table);
    await page.locator("#logDataFields").evaluate((el) => {
      el.parentElement.open = true;
      el.querySelectorAll("input").forEach((input) => { input.checked = input.value === "id"; });
    });
    // Exige o valor do snapshot, mesmo que a tela ainda tenha o cadastro anterior.
    await page.evaluate(() => { window.__mockDnmsDb.students[0].is_visitor = true; });
    const csv = await exportLog(page, "csv");
    expect(csv).toContain("Membro/Visitante;id");
    const json = await exportLog(page, "json");
    expect(json.fields).toEqual(["Membro/Visitante", "id"]);
    const firstId = table === "students" ? "student-kids" : table === "checkins" ? "member-old" : "audit-member";
    expect(json.rows.find((row) => row.id === firstId)).toEqual({ id: firstId, "Membro/Visitante": "Visitante" });
    const matrix = (await exportLog(page, "xlsx")).sheets.Dados.rows;
    expect(matrix[0]).toEqual(["Membro/Visitante", "id"]);
    expect(matrix.find((row) => row[1] === firstId)?.[0]).toBe("Visitante");
    if (table === "audit_logs") {
      expect(json.rows.find((row) => row.id === "audit-parent")["Membro/Visitante"]).toBe("");
      expect(json.rows.find((row) => row.id === "audit-deleted")["Membro/Visitante"]).toBe("Não identificado");
    }
  });
}

test("auditoria identifica crianças, mantém ações de usuários sem vínculo infantil e sinaliza cadastros ausentes", async ({ page }) => {
  await prepareLog(page);
  await page.selectOption("#logReportType", "audit_all");
  await expect(page.locator("#logList")).toContainText("Bia Visitante (Visitante)");
  expect(await exportLog(page, "csv")).toContain("Alvo;Membro/Visitante;Autor");
  for (const format of ["json", "xlsx"]) {
    const exported = await exportLog(page, format);
    const rows = format === "json" ? exported.rows : exported.sheets.Dados.rows;
    const membershipIndex = rows[0].indexOf("Membro/Visitante");
    expect(rows.find((row) => row[3] === "Ana Kids")[membershipIndex]).toBe("Membro");
    expect(rows.find((row) => row[3] === "Bia Visitante")[membershipIndex]).toBe("Visitante");
    expect(rows.find((row) => row[3] === "Criança excluída")[membershipIndex]).toBe("Não identificado");
    expect(rows.find((row) => row[3] === "Responsavel Teste")[membershipIndex]).toBe("");
    expect(rows.find((row) => row[3] === "Encerramento em lote")[membershipIndex]).toBe("Ana Kids (Membro) | Bia Visitante (Visitante)");
  }
});

test("backup conserva a flag original sem campos de apresentação nos registros restauráveis", async ({ page }) => {
  await prepareLog(page, "marvinlabre@gmail.com");
  await page.selectOption("#logReportType", "backup_global");
  const snapshot = verifyBackup(await exportLog(page, "json")).snapshot;
  const students = snapshot.tables["public.students"];
  expect(students.find((student) => student.id === "student-kids").is_visitor).toBe(false);
  expect(students.find((student) => student.id === "student-juniors").is_visitor).toBe(true);
  expect(students.every((student) => !("membership" in student) && !("Membro/Visitante" in student))).toBe(true);
});

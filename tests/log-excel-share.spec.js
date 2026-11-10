const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const XLSX = require("xlsx");
const { openApp, loginAs } = require("./helpers/app");

async function prepare(page) {
  await openApp(page);
  await page.addScriptTag({ path: require.resolve("xlsx/dist/xlsx.full.min.js") });
  await page.evaluate(() => {
    const db = window.__mockDnmsDb;
    const year = new Date().getFullYear();
    db.students[0].birth_date = `${year - 7}-06-20`;
    db.students[1].is_visitor = true;
    db.student_guardians.push({ student_id: "student-juniors", guardian_id: "parent-1" });
    const today = db.rooms[0].date;
    db.checkins.push({ id: "share-checkin", student_id: "student-kids", room_id: "room-kids", room_name_snapshot: "Culto Kids", class_name: "Kids", checked_in_at: `${today}T12:00:00Z`, checked_out_at: null, printed_at: null });
    db.audit_logs.push({ id: "share-audit", action_type: "child_created", target_type: "student", target_id: "student-kids", target_name: "Ana Kids", created_at: `${today}T12:00:00Z`, actor_name: "Admin", actor_role: "admin" });
    window.__fileShares = [];
    window.__openedShareUrls = [];
    window.open = (url) => { window.__openedShareUrls.push(String(url)); return null; };
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data) => data.files?.length === 1 });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data) => {
      const active = navigator.userActivation.isActive;
      const file = data.files[0];
      window.__fileShares.push({ name: file.name, type: file.type, active, text: data.text, url: data.url, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) });
    } });
  });
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnLogPanel");
  await page.selectOption("#logExportFormat", "xlsx");
}

async function generate(page) {
  const pending = page.waitForEvent("download");
  await page.click("#btnExport");
  const download = await pending;
  return { name: download.suggestedFilename(), bytes: await fs.readFile(await download.path()) };
}

async function sharedFile(page) {
  await expect.poll(() => page.evaluate(() => window.__fileShares.length)).toBe(1);
  return page.evaluate(() => window.__fileShares[0]);
}

test("Excel gerado é compartilhado como arquivo XLSX real com as duas abas e os vínculos", async ({ page }) => {
  await prepare(page);
  await page.selectOption("#logReportType", "extract_all");
  const download = await generate(page);
  await page.getByRole("button", { name: "Enviar Excel no WhatsApp", exact: true }).click();
  const file = await sharedFile(page);
  expect(file.name).toBe(download.name);
  expect(file.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  expect(file.active).toBe(true);
  expect(file.text).toBeUndefined();
  expect(file.url).toBeUndefined();
  expect(Buffer.from(file.bytes).equals(download.bytes)).toBe(true);
  const workbook = XLSX.read(Buffer.from(file.bytes), { type: "buffer" });
  expect(workbook.SheetNames).toEqual(["Resumo", "Criancas"]);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Criancas, { header: 1 });
  expect(rows[0].slice(0, 3)).toEqual(["Nome", "Membro/Visitante", "Nascimento"]);
  expect(rows.find((row) => row[0] === "Ana Kids")[1]).toBe("Membro");
  expect(rows.find((row) => row[0] === "Bia Juniors")[1]).toBe("Visitante");
  expect(await page.evaluate(() => window.__openedShareUrls)).toEqual([]);
});

for (const operation of ["extract_transition", "attendance", "event_summary", "changes", "families", "data"]) {
  test(`compartilha o arquivo da operação ${operation} sem trocar por mensagem de texto`, async ({ page }) => {
    await prepare(page);
    await page.selectOption("#logReportType", operation);
    if (operation === "data") await expect(page.locator("#logDataTable option")).toHaveCount(5);
    const download = await generate(page);
    await expect(page.locator("#btnShareWhatsapp")).toBeVisible();
    await page.click("#btnShareWhatsapp");
    const file = await sharedFile(page);
    expect(file.name).toBe(download.name);
    expect(Buffer.from(file.bytes).equals(download.bytes)).toBe(true);
    const workbook = XLSX.read(Buffer.from(file.bytes), { type: "buffer" });
    expect(workbook.SheetNames).toContain(operation === "extract_transition" ? "Mudancas" : "Dados");
    expect(await page.evaluate(() => window.__openedShareUrls)).toEqual([]);
  });
}

test("primeiro clique prepara o Excel e um novo clique abre o compartilhamento com ativação válida", async ({ page }) => {
  await prepare(page);
  await page.selectOption("#logReportType", "extract_all");
  await page.click("#btnShareWhatsapp");
  await expect(page.locator("#logExcelShareDialog")).toBeVisible();
  await expect(page.locator("#btnLogShareExcelFile")).toBeVisible();
  expect(await page.evaluate(() => window.__fileShares)).toEqual([]);
  await page.click("#btnLogShareExcelFile");
  expect((await sharedFile(page)).active).toBe(true);
  await expect(page.locator("#logExcelShareDialog")).toBeHidden();
});

for (const support of ["absent", "rejects_xlsx", "throws"]) {
  test(`oferece o documento para anexar quando o compartilhamento é ${support}`, async ({ page }) => {
    await prepare(page);
    await page.selectOption("#logReportType", "extract_all");
    const exported = await generate(page);
    await page.evaluate((support) => {
      Object.defineProperty(navigator, "canShare", { configurable: true, value: support === "absent" ? undefined : () => {
        if (support === "throws") throw new Error("unsupported");
        return false;
      } });
    }, support);
    await page.click("#btnShareWhatsapp");
    await expect(page.locator("#logExcelShareDialog")).toBeVisible();
    await expect(page.locator("#logExcelShareStatus")).toContainText("Anexar → Documento");
    await expect(page.locator("#btnLogShareExcelFile")).toBeHidden();
    await expect(page.locator("#logExcelOpenWhatsapp")).toHaveAttribute("href", "https://web.whatsapp.com/");
    const pending = page.waitForEvent("download");
    await page.click("#btnLogDownloadExcelFile");
    const downloaded = await pending;
    expect(await fs.readFile(await downloaded.path())).toEqual(exported.bytes);
    expect(await page.evaluate(() => window.__fileShares)).toEqual([]);
    expect(await page.evaluate(() => window.__openedShareUrls)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("cancelar o compartilhamento não abre mensagem nem baixa arquivos novamente", async ({ page }) => {
  await prepare(page);
  await page.selectOption("#logReportType", "extract_all");
  await generate(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("Cancelled", "AbortError"); } });
  });
  await page.click("#btnShareWhatsapp");
  await expect(page.locator("#logExcelShareDialog")).toBeHidden();
  expect(await page.evaluate(() => window.alertMessages)).toEqual([]);
  expect(await page.evaluate(() => window.__openedShareUrls)).toEqual([]);
  expect(downloads).toBe(0);
});

test("falha na ativação permite tentar novamente pelo botão com o arquivo já preparado", async ({ page }) => {
  await prepare(page);
  await page.selectOption("#logReportType", "extract_all");
  await generate(page);
  await page.evaluate(() => {
    const share = navigator.share.bind(navigator);
    let calls = 0;
    Object.defineProperty(navigator, "share", { configurable: true, value: (data) => ++calls === 1
      ? Promise.reject(new DOMException("Activation expired", "NotAllowedError")) : share(data) });
  });
  await page.click("#btnShareWhatsapp");
  await expect(page.locator("#logExcelShareDialog")).toBeVisible();
  await expect(page.locator("#logExcelShareStatus")).toContainText("Tente novamente");
  await page.click("#btnLogShareExcelFile");
  expect((await sharedFile(page)).active).toBe(true);
});

test("mudar a turma exige um Excel novo e não compartilha a extração anterior", async ({ page }) => {
  await prepare(page);
  await page.selectOption("#logReportType", "extract_class");
  await page.selectOption("#studentExtractionClass", "Kids");
  await generate(page);
  await page.selectOption("#studentExtractionClass", "Juniors");
  await page.click("#btnShareWhatsapp");
  await expect(page.locator("#btnLogShareExcelFile")).toBeVisible();
  await page.click("#btnLogShareExcelFile");
  const workbook = XLSX.read(Buffer.from((await sharedFile(page)).bytes), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Criancas, { header: 1 });
  expect(rows.slice(1).map((row) => row[0])).toEqual(["Bia Juniors"]);
});

test("trocar filtros durante o carregamento impede download e compartilhamento inconsistentes", async ({ page }) => {
  await prepare(page);
  await page.selectOption("#logReportType", "extract_transition");
  await page.evaluate(() => {
    ensureXlsxLoaded = () => new Promise((resolve) => { window.__releaseShareExcel = () => resolve(window.XLSX); });
  });
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.click("#btnExport");
  await expect.poll(() => page.evaluate(() => typeof window.__releaseShareExcel)).toBe("function");
  await page.fill("#studentTransitionYear", String(new Date().getFullYear() + 2));
  await page.evaluate(() => window.__releaseShareExcel());
  await expect.poll(() => page.evaluate(() => logCenter.busy)).toBe(false);
  expect((await page.evaluate(() => window.alertMessages)).join(" ")).toContain("filtros");
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => logCenter.excelExport)).toBeNull();
});

test("sair remove o arquivo e o diálogo, e outra sessão não pode compartilhar dados anteriores", async ({ page }) => {
  await prepare(page);
  await page.selectOption("#logReportType", "extract_all");
  await generate(page);
  await page.evaluate(() => { Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false }); });
  await page.click("#btnShareWhatsapp");
  await expect(page.locator("#logExcelShareDialog")).toBeVisible();
  await page.evaluate(() => handleLogout());
  await expect(page.locator("#logExcelShareDialog")).toBeHidden();
  expect(await page.evaluate(() => logCenter.excelExport)).toBeNull();
  await loginAs(page, "responsavel@dnms.test");
  await page.evaluate(() => shareLogExcel());
  expect(await page.evaluate(() => window.__fileShares)).toEqual([]);
  expect((await page.evaluate(() => window.alertMessages)).join(" ")).toContain("Sessão alterada");
});

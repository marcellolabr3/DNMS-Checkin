const {test,expect} = require("@playwright/test");
const fs = require("node:fs");
const {openApp,loginAs} = require("./helpers/app");
const {verifyBackup} = require("../scripts/restore-log-backup.cjs");
async function readDownload(download) { return fs.promises.readFile(await download.path(),"utf8"); }

test("Log unifica operações e mantém permissões de equipe e admin", async ({page}) => {
  await openApp(page); await loginAs(page,"equipe@dnms.test"); await page.click("#btnLogPanel");
  await expect(page.locator("#logDataOptions")).toHaveAttribute("hidden","");
  await expect(page.locator("#logBackupOptions")).toHaveAttribute("hidden","");
  await expect(page.locator("#logReportType option[value=attendance]")).toHaveCount(1);
  await expect(page.locator("#studentExtractionPanel")).toBeHidden();
  await expect(page.locator("#logCard details > summary").filter({hasText:/^Extração$/})).toHaveCount(0);
});

test("extração consulta banco sem truncar e combina campos, busca, evento e período", async ({page}) => {
  await openApp(page);
  await page.evaluate(() => {
    const db=window.__mockDnmsDb;
    for(let i=0;i<1205;i++) db.checkins.push({id:`extract-${i}`,student_id:"student-kids",room_id:i===1204?"room-juniors":"room-kids",class_name:"Kids",checked_in_at:"2026-03-10T12:00:00Z",metadata:{flag:true,count:i}});
  });
  await loginAs(page,"admin@dnms.test"); await page.click("#btnLogPanel"); await page.selectOption("#logReportType","data");
  await expect(page.locator("#logDataTable option")).toHaveCount(5);
  await page.selectOption("#logDataTable","checkins");
  await page.selectOption("#logExportFormat","json");
  let pending=page.waitForEvent("download");await page.click("#btnExport");
  const all=JSON.parse(await readDownload(await pending));expect(all.rows).toHaveLength(1205);expect(all.rows[0].metadata.flag).toBe(true);
  await page.selectOption("#logDataEvent","room-kids");await page.selectOption("#logDataDate","checked_in_at");
  await page.fill("#logStart","2026-03-10");await page.fill("#logEnd","2026-03-10");await page.fill("#logDataSearch","extract-1203");
  await page.locator("#logDataFields").evaluate(el=>el.parentElement.open=true);
  await page.locator('#logDataFields input[value="metadata"]').uncheck();
  await page.click("#btnLogConsult");await expect(page.locator("#logCenterStatus")).toContainText("1 registro(s)");
  pending=page.waitForEvent("download");await page.click("#btnExport");
  const result=JSON.parse(await readDownload(await pending));expect(result.rows).toHaveLength(1);expect(result.rows[0].id).toBe("extract-1203");expect(result.rows[0]).not.toHaveProperty("metadata");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test("backup global possui checksum verificável e rejeita corrupção",async({page})=>{
  await openApp(page);await loginAs(page,"marvinlabre@gmail.com");await page.click("#btnLogPanel");await page.selectOption("#logReportType","backup_global");
  await expect(page.locator("#logExportFormat")).toBeDisabled();await expect(page.locator("#logExportFormat")).toHaveValue("json");
  await expect(page.locator("#btnLogConsult")).toBeHidden();await expect(page.locator("#logDataSearch")).toBeHidden();
  const pending=page.waitForEvent("download");await page.click("#btnExport");const document=JSON.parse(await readDownload(await pending));
  const payload=verifyBackup(document);expect(payload.scope).toBe("global");expect(payload.snapshot.tables["public.students"]).toBeDefined();
  document.payload.snapshot.tables["public.students"][0].name="Corrompido";
  expect(()=>verifyBackup(document)).toThrow(/Checksum/);
});

test("backup específico exige seleção e não aplica filtros que descartem dados",async({page})=>{
  await openApp(page);await loginAs(page,"marvinlabre@gmail.com");await page.click("#btnLogPanel");await page.selectOption("#logReportType","backup_specific");
  await expect(page.locator("#logDataFields input")).toHaveCount(5);
  await page.click("#btnExport");await expect(page.locator("#logCenterStatus")).toContainText("Selecione pelo menos uma tabela");
  await page.locator("#logDataFields").evaluate(el=>el.parentElement.open=true);
  await page.locator('#logDataFields input[value="students"]').check();
  const pending=page.waitForEvent("download");await page.click("#btnExport");const doc=JSON.parse(await readDownload(await pending));
  expect(verifyBackup(doc).scope).toBe("specific");expect(Object.keys(doc.payload.snapshot.tables)).toEqual(["public.students","auth.users","auth.identities"]);
});

test("falha ou alteração durante backup não gera arquivo incompleto",async({page})=>{
  await openApp(page);await loginAs(page,"marvinlabre@gmail.com");await page.click("#btnLogPanel");await page.selectOption("#logReportType","backup_global");
  let downloads=0;page.on("download",()=>downloads++);
  await page.evaluate(()=>{window.__mockBackupMoving=true});await page.click("#btnExport");await expect(page.locator("#logCenterStatus")).toContainText("dados mudaram");
  await page.evaluate(()=>{window.__mockBackupMoving=false;window.__mockBackupObjects=[{bucket_id:"dnms-photos",name:"missing.png"}];window.__mockStorageDownloadError=true});
  await page.click("#btnExport");await expect(page.locator("#logCenterStatus")).toContainText("Backup cancelado");expect(downloads).toBe(0);
});

test("extrai CSV seguro, Excel e JSON sem converter consulta em backup",async({page})=>{
  await openApp(page);await page.evaluate(()=>window.__mockDnmsDb.students[0].name="=FORMULA()");await loginAs(page,"admin@dnms.test");await page.click("#btnLogPanel");await page.selectOption("#logReportType","extract_all");
  await expect(page.locator("#studentExtractionMode")).toBeHidden();await expect(page.locator("#btnExportStudentsData")).toBeHidden();
  let pending=page.waitForEvent("download");await page.click("#btnExport");expect(await readDownload(await pending)).toContain("'=FORMULA()");
  await page.selectOption("#logExportFormat","json");pending=page.waitForEvent("download");await page.click("#btnExport");const json=JSON.parse(await readDownload(await pending));expect(json.rows).toHaveLength(2);expect(json).not.toHaveProperty("payload");
});

test("consulta com erro não exporta e permite tentar novamente",async({page})=>{
  await openApp(page);await loginAs(page,"admin@dnms.test");await page.click("#btnLogPanel");await page.selectOption("#logReportType","data");await expect(page.locator("#logDataTable option")).toHaveCount(5);
  await page.evaluate(()=>{window.__mockLogError="conexão indisponível"});await page.click("#btnExport");await expect(page.locator("#logCenterStatus")).toContainText("Operação não concluída");
  await page.evaluate(()=>{window.__mockLogError=null});const pending=page.waitForEvent("download");await page.click("#btnExport");expect((await pending).suggestedFilename()).toContain("students");
});

test("relatórios preservam resumo e dados em JSON e Excel",async({page})=>{
  await openApp(page);await page.evaluate(()=>{
    const db=window.__mockDnmsDb;db.checkins.push({id:"report-export",student_id:"student-kids",room_id:"room-kids",room_name_snapshot:"Culto Kids",class_name:"Kids",checked_in_at:db.rooms[0].date+"T12:00:00Z",checked_out_at:null,printed_at:null});
    window.XLSX={read(){},utils:{sheet_to_json(){},aoa_to_sheet(rows){return {rows}},book_new(){return {sheets:[]}},book_append_sheet(w,s,n){w.sheets.push({name:n,...s})}},writeFile(workbook,name){window.__logWorkbook={workbook,name}}};
  });
  await loginAs(page,"admin@dnms.test");await page.click("#btnLogPanel");await page.selectOption("#logExportFormat","json");
  const pending=page.waitForEvent("download");await page.click("#btnExport");const data=JSON.parse(await readDownload(await pending));expect(data.report).toBe("attendance");expect(JSON.stringify(data.rows)).toContain("Ana Kids");
  await page.selectOption("#logExportFormat","xlsx");await page.click("#btnExport");await expect.poll(()=>page.evaluate(()=>window.__logWorkbook?.name)).toMatch(/frequencia_.*\.xlsx/);
  expect(await page.evaluate(()=>JSON.stringify(window.__logWorkbook.workbook))).toContain("Ana Kids");
  await page.selectOption("#logReportType","event_summary");await page.selectOption("#logExportFormat","json");const next=page.waitForEvent("download");await page.click("#btnExport");expect(JSON.parse(await readDownload(await next)).report).toBe("event_summary");
});

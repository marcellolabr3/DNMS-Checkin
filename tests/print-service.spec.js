const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("servico local de impressao tem protecoes HTTP compativeis", async () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "Servico de impressao", "server.js"), "utf8");
  const printJob = fs.readFileSync(path.join(__dirname, "..", "Servico de impressao", "src", "print-job.js"), "utf8");
  const adapter = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "src", "windows-pdf-print-adapter.js"),
    "utf8"
  );
  const packagePortable = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "scripts", "package-portable.ps1"),
    "utf8"
  );
  const startServiceUi = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "scripts", "start-service-ui.ps1"),
    "utf8"
  );
  const validateInstall = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "scripts", "validate-install.ps1"),
    "utf8"
  );
  const validateRealEnvironment = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "scripts", "validate-real-environment.ps1"),
    "utf8"
  );
  const installPortable = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "scripts", "install-portable.ps1"),
    "utf8"
  );
  const launcher = fs.readFileSync(path.join(__dirname, "..", "Servico de impressao", "DNMS Impressao.cmd"), "utf8");
  const installCmd = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "DNMS Instalar Atualizar.cmd"),
    "utf8"
  );
  const validateCmd = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "DNMS Validar Instalacao.cmd"),
    "utf8"
  );
  const continuousValidationCmd = fs.readFileSync(
    path.join(__dirname, "..", "Servico de impressao", "DNMS Validacao Continua.cmd"),
    "utf8"
  );
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const print = fs.readFileSync(path.join(__dirname, "..", "print.js"), "utf8");

  expect(server).toContain('const HOST = process.env.PRINT_SERVICE_HOST || "127.0.0.1"');
  expect(server).toContain("app.listen(PORT, HOST");
  expect(server).toContain("PRINT_SERVICE_TOKEN");
  expect(server).toContain("authorizePrintRequest(req, res)");
  expect(server).toContain("PRINT_ALLOWED_ORIGINS");
  expect(server).toContain("validatePrintPayload");
  expect(server).toContain("Conteudo de impressao contem elementos nao permitidos.");
  expect(server).toContain('const CHECKIN_PRINT_SELECT_COLUMNS = "id,student_id,class_name,notes_snapshot,room_name_snapshot,printed_at,checked_out_at"');
  expect(server).toContain('const STUDENT_PRINT_SELECT_COLUMNS = "name,primary_guardian_name,notes,class_name"');
  expect(server).toContain("validateAutoPrintLabelData(labelData, checkinId)");
  expect(server).toContain("Dados insuficientes para imprimir checkin");
  expect(server).toContain("getTargetPrinterStatus");
  expect(server).toContain("readWindowsPrinterStatus");
  expect(server).toContain("evaluateWindowsPrinterReadiness");
  expect(server).toContain("SpoolerPrinterStatus");
  expect(server).toContain("if (isMarkedOffline || hasKnownOfflineState || hasKnownErrorCode)");
  expect(server).not.toContain("Win32 marca offline, mas o spooler do Windows esta Normal");
  expect(server).toContain("auto_print_realtime_status");
  expect(server).toContain("auto_print_last_poll");
  expect(server).toContain("canUseAutoPrintDataAccess");
  expect(server).toContain("Autoimpressao do celular requer DATABASE_URL ou Service Role no servico local.");
  expect(server).toContain("and checked_out_at is null");
  expect(server).toContain('.is("checked_out_at", null)');
  expect(server).toContain("Check-in ja recebeu checkout; autoimpressao ignorada.");
  expect(server).toContain("printQueue.enqueue");
  expect(server).toContain("res.status(202).json");
  expect(server).toContain('app.get("/print/:jobId"');
  expect(server).toContain("JobStore");
  expect(server).toContain("PrintQueue");
  expect(server).toContain("PrintWorker");
  expect(server).toContain("WindowsPdfPrintAdapter");
  expect(server).toContain("enqueueCheckinPrintJob");
  expect(server).toContain("waitForPrinterQueueToSettle");
  expect(adapter).toContain("this.waitForPrinterQueueToSettle(printer.name, pdfPath)");
  expect(fs.readFileSync(path.join(__dirname, "..", "Servico de impressao", "src", "sqlite3-runtime.js"), "utf8"))
    .toContain('native", "sqlite3", "node_sqlite3.node"');
  expect(adapter).toContain("hooks.onSpoolerAccepted");
  expect(server).toContain("readWindowsPrintJobs");
  expect(server).toContain("printer_queue_length");
  expect(server).toContain("printer_queue_jobs");
  expect(server).toContain("runtime_diagnostics");
  expect(server).toContain("http_diagnostics");
  expect(server).toContain("diagnostics: diagnosticItems");
  expect(server).toContain("BROTHER_NOT_FOUND");
  expect(server).toContain("BROTHER_QUEUE_BLOCKED");
  expect(server).toContain("CHROMIUM_MISSING");
  expect(server).toContain("SUMATRA_MISSING");
  expect(server).toContain("PRINT_TOKEN_MISSING_OR_INVALID");
  expect(server).toContain("PRINT_ORIGIN_DENIED");
  expect(server).toContain("EADDRINUSE");
  expect(server).toContain("Etiqueta enviada para a fila da Brother, mas o Windows nao confirmou a saida da fila.");
  expect(server).toContain("printer_ready");
  expect(server).toContain("printer_status_detail");
  expect(server).toContain("Brother encontrada, mas a fila esta offline ou com erro no Windows.");
  expect(server.indexOf("validatePrintPayload({ checkinId, conteudo })")).toBeLessThan(
    server.indexOf("printQueue.enqueue")
  );
  expect(server.indexOf("validateAutoPrintLabelData(labelData, checkinId)")).toBeLessThan(
    server.indexOf("const html = buildLabelDocumentHtml(labelData)")
  );
  const listenerPrintBlock = server.slice(
    server.indexOf("async function enqueueCheckinPrintJob"),
    server.indexOf("async function processPendingCheckins")
  );
  expect(listenerPrintBlock).not.toContain("routeType");
  expect(listenerPrintBlock).not.toContain("validatePrintPayload");
  expect(listenerPrintBlock).not.toContain("await print(pdfPath");

  expect(app).toContain('const PRINT_SERVICE_TOKEN_KEY = "dnms_print_service_token"');
  expect(app).toContain('"X-DNMS-Print-Token"');
  expect(app).toContain("headers: getPrintServiceHeaders()");

  expect(print).toContain('const PRINT_SERVICE_TOKEN_KEY = "dnms_print_service_token"');
  expect(print).toContain('"X-DNMS-Print-Token"');
  expect(print).toContain("headers: getPrintServiceHeaders()");
  expect(app).toContain("fetchPrintJobStatus");
  expect(app).toContain("/print/${encodeURIComponent(jobId)}");
  expect(print).toContain("fetchPrintJobStatus");
  expect(print).toContain("/print/${encodeURIComponent(jobId)}");
  expect(print).toContain('.select("student_id,checked_in_at")\n    .not("student_id", "is", null)\n    .is("checked_out_at", null)');
  expect(print).toContain('.select("*")\n    .eq("student_id", studentId)\n    .is("checked_out_at", null)');

  expect(printJob).toContain('QUEUED: "QUEUED"');
  expect(printJob).toContain('PRINTING: "PRINTING"');
  expect(printJob).toContain('SENT_TO_SPOOLER: "SENT_TO_SPOOLER"');
  expect(printJob).toContain('SPOOLER_DONE: "SPOOLER_DONE"');
  expect(printJob).toContain('FAILED: "FAILED"');
  expect(printJob).toContain('CANCELLED: "CANCELLED"');
  expect(printJob).toContain("createPrintJob");
  expect(printJob).toContain("dedupeKey");
  expect(printJob).toContain("windowsJobId");
  expect(printJob).toContain("completedReason");
  expect(printJob).toContain("spoolerAcceptedAt");
  expect(printJob).not.toContain('PRINTED: "PRINTED"');

  expect(packagePortable).toContain("DNMS Instalar Atualizar.cmd");
  expect(packagePortable).toContain("DNMS Validar Instalacao.cmd");
  expect(packagePortable).toContain("DNMS Validacao Continua.cmd");
  expect(startServiceUi).toContain("PRINT_SERVICE_PORT");
  expect(startServiceUi).toContain("Validar instalacao");
  expect(startServiceUi).toContain("validate-install.ps1");
  expect(validateInstall).toContain("DNMS Impressao - validacao da instalacao");
  expect(validateInstall).toContain("EXE_MISSING");
  expect(validateInstall).toContain("SUMATRA_MISSING");
  expect(validateInstall).toContain("CHROMIUM_MISSING");
  expect(validateInstall).toContain("ADMIN_DATA_MISSING");
  expect(validateInstall).not.toContain("DATABASE_URL=");
  expect(validateRealEnvironment).toContain("DNMS Impressao - validacao continua");
  expect(validateRealEnvironment).toContain("Invoke-HealthValidation");
  expect(validateRealEnvironment).toContain("printer_queue_length");
  expect(validateRealEnvironment).toContain("SPOOLER_DONE");
  expect(validateRealEnvironment).not.toContain("DATABASE_URL=");
  expect(installPortable).toContain("Atalho criado/atualizado");
  expect(installPortable).toContain("Validacao falhou");
  expect(launcher).toContain("Extraia novamente o ZIP portable completo.");
  expect(installCmd).toContain("install-portable.ps1");
  expect(validateCmd).toContain("validate-install.ps1");
  expect(continuousValidationCmd).toContain("validate-real-environment.ps1");
  expect(continuousValidationCmd).toContain("-Watch");
});

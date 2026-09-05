const express = require("express");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const puppeteer = require("puppeteer-core");
const { print, getPrinters } = require("pdf-to-printer");
const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");

const execFileAsync = promisify(execFile);
loadEnvFromFiles();
const PORT = Number(process.env.PRINT_SERVICE_PORT || 3001);
const HOST = process.env.PRINT_SERVICE_HOST || "127.0.0.1";
const REQUIRED_PRINTER_HINT = "BROTHER QL-810W";
const AUTO_PRINT_POLL_INTERVAL_MS = Number(process.env.AUTO_PRINT_POLL_INTERVAL_MS || 1000);
const PRINT_JOB_SETTLE_TIMEOUT_MS = Number(process.env.PRINT_JOB_SETTLE_TIMEOUT_MS || 20000);
const PRINT_JOB_SETTLE_POLL_MS = Number(process.env.PRINT_JOB_SETTLE_POLL_MS || 750);
const SUPABASE_URL_DEFAULT = "https://ziuezwtmmnspkycixqtf.supabase.co";
const SUPABASE_ANON_KEY_DEFAULT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWV6d3RtbW5zcGt5Y2l4cXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjY2NjksImV4cCI6MjA5MDIwMjY2OX0.WCPR3YQyJqyChtYjNMXgYXipRiEYf4_BJjS8-RalZj4";

const PRINT_SERVICE_TOKEN = process.env.PRINT_SERVICE_TOKEN || "";
const PRINT_ALLOWED_ORIGINS = parseAllowedOrigins(process.env.PRINT_ALLOWED_ORIGINS || "");
const SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_URL_DEFAULT;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_ACCESS_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_DEFAULT;
const supabaseClient = SUPABASE_ACCESS_KEY ? createClient(SUPABASE_URL, SUPABASE_ACCESS_KEY) : null;
const DATABASE_URL = process.env.DATABASE_URL || "";
const pgPool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const canUseDirectDatabase = Boolean(pgPool);
const canUseAutoPrintDataAccess = Boolean(pgPool || SUPABASE_SERVICE_ROLE_KEY);
const canUseReprintQueue = Boolean(SUPABASE_SERVICE_ROLE_KEY || pgPool);
const CHECKIN_PRINT_SELECT_COLUMNS = "id,student_id,class_name,notes_snapshot,room_name_snapshot,printed_at,checked_out_at";
const STUDENT_PRINT_SELECT_COLUMNS = "name,primary_guardian_name,notes,class_name";

const autoPrintQueue = [];
const autoPrintSeen = new Set();
const reprintJobSeen = new Set();
const PRINT_WORKER_ID = `${os.hostname()}-${process.pid}`;
let autoPrintProcessing = false;
let reprintJobProcessing = false;
let realtimeChannel = null;
let reprintJobsChannel = null;
let autoPrintPollTimer = null;
let reprintJobPollTimer = null;
let browserInstance = null;
let browserLaunchPromise = null;
let lastAutoPrintPoll = {
  checked_at: null,
  pending_count: 0,
  enqueued_count: 0,
  error: ""
};
let realtimeStatus = "not_started";

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin || "";
  if (origin && PRINT_ALLOWED_ORIGINS.size && !PRINT_ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({ ok: false, error: "Origem nao autorizada para impressao local." });
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-DNMS-Print-Token");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "5mb" }));

app.get("/", (_req, res) => {
  res.redirect("/status");
});

app.get("/status", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(buildStatusPageHtml());
});

app.get("/health", async (_req, res) => {
  try {
    res.json(await buildHealthPayload());
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.post("/print", async (req, res) => {
  if (!authorizePrintRequest(req, res)) {
    return;
  }
  await handlePrintRequest(req, res, "print");
});

app.post("/reprint", async (req, res) => {
  if (!authorizePrintRequest(req, res)) {
    return;
  }
  await handlePrintRequest(req, res, "reprint");
});

async function handlePrintRequest(req, res, routeType) {
  const startedAt = new Date();
  const payload = req.body || {};
  const checkinId = String(payload.checkin_id || "").trim();
  const conteudo = String(payload.conteudo || "");
  const tipo = String(payload.tipo || routeType).trim().toLowerCase();

  if (!checkinId || !conteudo) {
    logPrint({
      checkinId: checkinId || "-",
      tipo: tipo || routeType,
      date: startedAt,
      status: "erro",
      details: "Payload invalido: checkin_id e conteudo sao obrigatorios."
    });
    res.status(400).json({
      ok: false,
      error: "Payload invalido. Campos obrigatorios: checkin_id e conteudo."
    });
    return;
  }

  if (tipo !== "print" && tipo !== "reprint") {
    logPrint({
      checkinId,
      tipo,
      date: startedAt,
      status: "erro",
      details: "Tipo invalido. Use print ou reprint."
    });
    res.status(400).json({ ok: false, error: "Campo tipo invalido. Use print ou reprint." });
    return;
  }

  if (tipo !== routeType) {
    logPrint({
      checkinId,
      tipo,
      date: startedAt,
      status: "erro",
      details: `Tipo divergente para endpoint ${routeType}.`
    });
    res.status(400).json({ ok: false, error: "Tipo divergente do endpoint solicitado." });
    return;
  }

  const validation = validatePrintPayload({ checkinId, conteudo });
  if (!validation.ok) {
    logPrint({
      checkinId,
      tipo,
      date: startedAt,
      status: "erro",
      details: validation.error
    });
    res.status(400).json({ ok: false, error: validation.error });
    return;
  }

  if (tipo === "print" && autoPrintSeen.has(checkinId)) {
    logPrint({
      checkinId,
      tipo,
      date: startedAt,
      status: "ignorado",
      details: "Check-in ja reservado pelo auto-print; evitando etiqueta duplicada."
    });
    res.json({ ok: true, checkin_id: checkinId, tipo, status: "ja_reservado" });
    return;
  }

  if (tipo === "print") {
    autoPrintSeen.add(checkinId);
  }

  try {
    const printer = await getTargetPrinterOrThrow();
    await assertPrinterQueueReady(printer.name);
    const pdfPath = await renderHtmlToPdf(conteudo);
    try {
      await print(pdfPath, {
        printer: printer.name,
        sumatraPdfPath: resolveSumatraPdfPath(),
        pages: "1"
      });
      await waitForPrinterQueueToSettle(printer.name, pdfPath);
    } finally {
      await safeUnlink(pdfPath);
    }
    if (tipo === "print") {
      await markCheckinPrinted(checkinId);
    }

    logPrint({
      checkinId,
      tipo,
      date: startedAt,
      status: "sucesso",
      details: `Impressora utilizada: ${printer.name || "-"}`
    });
    res.json({ ok: true, checkin_id: checkinId, tipo, status: "sucesso" });
  } catch (error) {
    logPrint({
      checkinId,
      tipo,
      date: startedAt,
      status: "erro",
      details: error?.stack || error?.message || String(error)
    });
    res.status(500).json({
      ok: false,
      checkin_id: checkinId,
      tipo,
      status: "erro",
      error: error?.message || "Falha ao imprimir."
    });
    if (tipo === "print") {
      autoPrintSeen.delete(checkinId);
    }
  }
}

async function getTargetPrinterOrThrow() {
  const status = await getTargetPrinterStatus();
  if (!status.installed) {
    throw new Error(status.error || `Impressora obrigatoria nao encontrada (${REQUIRED_PRINTER_HINT}).`);
  }
  if (!status.ready) {
    throw new Error(status.error || `Impressora ${status.name || REQUIRED_PRINTER_HINT} indisponivel.`);
  }
  return status.printer;
}

async function getTargetPrinterStatus() {
  const printers = await getPrinters();
  if (!Array.isArray(printers) || !printers.length) {
    return {
      installed: false,
      ready: false,
      name: "",
      status: "not_found",
      detail: "Nenhuma impressora disponivel no sistema.",
      error: "Nenhuma impressora disponivel no sistema."
    };
  }

  const normalized = printers.map((printer) => ({
    raw: printer,
    name: String(printer.name || "").trim(),
    key: String(printer.name || "").trim().toUpperCase()
  }));

  const selected = normalized.find((item) => item.key.includes(REQUIRED_PRINTER_HINT));
  if (!selected?.raw) {
    const available = normalized.map((item) => item.name).filter(Boolean).join(" | ");
    const error = `Impressora obrigatoria nao encontrada (${REQUIRED_PRINTER_HINT}). Disponiveis: ${available || "-"}`;
    return {
      installed: false,
      ready: false,
      name: "",
      status: "not_found",
      detail: error,
      error
    };
  }

  const windowsStatus = await readWindowsPrinterStatus(selected.name);
  const readiness = evaluateWindowsPrinterReadiness(windowsStatus);
  return {
    installed: true,
    ready: readiness.ready,
    name: selected.name,
    printer: selected.raw,
    status: readiness.status,
    detail: readiness.detail,
    windows_status: windowsStatus
  };
}

async function readWindowsPrinterStatus(printerName) {
  if (process.platform !== "win32" || !printerName) {
    return null;
  }
  const psCommand = `
$name = ${JSON.stringify(printerName)}
$win32 = Get-CimInstance Win32_Printer | Where-Object { $_.Name -eq $name } | Select-Object -First 1 Name,WorkOffline,PrinterStatus,DetectedErrorState,ExtendedPrinterStatus,PrinterState,Availability,PortName,DriverName
$spooler = Get-Printer -Name $name -ErrorAction SilentlyContinue | Select-Object -First 1 Name,PrinterStatus,Type,PortName,DriverName,JobCount
if ($win32 -or $spooler) {
  [pscustomobject]@{
    Name = if ($win32) { $win32.Name } else { $spooler.Name }
    WorkOffline = if ($win32) { $win32.WorkOffline } else { $null }
    PrinterStatus = if ($win32) { $win32.PrinterStatus } else { $spooler.PrinterStatus }
    DetectedErrorState = if ($win32) { $win32.DetectedErrorState } else { $null }
    ExtendedPrinterStatus = if ($win32) { $win32.ExtendedPrinterStatus } else { $null }
    PrinterState = if ($win32) { $win32.PrinterState } else { $null }
    Availability = if ($win32) { $win32.Availability } else { $null }
    PortName = if ($spooler) { $spooler.PortName } elseif ($win32) { $win32.PortName } else { $null }
    DriverName = if ($spooler) { $spooler.DriverName } elseif ($win32) { $win32.DriverName } else { $null }
    SpoolerPrinterStatus = if ($spooler) { [string]$spooler.PrinterStatus } else { $null }
    SpoolerType = if ($spooler) { [string]$spooler.Type } else { $null }
    SpoolerJobCount = if ($spooler) { $spooler.JobCount } else { $null }
  } | ConvertTo-Json -Compress -Depth 3
}
`;
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand],
      { windowsHide: true, timeout: 3500, maxBuffer: 1024 * 64 }
    );
    const raw = String(stdout || "").trim();
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return {
      status_error: error?.message || String(error)
    };
  }
}

async function assertPrinterQueueReady(printerName) {
  const jobs = await readWindowsPrintJobs(printerName);
  if (!jobs.length) {
    return;
  }
  throw new Error(
    `Fila da Brother possui ${jobs.length} etiqueta(s) pendente(s). Limpe ou libere a fila no Windows antes de imprimir novos check-ins.`
  );
}

async function waitForPrinterQueueToSettle(printerName, documentPath) {
  const startedAt = Date.now();
  const documentName = path.basename(documentPath || "");
  while (Date.now() - startedAt < PRINT_JOB_SETTLE_TIMEOUT_MS) {
    const jobs = await readWindowsPrintJobs(printerName);
    const matchingJobs = jobs.filter((job) => isPrintJobForDocument(job, documentPath, documentName));
    if (!matchingJobs.length) {
      return;
    }
    await delay(PRINT_JOB_SETTLE_POLL_MS);
  }
  throw new Error(
    "Etiqueta enviada para a fila da Brother, mas o Windows nao confirmou a saida da fila. O check-in continuara pendente para impressao."
  );
}

async function readWindowsPrintJobs(printerName) {
  if (process.platform !== "win32" || !printerName) {
    return [];
  }
  const psCommand = `
$name = ${JSON.stringify(printerName)}
$jobs = Get-PrintJob -PrinterName $name -ErrorAction Stop | Select-Object ID,DocumentName,JobStatus,SubmittedTime,Size,UserName
if ($jobs) { $jobs | ConvertTo-Json -Compress -Depth 3 }
`;
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand],
      { windowsHide: true, timeout: 3500, maxBuffer: 1024 * 64 }
    );
    const raw = String(stdout || "").trim();
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.warn("[Servico de impressao] falha ao consultar fila da Brother:", error?.message || error);
    return [];
  }
}

function isPrintJobForDocument(job, documentPath, documentName) {
  const value = String(job?.DocumentName || "");
  if (!value) {
    return false;
  }
  return (documentPath && value === documentPath) || (documentName && value.endsWith(documentName));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function evaluateWindowsPrinterReadiness(status) {
  if (!status) {
    return {
      ready: process.platform !== "win32",
      status: "unknown",
      detail: process.platform === "win32"
        ? "Brother encontrada, mas o Windows nao confirmou o estado online."
        : "Impressora encontrada; estado online nao confirmado pelo sistema."
    };
  }
  if (status.status_error) {
    return {
      ready: false,
      status: "unknown",
      detail: `Impressora encontrada; nao foi possivel ler estado do Windows: ${status.status_error}`
    };
  }

  const fields = [
    status.PrinterStatus,
    status.ExtendedPrinterStatus,
    status.DetectedErrorState,
    status.PrinterState,
    status.Availability
  ]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value).toLowerCase());

  const hasKnownOfflineState = fields.some((value) =>
    /\boffline\b|paper\s*out|no\s*toner|door\s*open|error|jam|paused|not\s*available|degraded|user\s*intervention|server\s*unknown/.test(
      value
    )
  );
  const hasKnownErrorCode = [4, 5, 6, 7, 8, 9, 10, 11, 12].some(
    (code) => Number(status.DetectedErrorState) === code
  );
  const isMarkedOffline = status.WorkOffline === true || String(status.WorkOffline).toLowerCase() === "true";
  const spoolerStatus = String(status.SpoolerPrinterStatus || "").toLowerCase();

  if (isMarkedOffline || hasKnownOfflineState || hasKnownErrorCode) {
    return {
      ready: false,
      status: "offline",
      detail: "Brother encontrada, mas a fila esta offline ou com erro no Windows."
    };
  }

  if (spoolerStatus && spoolerStatus !== "normal" && spoolerStatus !== "idle") {
    return {
      ready: false,
      status: "offline",
      detail: `Brother encontrada, mas o spooler esta ${status.SpoolerPrinterStatus}.`
    };
  }

  return {
    ready: true,
    status: "online",
    detail: "Brother encontrada e sem erro/offline reportado pelo Windows."
  };
}

async function markCheckinPrinted(checkinId) {
  if (!checkinId) {
    return;
  }
  try {
    if (pgPool) {
      await pgPool.query("update public.checkins set printed_at = now() where id = $1", [checkinId]);
      return;
    }
    if (!supabaseClient) {
      return;
    }
    await supabaseClient.from("checkins").update({ printed_at: new Date().toISOString() }).eq("id", checkinId);
  } catch (_error) {
    // sem bloqueio de fluxo
  }
}

async function renderHtmlToPdf(htmlContent) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "servico-impressao-"));
  const pdfPath = path.join(tempDir, `etiqueta-${Date.now()}.pdf`);
  const browser = await getSharedBrowser();
  let page = null;

  try {
    page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
    await page.pdf({
      path: pdfPath,
      width: "90mm",
      height: "29mm",
      printBackground: true,
      preferCSSPageSize: true,
      pageRanges: "1",
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }

  return pdfPath;
}

async function getSharedBrowser() {
  if (browserInstance?.isConnected()) {
    return browserInstance;
  }
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }
  const executablePath = resolveBrowserExecutablePath();
  browserLaunchPromise = puppeteer
    .launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    })
    .then((browser) => {
      browserInstance = browser;
      browserLaunchPromise = null;
      browser.on("disconnected", () => {
        if (browserInstance === browser) {
          browserInstance = null;
        }
      });
      return browser;
    })
    .catch((error) => {
      browserLaunchPromise = null;
      throw error;
    });
  return browserLaunchPromise;
}

async function warmSharedBrowser() {
  try {
    await getSharedBrowser();
    console.log("[Servico de impressao] navegador de impressao pre-aquecido.");
  } catch (error) {
    console.warn("[Servico de impressao] falha ao pre-aquecer navegador:", error?.message || error);
  }
}

async function closeSharedBrowser() {
  const browser = browserInstance;
  browserInstance = null;
  if (browser?.isConnected()) {
    await browser.close().catch(() => {});
  }
}

function resolveBrowserExecutablePath() {
  const custom = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (custom && fsSync.existsSync(custom)) {
    return custom;
  }

  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];

  const found = candidates.find((item) => fsSync.existsSync(item));
  if (!found) {
    throw new Error(
      "Navegador Chromium nao encontrado. Instale Google Chrome ou Edge, ou defina CHROME_PATH."
    );
  }
  return found;
}

function resolveSumatraPdfPath() {
  const candidates = [
    path.join(process.cwd(), "bin", "SumatraPDF.exe"),
    path.join(__dirname, "bin", "SumatraPDF.exe"),
    path.join(process.cwd(), "node_modules", "pdf-to-printer", "dist", "SumatraPDF-3.4.6-32.exe"),
    path.join(__dirname, "node_modules", "pdf-to-printer", "dist", "SumatraPDF-3.4.6-32.exe")
  ];
  const found = candidates.find((item) => fsSync.existsSync(item));
  if (!found) {
    throw new Error(
      "SumatraPDF nao encontrado. Execute 'cmd /c npm run prepare:sumatra' para copiar o binario."
    );
  }
  return found;
}

function buildLabelDocumentHtml({ studentName, className, guardian, notes }) {
  const safeName = studentName || "Aluno";
  const safeClass = className || "-";
  const safeGuardian = guardian || "-";
  const safeNotes = notes || "-";
  const labelBodyHtml = `
    <div class="label-name">${escapeHtml(safeName)}</div>
    <div class="label-body">
      <div class="label-line">Turma: ${escapeHtml(safeClass)}</div>
      <div class="label-line">Responsavel: ${escapeHtml(safeGuardian)}</div>
      <div class="label-line">Observacao: ${escapeHtml(safeNotes)}</div>
    </div>
  `;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page { size: 90mm 29mm; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 90mm;
      height: 29mm;
      overflow: hidden;
      background: #fff;
    }
    .label {
      width: 90mm;
      height: 29mm;
      border: 0.2mm solid #111;
      padding: 1.4mm;
      border-radius: 1.2mm;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      gap: 0.95mm;
      font-size: 3.2mm;
      line-height: 1.1;
      font-family: Arial, "Segoe UI", sans-serif;
      color: #111;
      box-sizing: border-box;
      overflow: hidden;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    .label-name {
      text-align: center;
      font-size: 4.8mm;
      font-weight: 700;
      width: 100%;
      word-break: break-word;
      line-height: 1.08;
      overflow-wrap: anywhere;
      margin-bottom: 1.4mm;
      padding-bottom: 0.8mm;
      border-bottom: 0.2mm solid #222;
    }
    .label-line {
      width: 100%;
      text-align: center;
      word-break: break-word;
      overflow-wrap: anywhere;
      line-height: 1.12;
    }
    .label-body {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.95mm;
    }
  </style>
</head>
<body>
  <div class="label">${labelBodyHtml}</div>
</body>
</html>`;
}

function enqueueAutoPrint(checkinId) {
  if (!checkinId || autoPrintSeen.has(checkinId)) {
    return;
  }
  autoPrintSeen.add(checkinId);
  autoPrintQueue.push(checkinId);
  processAutoPrintQueue();
}

async function processAutoPrintQueue() {
  if (autoPrintProcessing || !autoPrintQueue.length) {
    return;
  }
  autoPrintProcessing = true;
  while (autoPrintQueue.length) {
    const checkinId = autoPrintQueue.shift();
    try {
      await printCheckinById(checkinId);
    } catch (error) {
      autoPrintSeen.delete(checkinId);
      console.warn(`[Servico de impressao] falha no auto-print do checkin ${checkinId}:`, error?.message || error);
    }
  }
  autoPrintProcessing = false;
}

async function printCheckinById(checkinId, options = {}) {
  if (!checkinId || (!supabaseClient && !pgPool)) {
    return;
  }
  const checkin = await fetchCheckinForPrint(checkinId);
  const isReprint = options.type === "reprint";
  if (checkin.printed_at && !isReprint) {
    return;
  }
  if (checkin.checked_out_at && !isReprint) {
    logPrint({
      checkinId,
      tipo: "print",
      date: new Date(),
      status: "ignorado",
      details: "Check-in ja recebeu checkout; autoimpressao ignorada."
    });
    return;
  }

  const student = await fetchStudentForPrint(checkin.student_id, checkinId);

  const labelData = buildCheckinLabelData(checkin, student);
  validateAutoPrintLabelData(labelData, checkinId);
  const html = buildLabelDocumentHtml(labelData);

  const printer = await getTargetPrinterOrThrow();
  await assertPrinterQueueReady(printer.name);
  const pdfPath = await renderHtmlToPdf(html);
  try {
    await print(pdfPath, {
      printer: printer.name,
      sumatraPdfPath: resolveSumatraPdfPath(),
      pages: "1"
    });
    await waitForPrinterQueueToSettle(printer.name, pdfPath);
  } finally {
    await safeUnlink(pdfPath);
  }
  if (!isReprint) {
    await markCheckinPrinted(checkinId);
  }
  logPrint({
    checkinId,
    tipo: isReprint ? "reprint" : "print",
    date: new Date(),
    status: "sucesso",
    details: `${isReprint ? "Reimpressao via fila" : "Auto-print via listener"} (${printer.name || "-"})`
  });
}

async function buildHealthPayload() {
  const printerStatus = await getTargetPrinterStatus();
  const printerQueue = printerStatus.name ? await readWindowsPrintJobs(printerStatus.name) : [];
  return {
    ok: Boolean(printerStatus.installed && printerStatus.ready),
    status: printerStatus.ready ? "online" : printerStatus.status,
    target_printer: printerStatus.name || "",
    printer_installed: Boolean(printerStatus.installed),
    printer_ready: Boolean(printerStatus.ready),
    printer_status: printerStatus.status,
    printer_status_detail: printerStatus.detail,
    printer_windows_status: printerStatus.windows_status || null,
    printer_queue_length: printerQueue.length,
    auto_print_listener: Boolean(canUseAutoPrintDataAccess),
    auto_print_realtime_status: realtimeStatus,
    auto_print_polling: Boolean(autoPrintPollTimer),
    auto_print_last_poll: lastAutoPrintPoll,
    auto_print_processing: Boolean(autoPrintProcessing || autoPrintQueue.length),
    auto_print_queue_length: autoPrintQueue.length,
    reprint_queue_listener: Boolean(supabaseClient && SUPABASE_SERVICE_ROLE_KEY),
    reprint_queue_polling: Boolean(reprintJobPollTimer),
    reprint_queue_processing: Boolean(reprintJobProcessing),
    supabase_role: resolveServiceDataRole(),
    database_direct: canUseDirectDatabase
  };
}

async function fetchCheckinForPrint(checkinId) {
  if (pgPool) {
    const { rows } = await pgPool.query(
      `select id, student_id, class_name, notes_snapshot, room_name_snapshot, printed_at, checked_out_at
       from public.checkins
       where id = $1
       limit 1`,
      [checkinId]
    );
    if (!rows[0]) {
      throw new Error("checkin nao encontrado: -");
    }
    return rows[0];
  }
  const { data, error } = await supabaseClient
    .from("checkins")
    .select(CHECKIN_PRINT_SELECT_COLUMNS)
    .eq("id", checkinId)
    .single();
  if (error || !data) {
    throw new Error(`checkin nao encontrado: ${error?.message || "-"}`);
  }
  return data;
}

async function fetchStudentForPrint(studentId, checkinId) {
  if (!studentId) {
    return null;
  }
  if (pgPool) {
    const { rows } = await pgPool.query(
      `select name, primary_guardian_name, notes, class_name
       from public.students
       where id = $1
       limit 1`,
      [studentId]
    );
    return rows[0] || null;
  }
  const { data, error } = await supabaseClient
    .from("students")
    .select(STUDENT_PRINT_SELECT_COLUMNS)
    .eq("id", studentId)
    .single();
  if (error) {
    console.warn(
      `[Servico de impressao] falha ao buscar dados da crianca para checkin ${checkinId}:`,
      error.message || error
    );
    return null;
  }
  return data;
}

function buildCheckinLabelData(checkin, student) {
  return {
    studentName: cleanLabelValue(student?.name),
    className: cleanLabelValue(checkin?.class_name) || cleanLabelValue(student?.class_name),
    guardian: cleanLabelValue(student?.primary_guardian_name),
    notes: cleanLabelValue(checkin?.notes_snapshot) || cleanLabelValue(student?.notes) || "-"
  };
}

function validateAutoPrintLabelData(labelData, checkinId) {
  const missing = [];
  if (!labelData.studentName) {
    missing.push("nome");
  }
  if (!labelData.className) {
    missing.push("turma");
  }
  if (!labelData.guardian) {
    missing.push("responsavel");
  }
  if (missing.length) {
    throw new Error(`Dados insuficientes para imprimir checkin ${checkinId}: ${missing.join(", ")}.`);
  }
}

function buildStatusPageHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Status da impressao DNMS</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7f5;
      --panel: #ffffff;
      --text: #18211d;
      --muted: #65716c;
      --line: #d8e1dc;
      --ok: #1f9d55;
      --off: #c73434;
      --busy: #1f6feb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, "Segoe UI", sans-serif;
      padding: 28px;
    }
    main {
      width: min(760px, 100%);
      margin: 0 auto;
      display: grid;
      gap: 18px;
    }
    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    .updated {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(27, 39, 34, 0.08);
      overflow: hidden;
    }
    .status-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
    }
    .status-item {
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
    }
    .status-item:last-child { border-bottom: 0; }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      margin-top: 4px;
      background: var(--off);
      box-shadow: 0 0 0 4px rgba(199, 52, 52, 0.12);
    }
    .dot.ok {
      background: var(--ok);
      box-shadow: 0 0 0 4px rgba(31, 157, 85, 0.13);
    }
    .dot.busy {
      background: var(--busy);
      box-shadow: 0 0 0 4px rgba(31, 111, 235, 0.13);
    }
    .label {
      display: block;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .detail {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    button {
      border: 1px solid var(--line);
      background: #fff;
      color: var(--text);
      border-radius: 6px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { border-color: #9fb1a8; }
    @media (max-width: 620px) {
      body { padding: 16px; }
      header { display: grid; }
      .updated { white-space: normal; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Status da impressao</h1>
      <div id="updated" class="updated">Carregando...</div>
    </header>
    <section class="panel" aria-label="Status do servico">
      <ul id="statusList" class="status-list"></ul>
    </section>
    <div class="actions">
      <button type="button" id="refreshButton">Atualizar agora</button>
    </div>
  </main>
  <script>
    const list = document.getElementById("statusList");
    const updated = document.getElementById("updated");
    const refreshButton = document.getElementById("refreshButton");

    function statusItem(state, label, detail) {
      const item = document.createElement("li");
      item.className = "status-item";
      const dot = document.createElement("span");
      dot.className = "dot " + state;
      const body = document.createElement("span");
      const title = document.createElement("span");
      title.className = "label";
      title.textContent = label;
      const description = document.createElement("span");
      description.className = "detail";
      description.textContent = detail;
      body.append(title, description);
      item.append(dot, body);
      return item;
    }

    function setItems(items) {
      list.replaceChildren(...items.map((item) => statusItem(item.state, item.label, item.detail)));
      updated.textContent = "Atualizado em " + new Date().toLocaleString("pt-BR");
    }

    async function refreshStatus() {
      try {
        const response = await fetch("/health", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        const health = await response.json();
        const printingBusy = Boolean(health.auto_print_processing || health.reprint_queue_processing);
        const printerQueueLength = Number(health.printer_queue_length || 0);
        setItems([
          {
            state: "ok",
            label: "Servico local",
            detail: "Online e recebendo pedidos neste computador."
          },
          {
            state: health.printer_ready && !printerQueueLength ? "ok" : "off",
            label: "Impressora Brother",
            detail: health.target_printer
              ? health.target_printer + " - " + (health.printer_status_detail || "estado nao confirmado") +
                (printerQueueLength ? " Fila: " + printerQueueLength + " etiqueta(s) pendente(s)." : "")
              : (health.printer_status_detail || "Brother QL-810W nao encontrada no Windows.")
          },
          {
            state: getAutoPrintState(health, printingBusy),
            label: "Autoimpressao do celular",
            detail: buildAutoPrintDetail(health, printingBusy)
          },
          {
            state: printerQueueLength ? "off" : "ok",
            label: "Fila da Brother",
            detail: printerQueueLength
              ? printerQueueLength + " etiqueta(s) presa(s). Limpe/libere a fila no Windows."
              : "Sem etiquetas pendentes na fila local."
          }
        ]);
      } catch (error) {
        setItems([
          {
            state: "off",
            label: "Servico local",
            detail: "Nao foi possivel consultar o status. Confirme se o DNMS Impressao esta aberto."
          }
        ]);
      }
    }

    function buildAutoPrintDetail(health, printingBusy) {
      const poll = health.auto_print_last_poll || {};
      const lastPoll = poll.checked_at ? new Date(poll.checked_at).toLocaleString("pt-BR") : "ainda nao executada";
      if (poll.error) {
        return poll.error;
      }
      if (health.supabase_role === "anon") {
        return "Inativa: configure DATABASE_URL ou Service Role neste computador para imprimir check-ins feitos pelo celular.";
      }
      const base = printingBusy ? "Processando etiqueta." : "Ativa e aguardando novos check-ins.";
      return base +
        " Ultima varredura: " + lastPoll +
        ". Pendentes ativos: " + (poll.pending_count || 0) +
        ". Fila interna: " + (health.auto_print_queue_length || 0) + ".";
    }

    function getAutoPrintState(health, printingBusy) {
      if (printingBusy) {
        return "busy";
      }
      const poll = health.auto_print_last_poll || {};
      if (poll.error) {
        return "off";
      }
      if (health.supabase_role !== "anon" && (health.auto_print_realtime_status === "SUBSCRIBED" || health.auto_print_polling)) {
        return "ok";
      }
      return "off";
    }

    refreshButton.addEventListener("click", refreshStatus);
    refreshStatus();
    setInterval(refreshStatus, 5000);
  </script>
</body>
</html>`;
}

function cleanLabelValue(value) {
  return String(value || "").trim();
}

function resolveServiceDataRole() {
  if (SUPABASE_SERVICE_ROLE_KEY) {
    return "service_role";
  }
  if (pgPool) {
    return "postgres_direct";
  }
  return "anon";
}

async function processPendingCheckins() {
  if (!canUseAutoPrintDataAccess) {
    lastAutoPrintPoll = {
      checked_at: new Date().toISOString(),
      pending_count: 0,
      enqueued_count: 0,
      error: "Autoimpressao do celular requer DATABASE_URL ou Service Role no servico local."
    };
    return;
  }
  lastAutoPrintPoll = {
    checked_at: new Date().toISOString(),
    pending_count: 0,
    enqueued_count: 0,
    error: ""
  };
  if (pgPool) {
    try {
      const { rows } = await pgPool.query(
        `select id, printed_at
       from public.checkins
       where printed_at is null
         and checked_out_at is null
       order by checked_in_at desc
       limit 300`
      );
      rows.forEach((item) => enqueueAutoPrint(item.id));
      lastAutoPrintPoll.pending_count = rows.length;
      lastAutoPrintPoll.enqueued_count = rows.length;
    } catch (error) {
      lastAutoPrintPoll.error = error?.message || String(error);
      throw error;
    }
    return;
  }
  const { data, error } = await supabaseClient
    .from("checkins")
    .select("id,printed_at")
    .is("printed_at", null)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(300);
  if (error) {
    lastAutoPrintPoll.error = error.message || String(error);
    console.warn("[Servico de impressao] falha ao buscar pendencias:", error.message || error);
    return;
  }
  const rows = data || [];
  rows.forEach((item) => enqueueAutoPrint(item.id));
  lastAutoPrintPoll.pending_count = rows.length;
  lastAutoPrintPoll.enqueued_count = rows.length;
}

async function startRealtimeAutoPrint() {
  if (!supabaseClient || !canUseAutoPrintDataAccess) {
    console.warn("[Servico de impressao] Auto-print do celular desativado: configure DATABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
    realtimeStatus = "disabled_missing_admin_data_access";
    return;
  }
  await processPendingCheckins();
  realtimeChannel = supabaseClient
    .channel("checkins-autoprint-service")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, (payload) => {
      const checkinId = payload?.new?.id;
      if (checkinId) {
        enqueueAutoPrint(checkinId);
      }
    })
    .subscribe((status) => {
      realtimeStatus = status;
      if (status === "SUBSCRIBED") {
        console.log("[Servico de impressao] Listener de check-ins ativo.");
      }
    });
}

function startAutoPrintPolling() {
  if (!canUseAutoPrintDataAccess) {
    return;
  }
  if (autoPrintPollTimer) {
    clearInterval(autoPrintPollTimer);
  }
  autoPrintPollTimer = setInterval(() => {
    processPendingCheckins().catch((error) => {
      console.warn("[Servico de impressao] falha no polling de pendencias:", error?.message || error);
    });
  }, AUTO_PRINT_POLL_INTERVAL_MS);
  if (typeof autoPrintPollTimer?.unref === "function") {
    autoPrintPollTimer.unref();
  }
  console.log(
    `[Servico de impressao] polling de check-ins pendentes ativo (intervalo ${AUTO_PRINT_POLL_INTERVAL_MS}ms).`
  );
}

function triggerReprintJobProcessing() {
  processPendingReprintJobs().catch((error) => {
    console.warn("[Servico de impressao] falha ao processar fila de reimpressao:", error?.message || error);
  });
}

async function processPendingReprintJobs() {
  if (!canUseReprintQueue || reprintJobProcessing) {
    return;
  }
  reprintJobProcessing = true;
  try {
    while (true) {
      const job = await claimNextReprintJob();
      if (!job?.id) {
        break;
      }
      if (reprintJobSeen.has(job.id)) {
        break;
      }
      reprintJobSeen.add(job.id);
      try {
        await printCheckinById(job.checkin_id, { type: "reprint" });
        await completeReprintJob(job.id);
      } catch (error) {
        await failReprintJob(job.id, error);
        console.warn(`[Servico de impressao] falha na reimpressao ${job.id}:`, error?.message || error);
      } finally {
        reprintJobSeen.delete(job.id);
      }
    }
  } finally {
    reprintJobProcessing = false;
  }
}

async function claimNextReprintJob() {
  if (pgPool) {
    const { rows } = await pgPool.query(
      `with next_job as (
         select pj.id
         from public.print_jobs pj
         where pj.job_type = 'reprint'
           and (
             pj.status = 'pending'
             or (pj.status = 'processing' and pj.claimed_at < now() - interval '2 minutes')
           )
           and pj.attempts < 5
         order by pj.created_at asc
         for update skip locked
         limit 1
       )
       update public.print_jobs pj
       set
         status = 'processing',
         attempts = pj.attempts + 1,
         claimed_by = nullif(btrim($1), ''),
         claimed_at = now(),
         updated_at = now(),
         error_message = null
       from next_job
       where pj.id = next_job.id
       returning pj.id, pj.checkin_id, pj.attempts`,
      [PRINT_WORKER_ID]
    );
    return rows[0] || null;
  }
  const { data, error } = await supabaseClient.rpc("claim_next_reprint_job", {
    worker_id: PRINT_WORKER_ID
  });
  if (error) {
    const missing = String(error.message || "").includes("claim_next_reprint_job");
    if (!missing) {
      console.warn("[Servico de impressao] falha ao reservar reimpressao:", error.message || error);
    }
    return null;
  }
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function completeReprintJob(jobId) {
  if (!jobId) {
    return;
  }
  if (pgPool) {
    await pgPool.query(
      `update public.print_jobs
       set status = 'printed', printed_at = now(), updated_at = now(), error_message = null
       where id = $1`,
      [jobId]
    );
    return;
  }
  await supabaseClient
    .from("print_jobs")
    .update({
      status: "printed",
      printed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null
    })
    .eq("id", jobId);
}

async function failReprintJob(jobId, error) {
  if (!jobId) {
    return;
  }
  const message = String(error?.message || error || "Falha ao reimprimir.").slice(0, 1000);
  if (pgPool) {
    await pgPool.query(
      `update public.print_jobs
       set status = 'failed', failed_at = now(), updated_at = now(), error_message = $2
       where id = $1`,
      [jobId, message]
    );
    return;
  }
  await supabaseClient
    .from("print_jobs")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: message
    })
    .eq("id", jobId);
}

async function startRealtimeReprintJobs() {
  if (!supabaseClient || !SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  await processPendingReprintJobs();
  reprintJobsChannel = supabaseClient
    .channel("reprint-jobs-service")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "print_jobs" }, (payload) => {
      if (payload?.new?.job_type === "reprint" && payload?.new?.status === "pending") {
        triggerReprintJobProcessing();
      }
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Servico de impressao] Listener de reimpressao ativo.");
      }
    });
}

function startReprintJobPolling() {
  if (!canUseReprintQueue) {
    return;
  }
  if (reprintJobPollTimer) {
    clearInterval(reprintJobPollTimer);
  }
  reprintJobPollTimer = setInterval(triggerReprintJobProcessing, AUTO_PRINT_POLL_INTERVAL_MS);
  if (typeof reprintJobPollTimer?.unref === "function") {
    reprintJobPollTimer.unref();
  }
  console.log(
    `[Servico de impressao] polling de reimpressao ativo (intervalo ${AUTO_PRINT_POLL_INTERVAL_MS}ms).`
  );
}

function loadEnvFromFiles() {
  const candidates = [
    path.join(process.cwd(), ".codex-secrets.env"),
    path.join(process.cwd(), "..", ".codex-secrets.env"),
    path.join(__dirname, "..", ".codex-secrets.env")
  ];
  candidates.forEach((filePath) => {
    if (!fsSync.existsSync(filePath)) {
      return;
    }
    try {
      const raw = fsSync.readFileSync(filePath, "utf8");
      raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
          return;
        }
        const idx = trimmed.indexOf("=");
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, "");
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      });
    } catch (_error) {
      // arquivo opcional
    }
  });
}

function parseAllowedOrigins(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function authorizePrintRequest(req, res) {
  if (!PRINT_SERVICE_TOKEN) {
    return true;
  }
  const token = String(req.headers["x-dnms-print-token"] || "");
  if (token && token === PRINT_SERVICE_TOKEN) {
    return true;
  }
  res.status(401).json({ ok: false, error: "Token de impressao local invalido ou ausente." });
  return false;
}

function validatePrintPayload({ checkinId, conteudo }) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(checkinId)) {
    return { ok: false, error: "checkin_id invalido para impressao local." };
  }
  if (conteudo.length > 200000) {
    return { ok: false, error: "Conteudo de impressao excede o limite permitido." };
  }
  if (!/<!doctype html>/i.test(conteudo) || !/<div\s+class=["']label["']/i.test(conteudo)) {
    return { ok: false, error: "Conteudo de impressao fora do formato esperado." };
  }
  if (/<script\b/i.test(conteudo) || /<iframe\b/i.test(conteudo) || /<object\b/i.test(conteudo) || /<embed\b/i.test(conteudo)) {
    return { ok: false, error: "Conteudo de impressao contem elementos nao permitidos." };
  }
  return { ok: true };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
  } catch (_error) {
    // Sem impacto funcional para o servico
  }
}

function logPrint({ checkinId, tipo, date, status, details }) {
  const dateString = formatDate(date || new Date());
  console.log(
    `[Servico de impressao] checkin_id=${checkinId} tipo=${tipo} data_hora=${dateString} status=${status}`
  );
  if (details) {
    console.log(`[Servico de impressao] detalhes: ${details}`);
  }
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function setupShutdownHandlers() {
  let closing = false;
  const close = async () => {
    if (closing) {
      return;
    }
    closing = true;
    await closeSharedBrowser();
    if (pgPool) {
      await pgPool.end().catch(() => {});
    }
  };
  process.once("SIGINT", () => {
    close().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    close().finally(() => process.exit(0));
  });
  process.once("beforeExit", () => {
    close();
  });
}

setupShutdownHandlers();

app.listen(PORT, HOST, () => {
  console.log(`[Servico de impressao] online em http://${HOST}:${PORT}`);
  console.log(`[Servico de impressao] Acesso a dados: ${resolveServiceDataRole()}`);
  console.log(
    `[Servico de impressao] Protecao HTTP: ${PRINT_SERVICE_TOKEN ? "token ativo" : "token nao configurado"}; origens permitidas: ${
      PRINT_ALLOWED_ORIGINS.size ? Array.from(PRINT_ALLOWED_ORIGINS).join(", ") : "modo compatibilidade"
    }`
  );
  startAutoPrintPolling();
  startReprintJobPolling();
  warmSharedBrowser();
  startRealtimeAutoPrint().catch((error) => {
    console.warn("[Servico de impressao] falha ao iniciar listener de auto-print:", error?.message || error);
  });
  startRealtimeReprintJobs().catch((error) => {
    console.warn("[Servico de impressao] falha ao iniciar listener de reimpressao:", error?.message || error);
  });
});

const express = require("express");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer-core");
const { print, getPrinters } = require("pdf-to-printer");
const { createClient } = require("@supabase/supabase-js");

const PORT = 3001;
const REQUIRED_PRINTER_HINT = "BROTHER QL-810W";
const AUTO_PRINT_POLL_INTERVAL_MS = Number(process.env.AUTO_PRINT_POLL_INTERVAL_MS || 4000);
const SUPABASE_URL_DEFAULT = "https://ziuezwtmmnspkycixqtf.supabase.co";
const SUPABASE_ANON_KEY_DEFAULT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWV6d3RtbW5zcGt5Y2l4cXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjY2NjksImV4cCI6MjA5MDIwMjY2OX0.WCPR3YQyJqyChtYjNMXgYXipRiEYf4_BJjS8-RalZj4";

loadEnvFromFiles();
const SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_URL_DEFAULT;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_ACCESS_KEY = SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_DEFAULT;
const supabaseClient = SUPABASE_ACCESS_KEY ? createClient(SUPABASE_URL, SUPABASE_ACCESS_KEY) : null;

const autoPrintQueue = [];
const autoPrintSeen = new Set();
let autoPrintProcessing = false;
let realtimeChannel = null;
let autoPrintPollTimer = null;

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "5mb" }));

app.get("/health", async (_req, res) => {
  try {
    const printer = await getTargetPrinterOrThrow();
    const usingServiceRole = Boolean(SUPABASE_SERVICE_ROLE_KEY);
    res.json({
      ok: true,
      status: "online",
      target_printer: printer.name || "-",
      auto_print_listener: Boolean(supabaseClient),
      auto_print_polling: Boolean(autoPrintPollTimer),
      supabase_role: usingServiceRole ? "service_role" : "anon"
    });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.post("/print", async (req, res) => {
  await handlePrintRequest(req, res, "print");
});

app.post("/reprint", async (req, res) => {
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

  try {
    const printer = await getTargetPrinterOrThrow();
    const pdfPath = await renderHtmlToPdf(conteudo);
    await print(pdfPath, {
      printer: printer.name,
      sumatraPdfPath: resolveSumatraPdfPath(),
      pages: "1"
    });
    await safeUnlink(pdfPath);
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
  }
}

async function getTargetPrinterOrThrow() {
  const printers = await getPrinters();
  if (!Array.isArray(printers) || !printers.length) {
    throw new Error("Nenhuma impressora disponivel no sistema.");
  }

  const normalized = printers.map((printer) => ({
    raw: printer,
    name: String(printer.name || "").trim(),
    key: String(printer.name || "").trim().toUpperCase()
  }));

  const selected = normalized.find((item) => item.key.includes(REQUIRED_PRINTER_HINT));
  if (!selected?.raw) {
    const available = normalized.map((item) => item.name).filter(Boolean).join(" | ");
    throw new Error(
      `Impressora obrigatoria nao encontrada (${REQUIRED_PRINTER_HINT}). Disponiveis: ${available || "-"}`
    );
  }
  return selected.raw;
}

async function markCheckinPrinted(checkinId) {
  if (!supabaseClient || !checkinId) {
    return;
  }
  try {
    await supabaseClient.from("checkins").update({ printed_at: new Date().toISOString() }).eq("id", checkinId);
  } catch (_error) {
    // sem bloqueio de fluxo
  }
}

async function renderHtmlToPdf(htmlContent) {
  const executablePath = resolveBrowserExecutablePath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "servico-impressao-"));
  const pdfPath = path.join(tempDir, `etiqueta-${Date.now()}.pdf`);

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
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
    await browser.close();
  }

  return pdfPath;
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

async function printCheckinById(checkinId) {
  if (!supabaseClient || !checkinId) {
    return;
  }
  const { data: checkin, error: checkinError } = await supabaseClient
    .from("checkins")
    .select("*")
    .eq("id", checkinId)
    .single();
  if (checkinError || !checkin) {
    throw new Error(`checkin nao encontrado: ${checkinError?.message || "-"}`);
  }
  if (checkin.printed_at) {
    return;
  }

  let studentName = "Aluno";
  let guardian = "-";
  if (checkin.student_id) {
    const { data: student } = await supabaseClient
      .from("students")
      .select("name,primary_guardian_name,notes,class_name")
      .eq("id", checkin.student_id)
      .single();
    if (student) {
      studentName = student.name || studentName;
      guardian = student.primary_guardian_name || guardian;
    }
  }

  const html = buildLabelDocumentHtml({
    studentName,
    className: checkin.class_name || "-",
    guardian,
    notes: checkin.notes_snapshot || "-"
  });

  const printer = await getTargetPrinterOrThrow();
  const pdfPath = await renderHtmlToPdf(html);
  await print(pdfPath, {
    printer: printer.name,
    sumatraPdfPath: resolveSumatraPdfPath(),
    pages: "1"
  });
  await safeUnlink(pdfPath);
  await markCheckinPrinted(checkinId);
  logPrint({
    checkinId,
    tipo: "print",
    date: new Date(),
    status: "sucesso",
    details: `Auto-print via listener (${printer.name || "-"})`
  });
}

async function processPendingCheckins() {
  if (!supabaseClient) {
    return;
  }
  const { data, error } = await supabaseClient
    .from("checkins")
    .select("id,printed_at")
    .is("printed_at", null)
    .order("checked_in_at", { ascending: true })
    .limit(300);
  if (error) {
    console.warn("[Servico de impressao] falha ao buscar pendencias:", error.message || error);
    return;
  }
  (data || []).forEach((item) => enqueueAutoPrint(item.id));
}

async function startRealtimeAutoPrint() {
  if (!supabaseClient) {
    console.warn("[Servico de impressao] Auto-print desativado (Supabase key ausente).");
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
      if (status === "SUBSCRIBED") {
        console.log("[Servico de impressao] Listener de check-ins ativo.");
      }
    });
}

function startAutoPrintPolling() {
  if (!supabaseClient) {
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

app.listen(PORT, () => {
  console.log(`[Servico de impressao] online em http://localhost:${PORT}`);
  console.log(
    `[Servico de impressao] Supabase auth: ${SUPABASE_SERVICE_ROLE_KEY ? "service_role" : "anon"}`
  );
  startAutoPrintPolling();
  startRealtimeAutoPrint().catch((error) => {
    console.warn("[Servico de impressao] falha ao iniciar listener de auto-print:", error?.message || error);
  });
});

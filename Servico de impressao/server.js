const express = require("express");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer-core");
const { print, getPrinters } = require("pdf-to-printer");

const PORT = 3001;
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
    const printer = await getDefaultPrinterOrThrow();
    res.json({ ok: true, status: "online", default_printer: printer.name || "default" });
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
    const printer = await getDefaultPrinterOrThrow();
    const pdfPath = await renderHtmlToPdf(conteudo);
    await print(pdfPath, {
      sumatraPdfPath: resolveSumatraPdfPath(),
      pages: "1"
    });
    await safeUnlink(pdfPath);

    logPrint({
      checkinId,
      tipo,
      date: startedAt,
      status: "sucesso",
      details: `Impressora padrao: ${printer.name || "default"}`
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

async function getDefaultPrinterOrThrow() {
  const printers = await getPrinters();
  if (!Array.isArray(printers) || !printers.length) {
    throw new Error("Nenhuma impressora disponivel no sistema.");
  }

  const byDefaultFlag =
    printers.find((p) => p.isDefault || p.default || p.is_default) ||
    printers.find((p) => String(p.name || "").toLowerCase().includes("default"));

  const selected = byDefaultFlag || printers[0];
  if (!selected) {
    throw new Error("Nao foi possivel identificar impressora padrao.");
  }
  return selected;
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
});

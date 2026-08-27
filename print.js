const SUPABASE_URL = "https://ziuezwtmmnspkycixqtf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWV6d3RtbW5zcGt5Y2l4cXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjY2NjksImV4cCI6MjA5MDIwMjY2OX0.WCPR3YQyJqyChtYjNMXgYXipRiEYf4_BJjS8-RalZj4";
const PRINT_SERVICE_URL = "http://localhost:3001";
const PRINT_SERVICE_TOKEN_KEY = "dnms_print_service_token";
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  printAuthStatus: document.getElementById("printAuthStatus"),
  printLabel: document.getElementById("printLabel"),
  printStudentList: document.getElementById("printStudentList"),
  printStudentSearch: document.getElementById("printStudentSearch"),
  btnRefreshReprintList: document.getElementById("btnRefreshReprintList"),
  printSelectedSummary: document.getElementById("printSelectedSummary"),
  btnReprintSelected: document.getElementById("btnReprintSelected"),
  reprintDialog: document.getElementById("reprintDialog"),
  reprintDialogText: document.getElementById("reprintDialogText"),
  btnCloseReprintDialog: document.getElementById("btnCloseReprintDialog"),
  btnConfirmReprintDialog: document.getElementById("btnConfirmReprintDialog")
};

const queue = [];
let isPrinting = false;
let studentsCache = [];
const reprintContext = { studentId: "", studentName: "", checkin: null };

boot();

async function boot() {
  if (!supabaseClient) {
    setPrintStatus("Supabase nao configurado.", "error");
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session) {
    setPrintStatus("Abra o app e faca login antes de usar este painel.", "error");
    return;
  }
  bindEvents();
  setPrintStatus("Autenticado. Selecione uma crianca para reimprimir.");
  await fetchStudentsForReprint();
}

function bindEvents() {
  els.btnCloseReprintDialog?.addEventListener("click", () => {
    els.reprintDialog?.close();
  });
  els.btnConfirmReprintDialog?.addEventListener("click", handleConfirmReprintFromDialog);
  els.printStudentSearch?.addEventListener("input", renderStudentsForReprint);
  els.btnRefreshReprintList?.addEventListener("click", fetchStudentsForReprint);
  els.btnReprintSelected?.addEventListener("click", openReprintDialogForSelected);
}

async function fetchPendingCheckins() {
  const { data, error } = await supabaseClient
    .from("checkins")
    .select("*")
    .is("printed_at", null)
    .order("checked_in_at", { ascending: true })
    .limit(10);
  if (error) {
    els.printQueueStatus.textContent = "Falha ao buscar check-ins pendentes.";
    return;
  }
  data.forEach((item) => enqueueCheckin(item, { markPrinted: true }));
  updateQueueStatus();
  processQueue();
}

function subscribeToCheckins() {
  supabaseClient
    .channel("checkins-print")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "checkins" },
      (payload) => {
        if (payload?.new?.printed_at) {
          return;
        }
        includeStudentInReprintList(payload?.new?.student_id);
        enqueueCheckin(payload.new, { markPrinted: true });
        updateQueueStatus();
        processQueue();
      }
    )
    .subscribe();
}

async function includeStudentInReprintList(studentId) {
  if (!studentId || studentsCache.some((item) => item.id === studentId)) {
    return;
  }
  const { data } = await supabaseClient.from("students").select("id,name").eq("id", studentId).single();
  if (!data?.id) {
    return;
  }
  studentsCache.push({ id: data.id, name: data.name });
  studentsCache.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
  renderStudentsForReprint();
}

function enqueueCheckin(checkin, options = {}) {
  const queueId = options.queueId || checkin.id;
  if (!queue.find((item) => item.queueId === queueId)) {
    queue.push({ ...checkin, queueId, markPrinted: Boolean(options.markPrinted) });
  }
}

function updateQueueStatus() {
  if (!els.printAuthStatus) {
    return;
  }
  const base = "Autenticado. Aguardando check-ins...";
  setPrintStatus(queue.length ? `${base} Etiquetas na fila: ${queue.length}.` : base);
}

async function processQueue() {
  if (isPrinting || !queue.length) {
    return;
  }
  isPrinting = true;
  const next = queue.shift();
  updateQueueStatus();
  await printCheckin(next);
  isPrinting = false;
  processQueue();
}

async function printCheckin(checkin) {
  const student = await fetchStudent(checkin.student_id);
  renderLabelPreview(checkin, student);

  const sent = await sendToPrintService({
    checkinId: checkin.id,
    type: checkin.markPrinted ? "print" : "reprint",
    labelHtml: els.printLabel.innerHTML
  });
  if (!sent) {
    return false;
  }
  if (checkin.markPrinted) {
    await markPrinted(checkin.id);
  }
  return sent;
}

async function fetchStudent(studentId) {
  const { data } = await supabaseClient.from("students").select("*").eq("id", studentId).single();
  return data || null;
}

async function markPrinted(checkinId) {
  const printedAt = new Date().toISOString();
  await supabaseClient
    .from("checkins")
    .update({ printed_at: printedAt })
    .eq("id", checkinId);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day}/${month}/${year} ${time}`;
}

async function fetchStudentsForReprint() {
  const dayRange = getTodayUtcRange();
  const { data: checkins, error: checkinsError } = await supabaseClient
    .from("checkins")
    .select("student_id,checked_in_at")
    .not("student_id", "is", null)
    .gte("checked_in_at", dayRange.startIso)
    .lt("checked_in_at", dayRange.endIso)
    .order("checked_in_at", { ascending: false })
    .limit(2000);
  if (checkinsError) {
    setPrintStatus("Falha ao carregar check-ins para reimpressao.", "error");
    return;
  }
  const latestByStudent = new Map();
  (checkins || []).forEach((item) => {
    if (!item.student_id || latestByStudent.has(item.student_id)) {
      return;
    }
    latestByStudent.set(item.student_id, item.checked_in_at);
  });
  const studentIds = Array.from(latestByStudent.keys());
  if (!studentIds.length) {
    studentsCache = [];
    renderStudentsForReprint();
    setPrintStatus("Nenhuma crianca fez check-in hoje. Nao ha etiquetas para reimprimir.");
    return;
  }
  const { data, error } = await supabaseClient.from("students").select("id,name").in("id", studentIds).order("name");
  if (error) {
    setPrintStatus("Falha ao carregar alunos para reimpressao.", "error");
    return;
  }
  studentsCache = (data || []).map((student) => ({
    ...student,
    checkedInAt: latestByStudent.get(student.id) || ""
  }));
  renderStudentsForReprint();
  setPrintStatus(`${studentsCache.length} crianca(s) com check-in hoje. Clique em uma crianca para carregar a previa antes de reimprimir.`);
}

function renderStudentsForReprint() {
  if (!els.printStudentList) {
    return;
  }
  const search = normalizeSearch(els.printStudentSearch?.value || "");
  const visibleStudents = search
    ? studentsCache.filter((student) => normalizeSearch(student.name).includes(search))
    : studentsCache;
  els.printStudentList.innerHTML = "";
  if (!studentsCache.length) {
    els.printStudentList.innerHTML = `<div class="summary">Nenhuma crianca fez check-in hoje.</div>`;
    return;
  }
  if (!visibleStudents.length) {
    els.printStudentList.innerHTML = `<div class="summary">Nenhuma crianca encontrada para a busca.</div>`;
    return;
  }
  visibleStudents.forEach((student) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "print-student-item";
    row.classList.toggle("is-selected", student.id === reprintContext.studentId);
    const content = document.createElement("span");
    const name = document.createElement("span");
    name.className = "print-student-name";
    name.textContent = student.name;
    const meta = document.createElement("span");
    meta.className = "print-student-meta";
    meta.textContent = student.checkedInAt ? `Check-in: ${formatDateTime(student.checkedInAt)}` : "Check-in de hoje";
    const action = document.createElement("span");
    action.className = "print-student-action";
    action.textContent = student.id === reprintContext.studentId ? "Previa aberta" : "Ver previa";
    content.append(name, meta);
    row.append(content, action);
    row.addEventListener("click", () => {
      selectStudentForReprint(student);
    });
    els.printStudentList.appendChild(row);
  });
}

async function selectStudentForReprint(student) {
  if (!student?.id || isPrinting) {
    return;
  }
  reprintContext.studentId = student.id;
  reprintContext.studentName = student.name || "Aluno";
  reprintContext.checkin = null;
  renderStudentsForReprint();
  setSelectedSummary("Carregando previa...", "Buscando o ultimo check-in de hoje.");
  if (els.btnReprintSelected) {
    els.btnReprintSelected.disabled = true;
  }

  const latest = await fetchLatestCheckinForStudent(student.id);
  if (!latest) {
    clearLabelPreview();
    setSelectedSummary(reprintContext.studentName, "Nenhum check-in encontrado hoje para esta crianca.");
    setPrintStatus(`Nenhum check-in encontrado para ${reprintContext.studentName}.`, "error");
    return;
  }

  const studentData = await fetchStudent(student.id);
  reprintContext.checkin = latest;
  renderLabelPreview(latest, studentData);
  setSelectedSummary(
    reprintContext.studentName,
    `Check-in: ${formatDateTime(latest.checked_in_at)}. A reimpressao so sera enviada depois da confirmacao.`
  );
  if (els.btnReprintSelected) {
    els.btnReprintSelected.disabled = false;
  }
  setPrintStatus(`Previa carregada para ${reprintContext.studentName}. Confira a etiqueta e use o botao para reimprimir.`);
  renderStudentsForReprint();
}

function openReprintDialogForSelected() {
  if (!reprintContext.studentId || !reprintContext.checkin) {
    setPrintStatus("Selecione uma crianca antes de reimprimir.", "error");
    return;
  }
  if (els.reprintDialogText) {
    els.reprintDialogText.textContent = `Reimprimir etiqueta de ${reprintContext.studentName}?`;
  }
  els.reprintDialog?.showModal();
}

async function handleConfirmReprintFromDialog() {
  const studentId = reprintContext.studentId;
  if (!studentId || !reprintContext.checkin) {
    return;
  }
  els.reprintDialog?.close();
  if (isPrinting) {
    setPrintStatus("Aguarde a impressao atual terminar para reimprimir.");
    return;
  }
  isPrinting = true;
  let result = false;
  try {
    result = await printCheckin({ ...reprintContext.checkin, markPrinted: false });
  } finally {
    isPrinting = false;
  }
  processQueue();
  setPrintStatus(
    result === "printed"
      ? `Etiqueta reimpressa para ${reprintContext.studentName}.`
      : result === "queued"
        ? `Reimpressao enviada para a fila da Brother para ${reprintContext.studentName}.`
        : `Falha ao solicitar reimpressao para ${reprintContext.studentName}.`,
    result ? "ok" : "error"
  );
}

function renderLabelPreview(checkin, student) {
  const name = student?.name || "Aluno";
  const guardian = student?.primary_guardian_name || "-";
  const className = checkin.class_name || student?.class_name || "-";
  const notes = checkin?.notes_snapshot || student?.notes || "-";

  els.printLabel.innerHTML = `
    <div class="label-name">${escapeHtml(name)}</div>
    <div class="label-body">
      <div class="label-line">Turma: ${escapeHtml(className)}</div>
      <div class="label-line">Responsavel: ${escapeHtml(guardian)}</div>
      <div class="label-line">Observacao: ${escapeHtml(notes)}</div>
    </div>
  `;
}

function clearLabelPreview() {
  if (els.printLabel) {
    els.printLabel.innerHTML = "";
  }
}

function setSelectedSummary(title, detail) {
  if (!els.printSelectedSummary) {
    return;
  }
  els.printSelectedSummary.innerHTML = "";
  const name = document.createElement("strong");
  name.textContent = title;
  const description = document.createElement("span");
  description.textContent = detail;
  els.printSelectedSummary.append(name, description);
}

async function sendToPrintService({ checkinId, type, labelHtml }) {
  if (!labelHtml) {
    return false;
  }
  const payload = {
    checkin_id: String(checkinId || ""),
    conteudo: buildLabelDocumentHtml(labelHtml),
    tipo: type === "reprint" ? "reprint" : "print"
  };
  const endpoint = payload.tipo === "reprint" ? "/reprint" : "/print";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${PRINT_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: getPrintServiceHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        message = body?.error || body?.status || message;
      } catch (_error) {}
      throw new Error(message);
    }
    return "printed";
  } catch (error) {
    console.warn("Falha ao enviar para servico de impressao", error);
    if (type === "reprint" && checkinId) {
      const queued = await requestRemoteReprint(checkinId);
      return queued ? "queued" : false;
    }
    alert(`Falha ao imprimir: ${error?.message || "servico indisponivel"}`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestRemoteReprint(checkinId) {
  const { error } = await supabaseClient.from("print_jobs").insert({
    job_type: "reprint",
    checkin_id: checkinId,
    status: "pending"
  });
  if (error) {
    const duplicate = error.code === "23505" || String(error.message || "").includes("print_jobs_one_open");
    if (!duplicate) {
      alert(`Falha ao solicitar reimpressao remota: ${error.message}`);
      return false;
    }
  }
  return true;
}

function getPrintServiceHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem(PRINT_SERVICE_TOKEN_KEY);
    if (token) {
      headers["X-DNMS-Print-Token"] = token;
    }
  } catch (_error) {}
  return headers;
}

function buildLabelDocumentHtml(labelBodyHtml) {
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

async function fetchLatestCheckinForStudent(studentId) {
  const dayRange = getTodayUtcRange();
  const { data, error } = await supabaseClient
    .from("checkins")
    .select("*")
    .eq("student_id", studentId)
    .gte("checked_in_at", dayRange.startIso)
    .lt("checked_in_at", dayRange.endIso)
    .order("checked_in_at", { ascending: false })
    .limit(1);
  if (error) {
    return null;
  }
  return data?.[0] || null;
}

function getTodayUtcRange() {
  const now = new Date();
  const startLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { startIso: startLocal.toISOString(), endIso: endLocal.toISOString() };
}

function setPrintStatus(message, tone = "ok") {
  if (!els.printAuthStatus) {
    return;
  }
  els.printAuthStatus.textContent = message;
  els.printAuthStatus.classList.toggle("is-error", tone === "error");
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SUPABASE_URL = "https://ziuezwtmmnspkycixqtf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWV6d3RtbW5zcGt5Y2l4cXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjY2NjksImV4cCI6MjA5MDIwMjY2OX0.WCPR3YQyJqyChtYjNMXgYXipRiEYf4_BJjS8-RalZj4";
const PRINT_SERVICE_URL = "http://localhost:3001";
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  printAuthStatus: document.getElementById("printAuthStatus"),
  printQueueStatus: document.getElementById("printQueueStatus"),
  printLabel: document.getElementById("printLabel"),
  printStudentList: document.getElementById("printStudentList"),
  printSelectAllStudents: document.getElementById("printSelectAllStudents"),
  btnPrintSelected: document.getElementById("btnPrintSelected")
};

const queue = [];
let isPrinting = false;
let studentsCache = [];
let printServiceWarned = false;

boot();

async function boot() {
  if (!supabaseClient) {
    els.printAuthStatus.textContent = "Supabase nao configurado.";
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (!data?.session) {
    els.printAuthStatus.textContent = "Abra o app e faca login antes de usar este painel.";
    return;
  }
  bindEvents();
  els.printAuthStatus.textContent = "Autenticado.";
  await fetchStudentsForReprint();
  els.printQueueStatus.textContent = "Selecione os alunos para reimpressao. Novos check-ins serao impressos automaticamente.";
  subscribeToCheckins();
}

function bindEvents() {
  els.printSelectAllStudents?.addEventListener("change", handleSelectAllStudents);
  els.btnPrintSelected?.addEventListener("click", handlePrintSelected);
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
        enqueueCheckin(payload.new, { markPrinted: true });
        updateQueueStatus();
        processQueue();
      }
    )
    .subscribe();
}

function enqueueCheckin(checkin, options = {}) {
  const queueId = options.queueId || checkin.id;
  if (!queue.find((item) => item.queueId === queueId)) {
    queue.push({ ...checkin, queueId, markPrinted: Boolean(options.markPrinted) });
  }
}

function updateQueueStatus() {
  els.printQueueStatus.textContent = queue.length
    ? `Etiquetas na fila: ${queue.length}`
    : "Nenhuma etiqueta pendente.";
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
  const room = await fetchRoom(checkin.room_id);
  const name = student?.name || "Aluno";
  const guardian = student?.primary_guardian_name || "-";
  const className = checkin.class_name || student?.class_name || "-";
  const eventName = room?.name || "-";
  const notes = checkin?.notes_snapshot || student?.notes || "-";

  els.printLabel.innerHTML = `
    <div class="label-name">${name}</div>
    <div class="label-body">
      <div class="label-line">Evento: ${eventName} / Turma: ${className}</div>
      <div class="label-line">Responsavel: ${guardian}</div>
      <div class="label-line">Observacao especial: ${notes}</div>
    </div>
  `;

  const html = buildLabelHtmlDocument(els.printLabel.innerHTML);
  const printedByService = await sendToLocalPrintService({
    checkinId: checkin.id,
    tipo: checkin.markPrinted ? "print" : "reprint",
    conteudo: html
  });
  if (!printedByService) {
    if (!printServiceWarned) {
      printServiceWarned = true;
      console.warn("Servico de impressao offline. Nenhuma etiqueta foi enviada para impressao.");
    }
    els.printQueueStatus.textContent =
      "Servico de impressao indisponivel. Inicie o servico local para imprimir sem popup.";
    return;
  }
  printServiceWarned = false;
  if (checkin.markPrinted) {
    await markPrinted(checkin.id);
  }
}

async function fetchStudent(studentId) {
  const { data } = await supabaseClient.from("students").select("*").eq("id", studentId).single();
  return data || null;
}

async function fetchRoom(roomId) {
  const { data } = await supabaseClient.from("rooms").select("*").eq("id", roomId).single();
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
  const { data, error } = await supabaseClient.from("students").select("id,name").order("name");
  if (error) {
    els.printQueueStatus.textContent = "Falha ao carregar alunos para reimpressao.";
    return;
  }
  studentsCache = data || [];
  renderStudentsForReprint();
}

function renderStudentsForReprint() {
  if (!els.printStudentList) {
    return;
  }
  els.printStudentList.innerHTML = "";
  studentsCache.forEach((student) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "print-student-item";
    row.innerHTML = `
      <input type="checkbox" data-print-student="${student.id}" />
      <span>${student.name}</span>
    `;
    row.addEventListener("click", () => {
      const box = row.querySelector('input[type="checkbox"][data-print-student]');
      if (!box) {
        return;
      }
      box.checked = !box.checked;
      row.classList.toggle("is-selected", box.checked);
      syncSelectAllState();
    });
    els.printStudentList.appendChild(row);
  });
  syncSelectAllState();
}

function handleSelectAllStudents(event) {
  const checked = event.target.checked;
  const boxes = els.printStudentList.querySelectorAll('input[type="checkbox"][data-print-student]');
  boxes.forEach((box) => {
    box.checked = checked;
    box.closest(".print-student-item")?.classList.toggle("is-selected", checked);
  });
}

async function handlePrintSelected() {
  const boxes = els.printStudentList.querySelectorAll('input[type="checkbox"][data-print-student]:checked');
  const studentIds = Array.from(boxes).map((box) => box.dataset.printStudent);
  if (!studentIds.length) {
    els.printQueueStatus.textContent = "Selecione ao menos um aluno para reimprimir.";
    return;
  }
  let added = 0;
  for (const studentId of studentIds) {
    const latest = await fetchLatestCheckinForStudent(studentId);
    if (!latest) {
      continue;
    }
    enqueueCheckin(latest, { markPrinted: false, queueId: `reprint-${latest.id}-${studentId}-${Date.now()}` });
    added += 1;
  }
  els.printQueueStatus.textContent = added
    ? `${added} etiqueta(s) adicionada(s) para reimpressao.`
    : "Nenhum check-in encontrado para os alunos selecionados.";
  updateQueueStatus();
  processQueue();
}

async function fetchLatestCheckinForStudent(studentId) {
  const { data, error } = await supabaseClient
    .from("checkins")
    .select("*")
    .eq("student_id", studentId)
    .order("checked_in_at", { ascending: false })
    .limit(1);
  if (error) {
    return null;
  }
  return data?.[0] || null;
}

function printCurrentLabel() {
  return new Promise((resolve) => {
    let resolved = false;
    document.body.classList.add("print-only-label");
    const done = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      document.body.classList.remove("print-only-label");
      window.removeEventListener("afterprint", onAfterPrint);
      resolve();
    };
    const onAfterPrint = () => done();
    window.addEventListener("afterprint", onAfterPrint);
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.warn("Falha ao imprimir", err);
      } finally {
        setTimeout(done, 700);
      }
    }, 120);
  });
}

async function sendToLocalPrintService({ checkinId, tipo, conteudo }) {
  const endpoint = tipo === "reprint" ? "/reprint" : "/print";
  const payload = {
    checkin_id: String(checkinId || ""),
    conteudo: String(conteudo || ""),
    tipo: tipo === "reprint" ? "reprint" : "print"
  };
  if (!payload.checkin_id || !payload.conteudo) {
    return false;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`${PRINT_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    return response.ok;
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildLabelHtmlDocument(labelBodyHtml) {
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

function syncSelectAllState() {
  if (!els.printSelectAllStudents) {
    return;
  }
  const boxes = Array.from(els.printStudentList.querySelectorAll('input[type="checkbox"][data-print-student]'));
  if (!boxes.length) {
    els.printSelectAllStudents.checked = false;
    return;
  }
  els.printSelectAllStudents.checked = boxes.every((box) => box.checked);
}

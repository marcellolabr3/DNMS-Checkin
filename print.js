const SUPABASE_URL = "https://ziuezwtmmnspkycixqtf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWV6d3RtbW5zcGt5Y2l4cXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjY2NjksImV4cCI6MjA5MDIwMjY2OX0.WCPR3YQyJqyChtYjNMXgYXipRiEYf4_BJjS8-RalZj4";
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  printAuthStatus: document.getElementById("printAuthStatus"),
  printLabel: document.getElementById("printLabel"),
  printStudentList: document.getElementById("printStudentList"),
  reprintDialog: document.getElementById("reprintDialog"),
  reprintDialogText: document.getElementById("reprintDialogText"),
  btnCloseReprintDialog: document.getElementById("btnCloseReprintDialog"),
  btnConfirmReprintDialog: document.getElementById("btnConfirmReprintDialog")
};

const queue = [];
let isPrinting = false;
let studentsCache = [];
const reprintContext = { studentId: "", studentName: "" };

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
  els.printAuthStatus.textContent = "Autenticado. Aguardando check-ins...";
  await fetchStudentsForReprint();
  await fetchPendingCheckins();
  subscribeToCheckins();
}

function bindEvents() {
  els.btnCloseReprintDialog?.addEventListener("click", () => {
    els.reprintDialog?.close();
  });
  els.btnConfirmReprintDialog?.addEventListener("click", handleConfirmReprintFromDialog);
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
  els.printAuthStatus.textContent = queue.length ? `${base} Etiquetas na fila: ${queue.length}.` : base;
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
  const name = student?.name || "Aluno";
  const guardian = student?.primary_guardian_name || "-";
  const className = checkin.class_name || student?.class_name || "-";
  const notes = checkin?.notes_snapshot || student?.notes || "-";

  els.printLabel.innerHTML = `
    <div class="label-name">${name}</div>
    <div class="label-body">
      <div class="label-line">Turma: ${className}</div>
      <div class="label-line">Responsavel: ${guardian}</div>
      <div class="label-line">Observacao: ${notes}</div>
    </div>
  `;

  await printCurrentLabel();
  if (checkin.markPrinted) {
    await markPrinted(checkin.id);
  }
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
  const { data: checkins, error: checkinsError } = await supabaseClient
    .from("checkins")
    .select("student_id,checked_in_at")
    .not("student_id", "is", null)
    .order("checked_in_at", { ascending: false })
    .limit(5000);
  if (checkinsError) {
    if (els.printAuthStatus) {
      els.printAuthStatus.textContent = "Falha ao carregar check-ins para reimpressao.";
    }
    return;
  }
  const studentIds = Array.from(new Set((checkins || []).map((item) => item.student_id).filter(Boolean)));
  if (!studentIds.length) {
    studentsCache = [];
    renderStudentsForReprint();
    return;
  }
  const { data, error } = await supabaseClient.from("students").select("id,name").in("id", studentIds).order("name");
  if (error) {
    if (els.printAuthStatus) {
      els.printAuthStatus.textContent = "Falha ao carregar alunos para reimpressao.";
    }
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
    row.innerHTML = `<span>${student.name}</span>`;
    row.addEventListener("click", () => {
      openReprintDialog(student);
    });
    els.printStudentList.appendChild(row);
  });
}

function openReprintDialog(student) {
  if (!student?.id) {
    return;
  }
  reprintContext.studentId = student.id;
  reprintContext.studentName = student.name || "Aluno";
  if (els.reprintDialogText) {
    els.reprintDialogText.textContent = `Reimprimir etiqueta de ${reprintContext.studentName}?`;
  }
  els.reprintDialog?.showModal();
}

async function handleConfirmReprintFromDialog() {
  const studentId = reprintContext.studentId;
  if (!studentId) {
    return;
  }
  const latest = await fetchLatestCheckinForStudent(studentId);
  if (!latest) {
    if (els.printAuthStatus) {
      els.printAuthStatus.textContent = `Nenhum check-in encontrado para ${reprintContext.studentName}.`;
    }
    return;
  }
  els.reprintDialog?.close();
  if (isPrinting) {
    if (els.printAuthStatus) {
      els.printAuthStatus.textContent = "Aguarde a impressao atual terminar para reimprimir.";
    }
    return;
  }
  isPrinting = true;
  try {
    await printCheckin({ ...latest, markPrinted: false });
  } finally {
    isPrinting = false;
  }
  processQueue();
  if (els.printAuthStatus) {
    els.printAuthStatus.textContent = `Etiqueta reimpressa para ${reprintContext.studentName}.`;
  }
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

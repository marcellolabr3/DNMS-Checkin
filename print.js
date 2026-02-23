const SUPABASE_URL = "https://yaeqisvatborrbndmuxr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vTuti3mzKSwhX8PpF1DFeg_C0J9cc_t";
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
  els.printSelectAllStudents?.addEventListener("change", handleSelectAllStudents);
  els.btnPrintSelected?.addEventListener("click", handlePrintSelected);
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

  await printCurrentLabel();
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

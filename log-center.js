/* One Log workflow. Existing reports and student projections remain canonical. */
const logCenter = { catalog: [], loading: false, busy: false, error: "", table: "", excelExport: null, preparingShare: false };
const logTableLabels = {
  students: "Crianças / cadastros", profiles: "Responsáveis e usuários", student_guardians: "Vínculos de responsáveis",
  checkins: "Frequência / check-ins", rooms: "Eventos / salas", audit_logs: "Histórico de alterações",
  schedules: "Escalas", tips: "Avisos", tip_reads: "Leituras de avisos", invites: "Convites",
  family_link_requests: "Solicitações familiares", temporary_room_assignments: "Turmas temporárias",
  app_settings: "Configurações", dashboard_settings: "Painel", print_jobs: "Histórico de impressão"
};
const logEl = (id) => document.getElementById(id);
const logOperation = () => getLogReportType();
const isLogBackup = () => logOperation().startsWith("backup_");

function requireLogSession(sessionId, permission = "data") {
  const allowed = permission === "backup" ? isSadmin()
    : permission === "report" ? isAdmin() || isEquipe() : canExtractStudentData();
  if (!sessionId || state.session?.id !== sessionId || !allowed) {
    throw new Error("Sessão alterada. Entre novamente e repita a operação.");
  }
}

function logExcelScope() {
  return JSON.stringify({
    controls: [...document.querySelectorAll("#logCard input, #logCard select")]
      .map((el) => [el.id, el.value, el.type === "checkbox" ? el.checked : null]),
    students: state.ui.logSelectedStudentIds || [],
    extraction: state.ui.studentExtractionSelectedIds || []
  });
}

function createLogExcelContext(permission = "report") {
  const context = { session: state.session, sessionId: state.session?.id, permission, scope: logExcelScope() };
  requireLogSession(context.sessionId, permission);
  return context;
}

function requireLogExcelContext(context) {
  requireLogSession(context.sessionId, context.permission);
  if (state.session !== context.session || logExcelScope() !== context.scope) {
    throw new Error("Os filtros ou a sessão mudaram. Gere o Excel novamente.");
  }
}

function rememberLogExcel(XLSX, workbook, filename, context) {
  requireLogExcelContext(context);
  logCenter.excelExport = { XLSX, workbook, filename, context, file: null };
}

function clearLogExcel() {
  logCenter.excelExport = null;
  logEl("logExcelShareDialog").close();
  logEl("logExcelShareFilename").textContent = "";
  logEl("logExcelShareStatus").textContent = "";
}

function syncLogExcelSession() {
  if (!logCenter.excelExport) return;
  try { requireLogExcelContext(logCenter.excelExport.context); }
  catch (_) { clearLogExcel(); }
}

function getLogExcelFile(record) {
  requireLogExcelContext(record.context);
  if (!record.file) {
    const bytes = record.XLSX.write(record.workbook, { bookType: "xlsx", type: "array", compression: true });
    record.file = new File([bytes], record.filename, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  return record.file;
}

function canShareLogExcel(file) {
  try { return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }); }
  catch (_) { return false; }
}

function showLogExcelShare(record, message = "") {
  const dialog = logEl("logExcelShareDialog");
  const file = record ? getLogExcelFile(record) : null;
  const nativeShare = file && canShareLogExcel(file);
  logEl("logExcelShareFilename").textContent = file?.name || "Preparando Excel...";
  logEl("logExcelShareStatus").textContent = message || (nativeShare
    ? "Toque em Compartilhar arquivo e escolha o WhatsApp. Depois, selecione a conversa e confirme o envio."
    : "Baixe o Excel e, no WhatsApp, use Anexar → Documento para escolher este arquivo.");
  logEl("btnLogShareExcelFile").hidden = !nativeShare;
  logEl("btnLogDownloadExcelFile").hidden = !file;
  logEl("logExcelOpenWhatsapp").hidden = !file || nativeShare;
  ["btnLogShareExcelFile", "btnLogDownloadExcelFile", "logExcelOpenWhatsapp"].forEach((id) => {
    const action = logEl(id);
    action.style.display = action.hidden ? "none" : "";
  });
  if (!dialog.open) dialog.showModal();
}

function shareLogExcelRecord(record) {
  try {
    const file = getLogExcelFile(record);
    if (!canShareLogExcel(file)) { showLogExcelShare(record); return; }
    // Keep this call in the click handler: native sharing requires user activation.
    navigator.share({ files: [file], title: "DNMS Check-in — Excel" }).then(() => {
      if (logCenter.excelExport === record) logEl("logExcelShareDialog").close();
    }).catch((error) => {
      if (error.name === "AbortError") return;
      try {
        requireLogExcelContext(record.context);
        showLogExcelShare(record, "Não foi possível abrir o compartilhamento. Tente novamente ou baixe o Excel para anexar como Documento no WhatsApp.");
      } catch (_) { clearLogExcel(); }
    });
  } catch (error) { alert(`Compartilhamento não concluído: ${error.message}`); }
}

async function prepareLogExcelShare() {
  if (logCenter.preparingShare || logCenter.busy) return;
  logCenter.preparingShare = true;
  clearLogExcel();
  showLogExcelShare(null, "Gerando o arquivo Excel. Aguarde...");
  try {
    if (logOperation().startsWith("extract_") || ["data", "families"].includes(logOperation())) await runLogExport();
    else await exportCsv();
    if (!logCenter.excelExport) throw new Error(logCenter.error || "Não foi possível gerar o Excel. Confira os dados e tente novamente.");
    if (logEl("logExcelShareDialog").open) showLogExcelShare(logCenter.excelExport);
  } catch (error) {
    logEl("logExcelShareDialog").close();
    alert(`Compartilhamento não concluído: ${error.message}`);
  } finally { logCenter.preparingShare = false; }
}

function shareLogExcel() {
  try {
    if (isLogBackup()) throw new Error("Use o download administrativo para backups.");
    requireLogSession(state.session?.id, logOperation().startsWith("extract_") || logOperation() === "data" ? "data" : "report");
    syncLogExcelSession();
    if (logCenter.excelExport) shareLogExcelRecord(logCenter.excelExport);
    else prepareLogExcelShare();
  } catch (error) { alert(`Compartilhamento não concluído: ${error.message}`); }
}

function addLogCriterion() {
  const table = logCenter.catalog.find((item) => item.name === logEl("logDataTable").value);
  if (logOperation() !== "data" || !table || logCenter.busy) return;
  const row = document.createElement("div"); row.className = "filters";
  const field = document.createElement("select"); field.setAttribute("aria-label", "Campo do critério");
  table.columns.forEach((name) => field.add(new Option(name, name)));
  const operator = document.createElement("select"); operator.setAttribute("aria-label", "Operador do critério");
  [["contains", "Contém"], ["eq", "Igual a"], ["in", "Um dos valores"], ["empty", "Vazio"], ["not_empty", "Preenchido"]]
    .forEach(([value, label]) => operator.add(new Option(label, value)));
  const value = document.createElement("input"); value.setAttribute("aria-label", "Valor do critério");
  value.placeholder = "Para vários valores, separe por vírgula";
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "ghost"; remove.textContent = "Remover";
  remove.addEventListener("click", () => { if (!logCenter.busy) row.remove(); });
  operator.addEventListener("change", () => { value.disabled = ["empty", "not_empty"].includes(operator.value); });
  row.append(field, operator, value, remove); logEl("logDataCriteria").append(row);
}

function getLogCriteria() {
  return [...logEl("logDataCriteria").children].map((row) => ({ field: row.children[0].value, operator: row.children[1].value, value: row.children[2].value }));
}

function matchesLogCriteria(row, criteria) {
  return criteria.every(({field, operator, value}) => {
    const actual = row[field];
    const text = actual == null ? "" : typeof actual === "object" ? JSON.stringify(actual) : String(actual);
    if (operator === "empty") return text === "";
    if (operator === "not_empty") return text !== "";
    if (operator === "eq") return text === value;
    if (operator === "in") return value.split(",").map((item) => item.trim()).filter(Boolean).includes(text);
    return normalizeDuplicateText(text).includes(normalizeDuplicateText(value));
  });
}

async function refreshLogSnapshot() {
  const sessionId = state.session?.id;
  requireLogSession(sessionId, "report");
  const {data,error} = await supabaseClient.rpc("log_report_snapshot");
  requireLogSession(sessionId, "report");
  if (error) { logCenter.error = `Não foi possível carregar o Log completo: ${error.message}`; throw error; }
  const required=["students","student_guardians","profiles","rooms","checkins","audit_logs"];
  if (!data || required.some((name)=>!Array.isArray(data[name]))) throw new Error("Snapshot do Log incompleto; exportação cancelada.");
  const links=new Map();
  data.student_guardians.forEach((link)=>{ if(!links.has(link.student_id)) links.set(link.student_id,[]); links.get(link.student_id).push(link.guardian_id); });
  applyProfileRows(data.profiles); applyStudentRows(data.students,links); applyRoomRows(data.rooms);
  applyCheckinRows(data.checkins); applyAuditRows(data.audit_logs);
}

function renderLogCenter() {
  const operation = logOperation();
  const extract = operation.startsWith("extract_");
  const backup = isLogBackup();
  const data = operation === "data";
  const families = operation === "families";
  const special = extract || backup || data || families;
  logEl("logStudentFilterLabel").textContent = families ? "Buscar responsável ou filho" : "Crianca";
  els.logStudentFilter.placeholder = families ? "Nome, email ou telefone" : "Digite o nome da crianca";
  if (families) els.logStudentFilter.removeAttribute("list");
  else els.logStudentFilter.setAttribute("list", "logStudentOptions");
  els.logReportType.disabled = logCenter.busy;
  if (!data) els.logClassFilter.disabled = false;
  logEl("logDataOptions").hidden = !canExtractStudentData();
  logEl("logBackupOptions").hidden = !isSadmin();
  logEl("logDataControls").hidden = !(data || backup);
  logEl("logDataCriteriaPanel").hidden = !data;
  logEl("logExportFormat").disabled = backup || logCenter.busy;
  if (backup) logEl("logExportFormat").value = "json";
  els.btnExport.textContent = backup ? "Gerar backup" : "Exportar";
  const excel = logEl("logExportFormat").value === "xlsx";
  els.btnShareWhatsapp.textContent = excel ? "Enviar Excel no WhatsApp" : "Enviar WhatsApp";
  els.btnShareWhatsapp.style.display = backup || ((data || families) && !excel) ? "none" : "";
  [els.logStart, els.logEnd].forEach((el) => { el.closest(".field").style.display = special && !data ? "none" : ""; });
  logEl("logCenterStatus").textContent = logCenter.busy ? "Processando; aguarde o arquivo completo..." : logCenter.error;
  if (!special) return false;
  els.logList.replaceChildren(); els.logCounts.textContent = ""; els.logSelectedStudentsSummary.textContent = "";
  els.logClassFilter.closest(".field").style.display = data ? "" : "none";
  els.logStudentFilter.closest(".field").style.display = families ? "" : "none";
  els.btnLogSelectStudents.style.display = "none";
  const allowed = families ? isAdmin() || isEquipe() : backup ? isSadmin() : canExtractStudentData();
  els.btnExport.disabled = logCenter.busy || !allowed;
  els.btnShareWhatsapp.disabled = els.btnExport.disabled;
  if (!allowed) {
    els.logSummary.textContent = "Sem permissão para esta operação."; renderStudentExtraction(); return true;
  }
  if (families) {
    renderStudentExtraction();
    const { filtered } = getFilteredFamiliesForCurrentSearch(els.logStudentFilter.value, true);
    els.logSummary.textContent = "Responsáveis, contatos e filhos vinculados. Busque por nome, email ou telefone e escolha CSV, Excel ou JSON.";
    els.logCounts.textContent = `${filtered.length} usuário(s). Prévia de até 100; a exportação inclui todos os resultados.`;
    filtered.slice(0, 100).forEach(({profile, children}) => {
      const item = document.createElement("div"); item.className = "list-item";
      const name = document.createElement("strong"); name.textContent = profile.name || "Sem nome";
      const detail = document.createElement("span"); detail.textContent = `Filhos: ${children.map((child) => `${child.name} (${getStudentMembershipLabel(child)})`).join(" | ") || "—"}`;
      item.append(name, detail); els.logList.append(item);
    });
    els.btnExport.disabled = logCenter.busy || !filtered.length;
  } else if (extract) {
    els.studentExtractionMode.value = operation.slice(8);
    renderStudentExtraction();
    els.logSummary.textContent = "Selecione os critérios e exporte os cadastros.";
    els.btnExport.disabled = logCenter.busy || !getStudentExtractionRows().length;
    els.btnShareWhatsapp.disabled = els.btnExport.disabled;
  } else {
    renderStudentExtraction();
    els.logSummary.textContent = backup
      ? "JSON de recuperação: dados integrais, contas e arquivos. Inclui tabelas relacionadas. Proteja o arquivo: contém dados pessoais e credenciais de recuperação. Restauração administrativa documentada no repositório. Não inclui sessões ativas nem configurações da infraestrutura Supabase/Cloudflare."
      : "Consulta aos registros autorizados no banco. Período, evento, turma, busca e campos podem ser combinados; exportações de consulta não são backups.";
    loadLogCatalog();
    const global = operation === "backup_global";
    logEl("logDataTable").closest(".field").style.display = backup ? "none" : "";
    ["logDataSearch", "logDataEvent", "logDataDate"].forEach((id) => { logEl(id).closest(".field").style.display = backup ? "none" : ""; });
    logEl("logDataFields").parentElement.hidden = global;
    logEl("btnLogConsult").hidden = backup;
    logEl("btnLogConsult").style.display = backup ? "none" : "";
    if (logCenter.table !== `${operation}:${logEl("logDataTable").value}`) renderLogFields();
  }
  els.btnShareWhatsapp.disabled = els.btnExport.disabled;
  return true;
}

async function loadLogCatalog() {
  if (logCenter.loading || logCenter.catalog.length || logCenter.error) return;
  const sessionId = state.session?.id;
  logCenter.loading = true;
  try {
    requireLogSession(sessionId);
    const { data, error } = await supabaseClient.rpc("log_data_catalog");
    requireLogSession(sessionId);
    if (error) throw error;
    if (!Array.isArray(data) || !data.length) throw new Error("Catálogo indisponível; nenhuma exportação foi gerada.");
    logCenter.catalog = data;
    const select = logEl("logDataTable"); select.replaceChildren();
    data.forEach((table) => select.add(new Option(logTableLabels[table.name] || table.name, table.name)));
    const events = logEl("logDataEvent"); events.replaceChildren(new Option("Todos", ""));
    (state.rooms || []).forEach((room) => events.add(new Option(`${room.name} — ${room.date || ""}`, room.id)));
    renderLogFields();
  } catch (e) { logCenter.error = `Falha ao carregar dados: ${e.message}`; }
  finally { logCenter.loading = false; renderLog(); }
}

function renderLogFields() {
  const table = logCenter.catalog.find((item) => item.name === logEl("logDataTable").value);
  const backup = isLogBackup();
  const choices = backup ? logCenter.catalog.map((item) => item.name) : table?.columns || [];
  logCenter.table = `${logOperation()}:${logEl("logDataTable").value}`;
  const fields = logEl("logDataFields"); fields.replaceChildren();
  logEl("logDataCriteria").replaceChildren();
  choices.forEach((name) => {
    const label = document.createElement("label"); label.className = "checkbox-field";
    const box = document.createElement("input"); box.type = "checkbox"; box.value = name; box.checked = !backup;
    label.append(box, document.createTextNode(backup ? logTableLabels[name] || name : name)); fields.append(label);
  });
  const date = logEl("logDataDate"); date.replaceChildren(new Option("Sem filtro de data", ""));
  (table?.columns || []).filter((name) => /(_at$|^date$|_date$)/.test(name)).forEach((name) => date.add(new Option(name, name)));
  const hasEvent = table?.name === "rooms" || table?.columns.includes("room_id");
  logEl("logDataEvent").disabled = !hasEvent;
  if (!hasEvent) logEl("logDataEvent").value = "";
  const hasClass = table?.name === "students" || table?.columns.some((name) => ["student_id","class_name","class_target"].includes(name));
  els.logClassFilter.disabled = !hasClass;
  if (!hasClass) els.logClassFilter.value = "all";
}

function selectedLogFields() {
  return [...logEl("logDataFields").querySelectorAll("input:checked")].map((box) => box.value);
}

async function queryLogData() {
  if (!canExtractStudentData()) throw new Error("Sem permissão");
  const sessionId = state.session?.id;
  const name = logEl("logDataTable").value;
  const fields = selectedLogFields();
  if (!name || !fields.length) throw new Error("Selecione os dados e pelo menos um campo.");
  const dateField = logEl("logDataDate").value;
  const start = els.logStart.value; const end = els.logEnd.value;
  if (dateField && start && end && start > end) throw new Error("Período inválido.");
  const event = logEl("logDataEvent").value;
  const search = normalizeDuplicateText(logEl("logDataSearch").value);
  const className = els.logClassFilter.value;
  const criteria = getLogCriteria();
  const table = logCenter.catalog.find((item) => item.name === name);
  const hasStudent = name === "students" || name === "audit_logs" || table?.columns.includes("student_id");
  const selectedTables = new Set([name]);
  if (hasStudent) selectedTables.add("students");
  if (name === "audit_logs") selectedTables.add("checkins");
  const { data, error } = await supabaseClient.rpc("log_extract_data", { selected_tables: [...selectedTables] });
  requireLogSession(sessionId);
  if (error) throw error;
  if (!data || [...selectedTables].some((tableName) => !Array.isArray(data[tableName]))) throw new Error("Resposta incompleta; exportação cancelada.");
  const rows = data[name].filter((row) => {
    if (dateField) {
      const date = String(row[dateField] || "").slice(0, 10);
      if ((start && (!date || date < start)) || (end && (!date || date > end))) return false;
    }
    if (event && (name === "rooms" ? row.id !== event : row.room_id !== event)) return false;
    if (className !== "all") {
      const student = state.students.find((s) => s.id === (name === "students" ? row.id : row.student_id));
      const actual = row.class_name || row.class_target || (student ? getEffectiveClassForStudentToday(student) : "");
      if (actual !== className) return false;
    }
    return (!search || normalizeDuplicateText(JSON.stringify(row)).includes(search)) && matchesLogCriteria(row, criteria);
  });
  const outputFields = fields.slice();
  if (hasStudent) {
    const anchor = name === "students" ? "name" : name === "audit_logs" ? "target_name" : "student_id";
    outputFields.splice(Math.max(0, outputFields.indexOf(anchor) + 1), 0, "Membro/Visitante");
  }
  const students = new Map((data.students || []).map((student) => [student.id, student]));
  return { name, fields: outputFields, rows: rows.map((row) => {
    const result = Object.fromEntries(fields.map((key) => [key, row[key] ?? null]));
    if (hasStudent) result["Membro/Visitante"] = name === "audit_logs"
      ? getAuditStudentMembershipLabel(row, data.students, data.checkins)
      : getStudentMembershipLabel(students.get(name === "students" ? row.id : row.student_id));
    return result;
  }) };
}

function logDownload(filename, content, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadLogTable(filename, matrix) {
  try {
    const sessionId = state.session?.id;
    const format = logEl("logExportFormat").value;
    const name = filename.replace(/\.csv$/, "");
    if (format === "csv") { downloadCsv(filename, matrix); return; }
    if (format === "json") { logDownload(`${name}.json`, JSON.stringify({ report: getLogReportType(), generated_at: new Date().toISOString(), rows: matrix }, null, 2)); return; }
    const context = createLogExcelContext(getLogReportType() === "data" ? "data" : "report");
    const XLSX = await ensureXlsxLoaded(); const workbook = XLSX.utils.book_new();
    requireLogSession(sessionId, "report");
    requireLogExcelContext(context);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(matrix), "Dados");
    XLSX.writeFile(workbook, `${name}.xlsx`, { compression: true });
    rememberLogExcel(XLSX, workbook, `${name}.xlsx`, context);
  } catch (e) { alert(`Exportação não concluída: ${e.message}`); }
}

function exportLogCenter() {
  const operation = logOperation();
  if (!(operation.startsWith("extract_") || isLogBackup() || operation === "data" || operation === "families")) return false;
  runLogExport(); return true;
}

async function runLogExport() {
  if (logCenter.busy) return;
  const sessionId = state.session?.id;
  logCenter.busy = true; logCenter.error = ""; renderLog();
  try {
    if (["data","backup_specific"].includes(logOperation()) && !logCenter.catalog.length) {
      await loadLogCatalog();
      if (!logCenter.catalog.length) throw new Error(logCenter.error || "Catálogo indisponível");
    }
    if (isLogBackup()) await createLogBackup();
    else if (logOperation() === "data") {
      const result = await queryLogData();
      if (logEl("logExportFormat").value === "json") logDownload(`${result.name}_${formatTodayIso()}.json`, JSON.stringify({ table: result.name, fields: result.fields, generated_at: new Date().toISOString(), rows: result.rows }, null, 2));
      else await downloadLogTable(`${result.name}_${formatTodayIso()}.csv`, [result.fields, ...result.rows.map((row) => result.fields.map((key) => typeof row[key] === "object" && row[key] !== null ? JSON.stringify(row[key]) : row[key]))]);
    } else if (logOperation() === "families") {
      await refreshLogSnapshot();
      requireLogSession(sessionId, "report");
      await exportFamiliesCsv();
    } else {
      if (!canExtractStudentData()) throw new Error("Sem permissão");
      await refreshLogSnapshot();
      requireLogSession(sessionId);
      if (logEl("logExportFormat").value === "xlsx") await exportStudentsDataExcel();
      else {
        const rows = getStudentExtractionRows();
        if (!rows.length) throw new Error("Nenhuma criança encontrada.");
        if (logEl("logExportFormat").value === "json") logDownload(`criancas_${getStudentExtractionFileSuffix()}.json`, JSON.stringify({ scope: getStudentExtractionScopeLabel(), rows }, null, 2));
        else downloadCsv(`criancas_${getStudentExtractionFileSuffix()}.csv`, [getStudentExtractionExcelHeader(), ...rows.map(getStudentExtractionExcelRow)]);
      }
    }
  } catch (e) { logCenter.error = `Operação não concluída: ${e.message}`; }
  finally { logCenter.busy = false; renderLog(); }
}

function canonicalLogJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalLogJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalLogJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
async function logSha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((v) => v.toString(16).padStart(2,"0")).join("");
}

async function createLogBackup() {
  if (!isSadmin()) throw new Error("Backup permitido somente ao superadministrador.");
  const sessionId = state.session?.id;
  const selected = logOperation() === "backup_global" ? null : selectedLogFields();
  if (selected && !selected.length) throw new Error("Selecione pelo menos uma tabela.");
  const read = async () => {
    const { data, error } = await supabaseClient.rpc("log_recovery_snapshot", { selected_tables: selected });
    requireLogSession(sessionId, "backup");
    if (error) throw error;
    if (!data?.tables || !data?.columns || !Array.isArray(data.objects) || !Array.isArray(data.buckets)) throw new Error("Snapshot incompleto; nenhum backup foi gerado.");
    return data;
  };
  const snapshot = await read(); const files = [];
  for (const object of snapshot.objects) {
    const { data, error } = await supabaseClient.storage.from(object.bucket_id).download(object.name);
    requireLogSession(sessionId, "backup");
    if (error || !data) throw new Error(`Arquivo não recuperado: ${object.bucket_id}/${object.name}. Backup cancelado.`);
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (object.metadata?.size != null && bytes.length !== Number(object.metadata.size)) throw new Error("Tamanho de arquivo inconsistente; repita o backup.");
    let binary = ""; for (let i=0; i<bytes.length; i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    files.push({ bucket: object.bucket_id, name: object.name, content_type: data.type || object.metadata?.mimetype, sha256: await logSha256(bytes), base64: btoa(binary) });
    logEl("logCenterStatus").textContent = `Backup: ${files.length}/${snapshot.objects.length} arquivos; aguarde...`;
  }
  // Storage is not transactional with Postgres. Refuse a moving snapshot.
  if (canonicalLogJson(snapshot) !== canonicalLogJson(await read())) throw new Error("Os dados mudaram durante o backup. Tente novamente fora do horário de movimentação.");
  const payload = { format: "dnms-recovery", version: 1, scope: selected ? "specific" : "global", source: SUPABASE_URL,
    generated_at: new Date().toISOString(), excluded: ["auth sessions and transient tokens", "Supabase/Cloudflare infrastructure settings and source code"], snapshot, files };
  const serialized = canonicalLogJson(payload);
  const checksum = await logSha256(new TextEncoder().encode(serialized));
  requireLogSession(sessionId, "backup");
  logDownload(`dnms_backup_${payload.scope}_${formatTodayIso()}.json`, JSON.stringify({ sha256: checksum, payload }));
}

logEl("logDataTable").addEventListener("change", renderLogFields);
logEl("btnLogShareExcelFile").addEventListener("click", () => {
  if (logCenter.excelExport) shareLogExcelRecord(logCenter.excelExport);
});
logEl("btnLogDownloadExcelFile").addEventListener("click", () => {
  try {
    if (!logCenter.excelExport) return;
    const file = getLogExcelFile(logCenter.excelExport);
    logDownload(file.name, file, file.type);
  } catch (error) { alert(`Download não concluído: ${error.message}`); }
});
logEl("btnLogAddCriterion").addEventListener("click", addLogCriterion);
logEl("btnLogConsult").addEventListener("click", async () => {
  if (logCenter.busy) return;
  logCenter.busy = true;
  try {
    if (!logCenter.catalog.length) {
      logCenter.error = ""; await loadLogCatalog();
      if (!logCenter.catalog.length) throw new Error(logCenter.error || "Catálogo indisponível");
    }
    const result = await queryLogData(); els.logList.replaceChildren();
    result.rows.slice(0,100).forEach((row) => {
      const el = document.createElement("div"); el.className = "list-item"; el.textContent = JSON.stringify(row); els.logList.append(el);
    });
    logEl("logCenterStatus").textContent = `${result.rows.length} registro(s). Prévia limitada a 100; a exportação inclui todos os resultados filtrados.`;
  } catch (e) { logEl("logCenterStatus").textContent = `Consulta não concluída: ${e.message}`; }
  finally { logCenter.busy = false; }
});

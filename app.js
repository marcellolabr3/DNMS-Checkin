﻿const STORAGE_KEY = "checkin_app_state_v1";
const STORAGE_BUCKET = "dnms-photos";
const PENDING_PROFILE_PHOTO_PREFIX = "pending_profile_photo_v1:";

const DEFAULT_RECURRENCE_WEEKS = 4;
const SADMIN_EMAIL = "marvinlabre@gmail.com";
const SUPABASE_URL = "https://ziuezwtmmnspkycixqtf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWV6d3RtbW5zcGt5Y2l4cXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjY2NjksImV4cCI6MjA5MDIwMjY2OX0.WCPR3YQyJqyChtYjNMXgYXipRiEYf4_BJjS8-RalZj4";
const { storage: authStorage, blocked: authStorageBlocked } = createAuthStorage();
const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const state = loadState();
const signupContext = { role: "responsavel", inviteToken: "" };
const roomFormContext = { editingId: "" };
const studentDetailsContext = { studentId: "" };

const els = {
  sessionRole: document.getElementById("sessionRole"),
  btnHomePanel: document.getElementById("btnHomePanel"),
  btnRoomsPanel: document.getElementById("btnRoomsPanel"),
  btnStudentsPanel: document.getElementById("btnStudentsPanel"),
  btnTipsInbox: document.getElementById("btnTipsInbox"),
  tipsUnreadCount: document.getElementById("tipsUnreadCount"),
  btnPrintPanel: document.getElementById("btnPrintPanel"),
  btnLogPanel: document.getElementById("btnLogPanel"),
  btnInvitePanel: document.getElementById("btnInvitePanel"),
  btnLogout: document.getElementById("btnLogout"),
  btnLogin: document.getElementById("btnLogin"),
  btnOpenSignup: document.getElementById("btnOpenSignup"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  dashboardCard: document.getElementById("dashboardCard"),
  dashboardAgenda: document.getElementById("dashboardAgenda"),
  dashboardAlerts: document.getElementById("dashboardAlerts"),
  dashboardLessonToday: document.getElementById("dashboardLessonToday"),
  dashboardSchedules: document.getElementById("dashboardSchedules"),
  dashboardBirthdays: document.getElementById("dashboardBirthdays"),
  dashboardAdminTools: document.getElementById("dashboardAdminTools"),
  dashboardInfoText: document.getElementById("dashboardInfoText"),
  btnSaveDashboardInfo: document.getElementById("btnSaveDashboardInfo"),
  scheduleFileInput: document.getElementById("scheduleFileInput"),
  btnImportScheduleFile: document.getElementById("btnImportScheduleFile"),
  tipsRecipientSelect: document.getElementById("tipsRecipientSelect"),
  tipsMessageInput: document.getElementById("tipsMessageInput"),
  btnSendTip: document.getElementById("btnSendTip"),
  btnClearTipMessage: document.getElementById("btnClearTipMessage"),
  roomStatus: document.getElementById("roomStatus"),
  roomCurrent: document.getElementById("roomCurrent"),
  roomList: document.getElementById("roomList"),
  roomName: document.getElementById("roomName"),
  roomDate: document.getElementById("roomDate"),
  roomStartTime: document.getElementById("roomStartTime"),
  roomEndTime: document.getElementById("roomEndTime"),
  roomClass: document.getElementById("roomClass"),
  roomRecurrence: document.getElementById("roomRecurrence"),
  btnCreateRoom: document.getElementById("btnCreateRoom"),
  btnDeleteRoomFromEdit: document.getElementById("btnDeleteRoomFromEdit"),
  studentList: document.getElementById("studentList"),
  studentSearch: document.getElementById("studentSearch"),
  studentClassFilter: document.getElementById("studentClassFilter"),
  studentFilters: document.getElementById("studentFilters"),
  btnAddStudent: document.getElementById("btnAddStudent"),
  btnParentCheckin: document.getElementById("btnParentCheckin"),
  studentActions: document.getElementById("studentActions"),
  studentEmpty: document.getElementById("studentEmpty"),
  bulkActions: document.getElementById("bulkActions"),
  selectAllStudents: document.getElementById("selectAllStudents"),
  btnBulkCheckin: document.getElementById("btnBulkCheckin"),
  btnBulkCheckout: document.getElementById("btnBulkCheckout"),
  qrDialog: document.getElementById("qrDialog"),
  qrDialogInput: document.getElementById("qrDialogInput"),
  qrDialogStatus: document.getElementById("qrDialogStatus"),
  qrDialogLabel: document.getElementById("qrDialogLabel"),
  btnQrDialogCheckin: document.getElementById("btnQrDialogCheckin"),
  parentCheckinDialog: document.getElementById("parentCheckinDialog"),
  parentCheckinList: document.getElementById("parentCheckinList"),
  btnParentCheckinSelected: document.getElementById("btnParentCheckinSelected"),
  checkoutDialog: document.getElementById("checkoutDialog"),
  checkoutSummary: document.getElementById("checkoutSummary"),
  checkoutCheckinId: document.getElementById("checkoutCheckinId"),
  btnConfirmCheckout: document.getElementById("btnConfirmCheckout"),
  tipsDialog: document.getElementById("tipsDialog"),
  tipsList: document.getElementById("tipsList"),
  btnDeleteAllTips: document.getElementById("btnDeleteAllTips"),
  btnMarkAllTipsRead: document.getElementById("btnMarkAllTipsRead"),
  roomDetailsDialog: document.getElementById("roomDetailsDialog"),
  roomDetailsTitle: document.getElementById("roomDetailsTitle"),
  roomDetailsMeta: document.getElementById("roomDetailsMeta"),
  roomDetailsStudents: document.getElementById("roomDetailsStudents"),
  btnRoomDialogOpen: document.getElementById("btnRoomDialogOpen"),
  btnRoomDialogEdit: document.getElementById("btnRoomDialogEdit"),
  btnRoomDialogClose: document.getElementById("btnRoomDialogClose"),
  btnExport: document.getElementById("btnExport"),
  btnShareWhatsapp: document.getElementById("btnShareWhatsapp"),
  logStart: document.getElementById("logStart"),
  logEnd: document.getElementById("logEnd"),
  logClassFilter: document.getElementById("logClassFilter"),
  logStudentFilter: document.getElementById("logStudentFilter"),
  btnLogSelectStudents: document.getElementById("btnLogSelectStudents"),
  logSelectedStudentsSummary: document.getElementById("logSelectedStudentsSummary"),
  logSummary: document.getElementById("logSummary"),
  logCounts: document.getElementById("logCounts"),
  logList: document.getElementById("logList"),
  logStudentsDialog: document.getElementById("logStudentsDialog"),
  logStudentsSelectAll: document.getElementById("logStudentsSelectAll"),
  logStudentsList: document.getElementById("logStudentsList"),
  btnApplyLogStudents: document.getElementById("btnApplyLogStudents"),
  inviteCard: document.getElementById("inviteCard"),
  manageUserSearch: document.getElementById("manageUserSearch"),
  manageUsersStatus: document.getElementById("manageUsersStatus"),
  manageUsersList: document.getElementById("manageUsersList"),
  manageUserEditor: document.getElementById("manageUserEditor"),
  studentDialog: document.getElementById("studentDialog"),
  studentDialogTitle: document.getElementById("studentDialogTitle"),
  studentId: document.getElementById("studentId"),
  studentName: document.getElementById("studentName"),
  studentBirth: document.getElementById("studentBirth"),
  studentPhoto: document.getElementById("studentPhoto"),
  studentPhotoCamera: document.getElementById("studentPhotoCamera"),
  studentPhotoPreview: document.getElementById("studentPhotoPreview"),
  studentGuardianField: document.getElementById("studentGuardianField"),
  studentGuardian: document.getElementById("studentGuardian"),
  studentOtherField: document.getElementById("studentOtherField"),
  studentOther: document.getElementById("studentOther"),
  studentPhoneField: document.getElementById("studentPhoneField"),
  studentPhone: document.getElementById("studentPhone"),
  studentAddressField: document.getElementById("studentAddressField"),
  studentAddress: document.getElementById("studentAddress"),
  studentNotes: document.getElementById("studentNotes"),
  studentVisitorField: document.getElementById("studentVisitorField"),
  studentIsVisitor: document.getElementById("studentIsVisitor"),
  btnDeleteStudent: document.getElementById("btnDeleteStudent"),
  btnSaveStudent: document.getElementById("btnSaveStudent"),
  studentDetailsDialog: document.getElementById("studentDetailsDialog"),
  studentDetailsTitle: document.getElementById("studentDetailsTitle"),
  studentDetailsPhoto: document.getElementById("studentDetailsPhoto"),
  studentDetailsInfo: document.getElementById("studentDetailsInfo"),
  btnStudentDetailsEdit: document.getElementById("btnStudentDetailsEdit"),
  btnStudentDetailsCheckout: document.getElementById("btnStudentDetailsCheckout"),
  labelDialog: document.getElementById("labelDialog"),
  labelPreview: document.getElementById("labelPreview"),
  btnPrintLabel: document.getElementById("btnPrintLabel"),
  btnCloseLabel: document.getElementById("btnCloseLabel"),
  signupDialog: document.getElementById("signupDialog"),
  signupDialogTitle: document.getElementById("signupDialogTitle"),
  signupInviteToken: document.getElementById("signupInviteToken"),
  signupName: document.getElementById("signupName"),
  signupPhoto: document.getElementById("signupPhoto"),
  signupPhotoPreview: document.getElementById("signupPhotoPreview"),
  signupBirthField: document.getElementById("signupBirthField"),
  signupBirth: document.getElementById("signupBirth"),
  signupCivilField: document.getElementById("signupCivilField"),
  signupCivilStatus: document.getElementById("signupCivilStatus"),
  signupPhoneField: document.getElementById("signupPhoneField"),
  signupPhoneDdd: document.getElementById("signupPhoneDdd"),
  signupPhone: document.getElementById("signupPhone"),
  signupEmail: document.getElementById("signupEmail"),
  signupPassword: document.getElementById("signupPassword"),
  signupVisitorField: document.getElementById("signupVisitorField"),
  signupIsVisitor: document.getElementById("signupIsVisitor"),
  btnSubmitSignup: document.getElementById("btnSubmitSignup")
};

boot();

async function boot() {
  bindEvents();
  handleInviteQueryParams();
  seedRoomDefaults();
  renderSession();
  renderRoleVisibility();
  if (authStorageBlocked) {
    console.warn("Armazenamento bloqueado pelo navegador. Sessao pode nao persistir.");
  }
  if (supabaseClient) {
    await hydrateFromSupabase();
  } else {
    if (!state.students.length) {
      seedData();
    }
    normalizeStudents();
    render();
  }
  registerServiceWorker();
}

function bindEvents() {
  els.btnLogin.addEventListener("click", handleLogin);
  els.btnOpenSignup?.addEventListener("click", () => openSignupDialog("responsavel"));
  els.btnSubmitSignup?.addEventListener("click", handleSignupSubmit);
  els.btnHomePanel?.addEventListener("click", goHomePanel);
  els.btnRoomsPanel?.addEventListener("click", () => setActivePanel("rooms"));
  els.btnStudentsPanel?.addEventListener("click", () => setActivePanel("students"));
  els.btnTipsInbox?.addEventListener("click", openTipsDialog);
  els.btnLogPanel?.addEventListener("click", toggleLogPanel);
  els.btnInvitePanel?.addEventListener("click", toggleInvitePanel);
  els.btnLogout.addEventListener("click", handleLogout);
  els.btnPrintPanel.addEventListener("click", () => window.open("print.html", "_blank"));
  els.btnCreateRoom.addEventListener("click", createRooms);
  els.btnDeleteRoomFromEdit?.addEventListener("click", handleDeleteRoomFromEdit);
  els.btnAddStudent.addEventListener("click", () => openStudentDialog());
  els.btnParentCheckin?.addEventListener("click", openQrDialog);
  els.btnParentCheckinSelected.addEventListener("click", handleParentCheckinSelected);
  els.studentSearch.addEventListener("input", renderStudents);
  els.studentClassFilter.addEventListener("change", renderStudents);
  els.selectAllStudents.addEventListener("change", handleSelectAllStudents);
  els.btnBulkCheckin.addEventListener("click", handleBulkCheckin);
  els.btnBulkCheckout.addEventListener("click", handleBulkCheckout);
  els.btnQrDialogCheckin.addEventListener("click", (event) =>
    handleQrCheckin(els.qrDialogInput, els.qrDialogStatus, event)
  );
  els.btnExport.addEventListener("click", exportCsv);
  els.btnShareWhatsapp?.addEventListener("click", shareLogWhatsapp);
  els.logStart.addEventListener("change", renderLog);
  els.logEnd.addEventListener("change", renderLog);
  els.logClassFilter?.addEventListener("change", () => {
    state.ui.logSelectedStudentIds = [];
    renderLog();
  });
  els.logStudentFilter?.addEventListener("input", renderLog);
  els.btnLogSelectStudents?.addEventListener("click", openLogStudentsDialog);
  els.logStudentsSelectAll?.addEventListener("change", handleLogStudentsSelectAll);
  els.btnApplyLogStudents?.addEventListener("click", applyLogStudentsSelection);
  els.btnSaveStudent.addEventListener("click", saveStudent);
  els.btnDeleteStudent?.addEventListener("click", deleteStudentFromDialog);
  els.btnStudentDetailsEdit?.addEventListener("click", handleStudentDetailsEdit);
  els.btnStudentDetailsCheckout?.addEventListener("click", handleStudentDetailsCheckout);
  els.btnConfirmCheckout.addEventListener("click", confirmCheckout);
  els.btnRoomDialogOpen?.addEventListener("click", handleRoomDialogOpen);
  els.btnRoomDialogEdit?.addEventListener("click", handleRoomDialogEdit);
  els.btnRoomDialogClose?.addEventListener("click", handleRoomDialogClose);
  els.btnSaveDashboardInfo?.addEventListener("click", saveDashboardInfo);
  els.btnImportScheduleFile?.addEventListener("click", importScheduleFromFile);
  els.btnSendTip?.addEventListener("click", sendTipMessage);
  els.btnClearTipMessage?.addEventListener("click", clearTipMessageBox);
  els.btnDeleteAllTips?.addEventListener("click", deleteAllVisibleTips);
  els.btnMarkAllTipsRead?.addEventListener("click", markAllTipsAsRead);
  els.manageUserSearch?.addEventListener("input", () => renderManagementPanel());
  els.btnPrintLabel.addEventListener("click", printCurrentLabel);
  els.btnCloseLabel.addEventListener("click", () => els.labelDialog.close());
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("print-label");
    if (els.labelDialog?.open) {
      els.labelDialog.close();
    }
  });

  if (els.studentPhoto) {
    els.studentPhoto.addEventListener("change", () => {
      updatePhotoPreview(els.studentPhoto, els.studentPhotoPreview);
    });
  }
  if (els.studentPhotoCamera) {
    els.studentPhotoCamera.addEventListener("change", () => {
      updatePhotoPreview(els.studentPhotoCamera, els.studentPhotoPreview);
    });
  }
  if (els.signupPhoto) {
    els.signupPhoto.addEventListener("change", () => {
      updatePhotoPreview(els.signupPhoto, els.signupPhotoPreview);
    });
  }
  if (isMobileDevice() && els.btnPrintLabel) {
    els.btnPrintLabel.style.display = "none";
  }
}

function render() {
  renderSession();
  renderRoleVisibility();
  renderDashboard();
  renderRooms();
  renderStudents();
  renderLog();
  renderManagementPanel();
  saveState();
}

function renderSession() {
  if (state.session) {
    const sessionName = state.session.name || formatRole(state.session.role);
    els.sessionRole.textContent = sessionName;
    ensureDefaultActivePanel();
    els.btnLogout.style.display = "inline-flex";
    if (els.btnHomePanel) {
      els.btnHomePanel.style.display = isAdmin() || isEquipe() ? "inline-flex" : "none";
    }
    if (els.btnRoomsPanel) {
      els.btnRoomsPanel.style.display = isAdmin() || isEquipe() ? "inline-flex" : "none";
    }
    if (els.btnStudentsPanel) {
      els.btnStudentsPanel.style.display = isAdmin() || isEquipe() ? "inline-flex" : "none";
    }
    if (els.btnTipsInbox) {
      els.btnTipsInbox.style.display = "inline-flex";
    }
    if (els.btnPrintPanel) {
      els.btnPrintPanel.style.display = isAdmin() || isEquipe() ? "inline-flex" : "none";
    }
    if (els.btnLogPanel) {
      els.btnLogPanel.style.display = isAdmin() || isEquipe() ? "inline-flex" : "none";
    }
    if (els.btnInvitePanel) {
      els.btnInvitePanel.style.display = canAccessManagementPanel() ? "inline-flex" : "none";
    }
  } else {
    els.sessionRole.textContent = "Deslogado";
    els.btnLogout.style.display = "none";
    if (els.btnRoomsPanel) {
      els.btnRoomsPanel.style.display = "none";
    }
    if (els.btnStudentsPanel) {
      els.btnStudentsPanel.style.display = "none";
    }
    if (els.btnTipsInbox) {
      els.btnTipsInbox.style.display = "none";
    }
    if (els.btnPrintPanel) {
      els.btnPrintPanel.style.display = "none";
    }
    if (els.btnHomePanel) {
      els.btnHomePanel.style.display = "none";
    }
    if (els.btnLogPanel) {
      els.btnLogPanel.style.display = "none";
    }
    if (els.btnInvitePanel) {
      els.btnInvitePanel.style.display = "none";
    }
  }
  updateHeaderPanelButtons();
  updateTipsUnreadBadge();
}

async function fetchProfile(userId) {
  const primaryResult = await supabaseClient.from("profiles").select("id,name,role,email").eq("id", userId).single();
  if (!primaryResult.error && primaryResult.data) {
    return primaryResult.data;
  }
  const primaryErrorMessage = (primaryResult.error?.message || "").toLowerCase();
  const missingNameColumn = primaryErrorMessage.includes("column") && primaryErrorMessage.includes("name");
  if (!missingNameColumn) {
    console.warn("Falha ao buscar perfil", primaryResult.error);
    return null;
  }
  const legacyResult = await supabaseClient.from("profiles").select("id,nome,role").eq("id", userId).single();
  if (legacyResult.error) {
    console.warn("Falha ao buscar perfil (schema legado)", legacyResult.error);
    return null;
  }
  return {
    id: legacyResult.data.id,
    name: legacyResult.data.nome || "",
    role: legacyResult.data.role,
    email: ""
  };
}

function goHomePanel() {
  if (!state.session) {
    return;
  }
  setActivePanel("dashboard");
}

function setActivePanel(panel) {
  if (!state.session) {
    return;
  }
  if (panel === "invite" && !canAccessManagementPanel()) {
    panel = "dashboard";
  }
  state.ui.activePanel = panel;
  state.ui.showLogPanel = panel === "log";
  state.ui.showInvitePanel = panel === "invite";
  render();
}

function ensureDefaultActivePanel() {
  if (!state.session) {
    return;
  }
  if (state.session.role === "responsavel") {
    state.ui.activePanel = "students";
    state.ui.showLogPanel = false;
    state.ui.showInvitePanel = false;
    return;
  }
  const allowed = new Set(["dashboard", "rooms", "students", "log", "invite"]);
  if (!allowed.has(state.ui.activePanel || "")) {
    state.ui.activePanel = "dashboard";
  }
  if (state.ui.activePanel === "invite" && !canAccessManagementPanel()) {
    state.ui.activePanel = "dashboard";
  }
  state.ui.showLogPanel = state.ui.activePanel === "log";
  state.ui.showInvitePanel = state.ui.activePanel === "invite";
}

function getActivePanel() {
  return state.ui.activePanel || "dashboard";
}

function updateHeaderPanelButtons() {
  const active = getActivePanel();
  if (els.btnHomePanel) {
    els.btnHomePanel.className = active === "dashboard" ? "primary" : "ghost";
  }
  if (els.btnRoomsPanel) {
    els.btnRoomsPanel.className = active === "rooms" ? "primary" : "ghost";
  }
  if (els.btnStudentsPanel) {
    els.btnStudentsPanel.className = active === "students" ? "primary" : "ghost";
  }
}

function updateTipsUnreadBadge() {
  if (!els.tipsUnreadCount || !els.btnTipsInbox) {
    return;
  }
  const unread = getUnreadTipsForCurrentUser();
  els.tipsUnreadCount.textContent = String(unread.length);
  els.tipsUnreadCount.style.display = unread.length ? "inline-flex" : "none";
  els.btnTipsInbox.classList.toggle("has-unread", unread.length > 0);
}

function getUnreadTipsForCurrentUser() {
  if (!state.session) {
    return [];
  }
  const myId = state.session.id;
  return state.tips.filter((tip) => {
    const isRecipient = !tip.recipientId || tip.recipientId === myId;
    if (!isRecipient) {
      return false;
    }
    return !state.tipReads.some((read) => read.tipId === tip.id && read.userId === myId);
  });
}

function getVisibleTipsForCurrentUser() {
  if (!state.session) {
    return [];
  }
  const myId = state.session.id;
  return state.tips
    .filter((tip) => !tip.recipientId || tip.recipientId === myId || isAdmin())
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function isTipReadByCurrentUser(tipId) {
  if (!state.session) {
    return true;
  }
  return state.tipReads.some((read) => read.tipId === tipId && read.userId === state.session.id);
}

function openTipsDialog() {
  if (!state.session) {
    return;
  }
  renderTipsDialog();
  els.tipsDialog?.showModal();
}

function renderTipsDialog() {
  if (!els.tipsList) {
    return;
  }
  const tips = getVisibleTipsForCurrentUser();
  const canDeleteTips = canAccessManagementPanel();
  if (!tips.length) {
    els.tipsList.innerHTML = `<div class="summary">Nenhuma mensagem disponivel.</div>`;
    return;
  }
  const expandedTips = new Set(state.ui?.expandedTips || []);
  els.tipsList.innerHTML = "";
  tips.forEach((tip) => {
    const read = isTipReadByCurrentUser(tip.id);
    const dateText = formatDateTimeFromIso(tip.createdAt);
    const message = String(tip.message || "");
    const wrapper = document.createElement("div");
    wrapper.className = `list-item ${read ? "" : "is-selected"}`;

    const title = document.createElement("strong");
    title.textContent = `${read ? "" : "[Nova] "}Mensagem`;
    wrapper.appendChild(title);

    const date = document.createElement("span");
    date.className = "muted";
    date.textContent = dateText;
    wrapper.appendChild(date);

    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "tip-message-preview";
    preview.setAttribute("data-tip-id", tip.id);
    const expanded = expandedTips.has(tip.id);
    preview.textContent = expanded ? message : truncateTipMessage(message, 90);
    wrapper.appendChild(preview);

    if (expanded && message.length > 90) {
      const hint = document.createElement("span");
      hint.className = "muted";
      hint.textContent = "Clique para recolher";
      wrapper.appendChild(hint);
    }

    if (canDeleteTips) {
      const actions = document.createElement("div");
      actions.className = "actions";
      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "danger";
      btnDelete.textContent = "Apagar mensagem";
      btnDelete.addEventListener("click", async () => {
        const confirmed = confirm("Deseja apagar esta mensagem?");
        if (!confirmed) {
          return;
        }
        await deleteTipMessage(tip.id);
      });
      actions.appendChild(btnDelete);
      wrapper.appendChild(actions);
    }

    preview.addEventListener("click", async () => {
      const current = new Set(state.ui?.expandedTips || []);
      if (current.has(tip.id)) {
        current.delete(tip.id);
      } else {
        current.add(tip.id);
      }
      state.ui.expandedTips = Array.from(current);
      if (!read) {
        await markTipAsRead(tip.id);
      }
      renderTipsDialog();
    });

    els.tipsList.appendChild(wrapper);
  });
}

function truncateTipMessage(message, max = 90) {
  if (!message || message.length <= max) {
    return message || "";
  }
  return `${message.slice(0, max).trimEnd()}...`;
}

async function deleteTipMessage(tipId) {
  if (!tipId || !state.session || !canAccessManagementPanel()) {
    return;
  }
  if (supabaseClient) {
    let { data: deletedRows, error } = await supabaseClient
      .from("tips")
      .delete()
      .eq("id", tipId)
      .select("id");
    if (error) {
      const message = String(error.message || "").toLowerCase();
      const looksLikeFkBlock = message.includes("foreign key") || message.includes("constraint");
      if (looksLikeFkBlock) {
        const { error: readsError } = await supabaseClient.from("tip_reads").delete().eq("tip_id", tipId);
        if (readsError) {
          alert(`Falha ao apagar leituras da mensagem: ${readsError.message || "erro inesperado"}`);
          return;
        }
        const retry = await supabaseClient.from("tips").delete().eq("id", tipId).select("id");
        deletedRows = retry.data;
        error = retry.error;
      }
    }
    if (error) {
      alert(`Falha ao apagar mensagem: ${error.message || "erro inesperado"}`);
      return;
    }
    if (!Array.isArray(deletedRows) || !deletedRows.length) {
      alert("Mensagem nao apagada. Verifique permissoes RLS de DELETE na tabela tips.");
      return;
    }
    await fetchDashboardData();
  } else {
    state.tipReads = state.tipReads.filter((item) => item.tipId !== tipId);
    state.tips = state.tips.filter((item) => item.id !== tipId);
  }
  state.ui.expandedTips = (state.ui.expandedTips || []).filter((id) => id !== tipId);
  updateTipsUnreadBadge();
  renderTipsDialog();
  render();
}

async function deleteAllVisibleTips() {
  if (!state.session || !canAccessManagementPanel()) {
    return;
  }
  const tips = getVisibleTipsForCurrentUser();
  if (!tips.length) {
    return;
  }
  const confirmed = confirm(`Deseja apagar ${tips.length} mensagem(ns)?`);
  if (!confirmed) {
    return;
  }
  if (supabaseClient) {
    const ids = tips.map((tip) => tip.id);
    let { data: deletedRows, error } = await supabaseClient.from("tips").delete().in("id", ids).select("id");
    if (error) {
      const message = String(error.message || "").toLowerCase();
      const looksLikeFkBlock = message.includes("foreign key") || message.includes("constraint");
      if (looksLikeFkBlock) {
        const { error: readsError } = await supabaseClient.from("tip_reads").delete().in("tip_id", ids);
        if (readsError) {
          alert(`Falha ao apagar leituras das mensagens: ${readsError.message || "erro inesperado"}`);
          return;
        }
        const retry = await supabaseClient.from("tips").delete().in("id", ids).select("id");
        deletedRows = retry.data;
        error = retry.error;
      }
    }
    if (error) {
      alert(`Falha ao apagar mensagens: ${error.message || "erro inesperado"}`);
      return;
    }
    if (!Array.isArray(deletedRows) || !deletedRows.length) {
      alert("Nenhuma mensagem foi apagada. Verifique permissoes RLS de DELETE na tabela tips.");
      return;
    }
    await fetchDashboardData();
  } else {
    const ids = new Set(tips.map((tip) => tip.id));
    state.tipReads = state.tipReads.filter((item) => !ids.has(item.tipId));
    state.tips = state.tips.filter((item) => !ids.has(item.id));
  }
  state.ui.expandedTips = [];
  updateTipsUnreadBadge();
  renderTipsDialog();
  render();
}

async function markTipAsRead(tipId) {
  if (!state.session || !tipId || isTipReadByCurrentUser(tipId)) {
    return;
  }
  const readAt = new Date().toISOString();
  if (supabaseClient) {
    const { error } = await supabaseClient.from("tip_reads").upsert(
      [{ tip_id: tipId, user_id: state.session.id, read_at: readAt }],
      { onConflict: "tip_id,user_id" }
    );
    if (error) {
      console.warn("Falha ao marcar mensagem como lida", error);
      return;
    }
  }
  if (!state.tipReads.some((item) => item.tipId === tipId && item.userId === state.session.id)) {
    state.tipReads.push({ tipId, userId: state.session.id, readAt });
  }
  updateTipsUnreadBadge();
}

async function markAllTipsAsRead() {
  if (!state.session) {
    return;
  }
  const unread = getUnreadTipsForCurrentUser();
  if (!unread.length) {
    return;
  }
  if (supabaseClient) {
    const payload = unread.map((tip) => ({
      tip_id: tip.id,
      user_id: state.session.id,
      read_at: new Date().toISOString()
    }));
    const { error } = await supabaseClient.from("tip_reads").upsert(payload, { onConflict: "tip_id,user_id" });
    if (error) {
      alert(`Falha ao marcar mensagens como lidas: ${error.message || "erro inesperado"}`);
      return;
    }
    await fetchDashboardData();
  } else {
    unread.forEach((tip) => {
      state.tipReads.push({ tipId: tip.id, userId: state.session.id, readAt: new Date().toISOString() });
    });
  }
  updateTipsUnreadBadge();
  renderTipsDialog();
  render();
}

async function hydrateFromSupabase() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.warn("Falha na sessao", error);
    }
    const session = data?.session;
    if (!session) {
      state.session = null;
      state.students = [];
      state.rooms = [];
      state.checkins = [];
      state.profiles = [];
      state.schedules = [];
      state.tips = [];
      state.tipReads = [];
      state.dashboardInfo = "";
      render();
      return;
    }
    let profile = await fetchProfile(session.user.id);
    if (!profile) {
      profile = await ensureProfileFromAuthUser(session.user);
    }
    if (!profile) {
      state.session = null;
      render();
      return;
    }
    state.session = { id: profile.id, name: profile.name, role: normalizeRole(profile.role), email: profile.email || "" };
    await uploadPendingProfilePhoto(session.user);
    await fetchRooms();
    await fetchStudents();
    await fetchCheckins();
    await fetchProfiles();
    await fetchDashboardData();
    normalizeStudents();
    ensureDefaultActivePanel();
    render();
  } catch (err) {
    console.warn("Falha ao carregar dados", err);
    alert("Falha ao carregar dados do Supabase. Verifique sua conexao.");
    state.session = null;
    render();
  }
}

async function ensureProfileFromAuthUser(user) {
  if (!user?.id) {
    return null;
  }
  const metadata = user.user_metadata || {};
  const allowedRoles = new Set(["admin", "equipe", "responsavel", "dnms_kids"]);
  const desiredRoleRaw = metadata.desired_role || metadata.role || "responsavel";
  const desiredRole = normalizeRole(desiredRoleRaw);
  const role = allowedRoles.has(desiredRole) ? desiredRole : "responsavel";
  const payload = {
    id: user.id,
    name: metadata.full_name || user.email || "Usuario",
    role,
    email: user.email || null,
    birth_date: metadata.birth_date || null,
    marital_status: metadata.marital_status || null,
    phone: metadata.phone || null,
    is_visitor: Boolean(metadata.is_visitor)
  };
  if (role === "dnms_kids") {
    const inviteResult = await acceptInviteToken(metadata.invite_token, user.email || "");
    if (!inviteResult.ok) {
      return null;
    }
  }
  let { error } = await supabaseClient.from("profiles").upsert(payload);
  if (error) {
    ({ error } = await supabaseClient
      .from("profiles")
      .upsert({ id: payload.id, name: payload.name, role: payload.role, email: payload.email }));
  }
  if (error) {
    ({ error } = await supabaseClient
      .from("profiles")
      .upsert({ id: payload.id, nome: payload.name, role: payload.role }));
  }
  if (error) {
    return null;
  }
  return fetchProfile(user.id);
}

async function fetchStudents() {
  let rows = [];
  if (state.session?.role === "responsavel") {
    const { data: links, error: linkError } = await supabaseClient
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_id", state.session.id);
    if (linkError) {
      console.warn("Falha ao buscar vinculos de responsavel", linkError);
    }
    const studentIds = (links || []).map((item) => item.student_id).filter(Boolean);
    if (studentIds.length) {
      const { data, error } = await supabaseClient.from("students").select("*").in("id", studentIds);
      if (error) {
        console.warn("Falha ao buscar alunos", error);
        return;
      }
      rows = data || [];
    } else {
      const { data, error } = await supabaseClient
        .from("students")
        .select("*")
        .eq("primary_guardian_name", state.session.name);
      if (error) {
        console.warn("Falha ao buscar alunos do responsavel", error);
        rows = [];
      } else {
        rows = data || [];
      }
    }
  } else {
    const { data, error } = await supabaseClient.from("students").select("*");
    if (error) {
      console.warn("Falha ao buscar alunos", error);
      return;
    }
    rows = data || [];
  }
  state.students = rows.map((student) => ({
    id: student.id,
    name: student.name,
    birth: student.birth_date,
    className: student.class_name,
    guardian: student.primary_guardian_name,
    otherGuardians: "",
    phone: student.phone,
    address: student.address,
    notes: student.notes || "",
    owner: student.primary_guardian_name || "",
    isVisitor: Boolean(student.is_visitor),
    photoUrl: student.photo_url || ""
  }));
}

async function fetchRooms() {
  const { data, error } = await supabaseClient.from("rooms").select("*");
  if (error) {
    console.warn("Falha ao buscar salas", error);
    return;
  }
  state.rooms = data.map((room) => {
    const dateObj = parseInputDate(room.date);
    const dateLabel = dateObj ? formatDate(dateObj) : room.date;
    const startTime = room.start_time || room.time || "";
    const endTime = room.end_time || "";
    return {
      id: room.id,
      name: room.name,
      date: dateLabel,
      dateIso: room.date,
      startTime,
      endTime,
      time: startTime,
      classTarget: room.class_target,
      status: room.status,
      openedAt: room.opened_at ? formatTimeFromIso(room.opened_at) : "",
      closedAt: room.closed_at ? formatTimeFromIso(room.closed_at) : ""
    };
  });
}

async function fetchCheckins() {
  const { data, error } = await supabaseClient.from("checkins").select("*");
  if (error) {
    console.warn("Falha ao buscar check-ins", error);
    return;
  }
  const roomMap = new Map(state.rooms.map((room) => [room.id, room]));
  state.checkins = data.map((checkin) => {
    const room = roomMap.get(checkin.room_id);
    return {
      id: checkin.id,
      roomId: checkin.room_id,
      roomName: checkin.room_name_snapshot || room?.name || "-",
      studentId: checkin.student_id,
      className: checkin.class_name,
      notes: checkin.notes_snapshot || "",
      dateTime: formatDateTimeFromIso(checkin.checked_in_at),
      checkedOutAt: checkin.checked_out_at ? formatTimeFromIso(checkin.checked_out_at) : "",
      actor: state.session?.name || ""
    };
  });
}

function renderRooms() {
  const sortedRooms = state.rooms.slice().sort(compareRooms);
  const visibleRooms = sortedRooms.filter((room) => room.status !== "Fechada");
  const openRooms = visibleRooms.filter((room) => room.status === "Aberta");
  const canManageRoom = isAdmin() || isEquipe();

  els.btnCreateRoom.disabled = !canManageRoom;
  if (!visibleRooms.length) {
    els.roomStatus.textContent = "Nenhuma sala aberta";
    els.roomCurrent.textContent = "Nenhuma sala ativa na aba Eventos.";
  } else if (openRooms.length) {
    els.roomStatus.textContent = openRooms.length > 1 ? "Salas abertas" : "Sala aberta";
    els.roomCurrent.textContent = "Clique em uma sala para abrir/fechar e gerenciar.";
  } else {
    els.roomStatus.textContent = "Salas programadas";
    els.roomCurrent.textContent = "Clique em uma sala para abrir.";
  }

  els.roomList.innerHTML = "";
  visibleRooms.forEach((room) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${room.date} ${room.startTime || ""}${room.endTime ? ` - ${room.endTime}` : ""} - ${room.name}</strong>
      <span class="muted">Turma: ${room.classTarget || "-"} | Status: ${room.status}</span>
      <span class="muted">Abertura: ${room.openedAt || "-"} | Fechamento: ${room.closedAt || "-"}</span>
    `;
    item.addEventListener("click", () => {
      openRoomDetails(room.id);
    });
    els.roomList.appendChild(item);
  });
}

async function fetchProfiles() {
  if (!supabaseClient || !state.session || !canAccessManagementPanel()) {
    state.profiles = [];
    return;
  }
  const { data, error } = await supabaseClient.from("profiles").select("id,name,role,email");
  if (error) {
    console.warn("Falha ao buscar perfis", error);
    state.profiles = [];
    return;
  }
  state.profiles = (data || []).map((profile) => ({
    id: profile.id,
    name: profile.name || "Usuario",
    role: normalizeRole(profile.role),
    email: profile.email || ""
  }));
}

async function fetchDashboardData() {
  if (!supabaseClient || !state.session) {
    return;
  }
  const [{ data: infoRows, error: infoError }, { data: schedules, error: schedulesError }, { data: tips, error: tipsError }, { data: reads, error: readsError }] =
    await Promise.all([
      supabaseClient.from("dashboard_settings").select("info_text").eq("id", 1).limit(1),
      supabaseClient.from("schedules").select("*"),
      supabaseClient.from("tips").select("*"),
      supabaseClient.from("tip_reads").select("*")
    ]);

  if (!infoError) {
    state.dashboardInfo = infoRows?.[0]?.info_text || "";
  } else {
    console.warn("Falha ao buscar dashboard_settings", infoError);
    state.dashboardInfo = "";
  }

  if (!schedulesError) {
    state.schedules = (schedules || []).map((item) => ({
      id: item.id,
      date: item.date,
      profileId: item.profile_id || "",
      targetUser: item.target_user || "",
      lessonTheme: item.lesson_theme || "",
      details: item.details || ""
    }));
  } else {
    console.warn("Falha ao buscar schedules", schedulesError);
    state.schedules = [];
  }

  if (!tipsError) {
    state.tips = (tips || []).map((tip) => ({
      id: tip.id,
      message: tip.message || "",
      recipientId: tip.recipient_id || "",
      createdAt: tip.created_at || new Date().toISOString()
    }));
  } else {
    console.warn("Falha ao buscar tips", tipsError);
    state.tips = [];
  }

  if (!readsError) {
    state.tipReads = (reads || []).map((item) => ({
      tipId: item.tip_id,
      userId: item.user_id,
      readAt: item.read_at
    }));
  } else {
    console.warn("Falha ao buscar tip_reads", readsError);
    state.tipReads = [];
  }
}

function renderStudents() {
  const session = state.session;
  const search = els.studentSearch.value.toLowerCase();
  const canSeeAll = isEquipe() || isAdmin();
  const isResponsavel = session?.role === "responsavel";
  const classFilter = els.studentClassFilter.value;

  let items = state.students.slice();
  if (isResponsavel && !supabaseClient) {
    items = items.filter((student) => student.guardian === session?.name || student.owner === session?.name);
  }

  if (!isResponsavel && classFilter && classFilter !== "all" && classFilter !== "none") {
    items = items.filter((student) => (student.className || getClassForBirth(student.birth)) === classFilter);
  }
  if (!isResponsavel && classFilter === "none") {
    items = [];
  }

  if (search) {
    items = items.filter((student) => {
      const className = student.className || getClassForBirth(student.birth);
      const blob = `${student.name} ${className} ${student.guardian}`.toLowerCase();
      return blob.includes(search);
    });
  }

  if (els.studentEmpty) {
    if (isResponsavel && !items.length) {
      els.studentEmpty.textContent = "Nenhuma crianca cadastrada. Clique em Cadastrar crianca para continuar.";
      els.studentEmpty.style.display = "block";
    } else {
      els.studentEmpty.textContent = "";
      els.studentEmpty.style.display = "none";
    }
  }

  if (els.studentActions) {
    if (els.btnParentCheckin) {
      els.btnParentCheckin.style.display = "none";
    }
    if (isResponsavel) {
      els.btnAddStudent.textContent = items.length ? "Cadastrar nova crianca" : "Cadastrar crianca";
    } else {
      els.btnAddStudent.textContent = "Novo aluno";
    }
  }
  if (els.studentFilters) {
    els.studentFilters.style.display = isResponsavel ? "none" : "flex";
  }
  if (els.bulkActions) {
    els.bulkActions.style.display = canSeeAll ? "flex" : "none";
  }

  els.studentList.innerHTML = "";

  items.forEach((student) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const observationText = student.notes || "";
    const className = student.className || getClassForBirth(student.birth);
    const openCheckin = getOpenCheckinForStudent(student.id);
    const targetRoom = getOpenRoomForClass(className);
    const alreadyInTargetRoom = Boolean(
      targetRoom && state.checkins.find((checkin) => checkin.roomId === targetRoom.id && checkin.studentId === student.id)
    );
    const checkoutButton = openCheckin
      ? `<button class="ghost" data-checkout="${student.id}">Checkout</button>`
      : "";
    item.innerHTML = `
      ${canSeeAll ? `<label class="field checkbox-field"><span>Selecionar</span><input type="checkbox" data-select-student="${student.id}" /></label>` : ""}
      <strong>${student.name}</strong>
      <span class="muted">Turma: ${className} | Responsavel: ${student.guardian}</span>
      <span class="muted">Nascimento: ${student.birth || "-"} | Observacoes: ${observationText}</span>
      <div class="actions">
        <button class="ghost" data-edit="${student.id}">Editar</button>
        ${checkoutButton}
        <button class="primary" data-checkin="${student.id}">Check-in</button>
      </div>
    `;
    const btnEdit = item.querySelector("[data-edit]");
    const btnCheckin = item.querySelector("[data-checkin]");
    const btnCheckout = item.querySelector("[data-checkout]");

    btnEdit.addEventListener("click", () => openStudentDialog(student));
    btnCheckin.addEventListener("click", () => handleManualCheckin(student.id));
    btnCheckout?.addEventListener("click", () => openCheckoutDialog(openCheckin));
    item.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest("button") || target.closest("input[type='checkbox']") || target.closest("label")) {
        return;
      }
      openStudentDetailsDialog(student);
    });

    if (isResponsavel && !isAdmin() && !isEquipe() && btnCheckout) {
      btnCheckout.style.display = "none";
    }

    if (!canEditStudent(student)) {
      btnEdit.disabled = true;
    }

    if (!canCheckinStudent(student)) {
      btnCheckin.disabled = true;
    }
    if (alreadyInTargetRoom) {
      btnCheckin.disabled = true;
      btnCheckin.textContent = "Check-in realizado";
    }

    if (btnCheckout && (!openCheckin || !canCheckinStudent(student))) {
      btnCheckout.disabled = true;
    }

    els.studentList.appendChild(item);
  });

  if (els.selectAllStudents) {
    els.selectAllStudents.checked = false;
  }
}

function renderCheckins() {}

function renderDashboard() {
  if (
    !els.dashboardAgenda ||
    !els.dashboardAlerts ||
    !els.dashboardBirthdays ||
    !els.dashboardSchedules ||
    !els.dashboardLessonToday
  ) {
    return;
  }

  const canViewDashboard = Boolean(state.session) && getActivePanel() === "dashboard";
  if (!canViewDashboard) {
    return;
  }

  const today = formatToday();
  const todayRooms = state.rooms
    .filter((room) => room.date === today && room.status !== "Fechada")
    .slice()
    .sort(compareRooms);
  const upcomingRooms = getUpcomingRooms(30);
  const nextRoom = upcomingRooms[0] || null;
  const nextRoomLabel = nextRoom
    ? `${nextRoom.date} ${nextRoom.startTime || ""}${nextRoom.endTime ? ` - ${nextRoom.endTime}` : ""} | Turma ${nextRoom.classTarget || "-"}`
    : "Nenhum evento agendado";

  els.dashboardAgenda.innerHTML = `
    <strong>Agenda</strong><br />
    Hoje: ${todayRooms.length ? `${todayRooms.length} evento(s)` : "sem eventos"}<br />
    Proximos 30 dias: ${upcomingRooms.length} evento(s)<br />
    Proximo evento: ${nextRoomLabel}
  `;

  const alerts = [];
  const openRooms = state.rooms.filter((room) => room.status === "Aberta");
  const roomsWithoutTime = state.rooms.filter(
    (room) => room.status !== "Fechada" && (!room.startTime || !room.endTime)
  );
  const neuroStudents = state.students.filter((student) => {
    const notes = String(student.notes || "").toLowerCase();
    return /neuro|tea|autismo|autista|tdah/.test(notes);
  });

  if (openRooms.length) {
    alerts.push(`${openRooms.length} sala(s) aberta(s) neste momento.`);
  }
  if (roomsWithoutTime.length) {
    alerts.push(`${roomsWithoutTime.length} evento(s) sem horario completo (inicio/fim).`);
  }
  if (!alerts.length) {
    alerts.push("Sem alertas pendentes.");
  }
  const infoText = state.dashboardInfo || "Nenhuma informacao cadastrada.";
  const neuroLine = neuroStudents.length
    ? `Criancas neuroatipicas: ${neuroStudents.map((student) => student.name).join(", ")}`
    : "Criancas neuroatipicas: nenhuma identificada.";
  els.dashboardAlerts.innerHTML = `
    <strong>Informacoes</strong><br />
    ${infoText}<br />
    ${alerts.join("<br />")}<br />
    <strong>Atencao</strong><br />
    ${neuroLine}
  `;

  const mySchedules = state.schedules
    .filter((item) => scheduleBelongsToCurrentUser(item))
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcomingMySchedules = mySchedules.filter((item) => {
    const dateObj = parseInputDate(item.date);
    if (!dateObj) {
      return false;
    }
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return dateObj >= dayStart;
  });
  if (!upcomingMySchedules.length) {
    els.dashboardSchedules.innerHTML = `<div class="summary">Sem escalas futuras para voce.</div>`;
  } else {
    els.dashboardSchedules.innerHTML = upcomingMySchedules
      .slice(0, 8)
      .map((item) => {
        const dateObj = parseInputDate(item.date);
        const dateLabel = dateObj ? formatDate(dateObj) : item.date;
        return `<div class="list-item"><strong>${dateLabel}</strong><span class="muted">Tema: ${item.lessonTheme || "-"}</span></div>`;
      })
      .join("");
  }

  const todaySchedule = mySchedules.find((item) => {
    const dateObj = parseInputDate(item.date);
    const todayObj = parseRoomDate(today);
    return Boolean(dateObj && todayObj && dateObj.getTime() === todayObj.getTime());
  });
  els.dashboardLessonToday.innerHTML = `
    <strong>Tema da licao de hoje</strong><br />
    ${todaySchedule?.lessonTheme || "Sem tema definido para hoje."}
  `;

  const birthdayStudents = getCurrentMonthBirthdays();
  if (!birthdayStudents.length) {
    els.dashboardBirthdays.innerHTML = `<div class="summary">Nenhum aniversariante neste mes.</div>`;
  } else {
    els.dashboardBirthdays.innerHTML = birthdayStudents
      .map(
        (student) => `
          <div class="dashboard-birthday-item" data-birthday-student="${student.id}">
            <div class="dashboard-balloon">
              <img src="${student.photoUrl || getStudentPhotoPlaceholderUrl()}" alt="Foto de ${student.name}" />
            </div>
            <div class="dashboard-birthday-name">${student.name}</div>
            <div class="dashboard-birthday-date">${formatBirthdayLabel(student.birth)}</div>
          </div>
        `
      )
      .join("");

    const birthdayCards = els.dashboardBirthdays.querySelectorAll("[data-birthday-student]");
    birthdayCards.forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-birthday-student");
        const student = state.students.find((item) => item.id === id);
        if (student) {
          openStudentDetailsDialog(student);
        }
      });
    });
  }

  renderAdminDashboardTools();
  updateTipsUnreadBadge();
}

function renderAdminDashboardTools() {
  if (!els.dashboardAdminTools) {
    return;
  }
  const canManageDashboard = isAdmin();
  els.dashboardAdminTools.style.display = canManageDashboard ? "flex" : "none";
  if (!canManageDashboard) {
    return;
  }
  if (els.dashboardInfoText) {
    els.dashboardInfoText.value = state.dashboardInfo || "";
  }
  if (els.tipsRecipientSelect) {
    const current = els.tipsRecipientSelect.value || "all";
    const options = ['<option value="all">Todos os usuarios</option>']
      .concat(
        state.profiles
          .filter((profile) => profile.id !== state.session?.id)
          .map((profile) => `<option value="${profile.id}">${profile.name} (${formatRole(profile.role)})</option>`)
      )
      .join("");
    els.tipsRecipientSelect.innerHTML = options;
    if (Array.from(els.tipsRecipientSelect.options).some((option) => option.value === current)) {
      els.tipsRecipientSelect.value = current;
    }
  }
}

function renderRoleVisibility() {
  const session = state.session;
  const dashboardCard = document.getElementById("dashboardCard");
  const roomCard = document.getElementById("roomCard");
  const studentCard = document.getElementById("studentCard");
  const logCard = document.getElementById("logCard");
  const inviteCard = document.getElementById("inviteCard");
  const authCard = document.getElementById("authCard");
  const isResponsavel = session?.role === "responsavel";

  if (authCard) {
    authCard.style.display = session ? "none" : "flex";
  }

  if (!session) {
    if (dashboardCard) {
      dashboardCard.style.display = "none";
    }
    roomCard.style.display = "none";
    studentCard.style.display = "none";
    logCard.style.display = "none";
    if (inviteCard) {
      inviteCard.style.display = "none";
    }
    return;
  }

  if (isResponsavel) {
    if (dashboardCard) {
      dashboardCard.style.display = "none";
    }
    roomCard.style.display = "none";
    logCard.style.display = "none";
    if (inviteCard) {
      inviteCard.style.display = "none";
    }
    studentCard.style.display = "flex";
    return;
  }

  const activePanel = getActivePanel();
  if (activePanel === "log" && (isAdmin() || isEquipe())) {
    if (dashboardCard) {
      dashboardCard.style.display = "none";
    }
    roomCard.style.display = "none";
    studentCard.style.display = "none";
    logCard.style.display = "flex";
    if (inviteCard) {
      inviteCard.style.display = "none";
    }
    return;
  }
  if (activePanel === "invite" && canAccessManagementPanel()) {
    if (dashboardCard) {
      dashboardCard.style.display = "none";
    }
    roomCard.style.display = "none";
    studentCard.style.display = "none";
    logCard.style.display = "none";
    if (inviteCard) {
      inviteCard.style.display = "flex";
    }
    return;
  }
  if (dashboardCard) {
    dashboardCard.style.display = activePanel === "dashboard" ? "flex" : "none";
  }
  roomCard.style.display = activePanel === "rooms" ? "flex" : "none";
  studentCard.style.display = activePanel === "students" ? "flex" : "none";
  logCard.style.display = "none";
  if (inviteCard) {
    inviteCard.style.display = "none";
  }
}

function renderLog() {
  const canSeeLog = isEquipe() || isAdmin();
  const logCard = document.getElementById("logCard");
  logCard.style.display = canSeeLog && getActivePanel() === "log" ? "flex" : "none";
  if (!canSeeLog) {
    return;
  }

  renderLogClassFilterOptions();
  renderLogStudentFilterOptions();
  const startValue = els.logStart?.value || "";
  const endValue = els.logEnd?.value || "";
  if (!startValue || !endValue) {
    if (els.logSelectedStudentsSummary) {
      els.logSelectedStudentsSummary.textContent = "Selecione o periodo para habilitar a selecao de criancas.";
    }
    els.logSummary.textContent = "Selecione o periodo (De e Ate) para gerar a lista de frequencia.";
    els.logCounts.textContent = "";
    els.logList.innerHTML = "";
    if (els.btnExport) {
      els.btnExport.disabled = true;
    }
    if (els.btnShareWhatsapp) {
      els.btnShareWhatsapp.disabled = true;
    }
    if (els.btnLogSelectStudents) {
      els.btnLogSelectStudents.disabled = true;
    }
    return;
  }

  const items = getFilteredCheckins();
  const availableStudents = getAvailableLogStudents(items);
  const allowedIds = new Set(availableStudents.map((student) => student.id));
  state.ui.logSelectedStudentIds = (state.ui.logSelectedStudentIds || []).filter((id) => allowedIds.has(id));
  renderLogSelectedStudentsSummary(availableStudents);
  const rows = buildLogFrequencyRows(items);
  els.logList.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${row.studentName}</strong>
      <span class="muted">Turma: ${row.className}</span>
      <span class="muted">Horarios de check-in: ${row.timesLabel || "-"}</span>
    `;
    els.logList.appendChild(item);
  });

  const totalRows = rows.length;
  const totalCheckins = rows.reduce((acc, row) => acc + row.checkinCount, 0);
  if (!totalRows) {
    els.logSummary.textContent = "Nenhuma frequencia encontrada para o periodo selecionado.";
    els.logCounts.textContent = "";
  } else {
    els.logSummary.textContent = `Frequencia do periodo: ${totalRows} crianca(s) com presenca.`;
    els.logCounts.textContent = `Total de check-ins no periodo: ${totalCheckins}.`;
  }

  els.btnExport.disabled = !totalRows;
  if (els.btnShareWhatsapp) {
    els.btnShareWhatsapp.disabled = !totalRows;
  }
  if (els.btnLogSelectStudents) {
    els.btnLogSelectStudents.disabled = !availableStudents.length;
  }
}

function renderLogSummaryToday() {
  const today = formatToday();
  const items = state.checkins.filter((checkin) => checkin.dateTime.startsWith(today));
  const counts = groupCheckinsByClass(items);
  const total = items.length;
  els.logSummary.textContent = `Resumo do dia (${today}): ${total} check-in(s).`;
  els.logCounts.textContent = formatCounts(counts);
}

function toggleLogPanel() {
  if (!state.session || !(isAdmin() || isEquipe())) {
    return;
  }
  setActivePanel(getActivePanel() === "log" ? "dashboard" : "log");
}

function toggleInvitePanel() {
  if (!state.session || !canAccessManagementPanel()) {
    return;
  }
  const nextPanel = getActivePanel() === "invite" ? "dashboard" : "invite";
  setActivePanel(nextPanel);
  if (nextPanel === "invite") {
    fetchProfiles().then(() => renderManagementPanel());
  }
}

async function saveDashboardInfo() {
  if (!state.session || !isAdmin()) {
    return;
  }
  const value = (els.dashboardInfoText?.value || "").trim();
  if (supabaseClient) {
    const { error } = await supabaseClient.from("dashboard_settings").upsert({ id: 1, info_text: value });
    if (error) {
      alert(`Falha ao salvar informacoes: ${error.message || "erro inesperado"}`);
      return;
    }
    await fetchDashboardData();
  } else {
    state.dashboardInfo = value;
  }
  render();
}

async function importScheduleFromFile() {
  if (!state.session || !isAdmin()) {
    return;
  }
  const file = els.scheduleFileInput?.files?.[0];
  if (!file) {
    alert("Selecione um arquivo Excel ou CSV.");
    return;
  }
  const rows = await parseScheduleFile(file);
  if (!rows.length) {
    alert("Nenhuma linha valida encontrada no arquivo.");
    return;
  }
  const payload = rows
    .map((row) => normalizeScheduleRow(row))
    .filter((row) => row.date && row.lessonTheme);
  if (!payload.length) {
    alert("Arquivo sem colunas validas. Use: data, usuario(email ou nome), tema.");
    return;
  }

  if (supabaseClient) {
    const { error } = await supabaseClient.from("schedules").insert(
      payload.map((row) => ({
        date: row.date,
        profile_id: row.profileId || null,
        target_user: row.targetUser || null,
        lesson_theme: row.lessonTheme,
        details: row.details || "",
        created_by: state.session.id
      }))
    );
    if (error) {
      alert(`Falha ao importar escala: ${error.message || "erro inesperado"}`);
      return;
    }
    await fetchDashboardData();
  } else {
    payload.forEach((row) => {
      state.schedules.push({ id: uid(), ...row });
    });
  }
  if (els.scheduleFileInput) {
    els.scheduleFileInput.value = "";
  }
  alert(`${payload.length} linha(s) de escala importada(s).`);
  render();
}

async function sendTipMessage() {
  if (!state.session || !isAdmin()) {
    return;
  }
  const message = (els.tipsMessageInput?.value || "").trim();
  const recipient = els.tipsRecipientSelect?.value || "all";
  if (!message) {
    alert("Digite a mensagem.");
    return;
  }
  if (supabaseClient) {
    const { error } = await supabaseClient.from("tips").insert({
      message,
      recipient_id: recipient === "all" ? null : recipient,
      created_by: state.session.id
    });
    if (error) {
      alert(`Falha ao enviar mensagem: ${error.message || "erro inesperado"}`);
      return;
    }
    await fetchDashboardData();
  } else {
    state.tips.push({
      id: uid(),
      message,
      recipientId: recipient === "all" ? "" : recipient,
      createdAt: new Date().toISOString()
    });
  }
  if (els.tipsMessageInput) {
    els.tipsMessageInput.value = "";
  }
  updateTipsUnreadBadge();
  alert("Mensagem enviada.");
  render();
}

function clearTipMessageBox() {
  if (els.tipsMessageInput) {
    els.tipsMessageInput.value = "";
    els.tipsMessageInput.focus();
  }
}

function normalizeScheduleRow(row) {
  const normalized = {};
  const entries = Object.entries(row || {});
  entries.forEach(([key, value]) => {
    normalized[String(key || "").trim().toLowerCase()] = value;
  });
  const rawDate =
    normalized.data ||
    normalized.date ||
    normalized.dia ||
    normalized["data da escala"] ||
    normalized["dia da escala"] ||
    "";
  const rawTheme = normalized.tema || normalized.licao || normalized["tema da licao"] || normalized.theme || "";
  const rawDetails = normalized.observacao || normalized.observacoes || normalized.info || normalized.informacao || "";
  const rawUser =
    normalized.usuario ||
    normalized.user ||
    normalized.email ||
    normalized["e-mail"] ||
    normalized.nome ||
    normalized.responsavel ||
    "";

  const date = normalizeScheduleDate(rawDate);
  const lessonTheme = String(rawTheme || "").trim();
  const details = String(rawDetails || "").trim();
  const userToken = String(rawUser || "").trim();
  const matchedProfile = findProfileByUserToken(userToken);
  return {
    date,
    lessonTheme,
    details,
    profileId: matchedProfile?.id || "",
    targetUser: userToken || matchedProfile?.email || matchedProfile?.name || ""
  };
}

function normalizeScheduleDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const converted = new Date(excelEpoch.getTime() + value * 86400000);
    if (!Number.isNaN(converted.getTime())) {
      const day = String(converted.getUTCDate()).padStart(2, "0");
      const month = String(converted.getUTCMonth() + 1).padStart(2, "0");
      const year = converted.getUTCFullYear();
      return `${year}-${month}-${day}`;
    }
  }
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${year}-${month}-${day}`;
}

async function parseScheduleFile(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvRows(text);
  }
  if ((name.endsWith(".xlsx") || name.endsWith(".xls")) && window.XLSX) {
    const bytes = await file.arrayBuffer();
    const workbook = window.XLSX.read(bytes, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      return [];
    }
    return window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
  }
  alert("Formato nao suportado. Use CSV ou Excel (.xlsx).");
  return [];
}

function normalizeMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findProfileByUserToken(rawToken) {
  const token = normalizeMatchText(rawToken);
  if (!token) {
    return null;
  }
  const tokenParts = token.split(" ").filter((part) => part.length >= 2);
  return (
    state.profiles.find((profile) => {
      const email = normalizeMatchText(profile.email || "");
      if (email && (email === token || email.includes(token) || token.includes(email))) {
        return true;
      }
      const name = normalizeMatchText(profile.name || "");
      if (!name) {
        return false;
      }
      if (name === token || name.includes(token) || token.includes(name)) {
        return true;
      }
      if (!tokenParts.length) {
        return false;
      }
      const overlap = tokenParts.filter((part) => name.includes(part)).length;
      return overlap >= Math.min(2, tokenParts.length);
    }) || null
  );
}

function scheduleBelongsToCurrentUser(schedule) {
  if (!state.session || !schedule) {
    return false;
  }
  if (schedule.profileId) {
    return schedule.profileId === state.session.id;
  }
  const sessionEmail = normalizeMatchText(state.session.email || "");
  const sessionName = normalizeMatchText(state.session.name || "");
  const sessionParts = sessionName.split(" ").filter((part) => part.length >= 2);
  const candidates = [schedule.targetUser, schedule.details]
    .map((value) => normalizeMatchText(value))
    .filter(Boolean);
  if (!candidates.length) {
    return true;
  }
  return candidates.some((candidate) => {
    if (sessionEmail && (candidate === sessionEmail || candidate.includes(sessionEmail) || sessionEmail.includes(candidate))) {
      return true;
    }
    if (sessionName && (candidate === sessionName || candidate.includes(sessionName) || sessionName.includes(candidate))) {
      return true;
    }
    if (!sessionParts.length) {
      return false;
    }
    const overlap = sessionParts.filter((part) => candidate.includes(part)).length;
    return overlap >= Math.min(2, sessionParts.length);
  });
}

function parseCsvRows(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return [];
  }
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter);
    return headers.reduce((acc, header, index) => {
      acc[header] = (cols[index] || "").trim();
      return acc;
    }, {});
  });
}

function handleSelectAllStudents(event) {
  const checked = event.target.checked;
  const boxes = els.studentList.querySelectorAll('input[type="checkbox"][data-select-student]');
  boxes.forEach((box) => {
    box.checked = checked;
  });
}

function getSelectedStudentIds() {
  const boxes = els.studentList.querySelectorAll('input[type="checkbox"][data-select-student]:checked');
  return Array.from(boxes).map((box) => box.dataset.selectStudent);
}

async function handleBulkCheckin() {
  const ids = getSelectedStudentIds();
  if (!ids.length) {
    alert("Selecione ao menos um aluno.");
    return;
  }
  let success = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await handleManualCheckin(id, { silent: true });
    if (result.ok) {
      success += 1;
    } else {
      failed += 1;
    }
  }
  alert(`Check-in em massa concluido. Sucesso: ${success}. Falhas: ${failed}.`);
  render();
}

async function handleBulkCheckout() {
  const ids = getSelectedStudentIds();
  if (supabaseClient) {
    await fetchCheckins();
    alert("Lista atualizada com sucesso.");
    render();
    return;
  }
  if (!ids.length) {
    alert("Selecione ao menos um aluno.");
    return;
  }
  let success = 0;
  const checkedOutIso = new Date().toISOString();
  for (const id of ids) {
    const checkin = getOpenCheckinForStudent(id);
    if (checkin) {
      checkin.checkedOutAt = timeNow();
      checkin.checkedOutBy = state.session?.name || "";
      success += 1;
    }
  }
  alert(`Checkout em massa concluido. Sucesso: ${success}.`);
  render();
}

function getOpenCheckinForStudent(studentId) {
  return (
    state.checkins
      .slice()
      .reverse()
      .find((checkin) => checkin.studentId === studentId && !checkin.checkedOutAt) || null
  );
}

function openCheckoutDialog(checkin) {
  if (!checkin) {
    alert("Nao ha check-in aberto para este aluno.");
    return;
  }
  const student = state.students.find((s) => s.id === checkin.studentId);
  const name = student ? student.name : "Visitante";
  const summary = `${name} | ${checkin.roomName} | Check-in: ${checkin.dateTime}`;
  if (els.checkoutSummary) {
    els.checkoutSummary.textContent = summary;
  }
  if (els.checkoutCheckinId) {
    els.checkoutCheckinId.value = checkin.id;
  }
  els.checkoutDialog?.showModal();
}

async function confirmCheckout(event) {
  event.preventDefault();
  const checkinId = els.checkoutCheckinId?.value;
  if (!checkinId) {
    alert("Checkout invalido.");
    return;
  }
  const checkin = state.checkins.find((item) => item.id === checkinId);
  if (!checkin || checkin.checkedOutAt) {
    alert("Checkout nao disponivel.");
    return;
  }
  const checkedOutIso = new Date().toISOString();
  if (supabaseClient) {
    await supabaseClient
      .from("checkins")
      .update({ checked_out_at: checkedOutIso })
      .eq("id", checkinId);
    checkin.checkedOutAt = formatTimeFromIso(checkedOutIso);
  } else {
    checkin.checkedOutAt = timeNow();
  }
  checkin.checkedOutBy = state.session?.name || "";
  els.checkoutDialog?.close();
  render();
}

async function handleLogin(event) {
  if (event) {
    event.preventDefault();
  }
  if (!supabaseClient) {
    alert("Supabase nao configurado.");
    return;
  }
  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;
  if (!email || !password) {
    alert("Informe email e senha.");
    return;
  }
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      const loginMessage = (error.message || "").toLowerCase();
      if (loginMessage.includes("email not confirmed")) {
        alert("Email ainda nao confirmado. Verifique caixa de entrada e spam, ou solicite reenvio.");
      } else {
        alert(`Falha no login: ${error.message || "verifique email e senha."}`);
      }
      return;
    }
    await hydrateFromSupabase();
    if (!state.session) {
      await supabaseClient.auth.signOut();
      alert("Perfil nao encontrado. Verifique confirmacao de email e permissoes RLS da tabela profiles.");
      return;
    }
  } catch (err) {
    console.warn("Erro no login", err);
    alert("Falha ao conectar. Use o app via http://localhost e confira o Supabase.");
  }
}

async function handleLogout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  state.session = null;
  state.students = [];
  state.rooms = [];
  state.checkins = [];
  state.profiles = [];
  state.schedules = [];
  state.tips = [];
  state.tipReads = [];
  state.dashboardInfo = "";
  state.activeRoomId = "";
  state.selectedRoomId = "";
  state.ui = {
    activePanel: "dashboard",
    showLogPanel: false,
    showInvitePanel: false,
    expandedTips: [],
    selectedManageUserId: "",
    logSelectedStudentIds: []
  };
  render();
}

function handleInviteQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("invite");
  if (!token) {
    return;
  }
  openSignupDialog("dnms_kids", token);
}

function openSignupDialog(role, inviteToken = "") {
  signupContext.role = role;
  signupContext.inviteToken = inviteToken || "";
  const isInvite = role === "dnms_kids";
  if (els.signupDialogTitle) {
    els.signupDialogTitle.textContent = isInvite ? "Cadastro DNMS Kids" : "Cadastro de Responsavel";
  }
  if (els.signupInviteToken) {
    els.signupInviteToken.value = signupContext.inviteToken;
  }
  if (els.signupBirthField) {
    els.signupBirthField.style.display = isInvite ? "none" : "flex";
  }
  if (els.signupCivilField) {
    els.signupCivilField.style.display = isInvite ? "none" : "flex";
  }
  if (els.signupPhoneField) {
    els.signupPhoneField.style.display = isInvite ? "none" : "flex";
  }
  if (els.signupVisitorField) {
    els.signupVisitorField.style.display = isInvite ? "none" : "flex";
  }
  if (els.signupBirth) {
    els.signupBirth.required = !isInvite;
  }
  if (els.signupCivilStatus) {
    els.signupCivilStatus.required = !isInvite;
  }
  if (els.signupPhone) {
    els.signupPhone.required = !isInvite;
  }
  if (els.signupPhoneDdd) {
    els.signupPhoneDdd.required = !isInvite;
  }
  if (els.signupName) {
    els.signupName.value = "";
  }
  if (els.signupPhoto) {
    els.signupPhoto.value = "";
  }
  setPhotoPreviewUrl(els.signupPhotoPreview, "");
  if (els.signupBirth) {
    els.signupBirth.value = "";
  }
  if (els.signupCivilStatus) {
    els.signupCivilStatus.value = "";
  }
  if (els.signupPhoneDdd) {
    els.signupPhoneDdd.value = "21";
  }
  if (els.signupPhone) {
    els.signupPhone.value = "";
  }
  if (els.signupEmail) {
    els.signupEmail.value = "";
  }
  if (els.signupPassword) {
    els.signupPassword.value = "";
  }
  if (els.signupIsVisitor) {
    els.signupIsVisitor.checked = false;
  }
  els.signupDialog?.showModal();
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) {
    alert("Cadastro disponivel apenas com Supabase.");
    return;
  }
  const name = els.signupName.value.trim();
  const birthDateRaw = els.signupBirth.value;
  const birthDate = normalizeBirthDateInput(birthDateRaw);
  const civilStatus = els.signupCivilStatus.value.trim();
  const phoneDdd = (els.signupPhoneDdd?.value || "").replace(/\D/g, "").slice(0, 2);
  const phoneNumber = (els.signupPhone.value || "").replace(/\D/g, "");
  const phone = phoneDdd && phoneNumber ? `+55(${phoneDdd})${phoneNumber}` : "";
  const email = els.signupEmail.value.trim().toLowerCase();
  const password = els.signupPassword.value;
  const responsibleVisitor = Boolean(els.signupIsVisitor?.checked);
  const isInviteFlow = signupContext.role === "dnms_kids";
  const signupPhotoFile = els.signupPhoto?.files?.[0] || null;
  const pendingPhotoData = signupPhotoFile ? await readFileAsDataUrl(signupPhotoFile) : "";

  if (!name || !email || !password) {
    alert("Preencha os campos obrigatorios.");
    return;
  }
  if (!isInviteFlow && birthDateRaw && !birthDate) {
    alert("Data de nascimento invalida. Use dd/mm/aaaa.");
    return;
  }
  if (!isInviteFlow && phoneNumber.length < 8) {
    alert("Informe um celular valido do responsavel.");
    return;
  }
  if (!isInviteFlow && (!birthDate || !civilStatus || !phone || phoneDdd.length !== 2)) {
    alert("Preencha todos os campos obrigatorios.");
    return;
  }
  if (!isValidEmail(email)) {
    alert("Informe um email valido.");
    return;
  }
  const { data: existingUsers, error: existingUsersError } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1);
  if (!existingUsersError && existingUsers?.length) {
    alert("Este email ja esta cadastrado.");
    return;
  }

  if (isInviteFlow) {
    const inviteValid = await verifyInviteToken(signupContext.inviteToken, email);
    if (!inviteValid.ok) {
      alert(inviteValid.message);
      return;
    }
  }

  let data;
  let error;
  try {
    const signupResult = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          desired_role: signupContext.role,
          birth_date: isInviteFlow ? null : birthDate,
          marital_status: isInviteFlow ? null : civilStatus,
          phone: isInviteFlow ? null : phone,
          invite_token: isInviteFlow ? signupContext.inviteToken : null,
          is_visitor: isInviteFlow ? false : responsibleVisitor
        }
      }
    });
    data = signupResult.data;
    error = signupResult.error;
  } catch (err) {
    console.warn("Falha no cadastro (exception)", err);
    alert("Falha de conexao ao cadastrar. Use http://localhost e verifique as configuracoes do Supabase.");
    return;
  }
  if (error) {
    console.warn("Falha no cadastro (supabase)", error);
    alert(`Nao foi possivel concluir o cadastro: ${error.message || "erro desconhecido"}`);
    return;
  }
  const signupUser = data?.user || null;
  const signupIdentities = signupUser?.identities;
  const isExistingAuthUser = Array.isArray(signupIdentities) && signupIdentities.length === 0;
  if (isExistingAuthUser) {
    alert("Este email ja esta cadastrado.");
    return;
  }
  if (!signupUser) {
    alert("Nao foi possivel concluir o cadastro: resposta invalida do Supabase.");
    return;
  }
  const requiresEmailConfirmation = !data?.session;
  if (signupPhotoFile) {
    if (data?.session?.user) {
      await uploadProfilePhotoForUser(data.session.user, signupPhotoFile);
    } else if (pendingPhotoData) {
      storePendingProfilePhoto(email, pendingPhotoData);
    }
  }
  els.signupDialog?.close();
  if (requiresEmailConfirmation) {
    alert("Cadastro criado. Enviamos o email de confirmacao. Verifique caixa de entrada e spam.");
    return;
  }
  alert("Cadastro criado com sucesso. Voce ja pode fazer login.");
}

async function verifyInviteToken(token, email) {
  if (!token) {
    return { ok: false, message: "Convite invalido." };
  }
  const { data, error } = await supabaseClient
    .from("invites")
    .select("id,email,role,status,expires_at")
    .eq("token", token)
    .single();
  if (error || !data) {
    return { ok: false, message: "Convite nao encontrado." };
  }
  if (data.status && data.status !== "pending") {
    return { ok: false, message: "Convite ja utilizado." };
  }
  if (data.role !== "dnms_kids") {
    return { ok: false, message: "Convite invalido para este cadastro." };
  }
  if (data.email && data.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, message: "Este convite pertence a outro email." };
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, message: "Convite expirado." };
  }
  return { ok: true };
}

async function acceptInviteToken(token, email) {
  if (!token) {
    return { ok: false, message: "Convite invalido." };
  }
  const { data, error } = await supabaseClient
    .from("invites")
    .select("id,email,role,status,expires_at")
    .eq("token", token)
    .single();
  if (error || !data) {
    return { ok: false, message: "Convite nao encontrado." };
  }
  if (data.status && data.status !== "pending") {
    return { ok: false, message: "Convite ja utilizado." };
  }
  if (data.role !== "dnms_kids") {
    return { ok: false, message: "Convite invalido para este cadastro." };
  }
  if (data.email && data.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, message: "Este convite pertence a outro email." };
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, message: "Convite expirado." };
  }
  await supabaseClient
    .from("invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", data.id);
  return { ok: true };
}

function canManageProfileTarget(targetProfile) {
  if (!state.session || !targetProfile) {
    return false;
  }
  if (targetProfile.id === state.session.id) {
    return false;
  }
  const targetRole = normalizeRole(targetProfile.role);
  if (isSadmin()) {
    return true;
  }
  if (isAdmin()) {
    return targetRole === "equipe" || targetRole === "responsavel" || targetRole === "dnms_kids";
  }
  if (isEquipe()) {
    return targetRole === "responsavel" || targetRole === "dnms_kids";
  }
  return false;
}

function canDeleteProfileTarget(targetProfile) {
  if (!state.session || !targetProfile) {
    return false;
  }
  if (targetProfile.id === state.session.id) {
    return false;
  }
  if (isSadmin()) {
    return true;
  }
  if (isAdmin()) {
    const targetRole = normalizeRole(targetProfile.role);
    return targetRole === "equipe" || targetRole === "responsavel" || targetRole === "dnms_kids";
  }
  return false;
}

function getAllowedRoleTargets() {
  if (isSadmin()) {
    return ["responsavel", "equipe", "admin"];
  }
  if (isAdmin()) {
    return ["responsavel", "equipe"];
  }
  return ["responsavel"];
}

function renderManagementPanel() {
  if (!els.manageUsersList || !els.manageUsersStatus || !els.manageUserEditor) {
    return;
  }
  if (!state.session || !canAccessManagementPanel()) {
    els.manageUsersStatus.textContent = "";
    els.manageUsersList.innerHTML = "";
    els.manageUserEditor.innerHTML = "";
    return;
  }

  const roleLabel = isSadmin() ? "SADMIN" : formatRole(state.session.role);
  els.manageUsersStatus.textContent = `Nivel atual: ${roleLabel}. Busque e selecione um usuario para editar.`;
  const sortedProfiles = state.profiles
    .filter((profile) => profile.id !== state.session.id)
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (!sortedProfiles.length) {
    els.manageUsersList.innerHTML = `<div class="summary">Nenhum usuario encontrado.</div>`;
    els.manageUserEditor.innerHTML = "";
    return;
  }

  const searchTerm = String(els.manageUserSearch?.value || "").trim().toLowerCase();
  if (!searchTerm) {
    els.manageUsersList.innerHTML = "";
    els.manageUserEditor.innerHTML = "";
    state.ui.selectedManageUserId = "";
    return;
  }
  const filteredProfiles = searchTerm
    ? sortedProfiles.filter((profile) => (profile.name || "").toLowerCase().includes(searchTerm))
    : sortedProfiles;
  if (!filteredProfiles.length) {
    els.manageUsersList.innerHTML = `<div class="summary">Nenhum usuario encontrado para "${searchTerm}".</div>`;
    els.manageUserEditor.innerHTML = `<strong>Nenhum usuario selecionado.</strong>`;
    return;
  }

  const selectedId = state.ui.selectedManageUserId || "";
  const selectedProfile = filteredProfiles.find((profile) => profile.id === selectedId) || null;

  els.manageUsersList.innerHTML = "";
  filteredProfiles.forEach((profile) => {
    const item = document.createElement("div");
    item.className = `list-item ${selectedId === profile.id ? "is-selected" : ""}`;
    item.innerHTML = `
      <strong>${profile.name || "Usuario"}</strong>
      <span class="muted">${profile.email || "-"}</span>
      <span class="muted">Acesso atual: ${formatRole(profile.role)}</span>
    `;
    item.style.cursor = "pointer";
    item.addEventListener("click", () => {
      state.ui.selectedManageUserId = profile.id;
      renderManagementPanel();
    });
    els.manageUsersList.appendChild(item);
  });

  if (!selectedProfile) {
    els.manageUserEditor.innerHTML = `<strong>Selecione um usuario para editar.</strong>`;
    return;
  }

  const canManage = canManageProfileTarget(selectedProfile);
  const canDelete = canDeleteProfileTarget(selectedProfile);
  const canChangeRole = canManage && (isSadmin() || isAdmin());
  const roleOptions = getAllowedRoleTargets()
    .map(
      (role) =>
        `<option value="${role}" ${normalizeRole(selectedProfile.role) === role ? "selected" : ""}>${formatRole(role)}</option>`
    )
    .join("");
  els.manageUserEditor.innerHTML = `
    <strong>Usuario selecionado: ${selectedProfile.name || "Usuario"}</strong><br />
    <span class="muted">${selectedProfile.email || "-"}</span>
    <div class="actions" style="margin-top:10px">
      <select id="manageSelectedRole" ${canChangeRole ? "" : "disabled"}>
        ${roleOptions}
      </select>
      <button id="btnManageSaveRole" class="primary" type="button" ${canChangeRole ? "" : "disabled"}>Salvar acesso</button>
      <button id="btnManageDeleteUser" class="danger" type="button" ${canDelete ? "" : "disabled"}>Excluir usuario</button>
    </div>
  `;
  const btnSaveRole = document.getElementById("btnManageSaveRole");
  const btnDeleteUser = document.getElementById("btnManageDeleteUser");
  const roleSelect = document.getElementById("manageSelectedRole");
  btnSaveRole?.addEventListener("click", async () => {
    const nextRole = normalizeRole(roleSelect?.value || "");
    await updateUserAccess(selectedProfile, nextRole);
  });
  btnDeleteUser?.addEventListener("click", async () => {
    await deleteUserProfile(selectedProfile);
  });
}

async function updateUserAccess(profile, nextRole) {
  if (!profile || !nextRole) {
    return;
  }
  if (!canManageProfileTarget(profile) || !(isSadmin() || isAdmin())) {
    alert("Sem permissao para alterar este usuario.");
    return;
  }
  const allowedRoles = new Set(getAllowedRoleTargets());
  if (!allowedRoles.has(nextRole)) {
    alert("Nivel de acesso nao permitido para seu perfil.");
    return;
  }
  if (normalizeRole(profile.role) === nextRole) {
    return;
  }
  const { error } = await supabaseClient.from("profiles").update({ role: nextRole }).eq("id", profile.id);
  if (error) {
    alert(`Falha ao atualizar acesso: ${error.message || "erro inesperado"}`);
    return;
  }
  await fetchProfiles();
  render();
}

async function deleteUserProfile(profile) {
  if (!profile) {
    return;
  }
  if (!canDeleteProfileTarget(profile)) {
    alert("Sem permissao para excluir este usuario.");
    return;
  }
  if (!confirm(`Confirma excluir o usuario ${profile.name || profile.email || profile.id}?`)) {
    return;
  }
  if (!confirm("Confirmacao final: deseja realmente excluir este usuario?")) {
    return;
  }
  const { error } = await supabaseClient.from("profiles").delete().eq("id", profile.id);
  if (error) {
    alert(`Falha ao excluir usuario: ${error.message || "erro inesperado"}`);
    return;
  }
  if (state.ui.selectedManageUserId === profile.id) {
    state.ui.selectedManageUserId = "";
  }
  await fetchProfiles();
  render();
}

async function handleSendInvite(event) {
  event.preventDefault();
  if (!supabaseClient) {
    alert("Convites disponiveis apenas com Supabase.");
    return;
  }
  if (!isAdmin()) {
    alert("Somente administradores podem enviar convites.");
    return;
  }
  const email = els.inviteEmail?.value.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    alert("Informe um email valido.");
    return;
  }

  const token = uid();
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseClient.from("invites").insert({
    email,
    role: "dnms_kids",
    token,
    status: "pending",
    expires_at: expiresAt,
    created_by: state.session?.id || null
  });
  if (error) {
    alert("Falha ao salvar convite no banco.");
    return;
  }

  let sentByEmail = false;
  try {
    const result = await supabaseClient.functions.invoke("send-dnms-kids-invite", {
      body: { email, inviteUrl }
    });
    sentByEmail = !result.error;
  } catch (err) {
    sentByEmail = false;
  }

  if (els.inviteStatus) {
    const message = sentByEmail
      ? `Convite enviado por email para ${email}.`
      : `Convite salvo. Compartilhe este link: ${inviteUrl}`;
    els.inviteStatus.textContent = message;
  }
  if (els.inviteEmail) {
    els.inviteEmail.value = "";
  }
}

async function createRooms() {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem criar eventos.");
    return;
  }
  const name = els.roomName.value.trim();
  const dateValue = els.roomDate.value;
  const startTimeValue = els.roomStartTime.value;
  const endTimeValue = els.roomEndTime.value;
  const classTarget = els.roomClass.value;
  const recurrence = els.roomRecurrence.value;
  const isEditing = Boolean(roomFormContext.editingId);

  if (!name || !dateValue || !startTimeValue || !endTimeValue || !classTarget) {
    alert("Informe nome, data, horario de inicio, horario de termino e turma do evento.");
    return;
  }
  if (endTimeValue <= startTimeValue) {
    alert("Horario de termino deve ser maior que o horario de inicio.");
    return;
  }

  const baseDate = parseInputDate(dateValue);
  if (!baseDate) {
    alert("Data invalida.");
    return;
  }

  if (isEditing) {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("rooms")
        .update({
          name,
          date: dateValue,
          time: startTimeValue,
          start_time: startTimeValue,
          end_time: endTimeValue,
          class_target: classTarget
        })
        .eq("id", roomFormContext.editingId);
      if (error) {
        alert(`Falha ao atualizar sala: ${error.message || "erro inesperado"}`);
        return;
      }
      await fetchRooms();
    } else {
      const room = state.rooms.find((item) => item.id === roomFormContext.editingId);
      if (room) {
        room.name = name;
        room.dateIso = dateValue;
        room.date = formatDate(baseDate);
        room.time = startTimeValue;
        room.startTime = startTimeValue;
        room.endTime = endTimeValue;
        room.classTarget = classTarget;
      }
    }
    roomFormContext.editingId = "";
    els.btnCreateRoom.textContent = "Criar evento";
    if (els.btnDeleteRoomFromEdit) {
      els.btnDeleteRoomFromEdit.style.display = "none";
    }
    if (els.roomRecurrence) {
      els.roomRecurrence.disabled = false;
    }
    render();
    alert("Sala atualizada com sucesso.");
    return;
  }

  const total = recurrence === "weekly" ? DEFAULT_RECURRENCE_WEEKS : 1;
  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let lastErrorMessage = "";
  for (let i = 0; i < total; i += 1) {
    const date = addDays(baseDate, recurrence === "weekly" ? i * 7 : 0);
    const dateLabel = formatDate(date);
    const dateIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    const exists = state.rooms.some(
      (room) =>
        room.date === dateLabel &&
        room.name === name &&
        room.startTime === startTimeValue &&
        room.classTarget === classTarget
    );
    if (exists) {
      skippedCount += 1;
      continue;
    }
    if (supabaseClient) {
      const { error } = await supabaseClient.from("rooms").insert({
        name,
        date: dateIso,
        time: startTimeValue,
        start_time: startTimeValue,
        end_time: endTimeValue,
        class_target: classTarget,
        status: "Programada",
        created_by: state.session?.id || null
      });
      if (error) {
        console.warn("Falha ao criar sala", error);
        failedCount += 1;
        lastErrorMessage = error.message || "erro inesperado";
      } else {
        createdCount += 1;
      }
    } else {
      createdCount += 1;
    }
  }
  if (supabaseClient) {
    await fetchRooms();
  }
  els.roomName.value = "";
  els.roomClass.value = "";
  if (els.roomRecurrence) {
    els.roomRecurrence.value = "none";
  }
  render();
  if (failedCount) {
    alert(
      `Falha ao criar ${failedCount} evento(s). ${createdCount ? `Criados: ${createdCount}. ` : ""}${lastErrorMessage}`
    );
    return;
  }
  if (!createdCount && skippedCount) {
    alert("Nenhum evento criado. Ja existe evento com os mesmos dados.");
    return;
  }
  if (createdCount) {
    alert(`${createdCount} evento(s) criado(s) com sucesso.`);
  }
}

function openRoomDialog() {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem abrir salas.");
    return;
  }
  renderRoomOpenList(getRoomsToday().slice().sort(compareRooms));
  if (els.roomOpenDialog) {
    els.roomOpenDialog.showModal();
  }
}

async function openSelectedRooms(event) {
  if (event) {
    event.preventDefault();
  }
  const ids = getSelectedRoomIds();
  if (!ids.length) {
    alert("Selecione ao menos uma sala.");
    return;
  }
  for (const id of ids) {
    await openRoom(id);
  }
  if (els.roomOpenDialog?.open) {
    els.roomOpenDialog.close();
  }
}

async function openAllRooms(event) {
  if (event) {
    event.preventDefault();
  }
  const ids = getAvailableRoomIds();
  if (!ids.length) {
    alert("Nenhuma sala programada para hoje.");
    return;
  }
  for (const id of ids) {
    await openRoom(id);
  }
  if (els.roomOpenDialog?.open) {
    els.roomOpenDialog.close();
  }
}

async function openRoom(roomId) {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem abrir salas.");
    return;
  }
  const today = formatToday();
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room) {
    alert("Sala nao encontrada.");
    return;
  }
  if (room.date !== today) {
    alert("Somente salas da data de hoje podem ser abertas.");
    return;
  }
  if (room.status === "Aberta") {
    alert("Esta sala ja esta aberta.");
    return;
  }
  const openedAtIso = new Date().toISOString();
  if (supabaseClient) {
    await supabaseClient.from("rooms").update({ status: "Aberta", opened_at: openedAtIso, closed_at: null }).eq("id", room.id);
    await fetchRooms();
  } else {
    room.status = "Aberta";
    room.openedAt = timeNow();
    room.closedAt = "";
  }
  setActiveRoom(room.id);
  render();
}

async function closeRoom(roomId, options = {}) {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem fechar salas.");
    return;
  }
  const requireDoubleConfirm = options.requireDoubleConfirm !== false;
  if (!confirm("Tem certeza que deseja fechar esta sala?")) {
    return;
  }
  if (requireDoubleConfirm && !confirm("Confirmar fechamento da sala agora?")) {
    return;
  }
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room) {
    alert("Sala nao encontrada.");
    return;
  }
  const closedAtIso = new Date().toISOString();
  if (supabaseClient) {
    await supabaseClient.from("rooms").update({ status: "Fechada", closed_at: closedAtIso }).eq("id", room.id);
    await supabaseClient
      .from("checkins")
      .update({ checked_out_at: closedAtIso })
      .eq("room_id", room.id)
      .is("checked_out_at", null);
    await fetchRooms();
    await fetchCheckins();
  } else {
    room.status = "Fechada";
    room.closedAt = timeNow();
    state.checkins.forEach((checkin) => {
      if (checkin.roomId === room.id && !checkin.checkedOutAt) {
        checkin.checkedOutAt = formatTimeFromIso(closedAtIso);
      }
    });
  }
  if (state.activeRoomId === room.id) {
    const openRooms = getOpenRoomsToday();
    state.activeRoomId = openRooms.length ? openRooms[0].id : "";
  }
  state.roomView = "closed";
  render();
}

async function reopenRoom(roomId) {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem reabrir salas.");
    return;
  }
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room) {
    alert("Sala nao encontrada.");
    return;
  }
  const openedAtIso = new Date().toISOString();
  if (supabaseClient) {
    await supabaseClient.from("rooms").update({ status: "Aberta", opened_at: openedAtIso, closed_at: null }).eq("id", room.id);
    await fetchRooms();
  } else {
    room.status = "Aberta";
    room.openedAt = timeNow();
    room.closedAt = "";
  }
  setActiveRoom(room.id);
  state.roomView = "open";
  render();
}

async function deleteRoom(roomId) {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem excluir salas.");
    return;
  }
  if (!confirm("Tem certeza que deseja excluir esta sala?")) {
    return;
  }
  if (supabaseClient) {
    await supabaseClient.from("rooms").delete().eq("id", roomId);
    await fetchRooms();
    await fetchCheckins();
  } else {
    state.rooms = state.rooms.filter((room) => room.id !== roomId);
    state.checkins = state.checkins.filter((checkin) => checkin.roomId !== roomId);
  }
  if (state.activeRoomId === roomId) {
    const openRooms = getOpenRoomsToday();
    state.activeRoomId = openRooms.length ? openRooms[0].id : "";
  }
  if (state.selectedRoomId === roomId) {
    state.selectedRoomId = "";
  }
  render();
}

function getCheckinsForRoom(roomId) {
  return state.checkins.filter((checkin) => checkin.roomId === roomId);
}

function getRoomCheckinStudents(roomId) {
  const map = new Map();
  getCheckinsForRoom(roomId).forEach((checkin) => {
    const student = state.students.find((item) => item.id === checkin.studentId) || null;
    const key = student?.id || `unknown:${checkin.studentId || checkin.id}`;
    if (!map.has(key)) {
      map.set(key, {
        id: student?.id || "",
        name: student?.name || "Aluno",
        student
      });
    }
  });
  return Array.from(map.values());
}

function openRoomDetails(roomId) {
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room) {
    alert("Sala nao encontrada.");
    return;
  }
  state.selectedRoomId = room.id;
  renderRoomDetailsDialog(room);
  els.roomDetailsDialog?.showModal();
}

function renderRoomDetailsDialog(room) {
  if (!room) {
    return;
  }
  const canManageRoom = isAdmin() || isEquipe();
  const students = getRoomCheckinStudents(room.id);
  if (els.roomDetailsTitle) {
    els.roomDetailsTitle.textContent = `Turma ${room.classTarget || "-"} (${room.status})`;
  }
  if (els.roomDetailsMeta) {
    els.roomDetailsMeta.innerHTML = `
      <strong>Evento:</strong> ${room.name}<br />
      <strong>Data:</strong> ${room.date}<br />
      <strong>Horario:</strong> ${room.startTime || "-"}${room.endTime ? ` - ${room.endTime}` : ""}<br />
      <strong>Turma:</strong> ${room.classTarget || "-"}<br />
      <strong>Abertura:</strong> ${room.openedAt || "-"} | <strong>Fechamento:</strong> ${room.closedAt || "-"}
    `;
  }
  if (els.roomDetailsStudents) {
    els.roomDetailsStudents.innerHTML = "";
    if (!students.length) {
      const empty = document.createElement("div");
      empty.className = "summary";
      empty.textContent = "Nenhuma crianca fez check-in nessa sala.";
      els.roomDetailsStudents.appendChild(empty);
    } else {
      students.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "list-item";
        item.innerHTML = `<strong>${entry.name}</strong>`;
        if (entry.student) {
          item.style.cursor = "pointer";
          item.addEventListener("click", () => openStudentDetailsDialog(entry.student));
        }
        els.roomDetailsStudents.appendChild(item);
      });
    }
  }
  if (els.btnRoomDialogOpen) {
    els.btnRoomDialogOpen.style.display = canManageRoom ? "inline-flex" : "none";
    els.btnRoomDialogOpen.disabled = room.status === "Aberta";
  }
  if (els.btnRoomDialogEdit) {
    els.btnRoomDialogEdit.style.display = canManageRoom ? "inline-flex" : "none";
    els.btnRoomDialogEdit.disabled = false;
  }
  if (els.btnRoomDialogClose) {
    els.btnRoomDialogClose.style.display = canManageRoom ? "inline-flex" : "none";
    els.btnRoomDialogClose.disabled = room.status !== "Aberta";
  }
}

async function handleRoomDialogOpen() {
  if (!state.selectedRoomId) {
    return;
  }
  await openRoom(state.selectedRoomId);
  const room = state.rooms.find((item) => item.id === state.selectedRoomId);
  if (room) {
    renderRoomDetailsDialog(room);
  }
}

function handleRoomDialogEdit() {
  const room = state.rooms.find((item) => item.id === state.selectedRoomId);
  if (!room) {
    return;
  }
  els.roomDetailsDialog?.close();
  startRoomEdit(room);
}

async function handleRoomDialogClose() {
  if (!state.selectedRoomId) {
    return;
  }
  await closeRoom(state.selectedRoomId, { requireDoubleConfirm: true });
  const room = state.rooms.find((item) => item.id === state.selectedRoomId);
  if (room) {
    renderRoomDetailsDialog(room);
  }
}

function startRoomEdit(room) {
  if (!room) {
    return;
  }
  roomFormContext.editingId = room.id;
  els.roomName.value = room.name || "";
  els.roomDate.value = room.dateIso || "";
  els.roomStartTime.value = room.startTime || room.time || "";
  els.roomEndTime.value = room.endTime || "";
  els.roomClass.value = room.classTarget || "";
  if (els.roomRecurrence) {
    els.roomRecurrence.value = "none";
    els.roomRecurrence.disabled = true;
  }
  els.btnCreateRoom.textContent = "Salvar edicao";
  if (els.btnDeleteRoomFromEdit) {
    els.btnDeleteRoomFromEdit.style.display = "inline-flex";
  }
  els.roomName.focus();
}

async function handleDeleteRoomFromEdit() {
  const roomId = roomFormContext.editingId;
  if (!roomId) {
    return;
  }
  await deleteRoom(roomId);
  roomFormContext.editingId = "";
  els.btnCreateRoom.textContent = "Criar evento";
  if (els.btnDeleteRoomFromEdit) {
    els.btnDeleteRoomFromEdit.style.display = "none";
  }
  if (els.roomRecurrence) {
    els.roomRecurrence.disabled = false;
  }
}

function openStudentDialog(student) {
  if (student && !canEditStudent(student)) {
    alert("Voce nao pode editar este aluno.");
    return;
  }
  const isResponsavel = state.session?.role === "responsavel" && !isAdmin() && !isEquipe();
  els.studentDialogTitle.textContent = student ? (isResponsavel ? "Editar crianca" : "Editar aluno") : (isResponsavel ? "Cadastrar crianca" : "Novo aluno");
  const id = student?.id || (supabaseClient ? "" : uid());
  els.studentId.value = id;
  els.studentName.value = student?.name || "";
  els.studentBirth.value = formatBirthDateForInput(student?.birth || "");
  els.studentGuardian.value = student?.guardian || state.session?.name || "";
  els.studentOther.value = student?.otherGuardians || "";
  els.studentPhone.value = student?.phone || "";
  els.studentAddress.value = student?.address || "";
  els.studentNotes.value = student?.notes || "";
  els.studentIsVisitor.checked = Boolean(student?.isVisitor);
  if (els.studentPhoto) {
    els.studentPhoto.value = "";
  }
  if (els.studentPhotoCamera) {
    els.studentPhotoCamera.value = "";
  }
  setPhotoPreviewUrl(els.studentPhotoPreview, student?.photoUrl || getStudentPhotoPlaceholderUrl());
  if (els.studentGuardianField) {
    els.studentGuardianField.style.display = isResponsavel ? "none" : "flex";
  }
  if (els.studentOtherField) {
    els.studentOtherField.style.display = isResponsavel ? "none" : "flex";
  }
  if (els.studentPhoneField) {
    els.studentPhoneField.style.display = isResponsavel ? "none" : "flex";
  }
  if (els.studentAddressField) {
    els.studentAddressField.style.display = isResponsavel ? "none" : "flex";
  }
  if (els.studentVisitorField) {
    els.studentVisitorField.style.display = isResponsavel ? "none" : "flex";
  }
  if (els.btnDeleteStudent) {
    els.btnDeleteStudent.style.display = student && canDeleteStudent(student) ? "inline-flex" : "none";
  }
  els.studentGuardian.required = !isResponsavel;
  els.studentPhone.required = !isResponsavel;
  els.studentAddress.required = !isResponsavel;
  els.studentDialog.showModal();
}

async function saveStudent(event) {
  event.preventDefault();
  const isResponsavel = state.session?.role === "responsavel" && !isAdmin() && !isEquipe();
  const guardianName = isResponsavel ? state.session?.name || "" : els.studentGuardian.value.trim();
  const ownerName = isAdmin() || isEquipe() ? guardianName : state.session?.name || guardianName;
  const isVisitor = isResponsavel ? false : Boolean(els.studentIsVisitor.checked);
  const existing = state.students.find((student) => student.id === els.studentId.value);
  const birthRaw = els.studentBirth.value;
  const birthIso = normalizeBirthDateInput(birthRaw);
  if (birthRaw && !birthIso) {
    alert("Data de nascimento invalida. Use dd/mm/aaaa.");
    return;
  }
  const payload = {
    id: existing ? els.studentId.value : supabaseClient ? undefined : uid(),
    name: els.studentName.value.trim(),
    birth: birthIso,
    className: getClassForBirth(birthIso),
    guardian: guardianName,
    otherGuardians: isResponsavel ? "" : els.studentOther.value.trim(),
    phone: isResponsavel ? "-" : els.studentPhone.value.trim(),
    address: isResponsavel ? "-" : els.studentAddress.value.trim(),
    notes: els.studentNotes.value.trim(),
    owner: ownerName,
    isVisitor
  };
  const photoFile = els.studentPhotoCamera?.files?.[0] || els.studentPhoto?.files?.[0] || null;

  const missingCommon = !payload.name || !payload.birth || !payload.className;
  const missingAdminFields = !isResponsavel && (!payload.guardian || !payload.phone || !payload.address);
  if (missingCommon || missingAdminFields) {
    alert("Preencha todos os campos obrigatorios.");
    return;
  }

  if (supabaseClient) {
    const dbPayload = {
      name: payload.name,
      birth_date: payload.birth,
      class_name: payload.className,
      primary_guardian_name: payload.guardian,
      phone: payload.phone,
      address: payload.address,
      notes: payload.notes,
      is_visitor: payload.isVisitor
    };
    let data = null;
    let error = null;
    if (existing?.id) {
      const result = await supabaseClient.from("students").update(dbPayload).eq("id", existing.id).select().single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabaseClient.from("students").insert(dbPayload).select().single();
      data = result.data;
      error = result.error;
    }
    if (error) {
      alert(`Falha ao salvar aluno: ${error.message || "erro inesperado"}`);
      return;
    }
    if (photoFile) {
      const upload = await uploadStudentPhoto(data.id, photoFile);
      if (upload.ok) {
        await supabaseClient.from("students").update({ photo_url: upload.url }).eq("id", data.id);
      }
    }
    const linked = await linkGuardianToStudent(data.id, payload.guardian);
    if (!linked && isResponsavel) {
      console.warn("Aluno salvo sem vinculo em student_guardians; usando fallback por nome do responsavel.");
    }
    await fetchStudents();
  } else {
    const index = state.students.findIndex((student) => student.id === payload.id);
    if (index >= 0) {
      if (!canEditStudent(state.students[index])) {
        alert("Voce nao pode editar este aluno.");
        return;
      }
      const photoUrl = photoFile ? await readFileAsDataUrl(photoFile) : state.students[index].photoUrl || "";
      state.students[index] = { ...state.students[index], ...payload, photoUrl };
    } else {
      const photoUrl = photoFile ? await readFileAsDataUrl(photoFile) : "";
      state.students.push({ ...payload, photoUrl });
    }
  }

  els.studentDialog.close();
  render();
}

async function deleteStudentFromDialog(event) {
  if (event) {
    event.preventDefault();
  }
  const studentId = els.studentId?.value;
  if (!studentId) {
    return;
  }
  const student = state.students.find((item) => item.id === studentId);
  if (!student) {
    alert("Crianca nao encontrada.");
    return;
  }
  if (!canDeleteStudent(student)) {
    alert("Sem permissao para excluir crianca.");
    return;
  }
  if (!confirm(`Confirma excluir a crianca ${student.name}?`)) {
    return;
  }

  if (supabaseClient) {
    const { error } = await supabaseClient.from("students").delete().eq("id", studentId);
    if (error) {
      alert(`Falha ao excluir crianca: ${error.message || "erro inesperado"}`);
      return;
    }
    await fetchStudents();
    await fetchCheckins();
  } else {
    state.students = state.students.filter((item) => item.id !== studentId);
    state.checkins = state.checkins.filter((item) => item.studentId !== studentId);
  }
  els.studentDialog?.close();
  render();
}

async function linkGuardianToStudent(studentId, guardianName) {
  if (!supabaseClient || !studentId) {
    return false;
  }
  let guardianId = state.session?.id || null;
  if (isAdmin() || isEquipe()) {
    guardianId = null;
  }
  if (!guardianId && guardianName) {
    let result = await supabaseClient
      .from("profiles")
      .select("id")
      .ilike("name", guardianName)
      .limit(1);
    if (result.error) {
      result = await supabaseClient
        .from("profiles")
        .select("id")
        .ilike("nome", guardianName)
        .limit(1);
    }
    guardianId = result.data?.[0]?.id || null;
  }
  if (!guardianId) {
    return false;
  }
  const { error } = await supabaseClient.from("student_guardians").upsert({ student_id: studentId, guardian_id: guardianId });
  if (!error) {
    return true;
  }
  const insertResult = await supabaseClient.from("student_guardians").insert({ student_id: studentId, guardian_id: guardianId });
  return !insertResult.error;
}

async function openQrDialog() {
  if (!state.session) {
    alert("Autenticacao obrigatoria.");
    return;
  }
  if (state.session.role === "responsavel") {
    const owned = state.students.slice();
    if (!owned.length) {
      alert("Nenhum filho cadastrado para check-in.");
      return;
    }
    if (owned.length === 1) {
      const result = await handleManualCheckin(owned[0].id, { silent: true });
      if (!result.ok) {
        alert(result.message);
      } else {
        alert(`Check-in confirmado para ${owned[0].name}.`);
      }
      return;
    }
    openParentCheckinDialog(owned);
    return;
  }
  if (els.qrDialogStatus) {
    els.qrDialogStatus.textContent = "";
  }
  if (els.qrDialogInput) {
    els.qrDialogInput.value = "";
    els.qrDialogInput.placeholder = "Cole o codigo do aluno";
  }
  els.qrDialog?.showModal();
}

async function handleQrCheckin(inputEl, statusEl, event) {
  if (event) {
    event.preventDefault();
  }
  const rawInput = inputEl?.value.trim();
  if (!rawInput) {
    if (statusEl) {
      statusEl.textContent = "Informe o codigo do aluno.";
      return;
    }
    alert("Informe o codigo do aluno.");
    return;
  }
  const result = await handleManualCheckin(rawInput, { silent: Boolean(statusEl) });
  if (statusEl) {
    statusEl.textContent = result.message || "Check-in concluido.";
    if (result.ok && els.qrDialog?.open) {
      els.qrDialog.close();
    }
  }
  if (inputEl) {
    inputEl.value = "";
  }
}

function openParentCheckinDialog(ownedStudents) {
  if (!els.parentCheckinList) {
    return;
  }
  els.parentCheckinList.innerHTML = "";
  ownedStudents.forEach((student) => {
    const item = document.createElement("label");
    item.className = "room-open-item";
    item.innerHTML = `
      <input type="checkbox" data-parent-checkin="${student.id}" />
      <span>${student.name} - ${student.className || getClassForBirth(student.birth)}</span>
    `.trim();
    els.parentCheckinList.appendChild(item);
  });
  els.parentCheckinDialog?.showModal();
}

async function handleParentCheckinSelected(event) {
  event.preventDefault();
  const boxes = els.parentCheckinList.querySelectorAll('input[type="checkbox"][data-parent-checkin]:checked');
  const ids = Array.from(boxes).map((box) => box.dataset.parentCheckin);
  if (!ids.length) {
    alert("Selecione ao menos um aluno.");
    return;
  }
  let success = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await handleManualCheckin(id, { silent: true });
    if (result.ok) {
      success += 1;
    } else {
      failed += 1;
    }
  }
  alert(`Check-in concluido. Sucesso: ${success}. Falhas: ${failed}.`);
  els.parentCheckinDialog?.close();
  render();
}

async function handleManualCheckin(studentId, options = {}) {
  const fail = (message) => {
    if (!options.silent) {
      alert(message);
    }
    return { ok: false, message };
  };

  if (!state.session) {
    return fail("Autenticacao obrigatoria.");
  }
  const student = state.students.find((item) => item.id === studentId);
  if (!student) {
    return fail("Aluno nao encontrado.");
  }
  if (!canCheckinStudent(student)) {
    return fail("Sem permissao para check-in deste aluno.");
  }

  const className = student.className || getClassForBirth(student.birth);
  const hasOpenRooms = state.rooms.some((item) => item.status === "Aberta");
  let room = getOpenRoomForClass(className);
  if (!hasOpenRooms) {
    return fail("Não existem salas abertas!");
  }
  if (!room || room.status !== "Aberta") {
    return fail(`Nao ha sala aberta para a turma ${className}. Abra uma sala com essa turma.`);
  }

  const already = state.checkins.find((checkin) => checkin.roomId === room.id && checkin.studentId === studentId);
  if (already) {
    return fail("Este aluno ja fez check-in nesta sala.");
  }
  let record = {
    id: uid(),
    roomId: room.id,
    roomName: room.name,
    studentId,
    className,
    notes: student.notes,
    dateTime: `${room.date} ${timeNow()}`,
    actor: state.session.name,
    checkedOutAt: ""
  };
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("checkins")
      .insert({
        student_id: student.id,
        room_id: room.id,
        room_name_snapshot: room.name,
        class_name: className,
        actor_id: state.session?.id || null,
        notes_snapshot: student.notes || ""
      })
      .select()
      .single();
    if (error) {
      return fail(`Falha ao registrar check-in: ${error.message || "erro inesperado"}`);
    }
    record = {
      id: data.id,
      roomId: data.room_id,
      roomName: room.name,
      studentId: data.student_id,
      className: data.class_name,
      notes: data.notes_snapshot || "",
      dateTime: formatDateTimeFromIso(data.checked_in_at),
      actor: state.session?.name || "",
      checkedOutAt: data.checked_out_at ? formatTimeFromIso(data.checked_out_at) : ""
    };
  }
  state.checkins.push(record);
  showLabel(student, record, { autoPrint: true, openPreview: false });
  render();
  return { ok: true, message: `Check-in confirmado para ${student.name}.` };
}

function printCurrentLabel() {
  document.body.classList.add("print-label");
  window.setTimeout(() => window.print(), 50);
}

function showLabel(person, checkin, options = {}) {
  const className = checkin.className || getClassForBirth(person.birth);
  const guardian = person.guardian || "-";
  const notes = checkin?.notes || person?.notes || "-";
  const autoPrint = options.autoPrint === true;
  const openPreview = options.openPreview === true;
  const label = `
    <div class="label-name">${person.name || "{{nome}}"}</div>
    <div class="label-body">
      <div class="label-line">Turma: ${className || "{{turma}}"}</div>
      <div class="label-line">Responsavel: ${guardian || "{{responsavel}}"}</div>
      <div class="label-line">Observacao: ${notes || "{{observacao}}"}</div>
    </div>
  `;
  els.labelPreview.innerHTML = label;
  if (openPreview) {
    els.labelDialog.showModal();
  }
  if (autoPrint) {
    printCurrentLabel();
  }
}

function exportCsv() {
  if (!state.session || !(isAdmin() || isEquipe())) {
    alert("Sem permissao para exportar.");
    return;
  }
  const rows = buildLogFrequencyRows(getFilteredCheckins());
  if (!rows.length) {
    alert("Nenhuma frequencia encontrada para exportar.");
    return;
  }
  const header = ["Aluno", "Turma", "Presencas", "Horarios de check-in"];
  const csvRows = rows.map((row) => [row.studentName, row.className, row.checkinCount, row.timesLabel]);
  const periodStart = els.logStart?.value || "";
  const periodEnd = els.logEnd?.value || "";
  const periodLabel = periodStart && periodEnd ? `${periodStart}_${periodEnd}` : "periodo";
  const csv = [header, ...csvRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `frequencia_${periodLabel}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  render();
}

function shareLogWhatsapp() {
  if (!state.session || !(isAdmin() || isEquipe())) {
    alert("Sem permissao para compartilhar.");
    return;
  }
  const periodStart = els.logStart?.value || "";
  const periodEnd = els.logEnd?.value || "";
  if (!periodStart || !periodEnd) {
    alert("Selecione o periodo para compartilhar.");
    return;
  }
  const rows = buildLogFrequencyRows(getFilteredCheckins());
  if (!rows.length) {
    alert("Nenhuma frequencia encontrada para compartilhar.");
    return;
  }
  const lines = rows.map((row) => `${row.studentName} | ${row.className} | ${row.timesLabel}`);
  const message = [
    `Frequencia de ${periodStart} ate ${periodEnd}`,
    "Nome | Turma | Horarios de check-in",
    ...lines
  ].join("\n");
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function canEditStudent(student) {
  if (!state.session) {
    return false;
  }
  if (isAdmin() || isEquipe()) {
    return true;
  }
  return student.guardian === state.session.name || student.owner === state.session.name;
}

function canDeleteStudent(student) {
  if (!state.session || !student) {
    return false;
  }
  return isSadmin() || isAdmin();
}

function canCheckinStudent(student) {
  if (!state.session) {
    return false;
  }
  if (isEquipe() || isAdmin()) {
    return true;
  }
  return student.guardian === state.session.name || student.owner === state.session.name;
}

function getRoomsToday() {
  const today = formatToday();
  return state.rooms.filter((room) => room.date === today);
}

function getUpcomingRooms(daysAhead = 30) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, daysAhead);
  return state.rooms
    .filter((room) => room.status !== "Fechada")
    .map((room) => ({ room, dateObj: parseRoomDate(room.date) }))
    .filter((item) => item.dateObj && item.dateObj >= start && item.dateObj <= end)
    .map((item) => item.room)
    .sort(compareRooms);
}

function getCurrentMonthBirthdays() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  return state.students
    .filter((student) => {
      if (!student.birth) {
        return false;
      }
      const [, month] = student.birth.split("-").map((item) => Number.parseInt(item, 10));
      return month === currentMonth;
    })
    .slice()
    .sort((a, b) => {
      const dayA = Number.parseInt((a.birth || "").split("-")[2], 10) || 0;
      const dayB = Number.parseInt((b.birth || "").split("-")[2], 10) || 0;
      return dayA - dayB;
    });
}

function formatBirthdayLabel(birth) {
  if (!birth) {
    return "";
  }
  const [year, month, day] = birth.split("-").map((item) => Number.parseInt(item, 10));
  if (!year || !month || !day) {
    return "";
  }
  const date = new Date(year, month - 1, day);
  return formatDate(date);
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "dnms kids") return "dnms_kids";
  return value;
}

function isEquipe() {
  const role = normalizeRole(state.session?.role);
  return role === "equipe" || role === "dnms_kids";
}

function isAdmin() {
  return normalizeRole(state.session?.role) === "admin";
}

function isSadmin() {
  return String(state.session?.email || "").trim().toLowerCase() === SADMIN_EMAIL;
}

function canAccessManagementPanel() {
  return isSadmin() || isAdmin();
}

function formatRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === "responsavel") return "Responsavel";
  if (normalized === "equipe") return "Equipe";
  if (normalized === "dnms_kids") return "DNMS Kids";
  if (normalized === "admin") return "Administrador";
  return "-";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createAuthStorage() {
  const memory = new Map();
  let blocked = false;
  const safe = {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch (err) {
        blocked = true;
        return memory.get(key) || null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch (err) {
        blocked = true;
        memory.set(key, value);
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        blocked = true;
        memory.delete(key);
      }
    }
  };
  return { storage: safe, blocked };
}

function isMobileDevice() {
  const agent = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod/i.test(agent);
}

function updatePhotoPreview(input, preview) {
  if (!input || !preview) {
    return;
  }
  const file = input.files?.[0];
  if (!file) {
    setPhotoPreviewUrl(preview, "");
    return;
  }
  readFileAsDataUrl(file).then((dataUrl) => setPhotoPreviewUrl(preview, dataUrl));
}

function setPhotoPreviewUrl(preview, url) {
  if (!preview) {
    return;
  }
  if (!url) {
    preview.src = "";
    preview.classList.remove("is-visible");
    return;
  }
  preview.src = url;
  preview.classList.add("is-visible");
}

function openStudentDetailsDialog(student) {
  if (!student) {
    return;
  }
  studentDetailsContext.studentId = student.id;
  if (els.studentDetailsTitle) {
    els.studentDetailsTitle.textContent = student.name || "Crianca";
  }
  if (els.studentDetailsPhoto) {
    els.studentDetailsPhoto.src = student.photoUrl || getStudentPhotoPlaceholderUrl();
    els.studentDetailsPhoto.classList.add("is-visible");
  }
  if (els.studentDetailsInfo) {
    const className = student.className || getClassForBirth(student.birth);
    els.studentDetailsInfo.innerHTML = `
      <strong>Turma:</strong> ${className || "-"}<br />
      <strong>Nascimento:</strong> ${student.birth || "-"}<br />
      <strong>Responsavel:</strong> ${student.guardian || "-"}<br />
      <strong>Telefone:</strong> ${student.phone || "-"}<br />
      <strong>Endereco:</strong> ${student.address || "-"}<br />
      <strong>Observacoes:</strong> ${student.notes || "-"}
    `;
  }
  const openCheckin = getOpenCheckinForStudent(student.id);
  if (els.btnStudentDetailsCheckout) {
    els.btnStudentDetailsCheckout.style.display = openCheckin ? "inline-flex" : "none";
    els.btnStudentDetailsCheckout.disabled = !openCheckin;
  }
  els.studentDetailsDialog?.showModal();
}

function handleStudentDetailsEdit() {
  const student = state.students.find((item) => item.id === studentDetailsContext.studentId);
  if (!student) {
    return;
  }
  els.studentDetailsDialog?.close();
  openStudentDialog(student);
}

function handleStudentDetailsCheckout() {
  const student = state.students.find((item) => item.id === studentDetailsContext.studentId);
  if (!student) {
    return;
  }
  const openCheckin = getOpenCheckinForStudent(student.id);
  if (!openCheckin) {
    return;
  }
  els.studentDetailsDialog?.close();
  openCheckoutDialog(openCheckin);
}

function getStudentPhotoPlaceholderUrl() {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>
        <rect width='100%' height='100%' rx='14' ry='14' fill='#f2efe5' stroke='#d8d2c5'/>
        <text x='50%' y='48%' dominant-baseline='middle' text-anchor='middle' font-size='11' fill='#6c685a' font-family='sans-serif'>Foto</text>
        <text x='50%' y='63%' dominant-baseline='middle' text-anchor='middle' font-size='11' fill='#6c685a' font-family='sans-serif'>nao disponivel</text>
      </svg>`
    )
  );
}

function readFileAsDataUrl(file) {
  if (!file) {
    return Promise.resolve("");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(",");
  if (parts.length < 2) {
    return null;
  }
  const meta = parts[0].match(/data:(.*?);base64/);
  const type = meta?.[1] || "image/jpeg";
  const binary = atob(parts[1]);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}

function getPendingProfilePhotoKey(email) {
  const safeEmail = (email || "").trim().toLowerCase();
  return `${PENDING_PROFILE_PHOTO_PREFIX}${safeEmail}`;
}

function storePendingProfilePhoto(email, dataUrl) {
  if (!email || !dataUrl) {
    return;
  }
  localStorage.setItem(getPendingProfilePhotoKey(email), dataUrl);
}

async function uploadPendingProfilePhoto(user) {
  if (!supabaseClient || !user?.email) {
    return;
  }
  const key = getPendingProfilePhotoKey(user.email);
  const dataUrl = localStorage.getItem(key);
  if (!dataUrl) {
    return;
  }
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) {
    localStorage.removeItem(key);
    return;
  }
  const file = new File([blob], "profile.jpg", { type: blob.type || "image/jpeg" });
  const result = await uploadProfilePhotoForUser(user, file);
  if (result.ok) {
    localStorage.removeItem(key);
  }
}

function getFileExtension(file) {
  const name = file?.name || "";
  const ext = name.includes(".") ? name.split(".").pop() : "";
  const safe = (ext || "").trim().toLowerCase();
  if (safe) {
    return safe;
  }
  const type = file?.type || "";
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  return "jpg";
}

async function uploadFileToStorage(path, file) {
  if (!supabaseClient || !file) {
    return { ok: false, error: "Supabase nao configurado." };
  }
  const bucket = supabaseClient.storage.from(STORAGE_BUCKET);
  const { error } = await bucket.upload(path, file, { upsert: true, contentType: file.type });
  if (error) {
    console.warn("Falha no upload", error);
    return { ok: false, error: error.message };
  }
  const { data } = bucket.getPublicUrl(path);
  return { ok: true, url: data?.publicUrl || "", path };
}

async function uploadStudentPhoto(studentId, file) {
  const ext = getFileExtension(file);
  const path = `students/${studentId}/profile.${ext}`;
  return uploadFileToStorage(path, file);
}

async function uploadProfilePhotoForUser(user, file) {
  if (!supabaseClient || !user?.id) {
    return { ok: false, error: "Usuario invalido." };
  }
  const ext = getFileExtension(file);
  const path = `profiles/${user.id}/profile.${ext}`;
  const upload = await uploadFileToStorage(path, file);
  if (upload.ok) {
    await supabaseClient
      .from("profiles")
      .upsert({ id: user.id, photo_url: upload.url, email: user.email || null });
  }
  return upload;
}

function timeNow() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatTimeFromIso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTimeFromIso(value) {
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

function formatToday() {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function isValidDateParts(year, month, day) {
  if (!year || !month || !day) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeBirthDateInput(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    return isValidDateParts(year, month, day) ? `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` : "";
  }
  const brMatch = raw.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (!brMatch) {
    return "";
  }
  const day = Number.parseInt(brMatch[1], 10);
  const month = Number.parseInt(brMatch[2], 10);
  const year = Number.parseInt(brMatch[3], 10);
  if (!isValidDateParts(year, month, day)) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatBirthDateForInput(value) {
  const iso = normalizeBirthDateInput(value);
  if (!iso) {
    return "";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function parseInputDate(value) {
  if (!value) {
    return null;
  }
  const [year, month, day] = value.split("-").map((item) => Number.parseInt(item, 10));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function parseRoomDate(value) {
  if (!value) {
    return null;
  }
  const [day, month, year] = value.split("/").map((item) => Number.parseInt(item, 10));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function getAgeFromBirth(birth) {
  if (!birth) {
    return null;
  }
  const [year, month, day] = birth.split("-").map((item) => Number.parseInt(item, 10));
  if (!year || !month || !day) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasHadBirthday =
    today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
  if (!hasHadBirthday) {
    age -= 1;
  }
  return age;
}

function getClassForBirth(birth) {
  const age = getAgeFromBirth(birth);
  if (age === null) {
    return "Indefinida";
  }
  if (age >= 2 && age <= 3) return "Maternal";
  if (age >= 4 && age <= 6) return "Kids";
  if (age >= 7 && age <= 10) return "Juniors";
  if (age >= 11 && age <= 14) return "Teens";
  return "Fora da faixa";
}

function groupCheckinsByClass(checkins) {
  return checkins.reduce((acc, checkin) => {
    const key = checkin.className || "Indefinida";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function formatCounts(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) {
    return "Nenhum check-in registrado.";
  }
  return entries.map(([key, value]) => `${key}: ${value}`).join(" | ");
}

function parseLogDateTimeLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }
  const [datePart = "", timePart = ""] = raw.split(" ");
  const dateObj = parseRoomDate(datePart);
  if (!dateObj) {
    return null;
  }
  const [hour = "0", minute = "0"] = timePart.split(":");
  dateObj.setHours(Number.parseInt(hour, 10) || 0, Number.parseInt(minute, 10) || 0, 0, 0);
  return dateObj;
}

function buildLogFrequencyRows(checkins) {
  const filterTerm = String(els.logStudentFilter?.value || "").trim().toLowerCase();
  const selectedIds = new Set(state.ui.logSelectedStudentIds || []);
  const hasSelectedIds = selectedIds.size > 0;
  const grouped = new Map();
  for (const checkin of checkins) {
    if (hasSelectedIds && !selectedIds.has(checkin.studentId)) {
      continue;
    }
    const student = state.students.find((item) => item.id === checkin.studentId);
    const studentName = student?.name || "Visitante";
    if (filterTerm && !studentName.toLowerCase().includes(filterTerm)) {
      continue;
    }
    const className = checkin.className || student?.className || "Visitante";
    const key = `${checkin.studentId || studentName}|${className}`;
    if (!grouped.has(key)) {
      grouped.set(key, { studentName, className, checkinTimes: [] });
    }
    grouped.get(key).checkinTimes.push(checkin.dateTime || "");
  }
  return Array.from(grouped.values())
    .map((item) => {
      const orderedTimes = item.checkinTimes
        .slice()
        .sort((a, b) => {
          const da = parseLogDateTimeLabel(a);
          const db = parseLogDateTimeLabel(b);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.getTime() - db.getTime();
        });
      return {
        studentName: item.studentName,
        className: item.className,
        checkinCount: orderedTimes.length,
        timesLabel: orderedTimes.join(" | ")
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

function getAvailableLogStudents(checkins) {
  const map = new Map();
  checkins.forEach((checkin) => {
    const student = state.students.find((item) => item.id === checkin.studentId);
    const id = checkin.studentId;
    if (!id || map.has(id)) {
      return;
    }
    map.set(id, {
      id,
      name: student?.name || "Visitante",
      className: checkin.className || student?.className || "Visitante"
    });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function renderLogSelectedStudentsSummary(availableStudents) {
  if (!els.logSelectedStudentsSummary) {
    return;
  }
  const selectedIds = state.ui.logSelectedStudentIds || [];
  if (!availableStudents.length) {
    els.logSelectedStudentsSummary.textContent = "Nenhuma crianca com check-in no periodo/turma selecionados.";
    return;
  }
  if (!selectedIds.length) {
    els.logSelectedStudentsSummary.textContent = `Criancas filtradas: todas (${availableStudents.length}).`;
    return;
  }
  const selectedNames = availableStudents
    .filter((student) => selectedIds.includes(student.id))
    .map((student) => student.name);
  els.logSelectedStudentsSummary.textContent = `Criancas selecionadas (${selectedNames.length}): ${selectedNames.join(", ")}`;
}

function renderLogClassFilterOptions() {
  if (!els.logClassFilter) {
    return;
  }
  if (!els.logClassFilter.value) {
    els.logClassFilter.value = "all";
  }
}

function openLogStudentsDialog() {
  if (!els.logStudentsDialog || !els.logStudentsList) {
    return;
  }
  const students = getAvailableLogStudents(getFilteredCheckins());
  els.logStudentsList.innerHTML = "";
  if (!students.length) {
    els.logStudentsList.innerHTML = `<div class="summary">Nenhuma crianca disponivel para o filtro atual.</div>`;
    els.logStudentsDialog.showModal();
    return;
  }
  const selectedSet = new Set(state.ui.logSelectedStudentIds || []);
  students.forEach((student) => {
    const row = document.createElement("label");
    row.className = "field checkbox-field";
    row.innerHTML = `
      <span>${student.name} (${student.className})</span>
      <input type="checkbox" data-log-student-id="${student.id}" ${selectedSet.has(student.id) ? "checked" : ""} />
    `;
    const box = row.querySelector('input[type="checkbox"][data-log-student-id]');
    box?.addEventListener("change", syncLogStudentsSelectAllState);
    els.logStudentsList.appendChild(row);
  });
  syncLogStudentsSelectAllState();
  els.logStudentsDialog.showModal();
}

function handleLogStudentsSelectAll(event) {
  const checked = Boolean(event?.target?.checked);
  const boxes = els.logStudentsList?.querySelectorAll('input[type="checkbox"][data-log-student-id]') || [];
  boxes.forEach((box) => {
    box.checked = checked;
  });
}

function syncLogStudentsSelectAllState() {
  if (!els.logStudentsSelectAll || !els.logStudentsList) {
    return;
  }
  const boxes = Array.from(els.logStudentsList.querySelectorAll('input[type="checkbox"][data-log-student-id]'));
  els.logStudentsSelectAll.checked = boxes.length > 0 && boxes.every((box) => box.checked);
}

function applyLogStudentsSelection() {
  if (!els.logStudentsList) {
    return;
  }
  const boxes = els.logStudentsList.querySelectorAll('input[type="checkbox"][data-log-student-id]:checked');
  state.ui.logSelectedStudentIds = Array.from(boxes).map((box) => box.getAttribute("data-log-student-id"));
  els.logStudentsDialog?.close();
  renderLog();
}

function renderLogStudentFilterOptions() {
  const datalist = document.getElementById("logStudentOptions");
  if (!datalist) {
    return;
  }
  const names = Array.from(
    new Set(
      getFilteredCheckins()
        .map((checkin) => {
          const student = state.students.find((item) => item.id === checkin.studentId);
          return student?.name || "Visitante";
        })
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  datalist.innerHTML = "";
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    datalist.appendChild(option);
  });
}

function normalizeStudents() {
  state.students = state.students.map((student) => ({
    ...student,
    className: getClassForBirth(student.birth)
  }));
}

function seedRoomDefaults() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();
  if (els.roomDate && !els.roomDate.value) {
    els.roomDate.value = `${year}-${month}-${day}`;
  }
  if (els.roomStartTime && !els.roomStartTime.value) {
    const hours = String(today.getHours()).padStart(2, "0");
    const minutes = String(today.getMinutes()).padStart(2, "0");
    els.roomStartTime.value = `${hours}:${minutes}`;
  }
  if (els.roomEndTime && !els.roomEndTime.value) {
    const end = new Date(today.getTime() + 60 * 60 * 1000);
    const hours = String(end.getHours()).padStart(2, "0");
    const minutes = String(end.getMinutes()).padStart(2, "0");
    els.roomEndTime.value = `${hours}:${minutes}`;
  }
}

function getFilteredCheckins() {
  const startValue = els.logStart.value;
  const endValue = els.logEnd.value;
  const classFilter = (els.logClassFilter?.value || "all").trim();
  const startDate = parseInputDate(startValue);
  const endDate = parseInputDate(endValue);

  return state.checkins.filter((checkin) => {
    const datePart = checkin.dateTime.split(" ")[0];
    const checkinDate = parseRoomDate(datePart);
    if (!checkinDate) {
      return false;
    }
    if (startDate && checkinDate < startDate) {
      return false;
    }
    if (endDate) {
      const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
      if (checkinDate > endOfDay) {
        return false;
      }
    }
    if (classFilter && classFilter !== "all") {
      const className = checkin.className || "Visitante";
      if (className !== classFilter) {
        return false;
      }
    }
    return true;
  });
}

function getOpenRoomsToday() {
  return getRoomsToday().filter((room) => room.status === "Aberta");
}

function getOpenRoomForClass(className) {
  const openRooms = getOpenRoomsToday();
  if (!openRooms.length) {
    return null;
  }
  const activeRoom = getActiveRoom();
  if (activeRoom && activeRoom.classTarget === className) {
    return activeRoom;
  }
  return openRooms.find((room) => room.classTarget === className) || null;
}

function getActiveRoom() {
  const openRooms = getOpenRoomsToday();
  if (!openRooms.length) {
    return null;
  }
  const active = openRooms.find((room) => room.id === state.activeRoomId);
  return active || openRooms[0];
}

function setRoomView(view) {
  state.roomView = view;
  render();
}

function updateRoomViewButtons() {
  const current = state.roomView || "open";
  if (els.btnRoomViewOpen) {
    els.btnRoomViewOpen.className = current === "open" ? "primary" : "ghost";
  }
  if (els.btnRoomViewClosed) {
    els.btnRoomViewClosed.className = current === "closed" ? "primary" : "ghost";
  }
}

function setActiveRoom(roomId) {
  state.activeRoomId = roomId || "";
  render();
}

function renderActiveRoomSelect(openRooms, activeRoom) {
  if (!els.roomActive) {
    return;
  }
  const canManageRoom = isAdmin() || isEquipe();
  els.roomActive.disabled = !openRooms.length && !canManageRoom;
  els.roomActive.innerHTML = "";
  if (!openRooms.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhuma sala aberta";
    els.roomActive.appendChild(option);
    return;
  }
  openRooms.forEach((room) => {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = `${room.name} - ${room.time || ""} (${room.classTarget || "-"})`.trim();
    if (room.id === activeRoom?.id) {
      option.selected = true;
    }
    els.roomActive.appendChild(option);
  });
}

function renderRoomOpenList(roomsToday) {
  if (!els.roomOpenList) {
    return;
  }
  const availableRooms = roomsToday.filter((room) => room.status !== "Aberta");
  els.roomOpenList.innerHTML = "";
  if (!availableRooms.length) {
    const empty = document.createElement("div");
    empty.className = "summary";
    empty.textContent = "Nenhuma sala programada para hoje.";
    els.roomOpenList.appendChild(empty);
    els.btnOpenSelectedRooms.disabled = true;
    els.btnOpenAllRooms.disabled = true;
    return;
  }

  availableRooms.forEach((room) => {
    const item = document.createElement("label");
    item.className = "room-open-item";
    item.innerHTML = `
      <input type="checkbox" data-room-id="${room.id}" />
      <span>${room.name} - ${room.time || ""} (${room.classTarget || "-"})</span>
    `.trim();
    els.roomOpenList.appendChild(item);
  });

  els.btnOpenSelectedRooms.disabled = false;
  els.btnOpenAllRooms.disabled = false;
}

function getSelectedRoomIds() {
  if (!els.roomOpenList) {
    return [];
  }
  return Array.from(els.roomOpenList.querySelectorAll('input[type="checkbox"]:checked')).map(
    (input) => input.dataset.roomId
  );
}

function getAvailableRoomIds() {
  if (!els.roomOpenList) {
    return [];
  }
  return Array.from(els.roomOpenList.querySelectorAll('input[type="checkbox"]')).map(
    (input) => input.dataset.roomId
  );
}

function handleActiveRoomChange(event) {
  const roomId = event.target.value;
  if (!roomId) {
    return;
  }
  setActiveRoom(roomId);
}

function compareRooms(a, b) {
  const dateA = parseRoomDate(a.date);
  const dateB = parseRoomDate(b.date);
  if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
    return dateA.getTime() - dateB.getTime();
  }
  if (dateA && !dateB) {
    return -1;
  }
  if (!dateA && dateB) {
    return 1;
  }
  const timeA = a.startTime || a.time || "";
  const timeB = b.startTime || b.time || "";
  if (timeA !== timeB) {
    return timeA.localeCompare(timeB);
  }
  return (a.name || "").localeCompare(b.name || "");
}

function escapeCsv(value) {
  const safe = String(value ?? "");
  if (safe.includes(",") || safe.includes("\n") || safe.includes("\"")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function seedData() {
  state.students.push(
    {
      id: uid(),
      name: "Beatriz Souza",
      birth: "2019-05-10",
      className: getClassForBirth("2019-05-10"),
      guardian: "Ana Paula",
      otherGuardians: "",
      phone: "(11) 98888-1234",
      address: "Rua das Flores, 120",
      notes: "Alergia a lactose",
      owner: "Ana Paula"
    },
    {
      id: uid(),
      name: "Lucas Silva",
      birth: "2018-09-02",
      className: getClassForBirth("2018-09-02"),
      guardian: "Carlos Silva",
      otherGuardians: "",
      phone: "(11) 97777-4321",
      address: "Av. Central, 55",
      notes: "",
      owner: "Carlos Silva"
    },
    {
      id: uid(),
      name: "Mariana Lopes",
      birth: "2021-03-14",
      className: getClassForBirth("2021-03-14"),
      guardian: "Fernanda Lopes",
      otherGuardians: "",
      phone: "(11) 95555-1010",
      address: "Rua do Sol, 88",
      notes: "",
      owner: "Fernanda Lopes"
    },
    {
      id: uid(),
      name: "Rafael Mendes",
      birth: "2017-07-22",
      className: getClassForBirth("2017-07-22"),
      guardian: "Paulo Mendes",
      otherGuardians: "",
      phone: "(11) 95555-2020",
      address: "Av. Horizonte, 310",
      notes: "",
      owner: "Paulo Mendes"
    },
    {
      id: uid(),
      name: "Laura Rocha",
      birth: "2016-11-05",
      className: getClassForBirth("2016-11-05"),
      guardian: "Juliana Rocha",
      otherGuardians: "",
      phone: "(11) 95555-3030",
      address: "Rua das Palmeiras, 15",
      notes: "",
      owner: "Juliana Rocha"
    },
    {
      id: uid(),
      name: "Tiago Alves",
      birth: "2015-01-18",
      className: getClassForBirth("2015-01-18"),
      guardian: "Renato Alves",
      otherGuardians: "",
      phone: "(11) 95555-4040",
      address: "Rua das Acacias, 45",
      notes: "",
      owner: "Renato Alves"
    },
    {
      id: uid(),
      name: "Isabela Costa",
      birth: "2014-09-30",
      className: getClassForBirth("2014-09-30"),
      guardian: "Carla Costa",
      otherGuardians: "",
      phone: "(11) 95555-5050",
      address: "Rua do Lago, 70",
      notes: "",
      owner: "Carla Costa"
    },
    {
      id: uid(),
      name: "Pedro Nunes",
      birth: "2013-06-12",
      className: getClassForBirth("2013-06-12"),
      guardian: "Luciana Nunes",
      otherGuardians: "",
      phone: "(11) 95555-6060",
      address: "Av. Primavera, 210",
      notes: "",
      owner: "Luciana Nunes"
    },
    {
      id: uid(),
      name: "Camila Barros",
      birth: "2012-02-08",
      className: getClassForBirth("2012-02-08"),
      guardian: "Roberta Barros",
      otherGuardians: "",
      phone: "(11) 95555-7070",
      address: "Rua da Serra, 66",
      notes: "",
      owner: "Roberta Barros"
    },
    {
      id: uid(),
      name: "Henrique Lima",
      birth: "2011-12-19",
      className: getClassForBirth("2011-12-19"),
      guardian: "Marco Lima",
      otherGuardians: "",
      phone: "(11) 95555-8080",
      address: "Rua da Praia, 19",
      notes: "",
      owner: "Marco Lima"
    },
    {
      id: uid(),
      name: "Sofia Araujo",
      birth: "2010-10-27",
      className: getClassForBirth("2010-10-27"),
      guardian: "Natalia Araujo",
      otherGuardians: "",
      phone: "(11) 95555-9090",
      address: "Av. Brasil, 500",
      notes: "",
      owner: "Natalia Araujo"
    },
    {
      id: uid(),
      name: "Gabriel Farias",
      birth: "2019-08-11",
      className: getClassForBirth("2019-08-11"),
      guardian: "Patricia Farias",
      otherGuardians: "",
      phone: "(11) 94444-1010",
      address: "Rua do Campo, 12",
      notes: "",
      owner: "Patricia Farias"
    },
    {
      id: uid(),
      name: "Helena Pires",
      birth: "2020-04-03",
      className: getClassForBirth("2020-04-03"),
      guardian: "Marina Pires",
      otherGuardians: "",
      phone: "(11) 94444-2020",
      address: "Rua do Porto, 33",
      notes: "",
      owner: "Marina Pires"
    },
    {
      id: uid(),
      name: "Joao Victor",
      birth: "2018-01-26",
      className: getClassForBirth("2018-01-26"),
      guardian: "Silvia Ramos",
      otherGuardians: "",
      phone: "(11) 94444-3030",
      address: "Av. Leste, 88",
      notes: "",
      owner: "Silvia Ramos"
    },
    {
      id: uid(),
      name: "Vitoria Castro",
      birth: "2017-03-09",
      className: getClassForBirth("2017-03-09"),
      guardian: "Beatriz Castro",
      otherGuardians: "",
      phone: "(11) 94444-4040",
      address: "Rua Central, 70",
      notes: "",
      owner: "Beatriz Castro"
    },
    {
      id: uid(),
      name: "Matheus Vieira",
      birth: "2016-05-21",
      className: getClassForBirth("2016-05-21"),
      guardian: "Adriana Vieira",
      otherGuardians: "",
      phone: "(11) 94444-5050",
      address: "Rua Aurora, 27",
      notes: "",
      owner: "Adriana Vieira"
    },
    {
      id: uid(),
      name: "Lorena Santos",
      birth: "2015-07-30",
      className: getClassForBirth("2015-07-30"),
      guardian: "Priscila Santos",
      otherGuardians: "",
      phone: "(11) 94444-6060",
      address: "Av. Norte, 99",
      notes: "",
      owner: "Priscila Santos"
    },
    {
      id: uid(),
      name: "Bruno Moreira",
      birth: "2014-03-16",
      className: getClassForBirth("2014-03-16"),
      guardian: "Daniel Moreira",
      otherGuardians: "",
      phone: "(11) 94444-7070",
      address: "Rua das Oliveiras, 14",
      notes: "",
      owner: "Daniel Moreira"
    },
    {
      id: uid(),
      name: "Livia Moraes",
      birth: "2013-11-24",
      className: getClassForBirth("2013-11-24"),
      guardian: "Elaine Moraes",
      otherGuardians: "",
      phone: "(11) 94444-8080",
      address: "Rua Novo Horizonte, 3",
      notes: "",
      owner: "Elaine Moraes"
    },
    {
      id: uid(),
      name: "Arthur Duarte",
      birth: "2012-08-07",
      className: getClassForBirth("2012-08-07"),
      guardian: "Claudia Duarte",
      otherGuardians: "",
      phone: "(11) 94444-9090",
      address: "Av. dos Lagos, 44",
      notes: "",
      owner: "Claudia Duarte"
    },
    {
      id: uid(),
      name: "Isadora Freitas",
      birth: "2011-04-28",
      className: getClassForBirth("2011-04-28"),
      guardian: "Renata Freitas",
      otherGuardians: "",
      phone: "(11) 93333-1111",
      address: "Rua Cedro, 9",
      notes: "",
      owner: "Renata Freitas"
    },
    {
      id: uid(),
      name: "Felipe Barbosa",
      birth: "2010-02-13",
      className: getClassForBirth("2010-02-13"),
      guardian: "Marcos Barbosa",
      otherGuardians: "",
      phone: "(11) 93333-2222",
      address: "Av. Oeste, 410",
      notes: "",
      owner: "Marcos Barbosa"
    },
    {
      id: uid(),
      name: "Lara Campos",
      birth: "2019-02-01",
      className: getClassForBirth("2019-02-01"),
      guardian: "Rita Campos",
      otherGuardians: "",
      phone: "(11) 93333-3333",
      address: "Rua Jardim, 72",
      notes: "",
      owner: "Rita Campos"
    },
    {
      id: uid(),
      name: "Enzo Martins",
      birth: "2018-04-19",
      className: getClassForBirth("2018-04-19"),
      guardian: "Marina Martins",
      otherGuardians: "",
      phone: "(11) 93333-4444",
      address: "Av. Norte, 112",
      notes: "",
      owner: "Marina Martins"
    },
    {
      id: uid(),
      name: "Miguel Reis",
      birth: "2017-12-08",
      className: getClassForBirth("2017-12-08"),
      guardian: "Julio Reis",
      otherGuardians: "",
      phone: "(11) 93333-5555",
      address: "Rua Azul, 33",
      notes: "",
      owner: "Julio Reis"
    },
    {
      id: uid(),
      name: "Alice Neves",
      birth: "2016-06-27",
      className: getClassForBirth("2016-06-27"),
      guardian: "Sonia Neves",
      otherGuardians: "",
      phone: "(11) 93333-6666",
      address: "Av. Sul, 520",
      notes: "",
      owner: "Sonia Neves"
    },
    {
      id: uid(),
      name: "Theo Santana",
      birth: "2015-10-15",
      className: getClassForBirth("2015-10-15"),
      guardian: "Carina Santana",
      otherGuardians: "",
      phone: "(11) 93333-7777",
      address: "Rua das Flores, 212",
      notes: "",
      owner: "Carina Santana"
    },
    {
      id: uid(),
      name: "Valentina Nascimento",
      birth: "2014-01-23",
      className: getClassForBirth("2014-01-23"),
      guardian: "Denise Nascimento",
      otherGuardians: "",
      phone: "(11) 93333-8888",
      address: "Av. Central, 44",
      notes: "",
      owner: "Denise Nascimento"
    },
    {
      id: uid(),
      name: "Samuel Moraes",
      birth: "2013-05-06",
      className: getClassForBirth("2013-05-06"),
      guardian: "Hugo Moraes",
      otherGuardians: "",
      phone: "(11) 93333-9999",
      address: "Rua do Sol, 9",
      notes: "",
      owner: "Hugo Moraes"
    },
    {
      id: uid(),
      name: "Julia Vieira",
      birth: "2012-09-17",
      className: getClassForBirth("2012-09-17"),
      guardian: "Patricia Vieira",
      otherGuardians: "",
      phone: "(11) 92222-1010",
      address: "Av. Oeste, 88",
      notes: "",
      owner: "Patricia Vieira"
    },
    {
      id: uid(),
      name: "Gustavo Prado",
      birth: "2011-03-12",
      className: getClassForBirth("2011-03-12"),
      guardian: "Leandro Prado",
      otherGuardians: "",
      phone: "(11) 92222-2020",
      address: "Rua Aurora, 18",
      notes: "",
      owner: "Leandro Prado"
    },
    {
      id: uid(),
      name: "Rafaela Lima",
      birth: "2010-11-30",
      className: getClassForBirth("2010-11-30"),
      guardian: "Renata Lima",
      otherGuardians: "",
      phone: "(11) 92222-3030",
      address: "Rua Verde, 37",
      notes: "",
      owner: "Renata Lima"
    },
    {
      id: uid(),
      name: "Nicolas Bastos",
      birth: "2019-07-07",
      className: getClassForBirth("2019-07-07"),
      guardian: "Beatriz Bastos",
      otherGuardians: "",
      phone: "(11) 92222-4040",
      address: "Av. Primavera, 66",
      notes: "",
      owner: "Beatriz Bastos"
    },
    {
      id: uid(),
      name: "Manuela Pinto",
      birth: "2018-12-25",
      className: getClassForBirth("2018-12-25"),
      guardian: "Paula Pinto",
      otherGuardians: "",
      phone: "(11) 92222-5050",
      address: "Rua dos Lagos, 12",
      notes: "",
      owner: "Paula Pinto"
    },
    {
      id: uid(),
      name: "Heitor Fonseca",
      birth: "2017-02-20",
      className: getClassForBirth("2017-02-20"),
      guardian: "Luiz Fonseca",
      otherGuardians: "",
      phone: "(11) 92222-6060",
      address: "Rua do Porto, 54",
      notes: "",
      owner: "Luiz Fonseca"
    },
    {
      id: uid(),
      name: "Antonella Souza",
      birth: "2016-08-04",
      className: getClassForBirth("2016-08-04"),
      guardian: "Sabrina Souza",
      otherGuardians: "",
      phone: "(11) 92222-7070",
      address: "Av. Leste, 210",
      notes: "",
      owner: "Sabrina Souza"
    },
    {
      id: uid(),
      name: "Davi Fagundes",
      birth: "2015-04-11",
      className: getClassForBirth("2015-04-11"),
      guardian: "Ronaldo Fagundes",
      otherGuardians: "",
      phone: "(11) 92222-8080",
      address: "Rua das Oliveiras, 90",
      notes: "",
      owner: "Ronaldo Fagundes"
    },
    {
      id: uid(),
      name: "Maria Clara",
      birth: "2014-07-29",
      className: getClassForBirth("2014-07-29"),
      guardian: "Claudia Alves",
      otherGuardians: "",
      phone: "(11) 92222-9090",
      address: "Rua do Campo, 40",
      notes: "",
      owner: "Claudia Alves"
    },
    {
      id: uid(),
      name: "Eduardo Ramos",
      birth: "2013-10-02",
      className: getClassForBirth("2013-10-02"),
      guardian: "Silvio Ramos",
      otherGuardians: "",
      phone: "(11) 91111-1010",
      address: "Av. Brasil, 560",
      notes: "",
      owner: "Silvio Ramos"
    },
    {
      id: uid(),
      name: "Lorena Ribeiro",
      birth: "2012-05-14",
      className: getClassForBirth("2012-05-14"),
      guardian: "Lucia Ribeiro",
      otherGuardians: "",
      phone: "(11) 91111-2020",
      address: "Rua dos Cravos, 7",
      notes: "",
      owner: "Lucia Ribeiro"
    },
    {
      id: uid(),
      name: "Caua Ribeiro",
      birth: "2011-09-09",
      className: getClassForBirth("2011-09-09"),
      guardian: "Lucia Ribeiro",
      otherGuardians: "",
      phone: "(11) 91111-3030",
      address: "Rua dos Cravos, 7",
      notes: "",
      owner: "Lucia Ribeiro"
    },
    {
      id: uid(),
      name: "Bianca Cruz",
      birth: "2010-12-01",
      className: getClassForBirth("2010-12-01"),
      guardian: "Elisa Cruz",
      otherGuardians: "",
      phone: "(11) 91111-4040",
      address: "Rua Horizonte, 28",
      notes: "",
      owner: "Elisa Cruz"
    },
    {
      id: uid(),
      name: "Isac Gomes",
      birth: "2019-10-10",
      className: getClassForBirth("2019-10-10"),
      guardian: "Regina Gomes",
      otherGuardians: "",
      phone: "(11) 91111-5050",
      address: "Av. Mar, 18",
      notes: "",
      owner: "Regina Gomes"
    },
    {
      id: uid(),
      name: "Eloah Nogueira",
      birth: "2018-06-18",
      className: getClassForBirth("2018-06-18"),
      guardian: "Cintia Nogueira",
      otherGuardians: "",
      phone: "(11) 91111-6060",
      address: "Rua do Norte, 64",
      notes: "",
      owner: "Cintia Nogueira"
    },
    {
      id: uid(),
      name: "Gael Cardoso",
      birth: "2017-09-05",
      className: getClassForBirth("2017-09-05"),
      guardian: "Cesar Cardoso",
      otherGuardians: "",
      phone: "(11) 91111-7070",
      address: "Av. dos Lagos, 88",
      notes: "",
      owner: "Cesar Cardoso"
    },
    {
      id: uid(),
      name: "Heloisa Brito",
      birth: "2016-02-24",
      className: getClassForBirth("2016-02-24"),
      guardian: "Marta Brito",
      otherGuardians: "",
      phone: "(11) 91111-8080",
      address: "Rua do Sol, 16",
      notes: "",
      owner: "Marta Brito"
    },
    {
      id: uid(),
      name: "Benjamin Silva",
      birth: "2015-11-08",
      className: getClassForBirth("2015-11-08"),
      guardian: "Fernanda Silva",
      otherGuardians: "",
      phone: "(11) 91111-9090",
      address: "Av. Central, 102",
      notes: "",
      owner: "Fernanda Silva"
    },
    {
      id: uid(),
      name: "Leticia Azevedo",
      birth: "2014-04-30",
      className: getClassForBirth("2014-04-30"),
      guardian: "Julia Azevedo",
      otherGuardians: "",
      phone: "(11) 90000-1111",
      address: "Rua das Artes, 55",
      notes: "",
      owner: "Julia Azevedo"
    },
    {
      id: uid(),
      name: "Pedro Henrique",
      birth: "2013-08-22",
      className: getClassForBirth("2013-08-22"),
      guardian: "Elaine Henrique",
      otherGuardians: "",
      phone: "(11) 90000-2222",
      address: "Rua das Acacias, 120",
      notes: "",
      owner: "Elaine Henrique"
    },
    {
      id: uid(),
      name: "Ana Beatriz",
      birth: "2012-01-09",
      className: getClassForBirth("2012-01-09"),
      guardian: "Sueli Lima",
      otherGuardians: "",
      phone: "(11) 90000-3333",
      address: "Rua Bela Vista, 7",
      notes: "",
      owner: "Sueli Lima"
    },
    {
      id: uid(),
      name: "Bruna Cardoso",
      birth: "2011-06-03",
      className: getClassForBirth("2011-06-03"),
      guardian: "Camila Cardoso",
      otherGuardians: "",
      phone: "(11) 90000-4444",
      address: "Av. Norte, 210",
      notes: "",
      owner: "Camila Cardoso"
    },
    {
      id: uid(),
      name: "Ryan Fernandes",
      birth: "2010-08-26",
      className: getClassForBirth("2010-08-26"),
      guardian: "Paulo Fernandes",
      otherGuardians: "",
      phone: "(11) 90000-5555",
      address: "Rua do Lago, 19",
      notes: "",
      owner: "Paulo Fernandes"
    },
    {
      id: uid(),
      name: "Luana Medeiros",
      birth: "2019-03-13",
      className: getClassForBirth("2019-03-13"),
      guardian: "Aline Medeiros",
      otherGuardians: "",
      phone: "(11) 90000-6666",
      address: "Rua do Parque, 11",
      notes: "",
      owner: "Aline Medeiros"
    },
    {
      id: uid(),
      name: "Caio Henrique",
      birth: "2018-05-28",
      className: getClassForBirth("2018-05-28"),
      guardian: "Rafael Henrique",
      otherGuardians: "",
      phone: "(11) 90000-7777",
      address: "Av. do Sol, 77",
      notes: "",
      owner: "Rafael Henrique"
    },
    {
      id: uid(),
      name: "Mariana Rosa",
      birth: "2017-01-31",
      className: getClassForBirth("2017-01-31"),
      guardian: "Daniela Rosa",
      otherGuardians: "",
      phone: "(11) 90000-8888",
      address: "Rua da Serra, 101",
      notes: "",
      owner: "Daniela Rosa"
    },
    {
      id: uid(),
      name: "Vitor Hugo",
      birth: "2016-03-07",
      className: getClassForBirth("2016-03-07"),
      guardian: "Marcio Hugo",
      otherGuardians: "",
      phone: "(11) 90000-9999",
      address: "Av. do Lago, 31",
      notes: "",
      owner: "Marcio Hugo"
    },
    {
      id: uid(),
      name: "Isabelly Teixeira",
      birth: "2015-08-12",
      className: getClassForBirth("2015-08-12"),
      guardian: "Paula Teixeira",
      otherGuardians: "",
      phone: "(11) 91111-0000",
      address: "Rua das Pedras, 8",
      notes: "",
      owner: "Paula Teixeira"
    },
    {
      id: uid(),
      name: "Felipe Araujo",
      birth: "2014-10-26",
      className: getClassForBirth("2014-10-26"),
      guardian: "Rita Araujo",
      otherGuardians: "",
      phone: "(11) 91111-1111",
      address: "Rua Nova, 14",
      notes: "",
      owner: "Rita Araujo"
    },
    {
      id: uid(),
      name: "Sabrina Costa",
      birth: "2013-02-15",
      className: getClassForBirth("2013-02-15"),
      guardian: "Vanessa Costa",
      otherGuardians: "",
      phone: "(11) 91111-2222",
      address: "Rua do Centro, 90",
      notes: "",
      owner: "Vanessa Costa"
    },
    {
      id: uid(),
      name: "Cecilia Barros",
      birth: "2012-06-06",
      className: getClassForBirth("2012-06-06"),
      guardian: "Priscila Barros",
      otherGuardians: "",
      phone: "(11) 91111-3333",
      address: "Av. dos Estados, 210",
      notes: "",
      owner: "Priscila Barros"
    },
    {
      id: uid(),
      name: "Vinicius Rocha",
      birth: "2011-11-21",
      className: getClassForBirth("2011-11-21"),
      guardian: "Eduardo Rocha",
      otherGuardians: "",
      phone: "(11) 91111-4444",
      address: "Rua do Povo, 3",
      notes: "",
      owner: "Eduardo Rocha"
    },
    {
      id: uid(),
      name: "Marcela Dias",
      birth: "2010-07-04",
      className: getClassForBirth("2010-07-04"),
      guardian: "Ivana Dias",
      otherGuardians: "",
      phone: "(11) 91111-5555",
      address: "Av. do Aeroporto, 10",
      notes: "",
      owner: "Ivana Dias"
    },
    {
      id: uid(),
      name: "Otavio Pacheco",
      birth: "2019-11-19",
      className: getClassForBirth("2019-11-19"),
      guardian: "Carmen Pacheco",
      otherGuardians: "",
      phone: "(11) 92222-1111",
      address: "Rua do Bosque, 26",
      notes: "",
      owner: "Carmen Pacheco"
    },
    {
      id: uid(),
      name: "Beatriz Lima",
      birth: "2018-09-08",
      className: getClassForBirth("2018-09-08"),
      guardian: "Luciana Lima",
      otherGuardians: "",
      phone: "(11) 92222-2222",
      address: "Av. Paulista, 500",
      notes: "",
      owner: "Luciana Lima"
    },
    {
      id: uid(),
      name: "Murilo Dantas",
      birth: "2017-04-23",
      className: getClassForBirth("2017-04-23"),
      guardian: "Bianca Dantas",
      otherGuardians: "",
      phone: "(11) 92222-3333",
      address: "Rua das Flores, 19",
      notes: "",
      owner: "Bianca Dantas"
    },
    {
      id: uid(),
      name: "Helena Duarte",
      birth: "2016-12-02",
      className: getClassForBirth("2016-12-02"),
      guardian: "Sandra Duarte",
      otherGuardians: "",
      phone: "(11) 92222-4444",
      address: "Av. Brasil, 120",
      notes: "",
      owner: "Sandra Duarte"
    },
    {
      id: uid(),
      name: "Ravi Monteiro",
      birth: "2015-03-18",
      className: getClassForBirth("2015-03-18"),
      guardian: "Iris Monteiro",
      otherGuardians: "",
      phone: "(11) 92222-5555",
      address: "Rua do Porto, 6",
      notes: "",
      owner: "Iris Monteiro"
    },
    {
      id: uid(),
      name: "Ana Luiza",
      birth: "2014-12-14",
      className: getClassForBirth("2014-12-14"),
      guardian: "Sonia Loureiro",
      otherGuardians: "",
      phone: "(11) 92222-6666",
      address: "Av. Central, 44",
      notes: "",
      owner: "Sonia Loureiro"
    },
    {
      id: uid(),
      name: "Guilherme Souza",
      birth: "2013-01-05",
      className: getClassForBirth("2013-01-05"),
      guardian: "Priscila Souza",
      otherGuardians: "",
      phone: "(11) 92222-7777",
      address: "Rua do Norte, 21",
      notes: "",
      owner: "Priscila Souza"
    },
    {
      id: uid(),
      name: "Giovanna Alves",
      birth: "2012-10-20",
      className: getClassForBirth("2012-10-20"),
      guardian: "Sueli Alves",
      otherGuardians: "",
      phone: "(11) 92222-8888",
      address: "Av. das Palmeiras, 200",
      notes: "",
      owner: "Sueli Alves"
    },
    {
      id: uid(),
      name: "Lorenzo Vidal",
      birth: "2011-05-27",
      className: getClassForBirth("2011-05-27"),
      guardian: "Mariana Vidal",
      otherGuardians: "",
      phone: "(11) 92222-9999",
      address: "Rua do Oeste, 88",
      notes: "",
      owner: "Mariana Vidal"
    },
    {
      id: uid(),
      name: "Agatha Silva",
      birth: "2010-09-16",
      className: getClassForBirth("2010-09-16"),
      guardian: "Leticia Silva",
      otherGuardians: "",
      phone: "(11) 93333-0000",
      address: "Av. Horizonte, 400",
      notes: "",
      owner: "Leticia Silva"
    }
  );

}

function loadState() {
  if (!supabaseClient) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const rooms = Array.isArray(parsed.rooms)
          ? parsed.rooms.map((room) => ({ ...room, classTarget: room.classTarget || "" }))
          : [];
        const ui = {
          activePanel: "dashboard",
          showLogPanel: false,
          showInvitePanel: false,
          expandedTips: [],
          selectedManageUserId: "",
          logSelectedStudentIds: [],
          ...(parsed.ui || {})
        };
        return {
          activeRoomId: "",
          selectedRoomId: "",
          roomView: "open",
          profiles: [],
          schedules: [],
          tips: [],
          tipReads: [],
          dashboardInfo: "",
          ...parsed,
          rooms,
          ui
        };
      } catch (err) {
        console.warn("Falha ao ler storage", err);
      }
    }
  }
  return {
    session: null,
    activeRoomId: "",
    selectedRoomId: "",
    roomView: "open",
    students: [],
    rooms: [],
    checkins: [],
    profiles: [],
    schedules: [],
    tips: [],
    tipReads: [],
    dashboardInfo: "",
    visitors: [],
    ui: {
      activePanel: "dashboard",
      showLogPanel: false,
      showInvitePanel: false,
      expandedTips: [],
      selectedManageUserId: "",
      logSelectedStudentIds: []
    }
  };
}

function saveState() {
  if (!supabaseClient) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.update().catch(() => {});
      })
      .catch((err) => {
        console.warn("SW falhou", err);
      });
  }
}



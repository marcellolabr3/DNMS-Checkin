﻿const STORAGE_KEY = "checkin_app_state_v1";
const STORAGE_BUCKET = "dnms-photos";
const PENDING_PROFILE_PHOTO_PREFIX = "pending_profile_photo_v1:";
const SCHEDULE_SHEET_CONFIG_KEY = "checkin_schedule_sheet_config_v1";
const AUTO_SHEET_DETAILS_PREFIX = "[AUTO_GSHEET]";
const SHEET_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const DEFAULT_RECURRENCE_WEEKS = 4;
const PRINT_SERVICE_URL = "http://localhost:3001";
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
const scheduleSheetContext = {
  config: loadScheduleSheetConfig(),
  timerId: null,
  inProgress: false
};
const signupContext = { role: "responsavel", inviteToken: "" };
const roomFormContext = { editingId: "" };
const studentDetailsContext = { studentId: "" };
const studentDialogContext = { guardianProfileId: "" };
const myDataContext = { name: "", email: "", phone: "", address: "", photoUrl: "" };
const familyContext = { selectedProfileId: "" };
let printServiceErrorShown = false;

const els = {
  sessionRole: document.getElementById("sessionRole"),
  btnHomePanel: document.getElementById("btnHomePanel"),
  btnRoomsPanel: document.getElementById("btnRoomsPanel"),
  btnStudentsPanel: document.getElementById("btnStudentsPanel"),
  btnFamiliesPanel: document.getElementById("btnFamiliesPanel"),
  btnTipsInbox: document.getElementById("btnTipsInbox"),
  tipsUnreadCount: document.getElementById("tipsUnreadCount"),
  btnPrintPanel: document.getElementById("btnPrintPanel"),
  btnLogPanel: document.getElementById("btnLogPanel"),
  btnInvitePanel: document.getElementById("btnInvitePanel"),
  btnLogout: document.getElementById("btnLogout"),
  btnLogin: document.getElementById("btnLogin"),
  btnForgotPassword: document.getElementById("btnForgotPassword"),
  btnOpenSignup: document.getElementById("btnOpenSignup"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  dashboardCard: document.getElementById("dashboardCard"),
  dashboardAlerts: document.getElementById("dashboardAlerts"),
  dashboardAttention: document.getElementById("dashboardAttention"),
  dashboardLessonToday: document.getElementById("dashboardLessonToday"),
  dashboardSchedules: document.getElementById("dashboardSchedules"),
  dashboardBirthdays: document.getElementById("dashboardBirthdays"),
  dashboardAdminTools: document.getElementById("dashboardAdminTools"),
  dashboardInfoText: document.getElementById("dashboardInfoText"),
  btnSaveDashboardInfo: document.getElementById("btnSaveDashboardInfo"),
  scheduleFileInput: document.getElementById("scheduleFileInput"),
  btnImportScheduleFile: document.getElementById("btnImportScheduleFile"),
  scheduleSheetUrl: document.getElementById("scheduleSheetUrl"),
  btnSaveScheduleSheetUrl: document.getElementById("btnSaveScheduleSheetUrl"),
  btnSyncScheduleSheet: document.getElementById("btnSyncScheduleSheet"),
  scheduleSheetSyncStatus: document.getElementById("scheduleSheetSyncStatus"),
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
  selectAllRooms: document.getElementById("selectAllRooms"),
  btnBulkEditRooms: document.getElementById("btnBulkEditRooms"),
  btnBulkDeleteRooms: document.getElementById("btnBulkDeleteRooms"),
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
  tipsComposer: document.getElementById("tipsComposer"),
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
  manageInviteEmail: document.getElementById("manageInviteEmail"),
  manageInviteRole: document.getElementById("manageInviteRole"),
  btnGenerateInviteLink: document.getElementById("btnGenerateInviteLink"),
  btnCopyInviteLink: document.getElementById("btnCopyInviteLink"),
  manageInviteStatus: document.getElementById("manageInviteStatus"),
  manageInviteLink: document.getElementById("manageInviteLink"),
  familiesCard: document.getElementById("familiesCard"),
  manageUserSearch: document.getElementById("manageUserSearch"),
  manageUsersStatus: document.getElementById("manageUsersStatus"),
  manageUsersList: document.getElementById("manageUsersList"),
  manageUserEditor: document.getElementById("manageUserEditor"),
  familySearch: document.getElementById("familySearch"),
  btnExportFamilies: document.getElementById("btnExportFamilies"),
  familyList: document.getElementById("familyList"),
  familyEditor: document.getElementById("familyEditor"),
  familyCreateName: document.getElementById("familyCreateName"),
  familyCreateBirth: document.getElementById("familyCreateBirth"),
  familyCreateCivil: document.getElementById("familyCreateCivil"),
  familyCreatePhone: document.getElementById("familyCreatePhone"),
  familyCreateEmail: document.getElementById("familyCreateEmail"),
  familyCreateAddress: document.getElementById("familyCreateAddress"),
  btnFamilyCreateResponsible: document.getElementById("btnFamilyCreateResponsible"),
  btnFamilyClearCreate: document.getElementById("btnFamilyClearCreate"),
  familyCreateStatus: document.getElementById("familyCreateStatus"),
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
  studentGuardianOptions: document.getElementById("studentGuardianOptions"),
  studentGuardianHint: document.getElementById("studentGuardianHint"),
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
  btnSubmitSignup: document.getElementById("btnSubmitSignup"),
  forgotPasswordDialog: document.getElementById("forgotPasswordDialog"),
  forgotPasswordEmail: document.getElementById("forgotPasswordEmail"),
  btnSendPasswordReset: document.getElementById("btnSendPasswordReset"),
  resetPasswordDialog: document.getElementById("resetPasswordDialog"),
  resetPasswordNew: document.getElementById("resetPasswordNew"),
  resetPasswordConfirm: document.getElementById("resetPasswordConfirm"),
  btnSubmitPasswordReset: document.getElementById("btnSubmitPasswordReset"),
  myDataDialog: document.getElementById("myDataDialog"),
  myDataName: document.getElementById("myDataName"),
  myDataEmail: document.getElementById("myDataEmail"),
  myDataPhone: document.getElementById("myDataPhone"),
  myDataAddress: document.getElementById("myDataAddress"),
  myDataPhoto: document.getElementById("myDataPhoto"),
  myDataPhotoPreview: document.getElementById("myDataPhotoPreview"),
  btnSaveMyData: document.getElementById("btnSaveMyData")
};

boot();

async function boot() {
  bindEvents();
  await handleInviteQueryParams();
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
  await maybeOpenPasswordResetDialog();
  registerServiceWorker();
}

function bindEvents() {
  els.btnLogin.addEventListener("click", handleLogin);
  els.sessionRole?.addEventListener("click", openMyDataDialog);
  els.sessionRole?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMyDataDialog();
    }
  });
  els.btnForgotPassword?.addEventListener("click", openForgotPasswordDialog);
  els.btnOpenSignup?.addEventListener("click", () => openSignupDialog("responsavel"));
  els.btnSubmitSignup?.addEventListener("click", handleSignupSubmit);
  els.btnSendPasswordReset?.addEventListener("click", handleSendPasswordResetEmail);
  els.btnSubmitPasswordReset?.addEventListener("click", handleSubmitPasswordReset);
  els.btnSaveMyData?.addEventListener("click", handleSaveMyData);
  els.btnHomePanel?.addEventListener("click", goHomePanel);
  els.btnRoomsPanel?.addEventListener("click", () => setActivePanel("rooms"));
  els.btnStudentsPanel?.addEventListener("click", () => setActivePanel("students"));
  els.btnFamiliesPanel?.addEventListener("click", () => setActivePanel("families"));
  els.btnTipsInbox?.addEventListener("click", openTipsDialog);
  els.btnLogPanel?.addEventListener("click", toggleLogPanel);
  els.btnInvitePanel?.addEventListener("click", toggleInvitePanel);
  els.btnLogout.addEventListener("click", handleLogout);
  els.btnPrintPanel.addEventListener("click", () => window.open("print.html", "_blank"));
  els.btnCreateRoom.addEventListener("click", createRooms);
  els.btnDeleteRoomFromEdit?.addEventListener("click", handleDeleteRoomFromEdit);
  els.selectAllRooms?.addEventListener("change", handleSelectAllRoomsInList);
  els.btnBulkEditRooms?.addEventListener("click", handleBulkEditRooms);
  els.btnBulkDeleteRooms?.addEventListener("click", handleBulkDeleteRooms);
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
  els.btnSaveScheduleSheetUrl?.addEventListener("click", saveScheduleSheetUrl);
  els.btnSyncScheduleSheet?.addEventListener("click", () => syncSchedulesFromGoogleSheet({ manual: true }));
  els.btnSendTip?.addEventListener("click", sendTipMessage);
  els.btnClearTipMessage?.addEventListener("click", clearTipMessageBox);
  els.btnDeleteAllTips?.addEventListener("click", deleteAllVisibleTips);
  els.btnMarkAllTipsRead?.addEventListener("click", markAllTipsAsRead);
  els.manageUserSearch?.addEventListener("input", () => renderManagementPanel());
  els.btnGenerateInviteLink?.addEventListener("click", handleGenerateAccessInviteLink);
  els.btnCopyInviteLink?.addEventListener("click", copyGeneratedAccessInviteLink);
  els.familySearch?.addEventListener("input", renderFamiliesPanel);
  els.btnExportFamilies?.addEventListener("click", exportFamiliesCsv);
  els.btnFamilyCreateResponsible?.addEventListener("click", handleCreateFamilyResponsible);
  els.btnFamilyClearCreate?.addEventListener("click", clearFamilyCreateForm);
  els.btnPrintLabel.addEventListener("click", () => printCurrentLabel({ type: "reprint" }));
  els.btnCloseLabel.addEventListener("click", () => els.labelDialog.close());

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
  if (els.myDataPhoto) {
    els.myDataPhoto.addEventListener("change", () => {
      updatePhotoPreview(els.myDataPhoto, els.myDataPhotoPreview);
    });
  }
  els.studentDialog?.addEventListener("close", () => {
    if (els.studentDialog?.returnValue === "cancel") {
      resetStudentDialogDraft();
    }
  });
  els.signupDialog?.addEventListener("close", () => {
    if (els.signupDialog?.returnValue === "cancel") {
      resetSignupDialogDraft();
    }
  });
  els.myDataDialog?.addEventListener("close", () => {
    if (els.myDataDialog?.returnValue === "cancel") {
      resetMyDataDialogDraft();
    }
  });
  els.studentGuardian?.addEventListener("input", () => {
    renderGuardianOptions(els.studentGuardian.value);
    syncGuardianSelectionFromInput();
  });
  els.studentGuardian?.addEventListener("change", () => {
    renderGuardianOptions(els.studentGuardian.value);
    syncGuardianSelectionFromInput();
  });
  [els.studentBirth, els.signupBirth].forEach((input) => {
    input?.addEventListener("input", () => {
      input.value = applyBirthDateMask(input.value);
    });
  });
  [els.familyCreateBirth].forEach((input) => {
    input?.addEventListener("input", () => {
      input.value = applyBirthDateMask(input.value);
    });
  });
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
  renderFamiliesPanel();
  renderLog();
  renderManagementPanel();
  saveState();
}

function renderSession() {
  applyRoleTheme();
  if (state.session) {
    const sessionName = state.session.name || formatRole(state.session.role);
    els.sessionRole.textContent = sessionName;
    els.sessionRole.style.cursor = "pointer";
    els.sessionRole.setAttribute("aria-disabled", "false");
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
    if (els.btnFamiliesPanel) {
      els.btnFamiliesPanel.style.display = isAdmin() || isEquipe() ? "inline-flex" : "none";
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
    els.sessionRole.style.cursor = "default";
    els.sessionRole.setAttribute("aria-disabled", "true");
    els.btnLogout.style.display = "none";
    if (els.btnRoomsPanel) {
      els.btnRoomsPanel.style.display = "none";
    }
    if (els.btnStudentsPanel) {
      els.btnStudentsPanel.style.display = "none";
    }
    if (els.btnFamiliesPanel) {
      els.btnFamiliesPanel.style.display = "none";
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

function applyRoleTheme() {
  const body = document.body;
  if (!body) {
    return;
  }
  body.classList.remove("role-theme-equipe", "role-theme-admin", "role-theme-sadmin");
  if (!state.session) {
    return;
  }
  if (isSadmin()) {
    body.classList.add("role-theme-sadmin");
    return;
  }
  if (isAdmin()) {
    body.classList.add("role-theme-admin");
    return;
  }
  if (isEquipe()) {
    body.classList.add("role-theme-equipe");
  }
}

async function fetchProfile(userId) {
  let primaryResult = await supabaseClient
    .from("profiles")
    .select("id,name,role,email,phone,address,photo_url")
    .eq("id", userId)
    .single();
  if (primaryResult.error) {
    const message = String(primaryResult.error.message || "").toLowerCase();
    const missingAddressColumn = message.includes("column") && message.includes("address");
    if (missingAddressColumn) {
      primaryResult = await supabaseClient
        .from("profiles")
        .select("id,name,role,email,phone,photo_url")
        .eq("id", userId)
        .single();
    }
  }
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
    email: "",
    phone: "",
    address: "",
    photo_url: ""
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
  if (panel === "families" && !(isAdmin() || isEquipe())) {
    panel = "dashboard";
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
  const allowed = new Set(["dashboard", "rooms", "students", "families", "log", "invite"]);
  if (!allowed.has(state.ui.activePanel || "")) {
    state.ui.activePanel = "dashboard";
  }
  if (state.ui.activePanel === "families" && !(isAdmin() || isEquipe())) {
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
  if (els.btnFamiliesPanel) {
    els.btnFamiliesPanel.className = active === "families" ? "primary" : "ghost";
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
    .filter((tip) => !tip.recipientId || tip.recipientId === myId || canAccessManagementPanel())
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
  renderTipsComposerControls();
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
    title.textContent = `[${resolveTipRecipientLabel(tip)}] Mensagem`;
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

function renderTipsComposerControls() {
  const canSend = canAccessManagementPanel();
  if (els.tipsComposer) {
    els.tipsComposer.style.display = canSend ? "block" : "none";
  }
  if (!canSend || !els.tipsRecipientSelect) {
    return;
  }
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

function truncateTipMessage(message, max = 90) {
  if (!message || message.length <= max) {
    return message || "";
  }
  return `${message.slice(0, max).trimEnd()}...`;
}

function resolveTipRecipientLabel(tip) {
  const recipientId = String(tip?.recipientId || "").trim();
  if (!recipientId) {
    return "Todos";
  }
  if (recipientId === state.session?.id) {
    return state.session?.name || "Usuario";
  }
  const profile = state.profiles.find((item) => item.id === recipientId);
  return profile?.name || "Usuario";
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
    state.session = {
      id: profile.id,
      name: profile.name,
      role: normalizeRole(profile.role),
      email: profile.email || "",
      phone: profile.phone || "",
      address: profile.address || "",
      photoUrl: profile.photo_url || ""
    };
    await uploadPendingProfilePhoto(session.user);
    await fetchRooms();
    await fetchStudents();
    await fetchCheckins();
    if (canAccessManagementPanel() || isEquipe()) {
      await fetchProfiles();
    }
    await fetchDashboardData();
    normalizeStudents();
    ensureDefaultActivePanel();
    if (canAccessManagementPanel()) {
      startGoogleSheetWatcher();
    } else {
      stopGoogleSheetWatcher();
    }
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
  if (metadata.invite_token) {
    const inviteResult = await acceptInviteToken(metadata.invite_token, user.email || "", role);
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
  const studentIds = rows.map((student) => student.id).filter(Boolean);
  const guardianLinkMap = new Map();
  if (studentIds.length) {
    const { data: links, error: linksError } = await supabaseClient
      .from("student_guardians")
      .select("student_id,guardian_id")
      .in("student_id", studentIds);
    if (linksError) {
      console.warn("Falha ao buscar vinculos student_guardians", linksError);
    } else {
      (links || []).forEach((item) => {
        if (item?.student_id && item?.guardian_id && !guardianLinkMap.has(item.student_id)) {
          guardianLinkMap.set(item.student_id, item.guardian_id);
        }
      });
    }
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
    guardianProfileId: guardianLinkMap.get(student.id) || "",
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
  const visibleRoomIds = new Set(visibleRooms.map((room) => room.id));
  state.ui.selectedRoomIds = (state.ui.selectedRoomIds || []).filter((id) => visibleRoomIds.has(id));
  const selectedSet = new Set(state.ui.selectedRoomIds || []);

  els.btnCreateRoom.disabled = !canManageRoom;
  if (els.selectAllRooms) {
    els.selectAllRooms.checked = Boolean(visibleRooms.length) && visibleRooms.every((room) => selectedSet.has(room.id));
    els.selectAllRooms.disabled = !canManageRoom || !visibleRooms.length;
  }
  if (els.btnBulkEditRooms) {
    els.btnBulkEditRooms.disabled = !canManageRoom || !selectedSet.size;
  }
  if (els.btnBulkDeleteRooms) {
    els.btnBulkDeleteRooms.disabled = !canManageRoom || !selectedSet.size;
  }
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
      ${
        canManageRoom
          ? `<label class="field checkbox-field"><span>Selecionar</span><input type="checkbox" data-select-room="${room.id}" ${selectedSet.has(room.id) ? "checked" : ""} /></label>`
          : ""
      }
      <strong>${room.date} ${room.startTime || ""}${room.endTime ? ` - ${room.endTime}` : ""} - ${room.name}</strong>
      <span class="muted">Turma: ${room.classTarget || "-"} | Status: ${room.status}</span>
      <span class="muted">Abertura: ${room.openedAt || "-"} | Fechamento: ${room.closedAt || "-"}</span>
    `;
    item.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest("input[type='checkbox']") || target.closest("label"))) {
        return;
      }
      openRoomDetails(room.id);
    });
    const roomCheckbox = item.querySelector("input[data-select-room]");
    roomCheckbox?.addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      const current = new Set(state.ui.selectedRoomIds || []);
      if (input.checked) {
        current.add(room.id);
      } else {
        current.delete(room.id);
      }
      state.ui.selectedRoomIds = Array.from(current);
      renderRooms();
    });
    els.roomList.appendChild(item);
  });
}

function handleSelectAllRoomsInList(event) {
  const checked = Boolean(event?.target?.checked);
  const visibleRooms = state.rooms.filter((room) => room.status !== "Fechada");
  state.ui.selectedRoomIds = checked ? visibleRooms.map((room) => room.id) : [];
  renderRooms();
}

function getSelectedRoomIdsInList() {
  const selected = new Set(state.ui.selectedRoomIds || []);
  return state.rooms
    .filter((room) => room.status !== "Fechada" && selected.has(room.id))
    .map((room) => room.id);
}

async function handleBulkEditRooms() {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem editar salas.");
    return;
  }
  const ids = getSelectedRoomIdsInList();
  if (!ids.length) {
    alert("Selecione ao menos uma sala.");
    return;
  }
  const name = String(els.roomName?.value || "").trim();
  const dateIso = String(els.roomDate?.value || "").trim();
  const startTime = String(els.roomStartTime?.value || "").trim();
  const endTime = String(els.roomEndTime?.value || "").trim();
  const classTarget = String(els.roomClass?.value || "").trim();
  if (!name && !dateIso && !startTime && !endTime && !classTarget) {
    alert("Preencha ao menos um campo do formulario de sala para editar em massa.");
    return;
  }
  if (startTime && endTime && endTime <= startTime) {
    alert("Horario de termino deve ser maior que o horario de inicio.");
    return;
  }
  if (!confirm(`Aplicar alteracoes em ${ids.length} sala(s) selecionada(s)?`)) {
    return;
  }

  if (supabaseClient) {
    for (const roomId of ids) {
      const current = state.rooms.find((item) => item.id === roomId);
      if (!current) {
        continue;
      }
      const currentDateIso =
        current.dateIso ||
        (() => {
          const parsed = parseRoomDate(current.date);
          if (!parsed) return "";
          return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
        })();
      const nextStart = startTime || current.startTime || current.time || "";
      const nextEnd = endTime || current.endTime || "";
      if (nextStart && nextEnd && nextEnd <= nextStart) {
        continue;
      }
      const updatePayload = {};
      if (name) updatePayload.name = name;
      if (dateIso) updatePayload.date = dateIso;
      if (startTime) {
        updatePayload.time = startTime;
        updatePayload.start_time = startTime;
      }
      if (endTime) updatePayload.end_time = endTime;
      if (classTarget) updatePayload.class_target = classTarget;
      if (!Object.keys(updatePayload).length) {
        continue;
      }
      const { error } = await supabaseClient.from("rooms").update(updatePayload).eq("id", roomId);
      if (error) {
        alert(`Falha ao editar sala em massa: ${error.message || "erro inesperado"}`);
        return;
      }
      if (!dateIso && !updatePayload.date && currentDateIso) {
        updatePayload.date = currentDateIso;
      }
    }
    await fetchRooms();
  } else {
    ids.forEach((roomId) => {
      const room = state.rooms.find((item) => item.id === roomId);
      if (!room) {
        return;
      }
      if (name) room.name = name;
      if (dateIso) {
        room.dateIso = dateIso;
        const parsed = parseInputDate(dateIso);
        if (parsed) {
          room.date = formatDate(parsed);
        }
      }
      if (startTime) {
        room.time = startTime;
        room.startTime = startTime;
      }
      if (endTime) {
        room.endTime = endTime;
      }
      if (classTarget) {
        room.classTarget = classTarget;
      }
    });
  }
  state.ui.selectedRoomIds = [];
  if (els.selectAllRooms) {
    els.selectAllRooms.checked = false;
  }
  render();
  alert("Edicao em massa concluida.");
}

async function handleBulkDeleteRooms() {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem excluir salas.");
    return;
  }
  const ids = getSelectedRoomIdsInList();
  if (!ids.length) {
    alert("Selecione ao menos uma sala.");
    return;
  }
  if (!confirm(`Excluir ${ids.length} sala(s) selecionada(s)?`)) {
    return;
  }
  if (!confirm("Confirmacao final: deseja realmente excluir em massa?")) {
    return;
  }

  for (const roomId of ids) {
    await deleteRoom(roomId, { skipConfirm: true });
  }
  state.ui.selectedRoomIds = [];
  if (els.selectAllRooms) {
    els.selectAllRooms.checked = false;
  }
  render();
}

async function fetchProfiles() {
  if (!supabaseClient || !state.session || !(canAccessManagementPanel() || isEquipe())) {
    state.profiles = [];
    return;
  }
  const attempts = [
    "id,name,nome,role,email,phone,address",
    "id,name,role,email,phone,address",
    "id,nome,role,email,phone,address",
    "id,name,nome,role,email",
    "id,name,role,email",
    "id,nome,role,email"
  ];
  let data = null;
  let error = null;
  for (const columns of attempts) {
    const result = await supabaseClient.from("profiles").select(columns);
    data = result.data;
    error = result.error;
    if (!error) {
      break;
    }
  }
  if (error) {
    console.warn("Falha ao buscar perfis", error);
    state.profiles = [];
    return;
  }
  state.profiles = (data || []).map((profile) => ({
    id: profile.id,
    name: profile.name || profile.nome || "Usuario",
    role: normalizeRole(profile.role),
    email: profile.email || "",
    phone: profile.phone || "",
    address: profile.address || ""
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
      createdAt: tip.created_at || new Date().toISOString(),
      createdBy: tip.created_by || "",
      senderName: tip.sender_name || ""
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
    const contact = getResponsibleContactForStudent(student);
    const birthLabel = formatBirthDateShort(student.birth) || "-";
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
      <span class="muted">Nascimento: ${birthLabel} | Observacoes: ${observationText}</span>
      <span class="muted">Telefone do responsavel: ${contact.phone || "-"}</span>
      <span class="muted">Endereco do responsavel: ${contact.address || "-"}</span>
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
    !els.dashboardAlerts ||
    !els.dashboardAttention ||
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

  const alerts = [];
  const openRooms = state.rooms.filter((room) => room.status === "Aberta");
  const roomsWithoutTime = state.rooms.filter(
    (room) => room.status !== "Fechada" && (!room.startTime || !room.endTime)
  );
  const todayCheckinStudentIds = new Set(
    (state.checkins || [])
      .filter((checkin) => String(checkin.dateTime || "").startsWith(today))
      .map((checkin) => checkin.studentId)
  );
  const neuroStudents = state.students.filter((student) => {
    return hasNeuroatypicalCondition(student.notes) && todayCheckinStudentIds.has(student.id);
  });

  if (openRooms.length) {
    alerts.push(`${openRooms.length} sala(s) aberta(s) neste momento.`);
  }
  if (roomsWithoutTime.length) {
    alerts.push(`${roomsWithoutTime.length} evento(s) sem horario completo (inicio/fim).`);
  }
  const alertsLine = alerts.length ? `${alerts.join("<br />")}<br />` : "";
  const infoText = state.dashboardInfo || "Nenhuma informacao cadastrada.";
  const neuroExpanded = Boolean(state.ui.dashboardNeuroExpanded);
  const neuroSummaryHtml = neuroStudents.length
    ? `<button type="button" id="btnDashboardNeuroList" class="link-button">Criancas neuroatipicas ${neuroStudents.length}</button>`
    : "";
  const neuroListHtml =
    neuroStudents.length && neuroExpanded
      ? `<div class="list" style="margin-top:8px">
          ${neuroStudents
            .map(
              (student) =>
                `<button type="button" class="ghost" data-dashboard-neuro-student="${student.id}" style="text-align:left;justify-content:flex-start">${student.name}</button>`
            )
            .join("")}
        </div>`
      : "";
  els.dashboardAlerts.innerHTML = `
    <strong>Informacoes</strong><br />
    ${infoText}<br />
    ${alertsLine}
  `;
  els.dashboardAttention.innerHTML = `
    <strong>Atencao:</strong><br />
    ${neuroSummaryHtml}
    ${neuroListHtml}
  `;
  document.getElementById("btnDashboardNeuroList")?.addEventListener("click", () => {
    state.ui.dashboardNeuroExpanded = !state.ui.dashboardNeuroExpanded;
    renderDashboard();
  });
  document.querySelectorAll("[data-dashboard-neuro-student]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-dashboard-neuro-student");
      const student = state.students.find((item) => item.id === id);
      if (student) {
        openStudentDetailsDialog(student);
      }
    });
  });

  const groupedSchedules = getGroupedScheduleByDate();
  const upcomingGroups = groupedSchedules.filter((group) => {
    const dateObj = parseInputDate(group.date);
    if (!dateObj) {
      return false;
    }
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return dateObj >= dayStart;
  });
  if (!upcomingGroups.length) {
    els.dashboardSchedules.innerHTML = `<div class="summary">Sem escalas futuras cadastradas.</div>`;
  } else {
    const expandedSet = new Set(state.ui.expandedScheduleDates || []);
    els.dashboardSchedules.innerHTML = upcomingGroups
      .slice(0, 12)
      .map((group) => {
        const dateObj = parseInputDate(group.date);
        const dateLabel = dateObj ? formatDate(dateObj) : group.date;
        const expanded = expandedSet.has(group.date);
        const coord = group.roles.COORDENACAO?.length ? group.roles.COORDENACAO.join(", ") : "-";
        const detailsHtml = expanded
          ? `
            <div class="summary" style="margin-top:8px">
              <strong>Coordenador:</strong> ${coord}<br />
              <strong>Maternal:</strong> ${(group.roles.MATERNAL || []).join(", ") || "-"}<br />
              <strong>Kids:</strong> ${(group.roles.KIDS || []).join(", ") || "-"}<br />
              <strong>Juniors:</strong> ${(group.roles.JUNIORS || []).join(", ") || "-"}<br />
              <strong>Teens:</strong> ${(group.roles.TEENS || []).join(", ") || "-"}<br />
              <strong>Check-in:</strong> ${(group.roles.CHECK_IN || []).join(", ") || "-"}
            </div>
          `
          : "";
        return `
          <div class="list-item">
            <button type="button" class="tip-message-preview" data-schedule-date="${group.date}">
              <strong>${dateLabel}</strong> - Coordenador: ${coord}
            </button>
            ${detailsHtml}
          </div>
        `;
      })
      .join("");
    document.querySelectorAll("[data-schedule-date]").forEach((button) => {
      button.addEventListener("click", () => {
        const date = button.getAttribute("data-schedule-date");
        const current = new Set(state.ui.expandedScheduleDates || []);
        if (current.has(date)) {
          current.delete(date);
        } else {
          current.add(date);
        }
        state.ui.expandedScheduleDates = Array.from(current);
        renderDashboard();
      });
    });
  }

  const todayGroup = groupedSchedules.find((group) => {
    const dateObj = parseInputDate(group.date);
    const todayObj = parseRoomDate(today);
    return Boolean(dateObj && todayObj && dateObj.getTime() === todayObj.getTime());
  });
  if (!todayGroup) {
    els.dashboardLessonToday.innerHTML = `
      <strong>Escala de hoje</strong><br />
      Sem escala cadastrada para hoje.
    `;
  } else {
    const coord = todayGroup.roles.COORDENACAO?.length ? todayGroup.roles.COORDENACAO.join(", ") : "-";
    els.dashboardLessonToday.innerHTML = `
      <strong>Escala de hoje</strong><br />
      Coordenador: ${coord}<br />
      Maternal: ${(todayGroup.roles.MATERNAL || []).join(", ") || "-"}<br />
      Kids: ${(todayGroup.roles.KIDS || []).join(", ") || "-"}<br />
      Juniors: ${(todayGroup.roles.JUNIORS || []).join(", ") || "-"}<br />
      Teens: ${(todayGroup.roles.TEENS || []).join(", ") || "-"}
    `;
  }

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

function getGroupedScheduleByDate() {
  const map = new Map();
  (state.schedules || []).forEach((item) => {
    const date = String(item.date || "").trim();
    if (!date) {
      return;
    }
    const role = extractScheduleRole(item);
    const assignee = String(item.targetUser || "").trim() || String(item.lessonTheme || "").trim();
    if (!map.has(date)) {
      map.set(date, {
        date,
        roles: {
          COORDENACAO: [],
          CHECK_IN: [],
          MATERNAL: [],
          KIDS: [],
          JUNIORS: [],
          TEENS: [],
          OUTROS: []
        }
      });
    }
    const entry = map.get(date);
    const bucket = entry.roles[role] ? role : "OUTROS";
    if (assignee && !entry.roles[bucket].includes(assignee)) {
      entry.roles[bucket].push(assignee);
    }
  });
  return Array.from(map.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function extractScheduleRole(item) {
  const details = normalizeMatchText(item?.details || "").toUpperCase();
  const lesson = normalizeMatchText(item?.lessonTheme || "").toUpperCase().replace(/^ESCALA\s+/, "");
  const source = `${details} ${lesson}`;
  if (source.includes("COORDENACAO")) return "COORDENACAO";
  if (source.includes("CHECK IN") || source.includes("CHECK-IN") || source.includes("CHECKIN")) return "CHECK_IN";
  if (source.includes("MATERNAL")) return "MATERNAL";
  if (source.includes("KIDS")) return "KIDS";
  if (source.includes("JUNIORS")) return "JUNIORS";
  if (source.includes("TEENS")) return "TEENS";
  return "OUTROS";
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
}

function renderRoleVisibility() {
  const session = state.session;
  const dashboardCard = document.getElementById("dashboardCard");
  const roomCard = document.getElementById("roomCard");
  const studentCard = document.getElementById("studentCard");
  const familiesCard = document.getElementById("familiesCard");
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
    if (familiesCard) {
      familiesCard.style.display = "none";
    }
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
    if (familiesCard) {
      familiesCard.style.display = "none";
    }
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
    if (familiesCard) {
      familiesCard.style.display = "none";
    }
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
    if (familiesCard) {
      familiesCard.style.display = "none";
    }
    logCard.style.display = "none";
    if (inviteCard) {
      inviteCard.style.display = "flex";
    }
    return;
  }
  if (activePanel === "families" && (isAdmin() || isEquipe())) {
    if (dashboardCard) {
      dashboardCard.style.display = "none";
    }
    roomCard.style.display = "none";
    studentCard.style.display = "none";
    if (familiesCard) {
      familiesCard.style.display = "flex";
    }
    logCard.style.display = "none";
    if (inviteCard) {
      inviteCard.style.display = "none";
    }
    return;
  }
  if (dashboardCard) {
    dashboardCard.style.display = activePanel === "dashboard" ? "flex" : "none";
  }
  roomCard.style.display = activePanel === "rooms" ? "flex" : "none";
  studentCard.style.display = activePanel === "students" ? "flex" : "none";
  if (familiesCard) {
    familiesCard.style.display = "none";
  }
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

function loadScheduleSheetConfig() {
  try {
    const raw = localStorage.getItem(SCHEDULE_SHEET_CONFIG_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      url: String(parsed?.url || ""),
      spreadsheetId: String(parsed?.spreadsheetId || ""),
      lastHash: String(parsed?.lastHash || ""),
      lastCheckedAt: String(parsed?.lastCheckedAt || ""),
      lastSyncedAt: String(parsed?.lastSyncedAt || "")
    };
  } catch (err) {
    return { url: "", spreadsheetId: "", lastHash: "", lastCheckedAt: "", lastSyncedAt: "" };
  }
}

function saveScheduleSheetConfig() {
  try {
    localStorage.setItem(SCHEDULE_SHEET_CONFIG_KEY, JSON.stringify(scheduleSheetContext.config || {}));
  } catch (err) {
    console.warn("Falha ao salvar configuracao da planilha", err);
  }
}

function renderScheduleSheetSyncStatus(message = "") {
  if (!els.scheduleSheetSyncStatus) {
    return;
  }
  if (message) {
    els.scheduleSheetSyncStatus.textContent = message;
    return;
  }
  const checked = scheduleSheetContext.config.lastCheckedAt
    ? formatDateTimeFromIso(scheduleSheetContext.config.lastCheckedAt)
    : "-";
  const synced = scheduleSheetContext.config.lastSyncedAt
    ? formatDateTimeFromIso(scheduleSheetContext.config.lastSyncedAt)
    : "-";
  const hasLink = scheduleSheetContext.config.spreadsheetId ? "Sim" : "Nao";
  els.scheduleSheetSyncStatus.textContent = `Link configurado: ${hasLink} | Ultima verificacao: ${checked} | Ultima sincronizacao: ${synced}`;
}

function extractSpreadsheetIdFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return "";
  }
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
  return match?.[1] || "";
}

function saveScheduleSheetUrl() {
  if (!state.session || !canAccessManagementPanel()) {
    return;
  }
  const input = String(els.scheduleSheetUrl?.value || "").trim();
  const spreadsheetId = extractSpreadsheetIdFromUrl(input);
  if (!spreadsheetId) {
    alert("Link invalido. Cole o link completo da planilha Google.");
    return;
  }
  scheduleSheetContext.config.url = input;
  scheduleSheetContext.config.spreadsheetId = spreadsheetId;
  saveScheduleSheetConfig();
  if (els.btnSyncScheduleSheet) {
    els.btnSyncScheduleSheet.disabled = false;
  }
  renderScheduleSheetSyncStatus("Link da planilha salvo.");
  startGoogleSheetWatcher();
}

function startGoogleSheetWatcher() {
  if (!state.session || !canAccessManagementPanel() || !supabaseClient) {
    stopGoogleSheetWatcher();
    return;
  }
  if (!scheduleSheetContext.config.spreadsheetId) {
    stopGoogleSheetWatcher();
    return;
  }
  if (!scheduleSheetContext.timerId) {
    syncSchedulesFromGoogleSheet({ manual: false, silentNoChanges: true });
    scheduleSheetContext.timerId = window.setInterval(() => {
      syncSchedulesFromGoogleSheet({ manual: false, silentNoChanges: true });
    }, SHEET_SYNC_INTERVAL_MS);
  }
}

function stopGoogleSheetWatcher() {
  if (scheduleSheetContext.timerId) {
    clearInterval(scheduleSheetContext.timerId);
    scheduleSheetContext.timerId = null;
  }
}

async function syncSchedulesFromGoogleSheet(options = {}) {
  const manual = options.manual === true;
  const silentNoChanges = options.silentNoChanges === true;
  if (!state.session || !canAccessManagementPanel()) {
    return;
  }
  if (!supabaseClient) {
    if (manual) {
      alert("Sincronizacao automatica requer Supabase conectado.");
    }
    return;
  }
  const spreadsheetId = scheduleSheetContext.config.spreadsheetId;
  if (!spreadsheetId) {
    if (manual) {
      alert("Salve primeiro o link da planilha Google.");
    }
    return;
  }
  if (!window.XLSX) {
    if (manual) {
      alert("Biblioteca XLSX indisponivel.");
    }
    return;
  }
  if (scheduleSheetContext.inProgress) {
    return;
  }
  scheduleSheetContext.inProgress = true;
  if (els.btnSyncScheduleSheet) {
    els.btnSyncScheduleSheet.disabled = true;
  }
  try {
    renderScheduleSheetSyncStatus("Verificando alteracoes da planilha...");
    const workbook = await fetchGoogleSheetWorkbook(spreadsheetId);
    const payload = extractScheduleRowsFromGridWorkbook(workbook);
    if (!payload.length) {
      throw new Error("Nenhuma linha valida encontrada na planilha.");
    }
    const hash = hashSchedulePayload(payload);
    const nowIso = new Date().toISOString();
    scheduleSheetContext.config.lastCheckedAt = nowIso;
    if (hash === scheduleSheetContext.config.lastHash) {
      saveScheduleSheetConfig();
      if (manual && !silentNoChanges) {
        alert("Nenhuma alteracao detectada na planilha.");
      }
      renderScheduleSheetSyncStatus("Sem alteracoes detectadas.");
      return;
    }

    const removeResult = await supabaseClient.from("schedules").delete().like("details", `${AUTO_SHEET_DETAILS_PREFIX}%`);
    if (removeResult.error) {
      throw new Error(removeResult.error.message || "Falha ao limpar escalas sincronizadas anteriores.");
    }
    const insertPayload = payload.map((row) => ({
      date: row.date,
      profile_id: row.profileId || null,
      target_user: row.targetUser || null,
      lesson_theme: row.lessonTheme,
      details: row.details || "",
      created_by: state.session.id
    }));
    const { error: insertError } = await supabaseClient.from("schedules").insert(insertPayload);
    if (insertError) {
      throw new Error(insertError.message || "Falha ao inserir escalas sincronizadas.");
    }

    scheduleSheetContext.config.lastHash = hash;
    scheduleSheetContext.config.lastSyncedAt = nowIso;
    saveScheduleSheetConfig();
    await fetchDashboardData();
    render();
    if (manual) {
      alert(`Sincronizacao concluida: ${payload.length} escala(s) atualizada(s).`);
    }
    renderScheduleSheetSyncStatus(`Sincronizacao concluida: ${payload.length} escala(s).`);
  } catch (err) {
    const message = err?.message || "Falha ao sincronizar planilha.";
    renderScheduleSheetSyncStatus(`Erro na sincronizacao: ${message}`);
    if (manual) {
      alert(`Falha na sincronizacao: ${message}`);
    } else {
      console.warn("Falha na sincronizacao automatica de escalas", err);
    }
  } finally {
    scheduleSheetContext.inProgress = false;
    if (els.btnSyncScheduleSheet) {
      els.btnSyncScheduleSheet.disabled = false;
    }
  }
}

async function fetchGoogleSheetWorkbook(spreadsheetId) {
  const id = String(spreadsheetId || "").trim();
  if (!id) {
    throw new Error("ID da planilha invalido.");
  }
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Nao foi possivel acessar a planilha (HTTP ${response.status}). Verifique compartilhamento publico.`);
  }
  const bytes = await response.arrayBuffer();
  return window.XLSX.read(bytes, { type: "array" });
}

function extractScheduleRowsFromGridWorkbook(workbook) {
  const roles = ["COORDENACAO", "CHECK IN", "MATERNAL", "KIDS", "JUNIORS", "TEENS"];
  const monthMap = {
    JANEIRO: 1,
    FEVEREIRO: 2,
    MARCO: 3,
    ABRIL: 4,
    MAIO: 5,
    JUNHO: 6,
    JULHO: 7,
    AGOSTO: 8,
    SETEMBRO: 9,
    OUTUBRO: 10,
    NOVEMBRO: 11,
    DEZEMBRO: 12
  };
  const allRows = [];
  const dedupe = new Set();
  (workbook?.SheetNames || []).forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return;
    }
    const data = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
    const parsedYear = parseYearFromSheetName(sheetName);
    let currentMonth = 0;
    let monthLabel = "";
    let roleCols = [];
    data.forEach((row) => {
      const first = normalizeMatchText(row?.[0] || "").toUpperCase();
      const monthMatch = first.match(/ESCALA\s+MES\s+DE\s+([A-ZC]+)/);
      if (monthMatch) {
        monthLabel = monthMatch[1] || "";
        currentMonth = monthMap[monthLabel] || 0;
        roleCols = [];
        return;
      }

      const normalizedCells = row.map((cell) => normalizeMatchText(cell).toUpperCase());
      const hasHeader = normalizedCells.some((cell) => roles.includes(cell));
      if (hasHeader) {
        roleCols = normalizedCells
          .map((cell, index) => ({ cell, index }))
          .filter((entry) => roles.includes(entry.cell))
          .map((entry) => ({ index: entry.index, role: entry.cell }));
        return;
      }

      if (!currentMonth || !roleCols.length) {
        return;
      }
      const weekMatch = first.match(/(\d+).*(DOMINGO)/);
      if (!weekMatch) {
        return;
      }
      const weekNumber = Number.parseInt(weekMatch[1], 10);
      if (!Number.isFinite(weekNumber) || weekNumber < 1 || weekNumber > 5) {
        return;
      }
      const date = getNthSundayDateIso(parsedYear, currentMonth, weekNumber);
      if (!date) {
        return;
      }

      roleCols.forEach((entry) => {
        const rawCell = row?.[entry.index] ?? "";
        const names = splitScaleNames(rawCell);
        names.forEach((name) => {
          const matchedProfile = findProfileByUserToken(name);
          const lessonTheme = `Escala ${entry.role}`;
          const details = `${AUTO_SHEET_DETAILS_PREFIX} ${sheetName} | ${weekNumber} DOMINGO | ${monthLabel} | ${entry.role}`;
          const key = `${date}|${entry.role}|${name.toLowerCase()}`;
          if (dedupe.has(key)) {
            return;
          }
          dedupe.add(key);
          allRows.push({
            date,
            lessonTheme,
            details,
            profileId: matchedProfile?.id || "",
            targetUser: name
          });
        });
      });
    });
  });
  return allRows;
}

function parseYearFromSheetName(name) {
  const match = String(name || "").match(/(\d{2,4})/);
  const rawYear = Number.parseInt(match?.[1] || "", 10);
  if (!Number.isFinite(rawYear)) {
    return new Date().getFullYear();
  }
  if (rawYear < 100) {
    return 2000 + rawYear;
  }
  return rawYear;
}

function getNthSundayDateIso(year, month, nth) {
  if (!year || !month || !nth) {
    return "";
  }
  let count = 0;
  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1) {
      break;
    }
    if (date.getDay() === 0) {
      count += 1;
      if (count === nth) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
  }
  return "";
}

function splitScaleNames(value) {
  const raw = String(value || "")
    .replace(/System\.Xml\.XmlElement/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) {
    return [];
  }
  const normalized = raw.replace(/\s+e\s+/gi, ";").replace(/&/g, ";");
  return normalized
    .split(/[;,\/\n]/)
    .map((item) => item.trim())
    .filter((item) => item && item !== "-" && item.length > 1);
}

function hashSchedulePayload(rows) {
  const key = (rows || [])
    .map((item) => `${item.date}|${item.targetUser}|${item.lessonTheme}|${item.details}`)
    .sort()
    .join("||");
  return simpleHash(key);
}

function simpleHash(input) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16)}${(h1 >>> 0).toString(16)}`;
}

async function sendTipMessage() {
  if (!state.session || !canAccessManagementPanel()) {
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
      created_by: state.session.id,
      sender_name: state.session?.name || ""
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
      createdAt: new Date().toISOString(),
      createdBy: state.session?.id || "",
      senderName: state.session?.name || ""
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

function hasNeuroatypicalCondition(notes) {
  const value = normalizeMatchText(notes);
  return /neuro|tea|tdah|autis|asperger|espectro/.test(value);
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
  stopGoogleSheetWatcher();
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
    expandedScheduleDates: [],
    selectedManageUserId: "",
    selectedRoomIds: [],
    logSelectedStudentIds: [],
    dashboardNeuroExpanded: false,
    generatedInviteLink: ""
  };
  render();
}

async function handleInviteQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("invite");
  if (!token) {
    return;
  }
  let inviteRole = "dnms_kids";
  if (supabaseClient) {
    const meta = await getInviteMeta(token);
    if (!meta.ok) {
      alert(meta.message || "Convite invalido.");
      return;
    }
    inviteRole = meta.role || "dnms_kids";
  }
  openSignupDialog(inviteRole, token);
}

function openSignupDialog(role, inviteToken = "") {
  signupContext.role = role;
  signupContext.inviteToken = inviteToken || "";
  const isInvite = Boolean(signupContext.inviteToken);
  const inviteLabel = role === "admin" ? "Admin" : role === "equipe" ? "Equipe" : "DNMS Kids";
  if (els.signupDialogTitle) {
    els.signupDialogTitle.textContent = isInvite ? `Cadastro por convite (${inviteLabel})` : "Cadastro de Responsavel";
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

function resetSignupDialogDraft() {
  if (els.signupName) els.signupName.value = "";
  if (els.signupPhoto) els.signupPhoto.value = "";
  if (els.signupBirth) els.signupBirth.value = "";
  if (els.signupCivilStatus) els.signupCivilStatus.value = "";
  if (els.signupPhoneDdd) els.signupPhoneDdd.value = "21";
  if (els.signupPhone) els.signupPhone.value = "";
  if (els.signupEmail) els.signupEmail.value = "";
  if (els.signupPassword) els.signupPassword.value = "";
  if (els.signupIsVisitor) els.signupIsVisitor.checked = false;
  setPhotoPreviewUrl(els.signupPhotoPreview, "");
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
  const isInviteFlow = Boolean(signupContext.inviteToken);
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
  if (!confirm("Confirma salvar o cadastro?")) {
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
    const inviteValid = await verifyInviteToken(signupContext.inviteToken, email, signupContext.role);
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

function openForgotPasswordDialog() {
  const email = (els.loginEmail?.value || "").trim();
  if (els.forgotPasswordEmail) {
    els.forgotPasswordEmail.value = email;
  }
  els.forgotPasswordDialog?.showModal();
}

async function handleSendPasswordResetEmail(event) {
  event.preventDefault();
  if (!supabaseClient) {
    alert("Supabase nao configurado.");
    return;
  }
  const email = (els.forgotPasswordEmail?.value || "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    alert("Informe um email valido.");
    return;
  }
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    alert(`Falha ao enviar link de redefinicao: ${error.message || "erro inesperado"}`);
    return;
  }
  els.forgotPasswordDialog?.close();
  alert("Link de redefinicao enviado. Verifique email e spam.");
}

async function maybeOpenPasswordResetDialog() {
  if (!supabaseClient) {
    return;
  }
  const hashValue = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hashValue || "");
  const queryParams = new URLSearchParams(window.location.search || "");
  const type = (hashParams.get("type") || queryParams.get("type") || "").toLowerCase();
  if (type !== "recovery") {
    return;
  }
  if (els.resetPasswordNew) {
    els.resetPasswordNew.value = "";
  }
  if (els.resetPasswordConfirm) {
    els.resetPasswordConfirm.value = "";
  }
  els.resetPasswordDialog?.showModal();
}

async function handleSubmitPasswordReset(event) {
  event.preventDefault();
  if (!supabaseClient) {
    alert("Supabase nao configurado.");
    return;
  }
  const newPassword = els.resetPasswordNew?.value || "";
  const confirmPassword = els.resetPasswordConfirm?.value || "";
  if (newPassword.length < 6) {
    alert("A senha deve ter pelo menos 6 caracteres.");
    return;
  }
  if (newPassword !== confirmPassword) {
    alert("As senhas nao conferem.");
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) {
    alert(`Falha ao redefinir senha: ${error.message || "erro inesperado"}`);
    return;
  }
  els.resetPasswordDialog?.close();
  try {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  } catch (_) {}
  alert("Senha atualizada com sucesso. Faça login com a nova senha.");
}

async function openMyDataDialog() {
  if (!state.session) {
    return;
  }
  let profile = {
    id: state.session.id,
    name: state.session.name || "",
    email: state.session.email || "",
    phone: state.session.phone || "",
    address: state.session.address || "",
    photo_url: state.session.photoUrl || ""
  };
  if (supabaseClient) {
    const remote = await fetchProfile(state.session.id);
    if (remote) {
      profile = {
        ...profile,
        name: remote.name || profile.name,
        email: remote.email || profile.email,
        phone: remote.phone || "",
        address: remote.address || "",
        photo_url: remote.photo_url || ""
      };
    }
  }

  myDataContext.email = profile.email || "";
  myDataContext.name = profile.name || "";
  myDataContext.phone = profile.phone || "";
  myDataContext.address = profile.address || "";
  myDataContext.photoUrl = profile.photo_url || "";

  if (els.myDataName) {
    els.myDataName.value = profile.name || "";
  }
  if (els.myDataEmail) {
    els.myDataEmail.value = profile.email || "";
  }
  if (els.myDataPhone) {
    els.myDataPhone.value = profile.phone || "";
  }
  if (els.myDataAddress) {
    els.myDataAddress.value = profile.address || "";
  }
  if (els.myDataPhoto) {
    els.myDataPhoto.value = "";
  }
  setPhotoPreviewUrl(els.myDataPhotoPreview, profile.photo_url || getStudentPhotoPlaceholderUrl());
  els.myDataDialog?.showModal();
}

function resetMyDataDialogDraft() {
  if (els.myDataName) {
    els.myDataName.value = myDataContext.name || "";
  }
  if (els.myDataEmail) {
    els.myDataEmail.value = myDataContext.email || "";
  }
  if (els.myDataPhone) {
    els.myDataPhone.value = myDataContext.phone || "";
  }
  if (els.myDataAddress) {
    els.myDataAddress.value = myDataContext.address || "";
  }
  if (els.myDataPhoto) {
    els.myDataPhoto.value = "";
  }
  setPhotoPreviewUrl(els.myDataPhotoPreview, myDataContext.photoUrl || getStudentPhotoPlaceholderUrl());
}

async function handleSaveMyData(event) {
  event.preventDefault();
  if (!state.session) {
    return;
  }
  const name = String(els.myDataName?.value || "").trim();
  const email = String(els.myDataEmail?.value || "").trim().toLowerCase();
  const phone = String(els.myDataPhone?.value || "").trim();
  const address = String(els.myDataAddress?.value || "").trim();
  const photoFile = els.myDataPhoto?.files?.[0] || null;
  const nameChanged = name && name !== String(myDataContext.name || "");
  const emailChanged = email && email !== String(myDataContext.email || "").trim().toLowerCase();
  const phoneChanged = phone !== String(myDataContext.phone || "");
  const addressChanged = address !== String(myDataContext.address || "");
  const hasChanges = nameChanged || emailChanged || phoneChanged || addressChanged || Boolean(photoFile);

  if (!hasChanges) {
    els.myDataDialog?.close();
    return;
  }
  if (!name) {
    alert("Informe o nome.");
    return;
  }
  if (!email || !isValidEmail(email)) {
    alert("Informe um email valido.");
    return;
  }
  if (!confirm("Confirma salvar as alteracoes em Meus dados?")) {
    return;
  }

  if (supabaseClient) {
    if (nameChanged || phoneChanged || addressChanged) {
      const { error } = await supabaseClient
        .from("profiles")
        .update({ name, nome: name, phone, address })
        .eq("id", state.session.id);
      if (error) {
        alert(`Falha ao atualizar dados do perfil: ${error.message || "erro inesperado"}`);
        return;
      }
    }

    if (photoFile) {
      const { data: userData, error: userError } = await supabaseClient.auth.getUser();
      if (userError || !userData?.user) {
        alert(`Falha ao carregar usuario para atualizar foto: ${userError?.message || "erro inesperado"}`);
        return;
      }
      const upload = await uploadProfilePhotoForUser(userData.user, photoFile);
      if (!upload.ok) {
        alert(`Falha ao atualizar foto: ${upload.error || "erro inesperado"}`);
        return;
      }
    }

    if (emailChanged) {
      const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await supabaseClient.auth.updateUser({
        email,
        options: { emailRedirectTo }
      });
      if (error) {
        alert(`Falha ao solicitar troca de email: ${error.message || "erro inesperado"}`);
        return;
      }
      alert("Solicitacao enviada. O novo email so sera aplicado apos validacao no link recebido.");
    }

    const refreshed = await fetchProfile(state.session.id);
    if (refreshed) {
      state.session = {
        ...state.session,
        name: refreshed.name || state.session.name,
        email: refreshed.email || state.session.email,
        phone: refreshed.phone || "",
        address: refreshed.address || "",
        photoUrl: refreshed.photo_url || ""
      };
    } else {
      state.session = {
        ...state.session,
        name,
        phone,
        address
      };
    }
    if (canAccessManagementPanel() || isEquipe()) {
      await fetchProfiles();
    }
  } else {
    state.session = { ...state.session, name, email, phone, address };
  }

  els.myDataDialog?.close();
  render();
}

async function getInviteMeta(token) {
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
  const inviteRole = normalizeRole(data.role || "");
  if (!["dnms_kids", "equipe", "admin"].includes(inviteRole)) {
    return { ok: false, message: "Convite invalido para este cadastro." };
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, message: "Convite expirado." };
  }
  return { ok: true, role: inviteRole, data };
}

async function verifyInviteToken(token, email, expectedRole = "") {
  const meta = await getInviteMeta(token);
  if (!meta.ok) {
    return meta;
  }
  const data = meta.data;
  if (data.email && data.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, message: "Este convite pertence a outro email." };
  }
  if (expectedRole) {
    const normalizedExpected = normalizeRole(expectedRole);
    if (normalizedExpected !== normalizeRole(data.role || "")) {
      return { ok: false, message: "Convite invalido para este tipo de acesso." };
    }
  }
  return { ok: true };
}

async function acceptInviteToken(token, email, expectedRole = "") {
  const meta = await getInviteMeta(token);
  if (!meta.ok) {
    return meta;
  }
  const data = meta.data;
  if (data.email && data.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, message: "Este convite pertence a outro email." };
  }
  if (expectedRole) {
    const normalizedExpected = normalizeRole(expectedRole);
    if (normalizedExpected !== normalizeRole(data.role || "")) {
      return { ok: false, message: "Convite invalido para este tipo de acesso." };
    }
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

function getAllowedInviteRoleTargets() {
  if (isSadmin()) {
    return ["equipe", "admin"];
  }
  if (isAdmin()) {
    return ["equipe"];
  }
  return [];
}

function renderManagementInviteControls() {
  const allowedRoles = getAllowedInviteRoleTargets();
  const canInvite = allowedRoles.length > 0;
  if (els.manageInviteRole) {
    const current = normalizeRole(els.manageInviteRole.value || "");
    els.manageInviteRole.innerHTML = allowedRoles
      .map((role) => `<option value="${role}">${formatRole(role)}</option>`)
      .join("");
    if (allowedRoles.includes(current)) {
      els.manageInviteRole.value = current;
    }
    els.manageInviteRole.disabled = !canInvite;
  }
  if (els.manageInviteEmail) {
    els.manageInviteEmail.disabled = !canInvite;
  }
  if (els.btnGenerateInviteLink) {
    els.btnGenerateInviteLink.disabled = !canInvite;
  }
  if (els.btnCopyInviteLink) {
    els.btnCopyInviteLink.disabled = !state.ui.generatedInviteLink;
  }
  if (els.manageInviteStatus && !canInvite) {
    els.manageInviteStatus.textContent = "Sem permissao para gerar convites.";
  }
  if (els.manageInviteLink) {
    els.manageInviteLink.textContent = state.ui.generatedInviteLink || "";
  }
}

async function handleGenerateAccessInviteLink() {
  if (!supabaseClient) {
    alert("Convites disponiveis apenas com Supabase.");
    return;
  }
  if (!state.session || !canAccessManagementPanel()) {
    alert("Sem permissao para gerar convites.");
    return;
  }
  const email = String(els.manageInviteEmail?.value || "").trim().toLowerCase();
  const role = normalizeRole(els.manageInviteRole?.value || "");
  const allowedRoles = getAllowedInviteRoleTargets();
  if (!email || !isValidEmail(email)) {
    alert("Informe um email valido.");
    return;
  }
  if (!allowedRoles.includes(role)) {
    alert("Tipo de acesso invalido para o seu nivel.");
    return;
  }

  const token = uid();
  const inviteUrl = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(token)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseClient.from("invites").insert({
    email,
    role,
    token,
    status: "pending",
    expires_at: expiresAt,
    created_by: state.session?.id || null
  });
  if (error) {
    alert(`Falha ao gerar convite: ${error.message || "erro inesperado"}`);
    return;
  }

  state.ui.generatedInviteLink = inviteUrl;
  if (els.manageInviteStatus) {
    els.manageInviteStatus.textContent = `Convite gerado para ${email} com perfil ${formatRole(role)}.`;
  }
  if (els.manageInviteLink) {
    els.manageInviteLink.textContent = inviteUrl;
  }
  if (els.btnCopyInviteLink) {
    els.btnCopyInviteLink.disabled = false;
  }
  if (els.manageInviteEmail) {
    els.manageInviteEmail.value = "";
  }
}

async function copyGeneratedAccessInviteLink() {
  const link = String(state.ui.generatedInviteLink || "").trim();
  if (!link) {
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    if (els.manageInviteStatus) {
      els.manageInviteStatus.textContent = "Link copiado para a area de transferencia.";
    }
  } catch (_) {
    alert("Nao foi possivel copiar automaticamente. Copie manualmente o link exibido.");
  }
}

function renderManagementPanel() {
  if (!els.manageUsersList || !els.manageUsersStatus || !els.manageUserEditor) {
    return;
  }
  if (!state.session || !canAccessManagementPanel()) {
    stopGoogleSheetWatcher();
    els.manageUsersStatus.textContent = "";
    els.manageUsersList.innerHTML = "";
    els.manageUserEditor.innerHTML = "";
    if (els.scheduleSheetSyncStatus) {
      els.scheduleSheetSyncStatus.textContent = "";
    }
    if (els.manageInviteStatus) {
      els.manageInviteStatus.textContent = "";
    }
    if (els.manageInviteLink) {
      els.manageInviteLink.textContent = "";
    }
    return;
  }

  renderManagementInviteControls();

  if (els.scheduleSheetUrl) {
    els.scheduleSheetUrl.value = scheduleSheetContext.config.url || "";
  }
  if (els.btnSyncScheduleSheet) {
    els.btnSyncScheduleSheet.disabled = !scheduleSheetContext.config.spreadsheetId;
  }
  renderScheduleSheetSyncStatus();
  startGoogleSheetWatcher();

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
  const canChangeName = canManage && (isSadmin() || isAdmin());
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
      <input id="manageSelectedName" type="text" ${canChangeName ? "" : "disabled"} />
      <button id="btnManageSaveName" class="ghost" type="button" ${canChangeName ? "" : "disabled"}>Salvar nome</button>
    </div>
    <div class="actions" style="margin-top:10px">
      <select id="manageSelectedRole" ${canChangeRole ? "" : "disabled"}>
        ${roleOptions}
      </select>
      <button id="btnManageSaveRole" class="primary" type="button" ${canChangeRole ? "" : "disabled"}>Salvar acesso</button>
      <button id="btnManageDeleteUser" class="danger" type="button" ${canDelete ? "" : "disabled"}>Excluir usuario</button>
    </div>
  `;
  const btnSaveRole = document.getElementById("btnManageSaveRole");
  const btnSaveName = document.getElementById("btnManageSaveName");
  const btnDeleteUser = document.getElementById("btnManageDeleteUser");
  const nameInput = document.getElementById("manageSelectedName");
  if (nameInput) {
    nameInput.value = selectedProfile.name || "";
  }
  const roleSelect = document.getElementById("manageSelectedRole");
  btnSaveName?.addEventListener("click", async () => {
    const nextName = String(nameInput?.value || "").trim();
    await updateUserName(selectedProfile, nextName);
  });
  btnSaveRole?.addEventListener("click", async () => {
    const nextRole = normalizeRole(roleSelect?.value || "");
    await updateUserAccess(selectedProfile, nextRole);
  });
  btnDeleteUser?.addEventListener("click", async () => {
    await deleteUserProfile(selectedProfile);
  });
}

function renderFamiliesPanel() {
  if (!els.familiesCard || !els.familyList || !els.familyEditor) {
    return;
  }
  const canAccess = Boolean(state.session) && (isAdmin() || isEquipe()) && getActivePanel() === "families";
  if (!canAccess) {
    return;
  }
  const { search, filtered } = getFilteredFamiliesForCurrentSearch();
  if (els.btnExportFamilies) {
    els.btnExportFamilies.disabled = !filtered.length;
  }
  if (!search) {
    els.familyList.innerHTML = `<div class="summary">Digite um nome, email ou telefone para buscar.</div>`;
    els.familyEditor.innerHTML = "";
    familyContext.selectedProfileId = "";
    return;
  }

  if (!filtered.length) {
    els.familyList.innerHTML = `<div class="summary">Nenhuma familia encontrada.</div>`;
    els.familyEditor.innerHTML = "";
    familyContext.selectedProfileId = "";
    return;
  }

  if (!filtered.some((entry) => entry.profile.id === familyContext.selectedProfileId)) {
    familyContext.selectedProfileId = filtered[0].profile.id;
  }

  els.familyList.innerHTML = "";
  filtered.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `list-item ${familyContext.selectedProfileId === entry.profile.id ? "is-selected" : ""}`;
    item.style.cursor = "pointer";
    item.innerHTML = `
      <strong>${entry.profile.name || "Responsavel"}</strong>
      <span class="muted">${entry.profile.email || "-"}</span>
      <span class="muted">Filhos: ${entry.children.length}</span>
    `;
    item.addEventListener("click", () => {
      familyContext.selectedProfileId = entry.profile.id;
      renderFamiliesPanel();
    });
    els.familyList.appendChild(item);
  });

  const selected = filtered.find((entry) => entry.profile.id === familyContext.selectedProfileId) || null;
  if (!selected) {
    els.familyEditor.innerHTML = "";
    return;
  }
  const canDelete = isSadmin() || isAdmin();
  const assignableStudents = getFamilyAssignableStudents(selected.profile.id, selected.children);
  const assignOptions = assignableStudents
    .map((student) => `<option value="${student.id}">${student.name} - ${student.className || getClassForBirth(student.birth)}</option>`)
    .join("");
  const childrenHtml = selected.children.length
    ? selected.children
        .map(
          (child) => `
      <div class="list-item">
        <strong>${child.name}</strong>
        <span class="muted">Turma: ${child.className || getClassForBirth(child.birth)}</span>
        <div class="actions">
          <button type="button" class="ghost" data-family-edit-child="${child.id}">Editar crianca</button>
          <button type="button" class="primary" data-family-checkin-child="${child.id}">Check-in</button>
        </div>
      </div>
    `
        )
        .join("")
    : `<div class="summary">Nenhuma crianca vinculada.</div>`;

  els.familyEditor.innerHTML = `
    <strong>Responsavel selecionado</strong>
    <label class="field">Nome
      <input id="familyEditName" type="text" value="${selected.profile.name || ""}" />
    </label>
    <label class="field">Email
      <input id="familyEditEmail" type="email" value="${selected.profile.email || ""}" readonly />
    </label>
    <label class="field">Telefone
      <input id="familyEditPhone" type="text" value="${selected.profile.phone || ""}" />
    </label>
    <label class="field">Endereco
      <input id="familyEditAddress" type="text" value="${selected.profile.address || ""}" />
    </label>
    <div class="actions">
      <button id="btnFamilySaveProfile" type="button" class="primary">Salvar responsavel</button>
      <button id="btnFamilyAddChild" type="button" class="ghost">Adicionar crianca</button>
    </div>
    <label class="field">Vincular crianca existente
      <select id="familyAssignStudentId">
        <option value="">Selecione uma crianca</option>
        ${assignOptions}
      </select>
    </label>
    <div class="actions">
      <button id="btnFamilyAssignStudent" type="button" class="ghost">Vincular crianca</button>
    </div>
    <div class="list">${childrenHtml}</div>
    ${
      canDelete
        ? `
      <div class="summary" style="margin-top:10px">
        <strong>Excluir usuario</strong><br />
        Digite o nome para confirmar: <strong>${selected.profile.name || "-"}</strong>
        <label class="field">
          <input id="familyDeleteConfirmName" type="text" placeholder="Digite o nome exatamente" />
        </label>
        <button id="btnFamilyDeleteUser" type="button" class="danger">Excluir usuario</button>
      </div>
    `
        : ""
    }
  `;

  document.getElementById("btnFamilySaveProfile")?.addEventListener("click", async () => {
    await saveFamilyProfile(selected.profile.id);
  });
  document.getElementById("btnFamilyAddChild")?.addEventListener("click", () => {
    openStudentDialogForFamily(selected.profile);
  });
  document.getElementById("btnFamilyAssignStudent")?.addEventListener("click", async () => {
    const studentId = String(document.getElementById("familyAssignStudentId")?.value || "");
    if (!studentId) {
      alert("Selecione uma crianca para vincular.");
      return;
    }
    await assignStudentToFamily(studentId, selected.profile);
  });
  document.querySelectorAll("[data-family-edit-child]").forEach((button) => {
    button.addEventListener("click", () => {
      const childId = button.getAttribute("data-family-edit-child");
      const child = state.students.find((item) => item.id === childId);
      if (child) {
        openStudentDialog(child);
      }
    });
  });
  document.querySelectorAll("[data-family-checkin-child]").forEach((button) => {
    button.addEventListener("click", async () => {
      const childId = button.getAttribute("data-family-checkin-child");
      const result = await handleManualCheckin(childId, { silent: true });
      if (!result.ok) {
        alert(result.message || "Falha ao registrar check-in.");
      } else {
        alert("Check-in registrado.");
      }
    });
  });
  document.getElementById("btnFamilyDeleteUser")?.addEventListener("click", async () => {
    const typed = String(document.getElementById("familyDeleteConfirmName")?.value || "").trim();
    await deleteFamilyUser(selected.profile, typed);
  });
}

function getFamiliesWithChildren() {
  const childrenByGuardian = new Map();
  (state.students || []).forEach((student) => {
    const key = String(student.guardianProfileId || "").trim();
    if (!key) {
      return;
    }
    if (!childrenByGuardian.has(key)) {
      childrenByGuardian.set(key, []);
    }
    childrenByGuardian.get(key).push(student);
  });
  const result = [];
  (state.profiles || []).forEach((profile) => {
    const role = normalizeRole(profile.role);
    const children = childrenByGuardian.get(profile.id) || [];
    const shouldInclude = role === "responsavel" || children.length > 0;
    if (!shouldInclude) {
      return;
    }
    result.push({ profile, children });
  });
  result.sort((a, b) => (a.profile.name || "").localeCompare(b.profile.name || ""));
  return result;
}

function getFilteredFamiliesForCurrentSearch() {
  const families = getFamiliesWithChildren();
  const search = normalizeMatchText(String(els.familySearch?.value || "").trim());
  if (!search) {
    return { search: "", filtered: [] };
  }
  const filtered = families.filter((entry) => {
    const blob = normalizeMatchText(`${entry.profile.name || ""} ${entry.profile.email || ""} ${entry.profile.phone || ""}`);
    return blob.includes(search);
  });
  return { search, filtered };
}

function getFamilyAssignableStudents(profileId, selectedChildren = []) {
  const selectedIds = new Set((selectedChildren || []).map((child) => child.id));
  return (state.students || [])
    .filter((student) => !selectedIds.has(student.id))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

async function saveFamilyProfile(profileId) {
  if (!supabaseClient || !profileId) {
    return;
  }
  const name = String(document.getElementById("familyEditName")?.value || "").trim();
  const phone = String(document.getElementById("familyEditPhone")?.value || "").trim();
  const address = String(document.getElementById("familyEditAddress")?.value || "").trim();
  if (!name) {
    alert("Informe o nome do responsavel.");
    return;
  }
  if (!confirm("Confirma salvar as alteracoes do responsavel?")) {
    return;
  }
  const { error } = await supabaseClient.from("profiles").update({ name, nome: name, phone, address }).eq("id", profileId);
  if (error) {
    alert(`Falha ao salvar responsavel: ${error.message || "erro inesperado"}`);
    return;
  }
  await fetchProfiles();
  render();
}

async function deleteFamilyUser(profile, typedName) {
  if (!profile) {
    return;
  }
  if (!(isSadmin() || isAdmin())) {
    alert("Sem permissao para excluir usuario.");
    return;
  }
  const expected = String(profile.name || "").trim();
  if (!typedName || typedName !== expected) {
    alert("Nome de confirmacao invalido.");
    return;
  }
  if (!confirm(`Confirmacao final: excluir o usuario ${expected}?`)) {
    return;
  }
  await supabaseClient.from("student_guardians").delete().eq("guardian_id", profile.id);
  const { error } = await supabaseClient.from("profiles").delete().eq("id", profile.id);
  if (error) {
    alert(`Falha ao excluir usuario: ${error.message || "erro inesperado"}`);
    return;
  }
  familyContext.selectedProfileId = "";
  await fetchProfiles();
  await fetchStudents();
  render();
  const createdProfile = (state.profiles || []).find((item) => item.id === createdUser.id) || {
    id: createdUser.id,
    name,
    phone,
    email,
    address
  };
  openStudentDialogForFamily(createdProfile);
}

function openStudentDialogForFamily(profile) {
  if (!profile) {
    return;
  }
  openStudentDialog();
  if (els.studentGuardian) {
    els.studentGuardian.value = formatGuardianOption(profile);
  }
  studentDialogContext.guardianProfileId = profile.id;
  if (els.studentGuardianHint) {
    els.studentGuardianHint.textContent = `Usuario selecionado: ${profile.name}`;
  }
}

async function assignStudentToFamily(studentId, profile) {
  if (!studentId || !profile?.id) {
    return;
  }
  const student = (state.students || []).find((item) => item.id === studentId);
  if (!student) {
    alert("Crianca nao encontrada.");
    return;
  }
  if (!confirm(`Vincular ${student.name} ao responsavel ${profile.name}?`)) {
    return;
  }

  if (supabaseClient) {
    const updatePayload = {
      primary_guardian_name: profile.name || student.guardian || ""
    };
    const { error: updateError } = await supabaseClient.from("students").update(updatePayload).eq("id", student.id);
    if (updateError) {
      alert(`Falha ao atualizar crianca: ${updateError.message || "erro inesperado"}`);
      return;
    }
    const linked = await linkGuardianToStudent(student.id, profile.name || "", profile.id);
    if (!linked) {
      alert("Falha ao vincular crianca ao responsavel selecionado.");
      return;
    }
    await fetchStudents();
  } else {
    const index = state.students.findIndex((item) => item.id === student.id);
    if (index >= 0) {
      state.students[index] = {
        ...state.students[index],
        guardian: profile.name || state.students[index].guardian,
        guardianProfileId: profile.id
      };
    }
  }
  familyContext.selectedProfileId = profile.id;
  render();
}

function clearFamilyCreateForm() {
  if (els.familyCreateName) els.familyCreateName.value = "";
  if (els.familyCreateBirth) els.familyCreateBirth.value = "";
  if (els.familyCreateCivil) els.familyCreateCivil.value = "";
  if (els.familyCreatePhone) els.familyCreatePhone.value = "";
  if (els.familyCreateEmail) els.familyCreateEmail.value = "";
  if (els.familyCreateAddress) els.familyCreateAddress.value = "";
  if (els.familyCreateStatus) els.familyCreateStatus.textContent = "";
}

async function handleCreateFamilyResponsible() {
  if (!supabaseClient || !(isAdmin() || isEquipe())) {
    return;
  }
  const name = String(els.familyCreateName?.value || "").trim();
  const birthRaw = String(els.familyCreateBirth?.value || "").trim();
  const birthDate = normalizeBirthDateInput(birthRaw);
  const civilStatus = String(els.familyCreateCivil?.value || "").trim();
  const phoneDigits = String(els.familyCreatePhone?.value || "").replace(/\D/g, "");
  const normalizedPhoneDigits = phoneDigits.startsWith("55") ? phoneDigits.slice(2) : phoneDigits;
  const phoneDdd = normalizedPhoneDigits.slice(0, 2);
  const phoneNumber = normalizedPhoneDigits.slice(2);
  const phone = phoneDdd && phoneNumber ? `+55(${phoneDdd})${phoneNumber}` : "";
  const email = String(els.familyCreateEmail?.value || "").trim().toLowerCase();
  const address = String(els.familyCreateAddress?.value || "").trim();
  if (!name || !birthDate || !civilStatus || !phone || !email || !isValidEmail(email)) {
    alert("Preencha os dados obrigatorios do responsavel.");
    return;
  }
  if (phoneDdd.length !== 2 || phoneNumber.length < 8) {
    alert("Informe um celular valido.");
    return;
  }
  if (!confirm(`Confirma cadastrar o responsavel ${name}?`)) {
    return;
  }

  const tempPassword = `Tmp#${uid().slice(0, 10)}A1`;
  const tempClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  if (!tempClient) {
    alert("Cliente Supabase indisponivel.");
    return;
  }
  const signup = await tempClient.auth.signUp({
    email,
    password: tempPassword,
    options: {
      data: {
        full_name: name,
        desired_role: "responsavel",
        birth_date: birthDate,
        marital_status: civilStatus,
        phone
      }
    }
  });
  if (signup.error) {
    alert(`Falha ao cadastrar responsavel: ${signup.error.message || "erro inesperado"}`);
    return;
  }
  const createdUser = signup.data?.user;
  if (!createdUser?.id) {
    alert("Nao foi possivel concluir cadastro do responsavel.");
    return;
  }
  const { error: profileError } = await supabaseClient.from("profiles").upsert({
    id: createdUser.id,
    name,
    nome: name,
    role: "responsavel",
    email,
    birth_date: birthDate,
    marital_status: civilStatus,
    phone,
    address
  });
  if (profileError) {
    alert(`Falha ao salvar perfil do responsavel: ${profileError.message || "erro inesperado"}`);
    return;
  }
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const reset = await tempClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (reset.error) {
    alert(`Responsavel criado, mas falhou o envio de email de senha: ${reset.error.message || "erro inesperado"}`);
    return;
  }
  clearFamilyCreateForm();
  if (els.familyCreateStatus) {
    els.familyCreateStatus.textContent = `Responsavel ${name} cadastrado. Email enviado para definir senha no primeiro acesso.`;
  }
  await fetchProfiles();
  await fetchStudents();
  render();
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

async function updateUserName(profile, nextName) {
  if (!profile) {
    return;
  }
  if (!canManageProfileTarget(profile) || !(isSadmin() || isAdmin())) {
    alert("Sem permissao para alterar este usuario.");
    return;
  }
  const sanitizedName = String(nextName || "").trim();
  if (!sanitizedName) {
    alert("Informe um nome valido.");
    return;
  }
  if (sanitizedName === String(profile.name || "").trim()) {
    return;
  }
  if (!confirm(`Confirma alterar o nome para "${sanitizedName}"?`)) {
    return;
  }
  const { error } = await supabaseClient
    .from("profiles")
    .update({ name: sanitizedName, nome: sanitizedName })
    .eq("id", profile.id);
  if (error) {
    alert(`Falha ao atualizar nome: ${error.message || "erro inesperado"}`);
    return;
  }
  await fetchProfiles();
  await fetchStudents();
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

async function deleteRoom(roomId, options = {}) {
  if (!isAdmin() && !isEquipe()) {
    alert("Somente administradores e equipe podem excluir salas.");
    return;
  }
  if (!options.skipConfirm && !confirm("Tem certeza que deseja excluir esta sala?")) {
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
  studentDialogContext.guardianProfileId = student?.guardianProfileId || "";
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
  renderGuardianOptions(els.studentGuardian.value);
  syncGuardianSelectionFromInput();
  els.studentDialog.showModal();
}

function resetStudentDialogDraft() {
  studentDialogContext.guardianProfileId = "";
  if (els.studentId) els.studentId.value = "";
  if (els.studentName) els.studentName.value = "";
  if (els.studentBirth) els.studentBirth.value = "";
  if (els.studentGuardian) els.studentGuardian.value = "";
  if (els.studentOther) els.studentOther.value = "";
  if (els.studentPhone) els.studentPhone.value = "";
  if (els.studentAddress) els.studentAddress.value = "";
  if (els.studentNotes) els.studentNotes.value = "";
  if (els.studentIsVisitor) els.studentIsVisitor.checked = false;
  if (els.studentPhoto) els.studentPhoto.value = "";
  if (els.studentPhotoCamera) els.studentPhotoCamera.value = "";
  setPhotoPreviewUrl(els.studentPhotoPreview, "");
  if (els.studentGuardianHint) {
    els.studentGuardianHint.textContent = "";
  }
}

async function saveStudent(event) {
  event.preventDefault();
  const isResponsavel = state.session?.role === "responsavel" && !isAdmin() && !isEquipe();
  const guardianResolution = isResponsavel
    ? { ok: true, profile: { id: state.session?.id || "", name: state.session?.name || "", phone: "" }, message: "" }
    : resolveGuardianProfileForForm();
  if (!guardianResolution.ok || !guardianResolution.profile) {
    alert(guardianResolution.message || "Selecione um usuario valido para vincular a crianca.");
    return;
  }
  const guardianProfileId = guardianResolution.profile.id || "";
  const guardianName = guardianResolution.profile.name || "";
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
    guardianProfileId,
    isVisitor
  };
  if (!isResponsavel && !payload.phone && guardianResolution.profile.phone) {
    payload.phone = guardianResolution.profile.phone;
  }
  const photoFile = els.studentPhotoCamera?.files?.[0] || els.studentPhoto?.files?.[0] || null;

  const missingCommon = !payload.name || !payload.birth || !payload.className;
  const missingAdminFields = !isResponsavel && (!payload.guardian || !payload.phone || !payload.address);
  if (missingCommon || missingAdminFields) {
    alert("Preencha todos os campos obrigatorios.");
    return;
  }
  if (!confirm("Confirma salvar as alteracoes deste cadastro?")) {
    return;
  }

  if (supabaseClient) {
    if (existing?.id) {
      const linkedBeforeUpdate = await linkGuardianToStudent(existing.id, payload.guardian, guardianProfileId);
      if (!linkedBeforeUpdate) {
        alert("A crianca so pode ser vinculada a um usuario valido.");
        return;
      }
    }
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
    if (!existing?.id) {
      const linked = await linkGuardianToStudent(data.id, payload.guardian, guardianProfileId);
      if (!linked) {
        await supabaseClient.from("students").delete().eq("id", data.id);
        alert("A crianca so pode ser cadastrada a um usuario valido.");
        return;
      }
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

async function linkGuardianToStudent(studentId, guardianName, guardianProfileId = "") {
  if (!supabaseClient || !studentId) {
    return false;
  }
  let guardianId = guardianProfileId || state.session?.id || null;
  if (isAdmin() || isEquipe()) {
    guardianId = guardianProfileId || null;
  }
  if (!guardianId && guardianName) {
    let result = await supabaseClient
      .from("profiles")
      .select("id,phone")
      .ilike("name", guardianName)
      .limit(1);
    if (result.error) {
      result = await supabaseClient
        .from("profiles")
        .select("id,phone")
        .ilike("nome", guardianName)
        .limit(1);
    }
    if (!result.error && result.data?.[0]?.id) {
      guardianId = result.data[0].id;
    } else {
      const phoneDigits = normalizePhoneDigits(guardianName);
      if (phoneDigits.length >= 8) {
        const phoneResult = await supabaseClient
          .from("profiles")
          .select("id,phone")
          .not("phone", "is", null)
          .limit(500);
        if (!phoneResult.error) {
          const match = (phoneResult.data || []).find((profile) =>
            normalizePhoneDigits(profile.phone).includes(phoneDigits)
          );
          guardianId = match?.id || null;
        }
      }
    }
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

function renderGuardianOptions(query) {
  if (!els.studentGuardianOptions) {
    return;
  }
  const candidates = getAssignableGuardianProfiles(query).slice(0, 50);
  els.studentGuardianOptions.innerHTML = "";
  candidates.forEach((profile) => {
    const option = document.createElement("option");
    option.value = formatGuardianOption(profile);
    els.studentGuardianOptions.appendChild(option);
  });
}

function getAssignableGuardianProfiles(query = "") {
  const list = (state.profiles || []).filter((profile) => profile?.id && profile?.name);
  const token = String(query || "").trim().toLowerCase();
  const digits = normalizePhoneDigits(query);
  if (!token && !digits) {
    return list;
  }
  return list.filter((profile) => {
    const name = String(profile.name || "").toLowerCase();
    const phoneDigits = normalizePhoneDigits(profile.phone);
    const byName = token ? name.includes(token) : false;
    const byPhone = digits ? phoneDigits.includes(digits) : false;
    return byName || byPhone;
  });
}

function formatGuardianOption(profile) {
  const name = String(profile?.name || "").trim();
  const phone = String(profile?.phone || "").trim();
  return phone ? `${name} (${phone})` : name;
}

function syncGuardianSelectionFromInput() {
  if (!els.studentGuardian) {
    return;
  }
  const result = resolveGuardianProfileForForm({ silent: true });
  if (result.ok && result.profile) {
    studentDialogContext.guardianProfileId = result.profile.id;
    if (els.studentGuardianHint) {
      els.studentGuardianHint.textContent = `Usuario selecionado: ${result.profile.name}`;
    }
    return;
  }
  studentDialogContext.guardianProfileId = "";
  if (els.studentGuardianHint) {
    const value = String(els.studentGuardian.value || "").trim();
    els.studentGuardianHint.textContent = value ? result.message || "Usuario nao encontrado." : "";
  }
}

function resolveGuardianProfileForForm(options = {}) {
  const input = String(els.studentGuardian?.value || "").trim();
  if (!input) {
    return { ok: false, profile: null, message: "Informe nome ou telefone do usuario." };
  }
  const profiles = getAssignableGuardianProfiles();
  if (!profiles.length) {
    return { ok: false, profile: null, message: "Nenhum usuario disponivel para vinculo." };
  }

  const selected = profiles.find((profile) => profile.id === studentDialogContext.guardianProfileId);
  if (selected && profileMatchesGuardianToken(selected, input, true)) {
    return { ok: true, profile: selected, message: "" };
  }

  const strictMatches = profiles.filter((profile) => profileMatchesGuardianToken(profile, input, true));
  if (strictMatches.length === 1) {
    return { ok: true, profile: strictMatches[0], message: "" };
  }
  if (strictMatches.length > 1) {
    return { ok: false, profile: null, message: "Mais de um usuario encontrado. Digite nome completo ou telefone." };
  }

  const looseMatches = profiles.filter((profile) => profileMatchesGuardianToken(profile, input, false));
  if (looseMatches.length === 1) {
    return { ok: true, profile: looseMatches[0], message: "" };
  }
  if (looseMatches.length > 1) {
    return { ok: false, profile: null, message: "Mais de um usuario encontrado. Refine a busca." };
  }
  return { ok: false, profile: null, message: "Nenhum usuario valido encontrado." };
}

function profileMatchesGuardianToken(profile, input, exactOnly) {
  const token = String(input || "").trim();
  if (!token) {
    return false;
  }
  const tokenLower = token.toLowerCase();
  const tokenDigits = normalizePhoneDigits(token);
  const name = String(profile?.name || "").trim();
  const nameLower = name.toLowerCase();
  const phoneDigits = normalizePhoneDigits(profile?.phone || "");
  const optionLower = formatGuardianOption(profile).toLowerCase();
  if (exactOnly) {
    return (
      nameLower === tokenLower ||
      optionLower === tokenLower ||
      (tokenDigits && phoneDigits === tokenDigits)
    );
  }
  return (
    nameLower.includes(tokenLower) ||
    optionLower.includes(tokenLower) ||
    (tokenDigits && phoneDigits.includes(tokenDigits))
  );
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function getResponsibleContactForStudent(student) {
  if (!student) {
    return { phone: "", address: "" };
  }
  const guardianProfileId = String(student.guardianProfileId || "").trim();
  if (guardianProfileId) {
    const profile = (state.profiles || []).find((item) => item.id === guardianProfileId);
    if (profile) {
      return {
        phone: String(profile.phone || "").trim(),
        address: String(profile.address || "").trim()
      };
    }
  }
  const profileByName = findProfileByGuardianName(student.guardian);
  if (profileByName) {
    return {
      phone: String(profileByName.phone || "").trim(),
      address: String(profileByName.address || "").trim()
    };
  }
  const guardianName = String(student.guardian || "").trim().toLowerCase();
  if (guardianName && String(state.session?.name || "").trim().toLowerCase() === guardianName) {
    return {
      phone: String(state.session?.phone || "").trim(),
      address: String(state.session?.address || "").trim()
    };
  }
  return {
    phone: "",
    address: ""
  };
}

function findProfileByGuardianName(guardianName) {
  const target = String(guardianName || "").trim().toLowerCase();
  if (!target) {
    return null;
  }
  const profiles = state.profiles || [];
  const exact = profiles.find((item) => String(item?.name || "").trim().toLowerCase() === target);
  if (exact) {
    return exact;
  }
  const partial = profiles.find((item) => String(item?.name || "").trim().toLowerCase().includes(target));
  return partial || null;
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

async function printCurrentLabel(options = {}) {
  if (!els.labelPreview?.innerHTML) {
    return false;
  }
  const checkinId = options.checkinId || uid();
  const type = options.type === "reprint" ? "reprint" : "print";
  const payload = {
    checkin_id: checkinId,
    conteudo: buildLabelDocumentHtml(els.labelPreview.innerHTML),
    tipo: type
  };
  const endpoint = type === "reprint" ? "/reprint" : "/print";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${PRINT_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    printServiceErrorShown = false;
    return true;
  } catch (error) {
    console.warn("Falha ao enviar etiqueta para o servico de impressao", error);
    if (!printServiceErrorShown) {
      printServiceErrorShown = true;
      alert("Servico de impressao indisponivel. Verifique se o serviço local está iniciado.");
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
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
    printCurrentLabel({ checkinId: checkin?.id, type: "print" });
  }
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

function exportFamiliesCsv() {
  if (!state.session || !(isAdmin() || isEquipe())) {
    alert("Sem permissao para exportar.");
    return;
  }
  const { filtered } = getFilteredFamiliesForCurrentSearch();
  if (!filtered.length) {
    alert("Nenhum usuario encontrado para exportar.");
    return;
  }
  const header = ["Responsavel", "Email", "Telefone", "Endereco", "Qtd filhos", "Filhos"];
  const csvRows = filtered.map((entry) => [
    entry.profile.name || "",
    entry.profile.email || "",
    entry.profile.phone || "",
    entry.profile.address || "",
    entry.children.length,
    entry.children.map((child) => child.name).join(" | ")
  ]);
  const searchRaw = String(els.familySearch?.value || "").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  const fileSuffix = searchRaw || "busca";
  const csv = [header, ...csvRows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `familias_${fileSuffix}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const value = String(role || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
  if (value === "dnms_kids" || value === "dnmskids") return "dnms_kids";
  if (value === "responsavel") return "responsavel";
  if (value === "administrador") return "admin";
  if (value === "super_admin" || value === "sadmin") return "admin";
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
    const contact = getResponsibleContactForStudent(student);
    const birthLabel = formatBirthDateShort(student.birth) || "-";
    els.studentDetailsInfo.innerHTML = `
      <div class="student-details-row"><strong>Turma:</strong><span>${className || "-"}</span></div>
      <div class="student-details-row"><strong>Nascimento:</strong><span>${birthLabel}</span></div>
      <div class="student-details-row"><strong>Responsavel:</strong><span>${student.guardian || "-"}</span></div>
      <div class="student-details-row"><strong>Telefone:</strong><span>${contact.phone || "-"}</span></div>
      <div class="student-details-row"><strong>Endereco:</strong><span>${contact.address || "-"}</span></div>
      <div class="student-details-row"><strong>Observacoes:</strong><span>${student.notes || ""}</span></div>
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

function applyBirthDateMask(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatBirthDateForInput(value) {
  const iso = normalizeBirthDateInput(value);
  if (!iso) {
    return "";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatBirthDateShort(value) {
  const iso = normalizeBirthDateInput(value);
  if (!iso) {
    return "";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year.slice(-2)}`;
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
          expandedScheduleDates: [],
          selectedManageUserId: "",
          selectedRoomIds: [],
          logSelectedStudentIds: [],
          dashboardNeuroExpanded: false,
          generatedInviteLink: "",
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
      expandedScheduleDates: [],
      selectedManageUserId: "",
      selectedRoomIds: [],
      logSelectedStudentIds: [],
      dashboardNeuroExpanded: false,
      generatedInviteLink: ""
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



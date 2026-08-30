﻿const STORAGE_KEY = "checkin_app_state_v1";
const STORAGE_BUCKET = "dnms-photos";
const PENDING_PROFILE_PHOTO_PREFIX = "pending_profile_photo_v1:";
const SCHEDULE_SHEET_CONFIG_KEY = "checkin_schedule_sheet_config_v1";
const AUTO_SHEET_DETAILS_PREFIX = "[AUTO_GSHEET]";
const XLSX_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
const SHEET_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const RECURRENCE_WEEKS_PER_MONTH = 4;
const DASHBOARD_UPCOMING_SCHEDULE_LIMIT = 3;
const PRINT_SERVICE_URL = "http://localhost:3001";
const PRINT_SERVICE_TOKEN_KEY = "dnms_print_service_token";
const SADMIN_EMAIL = "marvinlabre@gmail.com";
const SW_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const CHECKIN_EARLY_WINDOW_MINUTES = 30;
const SUPABASE_URL = "https://ziuezwtmmnspkycixqtf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWV6d3RtbW5zcGt5Y2l4cXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjY2NjksImV4cCI6MjA5MDIwMjY2OX0.WCPR3YQyJqyChtYjNMXgYXipRiEYf4_BJjS8-RalZj4";
const STUDENT_SELECT_COLUMNS = "id,name,birth_date,class_name,primary_guardian_name,phone,address,notes,is_visitor,photo_url";
const ROOM_SELECT_COLUMNS = "id,name,date,start_time,time,end_time,class_target,status,opened_at,closed_at";
const CHECKIN_SELECT_COLUMNS = "id,room_id,room_name_snapshot,student_id,class_name,notes_snapshot,checked_in_at,checked_out_at";
const AUDIT_LOG_SELECT_COLUMNS = "id,created_at,actor_id,actor_name,actor_role,action_type,target_type,target_id,target_name,details,metadata";
const SCHEDULE_SELECT_COLUMNS = "id,date,profile_id,target_user,lesson_theme,details";
const TIP_SELECT_COLUMNS = "id,message,recipient_id,created_at,created_by,sender_name";
const TIP_READ_SELECT_COLUMNS = "tip_id,user_id,read_at";
const FAMILY_LINK_REQUEST_SELECT_COLUMNS = "id,requester_id,target_id,requester_name_snapshot,target_name_snapshot,tip_id,status,expires_at,responded_at,created_at";
const CSV_DELIMITER = ";";
const CSV_BOM = "\uFEFF";
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
  inProgress: false,
  xlsxLoadPromise: null
};
const signupContext = { role: "responsavel", inviteToken: "" };
const roomFormContext = { editingId: "" };
const studentDetailsContext = { studentId: "" };
const studentDialogContext = { guardianProfileId: "", photoFile: null };
const studentSaveContext = { inProgress: false };
const labelContext = { checkinId: "" };
const parentCheckinContext = { presenceToken: "", targetStudentId: "", qrStream: null, qrScanTimer: null };
const myDataContext = { name: "", email: "", phone: "", address: "", photoUrl: "" };
const familyNetworkContext = { members: [], familyId: "" };
const familyContext = { selectedProfileId: "" };
const panelRefreshContext = { inProgress: false, pendingPanel: "" };
const bootContext = { loadingSession: Boolean(supabaseClient) };

const els = {
  bootCard: document.getElementById("bootCard"),
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
  dashboardTips: document.getElementById("dashboardTips"),
  dashboardSchedules: document.getElementById("dashboardSchedules"),
  dashboardBirthdays: document.getElementById("dashboardBirthdays"),
  dashboardAdminTools: document.getElementById("dashboardAdminTools"),
  dashboardInfoText: document.getElementById("dashboardInfoText"),
  btnSaveDashboardInfo: document.getElementById("btnSaveDashboardInfo"),
  tipsCard: document.getElementById("tipsCard"),
  btnTipsBackHome: document.getElementById("btnTipsBackHome"),
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
  qrDialogManualField: document.getElementById("qrDialogManualField"),
  qrDialogInput: document.getElementById("qrDialogInput"),
  qrDialogStatus: document.getElementById("qrDialogStatus"),
  qrDialogLabel: document.getElementById("qrDialogLabel"),
  qrCameraPreview: document.getElementById("qrCameraPreview"),
  btnStartQrCamera: document.getElementById("btnStartQrCamera"),
  btnQrDialogCheckin: document.getElementById("btnQrDialogCheckin"),
  parentCheckinDialog: document.getElementById("parentCheckinDialog"),
  parentCheckinList: document.getElementById("parentCheckinList"),
  btnParentCheckinSelected: document.getElementById("btnParentCheckinSelected"),
  checkoutDialog: document.getElementById("checkoutDialog"),
  checkoutSummary: document.getElementById("checkoutSummary"),
  checkoutCheckinId: document.getElementById("checkoutCheckinId"),
  btnConfirmCheckout: document.getElementById("btnConfirmCheckout"),
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
  logReportType: document.getElementById("logReportType"),
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
  btnPrintPresenceQr: document.getElementById("btnPrintPresenceQr"),
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
  studentSavingOverlay: document.getElementById("studentSavingOverlay"),
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
  forgotPasswordForm: document.getElementById("forgotPasswordForm"),
  forgotPasswordEmail: document.getElementById("forgotPasswordEmail"),
  btnSendPasswordReset: document.getElementById("btnSendPasswordReset"),
  resetPasswordDialog: document.getElementById("resetPasswordDialog"),
  resetPasswordForm: document.getElementById("resetPasswordForm"),
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
  familyNetworkPanel: document.getElementById("familyNetworkPanel"),
  familyNetworkList: document.getElementById("familyNetworkList"),
  familyLinkEmail: document.getElementById("familyLinkEmail"),
  btnLinkFamilyResponsible: document.getElementById("btnLinkFamilyResponsible"),
  familyLinkStatus: document.getElementById("familyLinkStatus"),
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
  if (supabaseClient && isPasswordRecoveryUrl()) {
    bootContext.loadingSession = false;
    state.session = null;
    render();
    await maybeOpenPasswordResetDialog();
    registerServiceWorker();
    return;
  }
  if (supabaseClient) {
    await hydrateFromSupabase();
  } else {
    bootContext.loadingSession = false;
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
  [els.loginEmail, els.loginPassword].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        handleLogin(event);
      }
    });
  });
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
  if (els.forgotPasswordForm) {
    els.forgotPasswordForm.addEventListener("submit", handleSendPasswordResetEmail);
  } else {
    els.btnSendPasswordReset?.addEventListener("click", handleSendPasswordResetEmail);
  }
  if (els.resetPasswordForm) {
    els.resetPasswordForm.addEventListener("submit", handleSubmitPasswordReset);
  } else {
    els.btnSubmitPasswordReset?.addEventListener("click", handleSubmitPasswordReset);
  }
  els.btnSaveMyData?.addEventListener("click", handleSaveMyData);
  els.btnHomePanel?.addEventListener("click", goHomePanel);
  els.btnRoomsPanel?.addEventListener("click", () => setActivePanel("rooms"));
  els.btnStudentsPanel?.addEventListener("click", () => setActivePanel("students"));
  els.btnFamiliesPanel?.addEventListener("click", () => setActivePanel("families"));
  els.btnTipsInbox?.addEventListener("click", () => setActivePanel("tips"));
  els.btnTipsBackHome?.addEventListener("click", () => {
    setActivePanel(state.session?.role === "responsavel" ? "students" : "dashboard");
  });
  els.btnLogPanel?.addEventListener("click", toggleLogPanel);
  els.btnInvitePanel?.addEventListener("click", toggleInvitePanel);
  els.btnLogout.addEventListener("click", handleLogout);
  els.btnPrintPanel.addEventListener("click", () => window.open("print.html", "_blank"));
  els.btnCreateRoom.addEventListener("click", createRooms);
  els.btnDeleteRoomFromEdit?.addEventListener("click", handleDeleteRoomFromEdit);
  els.selectAllRooms?.addEventListener("change", handleSelectAllRoomsInList);
  els.btnBulkEditRooms?.addEventListener("click", handleBulkOpenSelectedRooms);
  els.btnBulkDeleteRooms?.addEventListener("click", handleBulkDeleteRooms);
  els.btnAddStudent.addEventListener("click", () => openStudentDialog());
  els.btnParentCheckin?.addEventListener("click", openQrDialog);
  els.btnParentCheckinSelected.addEventListener("click", handleParentCheckinSelected);
  els.studentSearch.addEventListener("input", renderStudents);
  els.studentClassFilter.addEventListener("change", renderStudents);
  els.selectAllStudents.addEventListener("change", handleSelectAllStudents);
  els.btnBulkCheckin.addEventListener("click", handleBulkCheckin);
  els.btnBulkCheckout.addEventListener("click", handleBulkCheckout);
  els.btnStartQrCamera?.addEventListener("click", startQrCameraScan);
  els.btnQrDialogCheckin.addEventListener("click", (event) =>
    handleQrCheckin(els.qrDialogInput, els.qrDialogStatus, event)
  );
  els.qrDialog?.addEventListener("close", stopQrCameraScan);
  els.btnExport.addEventListener("click", exportCsv);
  els.btnShareWhatsapp?.addEventListener("click", shareLogWhatsapp);
  els.logReportType?.addEventListener("change", renderLog);
  els.logStart.addEventListener("change", renderLog);
  els.logStart.addEventListener("input", renderLog);
  els.logEnd.addEventListener("change", renderLog);
  els.logEnd.addEventListener("input", renderLog);
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
  els.btnPrintPresenceQr?.addEventListener("click", printPresenceQr);
  els.btnLinkFamilyResponsible?.addEventListener("click", handleLinkFamilyResponsible);
  els.familySearch?.addEventListener("input", renderFamiliesPanel);
  els.btnExportFamilies?.addEventListener("click", exportFamiliesCsv);
  els.btnFamilyCreateResponsible?.addEventListener("click", handleCreateFamilyResponsible);
  els.btnFamilyClearCreate?.addEventListener("click", clearFamilyCreateForm);
  els.btnPrintLabel.addEventListener("click", () => printCurrentLabel({ type: "reprint" }));
  els.btnCloseLabel.addEventListener("click", () => els.labelDialog.close());

  if (els.studentPhoto) {
    els.studentPhoto.addEventListener("change", () => {
      handleStudentPhotoInputChange(els.studentPhoto, els.studentPhotoCamera);
    });
  }
  if (els.studentPhotoCamera) {
    els.studentPhotoCamera.addEventListener("change", () => {
      handleStudentPhotoInputChange(els.studentPhotoCamera, els.studentPhoto);
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
  [els.studentName, els.signupName, els.familyCreateName, els.myDataName].forEach(bindPersonNameInput);
  [els.studentBirth, els.signupBirth, els.familyCreateBirth].forEach(bindBirthDateInput);
  if (isMobileDevice() && els.btnPrintLabel) {
    els.btnPrintLabel.style.display = "none";
    if (els.labelDialog) {
      els.labelDialog.style.display = "none";
    }
    // Bloqueio defensivo: evita qualquer popup de impressao no celular.
    window.print = () => {};
  }
}

function render() {
  renderSession();
  renderRoleVisibility();
  renderDashboard();
  renderTipsPanel();
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
    .select("id,name,role,email,phone,address,photo_url,family_id")
    .eq("id", userId)
    .single();
  if (primaryResult.error) {
    const message = String(primaryResult.error.message || "").toLowerCase();
    const missingAddressColumn = message.includes("column") && message.includes("address");
    const missingFamilyColumn = message.includes("column") && message.includes("family_id");
    if (missingAddressColumn || missingFamilyColumn) {
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
  if (panel === "log") {
    ensureLogPeriodDefaults();
  }
  state.ui.activePanel = panel;
  state.ui.showLogPanel = panel === "log";
  state.ui.showInvitePanel = panel === "invite";
  render();
  requestPanelDataRefresh(panel);
}

function requestPanelDataRefresh(panel) {
  if (!supabaseClient || !state.session) {
    return;
  }
  panelRefreshContext.pendingPanel = panel;
  if (panelRefreshContext.inProgress) {
    return;
  }
  runPendingPanelDataRefresh();
}

async function runPendingPanelDataRefresh() {
  panelRefreshContext.inProgress = true;
  try {
    while (panelRefreshContext.pendingPanel) {
      const panel = panelRefreshContext.pendingPanel;
      panelRefreshContext.pendingPanel = "";
      await refreshPanelData(panel);
      normalizeStudents();
      render();
    }
  } catch (err) {
    console.warn("Falha ao atualizar dados da aba", err);
  } finally {
    panelRefreshContext.inProgress = false;
  }
}

async function refreshPanelData(panel) {
  if (!supabaseClient || !state.session) {
    return;
  }
  const canLoadProfiles = canAccessManagementPanel() || isEquipe();
  const fetchProfilesIfAllowed = () => (canLoadProfiles ? fetchProfiles() : Promise.resolve());
  if (panel === "dashboard") {
    await Promise.all([fetchRooms(), fetchStudents(), fetchCheckins(), fetchProfilesIfAllowed(), fetchDashboardData()]);
    return;
  }
  if (panel === "rooms") {
    await Promise.all([fetchRooms(), fetchStudents(), fetchCheckins()]);
    return;
  }
  if (panel === "students") {
    await Promise.all([fetchStudents(), fetchRooms(), fetchCheckins(), fetchProfilesIfAllowed()]);
    return;
  }
  if (panel === "families") {
    await Promise.all([fetchProfilesIfAllowed(), fetchStudents()]);
    return;
  }
  if (panel === "tips") {
    await Promise.all([fetchDashboardData(), fetchProfilesIfAllowed()]);
    return;
  }
  if (panel === "log") {
    await Promise.all([fetchCheckins(), fetchStudents(), fetchRooms(), fetchAuditLogs()]);
    return;
  }
  if (panel === "invite") {
    await Promise.all([fetchProfilesIfAllowed(), fetchStudents(), fetchDashboardData()]);
  }
}

function ensureDefaultActivePanel() {
  if (!state.session) {
    return;
  }
  if (state.session.role === "responsavel" && state.ui.activePanel !== "tips") {
    state.ui.activePanel = "students";
    state.ui.showLogPanel = false;
    state.ui.showInvitePanel = false;
    return;
  }
  const allowed = new Set(["dashboard", "rooms", "students", "families", "tips", "log", "invite"]);
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
  if (els.btnTipsInbox) {
    els.btnTipsInbox.className = active === "tips" ? "primary message-btn" : "ghost message-btn";
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

function getFamilyLinkRequestForTip(tipId) {
  if (!tipId || !state.session) {
    return null;
  }
  return (
    (state.familyLinkRequests || []).find(
      (request) => request.tipId === tipId && request.targetId === state.session.id && request.status === "pending"
    ) || null
  );
}

function getProfileName(profileId, fallback = "Responsavel") {
  if (profileId === state.session?.id) {
    return state.session?.name || fallback;
  }
  const profile = state.profiles.find((item) => item.id === profileId);
  return profile?.name || fallback;
}

function isFamilyLinkRequestExpired(request) {
  return Boolean(request?.expiresAt && new Date(request.expiresAt).getTime() < Date.now());
}

function openTipsDialog() {
  openTipsPanel();
}

function openTipsPanel() {
  if (!state.session) {
    return;
  }
  setActivePanel("tips");
}

function renderTipsDialog() {
  renderTipsPanel();
}

function renderTipsSurfaces() {
  renderTipsPanel();
  renderDashboardTips();
}

function getTipsStatusHtml() {
  const status = state.tipsStatus || {};
  if (status.error) {
    return `
      <div class="summary tips-status tips-status-error" role="status">
        <strong>Falha ao carregar mensagens.</strong><br />
        ${escapeHtml(status.error)}
        <div class="actions">
          <button type="button" class="ghost" data-retry-tips>Atualizar mensagens</button>
        </div>
      </div>
    `;
  }
  if (status.loading) {
    return `<div class="summary tips-status" role="status">Atualizando mensagens...</div>`;
  }
  return "";
}

function bindTipsRetryButtons(root = document) {
  root.querySelectorAll("[data-retry-tips]").forEach((button) => {
    button.addEventListener("click", retryTipsRefresh);
  });
}

async function retryTipsRefresh() {
  await fetchDashboardData();
  updateTipsUnreadBadge();
  render();
}

function renderTipsPanel() {
  if (!els.tipsList) {
    return;
  }
  if (els.btnTipsBackHome) {
    els.btnTipsBackHome.textContent =
      state.session?.role === "responsavel" ? "Voltar para criancas" : "Voltar para dashboard";
  }
  renderTipsComposerControls();
  const tips = getVisibleTipsForCurrentUser();
  const canDeleteTips = canAccessManagementPanel();
  const statusHtml = getTipsStatusHtml();
  els.tipsList.innerHTML = statusHtml;
  bindTipsRetryButtons(els.tipsList);
  if (state.tipsStatus?.error && !tips.length) {
    return;
  }
  if (!tips.length) {
    els.tipsList.insertAdjacentHTML("beforeend", `<div class="summary tips-empty">Nenhuma mensagem disponivel.</div>`);
    return;
  }
  const expandedTips = new Set(state.ui?.expandedTips || []);
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
    preview.setAttribute("aria-expanded", expanded ? "true" : "false");
    preview.setAttribute("aria-label", expanded ? "Recolher mensagem" : "Expandir mensagem");
    preview.textContent = expanded ? message : truncateTipMessage(message, 90);
    wrapper.appendChild(preview);

    if (expanded && message.length > 90) {
      const hint = document.createElement("span");
      hint.className = "muted";
      hint.textContent = "Clique para recolher";
      wrapper.appendChild(hint);
    }

    const familyLinkRequest = getFamilyLinkRequestForTip(tip.id);
    if (familyLinkRequest) {
      const requestActions = document.createElement("div");
      requestActions.className = "actions family-link-request-actions";
      if (isFamilyLinkRequestExpired(familyLinkRequest)) {
        const expired = document.createElement("span");
        expired.className = "muted";
        expired.textContent = "Convite expirado.";
        requestActions.appendChild(expired);
      } else {
        const requesterName = getProfileName(familyLinkRequest.requesterId);
        const btnAccept = document.createElement("button");
        btnAccept.type = "button";
        btnAccept.className = "primary";
        btnAccept.textContent = "Sim";
        btnAccept.addEventListener("click", async () => {
          await respondFamilyLinkRequest(familyLinkRequest.id, true, requesterName);
        });

        const btnDecline = document.createElement("button");
        btnDecline.type = "button";
        btnDecline.className = "ghost";
        btnDecline.textContent = "Nao";
        btnDecline.addEventListener("click", async () => {
          await respondFamilyLinkRequest(familyLinkRequest.id, false, requesterName);
        });

        requestActions.appendChild(btnAccept);
        requestActions.appendChild(btnDecline);
      }
      wrapper.appendChild(requestActions);
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
      renderTipsPanel();
    });

    els.tipsList.appendChild(wrapper);
  });
}

function renderTipsComposerControls() {
  const canSend = canAccessManagementPanel();
  if (els.tipsComposer) {
    els.tipsComposer.style.display = canSend ? "flex" : "none";
  }
  if (els.btnDeleteAllTips) {
    els.btnDeleteAllTips.style.display = canSend ? "inline-flex" : "none";
  }
  if (!canSend || !els.tipsRecipientSelect) {
    return;
  }
  const current = els.tipsRecipientSelect.value || "all";
  const options = ['<option value="all">Todos os usuarios</option>']
    .concat(
      state.profiles
        .filter((profile) => profile.id !== state.session?.id)
        .map((profile) => `<option value="${escapeAttribute(profile.id)}">${escapeHtml(profile.name)} (${formatRole(profile.role)})</option>`)
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

function renderDashboardTips() {
  if (!els.dashboardTips) {
    return;
  }
  const tips = getVisibleTipsForCurrentUser().slice(0, 5);
  const statusHtml = getTipsStatusHtml();
  if (state.tipsStatus?.error && !tips.length) {
    els.dashboardTips.innerHTML = statusHtml;
    bindTipsRetryButtons(els.dashboardTips);
    return;
  }
  if (!tips.length) {
    els.dashboardTips.innerHTML = `${statusHtml}<div class="summary tips-empty">Nenhuma mensagem recente.</div>`;
    bindTipsRetryButtons(els.dashboardTips);
    return;
  }
  els.dashboardTips.innerHTML = `
    ${statusHtml}
    <div class="dashboard-tips-header">
      <span>${escapeHtml(tips.length)} recente(s)</span>
      <button id="btnDashboardOpenTips" type="button" class="link-button">Ver todas</button>
    </div>
    <div class="list dashboard-tips-list">
      ${tips
        .map((tip) => {
          const read = isTipReadByCurrentUser(tip.id);
          return `
            <button type="button" class="list-item dashboard-tip-card ${read ? "" : "is-selected"}" data-dashboard-tip-id="${escapeAttribute(tip.id)}" aria-label="Abrir mensagem de ${escapeAttribute(resolveTipRecipientLabel(tip))}">
              <strong>${escapeHtml(resolveTipRecipientLabel(tip))}</strong>
              <span class="muted">${escapeHtml(formatDateTimeFromIso(tip.createdAt))}</span>
              <span>${escapeHtml(truncateTipMessage(tip.message, 120))}</span>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
  bindTipsRetryButtons(els.dashboardTips);
  document.getElementById("btnDashboardOpenTips")?.addEventListener("click", () => setActivePanel("tips"));
  els.dashboardTips.querySelectorAll("[data-dashboard-tip-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const tipId = button.getAttribute("data-dashboard-tip-id");
      if (tipId) {
        const expanded = new Set(state.ui?.expandedTips || []);
        expanded.add(tipId);
        state.ui.expandedTips = Array.from(expanded);
      }
      setActivePanel("tips");
    });
  });
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
  renderTipsPanel();
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
  renderTipsPanel();
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
  renderTipsPanel();
  render();
}

async function respondFamilyLinkRequest(requestId, accept, requesterName = "responsavel") {
  if (!supabaseClient || !state.session || !requestId) {
    return;
  }
  if (accept && !confirm(`Confirmar vinculo com a familia de ${requesterName}?`)) {
    return;
  }
  const { data, error } = await supabaseClient.rpc("respond_family_link_request", {
    request_id: requestId,
    accept: Boolean(accept)
  });
  if (error) {
    const message = String(error.message || "");
    if (message.includes("family_link_request_expired")) {
      alert("Este convite expirou. Peca para o responsavel enviar um novo convite.");
    } else if (message.includes("family_link_request_not_pending")) {
      alert("Este convite ja foi respondido.");
    } else {
      alert(`Falha ao responder convite: ${error.message || "erro inesperado"}`);
    }
    await fetchDashboardData();
    render();
    return;
  }

  await fetchProfiles();
  await fetchStudents();
  await fetchDashboardData();
  await loadMyFamilyNetwork();
  renderTipsPanel();
  updateTipsUnreadBadge();
  if (accept) {
    alert(`Voce esta sendo vinculado a familia de ${data?.requester_name || requesterName}.`);
    await openMyDataDialog();
  } else {
    alert("Convite recusado.");
    render();
  }
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
      state.auditLogs = [];
      state.schedules = [];
      state.tips = [];
      state.tipReads = [];
      state.familyLinkRequests = [];
      state.dashboardInfo = "";
      render();
      return;
    }
    const profile = await fetchProfile(session.user.id);
    if (!profile) {
      await supabaseClient.auth.signOut();
      state.session = null;
      alert("Usuario nao encontrado. Solicite um novo cadastro ao administrador.");
      render();
      return;
    }
    state.session = {
      id: profile.id,
      name: profile.name,
      role: normalizeRole(profile.role),
      email: profile.email || "",
      phone: formatPhoneForDisplay(profile.phone || ""),
      address: profile.address || "",
      photoUrl: profile.photo_url || "",
      familyId: profile.family_id || ""
    };
    bootContext.loadingSession = false;
    ensureDefaultActivePanel();
    render();
    await uploadPendingProfilePhoto(session.user);
    await Promise.all([fetchRooms(), fetchStudents()]);
    const dataTasks = [fetchCheckins(), fetchAuditLogs(), fetchDashboardData()];
    if (canAccessManagementPanel() || isEquipe()) {
      dataTasks.push(fetchProfiles());
    }
    await Promise.all(dataTasks);
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
  } finally {
    bootContext.loadingSession = false;
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
    phone: formatPhoneForStorage(metadata.phone || ""),
    is_visitor: Boolean(metadata.is_visitor)
  };
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
  if (metadata.invite_token) {
    const inviteResult = await acceptInviteToken(metadata.invite_token, user.email || "", role);
    if (!inviteResult.ok) {
      return null;
    }
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
    const rowsById = new Map();
    if (studentIds.length) {
      const { data, error } = await supabaseClient.from("students").select(STUDENT_SELECT_COLUMNS).in("id", studentIds);
      if (error) {
        console.warn("Falha ao buscar alunos", error);
      } else {
        (data || []).forEach((student) => {
          if (student?.id) {
            rowsById.set(student.id, student);
          }
        });
      }
    }
    const { data: ownedRows, error: ownedError } = await supabaseClient
      .from("students")
      .select(STUDENT_SELECT_COLUMNS)
      .eq("primary_guardian_name", state.session.name);
    if (ownedError) {
      console.warn("Falha ao buscar alunos do responsavel", ownedError);
    } else {
      (ownedRows || []).forEach((student) => {
        if (student?.id && !rowsById.has(student.id)) {
          rowsById.set(student.id, student);
        }
      });
    }
    rows = Array.from(rowsById.values());
  } else {
    const { data, error } = await supabaseClient.from("students").select(STUDENT_SELECT_COLUMNS);
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
        if (!item?.student_id || !item?.guardian_id) {
          return;
        }
        if (!guardianLinkMap.has(item.student_id)) {
          guardianLinkMap.set(item.student_id, []);
        }
        guardianLinkMap.get(item.student_id).push(item.guardian_id);
      });
    }
  }
  state.students = rows.map((student) => ({
    id: student.id,
    name: student.name,
    birth: student.birth_date,
    className: getClassForBirth(student.birth_date),
    guardian: student.primary_guardian_name,
    otherGuardians: "",
    phone: formatPhoneForDisplay(student.phone),
    address: student.address,
    notes: student.notes || "",
    owner: student.primary_guardian_name || "",
    guardianProfileIds: guardianLinkMap.get(student.id) || [],
    guardianProfileId: getPrimaryGuardianProfileId(student, guardianLinkMap.get(student.id) || []),
    isVisitor: Boolean(student.is_visitor),
    photoUrl: student.photo_url || ""
  }));
}

async function fetchRooms() {
  const { data, error } = await supabaseClient.from("rooms").select(ROOM_SELECT_COLUMNS);
  if (error) {
    console.warn("Falha ao buscar salas", error);
    return;
  }
  let rows = data || [];
  const expiredOpenIds = rows
    .filter((room) => room?.status === "Aberta" && isIsoDateBeforeToday(room.date))
    .map((room) => room.id)
    .filter(Boolean);
  if (expiredOpenIds.length) {
    const closedAtIso = new Date().toISOString();
    const { error: checkoutError } = await supabaseClient
      .from("checkins")
      .update({ checked_out_at: closedAtIso })
      .in("room_id", expiredOpenIds)
      .is("checked_out_at", null);
    if (checkoutError) {
      console.warn("Falha ao fazer checkout automatico de salas vencidas", checkoutError);
      return;
    }
    const { error: closeError } = await supabaseClient
      .from("rooms")
      .update({ status: "Fechada", closed_at: closedAtIso })
      .in("id", expiredOpenIds);
    if (closeError) {
      console.warn("Falha ao fechar salas vencidas", closeError);
    } else {
      rows = rows.map((room) =>
        expiredOpenIds.includes(room.id)
          ? { ...room, status: "Fechada", closed_at: closedAtIso }
          : room
      );
      state.checkins.forEach((checkin) => {
        if (expiredOpenIds.includes(checkin.roomId) && !checkin.checkedOutAt) {
          checkin.checkedOutAt = formatTimeFromIso(closedAtIso);
        }
      });
    }
  }
  state.rooms = rows.map((room) => {
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
  const { data, error } = await supabaseClient.from("checkins").select(CHECKIN_SELECT_COLUMNS);
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

async function fetchAuditLogs() {
  if (!supabaseClient || !state.session || !(isAdmin() || isEquipe())) {
    state.auditLogs = [];
    return;
  }
  const { data, error } = await supabaseClient.from("audit_logs").select(AUDIT_LOG_SELECT_COLUMNS);
  if (error) {
    console.warn("Falha ao buscar audit_logs", error);
    state.auditLogs = [];
    return;
  }
  state.auditLogs = (data || [])
    .map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      actorId: row.actor_id || "",
      actorName: row.actor_name || "",
      actorRole: normalizeRole(row.actor_role || ""),
      actionType: row.action_type || "",
      targetType: row.target_type || "",
      targetId: row.target_id || "",
      targetName: row.target_name || "",
      details: row.details || "",
      metadata: row.metadata || {}
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function recordAuditLog(actionType, targetType, targetId, targetName, details = "", metadata = {}) {
  const createdAt = new Date().toISOString();
  const entry = {
    id: uid(),
    createdAt,
    actorId: state.session?.id || "",
    actorName: state.session?.name || "",
    actorRole: normalizeRole(state.session?.role || ""),
    actionType,
    targetType,
    targetId: targetId || "",
    targetName: targetName || "",
    details,
    metadata: metadata || {}
  };
  state.auditLogs = [entry, ...(state.auditLogs || [])];
  if (!supabaseClient || !state.session) {
    return entry;
  }
  const { data, error } = await supabaseClient
    .from("audit_logs")
    .insert({
      actor_id: entry.actorId || null,
      actor_name: entry.actorName,
      actor_role: entry.actorRole,
      action_type: entry.actionType,
      target_type: entry.targetType,
      target_id: entry.targetId || null,
      target_name: entry.targetName,
      details: entry.details,
      metadata: entry.metadata
    })
    .select("id,created_at")
    .single();
  if (error) {
    console.warn("Falha ao gravar audit_logs", error);
    return entry;
  }
  if (data?.id) {
    entry.id = data.id;
    entry.createdAt = data.created_at || entry.createdAt;
  }
  return entry;
}

function renderRooms() {
  const sortedRooms = state.rooms.slice().sort(compareRooms);
  const visibleRooms = sortedRooms.filter((room) => room.status !== "Fechada" && !isRoomPast(room));
  const openRooms = visibleRooms.filter((room) => room.status === "Aberta");
  const canManageRoom = canManageRooms();
  const canOperateRoom = canOperateRooms();
  const openableRooms = visibleRooms.filter((room) => isRoomOpenableFromList(room));
  const openableRoomIds = new Set(openableRooms.map((room) => room.id));
  const visibleRoomIds = new Set(visibleRooms.map((room) => room.id));
  state.ui.selectedRoomIds = (state.ui.selectedRoomIds || []).filter((id) => visibleRoomIds.has(id));
  const selectedSet = new Set(state.ui.selectedRoomIds || []);
  const selectedOpenableCount = (state.ui.selectedRoomIds || []).filter((id) => openableRoomIds.has(id)).length;

  els.btnCreateRoom.disabled = !canManageRoom;
  if (els.selectAllRooms) {
    els.selectAllRooms.checked = Boolean(openableRooms.length) && openableRooms.every((room) => selectedSet.has(room.id));
    els.selectAllRooms.disabled = !canOperateRoom || !openableRooms.length;
  }
  if (els.btnBulkEditRooms) {
    els.btnBulkEditRooms.disabled = !canOperateRoom || !selectedOpenableCount;
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
  groupRoomsByMonth(visibleRooms).forEach((group, index) => {
    const details = document.createElement("details");
    details.className = "room-month-group";
    details.open = index === 0 || group.rooms.some((room) => room.status === "Aberta");
    const summary = document.createElement("summary");
    summary.innerHTML = `<strong>${escapeHtml(group.label)}</strong><span>${group.rooms.length} evento(s)</span>`;
    details.appendChild(summary);
    group.rooms.forEach((room) => {
      details.appendChild(createRoomListItem(room, canManageRoom, selectedSet));
    });
    els.roomList.appendChild(details);
  });
}

function createRoomListItem(room, canManageRoom, selectedSet) {
  const canSelectRoom = canOperateRooms() && isRoomOpenableFromList(room);
  const item = document.createElement("div");
  item.className = "list-item";
  item.innerHTML = `
    ${
      canManageRoom || canOperateRooms()
        ? `<label class="field checkbox-field"><span>Selecionar para abrir</span><input type="checkbox" data-select-room="${escapeAttribute(room.id)}" ${selectedSet.has(room.id) ? "checked" : ""} ${canSelectRoom ? "" : "disabled"} /></label>`
        : ""
    }
    <strong>${escapeHtml(room.date)} ${escapeHtml(room.startTime || "")}${room.endTime ? ` - ${escapeHtml(room.endTime)}` : ""} - ${escapeHtml(room.name)}</strong>
    <span class="muted">Turma: ${escapeHtml(room.classTarget || "-")} | Status: ${escapeHtml(room.status)}</span>
    <span class="muted">Abertura: ${escapeHtml(room.openedAt || "-")} | Fechamento: ${escapeHtml(room.closedAt || "-")}</span>
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
  return item;
}

function groupRoomsByMonth(rooms) {
  const groups = new Map();
  rooms.forEach((room) => {
    const dateObj = room.dateIso ? parseInputDate(room.dateIso) : parseRoomDate(room.date || "");
    const key = dateObj ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}` : "sem-data";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: dateObj ? formatMonthLabel(dateObj) : "Sem data",
        rooms: []
      });
    }
    groups.get(key).rooms.push(room);
  });
  return Array.from(groups.values());
}

function formatMonthLabel(date) {
  const text = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

function handleSelectAllRoomsInList(event) {
  const checked = Boolean(event?.target?.checked);
  const openableRooms = state.rooms.filter((room) => room.status !== "Fechada" && !isRoomPast(room) && isRoomOpenableFromList(room));
  state.ui.selectedRoomIds = checked ? openableRooms.map((room) => room.id) : [];
  renderRooms();
}

function getSelectedRoomIdsInList() {
  const selected = new Set(state.ui.selectedRoomIds || []);
  return state.rooms
    .filter((room) => room.status !== "Fechada" && !isRoomPast(room) && selected.has(room.id) && isRoomOpenableFromList(room))
    .map((room) => room.id);
}

function isRoomOpenableFromList(room) {
  return Boolean(room && room.status !== "Aberta" && canOpenRoomNow(room));
}

async function handleBulkOpenSelectedRooms() {
  if (!canOperateRooms()) {
    alert("Somente administradores e equipe podem abrir salas.");
    return;
  }
  const ids = getSelectedRoomIdsInList();
  if (!ids.length) {
    alert("Selecione ao menos uma sala.");
    return;
  }
  if (!confirm(`Abrir ${ids.length} sala(s) selecionada(s)?`)) {
    return;
  }
  await openRoomsFromList(ids);
}

async function openRoomsFromList(ids) {
  let openedCount = 0;
  for (const id of ids) {
    const room = state.rooms.find((item) => item.id === id);
    if (!isRoomOpenableFromList(room)) {
      continue;
    }
    const beforeOpen = room.status === "Aberta";
    await openRoom(id);
    const current = state.rooms.find((item) => item.id === id);
    if (!beforeOpen && current?.status === "Aberta") {
      openedCount += 1;
    }
  }
  state.ui.selectedRoomIds = [];
  if (els.selectAllRooms) {
    els.selectAllRooms.checked = false;
  }
  render();
  if (openedCount) {
    alert(`${openedCount} sala(s) aberta(s).`);
  }
}

async function handleBulkDeleteRooms() {
  if (!canManageRooms()) {
    alert("Somente administradores podem excluir salas.");
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
    familyNetworkContext.members = [];
    familyNetworkContext.familyId = "";
    return;
  }
  const attempts = [
    "id,name,nome,role,email,phone,address,family_id",
    "id,name,role,email,phone,address,family_id",
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
    phone: formatPhoneForDisplay(profile.phone || ""),
    address: profile.address || "",
    familyId: profile.family_id || ""
  }));
}

async function fetchDashboardData() {
  if (!supabaseClient || !state.session) {
    return;
  }
  state.tipsStatus = { loading: true, error: "" };
  renderTipsSurfaces();
  const [
    { data: infoRows, error: infoError },
    { data: schedules, error: schedulesError },
    { data: tips, error: tipsError },
    { data: reads, error: readsError },
    { data: familyLinkRequests, error: familyLinkRequestsError }
  ] =
    await Promise.all([
      supabaseClient.from("dashboard_settings").select("info_text").eq("id", 1).limit(1),
      supabaseClient.from("schedules").select(SCHEDULE_SELECT_COLUMNS),
      supabaseClient.from("tips").select(TIP_SELECT_COLUMNS),
      supabaseClient.from("tip_reads").select(TIP_READ_SELECT_COLUMNS),
      supabaseClient.from("family_link_requests").select(FAMILY_LINK_REQUEST_SELECT_COLUMNS)
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
    state.tipsStatus.error = "";
  } else {
    console.warn("Falha ao buscar tips", tipsError);
    state.tips = [];
    state.tipsStatus.error = tipsError.message || "Falha ao carregar mensagens.";
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

  if (!familyLinkRequestsError) {
    state.familyLinkRequests = (familyLinkRequests || []).map((item) => ({
      id: item.id,
      requesterId: item.requester_id || "",
      targetId: item.target_id || "",
      tipId: item.tip_id || "",
      status: item.status || "",
      expiresAt: item.expires_at || "",
      respondedAt: item.responded_at || "",
      createdAt: item.created_at || "",
      requesterName: item.requester_name_snapshot || "",
      targetName: item.target_name_snapshot || ""
    }));
  } else {
    console.warn("Falha ao buscar solicitacoes de rede familiar", familyLinkRequestsError);
    state.familyLinkRequests = [];
  }
  state.tipsStatus.loading = false;
  renderTipsSurfaces();
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
    els.btnAddStudent.disabled = !canCreateStudent();
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
    const ageEligibility = getStudentAgeEligibility(student);
    const openCheckin = getOpenCheckinForStudent(student.id);
    const targetRoom = getOpenRoomForClass(className);
    const checkinWindow = getCheckinWindowValidation(getAvailableCheckinRoomForClass(className) || targetRoom);
    const alreadyInTargetRoom = Boolean(
      targetRoom && state.checkins.find((checkin) => checkin.roomId === targetRoom.id && checkin.studentId === student.id)
    );
    const checkoutButton = openCheckin
      ? `<button class="ghost" data-checkout="${escapeAttribute(student.id)}">Checkout</button>`
      : "";
    item.innerHTML = `
      <div class="student-list-card">
        <img class="student-list-photo" src="${escapeAttribute(student.photoUrl || getStudentPhotoPlaceholderUrl())}" alt="Foto de ${escapeAttribute(student.name)}" />
        <div class="student-list-content">
          ${canSeeAll ? `<label class="field checkbox-field"><span>Selecionar</span><input type="checkbox" data-select-student="${escapeAttribute(student.id)}" /></label>` : ""}
          <strong>${escapeHtml(student.name)}</strong>
          <span class="muted">Turma: ${escapeHtml(className)} | Responsavel: ${escapeHtml(student.guardian)}</span>
          <span class="muted">Nascimento: ${escapeHtml(birthLabel)} | Observacoes: ${escapeHtml(observationText)}</span>
          <span class="muted">Telefone do responsavel: ${escapeHtml(contact.phone || "-")}</span>
          <span class="muted">Endereco do responsavel: ${escapeHtml(contact.address || "-")}</span>
          <div class="actions">
            ${canEditStudent(student) ? `<button class="ghost" data-edit="${escapeAttribute(student.id)}">Editar</button>` : ""}
            ${checkoutButton}
            <button class="primary" data-checkin="${escapeAttribute(student.id)}">Check-in</button>
          </div>
        </div>
      </div>
    `;
    const btnEdit = item.querySelector("[data-edit]");
    const btnCheckin = item.querySelector("[data-checkin]");
    const btnCheckout = item.querySelector("[data-checkout]");

    btnEdit?.addEventListener("click", () => openStudentDialog(student));
    btnCheckin.addEventListener("click", () => {
      if (isResponsavel && !isAdmin() && !isEquipe()) {
        openQrDialog({ studentId: student.id });
        return;
      }
      handleManualCheckin(student.id);
    });
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

    if (btnEdit && !canEditStudent(student)) {
      btnEdit.disabled = true;
    }

    if (openCheckin || alreadyInTargetRoom) {
      btnCheckin.disabled = true;
      btnCheckin.textContent = "Check-in realizado";
    } else if (!ageEligibility.ok) {
      btnCheckin.disabled = true;
      btnCheckin.textContent = "Fora da faixa";
      btnCheckin.title = ageEligibility.message;
    } else if (!canCheckinStudent(student)) {
      btnCheckin.disabled = true;
    } else if (!checkinWindow.ok) {
      btnCheckin.disabled = true;
      btnCheckin.textContent =
        checkinWindow.reason === "too_early"
          ? "Check-in em breve"
          : checkinWindow.reason === "ended"
            ? "Check-in encerrado"
            : "Check-in indisponivel";
      btnCheckin.title = checkinWindow.message;
    }

    const canCheckoutStudent = isEquipe() || isAdmin() || isStudentOwnedBySession(student);
    if (btnCheckout && (!openCheckin || !canCheckoutStudent)) {
      btnCheckout.disabled = true;
    }

    els.studentList.appendChild(item);
  });

  if (els.selectAllStudents) {
    els.selectAllStudents.checked = false;
  }
}

function renderCheckins() {}

function toggleDashboardScheduleDate(date) {
  if (!date) {
    return;
  }
  const current = new Set(state.ui.expandedScheduleDates || []);
  if (current.has(date)) {
    current.delete(date);
  } else {
    current.add(date);
  }
  state.ui.expandedScheduleDates = Array.from(current);
  renderDashboard();
}

function renderDashboard() {
  if (
    !els.dashboardAlerts ||
    !els.dashboardAttention ||
    !els.dashboardBirthdays ||
    !els.dashboardSchedules ||
    !els.dashboardTips ||
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
  const alertsLine = alerts.length ? `${alerts.map((alert) => escapeHtml(alert)).join("<br />")}<br />` : "";
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
                `<button type="button" class="ghost" data-dashboard-neuro-student="${escapeAttribute(student.id)}" style="text-align:left;justify-content:flex-start">${escapeHtml(student.name)}</button>`
            )
            .join("")}
        </div>`
      : "";
  els.dashboardAlerts.innerHTML = `
    <strong>Informacoes</strong><br />
    ${escapeHtml(infoText)}<br />
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

  renderDashboardTips();

  const groupedSchedules = getGroupedScheduleByDate();
  const upcomingGroups = groupedSchedules.filter((group) => {
    const dateObj = parseInputDate(group.date);
    if (!dateObj) {
      return false;
    }
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    return dateObj > dayStart;
  });
  if (!upcomingGroups.length) {
    els.dashboardSchedules.innerHTML = `<div class="summary">Sem escalas futuras cadastradas.</div>`;
  } else {
    const expandedSet = new Set(state.ui.expandedScheduleDates || []);
    els.dashboardSchedules.innerHTML = upcomingGroups
      .slice(0, DASHBOARD_UPCOMING_SCHEDULE_LIMIT)
      .map((group) => {
        const dateObj = parseInputDate(group.date);
        const dateLabel = dateObj ? formatDate(dateObj) : group.date;
        const expanded = expandedSet.has(group.date);
        const coord = group.roles.COORDENACAO?.length ? group.roles.COORDENACAO.join(", ") : "-";
        const detailsHtml = expanded
          ? `
            <div class="summary" style="margin-top:8px">
              <strong>Maternal:</strong> ${escapeHtml((group.roles.MATERNAL || []).join(", ") || "-")}<br />
              <strong>Kids:</strong> ${escapeHtml((group.roles.KIDS || []).join(", ") || "-")}<br />
              <strong>Juniors:</strong> ${escapeHtml((group.roles.JUNIORS || []).join(", ") || "-")}<br />
              <strong>Teens:</strong> ${escapeHtml((group.roles.TEENS || []).join(", ") || "-")}
            </div>
          `
          : "";
        return `
          <div class="list-item dashboard-schedule-card" data-schedule-date="${escapeAttribute(group.date)}" role="button" tabindex="0">
            <div class="tip-message-preview">
              <strong>${escapeHtml(dateLabel)}</strong> - Coordenador: ${escapeHtml(coord)}
            </div>
            ${detailsHtml}
          </div>
        `;
      })
      .join("");
    document.querySelectorAll("[data-schedule-date]").forEach((card) => {
      card.addEventListener("click", () => toggleDashboardScheduleDate(card.getAttribute("data-schedule-date")));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleDashboardScheduleDate(card.getAttribute("data-schedule-date"));
        }
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
      Coordenador: ${escapeHtml(coord)}<br />
      Maternal: ${escapeHtml((todayGroup.roles.MATERNAL || []).join(", ") || "-")}<br />
      Kids: ${escapeHtml((todayGroup.roles.KIDS || []).join(", ") || "-")}<br />
      Juniors: ${escapeHtml((todayGroup.roles.JUNIORS || []).join(", ") || "-")}<br />
      Teens: ${escapeHtml((todayGroup.roles.TEENS || []).join(", ") || "-")}
    `;
  }

  const birthdayStudents = getCurrentMonthBirthdays();
  if (!birthdayStudents.length) {
    els.dashboardBirthdays.innerHTML = `<div class="summary">Nenhum aniversariante neste mes.</div>`;
  } else {
    els.dashboardBirthdays.innerHTML = birthdayStudents
      .map(
        (student) => `
            <div class="dashboard-birthday-item" data-birthday-student="${escapeAttribute(student.id)}">
            <div class="dashboard-balloon">
              <img src="${escapeAttribute(student.photoUrl || getStudentPhotoPlaceholderUrl())}" alt="Foto de ${escapeAttribute(student.name)}" />
            </div>
            <div class="dashboard-birthday-name">${escapeHtml(student.name)}</div>
            <div class="dashboard-birthday-date">${escapeHtml(formatBirthdayLabel(student.birth))}</div>
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
  const tipsCard = els.tipsCard || document.getElementById("tipsCard");
  const logCard = document.getElementById("logCard");
  const inviteCard = document.getElementById("inviteCard");
  const authCard = document.getElementById("authCard");
  const bootCard = els.bootCard || document.getElementById("bootCard");
  const isResponsavel = session?.role === "responsavel";

  if (bootCard) {
    bootCard.style.display = bootContext.loadingSession ? "flex" : "none";
  }

  if (authCard) {
    authCard.style.display = session || bootContext.loadingSession ? "none" : "flex";
  }

  if (!session || bootContext.loadingSession) {
    if (dashboardCard) {
      dashboardCard.style.display = "none";
    }
    roomCard.style.display = "none";
    studentCard.style.display = "none";
    if (familiesCard) {
      familiesCard.style.display = "none";
    }
    if (tipsCard) {
      tipsCard.style.display = "none";
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
    if (tipsCard) {
      tipsCard.style.display = getActivePanel() === "tips" ? "flex" : "none";
    }
    studentCard.style.display = getActivePanel() === "tips" ? "none" : "flex";
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
    if (tipsCard) {
      tipsCard.style.display = "none";
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
    if (tipsCard) {
      tipsCard.style.display = "none";
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
    if (tipsCard) {
      tipsCard.style.display = "none";
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
  if (tipsCard) {
    tipsCard.style.display = activePanel === "tips" ? "flex" : "none";
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

  const reportType = getLogReportType();
  renderLogClassFilterOptions();
  renderLogStudentFilterOptions();
  const isAttendance = reportType === "attendance";
  if (els.logClassFilter) {
    els.logClassFilter.closest(".field").style.display = isAttendance ? "" : "none";
  }
  if (els.logStudentFilter) {
    els.logStudentFilter.closest(".field").style.display = isAttendance ? "" : "none";
  }
  if (els.btnLogSelectStudents) {
    els.btnLogSelectStudents.style.display = isAttendance ? "" : "none";
  }
  const startValue = els.logStart?.value || "";
  const endValue = els.logEnd?.value || "";
  if (!startValue || !endValue) {
    if (els.logSelectedStudentsSummary) {
      els.logSelectedStudentsSummary.textContent = isAttendance
        ? "Selecione o periodo para habilitar a selecao de criancas."
        : "";
    }
    els.logSummary.textContent = "Selecione o periodo (De e Ate) para gerar o relatorio.";
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

  if (!isAttendance) {
    renderAuditReport(reportType);
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
      <strong>${escapeHtml(row.studentName)}</strong>
      <span class="muted">Turma: ${escapeHtml(row.className)}</span>
      <span class="muted">Horarios de check-in: ${escapeHtml(row.timesLabel || "-")}</span>
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

function renderAuditReport(reportType) {
  if (els.logSelectedStudentsSummary) {
    els.logSelectedStudentsSummary.textContent = "";
  }
  const rows = getFilteredAuditRows(reportType);
  els.logList.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "list-item";
    const title = document.createElement("strong");
    title.textContent = `${formatAuditAction(row.actionType)} - ${row.targetName || row.targetType || "-"}`;
    const date = document.createElement("span");
    date.className = "muted";
    date.textContent = `Data: ${formatDateTimeFromIso(row.createdAt)}`;
    const actor = document.createElement("span");
    actor.className = "muted";
    actor.textContent = `Responsavel pela acao: ${row.actorName || "-"} (${formatRole(row.actorRole)})`;
    const details = document.createElement("span");
    details.className = "muted";
    details.textContent = row.details || formatAuditMetadata(row);
    item.append(title, date, actor, details);
    els.logList.appendChild(item);
  });

  if (!rows.length) {
    els.logSummary.textContent = "Nenhum evento encontrado para o periodo selecionado.";
    els.logCounts.textContent = "";
  } else {
    els.logSummary.textContent = `${formatReportType(reportType)}: ${rows.length} evento(s) encontrado(s).`;
    els.logCounts.textContent = buildAuditCountsLabel(rows);
  }
  els.btnExport.disabled = !rows.length;
  if (els.btnShareWhatsapp) {
    els.btnShareWhatsapp.disabled = true;
  }
  if (els.btnLogSelectStudents) {
    els.btnLogSelectStudents.disabled = true;
  }
}

function toggleLogPanel() {
  if (!state.session || !(isAdmin() || isEquipe())) {
    return;
  }
  setActivePanel(getActivePanel() === "log" ? "dashboard" : "log");
}

function ensureLogPeriodDefaults() {
  const today = formatTodayIso();
  if (els.logStart && !els.logStart.value) {
    els.logStart.value = today;
  }
  if (els.logEnd && !els.logEnd.value) {
    els.logEnd.value = today;
  }
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

async function ensureXlsxLoaded() {
  if (window.XLSX?.read && window.XLSX?.utils?.sheet_to_json) {
    return window.XLSX;
  }
  if (!scheduleSheetContext.xlsxLoadPromise) {
    scheduleSheetContext.xlsxLoadPromise = loadScriptOnce(XLSX_SCRIPT_URL).then(() => {
      if (!window.XLSX?.read || !window.XLSX?.utils?.sheet_to_json) {
        throw new Error("Biblioteca XLSX indisponivel.");
      }
      return window.XLSX;
    });
  }
  try {
    return await scheduleSheetContext.xlsxLoadPromise;
  } catch (error) {
    scheduleSheetContext.xlsxLoadPromise = null;
    throw error;
  }
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-dnms-dynamic-script="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
      if (existing.dataset.loaded === "true") {
        resolve();
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.dnmsDynamicScript = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
    document.head.appendChild(script);
  });
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
  if (scheduleSheetContext.inProgress) {
    return;
  }
  scheduleSheetContext.inProgress = true;
  if (els.btnSyncScheduleSheet) {
    els.btnSyncScheduleSheet.disabled = true;
  }
  try {
    await ensureXlsxLoaded();
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
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    await ensureXlsxLoaded();
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

async function checkoutOpenCheckinsForRoom(roomId, checkedOutIso) {
  if (!roomId) {
    return { ok: false, message: "Sala invalida." };
  }
  const checkoutIso = checkedOutIso || new Date().toISOString();
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("checkins")
      .update({ checked_out_at: checkoutIso })
      .eq("room_id", roomId)
      .is("checked_out_at", null);
    if (error) {
      return { ok: false, message: error.message || "Falha ao atualizar checkout dos alunos." };
    }
  }
  state.checkins.forEach((checkin) => {
    if (checkin.roomId === roomId && !checkin.checkedOutAt) {
      checkin.checkedOutAt = formatTimeFromIso(checkoutIso);
    }
  });
  return { ok: true, checkedOutIso: checkoutIso };
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
  const checkoutStudent = state.students.find((student) => student.id === checkin.studentId);
  await recordAuditLog("checkout_created", "checkin", checkin.id, checkoutStudent?.name || checkin.studentId || "Aluno", `Checkout de ${checkoutStudent?.name || "aluno"} registrado.`, {
    studentId: checkin.studentId,
    roomId: checkin.roomId,
    roomName: checkin.roomName,
    checkedOutAt: checkedOutIso
  });
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
  state.familyLinkRequests = [];
  state.dashboardInfo = "";
  familyNetworkContext.members = [];
  familyNetworkContext.familyId = "";
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
  const normalizedRole = normalizeRole(role);
  const inviteLabel =
    normalizedRole === "admin"
      ? "Admin"
      : normalizedRole === "equipe"
        ? "Equipe"
        : "DNMS Kids";
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
  const name = normalizePersonName(els.signupName.value);
  if (els.signupName) {
    els.signupName.value = name;
  }
  const birthDateRaw = els.signupBirth.value;
  const birthDate = normalizeBirthDateInput(birthDateRaw);
  const civilStatus = els.signupCivilStatus.value.trim();
  const phoneDdd = (els.signupPhoneDdd?.value || "").replace(/\D/g, "").slice(0, 2);
  const phoneNumberRaw = (els.signupPhone.value || "").replace(/\D/g, "");
  const phoneNational = buildNationalPhoneFromParts(phoneDdd, phoneNumberRaw);
  const phone = formatPhoneForStorage(phoneNational);
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
  if (!isInviteFlow && phoneNational.length < 10) {
    alert("Informe um celular valido do responsavel.");
    return;
  }
  if (!isInviteFlow && (!birthDate || !civilStatus || !phone || phoneNational.length < 10)) {
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
  if (!isPasswordRecoveryUrl()) {
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

function isPasswordRecoveryUrl() {
  const hashValue = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hashValue || "");
  const queryParams = new URLSearchParams(window.location.search || "");
  const type = (hashParams.get("type") || queryParams.get("type") || "").toLowerCase();
  return type === "recovery";
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
  await supabaseClient.auth.signOut();
  state.session = null;
  state.students = [];
  state.rooms = [];
  state.checkins = [];
  state.profiles = [];
  state.auditLogs = [];
  state.schedules = [];
  state.tips = [];
  state.tipReads = [];
  state.familyLinkRequests = [];
  state.dashboardInfo = "";
  stopGoogleSheetWatcher();
  try {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  } catch (_) {}
  render();
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
  myDataContext.phone = formatPhoneForDisplay(profile.phone || "");
  myDataContext.address = profile.address || "";
  myDataContext.photoUrl = profile.photo_url || "";

  if (els.myDataName) {
    els.myDataName.value = profile.name || "";
  }
  if (els.myDataEmail) {
    els.myDataEmail.value = profile.email || "";
  }
  if (els.myDataPhone) {
    els.myDataPhone.value = formatPhoneForDisplay(profile.phone || "");
  }
  if (els.myDataAddress) {
    els.myDataAddress.value = profile.address || "";
  }
  if (els.myDataPhoto) {
    els.myDataPhoto.value = "";
  }
  setPhotoPreviewUrl(els.myDataPhotoPreview, profile.photo_url || getStudentPhotoPlaceholderUrl());
  if (els.familyLinkStatus) {
    els.familyLinkStatus.textContent = "";
  }
  if (els.familyLinkEmail) {
    els.familyLinkEmail.value = "";
  }
  await loadMyFamilyNetwork();
  renderMyFamilyNetwork();
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
  renderMyFamilyNetwork();
}

async function loadMyFamilyNetwork() {
  familyNetworkContext.members = [];
  familyNetworkContext.familyId = "";
  if (!supabaseClient || normalizeRole(state.session?.role || "") !== "responsavel") {
    return;
  }
  const { data, error } = await supabaseClient.rpc("get_my_family_network");
  if (error) {
    console.warn("Falha ao carregar rede familiar", error);
    return;
  }
  familyNetworkContext.familyId = data?.family_id || "";
  familyNetworkContext.members = Array.isArray(data?.members) ? data.members : [];
}

function renderMyFamilyNetwork() {
  const isResponsavel = normalizeRole(state.session?.role || "") === "responsavel";
  if (els.familyNetworkPanel) {
    els.familyNetworkPanel.style.display = isResponsavel ? "grid" : "none";
  }
  if (!isResponsavel) {
    return;
  }
  if (els.familyNetworkList) {
    const members = familyNetworkContext.members || [];
    const pendingRequests = (state.familyLinkRequests || []).filter(
      (request) =>
        request.status === "pending" &&
        !isFamilyLinkRequestExpired(request) &&
        (request.requesterId === state.session?.id || request.targetId === state.session?.id)
    );
    if (!members.length && !pendingRequests.length) {
      els.familyNetworkList.textContent = "Voce ainda nao tem outro responsavel vinculado.";
    } else {
      const memberHtml = members
        .map((member) => {
          const current = member.id === state.session?.id ? " (voce)" : "";
          return `<div><strong>${escapeHtml(member.name || "Responsavel")}${current}</strong><br /><span>${escapeHtml(member.email || "-")}</span></div>`;
        })
        .join("");
      const pendingHtml = pendingRequests
        .map((request) => {
          const invitedByMe = request.requesterId === state.session?.id;
          const name = invitedByMe
            ? request.targetName || "Responsavel"
            : request.requesterName || "Responsavel";
          const status = invitedByMe ? "Aguardando aceite" : "Convite pendente";
          return `<div><strong>${escapeHtml(name)}</strong><br /><span>${escapeHtml(status)} ate ${escapeHtml(formatDateTimeFromIso(request.expiresAt))}</span></div>`;
        })
        .join("");
      els.familyNetworkList.innerHTML = `${memberHtml}${pendingHtml}`;
    }
  }
}

async function handleLinkFamilyResponsible() {
  if (!supabaseClient || normalizeRole(state.session?.role || "") !== "responsavel") {
    alert("Somente responsaveis podem vincular rede familiar.");
    return;
  }
  const email = String(els.familyLinkEmail?.value || "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    alert("Informe um email valido do responsavel.");
    return;
  }
  if (email === String(state.session?.email || "").trim().toLowerCase()) {
    alert("Informe o email de outro responsavel.");
    return;
  }
  if (!confirm(`Vincular ${email} a sua rede familiar? Ele tera acesso as mesmas criancas da familia.`)) {
    return;
  }

  const { data, error } = await supabaseClient.rpc("request_family_link", { target_email: email });
  if (error) {
    const message = String(error.message || "");
    if (message.includes("family_link_target_not_found")) {
      alert("Responsavel nao encontrado. O email precisa estar cadastrado como responsavel antes do convite.");
    } else if (message.includes("family_link_self_not_allowed")) {
      alert("Informe o email de outro responsavel.");
    } else {
      alert(`Falha ao vincular responsavel: ${error.message || "erro inesperado"}`);
    }
    return;
  }

  if (els.familyLinkEmail) {
    els.familyLinkEmail.value = "";
  }
  if (els.familyLinkStatus) {
    if (data?.status === "already_linked") {
      els.familyLinkStatus.textContent = `${data?.target_name || "Responsavel"} ja esta na sua rede familiar.`;
    } else {
      els.familyLinkStatus.textContent = `Convite enviado dentro do app para ${data?.target_name || email}. O vinculo fica pendente por 7 dias.`;
    }
  }
  await fetchDashboardData();
  await loadMyFamilyNetwork();
  renderMyFamilyNetwork();
  render();
}

async function handleSaveMyData(event) {
  event.preventDefault();
  if (!state.session) {
    return;
  }
  const name = normalizePersonName(els.myDataName?.value || "");
  if (els.myDataName) {
    els.myDataName.value = name;
  }
  const email = String(els.myDataEmail?.value || "").trim().toLowerCase();
  const phone = formatPhoneForStorage(String(els.myDataPhone?.value || "").trim());
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
        phone: formatPhoneForDisplay(refreshed.phone || ""),
        address: refreshed.address || "",
        photoUrl: refreshed.photo_url || ""
      };
    } else {
      state.session = {
        ...state.session,
        name,
        phone: formatPhoneForDisplay(phone),
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
  try {
    const { data: rpcData, error: rpcError } = await supabaseClient.rpc("get_invite_meta", { invite_token: token });
    if (!rpcError && rpcData) {
      if (rpcData.status && rpcData.status !== "pending") {
        return { ok: false, message: "Convite ja utilizado." };
      }
      const rpcRole = normalizeRole(rpcData.role || "");
      if (!["dnms_kids", "equipe", "admin"].includes(rpcRole)) {
        return { ok: false, message: "Convite invalido para este cadastro." };
      }
      if (rpcData.expires_at && new Date(rpcData.expires_at).getTime() < Date.now()) {
        return { ok: false, message: "Convite expirado." };
      }
      return { ok: true, role: rpcRole, data: rpcData };
    }
  } catch (_) {
    // Ambientes antigos seguem pelo caminho legado abaixo.
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
  try {
    const { data, error } = await supabaseClient.rpc("accept_invite_token", {
      invite_token: token,
      target_email: email,
      expected_role: expectedRole || null
    });
    if (!error && data?.ok !== false) {
      return { ok: true, data };
    }
  } catch (_) {
    // Ambientes antigos seguem pelo caminho legado abaixo.
  }

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
    return;
  }

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
    els.manageUsersList.innerHTML = `<div class="summary">Nenhum usuario encontrado para "${escapeHtml(searchTerm)}".</div>`;
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
      <strong>${escapeHtml(profile.name || "Usuario")}</strong>
      <span class="muted">${escapeHtml(profile.email || "-")}</span>
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
        `<option value="${escapeAttribute(role)}" ${normalizeRole(selectedProfile.role) === role ? "selected" : ""}>${formatRole(role)}</option>`
    )
    .join("");
  els.manageUserEditor.innerHTML = `
    <strong>Usuario selecionado: ${escapeHtml(selectedProfile.name || "Usuario")}</strong><br />
    <span class="muted">${escapeHtml(selectedProfile.email || "-")}</span>
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

function printPresenceQr() {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!printWindow) {
    alert("Nao foi possivel abrir a janela de impressao do QR.");
    return;
  }
  printWindow.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>QR de check-in presencial</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Arial, "Segoe UI", sans-serif;
      color: #111;
      background: #fff;
      text-align: center;
    }
    main {
      display: grid;
      justify-items: center;
      gap: 10mm;
      width: 100%;
    }
    img {
      width: 120mm;
      height: 120mm;
      image-rendering: pixelated;
    }
    h1 {
      margin: 0;
      font-size: 24pt;
      line-height: 1.15;
      letter-spacing: 0;
    }
    p {
      margin: 0;
      font-size: 14pt;
      line-height: 1.35;
    }
    code {
      font-size: 11pt;
      overflow-wrap: anywhere;
    }
  </style>
</head>
<body>
  <main>
    <img src="${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}qr-checkin-presencial.svg" alt="QR Code de check-in presencial" />
    <h1>Check-in presencial DNMS Kids</h1>
    <p>Use a camera do app para confirmar presenca no local.</p>
    <code>DNMS-CHECKIN-PRESENCIAL</code>
  </main>
  <script>
    window.addEventListener("load", () => {
      window.print();
    });
  </script>
</body>
</html>`);
  printWindow.document.close();
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
    els.familyList.innerHTML = "";
    els.familyList.style.display = "none";
    els.familyEditor.innerHTML = "";
    familyContext.selectedProfileId = "";
    return;
  }

  els.familyList.style.display = "";
  if (!filtered.length) {
    els.familyList.innerHTML = `<div class="summary">Nenhuma familia encontrada.</div>`;
    els.familyEditor.innerHTML = "";
    familyContext.selectedProfileId = "";
    return;
  }

  if (!filtered.some((entry) => entry.profile.id === familyContext.selectedProfileId)) {
    const directMatch =
      filtered.find((entry) =>
        normalizeMatchText(`${entry.profile.name || ""} ${entry.profile.email || ""} ${entry.profile.phone || ""}`).includes(search)
      ) || filtered[0];
    familyContext.selectedProfileId = directMatch.profile.id;
  }

  els.familyList.innerHTML = "";
  filtered.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `list-item ${familyContext.selectedProfileId === entry.profile.id ? "is-selected" : ""}`;
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.innerHTML = `
      <strong>${escapeHtml(entry.profile.name || "Responsavel")}</strong>
      <span class="muted">${escapeHtml(entry.profile.email || "-")}</span>
      <span class="muted">${escapeHtml(formatPhoneForDisplay(entry.profile.phone || "") || "-")} | Filhos: ${entry.children.length}</span>
      <span class="muted">${familyContext.selectedProfileId === entry.profile.id ? "Dados abertos" : "Ver dados"}</span>
    `;
    const selectFamily = () => {
      familyContext.selectedProfileId = entry.profile.id;
      renderFamiliesPanel();
    };
    item.addEventListener("click", selectFamily);
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectFamily();
      }
    });
    els.familyList.appendChild(item);
  });

  const selected = filtered.find((entry) => entry.profile.id === familyContext.selectedProfileId) || null;
  if (!selected) {
    els.familyEditor.innerHTML = "";
    return;
  }
  const canManageResponsible = canManageResponsibleProfile(selected.profile);
  const canDelete = canManageResponsible;
  const canManageNetwork = canManageFamilyNetwork(selected.profile);
  const networkMembers = selected.networkMembers || [selected.profile];
  const pendingRequests = selected.pendingRequests || [];
  const networkChildren = selected.networkChildren || selected.children || [];
  const assignableStudents = getFamilyAssignableStudents(
    networkMembers.map((member) => member.id),
    networkChildren
  );
  const assignOptions = assignableStudents
    .map((student) => `<option value="${escapeAttribute(student.id)}">${escapeHtml(student.name)} - ${escapeHtml(student.className || getClassForBirth(student.birth))}</option>`)
    .join("");
  const networkHtml = networkMembers.length
    ? networkMembers
        .map((member) => {
          const isSelected = member.id === selected.profile.id;
          const canRemoveMember = canManageNetwork && member.id !== selected.profile.id;
          return `
      <div class="list-item family-network-member">
        <div>
          <strong>${escapeHtml(member.name || "Responsavel")}${isSelected ? " (selecionado)" : ""}</strong>
          <span class="muted">${escapeHtml(member.email || "-")}</span>
          <span class="muted">${escapeHtml(formatPhoneForDisplay(member.phone || "") || "-")}</span>
        </div>
        ${
          canRemoveMember
            ? `<button type="button" class="danger" data-family-remove-member="${escapeAttribute(member.id)}">Remover da rede</button>`
            : ""
        }
      </div>
    `;
        })
        .join("")
    : `<div class="summary">Nenhum responsavel vinculado.</div>`;
  const pendingHtml = pendingRequests.length
    ? pendingRequests
        .map(
          (request) => `
      <div class="list-item">
        <strong>${escapeHtml(request.targetName || request.requesterName || "Responsavel pendente")}</strong>
        <span class="muted">Solicitacao pendente ate ${escapeHtml(formatDateTimeFromIso(request.expiresAt))}</span>
      </div>
    `
        )
        .join("")
    : `<div class="summary">Nenhuma solicitacao pendente.</div>`;
  const childrenHtml = networkChildren.length
    ? networkChildren
        .map(
          (child) => {
            const childGuardianNames = getStudentGuardianNames(child);
            const primaryGuardianName = child.guardian || child.owner || "-";
            const linkedGuardianNames = childGuardianNames.filter(
              (name) => normalizeMatchText(name) !== normalizeMatchText(primaryGuardianName)
            );
            return `
      <div class="list-item">
        <strong>${escapeHtml(child.name)}</strong>
        <span class="muted">Turma: ${escapeHtml(child.className || getClassForBirth(child.birth))}</span>
        <span class="muted">Responsavel principal: ${escapeHtml(primaryGuardianName)}</span>
        <span class="muted">Vinculados: ${escapeHtml(linkedGuardianNames.join(", ") || "-")}</span>
        <div class="actions">
          ${canEditStudent(child) ? `<button type="button" class="ghost" data-family-edit-child="${escapeAttribute(child.id)}">Editar crianca</button>` : ""}
          <button type="button" class="primary" data-family-checkin-child="${escapeAttribute(child.id)}">Check-in</button>
        </div>
      </div>
    `;
          }
        )
        .join("")
    : `<div class="summary">Nenhuma crianca vinculada.</div>`;

  els.familyEditor.innerHTML = `
    <div class="family-editor-header">
      <div class="family-editor-title">
        <strong>${escapeHtml(selected.profile.name || "Responsavel selecionado")}</strong>
        <span>${escapeHtml(selected.profile.email || "-")}</span>
        <span>${escapeHtml(formatPhoneForDisplay(selected.profile.phone || "") || "-")}</span>
      </div>
      <span class="pill">${networkChildren.length} crianca(s) na familia</span>
    </div>
    <div class="family-editor-section">
      <strong>Dados do responsavel</strong>
      <label class="field">Nome
        <input id="familyEditName" type="text" value="${escapeAttribute(selected.profile.name || "")}" ${canManageResponsible ? "" : "disabled"} />
      </label>
      <label class="field">Email
        <input id="familyEditEmail" type="email" value="${escapeAttribute(selected.profile.email || "")}" readonly />
      </label>
      <label class="field">Telefone
        <input id="familyEditPhone" type="text" value="${escapeAttribute(formatPhoneForDisplay(selected.profile.phone || ""))}" ${canManageResponsible ? "" : "disabled"} />
      </label>
      <label class="field">Endereco
        <input id="familyEditAddress" type="text" value="${escapeAttribute(selected.profile.address || "")}" ${canManageResponsible ? "" : "disabled"} />
      </label>
      <div class="actions">
        <button id="btnFamilySaveProfile" type="button" class="primary" ${canManageResponsible ? "" : "disabled"}>Salvar responsavel</button>
        <button id="btnFamilyAddChild" type="button" class="ghost" ${canManageResponsible ? "" : "disabled"}>Adicionar crianca</button>
      </div>
    </div>
    <div class="family-editor-section">
      <strong>Rede familiar</strong>
      <div class="family-network-list">${networkHtml}</div>
      <details class="compact-panel">
        <summary>Solicitacoes pendentes</summary>
        <div class="family-network-list">${pendingHtml}</div>
      </details>
      ${
        canManageNetwork
          ? `
        <label class="field">Adicionar responsavel a rede
          <input id="familyNetworkAddEmail" type="email" placeholder="email@exemplo.com" />
        </label>
        <div class="actions">
          <button id="btnFamilyNetworkAddResponsible" type="button" class="ghost">Adicionar responsavel</button>
        </div>
      `
          : `<div class="summary">Equipe pode visualizar a rede familiar, sem alterar vinculos.</div>`
      }
    </div>
    <div class="family-editor-section">
      <strong>Criancas da familia</strong>
      <div class="family-children-list">${childrenHtml}</div>
    </div>
    <div class="family-editor-section">
      <label class="field">Vincular crianca existente
        <select id="familyAssignStudentId" ${canManageResponsible ? "" : "disabled"}>
          <option value="">Selecione uma crianca</option>
          ${assignOptions}
        </select>
      </label>
      <div class="actions">
        <button id="btnFamilyAssignStudent" type="button" class="ghost" ${canManageResponsible ? "" : "disabled"}>Vincular crianca</button>
      </div>
    </div>
    ${
      canDelete
        ? `
      <div class="family-editor-section">
        <div class="summary">
        <strong>Excluir usuario</strong><br />
        Digite o nome para confirmar: <strong>${escapeHtml(selected.profile.name || "-")}</strong>
        <label class="field">
          <input id="familyDeleteConfirmName" type="text" placeholder="Digite o nome exatamente" />
        </label>
        <button id="btnFamilyDeleteUser" type="button" class="danger">Excluir usuario</button>
      </div>
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
  document.getElementById("btnFamilyNetworkAddResponsible")?.addEventListener("click", async () => {
    const email = String(document.getElementById("familyNetworkAddEmail")?.value || "").trim().toLowerCase();
    await adminAddResponsibleToFamilyNetwork(selected.profile, email);
  });
  document.querySelectorAll("[data-family-remove-member]").forEach((button) => {
    button.addEventListener("click", async () => {
      const profileId = button.getAttribute("data-family-remove-member");
      const profile = (state.profiles || []).find((item) => item.id === profileId);
      await adminRemoveResponsibleFromFamilyNetwork(selected.profile, profile);
    });
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
    getStudentGuardianProfileIds(student).forEach((key) => {
      if (!childrenByGuardian.has(key)) {
        childrenByGuardian.set(key, []);
      }
      childrenByGuardian.get(key).push(student);
    });
  });
  const responsibleProfiles = (state.profiles || []).filter((profile) => normalizeRole(profile.role) === "responsavel");
  const membersByFamily = new Map();
  responsibleProfiles.forEach((profile) => {
    const familyId = getProfileFamilyId(profile);
    if (!membersByFamily.has(familyId)) {
      membersByFamily.set(familyId, []);
    }
    membersByFamily.get(familyId).push(profile);
  });
  membersByFamily.forEach((members) => members.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))));
  const result = [];
  (state.profiles || []).forEach((profile) => {
    const role = normalizeRole(profile.role);
    const children = childrenByGuardian.get(profile.id) || [];
    const shouldInclude = isSadmin() || role === "responsavel" || children.length > 0;
    if (!shouldInclude) {
      return;
    }
    const familyId = role === "responsavel" ? getProfileFamilyId(profile) : "";
    const networkMembers = role === "responsavel" ? membersByFamily.get(familyId) || [profile] : [profile];
    const networkChildren = role === "responsavel" ? getChildrenForFamilyNetwork(networkMembers) : children;
    const pendingRequests = role === "responsavel" ? getPendingFamilyRequestsForMembers(networkMembers) : [];
    result.push({ profile, children, familyId, networkMembers, networkChildren, pendingRequests });
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
    const memberBlob = (entry.networkMembers || [])
      .map((member) => `${member.name || ""} ${member.email || ""} ${member.phone || ""}`)
      .join(" ");
    const childBlob = (entry.networkChildren || entry.children || []).map((child) => child.name || "").join(" ");
    const blob = normalizeMatchText(
      `${entry.profile.name || ""} ${entry.profile.email || ""} ${entry.profile.phone || ""} ${memberBlob} ${childBlob}`
    );
    return blob.includes(search);
  });
  return { search, filtered };
}

function getProfileFamilyId(profile) {
  if (!profile) {
    return "";
  }
  return String(profile.familyId || profile.family_id || profile.id || "").trim();
}

function getChildrenForFamilyNetwork(members = []) {
  const memberIds = new Set(members.map((member) => member.id).filter(Boolean));
  const memberNames = new Set(members.map((member) => normalizeMatchText(member.name || "")).filter(Boolean));
  return (state.students || [])
    .filter((student) => {
      const guardianIds = getStudentGuardianProfileIds(student);
      if (guardianIds.some((id) => memberIds.has(id))) {
        return true;
      }
      const primaryName = normalizeMatchText(student.guardian || student.owner || "");
      return primaryName && memberNames.has(primaryName);
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function getPendingFamilyRequestsForMembers(members = []) {
  const memberIds = new Set(members.map((member) => member.id).filter(Boolean));
  return (state.familyLinkRequests || [])
    .filter(
      (request) =>
        request.status === "pending" && (memberIds.has(request.requesterId) || memberIds.has(request.targetId))
    )
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function getStudentGuardianNames(student) {
  const names = getStudentGuardianProfileIds(student)
    .map((id) => (state.profiles || []).find((profile) => profile.id === id)?.name || "")
    .filter(Boolean);
  const primaryName = student?.guardian || student?.owner || "";
  if (primaryName && !names.some((name) => normalizeMatchText(name) === normalizeMatchText(primaryName))) {
    names.unshift(primaryName);
  }
  return Array.from(new Set(names));
}

function syncFamilyLinksInMemory(familyId) {
  const members = (state.profiles || []).filter(
    (profile) => normalizeRole(profile.role) === "responsavel" && getProfileFamilyId(profile) === familyId
  );
  const children = getChildrenForFamilyNetwork(members);
  children.forEach((student) => {
    const index = state.students.findIndex((item) => item.id === student.id);
    if (index < 0) {
      return;
    }
    const guardianProfileIds = getStudentGuardianProfileIds(state.students[index]);
    members.forEach((member) => {
      if (!guardianProfileIds.includes(member.id)) {
        guardianProfileIds.push(member.id);
      }
    });
    state.students[index] = { ...state.students[index], guardianProfileIds };
  });
}

function splitResponsibleFromFamilyInMemory(targetProfile) {
  const previousFamilyId = getProfileFamilyId(targetProfile);
  const targetName = normalizeMatchText(targetProfile.name || "");
  const remainingMembers = (state.profiles || []).filter(
    (profile) =>
      profile.id !== targetProfile.id &&
      normalizeRole(profile.role) === "responsavel" &&
      getProfileFamilyId(profile) === previousFamilyId
  );
  const remainingNames = new Set(remainingMembers.map((member) => normalizeMatchText(member.name || "")).filter(Boolean));
  state.profiles = (state.profiles || []).map((profile) =>
    profile.id === targetProfile.id ? { ...profile, familyId: profile.id } : profile
  );
  state.students = (state.students || []).map((student) => {
    const primaryName = normalizeMatchText(student.guardian || student.owner || "");
    let guardianProfileIds = getStudentGuardianProfileIds(student);
    if (primaryName === targetName) {
      guardianProfileIds = guardianProfileIds.filter((id) => id === targetProfile.id);
    } else if (remainingNames.has(primaryName)) {
      guardianProfileIds = guardianProfileIds.filter((id) => id !== targetProfile.id);
    }
    return { ...student, guardianProfileIds };
  });
}

function getFamilyAssignableStudents(profileIds, selectedChildren = []) {
  const ids = Array.isArray(profileIds) ? profileIds : [profileIds];
  const profileIdSet = new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  const selectedIds = new Set((selectedChildren || []).map((child) => child.id));
  return (state.students || [])
    .filter((student) => {
      if (selectedIds.has(student.id)) {
        return false;
      }
      const guardianIds = getStudentGuardianProfileIds(student);
      return !guardianIds.some((id) => profileIdSet.has(id));
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

async function deleteProfileAndOwnedStudents(profile) {
  if (!supabaseClient || !profile?.id) {
    return { ok: false, message: "Banco de dados indisponivel para excluir usuario." };
  }
  const { data, error } = await supabaseClient.rpc("delete_user_account", {
    target_profile_id: profile.id
  });
  if (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes("delete_user_account") || message.includes("function") || error.code === "42883") {
      return {
        ok: false,
        message: "Falha ao excluir usuario: aplique o patch supabase/patch_delete_user_account.sql no Supabase."
      };
    }
    return { ok: false, message: `Falha ao excluir usuario: ${error.message || "erro inesperado"}` };
  }
  const result = data || {};
  return {
    ok: true,
    deletedChildren: result.deleted_children || [],
    deletedPrimaryStudentIds: result.deleted_primary_student_ids || [],
    deletedAuthUser: result.deleted_auth_user === true
  };
}

async function getLinkedStudentIdsForProfile(profileId) {
  const { data, error } = await supabaseClient
    .from("student_guardians")
    .select("student_id")
    .eq("guardian_id", profileId);
  if (error) {
    console.warn("Falha ao buscar vinculos do usuario antes da exclusao", error);
    return [];
  }
  return (data || []).map((item) => item.student_id).filter(Boolean);
}

function getPrimaryStudentIdsForProfile(profile) {
  const profileName = normalizeMatchText(profile.name || "");
  return (state.students || [])
    .filter((student) => {
      const guardianName = normalizeMatchText(student.guardian || student.owner || "");
      if (guardianName && profileName && guardianName === profileName) {
        return true;
      }
      return !guardianName && getStudentGuardianProfileIds(student).includes(profile.id);
    })
    .map((student) => student.id)
    .filter(Boolean);
}

async function saveFamilyProfile(profileId) {
  if (!supabaseClient || !profileId) {
    return;
  }
  const profile = (state.profiles || []).find((item) => item.id === profileId);
  if (!canManageResponsibleProfile(profile)) {
    alert("Somente SADMIN/Admin podem editar qualquer responsavel nesta aba.");
    return;
  }
  const familyEditName = document.getElementById("familyEditName");
  const name = normalizePersonName(familyEditName?.value || "");
  if (familyEditName) {
    familyEditName.value = name;
  }
  const phone = formatPhoneForStorage(String(document.getElementById("familyEditPhone")?.value || "").trim());
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
  await recordAuditLog("user_updated", "profile", profileId, name, `Dados do usuario ${name} alterados.`, {
    phone,
    address
  });
  await fetchProfiles();
  render();
}

async function deleteFamilyUser(profile, typedName) {
  if (!profile) {
    return;
  }
  if (!canManageResponsibleProfile(profile)) {
    alert("Somente SADMIN/Admin podem excluir responsavel nesta aba.");
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
  const result = await deleteProfileAndOwnedStudents(profile);
  if (!result.ok) {
    alert(result.message);
    return;
  }
  await recordAuditLog("user_deleted", "profile", profile.id, profile.name || profile.email || profile.id, `Usuario ${expected} excluido.`, {
    deletedUserName: profile.name || "",
    deletedUserEmail: profile.email || "",
    deletedUserRole: normalizeRole(profile.role || ""),
    deletedChildren: result.deletedChildren || [],
    deletedBySelf: profile.id === state.session?.id
  });
  familyContext.selectedProfileId = "";
  await fetchProfiles();
  await fetchStudents();
  await fetchCheckins();
  render();
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
  if (!canManageResponsibleProfile(profile)) {
    alert("Somente SADMIN/Admin podem vincular criancas a responsavel nesta aba.");
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
    const linked = await linkGuardianToStudent(student.id, profile.name || "", profile.id);
    if (!linked) {
      alert("Falha ao vincular crianca ao responsavel selecionado.");
      return;
    }
    try {
      await supabaseClient.rpc("sync_student_family_guardians", {
        target_student_id: student.id,
        seed_guardian_id: profile.id
      });
    } catch (_) {
      // Ambientes sem a RPC seguem com o vinculo individual acima.
    }
    await recordAuditLog(
      "child_updated",
      "student",
      student.id,
      student.name,
      `Responsavel ${profile.name || profile.id} vinculado a crianca ${student.name}.`,
      {
        linkedGuardianId: profile.id,
        linkedGuardianName: profile.name || "",
        primaryGuardianName: student.guardian || student.owner || ""
      }
    );
    await fetchStudents();
  } else {
    const index = state.students.findIndex((item) => item.id === student.id);
    if (index >= 0) {
      const guardianProfileIds = getStudentGuardianProfileIds(state.students[index]);
      if (!guardianProfileIds.includes(profile.id)) {
        guardianProfileIds.push(profile.id);
      }
      state.students[index] = {
        ...state.students[index],
        guardianProfileIds,
        guardianProfileId: state.students[index].guardianProfileId || getPrimaryGuardianProfileId(state.students[index], guardianProfileIds)
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
  if (!supabaseClient || !(isSadmin() || isAdmin())) {
    alert("Somente SADMIN/Admin podem cadastrar responsavel nesta aba.");
    return;
  }
  const name = normalizePersonName(els.familyCreateName?.value || "");
  if (els.familyCreateName) {
    els.familyCreateName.value = name;
  }
  const birthRaw = String(els.familyCreateBirth?.value || "").trim();
  const birthDate = normalizeBirthDateInput(birthRaw);
  const civilStatus = String(els.familyCreateCivil?.value || "").trim();
  const phoneNational = normalizePhoneDigits(String(els.familyCreatePhone?.value || ""));
  const phone = formatPhoneForStorage(phoneNational);
  const email = String(els.familyCreateEmail?.value || "").trim().toLowerCase();
  const address = String(els.familyCreateAddress?.value || "").trim();
  if (!name || !birthDate || !civilStatus || !phone || !email || !isValidEmail(email)) {
    alert("Preencha os dados obrigatorios do responsavel.");
    return;
  }
  if (phoneNational.length < 10) {
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
  await recordAuditLog("user_created", "profile", createdUser.id, name, `Responsavel ${name} cadastrado.`, {
    email,
    phone,
    role: "responsavel"
  });
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
  await recordAuditLog("user_updated", "profile", profile.id, profile.name || profile.email || profile.id, `Acesso de ${profile.name || profile.email || profile.id} alterado para ${formatRole(nextRole)}.`, {
    previousRole: normalizeRole(profile.role || ""),
    nextRole
  });
  await fetchProfiles();
  render();
}

function canManageFamilyNetwork(profile) {
  return normalizeRole(profile?.role || "") === "responsavel" && (isSadmin() || isAdmin());
}

async function adminAddResponsibleToFamilyNetwork(anchorProfile, email) {
  if (!canManageFamilyNetwork(anchorProfile)) {
    alert("Somente SADMIN/Admin podem alterar a rede familiar nesta aba.");
    return;
  }
  if (!email || !isValidEmail(email)) {
    alert("Informe um email valido do responsavel.");
    return;
  }
  const target = (state.profiles || []).find(
    (profile) => String(profile.email || "").trim().toLowerCase() === email && normalizeRole(profile.role) === "responsavel"
  );
  if (!target) {
    alert("Responsavel nao encontrado. O email precisa estar cadastrado como responsavel.");
    return;
  }
  if (target.id === anchorProfile.id) {
    alert("Este responsavel ja e o responsavel selecionado.");
    return;
  }
  if (getProfileFamilyId(target) === getProfileFamilyId(anchorProfile)) {
    alert("Este responsavel ja esta na rede familiar selecionada.");
    return;
  }
  if (!confirm(`Adicionar ${target.name || email} a rede familiar de ${anchorProfile.name}?`)) {
    return;
  }

  if (supabaseClient) {
    const { data, error } = await supabaseClient.rpc("admin_link_family_responsible", {
      anchor_profile_id: anchorProfile.id,
      target_email: email
    });
    if (error) {
      alert(`Falha ao adicionar responsavel a rede: ${error.message || "erro inesperado"}`);
      return;
    }
    await recordAuditLog(
      "user_updated",
      "profile",
      target.id,
      target.name || target.email || target.id,
      `Responsavel ${target.name || target.email} adicionado a rede familiar de ${anchorProfile.name}.`,
      {
        anchorGuardianId: anchorProfile.id,
        linkedGuardianId: target.id,
        familyId: data?.family_id || getProfileFamilyId(anchorProfile)
      }
    );
    await fetchProfiles();
    await fetchStudents();
    await fetchDashboardData();
  } else {
    const familyId = getProfileFamilyId(anchorProfile);
    state.profiles = (state.profiles || []).map((profile) =>
      getProfileFamilyId(profile) === getProfileFamilyId(target) || profile.id === target.id
        ? { ...profile, familyId }
        : profile
    );
    syncFamilyLinksInMemory(familyId);
  }
  familyContext.selectedProfileId = anchorProfile.id;
  render();
}

async function adminRemoveResponsibleFromFamilyNetwork(anchorProfile, targetProfile) {
  if (!canManageFamilyNetwork(anchorProfile)) {
    alert("Somente SADMIN/Admin podem alterar a rede familiar nesta aba.");
    return;
  }
  if (!targetProfile?.id) {
    alert("Responsavel nao encontrado.");
    return;
  }
  if (targetProfile.id === anchorProfile.id) {
    alert("Selecione outro responsavel da rede para remover.");
    return;
  }
  if (!confirm(`Remover ${targetProfile.name || targetProfile.email} desta rede familiar?`)) {
    return;
  }

  if (supabaseClient) {
    const { data, error } = await supabaseClient.rpc("admin_unlink_family_responsible", {
      target_profile_id: targetProfile.id
    });
    if (error) {
      alert(`Falha ao remover responsavel da rede: ${error.message || "erro inesperado"}`);
      return;
    }
    await recordAuditLog(
      "user_updated",
      "profile",
      targetProfile.id,
      targetProfile.name || targetProfile.email || targetProfile.id,
      `Responsavel ${targetProfile.name || targetProfile.email} removido da rede familiar.`,
      {
        removedGuardianId: targetProfile.id,
        previousFamilyId: data?.previous_family_id || getProfileFamilyId(anchorProfile)
      }
    );
    await fetchProfiles();
    await fetchStudents();
    await fetchDashboardData();
  } else {
    splitResponsibleFromFamilyInMemory(targetProfile);
  }
  familyContext.selectedProfileId = anchorProfile.id;
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
  await recordAuditLog("user_updated", "profile", profile.id, sanitizedName, `Nome do usuario alterado para ${sanitizedName}.`, {
    previousName: profile.name || "",
    nextName: sanitizedName
  });
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
  const result = await deleteProfileAndOwnedStudents(profile);
  if (!result.ok) {
    alert(result.message);
    return;
  }
  await recordAuditLog("user_deleted", "profile", profile.id, profile.name || profile.email || profile.id, `Usuario ${profile.name || profile.email || profile.id} excluido.`, {
    deletedUserName: profile.name || "",
    deletedUserEmail: profile.email || "",
    deletedUserRole: normalizeRole(profile.role || ""),
    deletedChildren: result.deletedChildren || [],
    deletedBySelf: profile.id === state.session?.id
  });
  if (state.ui.selectedManageUserId === profile.id) {
    state.ui.selectedManageUserId = "";
  }
  await fetchProfiles();
  await fetchStudents();
  await fetchCheckins();
  render();
}

async function createRooms() {
  if (!canManageRooms()) {
    alert("Somente administradores podem criar ou editar eventos.");
    return;
  }
  const name = els.roomName.value.trim();
  const dateValue = els.roomDate.value;
  const startTimeValue = els.roomStartTime.value;
  const endTimeValue = els.roomEndTime.value;
  const classTargets = getSelectedRoomClasses();
  const classTarget = classTargets[0] || "";
  const recurrence = els.roomRecurrence.value;
  const isEditing = Boolean(roomFormContext.editingId);

  if (!name || !dateValue || !startTimeValue || !endTimeValue || !classTargets.length) {
    alert("Informe nome, data, horario de inicio, horario de termino e ao menos uma turma do evento.");
    return;
  }
  if (isEditing && classTargets.length !== 1) {
    alert("Selecione apenas uma turma ao editar uma sala.");
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

  const total = getRoomRecurrenceWeeks(recurrence);
  let createdCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let lastErrorMessage = "";
  for (let i = 0; i < total; i += 1) {
    const date = addDays(baseDate, i * 7);
    const dateLabel = formatDate(date);
    const dateIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
    for (const targetClass of classTargets) {
      const exists = state.rooms.some(
        (room) =>
          room.date === dateLabel &&
          room.name === name &&
          room.startTime === startTimeValue &&
          room.classTarget === targetClass
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
          class_target: targetClass,
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
  }
  if (supabaseClient) {
    await fetchRooms();
  }
  els.roomName.value = "";
  setSelectedRoomClasses([]);
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

function getSelectedRoomClasses() {
  if (!els.roomClass) {
    return [];
  }
  const selected = Array.from(els.roomClass.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.value)
    .filter(Boolean);
  return selected;
}

function setSelectedRoomClasses(classes = []) {
  if (!els.roomClass) {
    return;
  }
  const selected = new Set(classes.filter(Boolean));
  Array.from(els.roomClass.querySelectorAll('input[type="checkbox"]')).forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function getRoomRecurrenceWeeks(value) {
  if (!value || value === "none") {
    return 1;
  }
  const match = String(value).match(/^months:(\d+)$/);
  const months = match ? Number.parseInt(match[1], 10) : 0;
  if (!Number.isInteger(months) || months < 1 || months > 6) {
    return 1;
  }
  return months * RECURRENCE_WEEKS_PER_MONTH;
}

function openRoomDialog() {
  if (!canOperateRooms()) {
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
  if (!canOperateRooms()) {
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
  if (!canOpenRoomNow(room)) {
    alert("Equipe so pode abrir a sala no dia e dentro do horario programado.");
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
  await recordAuditLog("room_opened", "room", room.id, room.name, `Sala ${room.name} aberta.`, {
    classTarget: room.classTarget,
    date: room.date,
    openedAt: openedAtIso
  });
  render();
}

async function closeRoom(roomId, options = {}) {
  if (!canOperateRooms()) {
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
  if (!canCloseRoomNow(room)) {
    alert("Equipe so pode fechar a sala apos o horario de termino programado.");
    return;
  }
  const closedAtIso = new Date().toISOString();
  const checkoutResult = await checkoutOpenCheckinsForRoom(room.id, closedAtIso);
  if (!checkoutResult.ok) {
    alert(`Nao foi possivel fazer checkout automatico dos alunos: ${checkoutResult.message}`);
    return;
  }
  if (supabaseClient) {
    const { error } = await supabaseClient
      .from("rooms")
      .update({ status: "Fechada", closed_at: closedAtIso })
      .eq("id", room.id);
    if (error) {
      alert(`Falha ao fechar sala: ${error.message || "erro inesperado"}`);
      return;
    }
    await fetchRooms();
    await fetchCheckins();
  } else {
    room.status = "Fechada";
    room.closedAt = timeNow();
  }
  if (state.activeRoomId === room.id) {
    const openRooms = getOpenRoomsToday();
    state.activeRoomId = openRooms.length ? openRooms[0].id : "";
  }
  state.roomView = "closed";
  await recordAuditLog("room_closed", "room", room.id, room.name, `Sala ${room.name} fechada.`, {
    classTarget: room.classTarget,
    date: room.date,
    closedAt: closedAtIso
  });
  render();
}

async function reopenRoom(roomId) {
  if (!canManageRooms()) {
    alert("Somente administradores podem reabrir salas.");
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
  if (!canManageRooms()) {
    alert("Somente administradores podem excluir salas.");
    return;
  }
  if (!options.skipConfirm && !confirm("Tem certeza que deseja excluir esta sala?")) {
    return;
  }
  const deletedAtIso = new Date().toISOString();
  const checkoutResult = await checkoutOpenCheckinsForRoom(roomId, deletedAtIso);
  if (!checkoutResult.ok) {
    alert(`Nao foi possivel fazer checkout automatico dos alunos: ${checkoutResult.message}`);
    return;
  }
  if (supabaseClient) {
    const { error } = await supabaseClient.from("rooms").delete().eq("id", roomId);
    if (error) {
      alert(`Falha ao excluir sala: ${error.message || "erro inesperado"}`);
      return;
    }
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
  const canManageRoom = canManageRooms();
  const canOperateRoom = canOperateRooms();
  const students = getRoomCheckinStudents(room.id);
  if (els.roomDetailsTitle) {
    els.roomDetailsTitle.textContent = `Turma ${room.classTarget || "-"} (${room.status})`;
  }
  if (els.roomDetailsMeta) {
    els.roomDetailsMeta.innerHTML = `
      <strong>Evento:</strong> ${escapeHtml(room.name)}<br />
      <strong>Data:</strong> ${escapeHtml(room.date)}<br />
      <strong>Horario:</strong> ${escapeHtml(room.startTime || "-")}${room.endTime ? ` - ${escapeHtml(room.endTime)}` : ""}<br />
      <strong>Turma:</strong> ${escapeHtml(room.classTarget || "-")}<br />
      <strong>Abertura:</strong> ${escapeHtml(room.openedAt || "-")} | <strong>Fechamento:</strong> ${escapeHtml(room.closedAt || "-")}
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
        const name = document.createElement("strong");
        name.textContent = entry.name;
        item.appendChild(name);
        if (entry.student) {
          item.style.cursor = "pointer";
          item.addEventListener("click", () => openStudentDetailsDialog(entry.student));
        }
        els.roomDetailsStudents.appendChild(item);
      });
    }
  }
  if (els.btnRoomDialogOpen) {
    els.btnRoomDialogOpen.style.display = canOperateRoom ? "inline-flex" : "none";
    els.btnRoomDialogOpen.disabled = room.status === "Aberta" || !canOpenRoomNow(room);
  }
  if (els.btnRoomDialogEdit) {
    els.btnRoomDialogEdit.style.display = canManageRoom ? "inline-flex" : "none";
    els.btnRoomDialogEdit.disabled = false;
  }
  if (els.btnRoomDialogClose) {
    els.btnRoomDialogClose.style.display = canOperateRoom ? "inline-flex" : "none";
    els.btnRoomDialogClose.disabled = room.status !== "Aberta" || !canCloseRoomNow(room);
  }
}

async function handleRoomDialogOpen() {
  if (!state.selectedRoomId) {
    return;
  }
  const roomId = state.selectedRoomId;
  await openRoom(roomId);
  const room = state.rooms.find((item) => item.id === roomId);
  if (room?.status === "Aberta") {
    els.roomDetailsDialog?.close();
    return;
  }
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
  if (!canManageRooms()) {
    alert("Somente administradores podem editar salas.");
    return;
  }
  roomFormContext.editingId = room.id;
  els.roomName.value = room.name || "";
  els.roomDate.value = room.dateIso || "";
  els.roomStartTime.value = room.startTime || room.time || "";
  els.roomEndTime.value = room.endTime || "";
  setSelectedRoomClasses([room.classTarget || ""]);
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
  setSelectedRoomClasses([]);
}

function openStudentDialog(student) {
  if (!student && !canCreateStudent()) {
    alert("Sem permissao para cadastrar crianca.");
    return;
  }
  if (student && !canEditStudent(student)) {
    alert("Voce nao pode editar este aluno.");
    return;
  }
  const isResponsavel = state.session?.role === "responsavel" && !isAdmin() && !isEquipe();
  els.studentDialogTitle.textContent = student ? (isResponsavel ? "Editar crianca" : "Editar aluno") : (isResponsavel ? "Cadastrar crianca" : "Novo aluno");
  const id = student?.id || (supabaseClient ? "" : uid());
  studentDialogContext.guardianProfileId = student?.guardianProfileId || "";
  studentDialogContext.photoFile = null;
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
  studentDialogContext.photoFile = null;
  setStudentSaving(false);
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

function handleStudentPhotoInputChange(sourceInput, otherInput) {
  const file = sourceInput?.files?.[0] || null;
  studentDialogContext.photoFile = file;
  if (file && otherInput) {
    otherInput.value = "";
  }
  updatePhotoPreview(sourceInput, els.studentPhotoPreview);
}

function setStudentSaving(isSaving) {
  studentSaveContext.inProgress = Boolean(isSaving);
  if (els.studentSavingOverlay) {
    els.studentSavingOverlay.classList.toggle("is-visible", Boolean(isSaving));
    els.studentSavingOverlay.setAttribute("aria-hidden", isSaving ? "false" : "true");
  }
  if (els.btnSaveStudent) {
    els.btnSaveStudent.disabled = Boolean(isSaving);
    els.btnSaveStudent.textContent = isSaving ? "Salvando..." : "Salvar";
  }
  const controls = els.studentDialog?.querySelectorAll("input, textarea, select, button") || [];
  controls.forEach((control) => {
    if (control === els.btnSaveStudent) {
      return;
    }
    control.disabled = Boolean(isSaving);
  });
}

function findDuplicateStudentForPayload(payload, currentStudentId = "") {
  const targetKey = buildStudentDuplicateKey({
    name: payload.name,
    birth: payload.birth,
    guardian: payload.guardian,
    guardianProfileId: payload.guardianProfileId
  });
  const targetFamilyKey = buildStudentFamilyDuplicateKey({
    name: payload.name,
    birth: payload.birth,
    guardianProfileId: payload.guardianProfileId
  });
  if (!targetKey) {
    return null;
  }
  return (state.students || []).find((student) => {
    if (!student?.id || student.id === currentStudentId) {
      return false;
    }
    if (targetFamilyKey && buildStudentFamilyDuplicateKeys(student).includes(targetFamilyKey)) {
      return true;
    }
    return buildStudentDuplicateKeys(student).includes(targetKey);
  }) || null;
}

function buildStudentDuplicateKey(student) {
  return buildStudentDuplicateKeys(student)[0] || "";
}

function buildStudentDuplicateKeys(student) {
  const name = normalizeDuplicateText(student?.name || "");
  const birth = String(student?.birth || student?.birth_date || "").slice(0, 10);
  if (!name || !birth) {
    return [];
  }
  const guardianIds = getStudentGuardianProfileIds(student);
  if (guardianIds.length) {
    return guardianIds.map((guardianId) => `${name}|${birth}|id:${guardianId}`);
  }
  const guardianName = normalizeDuplicateText(student?.guardian || student?.primary_guardian_name || "");
  return guardianName ? [`${name}|${birth}|name:${guardianName}`] : [];
}

function buildStudentFamilyDuplicateKey(student) {
  return buildStudentFamilyDuplicateKeys(student)[0] || "";
}

function buildStudentFamilyDuplicateKeys(student) {
  const name = normalizeDuplicateText(student?.name || "");
  const birth = String(student?.birth || student?.birth_date || "").slice(0, 10);
  if (!name || !birth) {
    return [];
  }
  const familyIds = getStudentGuardianFamilyIds(student);
  return familyIds.map((familyId) => `${name}|${birth}|family:${familyId}`);
}

function getStudentGuardianFamilyIds(student) {
  const ids = getStudentGuardianProfileIds(student);
  const familyIds = ids
    .map((id) => {
      const profile = getKnownProfileById(id);
      return String(profile?.familyId || profile?.family_id || id || "").trim();
    })
    .filter(Boolean);
  const ownProfile = getKnownProfileById(student?.guardianProfileId || "");
  if (ownProfile?.familyId || ownProfile?.family_id) {
    familyIds.push(String(ownProfile.familyId || ownProfile.family_id));
  }
  return Array.from(new Set(familyIds));
}

function getKnownProfileById(profileId) {
  const id = String(profileId || "").trim();
  if (!id) {
    return null;
  }
  if (state.session?.id === id) {
    return state.session;
  }
  return (state.profiles || []).find((profile) => profile.id === id) || null;
}

function normalizeDuplicateText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function isDuplicateStudentError(error) {
  const message = String(error?.message || error?.details || "");
  return error?.code === "23505" || message.includes("duplicate_student") || message.includes("Esta crianca ja esta cadastrada");
}

async function saveStudent(event) {
  event.preventDefault();
  if (studentSaveContext.inProgress) {
    return;
  }
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
  if (existing && !canEditStudent(existing)) {
    alert("Voce nao pode editar este aluno.");
    return;
  }
  if (!existing && !canCreateStudent()) {
    alert("Sem permissao para cadastrar crianca.");
    return;
  }
  const birthRaw = els.studentBirth.value;
  const birthIso = normalizeBirthDateInput(birthRaw);
  if (birthRaw && !birthIso) {
    alert("Data de nascimento invalida. Use dd/mm/aaaa.");
    return;
  }
  const payload = {
    id: existing ? els.studentId.value : supabaseClient ? undefined : uid(),
    name: normalizePersonName(els.studentName.value),
    birth: birthIso,
    className: getClassForBirth(birthIso),
    guardian: guardianName,
    otherGuardians: isResponsavel ? "" : els.studentOther.value.trim(),
    phone: isResponsavel ? formatPhoneForStorage(state.session?.phone || "") : formatPhoneForStorage(els.studentPhone.value.trim()),
    address: isResponsavel ? "-" : els.studentAddress.value.trim(),
    notes: els.studentNotes.value.trim(),
    owner: ownerName,
    guardianProfileId,
    isVisitor
  };
  if (els.studentName) {
    els.studentName.value = payload.name;
  }
  if (!isResponsavel && !payload.phone && guardianResolution.profile.phone) {
    payload.phone = formatPhoneForStorage(guardianResolution.profile.phone);
  }
  const photoFile = getSelectedStudentPhotoFile();

  const missingCommon = !payload.name || !payload.birth || !payload.className;
  const missingAdminFields = !isResponsavel && (!payload.guardian || !payload.phone || !payload.address);
  if (missingCommon || missingAdminFields) {
    alert("Preencha todos os campos obrigatorios.");
    return;
  }
  if (findDuplicateStudentForPayload(payload, existing?.id || "")) {
    alert("Esta crianca ja esta cadastrada nesta familia.");
    return;
  }
  if (!confirm("Confirma salvar as alteracoes deste cadastro?")) {
    return;
  }

  setStudentSaving(true);
  try {
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
        alert(isDuplicateStudentError(error) ? "Esta crianca ja esta cadastrada nesta familia." : `Falha ao salvar aluno: ${error.message || "erro inesperado"}`);
        return;
      }
      if (!data?.id) {
        alert("Falha ao salvar aluno: cadastro sem identificador.");
        return;
      }
      if (!existing?.id) {
        const linked = await linkGuardianToStudent(data.id, payload.guardian, guardianProfileId);
        if (!linked) {
          await supabaseClient.from("students").delete().eq("id", data.id);
          alert("A crianca so pode ser cadastrada a um usuario valido.");
          return;
        }
      }
      if (photoFile) {
        const upload = await uploadStudentPhoto(data.id, photoFile);
        if (!upload.ok) {
          alert(`Falha ao atualizar foto do aluno: ${upload.error || "erro inesperado"}`);
          return;
        }
        const photoUpdate = await supabaseClient.from("students").update({ photo_url: upload.url }).eq("id", data.id);
        if (photoUpdate.error) {
          alert(`Falha ao salvar foto do aluno: ${photoUpdate.error.message || "erro inesperado"}`);
          return;
        }
      }
      await recordAuditLog(
        existing?.id ? "child_updated" : "child_created",
        "student",
        data.id,
        payload.name,
        existing?.id ? `Cadastro da crianca ${payload.name} alterado.` : `Crianca ${payload.name} cadastrada.`,
        {
          className: payload.className,
          guardianName: payload.guardian,
          guardianProfileId,
          isVisitor: payload.isVisitor
        }
      );
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
      await recordAuditLog(
        index >= 0 ? "child_updated" : "child_created",
        "student",
        payload.id,
        payload.name,
        index >= 0 ? `Cadastro da crianca ${payload.name} alterado.` : `Crianca ${payload.name} cadastrada.`,
        { className: payload.className, guardianName: payload.guardian, guardianProfileId, isVisitor: payload.isVisitor }
      );
    }

    els.studentDialog.close();
    render();
  } finally {
    setStudentSaving(false);
  }
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
    const result = await deleteStudentRecords(studentId);
    if (!result.ok) {
      alert(result.message);
      return;
    }
    await recordAuditLog("child_deleted", "student", student.id, student.name, `Crianca ${student.name} excluida.`, {
      className: student.className,
      guardianName: student.guardian
    });
    await fetchStudents();
    await fetchCheckins();
  } else {
    state.students = state.students.filter((item) => item.id !== studentId);
    state.checkins = state.checkins.filter((item) => item.studentId !== studentId);
    await recordAuditLog("child_deleted", "student", student.id, student.name, `Crianca ${student.name} excluida.`, {
      className: student.className,
      guardianName: student.guardian
    });
  }
  els.studentDialog?.close();
  render();
}

async function deleteStudentRecords(studentId) {
  const checkinsResult = await supabaseClient.from("checkins").delete().eq("student_id", studentId);
  if (checkinsResult.error) {
    return { ok: false, message: `Falha ao excluir check-ins da crianca: ${checkinsResult.error.message || "erro inesperado"}` };
  }
  const linksResult = await supabaseClient.from("student_guardians").delete().eq("student_id", studentId);
  if (linksResult.error) {
    return { ok: false, message: `Falha ao excluir vinculos da crianca: ${linksResult.error.message || "erro inesperado"}` };
  }
  const studentResult = await supabaseClient.from("students").delete().eq("id", studentId);
  if (studentResult.error) {
    return { ok: false, message: `Falha ao excluir crianca: ${studentResult.error.message || "erro inesperado"}` };
  }
  return { ok: true };
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
    await syncStudentFamilyGuardians(studentId, guardianId);
    return true;
  }
  const insertResult = await supabaseClient.from("student_guardians").insert({ student_id: studentId, guardian_id: guardianId });
  if (insertResult.error) {
    return false;
  }
  await syncStudentFamilyGuardians(studentId, guardianId);
  return true;
}

async function syncStudentFamilyGuardians(studentId, guardianId = "") {
  if (!supabaseClient || !studentId) {
    return;
  }
  const params = { target_student_id: studentId };
  if (guardianId) {
    params.seed_guardian_id = guardianId;
  }
  const { error } = await supabaseClient.rpc("sync_student_family_guardians", params);
  if (error) {
    const message = String(error.message || "");
    if (!message.includes("Function not found") && error.code !== "42883") {
      console.warn("Falha ao sincronizar rede familiar da crianca", error);
    }
  }
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
  const phone = formatPhoneForDisplay(profile?.phone || "");
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
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length > 11 && digits.slice(0, 2) === digits.slice(2, 4)) {
    digits = digits.slice(0, 2) + digits.slice(4);
  }
  if (digits.length > 11) {
    digits = digits.slice(-11);
  }
  return digits;
}

function formatPhoneForDisplay(value) {
  const digits = normalizePhoneDigits(value);
  if (digits.length < 10) {
    return String(value || "").trim();
  }
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length === 9) {
    return `+55 (${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }
  return `+55 (${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
}

function formatPhoneForStorage(value) {
  const digits = normalizePhoneDigits(value);
  if (digits.length < 10) {
    return "";
  }
  return formatPhoneForDisplay(digits);
}

function buildNationalPhoneFromParts(dddRaw, numberRaw) {
  const ddd = String(dddRaw || "").replace(/\D/g, "").slice(0, 2);
  const numberDigits = String(numberRaw || "").replace(/\D/g, "");
  if (!numberDigits) {
    return "";
  }
  if (numberDigits.length >= 10) {
    return normalizePhoneDigits(numberDigits);
  }
  return normalizePhoneDigits(`${ddd}${numberDigits}`);
}

function getStudentGuardianProfileIds(student) {
  const ids = Array.isArray(student?.guardianProfileIds) ? student.guardianProfileIds : [];
  const unique = new Set(ids.map((id) => String(id || "").trim()).filter(Boolean));
  const legacyId = String(student?.guardianProfileId || "").trim();
  if (legacyId) {
    unique.add(legacyId);
  }
  return Array.from(unique);
}

function getPrimaryGuardianProfileId(student, guardianProfileIds = []) {
  const ids = Array.from(new Set((guardianProfileIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (!ids.length) {
    return "";
  }
  const primaryName = normalizeMatchText(student?.primary_guardian_name || student?.guardian || "");
  if (primaryName) {
    const profile = (state.profiles || []).find((item) => ids.includes(item.id) && normalizeMatchText(item.name || "") === primaryName);
    if (profile?.id) {
      return profile.id;
    }
  }
  return ids[0];
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
        phone: formatPhoneForDisplay(profile.phone || ""),
        address: String(profile.address || "").trim()
      };
    }
  }
  const profileByName = findProfileByGuardianName(student.guardian);
  if (profileByName) {
    return {
      phone: formatPhoneForDisplay(profileByName.phone || ""),
      address: String(profileByName.address || "").trim()
    };
  }
  const guardianName = String(student.guardian || "").trim().toLowerCase();
  if (guardianName && String(state.session?.name || "").trim().toLowerCase() === guardianName) {
    return {
      phone: formatPhoneForDisplay(state.session?.phone || ""),
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

async function startQrCameraScan() {
  if (!els.qrCameraPreview || !els.qrDialogInput) {
    return;
  }
  if (!("BarcodeDetector" in window)) {
    showQrManualFallback("Camera sem leitor QR nativo. Digite ou cole o codigo exibido no local.");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showQrManualFallback("Camera indisponivel neste navegador. Digite ou cole o codigo exibido no local.");
    return;
  }
  try {
    stopQrCameraScan({ keepStatus: true });
    if (els.qrDialogStatus) {
      els.qrDialogStatus.textContent = "Aponte a camera para o QR de check-in presencial.";
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    parentCheckinContext.qrStream = stream;
    els.qrCameraPreview.srcObject = stream;
    els.qrCameraPreview.style.display = "block";
    await els.qrCameraPreview.play();
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const scan = async () => {
      if (!parentCheckinContext.qrStream || !els.qrDialog?.open) {
        stopQrCameraScan();
        return;
      }
      try {
        const codes = await detector.detect(els.qrCameraPreview);
        const value = String(codes?.[0]?.rawValue || "").trim();
        if (value) {
          els.qrDialogInput.value = value;
          stopQrCameraScan();
          handleQrCheckin(els.qrDialogInput, els.qrDialogStatus);
          return;
        }
      } catch (_error) {}
      parentCheckinContext.qrScanTimer = window.setTimeout(scan, 500);
    };
    scan();
  } catch (_error) {
    stopQrCameraScan({ keepStatus: true });
    showQrManualFallback("Nao foi possivel abrir a camera. Digite ou cole o codigo exibido no local.");
  }
}

function stopQrCameraScan(options = {}) {
  if (parentCheckinContext.qrScanTimer) {
    window.clearTimeout(parentCheckinContext.qrScanTimer);
    parentCheckinContext.qrScanTimer = null;
  }
  if (parentCheckinContext.qrStream) {
    parentCheckinContext.qrStream.getTracks().forEach((track) => track.stop());
    parentCheckinContext.qrStream = null;
  }
  if (els.qrCameraPreview) {
    els.qrCameraPreview.pause();
    els.qrCameraPreview.srcObject = null;
    els.qrCameraPreview.style.display = "none";
  }
  if (!options.keepStatus && els.qrDialogStatus) {
    els.qrDialogStatus.textContent = "";
  }
}

function showQrManualFallback(message) {
  if (els.qrDialogManualField) {
    els.qrDialogManualField.style.display = "";
  }
  if (els.btnQrDialogCheckin) {
    els.btnQrDialogCheckin.style.display = "";
  }
  if (els.btnStartQrCamera) {
    els.btnStartQrCamera.style.display = "";
  }
  if (els.qrDialogStatus) {
    els.qrDialogStatus.textContent = message;
  }
}

async function openQrDialog(options = {}) {
  if (!state.session) {
    alert("Autenticacao obrigatoria.");
    return;
  }
  if (state.session.role === "responsavel") {
    parentCheckinContext.presenceToken = "";
    parentCheckinContext.targetStudentId = options.studentId || "";
  }
  if (els.qrDialogStatus) {
    els.qrDialogStatus.textContent = "";
  }
  const isResponsibleQr = state.session.role === "responsavel";
  if (els.qrDialogLabel) {
    els.qrDialogLabel.textContent = isResponsibleQr ? "Codigo de presenca" : "QR Code do aluno";
  }
  if (els.qrDialogInput) {
    els.qrDialogInput.value = "";
    els.qrDialogInput.placeholder =
      isResponsibleQr ? "Codigo do QR de check-in" : "Cole o codigo do aluno";
  }
  if (els.qrDialogManualField) {
    els.qrDialogManualField.style.display = isResponsibleQr ? "none" : "";
  }
  if (els.btnStartQrCamera) {
    els.btnStartQrCamera.style.display = "none";
  }
  if (els.btnQrDialogCheckin) {
    els.btnQrDialogCheckin.style.display = isResponsibleQr ? "none" : "";
  }
  els.qrDialog?.showModal();
  if (isResponsibleQr) {
    await startQrCameraScan();
  }
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
  if (state.session?.role === "responsavel") {
    const owned = state.students.slice();
    if (!owned.length) {
      const message = "Nenhum filho cadastrado para check-in.";
      if (statusEl) {
        statusEl.textContent = message;
      } else {
        alert(message);
      }
      return;
    }
    parentCheckinContext.presenceToken = rawInput;
    stopQrCameraScan();
    if (inputEl) {
      inputEl.value = "";
    }
    const targetStudent = parentCheckinContext.targetStudentId
      ? owned.find((student) => student.id === parentCheckinContext.targetStudentId)
      : owned.length === 1
        ? owned[0]
        : null;
    if (parentCheckinContext.targetStudentId && !targetStudent) {
      parentCheckinContext.presenceToken = "";
      parentCheckinContext.targetStudentId = "";
      const message = "Sem permissao para check-in deste aluno.";
      if (statusEl) {
        statusEl.textContent = message;
      } else {
        alert(message);
      }
      return;
    }
    if (targetStudent) {
      const result = await handleManualCheckin(targetStudent.id, {
        silent: true,
        presenceToken: parentCheckinContext.presenceToken
      });
      if (!result.ok) {
        if (statusEl) {
          statusEl.textContent = result.message;
        } else {
          alert(result.message);
        }
        return;
      }
      parentCheckinContext.presenceToken = "";
      parentCheckinContext.targetStudentId = "";
      if (els.qrDialog?.open) {
        els.qrDialog.close();
      }
      alert(`Check-in confirmado para ${targetStudent.name}.`);
      return;
    }
    parentCheckinContext.targetStudentId = "";
    if (els.qrDialog?.open) {
      els.qrDialog.close();
    }
    openParentCheckinDialog(owned);
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
      <input type="checkbox" data-parent-checkin="${escapeAttribute(student.id)}" />
      <span>${escapeHtml(student.name)} - ${escapeHtml(student.className || getClassForBirth(student.birth))}</span>
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
    const result = await handleManualCheckin(id, {
      silent: true,
      presenceToken: parentCheckinContext.presenceToken
    });
    if (result.ok) {
      success += 1;
    } else {
      failed += 1;
    }
  }
  alert(`Check-in concluido. Sucesso: ${success}. Falhas: ${failed}.`);
  parentCheckinContext.presenceToken = "";
  parentCheckinContext.targetStudentId = "";
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
  const ageEligibility = getStudentAgeEligibility(student);
  if (!ageEligibility.ok) {
    return fail(ageEligibility.message);
  }
  if (!canCheckinStudent(student)) {
    return fail("Sem permissao para check-in deste aluno.");
  }

  const className = student.className || getClassForBirth(student.birth);
  const hasOpenRooms = state.rooms.some((item) => item.status === "Aberta");
  const roomForClass = getOpenRoomForClass(className);
  let room = getAvailableCheckinRoomForClass(className) || roomForClass;
  if (!hasOpenRooms) {
    return fail("Não existem salas abertas!");
  }
  if (!room || room.status !== "Aberta") {
    return fail(`Nao ha sala aberta para a turma ${className}. Abra uma sala com essa turma.`);
  }
  const checkinWindow = getCheckinWindowValidation(room);
  if (!checkinWindow.ok) {
    return fail(checkinWindow.message);
  }

  const activeCheckin = getOpenCheckinForStudent(studentId);
  if (activeCheckin) {
    return fail("Este aluno ja possui um check-in ativo. Faça checkout antes de registrar outro check-in.");
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
    let data;
    let error;
    if (state.session.role === "responsavel") {
      const presenceToken = String(options.presenceToken || "").trim();
      if (!presenceToken) {
        return fail("Escaneie o QR Code de check-in no local antes de confirmar.");
      }
      const rpcResult = await supabaseClient.rpc("parent_checkin_with_presence", {
        target_student_id: student.id,
        presence_token: presenceToken
      });
      error = rpcResult.error;
      data = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    } else {
      const insertResult = await supabaseClient
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
      data = insertResult.data;
      error = insertResult.error;
    }
    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (error.code === "23505" || message.includes("checkins_one_active_per_student")) {
        return fail("Este aluno ja possui um check-in ativo. Faça checkout antes de registrar outro check-in.");
      }
      if (message.includes("qr") || message.includes("presenca") || message.includes("presence")) {
        return fail("QR Code de check-in invalido.");
      }
      if (message.includes("checkin_window_closed") || message.includes("horario de check-in")) {
        return fail("Horario de check-in encerrado para esta aula.");
      }
      if (message.includes("student_age_out_of_range") || message.includes("student_class_mismatch_for_age")) {
        return fail("Crianca fora da faixa de idade para participacao neste ano.");
      }
      return fail(`Falha ao registrar check-in: ${error.message || "erro inesperado"}`);
    }
    if (!data?.id) {
      return fail("Falha ao registrar check-in: retorno invalido.");
    }
    record = {
      id: data.id,
      roomId: data.room_id,
      roomName: data.room_name_snapshot || room.name,
      studentId: data.student_id,
      className: data.class_name,
      notes: data.notes_snapshot || "",
      dateTime: formatDateTimeFromIso(data.checked_in_at),
      actor: state.session?.name || "",
      checkedOutAt: data.checked_out_at ? formatTimeFromIso(data.checked_out_at) : ""
    };
  }
  state.checkins.push(record);
  await recordAuditLog("checkin_created", "checkin", record.id, student.name, `Check-in de ${student.name} registrado.`, {
    studentId: student.id,
    roomId: room.id,
    roomName: room.name,
    className
  });
  showLabel(student, record, { autoPrint: true, openPreview: false });
  render();
  return { ok: true, message: `Check-in confirmado para ${student.name}.` };
}

async function printCurrentLabel(options = {}) {
  const checkinId = options.checkinId || labelContext.checkinId || "";
  const type = options.type === "reprint" ? "reprint" : "print";
  if (!shouldUseLocalPrintService()) {
    // Em celular/PWA mobile, localhost aponta para o proprio aparelho.
    // Check-in segue pelo listener do servico; reimpressao vira fila no Supabase.
    if (type === "reprint") {
      return requestRemoteReprint(checkinId, { silentFailure: options.silentFailure });
    }
    return true;
  }
  if (!els.labelPreview?.innerHTML) {
    return false;
  }
  const payload = {
    checkin_id: checkinId || uid(),
    conteudo: buildLabelDocumentHtml(els.labelPreview.innerHTML),
    tipo: type
  };
  const endpoint = type === "reprint" ? "/reprint" : "/print";
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
    return true;
  } catch (error) {
    console.warn("Falha ao enviar etiqueta para o servico de impressao", error);
    if (type === "reprint" && checkinId) {
      return requestRemoteReprint(checkinId, { silentFailure: options.silentFailure });
    }
    if (!options.silentFailure) {
      alert(`Falha ao imprimir: ${error?.message || "servico indisponivel"}`);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldUseLocalPrintService() {
  return !isMobileDevice();
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

async function requestRemoteReprint(checkinId, options = {}) {
  if (!supabaseClient || !checkinId) {
    if (!options.silentFailure) {
      alert("Nao foi possivel solicitar reimpressao remota.");
    }
    return false;
  }
  const { error } = await supabaseClient.from("print_jobs").insert({
    job_type: "reprint",
    checkin_id: checkinId,
    status: "pending"
  });
  if (error) {
    const duplicate = error.code === "23505" || String(error.message || "").includes("print_jobs_one_open");
    if (!options.silentFailure) {
      alert(duplicate ? "Essa reimpressao ja esta na fila." : `Falha ao solicitar reimpressao: ${error.message}`);
    }
    return duplicate;
  }
  if (!options.silentFailure) {
    alert("Reimpressao enviada para a fila da Brother.");
  }
  return true;
}

function showLabel(person, checkin, options = {}) {
  const className = checkin.className || getClassForBirth(person.birth);
  const guardian = person.guardian || "-";
  const notes = checkin?.notes || person?.notes || "-";
  const autoPrint = options.autoPrint === true;
  const openPreview = options.openPreview === true;
  const label = `
    <div class="label-name">${escapeHtml(person.name || "{{nome}}")}</div>
    <div class="label-body">
      <div class="label-line">Turma: ${escapeHtml(className || "{{turma}}")}</div>
      <div class="label-line">Responsavel: ${escapeHtml(guardian || "{{responsavel}}")}</div>
      <div class="label-line">Observacao: ${escapeHtml(notes || "{{observacao}}")}</div>
    </div>
  `;
  labelContext.checkinId = checkin?.id || "";
  els.labelPreview.innerHTML = label;
  if (openPreview) {
    els.labelDialog.showModal();
  }
  if (autoPrint) {
    if (shouldUseLocalPrintService()) {
      printCurrentLabel({ checkinId: checkin.id, type: "print", silentFailure: true });
    }
    return;
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
  const reportType = getLogReportType();
  if (reportType !== "attendance") {
    exportAuditCsv(reportType);
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
  downloadCsv(`frequencia_${periodLabel}.csv`, [header, ...csvRows]);
  render();
}

function exportAuditCsv(reportType) {
  const rows = getFilteredAuditRows(reportType);
  if (!rows.length) {
    alert("Nenhum evento encontrado para exportar.");
    return;
  }
  const header = ["Data", "Relatorio", "Acao", "Alvo", "Autor", "Perfil", "Detalhes"];
  const csvRows = rows.slice().sort(compareAuditRowsForExport).map((row) => [
    formatDateTimeFromIso(row.createdAt),
    formatReportType(reportType),
    formatAuditAction(row.actionType),
    row.targetName || "",
    row.actorName || "",
    formatRole(row.actorRole),
    row.details || formatAuditMetadata(row)
  ]);
  const startValue = els.logStart?.value || "inicio";
  const endValue = els.logEnd?.value || "fim";
  downloadCsv(`${reportType}_${startValue}_${endValue}.csv`, [header, ...csvRows]);
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
    formatPhoneForDisplay(entry.profile.phone || ""),
    entry.profile.address || "",
    entry.children.length,
    entry.children.map((child) => child.name).join(" | ")
  ]);
  const searchRaw = String(els.familySearch?.value || "").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
  const fileSuffix = searchRaw || "busca";
  downloadCsv(`familias_${fileSuffix}.csv`, [header, ...csvRows]);
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
  if (isSadmin() || isAdmin()) {
    return true;
  }
  if (isEquipe()) {
    return false;
  }
  return student.guardian === state.session.name || student.owner === state.session.name;
}

function canCreateStudent() {
  if (!state.session) {
    return false;
  }
  return isSadmin() || isAdmin() || isEquipe() || normalizeRole(state.session.role) === "responsavel";
}

function canDeleteStudent(student) {
  if (!state.session || !student) {
    return false;
  }
  if (isSadmin() || isAdmin()) {
    return true;
  }
  if (isEquipe()) {
    return false;
  }
  return normalizeRole(state.session.role) === "responsavel" && isStudentOwnedBySession(student);
}

function canCheckinStudent(student) {
  if (!state.session) {
    return false;
  }
  if (!getStudentAgeEligibility(student).ok) {
    return false;
  }
  if (isEquipe() || isAdmin()) {
    return true;
  }
  return isStudentOwnedBySession(student);
}

function isStudentOwnedBySession(student) {
  if (!state.session || !student) {
    return false;
  }
  if (getStudentGuardianProfileIds(student).includes(state.session.id)) {
    return true;
  }
  return student.guardian === state.session.name || student.owner === state.session.name;
}

function canManageResponsibleProfile(profile) {
  if (!profile) {
    return false;
  }
  if (isSadmin()) {
    return true;
  }
  if (!isAdmin()) {
    return false;
  }
  return normalizeRole(profile.role) === "responsavel";
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
      <div class="student-details-row"><strong>Turma:</strong><span>${escapeHtml(className || "-")}</span></div>
      <div class="student-details-row"><strong>Nascimento:</strong><span>${escapeHtml(birthLabel)}</span></div>
      <div class="student-details-row"><strong>Responsavel:</strong><span>${escapeHtml(student.guardian || "-")}</span></div>
      <div class="student-details-row"><strong>Telefone:</strong><span>${escapeHtml(contact.phone || "-")}</span></div>
      <div class="student-details-row"><strong>Endereco:</strong><span>${escapeHtml(contact.address || "-")}</span></div>
      <div class="student-details-row"><strong>Observacoes:</strong><span>${escapeHtml(student.notes || "")}</span></div>
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
  const content = await prepareStorageUploadContent(file);
  if (!content.ok) {
    return { ok: false, error: content.error };
  }
  const bucket = supabaseClient.storage.from(STORAGE_BUCKET);
  const { error } = await bucket.upload(path, content.body, { upsert: true, contentType: content.contentType });
  if (error) {
    console.warn("Falha no upload", error);
    return { ok: false, error: error.message };
  }
  const { data } = bucket.getPublicUrl(path);
  return { ok: true, url: data?.publicUrl || "", path };
}

function getSelectedStudentPhotoFile() {
  const selected = studentDialogContext.photoFile;
  if (selected instanceof File && selected.size > 0) {
    return selected;
  }
  const camera = els.studentPhotoCamera?.files?.[0] || null;
  const gallery = els.studentPhoto?.files?.[0] || null;
  if (camera instanceof File && camera.size > 0) {
    return camera;
  }
  if (gallery instanceof File && gallery.size > 0) {
    return gallery;
  }
  return null;
}

async function prepareStorageUploadContent(file) {
  if (!(file instanceof Blob)) {
    return { ok: false, error: "Arquivo de foto invalido." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "Arquivo de foto vazio. Selecione ou tire a foto novamente." };
  }
  const contentType = file.type || "image/jpeg";
  try {
    const buffer = await file.arrayBuffer();
    if (!buffer?.byteLength) {
      return { ok: false, error: "Arquivo de foto vazio. Selecione ou tire a foto novamente." };
    }
    return { ok: true, body: new Blob([buffer], { type: contentType }), contentType };
  } catch (error) {
    console.warn("Falha ao preparar arquivo para upload", error);
    return { ok: false, error: "Nao foi possivel ler a foto selecionada." };
  }
}

async function uploadStudentPhoto(studentId, file) {
  const ext = getFileExtension(file);
  const path = `students/${studentId}/profile-${Date.now()}-${uid()}.${ext}`;
  return uploadFileToStorage(path, file);
}

function canManageRooms() {
  return isSadmin() || isAdmin();
}

function canOperateRooms() {
  return canManageRooms() || isEquipe();
}

function canOpenRoomNow(room) {
  if (!room) {
    return false;
  }
  if (room.date !== formatToday()) {
    return false;
  }
  if (!isEquipe() || canManageRooms()) {
    return true;
  }
  const now = currentTimeValue();
  const start = room.startTime || room.time || "";
  const end = room.endTime || "";
  if (start && now < start) {
    return false;
  }
  if (end && now > end) {
    return false;
  }
  return true;
}

function canCloseRoomNow(room) {
  if (!room) {
    return false;
  }
  if (!isEquipe() || canManageRooms()) {
    return true;
  }
  const end = room.endTime || "";
  return !end || currentTimeValue() >= end;
}

function currentTimeValue() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

async function uploadProfilePhotoForUser(user, file) {
  if (!supabaseClient || !user?.id) {
    return { ok: false, error: "Usuario invalido." };
  }
  const ext = getFileExtension(file);
  const path = `profiles/${user.id}/profile-${Date.now()}-${uid()}.${ext}`;
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

function formatTodayIso() {
  const date = new Date();
  return formatDateIso(date);
}

function formatDateIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function isIsoDateBeforeToday(value) {
  const date = String(value || "").slice(0, 10);
  return Boolean(date) && date < formatTodayIso();
}

function isRoomPast(room) {
  if (!room) {
    return false;
  }
  if (room.dateIso) {
    return isIsoDateBeforeToday(room.dateIso);
  }
  const dateObj = parseRoomDate(room.date || "");
  return Boolean(dateObj) && formatDateIso(dateObj) < formatTodayIso();
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

function normalizePersonName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s'-])([^\s'-])/g, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("pt-BR")}`);
}

function bindPersonNameInput(input) {
  if (!input) {
    return;
  }
  input.addEventListener("blur", () => {
    input.value = normalizePersonName(input.value);
  });
}

function bindBirthDateInput(input) {
  if (!input) {
    return;
  }
  input.addEventListener("beforeinput", handleBirthDateBeforeInput);
  input.addEventListener("input", () => {
    input.value = applyBirthDateMask(input.value);
  });
}

function handleBirthDateBeforeInput(event) {
  const input = event.currentTarget;
  const digit = event.data || "";
  if (
    event.inputType !== "insertText" ||
    !/^\d$/.test(digit) ||
    !/^\d{2}\/\d{2}\/\d{4}$/.test(input.value || "")
  ) {
    return;
  }

  const start = input.selectionStart ?? input.value.length;
  const digitIndex = getBirthDateDigitIndexForCaret(start);
  if (digitIndex >= 8) {
    event.preventDefault();
    return;
  }

  event.preventDefault();
  const digits = input.value.replace(/\D/g, "").slice(0, 8).split("");
  digits[digitIndex] = digit;
  input.value = applyBirthDateMask(digits.join(""));
  const nextCaret = getBirthDateCaretForDigitIndex(digitIndex + 1);
  input.setSelectionRange(nextCaret, nextCaret);
}

function getBirthDateDigitIndexForCaret(position) {
  if (position <= 0) return 0;
  if (position <= 1) return 1;
  if (position <= 3) return 2;
  if (position <= 4) return 3;
  if (position <= 6) return 4;
  if (position <= 7) return 5;
  if (position <= 8) return 6;
  if (position <= 9) return 7;
  return 8;
}

function getBirthDateCaretForDigitIndex(index) {
  return [0, 1, 3, 4, 6, 7, 8, 9, 10][Math.min(Math.max(index, 0), 8)];
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

function getMinistryYearAgeFromBirth(birth, referenceDate = new Date()) {
  if (!birth) {
    return null;
  }
  const [year, month, day] = birth.split("-").map((item) => Number.parseInt(item, 10));
  if (!year || !month || !day) {
    return null;
  }
  return referenceDate.getFullYear() - year;
}

function getStudentAgeEligibility(student, referenceDate = new Date()) {
  const birth = String(student?.birth || student?.birth_date || "").slice(0, 10);
  const ministryYearAge = getMinistryYearAgeFromBirth(birth, referenceDate);
  if (ministryYearAge === null) {
    return { ok: false, message: "Data de nascimento invalida para check-in." };
  }
  if (ministryYearAge < 2 || ministryYearAge > 15) {
    return {
      ok: false,
      message: "Crianca fora da faixa de idade para participacao neste ano."
    };
  }
  return { ok: true, message: "" };
}

function getClassForBirth(birth) {
  const age = getMinistryYearAgeFromBirth(birth);
  if (age === null) {
    return "Indefinida";
  }
  if (age >= 2 && age <= 3) return "Maternal";
  if (age >= 4 && age <= 6) return "Kids";
  if (age >= 7 && age <= 10) return "Juniors";
  if (age >= 11 && age <= 15) return "Teens";
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
    .sort(compareFrequencyRowsForExport);
}

function compareFrequencyRowsForExport(a, b) {
  const classCompare = String(a.className || "").localeCompare(String(b.className || ""), "pt-BR");
  if (classCompare) {
    return classCompare;
  }
  return String(a.studentName || "").localeCompare(String(b.studentName || ""), "pt-BR");
}

function compareAuditRowsForExport(a, b) {
  const dateA = new Date(a.createdAt);
  const dateB = new Date(b.createdAt);
  const timeA = Number.isNaN(dateA.getTime()) ? 0 : dateA.getTime();
  const timeB = Number.isNaN(dateB.getTime()) ? 0 : dateB.getTime();
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return String(a.targetName || "").localeCompare(String(b.targetName || ""), "pt-BR");
}

function getLogReportType() {
  return els.logReportType?.value || "attendance";
}

function getFilteredAuditRows(reportType = getLogReportType()) {
  const startDate = parseInputDate(els.logStart?.value || "");
  const endDate = parseInputDate(els.logEnd?.value || "");
  if (!startDate || !endDate) {
    return [];
  }
  endDate.setHours(23, 59, 59, 999);
  return (state.auditLogs || []).filter((row) => {
    const date = new Date(row.createdAt);
    if (Number.isNaN(date.getTime()) || date < startDate || date > endDate) {
      return false;
    }
    if (reportType === "audit_all") {
      return true;
    }
    if (reportType === "child_created") {
      return row.actionType === "child_created";
    }
    if (reportType === "user_deleted") {
      return row.actionType === "user_deleted";
    }
    if (reportType === "changes") {
      return ["child_updated", "user_updated", "room_opened", "room_closed"].includes(row.actionType);
    }
    return false;
  });
}

function buildAuditCountsLabel(rows) {
  const counts = rows.reduce((acc, row) => {
    const key = formatAuditAction(row.actionType);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([key, value]) => `${key}: ${value}`).join(" | ");
}

function formatReportType(type) {
  if (type === "child_created") return "Cadastro de criancas";
  if (type === "user_deleted") return "Exclusoes de usuarios";
  if (type === "changes") return "Alteracoes de dados";
  if (type === "audit_all") return "Todos os eventos";
  return "Assiduidade";
}

function formatAuditAction(type) {
  const labels = {
    child_created: "Crianca cadastrada",
    child_updated: "Crianca alterada",
    child_deleted: "Crianca excluida",
    user_created: "Usuario cadastrado",
    user_updated: "Usuario alterado",
    user_deleted: "Usuario excluido",
    checkin_created: "Check-in",
    checkout_created: "Checkout",
    room_opened: "Sala aberta",
    room_closed: "Sala fechada"
  };
  return labels[type] || type || "Evento";
}

function formatAuditMetadata(row) {
  const metadata = row.metadata || {};
  if (row.actionType === "user_deleted") {
    const mode = row.actorId && row.targetId && row.actorId === row.targetId ? "Usuario se excluiu." : "Usuario foi excluido por outro usuario.";
    const children = Array.isArray(metadata.deletedChildren) && metadata.deletedChildren.length
      ? ` Filhos excluidos: ${metadata.deletedChildren.join(", ")}.`
      : "";
    return `${mode}${children}`;
  }
  return metadata.summary || "-";
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
      <span>${escapeHtml(student.name)} (${escapeHtml(student.className)})</span>
      <input type="checkbox" data-log-student-id="${escapeAttribute(student.id)}" ${selectedSet.has(student.id) ? "checked" : ""} />
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

function getAvailableCheckinRoomForClass(className) {
  const openRooms = getOpenRoomsToday().filter((room) => room.classTarget === className);
  if (!openRooms.length) {
    return null;
  }
  const activeRoom = getActiveRoom();
  if (activeRoom && activeRoom.classTarget === className && getCheckinWindowValidation(activeRoom).ok) {
    return activeRoom;
  }
  return openRooms.find((room) => getCheckinWindowValidation(room).ok) || null;
}

function getCheckinWindowValidation(room, now = new Date()) {
  if (!room || room.status !== "Aberta") {
    return {
      ok: false,
      reason: "no_room",
      message: "Nao ha sala aberta para check-in."
    };
  }
  const window = getRoomCheckinWindow(room);
  if (!window) {
    return {
      ok: false,
      reason: "missing_time",
      message: "Esta sala nao tem horario de inicio e termino completo para check-in."
    };
  }
  if (now < window.opensAt) {
    return {
      ok: false,
      reason: "too_early",
      message: `Check-in disponivel a partir de ${formatTimeValue(window.opensAt)}.`
    };
  }
  if (now >= window.endsAt) {
    return {
      ok: false,
      reason: "ended",
      message: "Horario de check-in encerrado para esta aula."
    };
  }
  return { ok: true, reason: "open", message: "" };
}

function getRoomCheckinWindow(room) {
  const date = getRoomDateObject(room);
  const start = parseTimeValue(room?.startTime || room?.time || "");
  const end = parseTimeValue(room?.endTime || "");
  if (!date || !start || !end) {
    return null;
  }
  const startsAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), start.hours, start.minutes, 0, 0);
  const opensAt = new Date(startsAt.getTime() - CHECKIN_EARLY_WINDOW_MINUTES * 60 * 1000);
  const endsAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), end.hours, end.minutes, 0, 0);
  return { opensAt, startsAt, endsAt };
}

function getRoomDateObject(room) {
  if (!room) {
    return null;
  }
  if (room.dateIso) {
    return parseInputDate(String(room.dateIso).slice(0, 10));
  }
  return parseRoomDate(room.date || "");
}

function parseTimeValue(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}

function formatTimeValue(date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
  const canOperateRoom = canOperateRooms();
  els.roomActive.disabled = !openRooms.length && !canOperateRoom;
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
      <input type="checkbox" data-room-id="${escapeAttribute(room.id)}" />
      <span>${escapeHtml(room.name)} - ${escapeHtml(room.time || "")} (${escapeHtml(room.classTarget || "-")})</span>
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

function buildCsv(rows) {
  return CSV_BOM + rows.map((row) => row.map(escapeCsv).join(CSV_DELIMITER)).join("\r\n");
}

function downloadCsv(filename, rows) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  let safe = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^[=+\-@]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (safe.includes(CSV_DELIMITER) || safe.includes("\"")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
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
          ...(parsed.ui || {})
        };
        return {
          activeRoomId: "",
          selectedRoomId: "",
          roomView: "open",
          profiles: [],
          auditLogs: [],
          schedules: [],
          tips: [],
          tipReads: [],
          familyLinkRequests: [],
          dashboardInfo: "",
          tipsStatus: { loading: false, error: "" },
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
    auditLogs: [],
    schedules: [],
    tips: [],
    tipReads: [],
    familyLinkRequests: [],
    dashboardInfo: "",
    tipsStatus: { loading: false, error: "" },
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
      dashboardNeuroExpanded: false
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
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.update().catch(() => {});
        let lastUpdateCheck = Date.now();
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState !== "visible") {
            return;
          }
          const now = Date.now();
          if (now - lastUpdateCheck < SW_UPDATE_CHECK_INTERVAL_MS) {
            return;
          }
          lastUpdateCheck = now;
          registration.update().catch(() => {});
        });
      })
      .catch((err) => {
        console.warn("SW falhou", err);
      });
  }
}



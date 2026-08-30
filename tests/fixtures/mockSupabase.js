function createMockSupabaseScript() {
  return `
(() => {
  const today = new Date();
  function localDateIso(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const todayIso = localDateIso(today);
  function timeOffset(minutes) {
    const date = new Date(today.getTime() + minutes * 60000);
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }
  const startedAt = timeOffset(-10);
  const endedAt = timeOffset(50);
  const parentCheckinPresenceCode = "DNMS-CHECKIN-PRESENCIAL";

  const db = {
    auth_users: [
      { id: "sadmin-1", email: "marvinlabre@gmail.com" },
      { id: "admin-1", email: "admin@dnms.test" },
      { id: "team-1", email: "equipe@dnms.test" },
      { id: "parent-1", email: "responsavel@dnms.test" },
      { id: "parent-2", email: "secundario@dnms.test" },
      { id: "deleted-auth-1", email: "excluido@dnms.test" }
    ],
    profiles: [
      { id: "sadmin-1", name: "Sadmin DNMS", role: "admin", email: "marvinlabre@gmail.com", phone: "11911110000", address: "Rua Sadmin", photo_url: "" },
      { id: "admin-1", name: "Admin DNMS", role: "admin", email: "admin@dnms.test", phone: "11999990000", address: "Rua Admin", photo_url: "" },
      { id: "team-1", name: "Equipe DNMS", role: "equipe", email: "equipe@dnms.test", phone: "11966660000", address: "Rua Equipe", photo_url: "" },
      { id: "parent-1", name: "Responsavel Teste", role: "responsavel", email: "responsavel@dnms.test", phone: "11988880000", address: "Rua Familia", photo_url: "", family_id: "parent-1" },
      { id: "parent-2", name: "Responsavel Secundario", role: "responsavel", email: "secundario@dnms.test", phone: "11955550000", address: "Rua Secundaria", photo_url: "", family_id: "parent-2" }
    ],
    rooms: [
      { id: "room-kids", name: "Culto Kids", date: todayIso, start_time: startedAt, end_time: endedAt, class_target: "Kids", status: "Aberta", opened_at: todayIso + "T09:00:00.000Z", closed_at: null },
      { id: "room-juniors", name: "Culto Juniors", date: todayIso, start_time: startedAt, end_time: endedAt, class_target: "Juniors", status: "Aberta", opened_at: todayIso + "T09:00:00.000Z", closed_at: null }
    ],
    students: [
      { id: "student-kids", name: "Ana Kids", birth_date: (yyyy - 5) + "-04-10", class_name: "Kids", primary_guardian_name: "Responsavel Teste", phone: "11988880000", address: "Rua Familia", notes: "Alergia leve", is_visitor: false, photo_url: "" },
      { id: "student-juniors", name: "Bia Juniors", birth_date: (yyyy - 8) + "-05-12", class_name: "Juniors", primary_guardian_name: "Outro Responsavel", phone: "11977770000", address: "Rua Outra", notes: "", is_visitor: false, photo_url: "" }
    ],
    student_guardians: [
      { student_id: "student-kids", guardian_id: "parent-1" },
      { student_id: "student-kids", guardian_id: "parent-2" }
    ],
    checkins: [],
    invites: [],
    family_link_requests: [],
    schedules: [],
    tips: [],
    tip_reads: [],
    audit_logs: [],
    dashboard_info: []
  };

  if (new URLSearchParams(window.location.search).get("scenario") === "duplicate-active-checkin") {
    db.checkins.push({
      id: "checkin-legacy-active",
      student_id: "student-kids",
      room_id: "room-juniors",
      room_name_snapshot: "Culto Juniors",
      class_name: "Juniors",
      actor_id: "admin-1",
      notes_snapshot: "",
      checked_in_at: todayIso + "T09:05:00.000Z",
      checked_out_at: null
    });
  }

  if (new URLSearchParams(window.location.search).get("scenario") === "upcoming-schedules") {
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const dateIso = localDateIso(date);
      db.schedules.push({
        id: "schedule-" + index,
        date: dateIso,
        profile_id: "",
        target_user: "Coord " + String(index + 1).padStart(2, "0"),
        lesson_theme: "Escala Coordenacao",
        details: "Coordenacao"
      });
    }
  }

  if (new URLSearchParams(window.location.search).get("scenario") === "single-birthday") {
    db.students[0].birth_date = (yyyy - 5) + "-" + mm + "-10";
    db.students[1].birth_date = (yyyy - 8) + "-01-12";
  }

  if (new URLSearchParams(window.location.search).get("scenario") === "messages-panel") {
    db.tips.push(
      {
        id: "tip-all-1",
        message: "Aviso geral para todas as familias.",
        recipient_id: null,
        created_by: "admin-1",
        sender_name: "Admin DNMS",
        created_at: todayIso + "T10:00:00.000Z"
      },
      {
        id: "tip-parent-1",
        message: "Mensagem direcionada ao responsavel.",
        recipient_id: "parent-1",
        created_by: "admin-1",
        sender_name: "Admin DNMS",
        created_at: todayIso + "T11:00:00.000Z"
      },
      {
        id: "tip-parent-2",
        message: "Mensagem de outra familia.",
        recipient_id: "parent-2",
        created_by: "admin-1",
        sender_name: "Admin DNMS",
        created_at: todayIso + "T12:00:00.000Z"
      }
    );
  }

  if (new URLSearchParams(window.location.search).get("scenario") === "messages-long-text") {
    db.tips.push({
      id: "tip-long-1",
      message: "Mensagem com texto muito longo " + "palavramuitolonga".repeat(24),
      recipient_id: null,
      created_by: "admin-1",
      sender_name: "Admin DNMS",
      created_at: todayIso + "T10:00:00.000Z"
    });
  }

  let currentUser = null;
  const urlSearchParams = new URLSearchParams(window.location.search);
  const urlHashParams = new URLSearchParams(window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash);
  const isRecoveryCallback =
    (urlSearchParams.get("type") || urlHashParams.get("type")) === "recovery" ||
    urlSearchParams.get("password_recovery") === "1" ||
    urlHashParams.get("password_recovery") === "1" ||
    urlSearchParams.get("scenario") === "password-recovery-event";
  if (["restore-session", "slow-restore-session"].includes(urlSearchParams.get("scenario"))) {
    currentUser = { id: "admin-1", email: "admin@dnms.test" };
  }
  if (urlSearchParams.get("scenario") === "missing-profile-session") {
    currentUser = { id: "deleted-auth-1", email: "excluido@dnms.test" };
  }
  if (isRecoveryCallback) {
    currentUser = { id: "parent-1", email: "responsavel@dnms.test" };
  }
  window.__mockSignOutCount = 0;
  let idCounter = 1;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeValue(row, column) {
    return row[column];
  }

  function canDeleteProfile(actorId, targetId) {
    if (!actorId || !targetId || actorId === targetId) {
      return false;
    }
    const actor = db.profiles.find((item) => item.id === actorId);
    const target = db.profiles.find((item) => item.id === targetId);
    if (!actor || !target) {
      return false;
    }
    if (String(actor.email || "").toLowerCase() === "marvinlabre@gmail.com") {
      return true;
    }
    if (actor.role === "admin") {
      return ["equipe", "responsavel", "dnms_kids"].includes(target.role);
    }
    return false;
  }

  function ensureFamilyId(profileId) {
    const profile = db.profiles.find((item) => item.id === profileId);
    if (!profile) {
      return "";
    }
    if (!profile.family_id) {
      profile.family_id = profile.id;
    }
    return profile.family_id;
  }

  function getFamilyMembers(familyId) {
    return db.profiles.filter((profile) => profile.role === "responsavel" && profile.family_id === familyId);
  }

  function addStudentGuardianLink(studentId, guardianId) {
    if (!studentId || !guardianId) {
      return;
    }
    if (!db.student_guardians.some((item) => item.student_id === studentId && item.guardian_id === guardianId)) {
      db.student_guardians.push({ student_id: studentId, guardian_id: guardianId });
    }
  }

  function isRoomCheckinWindowOpen(room, checkedAt = new Date()) {
    if (!room || room.status !== "Aberta") {
      return false;
    }
    const start = String(room.start_time || room.time || "").match(/^(\\d{1,2}):(\\d{2})$/);
    const end = String(room.end_time || "").match(/^(\\d{1,2}):(\\d{2})$/);
    if (!start || !end) {
      return false;
    }
    const startDate = new Date(checkedAt);
    startDate.setHours(Number(start[1]), Number(start[2]), 0, 0);
    const opensAt = new Date(startDate.getTime() - 30 * 60000);
    const endsAt = new Date(checkedAt);
    endsAt.setHours(Number(end[1]), Number(end[2]), 0, 0);
    return room.date === localDateIso(checkedAt) && checkedAt >= opensAt && checkedAt < endsAt;
  }

  function syncStudentFamilyGuardians(targetStudentId, seedGuardianId) {
    const familyId = ensureFamilyId(seedGuardianId || currentUser?.id);
    if (!familyId) {
      return { data: { ok: true, inserted_links: 0 }, error: null };
    }
    let inserted = 0;
    getFamilyMembers(familyId).forEach((member) => {
      const before = db.student_guardians.length;
      addStudentGuardianLink(targetStudentId, member.id);
      if (db.student_guardians.length > before) {
        inserted += 1;
      }
    });
    return { data: { ok: true, family_id: familyId, inserted_links: inserted }, error: null };
  }

  function parentCheckinWithPresence(targetStudentId, presenceToken) {
    const actor = db.profiles.find((item) => item.id === currentUser?.id);
    if (!actor || actor.role !== "responsavel") {
      return { data: null, error: { message: "Somente responsavel pode usar check-in com QR." } };
    }
    if (String(presenceToken || "").trim() !== parentCheckinPresenceCode) {
      return { data: null, error: { message: "QR Code de presenca invalido." } };
    }
    const student = db.students.find((item) => item.id === targetStudentId);
    if (!student) {
      return { data: null, error: { message: "Aluno nao encontrado." } };
    }
    if (!db.student_guardians.some((item) => item.student_id === student.id && item.guardian_id === actor.id)) {
      return { data: null, error: { message: "Sem permissao para check-in deste aluno." } };
    }
    const room = db.rooms
      .filter((item) => item.status === "Aberta" && item.class_target === student.class_name)
      .sort((a, b) => (isRoomCheckinWindowOpen(a) === isRoomCheckinWindowOpen(b) ? 0 : isRoomCheckinWindowOpen(a) ? -1 : 1))[0];
    if (!room) {
      return { data: null, error: { message: "Nao ha sala aberta para a turma deste aluno." } };
    }
    if (!isRoomCheckinWindowOpen(room)) {
      return { data: null, error: { message: "Horario de check-in encerrado para esta aula." } };
    }
    if (db.checkins.some((item) => item.student_id === student.id && item.checked_out_at === null)) {
      return { data: null, error: { message: "Este aluno ja possui um check-in ativo." } };
    }
    const row = {
      id: "checkins-" + idCounter++,
      student_id: student.id,
      room_id: room.id,
      room_name_snapshot: room.name,
      class_name: student.class_name,
      actor_id: actor.id,
      notes_snapshot: student.notes || "",
      checked_in_at: new Date().toISOString(),
      checked_out_at: null
    };
    db.checkins.push(row);
    return { data: row, error: null };
  }

  function getMyFamilyNetwork() {
    const actor = db.profiles.find((item) => item.id === currentUser?.id);
    if (!actor || actor.role !== "responsavel") {
      return { data: { ok: true, family_id: null, members: [] }, error: null };
    }
    const familyId = ensureFamilyId(actor.id);
    return {
      data: {
        ok: true,
        family_id: familyId,
        members: getFamilyMembers(familyId).map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone
        }))
      },
      error: null
    };
  }

  function applyFamilyLinkBetweenResponsibles(requesterId, targetId) {
    const requester = db.profiles.find((item) => item.id === requesterId);
    const target = db.profiles.find((item) => item.id === targetId);
    if (!requester || !target) {
      return { data: null, error: { message: "family_link_target_not_found" } };
    }
    const actorFamilyId = ensureFamilyId(requester.id);
    const targetFamilyId = ensureFamilyId(target.id);
    db.profiles.forEach((profile) => {
      if (profile.role === "responsavel" && profile.family_id === targetFamilyId) {
        profile.family_id = actorFamilyId;
      }
    });
    requester.family_id = actorFamilyId;
    target.family_id = actorFamilyId;
    const members = getFamilyMembers(actorFamilyId);
    const memberIds = new Set(members.map((item) => item.id));
    const memberNames = new Set(members.map((item) => String(item.name || "").trim().toLowerCase()));
    const familyStudentIds = new Set();
    db.student_guardians.forEach((link) => {
      if (memberIds.has(link.guardian_id)) {
        familyStudentIds.add(link.student_id);
      }
    });
    db.students.forEach((student) => {
      if (memberNames.has(String(student.primary_guardian_name || "").trim().toLowerCase())) {
        familyStudentIds.add(student.id);
      }
    });
    familyStudentIds.forEach((studentId) => {
      members.forEach((member) => addStudentGuardianLink(studentId, member.id));
    });
    return {
      data: {
        ok: true,
        family_id: actorFamilyId,
        member_count: members.length,
        student_count: familyStudentIds.size
      },
      error: null
    };
  }

  function canManageFamilyNetwork() {
    const actor = db.profiles.find((item) => item.id === currentUser?.id);
    return actor?.role === "admin" || String(actor?.email || "").toLowerCase() === "marvinlabre@gmail.com";
  }

  function adminLinkFamilyResponsible(anchorProfileId, targetEmail) {
    if (!canManageFamilyNetwork()) {
      return { data: null, error: { message: "admin_family_network_not_allowed" } };
    }
    const anchor = db.profiles.find((item) => item.id === anchorProfileId && item.role === "responsavel");
    const target = db.profiles.find(
      (item) => item.role === "responsavel" && String(item.email || "").toLowerCase() === String(targetEmail || "").toLowerCase()
    );
    if (!anchor) {
      return { data: null, error: { message: "admin_family_anchor_not_found" } };
    }
    if (!target) {
      return { data: null, error: { message: "admin_family_target_not_found" } };
    }
    return applyFamilyLinkBetweenResponsibles(anchor.id, target.id);
  }

  function adminUnlinkFamilyResponsible(targetProfileId) {
    if (!canManageFamilyNetwork()) {
      return { data: null, error: { message: "admin_family_network_not_allowed" } };
    }
    const target = db.profiles.find((item) => item.id === targetProfileId && item.role === "responsavel");
    if (!target) {
      return { data: null, error: { message: "admin_family_target_not_found" } };
    }
    const previousFamilyId = ensureFamilyId(target.id);
    const targetName = String(target.name || "").trim().toLowerCase();
    const remainingMembers = db.profiles.filter(
      (item) => item.id !== target.id && item.role === "responsavel" && item.family_id === previousFamilyId
    );
    const remainingIds = new Set(remainingMembers.map((item) => item.id));
    const remainingNames = new Set(remainingMembers.map((item) => String(item.name || "").trim().toLowerCase()));
    target.family_id = target.id;
    for (let index = db.student_guardians.length - 1; index >= 0; index -= 1) {
      const link = db.student_guardians[index];
      const student = db.students.find((item) => item.id === link.student_id);
      const primaryName = String(student?.primary_guardian_name || "").trim().toLowerCase();
      const removesTargetFromRemainingChild = link.guardian_id === target.id && remainingNames.has(primaryName);
      const removesRemainingFromTargetChild = remainingIds.has(link.guardian_id) && primaryName === targetName;
      if (removesTargetFromRemainingChild || removesRemainingFromTargetChild) {
        db.student_guardians.splice(index, 1);
      }
    }
    db.students
      .filter((student) => String(student.primary_guardian_name || "").trim().toLowerCase() === targetName)
      .forEach((student) => addStudentGuardianLink(student.id, target.id));
    return {
      data: {
        ok: true,
        previous_family_id: previousFamilyId,
        new_family_id: target.id
      },
      error: null
    };
  }

  function requestFamilyLink(targetEmail) {
    const actor = db.profiles.find((item) => item.id === currentUser?.id);
    const target = db.profiles.find(
      (item) => item.role === "responsavel" && String(item.email || "").toLowerCase() === String(targetEmail || "").toLowerCase()
    );
    if (!actor || actor.role !== "responsavel") {
      return { data: null, error: { message: "family_link_only_responsavel" } };
    }
    if (!target) {
      return { data: null, error: { message: "family_link_target_not_found" } };
    }
    if (target.id === actor.id) {
      return { data: null, error: { message: "family_link_self_not_allowed" } };
    }
    const actorFamilyId = ensureFamilyId(actor.id);
    const targetFamilyId = ensureFamilyId(target.id);
    if (actorFamilyId === targetFamilyId) {
      return {
        data: {
          ok: true,
          status: "already_linked",
          target_id: target.id,
          target_name: target.name
        },
        error: null
      };
    }
    const existing = db.family_link_requests.find(
      (item) => item.requester_id === actor.id && item.target_id === target.id && item.status === "pending"
    );
    if (existing) {
      return {
        data: {
          ok: true,
          status: "pending",
          request_id: existing.id,
          target_id: target.id,
          target_name: target.name,
          expires_at: existing.expires_at
        },
        error: null
      };
    }
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const request = {
      id: "family-link-request-" + idCounter++,
      requester_id: actor.id,
      target_id: target.id,
      requester_name_snapshot: actor.name,
      target_name_snapshot: target.name,
      tip_id: "",
      status: "pending",
      expires_at: expiresAt,
      responded_at: null,
      created_at: new Date().toISOString()
    };
    const tip = {
      id: "tips-" + idCounter++,
      message: actor.name + " te adicionou a sua familia! Deseja aceitar?",
      recipient_id: target.id,
      created_by: actor.id,
      sender_name: actor.name,
      created_at: new Date().toISOString()
    };
    request.tip_id = tip.id;
    db.family_link_requests.push(request);
    db.tips.push(tip);
    return {
      data: {
        ok: true,
        status: "pending",
        request_id: request.id,
        target_id: target.id,
        target_name: target.name,
        tip_id: tip.id,
        expires_at: expiresAt
      },
      error: null
    };
  }

  function respondFamilyLinkRequest(requestId, accept) {
    const request = db.family_link_requests.find((item) => item.id === requestId);
    if (!request) {
      return { data: null, error: { message: "family_link_request_not_found" } };
    }
    if (request.target_id !== currentUser?.id) {
      return { data: null, error: { message: "family_link_request_not_allowed" } };
    }
    if (request.status !== "pending") {
      return { data: null, error: { message: "family_link_request_not_pending" } };
    }
    const requester = db.profiles.find((item) => item.id === request.requester_id);
    const target = db.profiles.find((item) => item.id === request.target_id);
    request.status = accept ? "accepted" : "declined";
    request.responded_at = new Date().toISOString();
    if (!accept) {
      db.tips.push({
        id: "tips-" + idCounter++,
        message: target.name + " recusou o vinculo familiar.",
        recipient_id: requester.id,
        created_by: target.id,
        sender_name: target.name,
        created_at: new Date().toISOString()
      });
      return {
        data: { ok: true, status: "declined", requester_name: requester.name, target_name: target.name },
        error: null
      };
    }
    const linkResult = applyFamilyLinkBetweenResponsibles(requester.id, target.id);
    if (linkResult.error) {
      return linkResult;
    }
    db.tips.push(
      {
        id: "tips-" + idCounter++,
        message: "Voce esta sendo vinculado a familia de " + requester.name + ".",
        recipient_id: target.id,
        created_by: requester.id,
        sender_name: requester.name,
        created_at: new Date().toISOString()
      },
      {
        id: "tips-" + idCounter++,
        message: target.name + " aceitou entrar na sua rede familiar.",
        recipient_id: requester.id,
        created_by: target.id,
        sender_name: target.name,
        created_at: new Date().toISOString()
      }
    );
    return {
      data: {
        ok: true,
        status: "accepted",
        requester_name: requester.name,
        target_name: target.name,
        family_id: linkResult.data.family_id,
        member_count: linkResult.data.member_count,
        student_count: linkResult.data.student_count
      },
      error: null
    };
  }

  function getInviteMeta(inviteToken) {
    const invite = db.invites.find((item) => item.token === inviteToken);
    if (!invite) {
      return { data: null, error: { message: "invite_not_found" } };
    }
    return {
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expires_at: invite.expires_at
      },
      error: null
    };
  }

  function acceptInviteToken(inviteToken, targetEmail, expectedRole) {
    const invite = db.invites.find((item) => item.token === inviteToken);
    if (!invite) {
      return { data: null, error: { message: "invite_not_found" } };
    }
    if (invite.email !== String(targetEmail || "").toLowerCase()) {
      return { data: null, error: { message: "invite_email_mismatch" } };
    }
    if (expectedRole && invite.role !== expectedRole) {
      return { data: null, error: { message: "invite_role_mismatch" } };
    }
    invite.status = "accepted";
    invite.accepted_at = new Date().toISOString();
    return { data: { ok: true, role: invite.role, family_links_created: 0 }, error: null };
  }

  function deleteUserAccount(targetProfileId) {
    if (!canDeleteProfile(currentUser?.id, targetProfileId)) {
      return { data: null, error: { message: "Sem permissao para excluir este usuario." } };
    }
    const profile = db.profiles.find((item) => item.id === targetProfileId);
    if (!profile) {
      return { data: null, error: { message: "Perfil nao encontrado." } };
    }
    const profileName = String(profile.name || "").trim().toLowerCase();
    const primaryStudentIds = db.students
      .filter((student) => String(student.primary_guardian_name || "").trim().toLowerCase() === profileName)
      .map((student) => student.id);
    const deletedChildren = db.students
      .filter((student) => primaryStudentIds.includes(student.id))
      .map((student) => student.name);

    for (let index = db.checkins.length - 1; index >= 0; index -= 1) {
      if (primaryStudentIds.includes(db.checkins[index].student_id)) {
        db.checkins.splice(index, 1);
      }
    }
    for (let index = db.student_guardians.length - 1; index >= 0; index -= 1) {
      const link = db.student_guardians[index];
      if (primaryStudentIds.includes(link.student_id) || link.guardian_id === targetProfileId) {
        db.student_guardians.splice(index, 1);
      }
    }
    for (let index = db.students.length - 1; index >= 0; index -= 1) {
      if (primaryStudentIds.includes(db.students[index].id)) {
        db.students.splice(index, 1);
      }
    }
    for (let index = db.profiles.length - 1; index >= 0; index -= 1) {
      if (db.profiles[index].id === targetProfileId) {
        db.profiles.splice(index, 1);
      }
    }
    let deletedAuthUser = false;
    for (let index = db.auth_users.length - 1; index >= 0; index -= 1) {
      if (db.auth_users[index].id === targetProfileId) {
        db.auth_users.splice(index, 1);
        deletedAuthUser = true;
      }
    }
    return {
      data: {
        ok: true,
        deleted_auth_user: deletedAuthUser,
        deleted_children: deletedChildren,
        deleted_primary_student_ids: primaryStudentIds
      },
      error: null
    };
  }

  class Query {
    constructor(table) {
      this.table = table;
      this.action = "select";
      this.payload = null;
      this.filters = [];
      this._single = false;
      this._limit = null;
    }

    select() {
      return this;
    }

    insert(payload) {
      this.action = "insert";
      this.payload = payload;
      return this;
    }

    update(payload) {
      this.action = "update";
      this.payload = payload;
      return this;
    }

    upsert(payload) {
      this.action = "upsert";
      this.payload = payload;
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => normalizeValue(row, column) === value);
      return this;
    }

    in(column, values) {
      const set = new Set(values || []);
      this.filters.push((row) => set.has(normalizeValue(row, column)));
      return this;
    }

    is(column, value) {
      this.filters.push((row) => normalizeValue(row, column) === value);
      return this;
    }

    order() {
      return this;
    }

    limit(value) {
      this._limit = value;
      return this;
    }

    single() {
      this._single = true;
      return this.then((result) => result);
    }

    then(resolve, reject) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    execute() {
      const rows = db[this.table] || [];
      const matches = (row) => this.filters.every((filter) => filter(row));
      if (
        this.action === "select" &&
        this.table === "tips" &&
        new URLSearchParams(window.location.search).get("scenario") === "messages-error" &&
        !window.__mockTipsErrorCleared
      ) {
        return { data: null, error: { message: "Erro simulado ao buscar mensagens." } };
      }
      if (
        this.action === "select" &&
        this.table === "profiles" &&
        new URLSearchParams(window.location.search).get("scenario") === "profile-read-delay" &&
        !window.__mockProfileReadDelayCleared
      ) {
        window.__mockProfileReadDelayCleared = true;
        return { data: this._single ? null : [], error: null };
      }

      if (this.action === "insert") {
        const entries = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (this.table === "checkins") {
          const invalid = entries.find((entry) => {
            const room = db.rooms.find((item) => item.id === entry.room_id);
            return !isRoomCheckinWindowOpen(room, entry.checked_in_at ? new Date(entry.checked_in_at) : new Date());
          });
          if (invalid) {
            return { data: null, error: { message: "checkin_window_closed", code: "P0001" } };
          }
        }
        const inserted = entries.map((entry) => {
          const row = { ...entry };
          if (!row.id) {
            row.id = this.table + "-" + idCounter++;
          }
          if (this.table === "checkins" && !row.checked_in_at) {
            row.checked_in_at = new Date().toISOString();
          }
          if (this.table === "checkins" && !Object.prototype.hasOwnProperty.call(row, "checked_out_at")) {
            row.checked_out_at = null;
          }
          if (this.table === "audit_logs" && !row.created_at) {
            row.created_at = new Date().toISOString();
          }
          rows.push(row);
          return clone(row);
        });
        return { data: this._single ? inserted[0] : inserted, error: null };
      }

      if (this.action === "update") {
        const updated = [];
        rows.forEach((row) => {
          if (matches(row)) {
            Object.assign(row, this.payload);
            updated.push(clone(row));
          }
        });
        return { data: this._single ? updated[0] || null : updated, error: null };
      }

      if (this.action === "upsert") {
        const entries = Array.isArray(this.payload) ? this.payload : [this.payload];
        const saved = entries.map((entry) => {
          let row = null;
          if (this.table === "student_guardians") {
            row = rows.find((item) => item.student_id === entry.student_id && item.guardian_id === entry.guardian_id);
          } else {
            row = rows.find((item) => item.id === entry.id);
          }
          if (row) {
            Object.assign(row, entry);
          } else {
            row = { ...entry };
            rows.push(row);
          }
          return clone(row);
        });
        return { data: this._single ? saved[0] : saved, error: null };
      }

      if (this.action === "delete") {
        const deleted = [];
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (matches(rows[index])) {
            deleted.push(clone(rows[index]));
            rows.splice(index, 1);
          }
        }
        return { data: this._single ? deleted[0] || null : deleted, error: null };
      }

      let selected = rows.filter(matches).map(clone);
      if (this._limit !== null) {
        selected = selected.slice(0, this._limit);
      }
      return { data: this._single ? selected[0] || null : selected, error: null };
    }
  }

  window.__mockDnmsDb = db;
  window.__mockStorageUploads = [];
  window.__mockFunctionInvocations = [];
  window.supabase = {
    createClient() {
      if (isRecoveryCallback) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      return {
        auth: {
          async getSession() {
            if (new URLSearchParams(window.location.search).get("scenario") === "slow-restore-session") {
              await delay(1000);
            }
            return { data: { session: currentUser ? { user: currentUser } : null }, error: null };
          },
          async signInWithPassword({ email, password }) {
            if (!password || password === "erro") {
              return { data: null, error: { message: "Invalid login credentials" } };
            }
            const authUser = db.auth_users.find((item) => item.email === String(email || "").toLowerCase());
            if (!authUser) {
              return { data: null, error: { message: "Invalid login credentials" } };
            }
            currentUser = { id: authUser.id, email: authUser.email };
            return { data: { user: currentUser, session: { user: currentUser } }, error: null };
          },
          async signOut() {
            window.__mockSignOutCount += 1;
            currentUser = null;
            return { error: null };
          },
          onAuthStateChange(callback) {
            if (urlSearchParams.get("scenario") === "password-recovery-event") {
              window.setTimeout(() => callback("PASSWORD_RECOVERY", currentUser ? { user: currentUser } : null), 0);
            }
            return { data: { subscription: { unsubscribe() {} } } };
          },
          async resetPasswordForEmail(email, options) {
            window.__lastPasswordResetEmail = email;
            window.__lastPasswordResetRedirectTo = options?.redirectTo || "";
            return { data: {}, error: null };
          },
          async updateUser(payload) {
            window.__lastUpdatedPassword = payload.password;
            return { data: { user: currentUser }, error: null };
          }
        },
        from(table) {
          return new Query(table);
        },
        async rpc(name, params) {
          if (name === "delete_user_account") {
            return deleteUserAccount(params?.target_profile_id);
          }
          if (name === "get_my_family_network") {
            return getMyFamilyNetwork();
          }
          if (name === "request_family_link") {
            return requestFamilyLink(params?.target_email);
          }
          if (name === "respond_family_link_request") {
            return respondFamilyLinkRequest(params?.request_id, params?.accept);
          }
          if (name === "admin_link_family_responsible") {
            return adminLinkFamilyResponsible(params?.anchor_profile_id, params?.target_email);
          }
          if (name === "admin_unlink_family_responsible") {
            return adminUnlinkFamilyResponsible(params?.target_profile_id);
          }
          if (name === "parent_checkin_with_presence") {
            return parentCheckinWithPresence(params?.target_student_id, params?.presence_token);
          }
          if (name === "link_family_responsible") {
            return requestFamilyLink(params?.target_email);
          }
          if (name === "get_invite_meta") {
            return getInviteMeta(params?.invite_token);
          }
          if (name === "accept_invite_token") {
            return acceptInviteToken(params?.invite_token, params?.target_email, params?.expected_role);
          }
          if (name === "sync_student_family_guardians") {
            return syncStudentFamilyGuardians(params?.target_student_id, params?.seed_guardian_id);
          }
          return { data: null, error: { message: "Function not found", code: "42883" } };
        },
        functions: {
          async invoke(name, payload) {
            window.__mockFunctionInvocations.push({ name, payload });
            if (window.__mockFunctionError) {
              return { data: null, error: { message: window.__mockFunctionError } };
            }
            return { data: { ok: true }, error: null };
          }
        },
        storage: {
          from() {
            return {
              async upload(path, file) {
                window.__mockStorageUploads.push({ path, name: file?.name || "", type: file?.type || "", size: file?.size || 0 });
                if (window.__mockStorageUploadError) {
                  return { error: { message: window.__mockStorageUploadError } };
                }
                return { error: null };
              },
              getPublicUrl(path) {
                return { data: { publicUrl: "https://example.test/" + path } };
              }
            };
          }
        }
      };
    }
  };
})();
`;
}

module.exports = { createMockSupabaseScript };

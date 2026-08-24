function createMockSupabaseScript() {
  return `
(() => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayIso = yyyy + "-" + mm + "-" + dd;
  function timeOffset(minutes) {
    const date = new Date(today.getTime() + minutes * 60000);
    return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
  }
  const startedAt = timeOffset(-120);
  const endedAt = timeOffset(-60);

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
      { id: "parent-1", name: "Responsavel Teste", role: "responsavel", email: "responsavel@dnms.test", phone: "11988880000", address: "Rua Familia", photo_url: "" },
      { id: "parent-2", name: "Responsavel Secundario", role: "responsavel", email: "secundario@dnms.test", phone: "11955550000", address: "Rua Secundaria", photo_url: "" }
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
      const dateIso = date.toISOString().slice(0, 10);
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

  let currentUser = null;
  if (["restore-session", "slow-restore-session"].includes(new URLSearchParams(window.location.search).get("scenario"))) {
    currentUser = { id: "admin-1", email: "admin@dnms.test" };
  }
  if (new URLSearchParams(window.location.search).get("scenario") === "missing-profile-session") {
    currentUser = { id: "deleted-auth-1", email: "excluido@dnms.test" };
  }
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

      if (this.action === "insert") {
        const entries = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted = entries.map((entry) => {
          const row = { ...entry };
          if (!row.id) {
            row.id = this.table + "-" + idCounter++;
          }
          if (this.table === "checkins" && !row.checked_in_at) {
            row.checked_in_at = new Date().toISOString();
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
          const key = entry.id ? "id" : this.table === "student_guardians" ? "student_id" : "id";
          let row = rows.find((item) => item[key] === entry[key]);
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
  window.supabase = {
    createClient() {
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
            currentUser = null;
            return { error: null };
          },
          async resetPasswordForEmail(email) {
            window.__lastPasswordResetEmail = email;
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
          return { data: null, error: { message: "Function not found", code: "42883" } };
        },
        storage: {
          from() {
            return {
              async upload(path, file) {
                window.__mockStorageUploads.push({ path, name: file?.name || "", type: file?.type || "", size: file?.size || 0 });
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

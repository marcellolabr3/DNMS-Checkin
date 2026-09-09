const fs = require("fs/promises");
const path = require("path");
const { loadSqlite3 } = require("./sqlite3-runtime");
const {
  PRINT_JOB_STATUS,
  createPrintJob
} = require("./print-job");

const sqlite3 = loadSqlite3();
const DEFAULT_DB_PATH = path.join(__dirname, "..", "data", "print-service.sqlite");

class JobStore {
  constructor(options = {}) {
    this.dbPath = options.dbPath || process.env.PRINT_JOB_DB_PATH || DEFAULT_DB_PATH;
    this.db = null;
  }

  async open() {
    if (this.db) {
      return this;
    }
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    this.db = await openDatabase(this.dbPath);
    await this.run("PRAGMA journal_mode = WAL");
    await this.run("PRAGMA foreign_keys = ON");
    await this.run("PRAGMA busy_timeout = 5000");
    await this.createSchema();
    await this.recoverInterruptedJobs();
    return this;
  }

  async close() {
    if (!this.db) {
      return;
    }
    const db = this.db;
    this.db = null;
    await new Promise((resolve, reject) => {
      db.close((error) => (error ? reject(error) : resolve()));
    });
  }

  async createSchema() {
    await this.exec(`
      create table if not exists print_jobs (
        id text primary key,
        dedupe_key text not null,
        source text not null,
        type text not null,
        payload_json text not null,
        status text not null,
        attempts integer not null default 0,
        max_attempts integer not null default 3,
        created_at text not null,
        queued_at text,
        started_at text,
        spooler_accepted_at text,
        finished_at text,
        next_attempt_at text,
        error text,
        windows_job_id text,
        printer_name text,
        completed_reason text,
        remote_job_id text
      );

      create index if not exists idx_print_jobs_status_next_attempt
        on print_jobs (status, next_attempt_at, queued_at, created_at);

      create unique index if not exists idx_print_jobs_dedupe_open
        on print_jobs (dedupe_key)
        where status in ('QUEUED', 'PRINTING', 'SENT_TO_SPOOLER');
    `);
  }

  async recoverInterruptedJobs() {
    const now = new Date().toISOString();
    await this.run(
      `update print_jobs
       set status = ?, queued_at = coalesce(queued_at, ?), started_at = null, error = null
       where status = ?`,
      [PRINT_JOB_STATUS.QUEUED, now, PRINT_JOB_STATUS.PRINTING]
    );
    await this.run(
      `update print_jobs
       set status = ?,
           finished_at = coalesce(finished_at, ?),
           error = coalesce(error, 'Servico reiniciado apos envio ao spooler; status ambiguo sem retry automatico.'),
           completed_reason = coalesce(completed_reason, 'spooler_status_ambiguous_no_retry')
       where status = ?`,
      [PRINT_JOB_STATUS.FAILED, now, PRINT_JOB_STATUS.SENT_TO_SPOOLER]
    );
  }

  async insertJob(input) {
    const job = input?.status ? input : createPrintJob(input);
    const existing = await this.getOpenJobByDedupe(job.dedupeKey);
    if (existing) {
      return existing;
    }
    try {
      await this.run(
        `insert into print_jobs (
          id, dedupe_key, source, type, payload_json, status, attempts, max_attempts,
          created_at, queued_at, started_at, spooler_accepted_at, finished_at, next_attempt_at,
          error, windows_job_id, printer_name, completed_reason, remote_job_id
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          job.id,
          job.dedupeKey,
          job.source,
          job.type,
          JSON.stringify(job.payload || {}),
          job.status,
          job.attempts,
          job.maxAttempts,
          job.createdAt,
          job.queuedAt,
          job.startedAt,
          job.spoolerAcceptedAt,
          job.finishedAt,
          job.nextAttemptAt,
          job.error,
          job.windowsJobId,
          job.printerName,
          job.completedReason,
          job.remoteJobId
        ]
      );
    } catch (error) {
      if (String(error?.code || "") === "SQLITE_CONSTRAINT") {
        const duplicated = await this.getOpenJobByDedupe(job.dedupeKey);
        if (duplicated) {
          return duplicated;
        }
      }
      throw error;
    }
    return job;
  }

  async getOpenJobByDedupe(dedupeKey) {
    const row = await this.get(
      `select *
       from print_jobs
       where dedupe_key = ?
         and status in (?, ?, ?)
       order by created_at asc
       limit 1`,
      [
        dedupeKey,
        PRINT_JOB_STATUS.QUEUED,
        PRINT_JOB_STATUS.PRINTING,
        PRINT_JOB_STATUS.SENT_TO_SPOOLER
      ]
    );
    return row ? mapRowToJob(row) : null;
  }

  async getJob(id) {
    const row = await this.get("select * from print_jobs where id = ?", [id]);
    return row ? mapRowToJob(row) : null;
  }

  async getNextQueuedJob() {
    const now = new Date().toISOString();
    const row = await this.get(
      `select *
       from print_jobs
       where status = ?
         and (next_attempt_at is null or next_attempt_at <= ?)
       order by queued_at asc, created_at asc
       limit 1`,
      [PRINT_JOB_STATUS.QUEUED, now]
    );
    return row ? mapRowToJob(row) : null;
  }

  async updateJobStatus(id, patch = {}) {
    const allowedColumns = {
      status: "status",
      attempts: "attempts",
      queuedAt: "queued_at",
      startedAt: "started_at",
      spoolerAcceptedAt: "spooler_accepted_at",
      finishedAt: "finished_at",
      nextAttemptAt: "next_attempt_at",
      error: "error",
      windowsJobId: "windows_job_id",
      printerName: "printer_name",
      completedReason: "completed_reason"
    };
    const entries = Object.entries(patch).filter(([key]) => allowedColumns[key]);
    if (!entries.length) {
      return this.getJob(id);
    }
    const sets = entries.map(([key]) => `${allowedColumns[key]} = ?`);
    const values = entries.map(([, value]) => value);
    values.push(id);
    await this.run(`update print_jobs set ${sets.join(", ")} where id = ?`, values);
    return this.getJob(id);
  }

  async getQueueSummary() {
    const rows = await this.all(
      `select status, count(*) as total
       from print_jobs
       group by status
       order by status`
    );
    return rows.reduce((acc, row) => {
      acc[row.status] = Number(row.total || 0);
      return acc;
    }, {});
  }

  async listRecentJobs(limit = 25) {
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 25, 1), 100);
    const rows = await this.all(
      `select *
       from print_jobs
       order by coalesce(finished_at, spooler_accepted_at, started_at, queued_at, created_at) desc,
                created_at desc
       limit ?`,
      [safeLimit]
    );
    return rows.map(mapRowToJob);
  }

  async retryJob(id) {
    const job = await this.getJob(id);
    if (!job) {
      const error = new Error("PrintJob nao encontrado.");
      error.code = "PRINT_JOB_NOT_FOUND";
      throw error;
    }
    if (!canRetryJob(job)) {
      const error = new Error("PrintJob nao pode ser reenfileirado com seguranca.");
      error.code = "PRINT_JOB_RETRY_UNSAFE";
      throw error;
    }
    const existing = await this.getOpenJobByDedupe(job.dedupeKey);
    if (existing && existing.id !== job.id) {
      const error = new Error("Ja existe outro PrintJob aberto para a mesma etiqueta.");
      error.code = "PRINT_JOB_DUPLICATE_OPEN";
      throw error;
    }
    const now = new Date().toISOString();
    await this.updateJobStatus(job.id, {
      status: PRINT_JOB_STATUS.QUEUED,
      attempts: 0,
      queuedAt: now,
      startedAt: null,
      spoolerAcceptedAt: null,
      finishedAt: null,
      nextAttemptAt: null,
      error: null,
      windowsJobId: null,
      completedReason: "manual_retry_before_spooler"
    });
    return this.getJob(job.id);
  }

  async exec(sql) {
    await ensureOpen(this);
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (error) => (error ? reject(error) : resolve()));
    });
  }

  async run(sql, params = []) {
    await ensureOpen(this);
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function onRun(error) {
        if (error) {
          reject(error);
          return;
        }
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    await ensureOpen(this);
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row)));
    });
  }

  async all(sql, params = []) {
    await ensureOpen(this);
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows || [])));
    });
  }
}

async function openDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (error) => (error ? reject(error) : resolve(db)));
  });
}

async function ensureOpen(store) {
  if (!store.db) {
    await store.open();
  }
}

function mapRowToJob(row) {
  return {
    id: row.id,
    dedupeKey: row.dedupe_key,
    source: row.source,
    type: row.type,
    payload: JSON.parse(row.payload_json || "{}"),
    status: row.status,
    attempts: Number(row.attempts || 0),
    maxAttempts: Number(row.max_attempts || 0),
    createdAt: row.created_at,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    spoolerAcceptedAt: row.spooler_accepted_at,
    finishedAt: row.finished_at,
    nextAttemptAt: row.next_attempt_at,
    error: row.error,
    windowsJobId: row.windows_job_id,
    printerName: row.printer_name,
    completedReason: row.completed_reason,
    remoteJobId: row.remote_job_id
  };
}

function canRetryJob(job) {
  return Boolean(
    job &&
      job.status === PRINT_JOB_STATUS.FAILED &&
      !job.spoolerAcceptedAt &&
      job.completedReason === "failed_before_spooler"
  );
}

module.exports = {
  JobStore,
  DEFAULT_DB_PATH,
  canRetryJob
};

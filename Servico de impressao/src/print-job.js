const crypto = require("crypto");

const PRINT_JOB_STATUS = Object.freeze({
  QUEUED: "QUEUED",
  PRINTING: "PRINTING",
  SENT_TO_SPOOLER: "SENT_TO_SPOOLER",
  SPOOLER_DONE: "SPOOLER_DONE",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
});

const PRINT_JOB_SOURCE = Object.freeze({
  HTTP: "http",
  AUTO_PRINT: "auto_print",
  REMOTE_REPRINT: "remote_reprint"
});

const PRINT_JOB_TYPE = Object.freeze({
  PRINT: "print",
  REPRINT: "reprint"
});

const FINAL_PRINT_JOB_STATUSES = Object.freeze([
  PRINT_JOB_STATUS.SPOOLER_DONE,
  PRINT_JOB_STATUS.FAILED,
  PRINT_JOB_STATUS.CANCELLED
]);

function createPrintJob(input = {}) {
  const now = input.now || new Date().toISOString();
  const source = normalizeEnumValue(input.source, PRINT_JOB_SOURCE, PRINT_JOB_SOURCE.HTTP);
  const type = normalizeEnumValue(input.type, PRINT_JOB_TYPE, PRINT_JOB_TYPE.PRINT);
  const payload = normalizePayload(input.payload);
  const id = normalizeJobId(input.id) || generateJobId();

  return {
    id,
    dedupeKey: String(input.dedupeKey || buildDefaultDedupeKey({ source, type, payload })).slice(0, 255),
    source,
    type,
    payload,
    status: PRINT_JOB_STATUS.QUEUED,
    attempts: 0,
    maxAttempts: normalizePositiveInteger(input.maxAttempts, 3),
    createdAt: now,
    queuedAt: now,
    startedAt: null,
    spoolerAcceptedAt: null,
    finishedAt: null,
    nextAttemptAt: null,
    error: null,
    windowsJobId: null,
    printerName: null,
    completedReason: null,
    remoteJobId: input.remoteJobId ? String(input.remoteJobId) : null
  };
}

function isFinalPrintJobStatus(status) {
  return FINAL_PRINT_JOB_STATUSES.includes(status);
}

function normalizeJobId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(normalized)) {
    throw new Error("PrintJob id invalido.");
  }
  return normalized;
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("PrintJob payload invalido.");
  }
  const checkinId = String(payload.checkin_id || payload.checkinId || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(checkinId)) {
    throw new Error("PrintJob payload sem checkin_id valido.");
  }
  return { ...payload, checkin_id: checkinId };
}

function normalizeEnumValue(value, enumObject, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  const allowed = Object.values(enumObject);
  if (!allowed.includes(normalized)) {
    throw new Error(`Valor invalido para PrintJob: ${normalized}`);
  }
  return normalized;
}

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    return fallback;
  }
  return number;
}

function buildDefaultDedupeKey({ source, type, payload }) {
  const checkinId = payload?.checkin_id || "";
  return [source, type, checkinId].join(":");
}

function generateJobId() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

module.exports = {
  PRINT_JOB_STATUS,
  PRINT_JOB_SOURCE,
  PRINT_JOB_TYPE,
  FINAL_PRINT_JOB_STATUSES,
  createPrintJob,
  isFinalPrintJobStatus,
  buildDefaultDedupeKey
};

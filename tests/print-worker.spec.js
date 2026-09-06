const { test, expect } = require("@playwright/test");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const { JobStore } = require("../Servico de impressao/src/job-store");
const { PrintQueue } = require("../Servico de impressao/src/print-queue");
const { PrintWorker } = require("../Servico de impressao/src/print-worker");
const { PRINT_JOB_STATUS } = require("../Servico de impressao/src/print-job");

test("JobStore recupera PRINTING como QUEUED apos reinicio", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnms-job-store-test-"));
  const dbPath = path.join(tempDir, "jobs.sqlite");
  const store = await new JobStore({ dbPath }).open();
  const job = await store.insertJob({
    payload: { checkin_id: "recover1", conteudo: '<!doctype html><div class="label"></div>' }
  });
  await store.updateJobStatus(job.id, {
    status: PRINT_JOB_STATUS.PRINTING,
    startedAt: new Date().toISOString()
  });
  await store.close();

  const reopened = await new JobStore({ dbPath }).open();
  const recovered = await reopened.getJob(job.id);
  await reopened.close();
  await fs.rm(tempDir, { recursive: true, force: true });

  expect(recovered.status).toBe(PRINT_JOB_STATUS.QUEUED);
  expect(recovered.startedAt).toBeNull();
});

test("JobStore finaliza SENT_TO_SPOOLER como ambiguo apos reinicio", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnms-job-store-spooler-test-"));
  const dbPath = path.join(tempDir, "jobs.sqlite");
  const store = await new JobStore({ dbPath }).open();
  const job = await store.insertJob({
    dedupeKey: "http:print:spooled1",
    payload: { checkin_id: "spooled1", conteudo: '<!doctype html><div class="label"></div>' }
  });
  await store.updateJobStatus(job.id, {
    status: PRINT_JOB_STATUS.SENT_TO_SPOOLER,
    spoolerAcceptedAt: new Date().toISOString()
  });
  await store.close();

  const reopened = await new JobStore({ dbPath }).open();
  const recovered = await reopened.getJob(job.id);
  const next = await reopened.insertJob({
    dedupeKey: "http:print:spooled1",
    payload: { checkin_id: "spooled1", conteudo: '<!doctype html><div class="label"></div>' }
  });
  await reopened.close();
  await fs.rm(tempDir, { recursive: true, force: true });

  expect(recovered.status).toBe(PRINT_JOB_STATUS.FAILED);
  expect(recovered.completedReason).toBe("spooler_status_ambiguous_no_retry");
  expect(recovered.finishedAt).toBeTruthy();
  expect(next.id).not.toBe(job.id);
});

test("JobStore reutiliza PrintJob aberto pela mesma dedupeKey", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnms-job-dedupe-test-"));
  const store = await new JobStore({ dbPath: path.join(tempDir, "jobs.sqlite") }).open();
  const first = await store.insertJob({
    dedupeKey: "http:print:same1",
    payload: { checkin_id: "same1", conteudo: '<!doctype html><div class="label"></div>' }
  });
  const second = await store.insertJob({
    dedupeKey: "http:print:same1",
    payload: { checkin_id: "same1", conteudo: '<!doctype html><div class="label"></div>' }
  });
  await store.close();
  await fs.rm(tempDir, { recursive: true, force: true });

  expect(second.id).toBe(first.id);
});

test("PrintWorker processa um job por vez e conclui no spooler", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnms-worker-test-"));
  const store = await new JobStore({ dbPath: path.join(tempDir, "jobs.sqlite") }).open();
  let active = 0;
  let maxActive = 0;
  const processed = [];
  const adapter = {
    async printJob(job, hooks) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      processed.push(job.payload.checkin_id);
      await hooks.onSpoolerAccepted({ printerName: "Brother QL-810W", windowsJobId: job.payload.checkin_id });
      await delay(20);
      active -= 1;
      return {
        printerName: "Brother QL-810W",
        windowsJobId: job.payload.checkin_id,
        completedReason: "spooler_job_removed"
      };
    }
  };
  const queue = new PrintQueue({ jobStore: store });
  const worker = new PrintWorker({ jobStore: store, adapter, retryDelayMs: 10 });
  queue.attachWorker(worker);
  const first = await queue.enqueue({ payload: { checkin_id: "one", conteudo: '<!doctype html><div class="label"></div>' } });
  const second = await queue.enqueue({ payload: { checkin_id: "two", conteudo: '<!doctype html><div class="label"></div>' } });
  worker.start();

  await waitFor(async () => {
    const a = await store.getJob(first.id);
    const b = await store.getJob(second.id);
    return a.status === PRINT_JOB_STATUS.SPOOLER_DONE && b.status === PRINT_JOB_STATUS.SPOOLER_DONE;
  });
  worker.stop();
  await store.close();
  await fs.rm(tempDir, { recursive: true, force: true });

  expect(maxActive).toBe(1);
  expect(processed).toEqual(["one", "two"]);
});

test("PrintWorker nao faz retry automatico apos SENT_TO_SPOOLER", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "dnms-worker-fail-test-"));
  const store = await new JobStore({ dbPath: path.join(tempDir, "jobs.sqlite") }).open();
  const adapter = {
    async printJob(_job, hooks) {
      await hooks.onSpoolerAccepted({ printerName: "Brother QL-810W", windowsJobId: "99" });
      throw new Error("timeout ambiguo do spooler");
    }
  };
  const queue = new PrintQueue({ jobStore: store });
  const worker = new PrintWorker({ jobStore: store, adapter, retryDelayMs: 10 });
  queue.attachWorker(worker);
  const job = await queue.enqueue({
    payload: { checkin_id: "ambiguous1", conteudo: '<!doctype html><div class="label"></div>' },
    maxAttempts: 3
  });
  worker.start();

  await waitFor(async () => {
    const loaded = await store.getJob(job.id);
    return loaded.status === PRINT_JOB_STATUS.FAILED;
  });
  const failed = await store.getJob(job.id);
  worker.stop();
  await store.close();
  await fs.rm(tempDir, { recursive: true, force: true });

  expect(failed.attempts).toBe(1);
  expect(failed.completedReason).toBe("spooler_status_ambiguous_no_retry");
});

async function waitFor(predicate) {
  for (let i = 0; i < 40; i += 1) {
    if (await predicate()) {
      return;
    }
    await delay(50);
  }
  throw new Error("timeout aguardando condicao");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

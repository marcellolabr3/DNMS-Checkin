const { PRINT_JOB_STATUS } = require("./print-job");

const DEFAULT_RETRY_DELAY_MS = 2000;

class PrintWorker {
  constructor({ jobStore, adapter, logger = console, retryDelayMs = DEFAULT_RETRY_DELAY_MS, onJobFailed = null }) {
    if (!jobStore) {
      throw new Error("PrintWorker requer JobStore.");
    }
    if (!adapter?.printJob) {
      throw new Error("PrintWorker requer adapter.printJob.");
    }
    this.jobStore = jobStore;
    this.adapter = adapter;
    this.logger = logger;
    this.retryDelayMs = retryDelayMs;
    this.onJobFailed = onJobFailed;
    this.running = false;
    this.stopped = false;
    this.wakeup = null;
  }

  start() {
    this.stopped = false;
    this.kick();
  }

  stop() {
    this.stopped = true;
    if (this.wakeup) {
      this.wakeup();
      this.wakeup = null;
    }
  }

  kick() {
    if (this.wakeup) {
      this.wakeup();
      this.wakeup = null;
      return;
    }
    if (!this.running) {
      this.loop().catch((error) => {
        this.running = false;
        this.logger.error?.("[Servico de impressao] PrintWorker parou com erro:", error?.stack || error);
      });
    }
  }

  async loop() {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      while (!this.stopped) {
        const job = await this.jobStore.getNextQueuedJob();
        if (!job) {
          await this.waitForWakeup();
          continue;
        }
        await this.processJob(job);
      }
    } finally {
      this.running = false;
    }
  }

  async waitForWakeup() {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      if (typeof timer.unref === "function") {
        timer.unref();
      }
      this.wakeup = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  async processJob(job) {
    const startedAt = new Date().toISOString();
    const attempts = Number(job.attempts || 0) + 1;
    await this.jobStore.updateJobStatus(job.id, {
      status: PRINT_JOB_STATUS.PRINTING,
      attempts,
      startedAt,
      error: null,
      nextAttemptAt: null
    });

    try {
      const result = await this.adapter.printJob(job, {
        onSpoolerAccepted: async (spoolerInfo = {}) => {
          await this.jobStore.updateJobStatus(job.id, {
            status: PRINT_JOB_STATUS.SENT_TO_SPOOLER,
            spoolerAcceptedAt: new Date().toISOString(),
            windowsJobId: spoolerInfo.windowsJobId || null,
            printerName: spoolerInfo.printerName || null
          });
        }
      });
      await this.jobStore.updateJobStatus(job.id, {
        status: PRINT_JOB_STATUS.SPOOLER_DONE,
        finishedAt: new Date().toISOString(),
        completedReason: result?.completedReason || "spooler_job_removed",
        printerName: result?.printerName || job.printerName || null,
        windowsJobId: result?.windowsJobId || job.windowsJobId || null,
        error: null
      });
    } catch (error) {
      await this.handleJobError(job, attempts, error);
    }
  }

  async handleJobError(job, attempts, error) {
    const current = await this.jobStore.getJob(job.id);
    const message = String(error?.message || error || "Falha ao imprimir.").slice(0, 2000);
    if (current?.status !== PRINT_JOB_STATUS.SENT_TO_SPOOLER && attempts < Number(job.maxAttempts || 1)) {
      await this.jobStore.updateJobStatus(job.id, {
        status: PRINT_JOB_STATUS.QUEUED,
        queuedAt: new Date().toISOString(),
        nextAttemptAt: new Date(Date.now() + this.retryDelayMs).toISOString(),
        error: message
      });
      return;
    }
    await this.jobStore.updateJobStatus(job.id, {
      status: PRINT_JOB_STATUS.FAILED,
      finishedAt: new Date().toISOString(),
      error: message,
      completedReason: current?.status === PRINT_JOB_STATUS.SENT_TO_SPOOLER
        ? "spooler_status_ambiguous_no_retry"
        : "failed_before_spooler"
    });
    await this.onJobFailed?.(job, error);
  }
}

module.exports = {
  PrintWorker,
  DEFAULT_RETRY_DELAY_MS
};

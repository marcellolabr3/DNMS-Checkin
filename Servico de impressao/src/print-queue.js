class PrintQueue {
  constructor({ jobStore }) {
    if (!jobStore) {
      throw new Error("PrintQueue requer JobStore.");
    }
    this.jobStore = jobStore;
    this.worker = null;
  }

  attachWorker(worker) {
    this.worker = worker;
  }

  async enqueue(jobInput) {
    const job = await this.jobStore.insertJob(jobInput);
    this.notify();
    return job;
  }

  notify() {
    if (this.worker) {
      this.worker.kick();
    }
  }
}

module.exports = {
  PrintQueue
};

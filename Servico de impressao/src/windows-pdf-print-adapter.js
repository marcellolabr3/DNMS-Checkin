class WindowsPdfPrintAdapter {
  constructor(options = {}) {
    const required = [
      "getTargetPrinterOrThrow",
      "renderHtmlToPdf",
      "printPdfFile",
      "waitForPrinterQueueToSettle",
      "safeUnlink"
    ];
    required.forEach((name) => {
      if (typeof options[name] !== "function") {
        throw new Error(`WindowsPdfPrintAdapter requer ${name}.`);
      }
    });
    this.getTargetPrinterOrThrow = options.getTargetPrinterOrThrow;
    this.renderHtmlToPdf = options.renderHtmlToPdf;
    this.printPdfFile = options.printPdfFile;
    this.waitForPrinterQueueToSettle = options.waitForPrinterQueueToSettle;
    this.safeUnlink = options.safeUnlink;
    this.afterSpoolerDone = options.afterSpoolerDone || null;
  }

  async printJob(job, hooks = {}) {
    const html = String(job?.payload?.conteudo || job?.payload?.html || "");
    if (!html) {
      throw new Error("PrintJob sem conteudo HTML para impressao.");
    }
    const printer = await this.getTargetPrinterOrThrow();
    const pdfPath = await this.renderHtmlToPdf(html);
    try {
      await this.printPdfFile(pdfPath, printer.name);
      await hooks.onSpoolerAccepted?.({
        printerName: printer.name || "",
        windowsJobId: null
      });
      await this.waitForPrinterQueueToSettle(printer.name, pdfPath);
      await this.afterSpoolerDone?.(job, { printerName: printer.name || "" });
      return {
        printerName: printer.name || "",
        windowsJobId: null,
        completedReason: "spooler_job_removed"
      };
    } finally {
      await this.safeUnlink(pdfPath);
    }
  }
}

module.exports = {
  WindowsPdfPrintAdapter
};

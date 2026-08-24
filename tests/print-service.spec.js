const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("servico local de impressao tem protecoes HTTP compativeis", async () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "Servico de impressao", "server.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const print = fs.readFileSync(path.join(__dirname, "..", "print.js"), "utf8");

  expect(server).toContain('const HOST = process.env.PRINT_SERVICE_HOST || "127.0.0.1"');
  expect(server).toContain("app.listen(PORT, HOST");
  expect(server).toContain("PRINT_SERVICE_TOKEN");
  expect(server).toContain("authorizePrintRequest(req, res)");
  expect(server).toContain("PRINT_ALLOWED_ORIGINS");
  expect(server).toContain("validatePrintPayload");
  expect(server).toContain("Conteudo de impressao contem elementos nao permitidos.");
  expect(server.indexOf("validatePrintPayload({ checkinId, conteudo })")).toBeLessThan(
    server.indexOf("async function printCheckinById")
  );
  const listenerPrintBlock = server.slice(
    server.indexOf("async function printCheckinById"),
    server.indexOf("async function processPendingCheckins")
  );
  expect(listenerPrintBlock).not.toContain("routeType");
  expect(listenerPrintBlock).not.toContain("validatePrintPayload");

  expect(app).toContain('const PRINT_SERVICE_TOKEN_KEY = "dnms_print_service_token"');
  expect(app).toContain('"X-DNMS-Print-Token"');
  expect(app).toContain("headers: getPrintServiceHeaders()");

  expect(print).toContain('const PRINT_SERVICE_TOKEN_KEY = "dnms_print_service_token"');
  expect(print).toContain('"X-DNMS-Print-Token"');
  expect(print).toContain("headers: getPrintServiceHeaders()");
});

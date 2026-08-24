const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("XLSX nao carrega no HTML inicial e fica sob demanda", async () => {
  const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  expect(index).not.toContain("xlsx.full.min.js");
  expect(app).toContain("const XLSX_SCRIPT_URL");
  expect(app).toContain("async function ensureXlsxLoaded()");
  expect(app).toContain("loadScriptOnce(XLSX_SCRIPT_URL)");
  expect(app).toContain("await ensureXlsxLoaded()");
});

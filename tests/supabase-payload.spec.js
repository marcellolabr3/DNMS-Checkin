const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("cargas principais do Supabase usam colunas explicitas", async () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  expect(app).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
  expect(app).toContain("STUDENT_SELECT_COLUMNS");
  expect(app).toContain("ROOM_SELECT_COLUMNS");
  expect(app).toContain("CHECKIN_SELECT_COLUMNS");
  expect(app).toContain("AUDIT_LOG_SELECT_COLUMNS");
  expect(app).toContain("SCHEDULE_SELECT_COLUMNS");
  expect(app).toContain("TIP_SELECT_COLUMNS");
  expect(app).toContain("TIP_READ_SELECT_COLUMNS");
  expect(app).toContain('.select("id,created_at")');
});

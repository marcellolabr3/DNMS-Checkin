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

test("setup do Supabase inclui schema e policies atuais de mensagens", async () => {
  const setup = fs.readFileSync(path.join(__dirname, "..", "supabase", "setup_dnms_checkin.sql"), "utf8");

  expect(setup).toContain("sender_name text null");
  expect(setup).toContain("add column if not exists sender_name text null");
  expect(setup).toContain("drop policy if exists tips_delete_admin on public.tips");
  expect(setup).toContain("create policy tips_delete_admin on public.tips");
  expect(setup).toContain("drop policy if exists tip_reads_delete_admin on public.tip_reads");
  expect(setup).toContain("create policy tip_reads_delete_admin on public.tip_reads");
  expect(setup).toContain("lower(coalesce(p.email, '')) = 'marvinlabre@gmail.com'");
});

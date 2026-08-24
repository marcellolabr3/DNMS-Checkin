const { test, expect } = require("@playwright/test");
const { openApp, loginAs, getAlerts } = require("./helpers/app");

test("responsavel abre painel de mensagens e marca aviso como lido ao expandir", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=messages-panel" });
  await loginAs(page, "responsavel@dnms.test");

  await expect(page.locator("#btnTipsInbox")).toContainText("2");
  await page.click("#btnTipsInbox");

  await expect(page.locator("#tipsCard")).toBeVisible();
  await expect(page.locator("#studentCard")).toBeHidden();
  await expect(page.locator("#tipsComposer")).toBeHidden();
  await expect(page.locator("#tipsList")).toContainText("Aviso geral para todas as familias.");
  await expect(page.locator("#tipsList")).toContainText("Mensagem direcionada ao responsavel.");
  await expect(page.locator("#tipsList")).not.toContainText("Mensagem de outra familia.");

  await page.locator("#tipsList .tip-message-preview").first().click();
  await expect(page.locator("#btnTipsInbox")).toContainText("1");
});

test("admin envia mensagem pelo painel navegavel", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=messages-panel" });
  await loginAs(page, "admin@dnms.test");

  await page.click("#btnTipsInbox");
  await expect(page.locator("#tipsCard")).toBeVisible();
  await expect(page.locator("#tipsComposer")).toBeVisible();

  await page.selectOption("#tipsRecipientSelect", "parent-1");
  await page.fill("#tipsMessageInput", "Nova mensagem pelo painel.");
  await page.click("#btnSendTip");

  await expect.poll(async () => {
    return page.evaluate(() => window.__mockDnmsDb.tips.some((tip) => tip.message === "Nova mensagem pelo painel."));
  }).toBe(true);
  await expect(page.locator("#tipsList")).toContainText("Nova mensagem pelo painel.");
  await expect(await getAlerts(page)).toContain("Mensagem enviada.");
});

test("dashboard mostra mensagens recentes e abre painel completo", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=messages-panel" });
  await loginAs(page, "admin@dnms.test");

  await expect(page.locator("#dashboardCard")).toBeVisible();
  await expect(page.locator("#dashboardTips")).toContainText("Mensagem de outra familia.");
  await expect(page.locator("#dashboardTips")).toContainText("Mensagem direcionada ao responsavel.");
  await expect(page.locator("#dashboardTips")).toContainText("Aviso geral para todas as familias.");

  await page.click("#btnDashboardOpenTips");
  await expect(page.locator("#tipsCard")).toBeVisible();
  await expect(page.locator("#dashboardCard")).toBeHidden();
});

test("mensagem recente do dashboard abre expandida no painel", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=messages-panel" });
  await loginAs(page, "admin@dnms.test");

  await page.locator("#dashboardTips [data-dashboard-tip-id='tip-all-1']").click();

  await expect(page.locator("#tipsCard")).toBeVisible();
  await expect(page.locator("#tipsList [data-tip-id='tip-all-1']")).toHaveText("Aviso geral para todas as familias.");
});

test("mensagens exibe estados vazios no dashboard e no painel", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");

  await expect(page.locator("#dashboardTips")).toContainText("Nenhuma mensagem recente.");

  await page.click("#btnTipsInbox");
  await expect(page.locator("#tipsCard")).toBeVisible();
  await expect(page.locator("#tipsList")).toContainText("Nenhuma mensagem disponivel.");
});

test("mensagens mostra erro e permite tentar atualizar novamente", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=messages-error" });
  await loginAs(page, "admin@dnms.test");

  await expect(page.locator("#dashboardTips")).toContainText("Falha ao carregar mensagens.");
  await expect(page.locator("#dashboardTips")).toContainText("Erro simulado ao buscar mensagens.");

  await page.evaluate(() => {
    window.__mockTipsErrorCleared = true;
  });
  await page.locator("#dashboardTips [data-retry-tips]").click();
  await expect(page.locator("#dashboardTips")).toContainText("Nenhuma mensagem recente.");
});

test("texto longo de mensagem nao cria rolagem horizontal", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=messages-long-text" });
  await loginAs(page, "admin@dnms.test");

  await page.click("#btnTipsInbox");
  await page.locator("#tipsList .tip-message-preview").first().click();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

const { test, expect } = require("@playwright/test");
const { openApp, loginAs, getAlerts } = require("./helpers/app");

test("login invalido mostra erro e mantem tela de entrada", async ({ page }) => {
  await openApp(page);

  await page.fill("#loginEmail", "admin@dnms.test");
  await page.fill("#loginPassword", "erro");
  await page.click("#btnLogin");

  await expect(page.locator("#authCard")).toBeVisible();
  await expect.poll(() => getAlerts(page)).toContainEqual(expect.stringContaining("Falha no login"));
});

test("login e logout funcionam com perfil valido", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");

  await expect(page.locator("#sessionRole")).toContainText("Admin");
  await expect(page.locator("#dashboardCard")).toBeVisible();

  await page.click("#btnLogout");

  await expect(page.locator("#authCard")).toBeVisible();
  await expect(page.locator("#sessionRole")).toContainText("Deslogado");
});

test("restauracao de sessao nao mostra tela de login", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=restore-session", waitForAuth: false });

  await expect(page.locator("#authCard")).toBeHidden();
  await expect(page.locator("#dashboardCard")).toBeVisible();
  await expect(page.locator("#sessionRole")).toContainText("Admin");
});

test("restauracao lenta mostra carregamento sem piscar login", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=slow-restore-session", waitForAuth: false });

  await expect(page.locator("#bootCard")).toBeVisible({ timeout: 200 });
  await expect(page.locator("#authCard")).toBeHidden();
  await expect(page.locator("#dashboardCard")).toBeVisible();
  await expect(page.locator("#sessionRole")).toContainText("Admin");
});

test("nome do usuario e salvo com iniciais maiusculas", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");

  await page.click("#sessionRole");
  await expect(page.locator("#myDataDialog")).toBeVisible();
  await page.fill("#myDataName", "ADMIN   DNMS");
  await page.click("#btnSaveMyData");

  await expect(page.locator("#myDataDialog")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__mockDnmsDb.profiles.find((item) => item.id === "admin-1")?.name))
    .toBe("Admin Dnms");
});

test("enter no campo de senha executa login", async ({ page }) => {
  await openApp(page);

  await page.fill("#loginEmail", "admin@dnms.test");
  await page.fill("#loginPassword", "senha123");
  await page.press("#loginPassword", "Enter");

  await expect(page.locator("#authCard")).toBeHidden();
  await expect(page.locator("#sessionRole")).toContainText("Admin");
});

test("recuperacao de senha envia email e fecha a janela", async ({ page }) => {
  await openApp(page);

  await page.fill("#loginEmail", "responsavel@dnms.test");
  await page.click("#btnForgotPassword");
  await expect(page.locator("#forgotPasswordDialog")).toBeVisible();
  await page.click("#btnSendPasswordReset");

  await expect(page.locator("#forgotPasswordDialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__lastPasswordResetEmail)).toBe("responsavel@dnms.test");
  await expect.poll(() => getAlerts(page)).toContainEqual(expect.stringContaining("Link de redefinicao enviado"));
});

test("redefinicao de senha valida confirmacao antes de atualizar", async ({ page }) => {
  await openApp(page, { path: "/index.html#type=recovery" });

  await expect(page.locator("#resetPasswordDialog")).toBeVisible();
  await page.fill("#resetPasswordNew", "senha123");
  await page.fill("#resetPasswordConfirm", "senha456");
  await page.click("#btnSubmitPasswordReset");
  await expect.poll(() => getAlerts(page)).toContainEqual(expect.stringContaining("As senhas nao conferem"));

  await page.fill("#resetPasswordConfirm", "senha123");
  await page.click("#btnSubmitPasswordReset");

  await expect(page.locator("#resetPasswordDialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__lastUpdatedPassword)).toBe("senha123");
});

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
  await expect(page.locator(".app-loading-logo")).toHaveCSS("animation-name", "app-loading-spin");
  await expect(page.locator("#authCard")).toBeHidden();
  await expect(page.locator("#dashboardCard")).toBeVisible();
  await expect(page.locator("#sessionRole")).toContainText("Admin");
});

test("logo de carregamento gira mesmo com movimento reduzido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page, { path: "/index.html?scenario=slow-restore-session", waitForAuth: false });

  await expect(page.locator("#bootCard")).toBeVisible({ timeout: 200 });
  await expect(page.locator(".app-loading-logo")).toHaveCSS("animation-name", "app-loading-spin");
  await expect(page.locator(".app-loading-logo")).not.toHaveCSS("animation-duration", "0s");
});

test("sessao sem perfil faz logout e nao recria usuario excluido", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=missing-profile-session", waitForAuth: false });

  await expect(page.locator("#authCard")).toBeVisible();
  await expect(page.locator("#sessionRole")).toContainText("Deslogado");
  await expect.poll(() => getAlerts(page)).toContainEqual(expect.stringContaining("Usuario nao encontrado"));
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.profiles.find((item) => item.id === "deleted-auth-1"))))
    .toBe(false);
});

test("login com auth sem perfil e bloqueado sem recriar usuario", async ({ page }) => {
  await openApp(page);

  await page.fill("#loginEmail", "excluido@dnms.test");
  await page.fill("#loginPassword", "senha123");
  await page.click("#btnLogin");

  await expect(page.locator("#authCard")).toBeVisible();
  await expect(page.locator("#sessionRole")).toContainText("Deslogado");
  await expect.poll(() => getAlerts(page)).toContainEqual(expect.stringContaining("Usuario nao encontrado"));
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__mockDnmsDb.profiles.find((item) => item.id === "deleted-auth-1"))))
    .toBe(false);
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
  await page.press("#forgotPasswordEmail", "Enter");

  await expect(page.locator("#forgotPasswordDialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__lastPasswordResetEmail)).toBe("responsavel@dnms.test");
  await expect.poll(() => page.evaluate(() => window.__lastPasswordResetRedirectTo)).toContain("password_recovery=1");
  await expect.poll(() => getAlerts(page)).toContainEqual(expect.stringContaining("Link de redefinicao enviado"));
});

test("redefinicao de senha valida confirmacao antes de atualizar", async ({ page }) => {
  await openApp(page, { path: "/index.html?scenario=password-recovery-event&code=mock-code" });

  await expect(page.locator("#resetPasswordDialog")).toBeVisible();
  await expect(page.locator("#authCard")).toBeVisible();
  await expect(page.locator("#studentsCard")).toBeHidden();
  await page.fill("#resetPasswordNew", "senha123");
  await page.fill("#resetPasswordConfirm", "senha456");
  await page.click("#btnSubmitPasswordReset");
  await expect.poll(() => getAlerts(page)).toContainEqual(expect.stringContaining("As senhas nao conferem"));

  await page.fill("#resetPasswordConfirm", "senha123");
  await page.click("#btnSubmitPasswordReset");

  await expect(page.locator("#resetPasswordDialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__lastUpdatedPassword)).toBe("senha123");
  await expect(page.locator("#authCard")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__mockSignOutCount)).toBe(1);
  await expect(page).toHaveURL(/\/index\.html$/);
});

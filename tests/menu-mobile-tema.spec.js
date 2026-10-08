const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { openApp, loginAs } = require("./helpers/app");

const ROOT = path.join(__dirname, "..");

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

test("nenhum arquivo usa variavel CSS indefinida", () => {
  const files = ["styles.css", "index.html", "print.html"];
  const defined = new Set();
  const used = [];

  for (const file of files) {
    const source = stripComments(fs.readFileSync(path.join(ROOT, file), "utf8"));
    for (const match of source.matchAll(/--([a-z0-9-]+)\s*:/g)) {
      defined.add(match[1]);
    }
    for (const match of source.matchAll(/var\(\s*--([a-z0-9-]+)\s*([,)])/g)) {
      const hasFallback = match[2] === ",";
      if (!hasFallback) {
        used.push({ file, name: match[1] });
      }
    }
  }

  const undefinedVars = used.filter((item) => !defined.has(item.name));
  expect(undefinedVars).toEqual([]);
});

test("menu do topo vira linha unica rolavel no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");

  const nav = page.locator(".main-nav");
  await expect(nav).toBeVisible();

  const rows = await nav.evaluate((element) => {
    const tops = new Set(
      [...element.querySelectorAll("button")]
        .filter((button) => button.offsetParent !== null)
        .map((button) => Math.round(button.getBoundingClientRect().top))
    );
    return {
      rows: tops.size,
      scrollable: element.scrollWidth > element.clientWidth,
      height: element.getBoundingClientRect().height
    };
  });

  expect(rows.rows).toBe(1);
  expect(rows.scrollable).toBe(true);
  expect(rows.height).toBeLessThanOrEqual(60);

  const overflowX = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth
  );
  expect(overflowX).toBe(true);
});

test("chip ativo de Gestao/Log ganha destaque e menu rolavel o revela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await loginAs(page, "marvinlabre@gmail.com");

  await page.click("#btnInvitePanel");
  await expect(page.locator("#inviteCard")).toBeVisible();
  await expect(page.locator("#btnInvitePanel")).toHaveClass(/primary/);
  await expect(page.locator("#btnLogPanel")).toHaveClass(/ghost/);

  const inviteVisible = await page.evaluate(() => {
    const nav = document.querySelector(".main-nav");
    const button = document.getElementById("btnInvitePanel");
    const navRect = nav.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    return buttonRect.left >= navRect.left - 1 && buttonRect.right <= navRect.right + 1;
  });
  expect(inviteVisible).toBe(true);

  await page.click("#btnLogPanel");
  await expect(page.locator("#btnLogPanel")).toHaveClass(/primary/);
  await expect(page.locator("#btnInvitePanel")).toHaveClass(/ghost/);
});

test("painel QR do check-in presencial fica legivel nos dois temas", async ({ page }) => {
  await openApp(page);
  await loginAs(page, "admin@dnms.test");
  await page.click("#btnInvitePanel");
  await expect(page.locator("#inviteCard")).toBeVisible();

  const measure = () =>
    page.evaluate(() => {
      const luminance = (rgb) => {
        const channel = (value) => {
          const v = value / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        };
        return (
          0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
        );
      };
      const parse = (value) => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match) {
          return null;
        }
        const parts = match[1].split(",").map((part) => parseFloat(part));
        return { rgb: parts.slice(0, 3), alpha: parts.length > 3 ? parts[3] : 1 };
      };
      const effectiveBackground = (element) => {
        let current = element;
        while (current) {
          const parsed = parse(getComputedStyle(current).backgroundColor);
          if (parsed && parsed.alpha > 0) {
            return parsed.rgb;
          }
          current = current.parentElement;
        }
        return [255, 255, 255];
      };
      const contrast = (textColor, backgroundColor) => {
        const first = luminance(textColor);
        const second = luminance(backgroundColor);
        const lighter = Math.max(first, second);
        const darker = Math.min(first, second);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const panel = document.getElementById("presenceQrCard");
      const summaryText = panel.querySelector("summary span");
      const printArea = panel.querySelector(".presence-qr-print-area");
      const printText = printArea.querySelector("strong");

      const textColor = (element) => {
        const parsed = parse(getComputedStyle(element).color);
        return parsed ? parsed.rgb : [0, 0, 0];
      };

      return {
        summary: contrast(textColor(summaryText), effectiveBackground(summaryText)),
        printArea: contrast(textColor(printText), effectiveBackground(printArea))
      };
    });

  const light = await measure();
  expect(light.summary).toBeGreaterThanOrEqual(4.5);
  expect(light.printArea).toBeGreaterThanOrEqual(4.5);

  await page.click("#btnThemeToggle");
  await expect(page.locator("body")).toHaveClass(/theme-dark/);

  const dark = await measure();
  expect(dark.summary).toBeGreaterThanOrEqual(4.5);
  expect(dark.printArea).toBeGreaterThanOrEqual(4.5);
});

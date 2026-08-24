const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

test("PWA usa icones reais e nao baixa logo antigo no boot", async () => {
  const root = path.join(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8").replace(/^\uFEFF/, ""));
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

  expect(manifest.icons).toEqual([
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" }
  ]);
  expect(readPngSize(path.join(root, "icon-192.png"))).toEqual({ width: 192, height: 192 });
  expect(readPngSize(path.join(root, "icon-512.png"))).toEqual({ width: 512, height: 512 });
  expect(index).toContain('href="icon-192.png"');
  expect(index).toContain('src="icon-512.png"');
  expect(index).not.toContain("logo-loading.png");
  expect(sw).not.toContain("logo-loading.png");
});

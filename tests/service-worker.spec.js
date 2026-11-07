const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("service worker restringe cache a assets estaticos locais", async () => {
  const root = path.join(__dirname, "..");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const appAsset = index.match(/src="(app\.js\?v=[^"]+)"/)?.[1];

  expect(sw).toMatch(/const CACHE_NAME = "checkin-cache-v\d+";/);
  expect(appAsset).toBeTruthy();
  expect(sw).toContain(`"./${appAsset}"`);
  expect(sw).toContain('"./vendor/jsQR.js"');
  expect(sw).toContain('"./qr-checkin-presencial.svg"');
  expect(sw).toContain("requestUrl.origin !== self.location.origin");
  expect(sw).toContain("!ASSET_PATHS.has(requestUrl.pathname)");
  expect(sw).toContain('caches.match("./index.html")');

  const requestUrlIndex = sw.indexOf("const requestUrl = new URL(event.request.url)");
  const guardIndex = sw.indexOf("requestUrl.origin !== self.location.origin");
  const cacheRespondIndex = sw.indexOf("event.respondWith", guardIndex);
  const cachePutIndex = sw.indexOf("cache.put(event.request", guardIndex);

  expect(requestUrlIndex).toBeGreaterThan(-1);
  expect(guardIndex).toBeGreaterThan(requestUrlIndex);
  expect(cacheRespondIndex).toBeGreaterThan(guardIndex);
  expect(cachePutIndex).toBeGreaterThan(guardIndex);
});

const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

test("service worker restringe cache a assets estaticos locais", async () => {
  const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");

  expect(sw).toContain('const CACHE_NAME = "checkin-cache-v155"');
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

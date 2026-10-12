/* Keeps the app working without internet. Change BUILD when the app files change. */
var BUILD = 12, CACHE = 'testlog-b' + BUILD;
var SHELL = ['./', 'index.html', 'desk.html', 'config.js', 'css/app.css', 'js/core.js', 'js/alarm.js', 'js/torch.js', 'js/phone.js', 'js/desk.js', 'js/import.js', 'vendor/exceljs.min.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

// A NEW BUILD IS DOWNLOADED WHOLE, AND FRESH (build 6).
// The web host tells the phone it may reuse a file for 10 minutes. Build 5 and older filled the new
// store through that 10-minute copy, so a phone opened soon after an upload stored the OLD files
// under the NEW build and stayed on the old build. `cache: 'reload'` skips that copy.
// If one file fails (weak internet), the install fails, the old build keeps working, and the
// phone tries again at the next open. A half-downloaded build is never used.
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (res) {
        if (!res.ok) throw new Error(u + ' ' + res.status);
        return c.put(u, res);
      });
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;                       // data calls to the Google Sheet are never cached
  var fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return;
  // The app asks "which build is on the server?" with no-store. That question must reach the server.
  if (req.cache === 'no-store' || /\/sw\.js$/.test(url.pathname) || /\.apk$/.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: url.origin === location.origin }).then(function (hit) {
      // Refresh the saved copy in the background, asking the server each time (no 10-minute copy).
      var fresh = url.origin === location.origin ? new Request(req.url, { cache: 'no-cache' }) : req;
      var net = fetch(fresh).then(function (res) { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; });
      if (hit) { net.catch(function () {}); return hit; }   // show the saved copy now
      return net;
    });
  }));
});

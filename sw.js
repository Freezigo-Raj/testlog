/* Keeps the app working without internet. Change BUILD when the app files change. */
var BUILD = 4, CACHE = 'testlog-b' + BUILD;
var SHELL = ['./', 'index.html', 'desk.html', 'config.js', 'css/app.css', 'js/core.js', 'js/alarm.js', 'js/torch.js', 'js/phone.js', 'js/desk.js', 'vendor/exceljs.min.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;                       // data calls to the Google Sheet are never cached
  var fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return;
  e.respondWith(caches.open(CACHE).then(function (cache) {
    return cache.match(req, { ignoreSearch: url.origin === location.origin }).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; });
      if (hit) { net.catch(function () {}); return hit; }   // show the saved copy now, refresh it in the background
      return net;
    });
  }));
});

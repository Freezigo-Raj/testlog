/* Freezigo Test Log - shared core: storage, sign in, saved changes, sync. */
(function () {
  'use strict';
  var BUILD = 14;
  var OFFLINE_DAYS = 7;
  var cfg = window.TESTLOG_CONFIG || {};

  /* ---------- small helpers ---------- */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function localISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function toDate(s) { if (!s) return null; var d = new Date(s); return isNaN(d) ? null : d; }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function hhmm(s) { var d = toDate(s); return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; }
  function dmy(s) { var d = toDate(s); return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : ''; }
  function dm(s) { var d = toDate(s); return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] : ''; }
  function dmhm(s) { var d = toDate(s); return d ? dm(s) + ', ' + hhmm(s) : ''; }
  function dmyhm(s) { var d = toDate(s); return d ? dmy(s) + ', ' + hhmm(s) : ''; }
  function minsBetween(a, b) { var x = toDate(a), y = toDate(b); return x && y ? (y - x) / 60000 : 0; }
  function dur(min) {
    min = Math.max(0, Math.round(min));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + ' h ' + pad(m) + ' min' : m + ' min';
  }
  function hm(min) { min = Math.max(0, Math.floor(min)); return Math.floor(min / 60) + ':' + pad(min % 60); }
  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function initials(name) {
    name = String(name || '?').trim();
    var parts = name.split(/\s+/);
    var x = parts.length > 1 ? parts[0][0] + parts[1][0] : name.replace(/[aeiou]/gi, function (c, i) { return i ? '' : c; }).slice(0, 2);
    return (x.length < 2 ? name.slice(0, 2) : x).toUpperCase();
  }
  function num(v) { if (v === '' || v === null || v === undefined) return null; var n = Number(v); return isNaN(n) ? null : n; }

  /* ---------- icons (from the design) ---------- */
  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    back: '<path d="M19 12H5.5"/><path d="M11.5 5.5L5 12l6.5 6.5"/>', next: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    chevron: '<path d="M9.5 5.5l6.5 6.5-6.5 6.5"/>', chevLeft: '<path d="M14.5 5.5L8 12l6.5 6.5"/>', down: '<path d="M6 9.5l6 6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V10"/><path d="M9.5 2.8h5"/>',
    camera: '<path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5l1.8-2.5h5.4L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/><circle cx="12" cy="12.8" r="3.4"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.8" r="1.7"/><path d="M20.5 15.5l-4.8-4.8L6.5 19.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>',
    cloudOk: '<path d="M7 18.5h10.5A4 4 0 0 0 18 10.53A6 6 0 0 0 6.1 9.2A4.7 4.7 0 0 0 7 18.5z"/><path d="M9.3 14.3l2 2 3.7-3.7"/>',
    cloudOff: '<path d="M7 18.5h10.5A4 4 0 0 0 18 10.53A6 6 0 0 0 6.1 9.2A4.7 4.7 0 0 0 7 18.5z"/><path d="M3.5 3.5l17 17"/>',
    cloudUp: '<path d="M7 18.5h10.5A4 4 0 0 0 18 10.53A6 6 0 0 0 6.1 9.2A4.7 4.7 0 0 0 7 18.5z"/><path d="M12 16.8v-5.3"/><path d="M9.6 13.7l2.4-2.4 2.4 2.4"/>',
    warn: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.3v.2"/>',
    spin: '<path d="M20 12a8 8 0 1 1-8-8"/>', retry: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
    syncArrows: '<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.5 3v4h-4"/><path d="M6.5 21v-4h4"/>',
    phoneOk: '<rect x="6.5" y="3" width="11" height="18" rx="2"/><path d="M11 17.5h2"/><path d="M9.5 10.5l1.8 1.8 3.2-3.2"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    person: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>', more: '<path d="M12 5h.01M12 12h.01M12 19h.01"/>',
    power: '<path d="M12 3.5v8"/><path d="M7.2 6.7a7 7 0 1 0 9.6 0"/>',
    swap: '<path d="M4 8h13"/><path d="M13.5 4.5L17 8l-3.5 3.5"/><path d="M20 16H7"/><path d="M10.5 12.5L7 16l3.5 3.5"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4.5h11l-2 3.5 2 3.5H5"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11.5V5a1.5 1.5 0 0 1 3 0v6.5"/><path d="M14 11.5V6.5a1.5 1.5 0 0 1 3 0v7"/><path d="M8 12.5l-1.2-1.6a1.6 1.6 0 0 0-2.6 1.9l3.3 5.2A6 6 0 0 0 12.6 21H13a5 5 0 0 0 5-5v-2.5"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    pencil: '<path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.7 18.5z"/><path d="M14 6.8l3.2 3.2"/>',
    note: '<path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z"/><path d="M8 9h8M8 12h5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8v.2"/>',
    grip: '<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/>',
    arrowUp: '<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>', arrowDown: '<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
    bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>', list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><path d="M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
    excel: '<path d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14 2.5V7h5"/><path d="M9 12h7M9 15.5h7M12.5 10.5v8"/>',
    pdf: '<path d="M6 2.5h8.5L19 7v14.5H6z"/><path d="M14 2.5V7h5"/><path d="M9 13h6M9 16.5h4"/>',
    download: '<path d="M12 3.5v12"/><path d="M7 11l5 5 5-5"/><path d="M4.5 20.5h15"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>', torch: '<path d="M8 3h8v3l-2 3v11a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9L8 6z"/><path d="M8 6h8"/><path d="M12 12v2.5"/>', logout: '<path d="M14 4.5h4.5v15H14"/><path d="M4 12h10"/><path d="M10.5 8.5L14 12l-3.5 3.5"/>'
  };
  function icon(name, size, extra) {
    size = size || 22;
    return '<svg class="i" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"' + (extra ? ' ' + extra : '') + '>' + (ICONS[name] || '') + '</svg>';
  }

  /* ---------- storage (IndexedDB) ---------- */
  var dbp = null;
  function idb() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('freezigo-testlog', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); r.result.createObjectStore('photos', { keyPath: 'photo_id' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return idb().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), out = fn(t.objectStore(store));
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  var photosDb = {
    put: function (p) { return tx('photos', 'readwrite', function (s) { s.put(p); }); },
    get: function (id) { return tx('photos', 'readonly', function (s) { return s.get(id); }); },
    all: function () { return tx('photos', 'readonly', function (s) { return s.getAll(); }); },
    del: function (id) { return tx('photos', 'readwrite', function (s) { s.delete(id); }); }
  };

  /* ---------- state ---------- */
  var state = null;
  var live = { syncing: false, error: null, online: navigator.onLine, blockedUser: null, photosWaiting: 0, lastSyncAt: null };
  var listeners = [];
  function emit(what) { listeners.forEach(function (f) { try { f(what || 'change'); } catch (e) { console.error(e); } }); }
  function fresh() {
    return { v: 1, phone: '', users: {}, current: '', lastUser: '', people: [], products: [], templates: [], phones: [], tests: {},
      outbox: [], failed: [], since: '', counters: {}, drafts: {}, newTest: null, recentTemplates: [], seenTakeover: {}, alarmSkip: {}, alarmArmed: {} };
  }
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { tx('kv', 'readwrite', function (s) { s.put(JSON.parse(JSON.stringify(state)), 'state'); }).catch(console.error); }, 150);
  }
  function load() {
    return tx('kv', 'readonly', function (s) { return s.get('state'); }).then(function (v) {
      state = Object.assign(fresh(), v || {});
      return refreshPhotoCount();
    });
  }
  function refreshPhotoCount() {
    return photosDb.all().then(function (all) { live.photosWaiting = all.filter(function (p) { return !p.uploaded; }).length; });
  }
  function me() { return state.users[state.current] || null; }
  function personName(username) {
    var p = state.people.find(function (x) { return x.username === username; });
    return p ? p.name : (username || '');
  }

  /* ---------- server calls ---------- */
  function api(action, body, timeoutMs) {
    if (!cfg.api) return Promise.reject(Object.assign(new Error('The app is not connected to the Google Sheet yet.'), { code: 500 }));
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, timeoutMs || 60000);
    return fetch(cfg.api, { method: 'POST', body: JSON.stringify(Object.assign({ action: action }, body || {})), signal: ctl.signal, redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw Object.assign(new Error(j.error || 'Something went wrong.'), { code: j.code || 500 });
        return j;
      }, function (e) { throw Object.assign(new Error('No connection to the server.'), { network: true }); })
      .finally(function () { clearTimeout(timer); });
  }

  /* ---------- sign in (online, or offline for 7 days) ---------- */
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function verifier(password, salt) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 60000 }, k, 256);
    }).then(b64);
  }
  function daysLeftOffline(acct) {
    if (!acct || !acct.lastOnline) return 0;
    return OFFLINE_DAYS - (Date.now() - new Date(acct.lastOnline).getTime()) / 864e5;
  }
  function signIn(username, password, opts) {
    username = String(username || '').trim().toLowerCase();
    var action = opts && opts.setup ? 'setupAdmin' : 'login';
    var online = api(action, { username: username, password: password, name: opts && opts.name, phone: state.phone });
    return online.then(function (r) {
      var salt = uid();
      return verifier(password, salt).then(function (v) {
        state.users[username] = { username: username, name: r.user.name, role: r.user.role, token: r.token, salt: salt, verifier: v, lastOnline: new Date().toISOString() };
        state.current = username; state.lastUser = username;
        save();
        return ensurePhone().then(function () { emit('signin'); sync(); return state.users[username]; });
      });
    }, function (e) {
      if (!e.network) throw e;
      var acct = state.users[username];
      if (!acct || !acct.verifier) throw new Error('No internet. Sign in once with internet on this phone first.');
      if (daysLeftOffline(acct) <= 0) throw new Error('No internet for more than 7 days. Connect to the internet and sign in again.');
      return verifier(password, acct.salt).then(function (v) {
        if (v !== acct.verifier) throw new Error('Wrong password.');
        state.current = username; state.lastUser = username;
        save(); emit('signin');
        return acct;
      });
    });
  }
  function signOut() { state.current = ''; save(); emit('signout'); }
  function ensurePhone() {
    if (state.phone || !cfg.phoneCodes) return Promise.resolve();
    return api('registerPhone', { token: me().token }).then(function (r) { state.phone = r.code; save(); });
  }
  function fetchNames() {
    return api('names', {}, 20000).then(function (r) {
      state.people = r.names.map(function (n) { return Object.assign({ active: true }, state.people.find(function (p) { return p.username === n.username; }) || {}, n); });
      save();
    });
  }

  /* ---------- test helpers ---------- */
  function newTestId() {
    var d = new Date(), key = String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate());
    var n = (state.counters[key] || 0) + 1;
    state.counters = {}; state.counters[key] = n;
    return 'T-' + key + '-' + (state.phone || 'XX') + '-' + pad(n);
  }
  // A template holds two kinds of column. Reading columns are filled at every reading.
  // Setup fields (scope "setup") are filled once, at the start of the test.
  var LEGACY_SETUP = [{ id: 'refrigerant_qty', name: 'Refrigerant quantity', type: 'number', unit: 'kg', scope: 'setup' },
    { id: 'ts_water', name: 'TS DM water', type: 'number', unit: 'L', scope: 'setup' }, { id: 'bmc_water', name: 'BMC water', type: 'number', unit: 'L', scope: 'setup' }];
  function readingColumns(columns) { return (columns || []).filter(function (c) { return c.scope !== 'setup'; }); }
  function setupFields(columns, product) {
    var f = (columns || []).filter(function (c) { return c.scope === 'setup'; });
    // Templates made before setup fields existed: the BMC ones keep the three fields they always had.
    return f.length ? f : (product === 'BMC cooling' ? LEGACY_SETUP : []);
  }
  function activeColumns(test) { return readingColumns(test.columns).filter(function (c) { return c.on !== false; }); }
  function sortedReadings(b) {
    return b.readings.slice().sort(function (x, y) { return x.no - y.no || (x.saved_at || '').localeCompare(y.saved_at || ''); });
  }
  function usedReadings(b) {
    // One reading for each number. If a number was saved twice, use the reviewer's pick, else the one not marked late.
    var byNo = {};
    sortedReadings(b).forEach(function (r) {
      var cur = byNo[r.no];
      if (!cur) { byNo[r.no] = r; return; }
      if (r.use === 'yes' || (cur.use !== 'yes' && cur.late && !r.late)) byNo[r.no] = r;
    });
    return Object.keys(byNo).map(function (k) { return byNo[k]; }).sort(function (x, y) { return x.no - y.no; });
  }
  function nextNo(b) { return b.readings.reduce(function (m, r) { return Math.max(m, r.no); }, 0) + 1; }
  function compressor(b, untilISO) {
    // Works out the ON/OFF state and total ON minutes from the ON/OFF taps.
    var evs = b.events.filter(function (e) { return e.kind === 'compressor_on' || e.kind === 'compressor_off'; })
      .sort(function (x, y) { return (x.time || '').localeCompare(y.time || ''); });
    var on = false, since = null, total = 0, periods = [];
    evs.forEach(function (e) {
      if (e.kind === 'compressor_on' && !on) { on = true; since = e.time; }
      else if (e.kind === 'compressor_off' && on) { on = false; total += minsBetween(since, e.time); periods.push([since, e.time]); since = e.time; }
      else if (e.kind === 'compressor_off' && !since) { since = e.time; }
    });
    var end = untilISO || b.test.ended_at || localISO();
    if (on) { total += Math.max(0, minsBetween(since, end)); periods.push([since, end]); }
    return { on: on, since: since, totalMin: total, periods: periods, taps: evs.length, known: evs.length > 0 };
  }
  function energy(b) {
    var col = readingColumns(b.test.columns).find(function (c) { return c.type === 'number' && /kwh/i.test(c.unit || ''); });
    if (!col) return null;
    var vals = usedReadings(b).map(function (r) { return num(r.values[col.id]); }).filter(function (v) { return v !== null; });
    if (vals.length < 2) return { col: col, first: vals[0], last: vals[0], total: null };
    return { col: col, first: vals[0], last: vals[vals.length - 1], total: vals[vals.length - 1] - vals[0] };
  }
  function nextDue(b) {
    var t = b.test;
    if (!t.interval_min || t.status === 'finished') return null;
    var last = b.readings.reduce(function (m, r) { return r.time > m ? r.time : m; }, t.started_at || '');
    var base = toDate(last);
    return base ? new Date(base.getTime() + t.interval_min * 60000) : null;
  }
  // Complete or partial test (build 13): '' means not marked yet.
  function coverage(t) { return (t && (t.coverage || (t.setup && t.setup.coverage))) || ''; }
  function coverageName(c) { return c === 'complete' ? 'Complete test' : c === 'partial' ? 'Partial test' : ''; }
  var ROLES = { reviewer: 'Reviewer', engineer: 'Engineer', technician: 'Technician' };
  function roleName(r) { return ROLES[r] || 'Technician'; }
  /**
   * When the test began, for "time from start": the start time, or the first reading's time if that is earlier.
   * Example: test started on the phone at 11:59, but readings were entered with times 10:45, 11:20 and 11:58
   * (copied from paper). Time zero is then 10:45, so those readings sit at 0, 0.58 and 1.22 hours.
   */
  function startOf(b) {
    var s = b.test.started_at || '';
    b.readings.forEach(function (r) { if (r.time && (!s || r.time < s)) s = r.time; });
    return s;
  }
  /** What a person calls the test: the machine name/code, else the template name. The Test ID is only a reference. */
  function testTitle(t) { return (t && (t.machine_code || t.template_name)) || 'Test'; }
  /** A deleted test is a locked test whose final remark starts with [DELETED]. It stays in the Sheet and is hidden in the app. */
  function isDeleted(t) { return !!t && /^\[DELETED\]/.test(t.final_remarks || ''); }
  var LIMIT = 100000;   // no number in the app may be above 100000 or below -100000
  function decimalsOf(v) { var x = String(v === undefined || v === null ? '' : v), i = x.indexOf('.'); return i < 0 ? 0 : x.length - i - 1; }
  /**
   * The value a number column should be near at time `atISO`, from the last 3 readings and their times.
   * It finds the change for each minute, then multiplies by the minutes since the last reading.
   * Example: 30.6 at 14:20, 29.2 at 14:30, 27.8 at 14:40 falls 0.14 a minute.
   *          At 14:50 (10 min later) that gives 26.4. At 14:47 (7 min) it gives 26.8. At 15:05 (25 min) it gives 24.3.
   * `dec` is how many digits those readings had after the point. With 1 reading the answer is that reading.
   * The answer is only shown as a grey hint. It is saved only when the person spins or types.
   */
  function predict(b, col, atISO) {
    var pts = usedReadings(b).map(function (r) { return { t: toDate(r.time), v: num(r.values[col.id]), raw: r.values[col.id] }; })
      .filter(function (p) { return p.v !== null && p.t; }).slice(-3);
    if (!pts.length) return { value: '', dec: 0 };
    var dec = Math.max.apply(null, pts.map(function (p) { return decimalsOf(p.raw); })), last = pts[pts.length - 1], v = last.v;
    if (pts.length >= 2) {
      var t0 = pts[0].t.getTime(), xs = pts.map(function (p) { return (p.t.getTime() - t0) / 60000; }), n = xs.length;
      var mx = xs.reduce(function (a, x) { return a + x; }, 0) / n, my = pts.reduce(function (a, p) { return a + p.v; }, 0) / n, sxx = 0, sxy = 0;
      pts.forEach(function (p, i) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (p.v - my); });
      if (sxx > 0) {
        // Minutes from the last reading's time to this reading's time, whatever the gap is.
        var at = (toDate(atISO) || new Date()).getTime(), dx = Math.max(0, (at - last.t.getTime()) / 60000);
        v = last.v + (sxy / sxx) * dx;
      }
    }
    v = Math.max(-LIMIT, Math.min(LIMIT, v));
    var out = v.toFixed(dec);
    return { value: Number(out) === 0 ? (0).toFixed(dec) : out, dec: dec };
  }
  function iAmRecorder(b) { return b && b.test.status !== 'finished' && b.test.current_recorder === state.current; }

  /* ---------- saved changes ("ops"): applied on the phone first, sent to the Sheet later ---------- */
  function applyLocal(op) {
    var p = op.payload, t = op.type, user = op.user, b, test;
    var tests = state.tests;
    if (t === 'test.create') {
      if (tests[p.test.test_id]) return;
      tests[p.test.test_id] = { test: Object.assign({ status: 'running', ended_at: '', final_remarks: '', comp_on_min: null, setup: {}, columns: [] }, p.test,
        { current_recorder: user, created_by: user, phone: state.phone }), readings: [], events: [], edits: [], notes: [], photos: [] };
      return;
    }
    b = tests[p.test_id || (p.reading && p.reading.test_id) || (p.event && p.event.test_id) || (p.note && p.note.test_id)];
    if (!b) return;
    test = b.test;
    if (t === 'test.update') { Object.assign(test, p.patch); return; }
    if (t === 'reading.save') {
      var r = p.reading, old = b.readings.find(function (x) { return x.reading_id === r.reading_id; });
      if (!old) { b.readings.push(Object.assign({ late: test.current_recorder !== user, use: '', by: user, phone: state.phone }, r)); return; }
      var log = function (id, name, x, y) {
        x = x === undefined ? '' : String(x); y = y === undefined ? '' : String(y);
        if (x === y) return;
        b.edits.push({ edit_id: uid(), test_id: test.test_id, reading_id: old.reading_id, no: old.no, column_id: id, column_name: name, old_value: x, new_value: y, by: user, at: new Date().toISOString() });
      };
      (test.columns || []).forEach(function (c) { log(c.id, c.name + (c.unit ? ' (' + c.unit + ')' : ''), old.values[c.id], r.values[c.id]); });
      log('_time', 'Time', old.time, r.time); log('_note', 'Note', old.note, r.note || '');
      if (r.time !== old.time) old.time_changed = true;
      old.values = r.values; old.time = r.time; old.note = r.note || '';
      return;
    }
    if (t === 'event.add') { if (!b.events.some(function (e) { return e.event_id === p.event.event_id; })) b.events.push(Object.assign({ by: user, data: {} }, p.event)); return; }
    if (t === 'test.handover') {
      b.events.push({ event_id: p.event_id, test_id: test.test_id, kind: 'handover', time: p.time, by: user,
        text: 'Handed over from ' + personName(user) + ' to ' + personName(p.to), data: { from: user, to: p.to, note: p.note || '', same_phone: !!p.same_phone } });
      test.current_recorder = p.to; return;
    }
    if (t === 'test.takeover') {
      b.events.push({ event_id: p.event_id, test_id: test.test_id, kind: 'takeover', time: p.time, by: user,
        text: personName(user) + ' took over from ' + personName(test.current_recorder), data: { from: test.current_recorder, to: user } });
      test.current_recorder = user; return;
    }
    if (t === 'test.finish') {
      Object.assign(test, { status: 'finished', ended_at: p.ended_at, end_time_changed: !!p.end_time_changed, final_remarks: p.final_remarks || '', comp_on_min: p.comp_on_min, comp_on_edited: !!p.comp_on_edited });
      b.events.push({ event_id: p.event_id, test_id: test.test_id, kind: 'finish', time: p.ended_at, by: user, text: 'Test finished and locked by ' + personName(user), data: {} });
      return;
    }
    if (t === 'note.add') { b.notes.push(Object.assign({ by: user, role: (state.users[user] || {}).role === 'reviewer' ? 'reviewer' : 'recorder', at: new Date().toISOString() }, p.note)); return; }
    if (t === 'reading.choose') { b.readings.forEach(function (x) { if (x.no === p.no) x.use = x.reading_id === p.reading_id ? 'yes' : 'no'; }); return; }
  }
  function act(type, payload) {
    var op = { op_id: uid(), type: type, payload: payload, user: state.current, at: localISO() };
    applyLocal(op);
    state.outbox.push(op);
    save(); emit('op');
    scheduleSync(800);
    return op;
  }
  function pendingReadingIds() {
    var ids = {};
    state.outbox.forEach(function (op) { if (op.type === 'reading.save') ids[op.payload.reading.reading_id] = true; });
    return ids;
  }
  function waitingCount() { return state.outbox.length + live.photosWaiting; }

  /* ---------- sync ---------- */
  var syncTimer = null, again = false;
  function scheduleSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms || 0); }
  function mergeData(data) {
    if (data.people) state.people = data.people;
    if (data.products) state.products = data.products;
    if (data.templates) state.templates = data.templates;
    if (data.phones) state.phones = data.phones;
    (data.tests || []).forEach(function (bundle) { state.tests[bundle.test.test_id] = bundle; });
    // put back changes that are still waiting on this phone
    var touched = {};
    (data.tests || []).forEach(function (b) { touched[b.test.test_id] = true; });
    state.outbox.forEach(function (op) {
      var p = op.payload, id = p.test_id || (p.test && p.test.test_id) || (p.reading && p.reading.test_id) || (p.event && p.event.test_id) || (p.note && p.note.test_id);
      if (touched[id]) applyLocal(op);
    });
    // forget old finished tests to keep the phone light
    var cut = Date.now() - 30 * 864e5;
    Object.keys(state.tests).forEach(function (id) {
      var t = state.tests[id].test;
      if (t.status === 'finished' && toDate(t.ended_at) && toDate(t.ended_at).getTime() < cut) delete state.tests[id];
    });
  }
  function sync() {
    if (!state || !state.current || !me() || !cfg.api) return Promise.resolve();
    if (live.syncing) { again = true; return Promise.resolve(); }
    if (!navigator.onLine) { live.online = false; emit('sync'); return Promise.resolve(); }
    live.syncing = true; live.error = null; live.blockedUser = null; emit('sync');
    var pulled = false;
    function pushSegment() {
      if (!state.outbox.length) return Promise.resolve();
      var u = state.outbox[0].user, seg = [];
      for (var i = 0; i < state.outbox.length && seg.length < 40; i++) { if (state.outbox[i].user !== u) break; seg.push(state.outbox[i]); }
      var acct = state.users[u];
      if (!acct || !acct.token) { live.blockedUser = u; return Promise.resolve(); }
      var isLast = seg.length === state.outbox.length && u === state.current;
      return api('sync', { token: acct.token, phone: state.phone, since: state.since, nopull: !isLast,
        ops: seg.map(function (o) { return { op_id: o.op_id, type: o.type, payload: o.payload }; }) }).then(function (r) {
        var done = {};
        r.applied.forEach(function (id) { done[id] = true; });
        (r.rejected || []).forEach(function (x) {
          done[x.op_id] = true;
          var op = state.outbox.find(function (o) { return o.op_id === x.op_id; });
          if (op) state.failed.push(Object.assign({ error: x.error }, op));
        });
        state.outbox = state.outbox.filter(function (o) { return !done[o.op_id]; });
        acct.lastOnline = new Date().toISOString();
        if (isLast) { mergeData(r.data); state.since = r.now; pulled = true; }
        save();
        if ((r.rejected || []).length) emit('rejected');
        return isLast ? null : pushSegment();
      }, function (e) {
        if (e.code === 401) { acct.token = ''; save(); if (u === state.current) { emit('expired'); } else { live.blockedUser = u; return; } }
        throw e;
      });
    }
    function pull() {
      if (pulled) return Promise.resolve();
      return api('sync', { token: me().token, phone: state.phone, since: state.since, ops: [] }).then(function (r) {
        mergeData(r.data); state.since = r.now; me().lastOnline = new Date().toISOString();
        if (r.user) { me().name = r.user.name; me().role = r.user.role; }
        save();
      }, function (e) { if (e.code === 401) { me().token = ''; save(); emit('expired'); } throw e; });
    }
    function photos() {
      return photosDb.all().then(function (all) {
        var waitingCreate = {};
        state.outbox.forEach(function (o) { if (o.type === 'test.create') waitingCreate[o.payload.test.test_id] = true; });
        var todo = all.filter(function (p) { return !p.uploaded && !waitingCreate[p.test_id]; });
        return todo.reduce(function (chain, p) {
          return chain.then(function () {
            var acct = state.users[p.user] && state.users[p.user].token ? state.users[p.user] : me();
            return api('uploadPhoto', { token: acct.token, photo: { photo_id: p.photo_id, test_id: p.test_id, reading_id: p.reading_id, reading_no: p.reading_no, taken_at: p.taken_at, data: p.data } }, 120000)
              .then(function () {
                p.uploaded = true;
                var b = state.tests[p.test_id];
                if (b && !b.photos.some(function (x) { return x.photo_id === p.photo_id; })) b.photos.push({ photo_id: p.photo_id, test_id: p.test_id, reading_id: p.reading_id, by: p.user, taken_at: p.taken_at, bytes: 0 });
                return photosDb.put(p);
              }, function (e) { if (e.code === 404) { p.uploaded = true; return photosDb.put(p); } throw e; });
          });
        }, Promise.resolve());
      }).then(refreshPhotoCount);
    }
    return pushSegment().then(pull).then(photos).then(function () {
      live.lastSyncAt = new Date().toISOString(); live.online = true; save();
    }).catch(function (e) {
      if (e.network) live.online = navigator.onLine;
      live.error = e.message || String(e);
    }).then(function () {
      live.syncing = false; emit('sync');
      if (again) { again = false; scheduleSync(300); }
    });
  }
  /** Sends one change right now (used on the computer, where there is always internet). */
  function pushNow(type, payload) {
    return api('sync', { token: me().token, ops: [{ op_id: uid(), type: type, payload: payload }], nopull: true }).then(function (r) {
      if (r.rejected && r.rejected.length) throw new Error(r.rejected[0].error);
      return r;
    });
  }
  function syncState() {
    var n = waitingCount();
    if (live.syncing) return 'saving';
    if (!navigator.onLine) return 'offline';
    if (live.error && n) return 'failed';
    if (n) return 'waiting';
    return 'saved';
  }

  /* ---------- photos ---------- */
  function shrinkPhoto(file) {
    // Makes the photo smaller (longest side 1600 px) so it uploads fast on mobile data.
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Could not read this photo.')); };
      img.src = url;
    });
  }
  function addPhoto(file, testId, readingId, readingNo) {
    return shrinkPhoto(file).then(function (data) {
      var p = { photo_id: uid(), test_id: testId, reading_id: readingId || '', reading_no: readingNo || '', taken_at: localISO(), data: data, uploaded: false, user: state.current };
      return photosDb.put(p).then(refreshPhotoCount).then(function () { emit('photo'); scheduleSync(1500); return p; });
    });
  }
  var photoCache = {};
  function photoSrc(photoId) {
    if (photoCache[photoId]) return Promise.resolve(photoCache[photoId]);
    return photosDb.get(photoId).then(function (p) {
      if (p && p.data) return 'data:image/jpeg;base64,' + p.data;
      return api('getPhoto', { token: me().token, photo_id: photoId }, 120000).then(function (r) { return 'data:' + (r.mime || 'image/jpeg') + ';base64,' + r.data; });
    }).then(function (src) { photoCache[photoId] = src; return src; });
  }
  function testPhotos(b) {
    // Photos known to the server plus photos still waiting on this phone.
    return photosDb.all().then(function (all) {
      var list = b.photos.map(function (p) { return Object.assign({ waiting: false }, p); });
      all.forEach(function (p) {
        if (p.test_id === b.test.test_id && !list.some(function (x) { return x.photo_id === p.photo_id; })) {
          list.push({ photo_id: p.photo_id, test_id: p.test_id, reading_id: p.reading_id, by: p.user, taken_at: p.taken_at, waiting: !p.uploaded });
        }
      });
      return list;
    });
  }

  window.addEventListener('online', function () { live.online = true; emit('sync'); scheduleSync(500); });
  window.addEventListener('offline', function () { live.online = false; emit('sync'); });

  /* ---------- app updates ---------- */
  // A new build arrives through the service worker (sw.js). The phone asks for it at every open,
  // every time the app comes back to the screen, and every 30 minutes. When the new build has
  // taken over, 'update' is announced and the screen restarts the app at a safe moment.
  var upd = { reg: null, ready: false, server: null, applying: false };
  function noop() {}
  function askForUpdate() { if (upd.reg && navigator.onLine) upd.reg.update().catch(noop); }
  function initUpdates() {
    if (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.hostname !== 'localhost')) return;
    var had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!had) { had = true; return; }                  // the very first install is not an update
      upd.ready = true; emit('update');
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) { upd.reg = reg; askForUpdate(); }).catch(noop);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) askForUpdate(); });
    setInterval(askForUpdate, 30 * 60000);
  }
  /** Reads the build number that is on the server right now. Gives null with no internet. */
  function serverBuild() {
    return fetch('sw.js?check=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var m = /BUILD\s*=\s*(\d+)/.exec(t);
      upd.server = m ? Number(m[1]) : null;
      return upd.server;
    }, function () { upd.server = null; return null; });
  }
  function checkUpdate() {
    return serverBuild().then(function (b) {
      if (b && b > BUILD) askForUpdate();
      return { server: b, mine: BUILD };
    });
  }
  function applyUpdate() {
    if (upd.applying) return;
    upd.applying = true;
    setTimeout(function () { location.reload(); }, 500);   // lets the last save reach the phone's storage
  }

  window.TL = {
    update: { state: upd, init: initUpdates, check: checkUpdate, apply: applyUpdate },
    BUILD: BUILD, cfg: cfg, get state() { return state; }, live: live,
    on: function (f) { listeners.push(f); }, emit: emit, load: load, save: save, me: me, personName: personName,
    api: api, signIn: signIn, signOut: signOut, fetchNames: fetchNames, daysLeftOffline: daysLeftOffline,
    act: act, sync: sync, scheduleSync: scheduleSync, pushNow: pushNow, syncState: syncState, waitingCount: waitingCount, pendingReadingIds: pendingReadingIds,
    coverage: coverage, coverageName: coverageName, newTestId: newTestId, activeColumns: activeColumns, readingColumns: readingColumns, setupFields: setupFields, sortedReadings: sortedReadings, usedReadings: usedReadings, nextNo: nextNo,
    compressor: compressor, energy: energy, nextDue: nextDue, iAmRecorder: iAmRecorder, testTitle: testTitle, startOf: startOf, roleName: roleName, isDeleted: isDeleted, predict: predict, decimalsOf: decimalsOf, LIMIT: LIMIT,
    addPhoto: addPhoto, photoSrc: photoSrc, testPhotos: testPhotos, photosDb: photosDb,
    u: { pad: pad, localISO: localISO, toDate: toDate, hhmm: hhmm, dmy: dmy, dm: dm, dmhm: dmhm, dmyhm: dmyhm, minsBetween: minsBetween, dur: dur, hm: hm, uid: uid, esc: esc, initials: initials, num: num, icon: icon }
  };
})();

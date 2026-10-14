/**
 * Freezigo Test Log - backend (Google Apps Script, bound to the Google Sheet).
 * All data lives in the tabs of this Sheet. Photos live in one Drive folder.
 * The app talks to this script with POST requests that carry JSON.
 */
var BUILD = 5;
var SESSION_DAYS = 7;

var TABS = {
  Config:    ['key', 'value'],
  People:    ['username', 'name', 'role', 'salt', 'pass_hash', 'active', 'added_at', 'removed_at', 'last_active'],
  Sessions:  ['token_hash', 'username', 'phone', 'expires_at', 'created_at'],
  Phones:    ['code', 'last_user', 'last_used', 'tests_made'],
  Products:  ['id', 'name', 'modes_json', 'sort'],
  Templates: ['id', 'name', 'product', 'default_mode', 'track_compressor', 'columns_json', 'active', 'updated_by', 'updated_at'],
  Tests:     ['test_id', 'status', 'product', 'template_id', 'template_name', 'machine_code', 'mode', 'date',
              'started_at', 'ended_at', 'interval_min', 'track_compressor', 'setup_json', 'columns_json',
              'current_recorder', 'created_by', 'phone', 'final_remarks', 'comp_on_min', 'comp_on_edited',
              'end_time_changed', 'updated_at'],
  Readings:  ['reading_id', 'test_id', 'no', 'time', 'time_changed', 'phone_time', 'by', 'phone', 'values_json',
              'values_text', 'note', 'late', 'use', 'saved_at', 'synced_at', 'updated_at'],
  Edits:     ['edit_id', 'test_id', 'reading_id', 'no', 'column_id', 'column_name', 'old_value', 'new_value', 'by', 'at'],
  Events:    ['event_id', 'test_id', 'kind', 'time', 'text', 'by', 'data_json', 'at'],
  Notes:     ['note_id', 'test_id', 'reading_id', 'role', 'by', 'text', 'at'],
  Photos:    ['photo_id', 'test_id', 'reading_id', 'file_id', 'name', 'by', 'taken_at', 'bytes', 'at'],
  Ops:       ['op_id', 'username', 'type', 'at']
};

/* ------------------------------------------------------------------ */
/* Web entry points                                                    */
/* ------------------------------------------------------------------ */

function doGet() {
  return out_({ ok: true, name: 'Freezigo Test Log API', build: BUILD });
}

function doPost(e) {
  var res;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    res = route_(req);
    res.ok = true;
  } catch (err) {
    res = { ok: false, error: String(err && err.message ? err.message : err), code: (err && err.code) || 500 };
  }
  res.build = BUILD;
  return out_(res);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}

function route_(req) {
  var a = req.action;
  if (a === 'status') return apiStatus_();
  if (a === 'names') return apiNames_();
  if (a === 'setupAdmin') return withLock_(function () { return apiSetupAdmin_(req); });
  if (a === 'login') return withLock_(function () { return apiLogin_(req); });

  var db = new Db_();
  var user = auth_(db, req.token);
  if (a === 'registerPhone') return withLock_(function () { return apiRegisterPhone_(new Db_(), user); });
  if (a === 'sync') return withLock_(function () { var d = new Db_(); return apiSync_(d, auth_(d, req.token), req); });
  if (a === 'listTests') return apiListTests_(db, user);
  if (a === 'backup') return apiBackup_(db, user);
  if (a === 'getTest') return { bundle: bundle_(db, findTest_(db, req.test_id)) };
  if (a === 'uploadPhoto') return withLock_(function () { var d = new Db_(); return apiUploadPhoto_(d, auth_(d, req.token), req); });
  if (a === 'getPhoto') return apiGetPhoto_(db, req);
  if (a === 'logout') return withLock_(function () { return apiLogout_(new Db_(), req); });
  throw fail_(400, 'Unknown action: ' + a);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* Sheet tables                                                        */
/* ------------------------------------------------------------------ */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function Db_() { this.t = {}; }
Db_.prototype.table = function (name) {
  if (!this.t[name]) this.t[name] = new Table_(name);
  return this.t[name];
};
Db_.prototype.flush = function () {
  for (var k in this.t) this.t[k].flush();
};

function Table_(name) {
  this.name = name;
  this.head = TABS[name];
  this.sh = ss_().getSheetByName(name);
  if (!this.sh) throw fail_(500, 'Tab "' + name + '" is missing. Run setup first.');
  this.rows = null;
  this.fresh = [];
  this.dirty = [];
}
Table_.prototype.load = function () {
  if (this.rows) return this.rows;
  this.rows = [];
  var last = this.sh.getLastRow();
  if (last > 1) {
    var v = this.sh.getRange(2, 1, last - 1, this.head.length).getValues();
    for (var i = 0; i < v.length; i++) {
      var o = { _row: i + 2 };
      for (var j = 0; j < this.head.length; j++) {
        var c = v[i][j];
        o[this.head[j]] = (c === '' || c === null) ? '' : String(c);
      }
      this.rows.push(o);
    }
  }
  return this.rows;
};
Table_.prototype.find = function (key, value) {
  var r = this.load();
  for (var i = 0; i < r.length; i++) if (r[i][key] === String(value)) return r[i];
  return null;
};
Table_.prototype.filter = function (key, value) {
  return this.load().filter(function (o) { return o[key] === String(value); });
};
Table_.prototype.insert = function (o) {
  this.load();
  o._new = true;
  this.rows.push(o);
  this.fresh.push(o);
  return o;
};
Table_.prototype.update = function (o) {
  if (!o._new && this.dirty.indexOf(o) < 0) this.dirty.push(o);
};
Table_.prototype.toArr = function (o) {
  return this.head.map(function (h) {
    var x = o[h];
    if (x === undefined || x === null) return '';
    x = String(x);
    if (x.length > 49000) x = x.slice(0, 49000);
    return /^[=+]/.test(x) ? "'" + x : x;   // never let a note become a formula
  });
};
Table_.prototype.flush = function () {
  var n = this.head.length, self = this;
  this.dirty.forEach(function (o) {
    self.sh.getRange(o._row, 1, 1, n).setNumberFormat('@').setValues([self.toArr(o)]);
  });
  this.dirty = [];
  if (this.fresh.length) {
    var start = this.sh.getLastRow() + 1;
    var need = start + this.fresh.length - 1 - this.sh.getMaxRows();
    if (need > 0) this.sh.insertRowsAfter(this.sh.getMaxRows(), need + 200);
    var block = this.fresh.map(function (o) { return self.toArr(o); });
    this.sh.getRange(start, 1, block.length, n).setNumberFormat('@').setValues(block);
    this.fresh.forEach(function (o, i) { o._row = start + i; delete o._new; });
    this.fresh = [];
  }
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function now_() { return new Date().toISOString(); }
function uid_() { return Utilities.getUuid(); }
function b64_(bytes) { return Utilities.base64EncodeWebSafe(bytes); }
function sha_(text) { return b64_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)); }
function hashPassword_(salt, password) {
  var h = salt;
  for (var i = 0; i < 200; i++) h = b64_(Utilities.computeHmacSha256Signature(h + '|' + password, salt));
  return h;
}
function parse_(text, fallback) {
  if (!text) return fallback;
  try { return JSON.parse(text); } catch (e) { return fallback; }
}
function isReviewer_(user) { return user.role === 'reviewer'; }
function needReviewer_(user) { if (!isReviewer_(user)) throw fail_(403, 'Only a reviewer can do this.'); }
// THREE KINDS OF USER (script build 3).
//   reviewer   - everything: people, templates, reviewer notes, pick between two readings
//   engineer   - records tests, and can add and change templates, products and machine modes
//   technician - records tests only
function role_(r) { return r === 'reviewer' || r === 'engineer' ? r : 'technician'; }
function needTemplates_(user) { if (user.role !== 'reviewer' && user.role !== 'engineer') throw fail_(403, 'Only a reviewer or an engineer can change templates.'); }
function cleanUsername_(u) { return String(u || '').trim().toLowerCase(); }

/* ------------------------------------------------------------------ */
/* Sign in                                                             */
/* ------------------------------------------------------------------ */

function apiStatus_() {
  var has = false;
  try { has = new Db_().table('People').load().length > 0; } catch (e) { return { ready: false, hasUsers: false }; }
  return { ready: true, hasUsers: has };
}

function apiNames_() {
  var people = new Db_().table('People').load().filter(function (p) { return p.active === 'true'; });
  return { names: people.map(function (p) { return { username: p.username, name: p.name, role: p.role }; }) };
}

function apiSetupAdmin_(req) {
  var db = new Db_(), people = db.table('People');
  if (people.load().length) throw fail_(403, 'Setup is already done.');
  var username = cleanUsername_(req.username);
  if (!username || !req.password || String(req.password).length < 6) throw fail_(400, 'Give a username and a password of 6 or more letters.');
  var salt = uid_();
  people.insert({ username: username, name: req.name || username, role: 'reviewer', salt: salt,
    pass_hash: hashPassword_(salt, req.password), active: 'true', added_at: now_(), removed_at: '', last_active: '' });
  db.flush();
  return apiLogin_(req);
}

function apiLogin_(req) {
  var db = new Db_(), people = db.table('People');
  var p = people.find('username', cleanUsername_(req.username));
  if (!p || p.active !== 'true' || hashPassword_(p.salt, String(req.password || '')) !== p.pass_hash) {
    throw fail_(401, 'Wrong username or password.');
  }
  var token = uid_() + uid_();
  var exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.table('Sessions').insert({ token_hash: sha_(token), username: p.username, phone: req.phone || '', expires_at: exp, created_at: now_() });
  p.last_active = now_();
  people.update(p);
  db.flush();
  return { token: token, expires_at: exp, user: { username: p.username, name: p.name, role: p.role } };
}

function apiLogout_(db, req) {
  var s = db.table('Sessions').find('token_hash', sha_(String(req.token || '')));
  if (s) { s.expires_at = now_(); db.table('Sessions').update(s); db.flush(); }
  return {};
}

function auth_(db, token) {
  if (!token) throw fail_(401, 'Please sign in.');
  var sessions = db.table('Sessions');
  var s = sessions.find('token_hash', sha_(String(token)));
  if (!s || s.expires_at < now_()) throw fail_(401, 'Please sign in again.');
  var p = db.table('People').find('username', s.username);
  if (!p || p.active !== 'true') throw fail_(401, 'This user can no longer sign in.');
  // Slide the 7 days forward, at most once a day, to save writes.
  var fresh = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  if (fresh.slice(0, 10) !== s.expires_at.slice(0, 10)) { s.expires_at = fresh; sessions.update(s); db._touchSession = true; }
  return { username: p.username, name: p.name, role: p.role, _row: p, expires_at: s.expires_at };
}

function apiRegisterPhone_(db, user) {
  var phones = db.table('Phones'), used = {};
  phones.load().forEach(function (p) { used[p.code] = true; });
  var code = '';
  outer:
  for (var l = 0; l < 26; l++) for (var d = 1; d <= 9; d++) {
    var c = String.fromCharCode(65 + l) + d;
    if (!used[c]) { code = c; break outer; }
  }
  if (!code) throw fail_(500, 'No phone codes left.');
  phones.insert({ code: code, last_user: user.username, last_used: now_(), tests_made: '0' });
  db.flush();
  return { code: code };
}

/* ------------------------------------------------------------------ */
/* Sync: apply the phone's saved changes, then send back what is new   */
/* ------------------------------------------------------------------ */

function apiSync_(db, user, req) {
  var ops = req.ops || [], applied = [], rejected = [];
  var opsTab = db.table('Ops');
  var seen = {};
  if (ops.length) opsTab.load().forEach(function (o) { seen[o.op_id] = true; });
  ops.forEach(function (op) {
    if (seen[op.op_id]) { applied.push(op.op_id); return; }
    try {
      applyOp_(db, user, op, req.phone || '');
      applied.push(op.op_id);
      seen[op.op_id] = true;
      opsTab.insert({ op_id: op.op_id, username: user.username, type: op.type, at: now_() });
    } catch (err) {
      rejected.push({ op_id: op.op_id, type: op.type, error: String(err && err.message ? err.message : err) });
    }
  });
  if (req.phone) {
    var ph = db.table('Phones').find('code', req.phone);
    if (ph && (ph.last_user !== user.username || ph.last_used.slice(0, 13) !== now_().slice(0, 13))) {
      ph.last_user = user.username; ph.last_used = now_(); db.table('Phones').update(ph);
    }
  }
  var serverNow = now_();
  db.flush();
  if (req.nopull) return { applied: applied, rejected: rejected, now: serverNow };

  var since = req.since || '';
  var cutoff = new Date(Date.now() - 14 * 864e5).toISOString();
  var tests = db.table('Tests').load().filter(function (t) {
    if (since) return t.updated_at > since;
    return t.status !== 'finished' || t.updated_at > cutoff;
  });
  var data = {
    people: peopleOut_(db, user),
    products: db.table('Products').load().map(productOut_),
    templates: db.table('Templates').load().filter(function (t) { return t.active === 'true'; }).map(templateOut_),
    tests: bundles_(db, tests)
  };
  if (isReviewer_(user)) data.phones = db.table('Phones').load().map(function (p) {
    return { code: p.code, last_user: p.last_user, last_used: p.last_used, tests_made: Number(p.tests_made || 0) };
  });
  return { applied: applied, rejected: rejected, data: data, now: serverNow,
    user: { username: user.username, name: user.name, role: user.role }, expires_at: user.expires_at };
}

function peopleOut_(db, user) {
  var counts = {};
  if (isReviewer_(user)) db.table('Tests').load().forEach(function (t) { counts[t.created_by] = (counts[t.created_by] || 0) + 1; });
  return db.table('People').load().filter(function (p) { return p.active === 'true' || isReviewer_(user); }).map(function (p) {
    return { username: p.username, name: p.name, role: p.role, active: p.active === 'true', added_at: p.added_at,
      removed_at: p.removed_at, last_active: p.last_active, tests: counts[p.username] || 0 };
  });
}
function productOut_(p) { return { id: p.id, name: p.name, modes: parse_(p.modes_json, []), sort: Number(p.sort || 0) }; }
function templateOut_(t) {
  return { id: t.id, name: t.name, product: t.product, default_mode: t.default_mode,
    track_compressor: t.track_compressor === 'true', columns: parse_(t.columns_json, []), active: t.active === 'true',
    updated_by: t.updated_by, updated_at: t.updated_at };
}

function findTest_(db, id) {
  var t = db.table('Tests').find('test_id', id);
  if (!t) throw fail_(404, 'Test ' + id + ' was not found.');
  return t;
}
function touch_(db, test) { test.updated_at = now_(); db.table('Tests').update(test); }

function testOut_(t) {
  return { test_id: t.test_id, status: t.status, product: t.product, template_id: t.template_id, template_name: t.template_name,
    machine_code: t.machine_code, mode: t.mode, date: t.date, started_at: t.started_at, ended_at: t.ended_at,
    interval_min: Number(t.interval_min || 0), track_compressor: t.track_compressor === 'true',
    setup: parse_(t.setup_json, {}), columns: parse_(t.columns_json, []), current_recorder: t.current_recorder,
    created_by: t.created_by, phone: t.phone, final_remarks: t.final_remarks,
    comp_on_min: t.comp_on_min === '' ? null : Number(t.comp_on_min), comp_on_edited: t.comp_on_edited === 'true',
    end_time_changed: t.end_time_changed === 'true', updated_at: t.updated_at,
    coverage: parse_(t.setup_json, {}).coverage || '' };   // 'complete', 'partial' or '' (script build 5)
}
function readingOut_(r) {
  return { reading_id: r.reading_id, test_id: r.test_id, no: Number(r.no), time: r.time, time_changed: r.time_changed === 'true',
    phone_time: r.phone_time, by: r.by, phone: r.phone, values: parse_(r.values_json, {}), note: r.note,
    late: r.late === 'true', use: r.use, saved_at: r.saved_at, synced_at: r.synced_at };
}

function bundles_(db, tests) {
  if (!tests.length) return [];
  var ids = {};
  tests.forEach(function (t) { ids[t.test_id] = true; });
  var pick = function (tab) { return db.table(tab).load().filter(function (r) { return ids[r.test_id]; }); };
  var readings = pick('Readings'), events = pick('Events'), edits = pick('Edits'), notes = pick('Notes'), photos = pick('Photos');
  return tests.map(function (t) {
    var of = function (list) { return list.filter(function (r) { return r.test_id === t.test_id; }); };
    return {
      test: testOut_(t),
      readings: of(readings).map(readingOut_),
      events: of(events).map(function (e) { return { event_id: e.event_id, test_id: e.test_id, kind: e.kind, time: e.time, text: e.text, by: e.by, data: parse_(e.data_json, {}) }; }),
      edits: of(edits).map(function (e) { return { edit_id: e.edit_id, test_id: e.test_id, reading_id: e.reading_id, no: Number(e.no), column_id: e.column_id, column_name: e.column_name, old_value: e.old_value, new_value: e.new_value, by: e.by, at: e.at }; }),
      notes: of(notes).map(function (n) { return { note_id: n.note_id, test_id: n.test_id, reading_id: n.reading_id, role: n.role, by: n.by, text: n.text, at: n.at }; }),
      photos: of(photos).map(function (p) { return { photo_id: p.photo_id, test_id: p.test_id, reading_id: p.reading_id, file_id: p.file_id, name: p.name, by: p.by, taken_at: p.taken_at, bytes: Number(p.bytes || 0) }; })
    };
  });
}
function bundle_(db, test) { return bundles_(db, [test])[0]; }

/**
 * BACKUP (script build 4). Sends every data tab to a reviewer, who saves it as one Excel file.
 * Passwords are never sent: the two password columns of People are left out, and so are the
 * sign-in tab (Sessions) and the two housekeeping tabs (Ops, Config), which hold no test data.
 */
function apiBackup_(db, user) {
  needReviewer_(user);
  var SKIP = { Sessions: 1, Ops: 1, Config: 1 }, HIDE = { salt: 1, pass_hash: 1 }, tabs = {};
  Object.keys(TABS).forEach(function (name) {
    if (SKIP[name]) return;
    var head = TABS[name].filter(function (h) { return !HIDE[h]; });
    tabs[name] = { head: head, rows: db.table(name).load().map(function (o) { return head.map(function (h) { return o[h]; }); }) };
  });
  return { tabs: tabs, at: now_(), by: user.name };
}

function apiListTests_(db, user) {
  var rc = {}, nc = {}, check = {}, who = {};
  db.table('Readings').load().forEach(function (r) {
    rc[r.test_id] = (rc[r.test_id] || 0) + 1;
    (who[r.test_id] = who[r.test_id] || {})[r.by] = true;
    if (r.late === 'true' && r.use === '') check[r.test_id] = (check[r.test_id] || 0) + 1;
  });
  db.table('Notes').load().forEach(function (n) { nc[n.test_id] = (nc[n.test_id] || 0) + 1; });
  var tests = db.table('Tests').load().map(function (t) {
    var o = testOut_(t);
    delete o.columns; delete o.setup;
    o.readings = rc[t.test_id] || 0;
    o.notes = nc[t.test_id] || 0;
    o.to_check = check[t.test_id] || 0;
    o.recorders = Object.keys(who[t.test_id] || {});
    return o;
  });
  return { tests: tests, people: peopleOut_(db, user), products: db.table('Products').load().map(productOut_),
    templates: db.table('Templates').load().filter(function (t) { return t.active === 'true'; }).map(templateOut_), now: now_() };
}

/* ------------------------------------------------------------------ */
/* One saved change from a phone or the computer                       */
/* ------------------------------------------------------------------ */

function valuesText_(columns, values) {
  return columns.filter(function (c) { return values[c.id] !== undefined && values[c.id] !== ''; }).map(function (c) {
    return c.name + ' = ' + values[c.id] + (c.unit ? ' ' + c.unit : '');
  }).join('; ');
}

function addEvent_(db, test, user, ev) {
  var events = db.table('Events');
  if (ev.event_id && events.find('event_id', ev.event_id)) return;
  events.insert({ event_id: ev.event_id || uid_(), test_id: test.test_id, kind: ev.kind, time: ev.time || '', text: ev.text || '',
    by: user.username, data_json: JSON.stringify(ev.data || {}), at: now_() });
}

function applyOp_(db, user, op, phone) {
  var p = op.payload || {}, tests = db.table('Tests'), test, t = op.type;

  if (t === 'test.create') {
    var n = p.test;
    if (!n || !n.test_id) throw fail_(400, 'Test ID is missing.');
    if (tests.find('test_id', n.test_id)) return;
    if (phone === 'XL') needTemplates_(user);   // a test imported from Excel (script build 5)
    tests.insert({ test_id: n.test_id, status: 'running', product: n.product || '', template_id: n.template_id || '',
      template_name: n.template_name || '', machine_code: n.machine_code || '', mode: n.mode || '', date: n.date || '',
      started_at: n.started_at || '', ended_at: '', interval_min: n.interval_min || 0,
      track_compressor: n.track_compressor ? 'true' : '', setup_json: JSON.stringify(n.setup || {}),
      columns_json: JSON.stringify(n.columns || []), current_recorder: user.username, created_by: user.username,
      phone: phone, final_remarks: '', comp_on_min: '', comp_on_edited: '', end_time_changed: '', updated_at: now_() });
    var ph = db.table('Phones').find('code', phone);
    if (ph) { ph.tests_made = String(Number(ph.tests_made || 0) + 1); db.table('Phones').update(ph); }
    return;
  }

  if (t === 'test.update') {
    test = findTest_(db, p.test_id);
    if (test.status === 'finished') throw fail_(409, 'Test is locked.');
    var patch = p.patch || {};
    if (patch.interval_min !== undefined) test.interval_min = patch.interval_min;
    if (patch.columns) test.columns_json = JSON.stringify(patch.columns);
    if (patch.setup) test.setup_json = JSON.stringify(patch.setup);
    if (patch.machine_code !== undefined) test.machine_code = patch.machine_code;
    if (patch.mode !== undefined) test.mode = patch.mode;
    touch_(db, test);
    return;
  }

  if (t === 'reading.save') {
    var r = p.reading;
    test = findTest_(db, r.test_id);
    var readings = db.table('Readings'), old = readings.find('reading_id', r.reading_id);
    var cols = parse_(test.columns_json, []);
    if (!old) {
      var late = test.status === 'finished' || test.current_recorder !== user.username;
      readings.insert({ reading_id: r.reading_id, test_id: r.test_id, no: r.no, time: r.time || '',
        time_changed: r.time_changed ? 'true' : '', phone_time: r.phone_time || '', by: user.username, phone: phone,
        values_json: JSON.stringify(r.values || {}), values_text: valuesText_(cols, r.values || {}), note: r.note || '',
        late: late ? 'true' : '', use: '', saved_at: r.saved_at || '', synced_at: now_(), updated_at: now_() });
    } else {
      if (test.status === 'finished') throw fail_(409, 'Test is locked. The reading was not changed.');
      var edits = db.table('Edits'), before = parse_(old.values_json, {}), after = r.values || {};
      var log = function (id, name, a, b) {
        if (String(a === undefined ? '' : a) === String(b === undefined ? '' : b)) return;
        edits.insert({ edit_id: uid_(), test_id: test.test_id, reading_id: old.reading_id, no: old.no, column_id: id,
          column_name: name, old_value: a === undefined ? '' : a, new_value: b === undefined ? '' : b, by: user.username, at: now_() });
      };
      cols.forEach(function (c) { log(c.id, c.name + (c.unit ? ' (' + c.unit + ')' : ''), before[c.id], after[c.id]); });
      log('_time', 'Time', old.time, r.time);
      log('_note', 'Note', old.note, r.note || '');
      old.values_json = JSON.stringify(after);
      old.values_text = valuesText_(cols, after);
      if (r.time && r.time !== old.time) { old.time = r.time; old.time_changed = 'true'; }
      old.note = r.note || '';
      old.updated_at = now_();
      readings.update(old);
    }
    touch_(db, test);
    return;
  }

  if (t === 'event.add') {
    test = findTest_(db, p.event.test_id);
    addEvent_(db, test, user, p.event);
    touch_(db, test);
    return;
  }

  if (t === 'test.handover') {
    test = findTest_(db, p.test_id);
    if (test.status === 'finished') throw fail_(409, 'Test is locked.');
    if (test.current_recorder !== user.username) throw fail_(409, 'You are not the recorder of this test now.');
    var to = db.table('People').find('username', p.to);
    if (!to || to.active !== 'true') throw fail_(400, 'This person cannot record.');
    addEvent_(db, test, user, { event_id: p.event_id, kind: 'handover', time: p.time,
      text: 'Handed over from ' + user.name + ' to ' + to.name, data: { from: user.username, to: to.username, note: p.note || '', same_phone: !!p.same_phone } });
    test.current_recorder = to.username;
    touch_(db, test);
    return;
  }

  if (t === 'test.takeover') {
    test = findTest_(db, p.test_id);
    if (test.status === 'finished') throw fail_(409, 'Test is locked.');
    if (test.current_recorder === user.username) return;
    var prev = db.table('People').find('username', test.current_recorder);
    addEvent_(db, test, user, { event_id: p.event_id, kind: 'takeover', time: p.time,
      text: user.name + ' took over from ' + (prev ? prev.name : test.current_recorder), data: { from: test.current_recorder, to: user.username } });
    test.current_recorder = user.username;
    touch_(db, test);
    return;
  }

  if (t === 'test.finish') {
    test = findTest_(db, p.test_id);
    if (test.status === 'finished') return;
    if (test.current_recorder !== user.username && !isReviewer_(user)) throw fail_(409, 'Only the recorder can finish this test.');
    test.status = 'finished';
    test.ended_at = p.ended_at || '';
    test.end_time_changed = p.end_time_changed ? 'true' : '';
    test.final_remarks = p.final_remarks || '';
    test.comp_on_min = (p.comp_on_min === null || p.comp_on_min === undefined) ? '' : p.comp_on_min;
    test.comp_on_edited = p.comp_on_edited ? 'true' : '';
    addEvent_(db, test, user, { event_id: p.event_id, kind: 'finish', time: p.ended_at, text: 'Test finished and locked by ' + user.name });
    touch_(db, test);
    return;
  }

  // COMPLETE OR PARTIAL TEST (script build 5). A reviewer or an engineer marks a finished, locked test.
  // The mark is kept in the setup of the test, and an event keeps who marked it and when.
  if (t === 'test.mark') {
    if (user.role !== 'reviewer' && user.role !== 'engineer') throw fail_(403, 'Only a reviewer or an engineer can mark a test as complete or partial.');
    test = findTest_(db, p.test_id);
    if (test.status !== 'finished') throw fail_(409, 'Finish the test first.');
    if (/^\[DELETED\]/.test(test.final_remarks)) throw fail_(409, 'This test is deleted.');
    var cov = p.coverage === 'complete' || p.coverage === 'partial' ? p.coverage : '';
    var su = parse_(test.setup_json, {});
    if ((su.coverage || '') === cov) return;
    su.coverage = cov;
    test.setup_json = JSON.stringify(su);
    addEvent_(db, test, user, { event_id: p.event_id, kind: 'coverage', time: p.time,
      text: (cov ? 'Marked as ' + (cov === 'complete' ? 'Complete' : 'Partial') + ' test' : 'Complete/Partial mark removed') + ' by ' + user.name, data: { coverage: cov } });
    touch_(db, test);
    return;
  }

  // DELETE A TEST (script build 2). Nothing is erased: the test is locked, and its final remark starts with
  // [DELETED] and the reason. The app hides such a test. It works on a running test and on a finished one.
  // Allowed for a person who recorded on the test, and for a reviewer.
  if (t === 'test.delete') {
    test = findTest_(db, p.test_id);
    if (/^\[DELETED\]/.test(test.final_remarks)) return;
    var took = test.created_by === user.username || test.current_recorder === user.username ||
      db.table('Readings').filter('test_id', test.test_id).some(function (x) { return x.by === user.username; });
    if (!took && !isReviewer_(user)) throw fail_(403, 'Only a person who recorded this test, or a reviewer, can delete it.');
    var why = String(p.reason || '').trim();
    if (!why) throw fail_(400, 'Give a reason.');
    addEvent_(db, test, user, { event_id: p.event_id, kind: 'deleted', time: p.time, text: 'Test deleted by ' + user.name + '. Reason: ' + why });
    if (test.status !== 'finished') { test.status = 'finished'; test.ended_at = p.time || ''; }
    test.final_remarks = '[DELETED] ' + why + (test.final_remarks ? ' | Remarks before delete: ' + test.final_remarks : '');
    touch_(db, test);
    return;
  }

  if (t === 'note.add') {
    var nn = p.note;
    test = findTest_(db, nn.test_id);
    var notes = db.table('Notes');
    if (!notes.find('note_id', nn.note_id)) {
      notes.insert({ note_id: nn.note_id, test_id: nn.test_id, reading_id: nn.reading_id || '', role: isReviewer_(user) ? 'reviewer' : 'recorder',
        by: user.username, text: nn.text || '', at: now_() });
    }
    touch_(db, test);
    return;
  }

  if (t === 'reading.choose') {
    needReviewer_(user);
    test = findTest_(db, p.test_id);
    db.table('Readings').filter('test_id', p.test_id).forEach(function (x) {
      if (String(x.no) !== String(p.no)) return;
      x.use = x.reading_id === p.reading_id ? 'yes' : 'no';
      db.table('Readings').update(x);
    });
    touch_(db, test);
    return;
  }

  if (t === 'template.save') {
    needTemplates_(user);
    var tp = p.template, templates = db.table('Templates'), row = templates.find('id', tp.id);
    var fields = { id: tp.id, name: tp.name || '', product: tp.product || '', default_mode: tp.default_mode || '',
      track_compressor: tp.track_compressor ? 'true' : '', columns_json: JSON.stringify(tp.columns || []), active: 'true',
      updated_by: user.username, updated_at: now_() };
    if (row) { for (var k in fields) row[k] = fields[k]; templates.update(row); } else templates.insert(fields);
    return;
  }
  if (t === 'template.remove') {
    needTemplates_(user);
    var tr = db.table('Templates').find('id', p.id);
    if (tr) { tr.active = ''; tr.updated_by = user.username; tr.updated_at = now_(); db.table('Templates').update(tr); }
    return;
  }
  if (t === 'product.save') {
    needTemplates_(user);
    var pr = p.product, products = db.table('Products'), prow = products.find('id', pr.id);
    if (prow) { prow.name = pr.name; prow.modes_json = JSON.stringify(pr.modes || []); products.update(prow); }
    else products.insert({ id: pr.id, name: pr.name, modes_json: JSON.stringify(pr.modes || []), sort: String(products.load().length + 1) });
    return;
  }

  if (t === 'person.save') {
    needReviewer_(user);
    var pe = p.person, people = db.table('People'), username = cleanUsername_(pe.username), person = people.find('username', username);
    if (!username) throw fail_(400, 'Username is missing.');
    if (!person) {
      if (!pe.password || String(pe.password).length < 6) throw fail_(400, 'Password must have 6 or more letters.');
      var salt = uid_();
      people.insert({ username: username, name: pe.name || username, role: role_(pe.role), salt: salt,
        pass_hash: hashPassword_(salt, pe.password), active: 'true', added_at: now_(), removed_at: '', last_active: '' });
    } else {
      if (pe.name) person.name = pe.name;
      if (pe.role) {
        if (person.username === user.username && role_(pe.role) !== 'reviewer') throw fail_(400, 'You cannot take the reviewer role away from yourself.');
        person.role = role_(pe.role);
      }
      if (pe.password) {
        if (String(pe.password).length < 6) throw fail_(400, 'Password must have 6 or more letters.');
        person.salt = uid_();
        person.pass_hash = hashPassword_(person.salt, pe.password);
        endSessions_(db, username);
      }
      people.update(person);
    }
    return;
  }
  if (t === 'person.remove' || t === 'person.restore') {
    needReviewer_(user);
    var target = db.table('People').find('username', cleanUsername_(p.username));
    if (!target) return;
    if (t === 'person.remove') {
      if (target.username === user.username) throw fail_(400, 'You cannot remove yourself.');
      target.active = ''; target.removed_at = now_(); endSessions_(db, target.username);
    } else { target.active = 'true'; target.removed_at = ''; }
    db.table('People').update(target);
    return;
  }

  throw fail_(400, 'Unknown change: ' + t);
}

function endSessions_(db, username) {
  var sessions = db.table('Sessions');
  sessions.filter('username', username).forEach(function (s) { s.expires_at = now_(); sessions.update(s); });
}

/* ------------------------------------------------------------------ */
/* Photos (kept private in Drive, sent to the app through this script) */
/* ------------------------------------------------------------------ */

function photoFolder_(db) {
  var cfg = db.table('Config'), row = cfg.find('key', 'photo_folder_id');
  if (row && row.value) { try { return DriveApp.getFolderById(row.value); } catch (e) {} }
  var folder = DriveApp.createFolder('Freezigo Test Log photos');
  if (row) { row.value = folder.getId(); cfg.update(row); } else cfg.insert({ key: 'photo_folder_id', value: folder.getId() });
  return folder;
}

function apiUploadPhoto_(db, user, req) {
  var ph = req.photo, photos = db.table('Photos');
  if (photos.find('photo_id', ph.photo_id)) return { photo_id: ph.photo_id };
  var test = findTest_(db, ph.test_id);
  var bytes = Utilities.base64Decode(ph.data);
  var name = ph.test_id + (ph.reading_no ? '_R' + ph.reading_no : '_setup') + '_' + ph.photo_id.slice(0, 8) + '.jpg';
  var file = photoFolder_(db).createFile(Utilities.newBlob(bytes, 'image/jpeg', name));
  photos.insert({ photo_id: ph.photo_id, test_id: ph.test_id, reading_id: ph.reading_id || '', file_id: file.getId(), name: name,
    by: user.username, taken_at: ph.taken_at || '', bytes: bytes.length, at: now_() });
  touch_(db, test);
  db.flush();
  return { photo_id: ph.photo_id };
}

function apiGetPhoto_(db, req) {
  var p = db.table('Photos').find('photo_id', req.photo_id);
  if (!p) throw fail_(404, 'Photo was not found.');
  var blob = DriveApp.getFileById(p.file_id).getBlob();
  return { photo_id: p.photo_id, name: p.name, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

/* ------------------------------------------------------------------ */
/* One-time setup and the Sheet menu                                   */
/* ------------------------------------------------------------------ */

/** Run this once from the script editor. It makes the tabs and starter data. Safe to run again. */
function setup() {
  var ss = ss_();
  Object.keys(TABS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var head = TABS[name];
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  });
  var first = ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0) ss.deleteSheet(first);

  var db = new Db_(), products = db.table('Products'), templates = db.table('Templates');
  if (!products.load().length) {
    [['BMC cooling', ['Direct Cooling', 'Thermal Cooling', 'Charging']], ['Reefer', ['Pull-down', 'Hold', 'Run-in']],
     ['ThermoPod', ['Charging', 'Discharging', 'Steady']], ['Others', []]].forEach(function (p, i) {
      products.insert({ id: p[0], name: p[0], modes_json: JSON.stringify(p[1]), sort: String(i + 1) });
    });
  }
  if (!templates.load().length) {
    var col = function (id, name, type, unit, on, options) { return { id: id, name: name, type: type, unit: unit || '', on: on !== false, options: options || [] }; };
    var bmc = [col('hp', 'Gauge HP', 'number', 'psi'), col('lp', 'Gauge LP', 'number', 'psi'),
      col('chp', 'Cont. HP', 'number', 'psi', false), col('clp', 'Cont. LP', 'number', 'psi', false),
      col('te1', 'TE-1 BMC', 'number', '°C'), col('te2', 'TE-2 Thermal tank', 'number', '°C'),
      col('te3', 'TE-3 BMC IN', 'number', '°C'), col('te4', 'TE-4 Comp. discharge', 'number', '°C'),
      col('te5', 'TE-5 Suction', 'number', '°C'), col('kwh', 'Energy meter', 'number', 'kWh'),
      col('sight', 'Sight glass clear', 'yesno', '')];
    [['BMC · Direct cooling test', 'Direct Cooling'], ['BMC · Thermal cooling test', 'Thermal Cooling']].forEach(function (t) {
      templates.insert({ id: uid_(), name: t[0], product: 'BMC cooling', default_mode: t[1], track_compressor: 'true',
        columns_json: JSON.stringify(bmc), active: 'true', updated_by: 'setup', updated_at: now_() });
    });
  }
  db.flush();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Test Log')
    .addItem('Make a sheet for one test', 'menuMakeTestSheet')
    .addToUi();
}

/** Builds one easy-to-read tab for a test: one row for each reading, one column for each value. */
function menuMakeTestSheet() {
  var ui = SpreadsheetApp.getUi();
  var ask = ui.prompt('Make a sheet for one test', 'Type the Test ID. Example: T-261011-A3-02', ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;
  var id = ask.getResponseText().trim(), db = new Db_(), test = db.table('Tests').find('test_id', id);
  if (!test) { ui.alert('Test ' + id + ' was not found.'); return; }
  var cols = parse_(test.columns_json, []);
  var rows = db.table('Readings').filter('test_id', id).sort(function (a, b) { return Number(a.no) - Number(b.no); });
  var head = ['No.', 'Time', 'Recorded by'].concat(cols.map(function (c) { return c.name + (c.unit ? ' (' + c.unit + ')' : ''); })).concat(['Note', 'Recorded after handover']);
  var body = rows.map(function (r) {
    var v = parse_(r.values_json, {});
    return [r.no, r.time.replace('T', ' '), r.by].concat(cols.map(function (c) { return v[c.id] === undefined ? '' : v[c.id]; })).concat([r.note, r.late === 'true' ? 'Yes' : '']);
  });
  var ss = ss_(), old = ss.getSheetByName(id);
  if (old) ss.deleteSheet(old);
  var sh = ss.insertSheet(id);
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (body.length) sh.getRange(2, 1, body.length, head.length).setValues(body);
}

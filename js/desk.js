/* Freezigo Test Log - computer view: tests list, test report, templates, people. Needs internet. */
(function () {
  'use strict';
  var T = window.TL, U = T.u, esc = U.esc, icon = U.icon;
  var root = document.getElementById('app');
  var D = { tests: null, people: [], products: [], templates: [], phones: [], bundle: null, loadedAt: null };
  var ui = { busy: false, err: '', msg: '', filters: {}, page: 0, series: null, statCol: '', openNotes: {}, pop: null, viewer: null, exportOpen: false, tpl: null, tplSearch: '', prod: '', confirm: '', newPass: {} };
  var PER_PAGE = 25;
  var SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];

  function S() { return T.state; }
  function parts() { return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent); }
  function go(path) { if (location.hash === '#/' + path) load(); else location.hash = '#/' + path; }
  function reviewer() { return T.me() && T.me().role === 'reviewer'; }
  function canTemplates() { return T.me() && (T.me().role === 'reviewer' || T.me().role === 'engineer'); }
  function name(u) { var p = D.people.find(function (x) { return x.username === u; }); return p ? p.name : (u || ''); }
  function spin() { return icon('spin', 18).replace('class="i"', 'class="i spin"'); }
  function call(action, body) { return T.api(action, Object.assign({ token: T.me().token }, body || {})).catch(function (e) { if (e.code === 401) { T.signOut(); render(); } throw e; }); }
  function push(type, payload) {
    ui.busy = true; ui.err = ''; ui.msg = ''; render();
    return T.pushNow(type, payload).then(function () { ui.busy = false; }, function (e) { ui.busy = false; ui.err = e.message; render(); if (e.code === 401) { T.signOut(); render(); } throw e; });
  }

  /* ---------- loading ---------- */
  function load() {
    if (!S().current || !T.me()) return render();
    var p = parts();
    ui.err = ''; ui.pop = null;
    if (p[0] === 't' && p[1]) {
      if (!D.bundle || D.bundle.test.test_id !== p[1]) { D.bundle = null; ui.series = null; ui.statCol = ''; ui.openNotes = {}; ui.exportOpen = false; ui.delOpen = false; }
      render();
      var base = D.tests ? Promise.resolve() : call('listTests').then(setList);
      return base.then(function () { return call('getTest', { test_id: p[1] }); }).then(function (r) { D.bundle = r.bundle; render(); }, fail);
    }
    if (p[0] === 'templates' || p[0] === 'people') {
      render();
      return call('sync', { ops: [], since: '9999' }).then(function (r) { if (r.user && T.me().role !== r.user.role) { T.me().role = r.user.role; T.me().name = r.user.name; T.save(); }   // a role changed by a reviewer applies here
        D.people = r.data.people; D.products = r.data.products; D.templates = r.data.templates; D.phones = r.data.phones || []; D.meta = true; render(); }, fail);
    }
    if (p[0] === 'compare' && p[1] && p[2]) {
      D.bundle = null;
      if (D.cmp && D.cmp.A.test.test_id === p[1] && D.cmp.B.test.test_id === p[2]) return render();
      D.cmp = null; ui.cmp = null; render();
      return Promise.all([call('getTest', { test_id: p[1] }), call('getTest', { test_id: p[2] })]).then(function (r) { D.cmp = { A: r[0].bundle, B: r[1].bundle }; render(); }, fail);
    }
    if (p[0] === 'import') { D.tests = null; ui.imp = null; ui.impBusy = false; }
    render();
    return call('listTests').then(function (r) { setList(r); render(); }, fail);
  }
  function setList(r) { D.tests = r.tests; D.people = r.people; D.products = r.products; D.templates = r.templates; D.loadedAt = new Date().toISOString(); }
  function fail(e) { ui.err = e.message; render(); }

  /* ---------- shell ---------- */
  function shell(body, cur, narrow) {
    var me = T.me();
    var nav = [['tests', 'Tests'], ['templates', 'Templates'], ['people', 'People']].map(function (n) { return '<a href="#/' + n[0] + '"' + (cur === n[0] ? ' aria-current="page"' : '') + '>' + n[1] + '</a>'; }).join('');
    return '<header class="top"><div><div class="brand"><small>FREEZIGO</small><b>Test Log</b></div><nav aria-label="Main">' + nav + '</nav>' +
      '<div style="margin-left:auto;display:flex;align-items:center;gap:10px"><span class="avatar sm">' + esc(U.initials(me.name)) + '</span><span class="col" style="line-height:1.2"><strong>' + esc(me.name) + '</strong><span class="muted" style="font-size:12px">' + T.roleName(me.role) + '</span></span><a class="dbtn sm" href="index.html">Phone app</a><button type="button" class="dbtn sm" data-act="signOut">' + icon('logout', 16) + 'Sign out</button></div></div></header>' +
      '<main class="wrap' + (narrow ? ' narrow' : '') + '">' + (ui.err ? '<div class="msg" role="alert">' + esc(ui.err) + '</div>' : '') + (ui.msg ? '<div class="msg ok" role="status">' + esc(ui.msg) + '</div>' : '') + body + '<p class="build noprint">Build ' + T.BUILD + '</p></main>';
  }
  function loginScreen() {
    var noApi = !T.cfg.api;
    return '<main class="wrap"><form class="login panel" data-form="login"><div class="brand"><small>FREEZIGO</small><b>Test Log</b></div><h2>Sign in</h2>' +
      (noApi ? '<div class="msg">The app is not connected to the Google Sheet yet.</div>' : '') +
      '<label class="col" style="gap:4px;font-weight:700">Username<input class="din" id="l-user" autocapitalize="none" autocomplete="username" value="' + esc(S().lastUser || '') + '"></label>' +
      '<label class="col" style="gap:4px;font-weight:700">Password<input class="din" id="l-pass" type="password" autocomplete="current-password"></label>' +
      (ui.err ? '<div class="msg" role="alert">' + esc(ui.err) + '</div>' : '') +
      '<button type="submit" class="dbtn primary" style="justify-content:center"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? spin() : '') + 'Sign in</button><p class="build">Build ' + T.BUILD + '</p></form></main>';
  }

  /* ---------- tests list ---------- */
  function filtered() {
    var f = ui.filters, q = (f.q || '').toLowerCase();
    return (D.tests || []).filter(function (t) {
      var day = (t.started_at || t.date || '').slice(0, 10);
      if (q && [t.test_id, t.template_name, t.product, t.machine_code, t.mode].join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      if (f.product && t.product !== f.product) return false;
      if (f.mode && t.mode !== f.mode) return false;
      if (f.template && t.template_name !== f.template) return false;
      if (f.machine && (t.machine_code || '').toLowerCase().indexOf(f.machine.toLowerCase()) < 0) return false;
      if (f.by && t.recorders.indexOf(f.by) < 0 && t.created_by !== f.by) return false;
      if (f.coverage && (T.coverage(t) || 'none') !== f.coverage) return false;
      var del = T.isDeleted(t);
      if (f.status === 'deleted' ? !del : del) return false;          // deleted tests show only when asked for
      if (f.status && f.status !== 'deleted' && t.status !== f.status) return false;
      return true;
    }).sort(function (a, b) { return (b.started_at || '').localeCompare(a.started_at || ''); });
  }
  function sel(key, label, options, anyLabel) {
    var v = ui.filters[key] || '';
    return '<label>' + label + '<select class="din' + (v ? ' used' : '') + '" data-f="' + key + '"><option value="">' + anyLabel + '</option>' + options.map(function (o) { var val = o.v !== undefined ? o.v : o, text = o.t !== undefined ? o.t : o; return '<option value="' + esc(val) + '"' + (v === val ? ' selected' : '') + '>' + esc(text) + '</option>'; }).join('') + '</select></label>';
  }
  function inp(key, label, type, ph) { var v = ui.filters[key] || ''; return '<label>' + label + '<input class="din' + (v ? ' used' : '') + '" type="' + type + '" data-f="' + key + '" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '"></label>'; }
  function testsScreen() {
    if (!D.tests) return shell('<h1>Tests</h1><div class="panel">' + spin() + ' Loading tests…</div>', 'tests');
    var f = ui.filters, list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    ui.page = Math.min(ui.page, pages - 1);
    var rows = list.slice(ui.page * PER_PAGE, (ui.page + 1) * PER_PAGE);
    var prod = D.products.find(function (p) { return p.id === f.product; });
    var modes = prod ? prod.modes : D.products.reduce(function (a, p) { return a.concat(p.modes); }, []).filter(function (x, i, a) { return a.indexOf(x) === i; });
    var tnames = D.tests.map(function (t) { return t.template_name; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort();
    var used = Object.keys(f).filter(function (k) { return f[k]; }).length;
    var h = '<div class="between" style="flex-wrap:wrap"><h1>Tests <span class="num">' + D.tests.length + '</span></h1><div class="row"><span class="muted" style="font-size:13px">Updated <strong class="num">' + U.hhmm(D.loadedAt) + '</strong></span><button type="button" class="dbtn" data-act="refresh">' + icon('retry', 18) + 'Refresh</button>' + (canTemplates() ? '<a class="dbtn" href="#/import">' + icon('excel', 18) + 'Import test from Excel</a>' : '') + (reviewer() ? '<button type="button" class="dbtn" data-act="backup"' + (ui.backing ? ' disabled' : '') + '>' + (ui.backing ? spin() : icon('download', 18)) + 'Back up all data</button>' : '') + '</div></div>';
    h += '<section class="panel noprint"><div class="filters">' + inp('q', 'Search tests', 'search', 'Test ID, template, machine') + inp('from', 'Date from', 'date') + inp('to', 'Date to', 'date') +
      sel('product', 'Product', D.products.map(function (p) { return p.name; }), 'All products') + sel('mode', 'Mode' + (prod ? ' · of ' + esc(prod.name) : ''), modes, 'All modes') + sel('template', 'Template', tnames, 'All templates') +
      inp('machine', 'Machine name/code', 'text', 'Example: BMC-1000') + sel('by', 'Recorded by · any reading', D.people.map(function (p) { return { v: p.username, t: p.name }; }), 'Everyone') +
      sel('status', 'Status', [{ v: 'running', t: 'Running' }, { v: 'finished', t: 'Finished' }, { v: 'deleted', t: 'Deleted' }], 'All') + sel('coverage', 'Test type', [{ v: 'complete', t: 'Complete test' }, { v: 'partial', t: 'Partial test' }, { v: 'none', t: 'Not marked' }], 'All') + '</div>' +
      '<div class="between"><span class="muted" style="font-size:13px">Showing <strong class="num">' + (list.length ? ui.page * PER_PAGE + 1 : 0) + '–' + Math.min(list.length, (ui.page + 1) * PER_PAGE) + '</strong> of <strong class="num">' + list.length + '</strong> · Click a row to open the report</span>' + (used ? '<button type="button" class="dbtn sm" data-act="clearFilters">' + icon('close', 14) + 'Clear all filters</button>' : '') + '</div></section>';
    h += selBar();
    h += '<div class="tablewrap"><table><thead><tr><th class="noprint" style="width:36px;cursor:pointer" data-act="selPage" title="Select all on this page"><input type="checkbox" aria-label="Select all on this page" style="pointer-events:none;width:18px;height:18px"' + (rows.length && rows.every(function (t) { return (ui.sel || {})[t.test_id]; }) ? ' checked' : '') + '></th><th>Test ID</th><th>Date</th><th>Template · product</th><th>Machine name/code</th><th>Mode</th><th>Current recorder</th><th>Recorded by</th><th class="r">Readings</th><th>Status</th><th class="r">Notes</th></tr></thead><tbody>';
    h += rows.map(function (t) {
      var status = T.isDeleted(t) ? '<span class="status check">' + icon('trash', 14) + 'Deleted</span>' : t.status === 'finished' ? '<span class="status">' + icon('lock', 14) + 'Finished</span>' : '<span class="status run">Running</span>';
      if (/-XL-\d+$/.test(t.test_id)) status += ' <span class="status">Imported</span>';
      if (t.to_check) status += ' <span class="status check">' + icon('warn', 14) + t.to_check + ' to check</span>';
      status += ' ' + covChip(t);
      return '<tr class="click" data-act="openTest" data-id="' + esc(t.test_id) + '"><td class="noprint" data-act="selToggle" data-id="' + esc(t.test_id) + '"><input type="checkbox" aria-label="Select ' + esc(t.test_id) + '" style="pointer-events:none;width:18px;height:18px"' + ((ui.sel || {})[t.test_id] ? ' checked' : '') + '></td><td class="num" style="font-weight:700;white-space:nowrap">' + esc(t.test_id) + '</td><td class="num" style="white-space:nowrap">' + esc(U.dmy(t.started_at || t.date)) + '</td><td><strong>' + esc(t.template_name || '-') + '</strong><br><span class="muted" style="font-size:13px">' + esc(t.product) + '</span></td><td class="num">' + esc(t.machine_code) + '</td><td>' + esc(t.mode) + '</td><td>' + (t.status === 'finished' ? '<span class="muted">None</span>' : esc(name(t.current_recorder))) + '</td><td>' + esc(t.recorders.map(name).join(', ') || name(t.created_by)) + '</td><td class="r num" style="font-weight:700">' + t.readings + '</td><td style="white-space:nowrap">' + status + '</td><td class="r num">' + (t.notes || '') + '</td></tr>';
    }).join('') || '<tr><td colspan="11" class="muted" style="text-align:center;padding:28px">No tests match these filters.</td></tr>';
    h += '</tbody></table></div>';
    if (pages > 1) h += '<div class="between noprint"><span class="muted">' + PER_PAGE + ' per page · page ' + (ui.page + 1) + ' of ' + pages + '</span><div class="row"><button type="button" class="dbtn sm" data-act="page" data-d="-1"' + (ui.page ? '' : ' disabled') + '>Previous</button><button type="button" class="dbtn sm" data-act="page" data-d="1"' + (ui.page < pages - 1 ? '' : ' disabled') + '>Next</button></div></div>';
    return shell(h, 'tests');
  }

  /* ---------- report helpers ---------- */
  function hrs(b, iso) { return U.minsBetween(T.startOf(b), iso) / 60; }
  function fmt(n, d) { return n === null || n === undefined || isNaN(n) ? '-' : Number(n).toFixed(d === undefined ? 2 : d); }
  function numCols(b) { return T.activeColumns(b.test).filter(function (c) { return c.type === 'number'; }); }
  function points(b, col) {
    return T.usedReadings(b).map(function (r) { return { x: hrs(b, r.time), y: U.num(r.values[col.id]), r: r }; }).filter(function (p) { return p.y !== null; });
  }
  function niceStep(span, target) {
    var raw = span / target, mag = Math.pow(10, Math.floor(Math.log10(raw || 1))), n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }
  function chart(b, unit, cols, colorOf) {
    var W = 1000, H = 300, L = 56, R = 16, Tp = 12, B = 34, end = b.test.ended_at || U.localISO();
    var series = cols.map(function (c) { return { c: c, pts: points(b, c) }; }), all = series.reduce(function (a, s) { return a.concat(s.pts); }, []);
    if (!all.length) return '<p class="muted">No numbers yet for ' + esc(unit) + '.</p>';
    var xmax = Math.max(hrs(b, end), all.reduce(function (m, p) { return Math.max(m, p.x); }, 0), 0.1);
    var ymin = Math.min.apply(null, all.map(function (p) { return p.y; })), ymax = Math.max.apply(null, all.map(function (p) { return p.y; }));
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    var ys = niceStep(ymax - ymin, 5); ymin = Math.floor(ymin / ys) * ys; ymax = Math.ceil(ymax / ys) * ys;
    var xs = niceStep(xmax, 8);
    var X = function (x) { return L + (x / xmax) * (W - L - R); }, Y = function (y) { return Tp + (1 - (y - ymin) / (ymax - ymin)) * (H - Tp - B); };
    var g = '';
    if (b.test.track_compressor) T.compressor(b, end).periods.forEach(function (p) { var a = X(Math.max(0, hrs(b, p[0]))), z = X(Math.min(xmax, hrs(b, p[1]))); if (z > a) g += '<rect x="' + a.toFixed(1) + '" y="' + Tp + '" width="' + (z - a).toFixed(1) + '" height="' + (H - Tp - B) + '" fill="var(--accent-soft)" opacity=".7"/>'; });
    for (var y = ymin; y <= ymax + ys / 2; y += ys) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(y).toFixed(1) + '" y2="' + Y(y).toFixed(1) + '" stroke="var(--grid)"/><text x="' + (L - 8) + '" y="' + (Y(y) + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="var(--ink-2)" font-family="var(--mono)">' + (+y.toFixed(6)) + '</text>';
    for (var x = 0; x <= xmax + 1e-9; x += xs) g += '<line x1="' + X(x).toFixed(1) + '" x2="' + X(x).toFixed(1) + '" y1="' + (H - B) + '" y2="' + (H - B + 5) + '" stroke="var(--axis)"/><text x="' + X(x).toFixed(1) + '" y="' + (H - B + 20) + '" text-anchor="middle" font-size="12" fill="var(--ink-2)" font-family="var(--mono)">' + (+x.toFixed(2)) + '</text>';
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--axis)"/>';
    series.forEach(function (s) {
      var col = 'var(' + colorOf(s.c) + ')';
      g += '<polyline fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" points="' + s.pts.map(function (p) { return X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1); }).join(' ') + '"/>';
      g += s.pts.map(function (p) { return '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3.5" fill="' + col + '"/>'; }).join('');
    });
    var legend = '<div class="chips" style="margin-bottom:6px">' + series.map(function (s) { return '<span class="row" style="gap:6px;font-size:13px;font-weight:700"><i style="width:14px;height:4px;border-radius:2px;background:var(' + colorOf(s.c) + ');display:inline-block"></i>' + esc(s.c.name) + '</span>'; }).join('') + (b.test.track_compressor ? '<span class="row" style="gap:6px;font-size:13px;font-weight:700"><i style="width:14px;height:12px;border-radius:2px;background:var(--accent-soft);display:inline-block"></i>Compressor ON</span>' : '') + '</div>';
    return '<div class="chart" data-chart="' + esc(unit) + '" data-xmax="' + xmax + '"><div class="between"><strong>' + esc(unit) + '</strong></div>' + legend + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Line graph of ' + esc(cols.map(function (c) { return c.name; }).join(', ')) + ' against hours from start">' + g + '<line class="cross" x1="0" x2="0" y1="' + Tp + '" y2="' + (H - B) + '" stroke="var(--ink)" stroke-dasharray="4 4" visibility="hidden"/></svg><div class="muted" style="text-align:center;font-size:12px;font-weight:700">Hours from start</div></div>';
  }
  function photoThumb(p, label) { return '<button type="button" class="dthumb" data-act="viewer" data-photo-id="' + esc(p.photo_id) + '" aria-label="' + esc(label) + '">' + icon('image', 18) + '</button>'; }
  function noteBox(cls, who, text) { return '<div class="dnote ' + cls + '"><small>' + who + '</small><span>' + esc(text) + '</span></div>'; }

  /* ---------- report ---------- */
  function reportScreen() {
    var b = D.bundle;
    if (!b) return shell('<a class="dbtn sm noprint" href="#/tests" style="align-self:flex-start">' + icon('back', 16) + 'All tests</a><div class="panel">' + spin() + ' Loading test…</div>', 'tests');
    var t = b.test, cols = T.activeColumns(t), ncols = numCols(b), used = T.usedReadings(b), end = t.ended_at || U.localISO();
    var en = T.energy(b), comp = T.compressor(b, end), compMin = t.comp_on_min !== null && t.comp_on_min !== undefined ? t.comp_on_min : comp.totalMin;
    var byNo = {}; b.readings.forEach(function (r) { (byNo[r.no] = byNo[r.no] || []).push(r); });
    var dupes = Object.keys(byNo).filter(function (n) { return byNo[n].length > 1; }), toCheck = dupes.filter(function (n) { return !byNo[n].some(function (r) { return r.use === 'yes'; }); });
    var recorders = {}; b.readings.forEach(function (r) { recorders[r.by] = (recorders[r.by] || 0) + 1; });
    var edits = b.edits.length;
    if (!ui.series) { ui.series = {}; ncols.filter(function (c) { return /°c/i.test(c.unit); }).slice(0, 4).forEach(function (c) { ui.series[c.id] = true; }); if (!Object.keys(ui.series).length && ncols[0]) ui.series[ncols[0].id] = true; }
    if (!ui.statCol && ncols[0]) ui.statCol = (ncols.find(function (c) { return /°c/i.test(c.unit); }) || ncols[0]).id;

    var h = '<a class="dbtn sm noprint" href="#/tests" style="align-self:flex-start">' + icon('back', 16) + 'All tests</a>';
    h += '<section class="between" style="flex-wrap:wrap;align-items:flex-start"><div class="col" style="gap:6px"><div class="row" style="flex-wrap:wrap"><h1 class="num" style="font-size:34px">' + esc(t.test_id) + '</h1>' + (T.isDeleted(t) ? '<span class="status check">' + icon('trash', 14) + 'Deleted</span>' : t.status === 'finished' ? '<span class="status">' + icon('lock', 14) + 'Finished · Locked</span>' : '<span class="status run">Running</span>') + (toCheck.length ? '<span class="status check">' + icon('warn', 14) + toCheck.length + ' reading to check</span>' : '') + (t.setup && t.setup.imported ? '<span class="status">Imported</span>' : '') + (canTemplates() && t.status === 'finished' && !T.isDeleted(t) ? '' : covChip(t)) + '</div><strong style="font-size:17px">' + esc(t.product) + ' · ' + esc(t.template_name) + '</strong><span class="muted">Machine <strong class="num" style="color:var(--ink)">' + esc(t.machine_code || '-') + '</strong> · Mode <strong style="color:var(--ink)">' + esc(t.mode || '-') + '</strong> · Recorders <strong style="color:var(--ink)">' + esc(Object.keys(recorders).map(name).join(', ') || name(t.created_by)) + '</strong> · <span class="num">' + esc(U.dmyhm(T.startOf(b))) + ' → ' + (t.ended_at ? esc(U.hhmm(t.ended_at)) : 'running') + '</span></span></div>' +
      '<div class="row noprint"><button type="button" class="dbtn" data-act="refresh">' + icon('retry', 18) + 'Refresh</button><button type="button" class="dbtn primary" data-act="exportToggle">' + icon('excel', 18) + 'Export to Excel</button>' + (!T.isDeleted(t) && (reviewer() || recorders[S().current] || t.created_by === S().current) ? '<button type="button" class="dbtn" data-act="delToggle">' + icon('trash', 18) + 'Delete test</button>' : '') + '<button type="button" class="dbtn" data-act="pdf">' + icon('pdf', 18) + 'Export PDF</button></div></section>';
    if (canTemplates() && t.status === 'finished' && !T.isDeleted(t)) h += '<section class="row" role="radiogroup" aria-label="Test type"><strong style="font-size:13px">Test type</strong>' + [['complete', 'Complete test'], ['partial', 'Partial test']].map(function (o) { return '<button type="button" role="radio" aria-checked="' + (T.coverage(t) === o[0]) + '" class="dbtn' + (T.coverage(t) === o[0] ? ' primary' : '') + '" data-act="mark" data-v="' + o[0] + '"' + (ui.busy ? ' disabled' : '') + '>' + (T.coverage(t) === o[0] ? icon('check', 16) : '') + o[1] + '</button>'; }).join('') + '</section>';
    if (ui.delOpen) h += '<section class="panel noprint" style="border-color:var(--bad)"><h2 style="font-size:16px">Delete this test?</h2><span class="muted" style="font-size:13px">The test is locked and hidden from the lists. The data stays in the Google Sheet. It shows under Status, Deleted.</span><label class="col" style="gap:4px;font-weight:800;font-size:13px">Reason<textarea class="din" id="del-reason" placeholder="Example: Wrong machine was connected."></textarea></label><div class="row"><button type="button" class="dbtn bad" data-act="delDo"' + (ui.busy ? ' disabled' : '') + '>' + icon('trash', 16) + 'Yes, delete test</button><button type="button" class="dbtn" data-act="delToggle">No, go back</button></div></section>';
    if (ui.exportOpen) {
      var items = [['Setup', 'Machine, mode, water, interval, setup notes'], ['Readings', 'One row for each reading. Time from start in hours, Recorded by, recorder note, reviewer note'], ['Edits', 'Every changed value: old value, new value, who, when'], ['Notes', 'Recorder notes and reviewer notes'], ['Events', 'Handovers and compressor ON/OFF taps'], ['Photos', 'One row for each photo with a link to the file in Google Drive']];
      h += '<section class="panel noprint"><div class="between"><div><h2 style="font-size:16px">What the Excel file contains</h2><span class="muted" style="font-size:13px">File <strong class="num">' + esc(t.test_id) + '.xlsx</strong> · one sheet for each part · every sheet is an Excel table with filters</span></div><div class="row"><button type="button" class="dbtn sm" data-act="exportToggle">Close</button><button type="button" class="dbtn primary" data-act="excel">' + icon('download', 18) + 'Download Excel</button></div></div><ol style="margin:0;padding-left:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:6px 28px">' + items.map(function (x) { return '<li><strong>' + x[0] + '</strong><br><span class="muted" style="font-size:13px">' + x[1] + '</span></li>'; }).join('') + '</ol></section>';
    }
    h += '<section class="tiles"><div class="tile"><span class="k">Total time</span><span class="v num">' + U.dur(U.minsBetween(T.startOf(b), end)) + '</span><small class="num">' + U.hhmm(T.startOf(b)) + ' → ' + (t.ended_at ? U.hhmm(t.ended_at) : 'now') + '</small></div>' +
      '<div class="tile"><span class="k">Total energy</span><span class="v num">' + (en && en.total !== null ? fmt(en.total) + ' <span style="font-size:15px">kWh</span>' : '-') + '</span><small>' + (en ? 'Auto · ' + esc(en.col.name) + (en.total !== null ? ' <span class="num">' + en.first + ' → ' + en.last + '</span>' : '') : 'No kWh column in this test') + '</small></div>' +
      '<div class="tile"><span class="k">Readings</span><span class="v num">' + used.length + '</span><small>' + (t.interval_min ? 'Every ' + t.interval_min + ' min' : 'No interval') + ' · ' + edits + ' edit' + (edits === 1 ? '' : 's') + (dupes.length ? ' · ' + dupes.length + ' saved twice' : '') + '</small></div>' +
      (t.track_compressor ? '<div class="tile"><span class="k">Compressor on-time</span><span class="v num">' + U.dur(compMin) + '</span><small>' + (t.comp_on_edited ? 'Typed by recorder · auto was ' + U.dur(comp.totalMin) : 'Auto · ' + comp.periods.length + ' ON period' + (comp.periods.length === 1 ? '' : 's') + ' · ' + comp.taps + ' taps') + '</small></div>' : '') + '</section>';
    if (ncols.length) {
      var sc = ncols.find(function (c) { return c.id === ui.statCol; }) || ncols[0], pts = points(b, sc), first = pts[0], last = pts[pts.length - 1], rate = first && last && last.x > first.x ? (last.y - first.y) / (last.x - first.x) : null;
      h += '<section class="panel"><div class="row" style="flex-wrap:wrap"><label class="row" style="font-weight:800;font-size:13px">Column <select class="din" data-in="statCol">' + ncols.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === sc.id ? ' selected' : '') + '>' + esc(c.name) + ' (' + esc(c.unit) + ')</option>'; }).join('') + '</select></label>' +
        '<div class="tiles grow" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="tile"><span class="k">Start</span><span class="v num">' + (first ? first.y : '-') + ' <span style="font-size:14px">' + esc(sc.unit) + '</span></span></div><div class="tile"><span class="k">End</span><span class="v num">' + (last ? last.y : '-') + ' <span style="font-size:14px">' + esc(sc.unit) + '</span></span></div><div class="tile"><span class="k">Rate of change</span><span class="v num">' + fmt(rate) + ' <span style="font-size:14px">' + esc(sc.unit) + ' per hour</span></span></div></div></div></section>';
      var colorOf = function (c) { return SERIES[ncols.indexOf(c) % SERIES.length]; }, groups = {};
      ncols.forEach(function (c) { if (ui.series[c.id]) (groups[c.unit || 'No unit'] = groups[c.unit || 'No unit'] || []).push(c); });
      h += '<section class="col" style="gap:12px"><div><h2>Graph</h2><p class="muted">Pick columns to plot. Each unit gets its own chart.' + (t.track_compressor ? ' Blue bands show when the compressor was ON.' : '') + '</p></div><div class="chips noprint">' + ncols.map(function (c) { return '<button type="button" class="cchip" aria-pressed="' + !!ui.series[c.id] + '" data-act="series" data-c="' + esc(c.id) + '"><i style="background:var(' + colorOf(c) + ')"></i>' + esc(c.name) + ' <span class="muted" style="color:inherit;opacity:.7">' + esc(c.unit) + '</span></button>'; }).join('') + '</div>' +
        (Object.keys(groups).map(function (u) { return chart(b, u, groups[u], colorOf); }).join('') || '<p class="muted">Pick 1 or more columns.</p>') + '</section>';
    }
    // setup, recorders, events
    var s = t.setup || {}, setupRows = [['Template', t.template_name], ['Product', t.product], ['Machine name/code', t.machine_code], ['Machine mode', t.mode], ['Date', U.dmy(t.date || t.started_at)], ['Test type', T.coverageName(T.coverage(t))]].concat(T.setupFields(t.columns, t.product).map(function (f) { return [f.name, s[f.id] ? s[f.id] + (f.unit ? ' ' + f.unit : '') : '']; })).concat([['Reading interval', t.interval_min ? t.interval_min + ' min' : ''], ['Alarm', t.interval_min ? (s.alarm === false ? 'Off' : 'On') : ''], ['Started on phone', t.phone]]).concat(s.imported ? [['Imported from', s.imported.file]] : []);
    var setupPhotos = b.photos.filter(function (p) { return !p.reading_id; });
    var events = b.events.filter(function (e) { return ['compressor_on', 'compressor_off', 'handover', 'takeover', 'interval', 'column_added', 'setup', 'finish', 'imported', 'coverage'].indexOf(e.kind) >= 0; }).sort(function (x, y) { return (x.time || '').localeCompare(y.time || ''); });
    h += '<section class="two"><div class="panel"><h2>Setup</h2><div class="kv">' + setupRows.map(function (r) { return '<span>' + r[0] + '</span><span>' + (r[1] ? esc(r[1]) : '<span class="muted">-</span>') + '</span>'; }).join('') + '</div>' +
      '<h3 style="font-size:15px;margin-top:6px">Recorders · ' + Object.keys(recorders).length + '</h3>' + (Object.keys(recorders).map(function (u) { var nos = b.readings.filter(function (r) { return r.by === u; }).map(function (r) { return r.no; }); return '<div class="row"><span class="avatar sm">' + esc(U.initials(name(u))) + '</span><strong>' + esc(name(u)) + '</strong><span class="muted"><span class="num">' + recorders[u] + '</span> readings · No. ' + Math.min.apply(null, nos) + ' to ' + Math.max.apply(null, nos) + '</span></div>'; }).join('') || '<span class="muted">No readings yet.</span>') +
      (setupPhotos.length ? '<h3 style="font-size:15px;margin-top:6px">Setup photos · ' + setupPhotos.length + '</h3><div>' + setupPhotos.map(function (p, i) { return photoThumb(p, 'Setup photo ' + (i + 1)); }).join('') + '</div>' : '') +
      (s.notes ? noteBox('', 'Setup notes · ' + esc(name(t.created_by)) + ' · recorder', s.notes) : '') + '</div>';
    h += '<div class="panel"><h2>Events <span class="num muted" style="font-size:16px">' + events.length + '</span></h2><div class="tablewrap" style="border:0"><table><thead><tr><th>Time</th><th class="r">h</th><th>Event</th><th>By</th></tr></thead><tbody>' + (events.map(function (e) { return '<tr><td class="num">' + esc(U.hhmm(e.time)) + '</td><td class="num r">' + fmt(hrs(b, e.time)) + '</td><td>' + icon(e.kind.indexOf('compressor') === 0 ? 'power' : e.kind === 'finish' ? 'lock' : e.kind === 'handover' || e.kind === 'takeover' ? 'swap' : 'info', 15) + ' ' + esc(e.text) + (e.data && e.data.note ? '<br><span class="muted" style="font-size:13px">Note: ' + esc(e.data.note) + '</span>' : '') + '</td><td>' + esc(name(e.by)) + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">No events.</td></tr>') + '</tbody></table></div></div></section>';
    // notes on the test
    var testNotes = b.notes.filter(function (n) { return !n.reading_id; });
    h += '<section class="panel"><h2>Notes on this test</h2>' + (t.final_remarks ? noteBox('', 'Final remarks · recorder · ' + esc(U.dmhm(t.ended_at)), t.final_remarks) : '<span class="muted">No final remarks from the recorder' + (t.status === 'finished' ? '.' : ' yet.') + '</span>') +
      '<span class="muted" style="font-size:13px">Recorder notes are written on the phone. They cannot be changed here.</span>' + testNotes.map(function (n) { return noteBox(n.role === 'reviewer' ? 'rev' : '', esc(name(n.by)) + ' · ' + (n.role === 'reviewer' ? 'Reviewer' : 'Recorder') + ' · <span class="num">' + esc(U.dmyhm(n.at)) + '</span>', n.text); }).join('') +
      '<div class="composer col" style="gap:8px"><label style="font-weight:800;font-size:13px" for="note-test">Add a note on this test</label><textarea class="din" id="note-test" placeholder="Example: Repeat this test with 1000 litres."></textarea><button type="button" class="dbtn primary" style="align-self:flex-start" data-act="saveNote" data-r=""' + (ui.busy ? ' disabled' : '') + '>Save note</button></div></section>';
    // readings table
    var items = T.sortedReadings(b).map(function (r) { return { t: r.time, r: r }; });
    events.forEach(function (e) { if (e.kind !== 'interval' && e.kind !== 'column_added' && e.kind !== 'setup') items.push({ t: e.time || '', e: e }); });
    items.sort(function (x, y) { return (x.t || '').localeCompare(y.t || '') || (x.r ? 1 : -1); });
    var span = 5 + cols.length;
    h += '<section class="col" style="gap:10px"><div class="between" style="flex-wrap:wrap"><h2>Readings <span class="num muted" style="font-size:16px">' + used.length + '</span></h2><div class="legend"><span><i style="width:12px;height:12px;border-radius:3px;background:var(--mark-soft);border:1px solid var(--mark);display:inline-block"></i>Edited value (click to see old value)</span><span>' + icon('clock', 14) + 'Time changed</span><span>' + icon('note', 14) + 'Note</span><span>' + icon('camera', 14) + 'Photo</span><span>' + icon('warn', 14) + 'Recorded after handover</span></div></div>';
    h += '<div class="tablewrap" style="position:relative"><table><thead><tr><th>No.</th><th>Time</th><th class="r">h</th><th>Recorded by</th>' + cols.map(function (c) { return '<th class="r">' + esc(c.name) + '<br><span class="muted">' + esc(c.unit || (c.type === 'yesno' ? 'Yes/No' : '')) + '</span></th>'; }).join('') + '<th>Notes · photos</th></tr></thead><tbody>';
    var doneDupe = {};
    items.forEach(function (it) {
      if (it.e) { var hand = it.e.kind !== 'compressor_on' && it.e.kind !== 'compressor_off'; h += '<tr class="evrow' + (hand ? ' hand' : '') + '"><td></td><td class="num">' + esc(U.hhmm(it.t)) + '</td><td class="num r">' + fmt(hrs(b, it.t)) + '</td><td colspan="' + (span - 3) + '">' + icon(hand ? (it.e.kind === 'finish' ? 'lock' : 'swap') : 'power', 15) + ' ' + esc(it.e.text) + '</td></tr>'; return; }
      var r = it.r, twice = byNo[r.no].length > 1, isUsed = used.indexOf(r) >= 0, ed = {};
      b.edits.forEach(function (e) { if (e.reading_id === r.reading_id) ed[e.column_id] = true; });
      if (twice && !doneDupe[r.no]) { doneDupe[r.no] = true; h += '<tr><td colspan="' + span + '" style="background:var(--warn-soft)">' + icon('warn', 16) + ' <strong>Reading ' + r.no + ' was saved twice. ' + (byNo[r.no].some(function (x) { return x.use === 'yes'; }) ? 'You picked the one to use.' : 'Pick the one to use.') + '</strong> <span class="muted">Totals and the graph use the reading that is not greyed out. The other one stays in the report.</span></td></tr>'; }
      var rn = b.notes.filter(function (n) { return n.reading_id === r.reading_id; }), ph = b.photos.filter(function (p) { return p.reading_id === r.reading_id; }), open = ui.openNotes[r.reading_id];
      h += '<tr class="' + (r.late ? 'late ' : '') + (twice && !isUsed ? 'unused' : '') + '"><td class="num" style="font-weight:700">' + r.no + '</td><td class="num' + (ed._time ? ' ed' : '') + '"' + (ed._time ? ' data-act="pop" data-r="' + esc(r.reading_id) + '" data-c="_time"' : '') + ' style="white-space:nowrap">' + esc(U.hhmm(r.time)) + (r.time_changed ? ' ' + icon('clock', 13, 'style="color:var(--mark)"') : '') + '</td><td class="num r">' + fmt(hrs(b, r.time)) + '</td><td style="white-space:nowrap">' + esc(name(r.by)) + (r.late ? ' ' + icon('warn', 14, 'style="color:var(--warn-text)"') : '') + '</td>' +
        cols.map(function (c) { var v = r.values[c.id]; return '<td class="num r' + (ed[c.id] ? ' ed' : '') + '"' + (ed[c.id] ? ' data-act="pop" data-r="' + esc(r.reading_id) + '" data-c="' + esc(c.id) + '" title="Edited. Click to see the old value."' : '') + '>' + esc(v === undefined ? '' : v) + '</td>'; }).join('') +
        '<td style="white-space:nowrap">' + (twice && reviewer() && r.use !== 'yes' ? '<button type="button" class="dbtn sm noprint" data-act="useReading" data-r="' + esc(r.reading_id) + '" data-n="' + r.no + '">' + icon('check', 14) + 'Use this</button> ' : '') + (twice && isUsed ? '<span class="status">In use</span> ' : '') +
        '<button type="button" class="dbtn sm" data-act="toggleNotes" data-r="' + esc(r.reading_id) + '" aria-expanded="' + !!open + '">' + icon('note', 14) + ((r.note ? 1 : 0) + rn.length || '') + (ph.length ? ' ' + icon('camera', 14) + ph.length : '') + ' ' + icon(open ? 'up' : 'down', 14) + '</button></td></tr>';
      if (open || ui.printing) {
        var inner = (r.late ? '<div class="dnote" style="background:var(--warn-soft)"><small>Recorded after handover</small><span>Saved <span class="num">' + esc(U.hhmm(r.saved_at || r.time)) + '</span> on phone <span class="num">' + esc(r.phone || '-') + '</span> · synced <span class="num">' + esc(U.hhmm(r.synced_at)) + '</span></span></div>' : '') + (r.note ? noteBox('', esc(name(r.by)) + ' · recorder', r.note) : '') + rn.map(function (n) { return noteBox(n.role === 'reviewer' ? 'rev' : '', esc(name(n.by)) + ' · ' + (n.role === 'reviewer' ? 'Reviewer' : 'Recorder') + ' · <span class="num">' + esc(U.dmyhm(n.at)) + '</span>', n.text); }).join('') + (ph.length ? '<div>' + ph.map(function (p, i) { return photoThumb(p, 'Reading ' + r.no + ' photo ' + (i + 1)); }).join('') + '</div>' : '');
        if (open || inner) h += '<tr><td colspan="' + span + '" style="background:var(--surface-2)"><div class="col" style="gap:8px;max-width:760px">' + (inner || '<span class="muted">No notes or photos on reading ' + r.no + '.</span>') + '<div class="composer col" style="gap:6px"><label style="font-weight:800;font-size:13px" for="note-' + esc(r.reading_id) + '">Your note on reading ' + r.no + ' · ' + esc(T.me().name) + '</label><textarea class="din" id="note-' + esc(r.reading_id) + '" style="min-height:56px" placeholder="Example: TE-4 looks wrong here."></textarea><button type="button" class="dbtn primary sm" style="align-self:flex-start" data-act="saveNote" data-r="' + esc(r.reading_id) + '"' + (ui.busy ? ' disabled' : '') + '>Save note</button></div></div></td></tr>';
      }
    });
    if (!items.length) h += '<tr><td colspan="' + span + '" class="muted" style="text-align:center;padding:28px">No readings yet.</td></tr>';
    h += '</tbody></table>' + popHtml(b) + '</div></section>';
    return shell(h, 'tests') + viewerHtml(b);
  }
  function popHtml(b) {
    var p = ui.pop; if (!p) return '';
    var list = b.edits.filter(function (e) { return e.reading_id === p.r && e.column_id === p.c; }).sort(function (x, y) { return (x.at || '').localeCompare(y.at || ''); });
    var show = function (e, v) { return e.column_id === '_time' ? U.hhmm(v) : (v === '' ? 'blank' : v); };
    return '<div class="pop" style="left:' + p.x + 'px;top:' + p.y + 'px" role="dialog" aria-label="Edit history"><div class="between"><strong>' + esc(list[0] ? list[0].column_name : '') + ' · edited</strong><button type="button" class="dbtn sm" data-act="closePop" aria-label="Close">' + icon('close', 14) + '</button></div>' + list.map(function (e) { return '<div><span class="num"><span class="muted" style="text-decoration:line-through">' + esc(show(e, e.old_value)) + '</span> → <strong>' + esc(show(e, e.new_value)) + '</strong></span><br><span class="muted" style="font-size:13px">Changed by <strong>' + esc(name(e.by)) + '</strong> · <span class="num">' + esc(U.dmyhm(e.at)) + '</span></span></div>'; }).join('') + '<span class="muted" style="font-size:12px">Old values are kept for review.</span></div>';
  }
  function photoList(b) {
    var no = {}; b.readings.forEach(function (r) { no[r.reading_id] = r.no; });
    return b.photos.slice().sort(function (x, y) { return (no[x.reading_id] || 0) - (no[y.reading_id] || 0) || (x.taken_at || '').localeCompare(y.taken_at || ''); }).map(function (p) { return Object.assign({ label: p.reading_id ? 'Reading ' + no[p.reading_id] : 'Setup' }, p); });
  }
  function viewerHtml(b) {
    if (!ui.viewer) return '';
    var list = photoList(b), i = Math.max(0, list.findIndex(function (p) { return p.photo_id === ui.viewer; })), p = list[i];
    if (!p) return '';
    return '<section class="viewer" role="dialog" aria-modal="true" aria-label="Photo"><div class="between"><div class="col"><strong style="font-size:18px">' + esc(p.label) + ' · photo ' + (i + 1) + ' of ' + list.length + '</strong><span style="font-size:14px;color:#B9C3CD"><span class="num">' + esc(b.test.test_id) + '</span> · Taken by ' + esc(name(p.by)) + ' · <span class="num">' + esc(U.dmyhm(p.taken_at)) + '</span></span></div><div class="row"><a id="viewer-dl" class="dbtn" style="background:transparent;color:#F1F4F7;border-color:rgba(255,255,255,.45)" download="' + esc(p.name || p.photo_id + '.jpg') + '">' + icon('download', 18) + 'Download</a><button type="button" data-act="viewerClose" aria-label="Close photo">' + icon('close', 22) + '</button></div></div>' +
      '<div class="row" style="flex:1;min-height:0;gap:16px"><button type="button" data-act="viewerStep" data-d="-1" aria-label="Previous photo"' + (i ? '' : ' disabled style="opacity:.3"') + '>' + icon('chevLeft', 26) + '</button><div id="viewer-img" style="flex:1;align-self:stretch;min-height:0;display:grid;place-items:center">' + spin() + '</div><button type="button" data-act="viewerStep" data-d="1" aria-label="Next photo"' + (i < list.length - 1 ? '' : ' disabled style="opacity:.3"') + '>' + icon('chevron', 26) + '</button></div></section>';
  }

  /* ---------- Backup of all data (reviewer only) ---------- */
  // One Excel file with one sheet for each data tab of the Google Sheet, exactly as stored, plus two extra sheets:
  //   About         - when, by whom, and how many rows each sheet has
  //   Readings long - one row for each value of each reading, with the column name and unit, ready to filter or pivot
  function backupExcel(r) {
    var wb = new ExcelJS.Workbook(), n = 0, NUM = { no: 1, interval_min: 1, comp_on_min: 1, bytes: 1, tests_made: 1, sort: 1 }, MAX = 32000;
    function cell(v) { v = v === undefined || v === null ? '' : v; return typeof v === 'string' && v.length > MAX ? v.slice(0, MAX) : v; }
    function sheet(title, head, rows, wide) {
      var ws = wb.addWorksheet(title);
      if (!rows.length) rows = [head.map(function () { return ''; })];
      ws.addTable({ name: 'B' + (++n) + '_' + title.replace(/\W/g, ''), ref: 'A1', headerRow: true, style: { theme: 'TableStyleLight1', showRowStripes: false }, columns: head.map(function (x) { return { name: x, filterButton: true }; }), rows: rows });
      head.forEach(function (x, i) { var c = ws.getColumn(i + 1); c.width = (wide && wide[x]) || Math.max(12, Math.min(28, x.length + 6)); c.font = { name: 'Arial', size: 10 }; });
      ws.getRow(1).font = { name: 'Arial', size: 10, bold: true };
      return ws;
    }
    var names = Object.keys(r.tabs), about = [['Backup made at', U.dmyhm(r.at)], ['Made by', r.by], ['App build', T.BUILD], ['Photos', 'Photo files stay in Google Drive. The Photos sheet has a link to each one.'], ['Not in this file', 'Passwords, sign-in records and housekeeping tabs']];
    names.forEach(function (name) { about.push(['Rows in ' + name, r.tabs[name].rows.length]); });
    var aboutWs = sheet('About', ['Item', 'Value'], about, { Item: 26, Value: 70 });
    // Readings long: join each reading to its test's columns
    var tests = {}, T_ = r.tabs.Tests, R_ = r.tabs.Readings, ti = {}, ri = {};
    T_.head.forEach(function (h, i) { ti[h] = i; }); R_.head.forEach(function (h, i) { ri[h] = i; });
    T_.rows.forEach(function (row) { var cols = []; try { cols = JSON.parse(row[ti.columns_json] || '[]'); } catch (e) {} tests[row[ti.test_id]] = { cols: cols, machine: row[ti.machine_code], product: row[ti.product], mode: row[ti.mode], template: row[ti.template_name] }; });
    var long = [];
    R_.rows.forEach(function (row) {
      var t = tests[row[ri.test_id]] || { cols: [] }, vals = {}; try { vals = JSON.parse(row[ri.values_json] || '{}'); } catch (e) {}
      t.cols.forEach(function (c) {
        var v = vals[c.id]; if (v === undefined || v === '') return;
        long.push([row[ri.test_id], t.machine || '', t.product || '', t.mode || '', Number(row[ri.no]), xdate(row[ri.time]), row[ri.by], c.name, c.unit || '', c.type === 'number' && U.num(v) !== null ? U.num(v) : v, row[ri.late] === 'true' ? 'Yes' : '', row[ri.use] || '']);
      });
    });
    var lw = sheet('Readings long', ['test_id', 'machine', 'product', 'mode', 'reading_no', 'time', 'recorded_by', 'column', 'unit', 'value', 'after_handover', 'reviewer_pick'], long, { test_id: 18, machine: 22, column: 24, time: 19 });
    lw.getColumn(6).numFmt = 'dd-mmm-yyyy hh:mm';
    names.forEach(function (name) {
      var tab = r.tabs[name], head = tab.head.slice(), fi = head.indexOf('file_id');
      var rows = tab.rows.map(function (row) { return row.map(function (v, i) { return NUM[head[i]] && v !== '' && !isNaN(Number(v)) ? Number(v) : cell(v); }); });
      if (name === 'Photos' && fi >= 0) { head.push('link'); rows.forEach(function (row) { row.push(row[fi] ? { text: 'Open in Google Drive', hyperlink: 'https://drive.google.com/file/d/' + row[fi] + '/view' } : ''); }); }
      sheet(name, head, rows, { setup_json: 50, columns_json: 60, values_json: 50, values_text: 60, text: 50, note: 40, final_remarks: 40, test_id: 18, reading_id: 38 });
    });
    aboutWs.getColumn(2).alignment = { horizontal: 'left' };
    return wb.xlsx.writeBuffer().then(function (buf) {
      var d = new Date(), stamp = d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()) + '_' + U.pad(d.getHours()) + U.pad(d.getMinutes());
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = 'Freezigo_Test_Log_backup_' + stamp + '.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      return long.length;
    });
  }

  /* ---------- Excel export ---------- */
  function xdate(iso) { var d = U.toDate(iso); return d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())) : ''; }
  function exportExcel() {
    var b = D.bundle, t = b.test, cols = T.activeColumns(t), used = T.usedReadings(b), wb = new ExcelJS.Workbook(), n = 0;
    var no = {}; b.readings.forEach(function (r) { no[r.reading_id] = r.no; });
    function sheet(title, head, rows, widths, formats) {
      var ws = wb.addWorksheet(title);
      if (!rows.length) rows = [head.map(function () { return ''; })];
      ws.addTable({ name: 'T' + (++n) + '_' + title.replace(/\W/g, ''), ref: 'A1', headerRow: true, style: { theme: 'TableStyleLight1', showRowStripes: false }, columns: head.map(function (x) { return { name: x, filterButton: true }; }), rows: rows });
      head.forEach(function (x, i) { var c = ws.getColumn(i + 1); c.width = (widths && widths[i]) || Math.max(12, Math.min(40, x.length + 4)); c.font = { name: 'Arial', size: 10 }; if (formats && formats[i]) c.numFmt = formats[i]; c.alignment = { vertical: 'top', wrapText: (widths && widths[i] >= 40) }; });
      ws.getRow(1).font = { name: 'Arial', size: 10, bold: true }; ws.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
      return ws;
    }
    var s = t.setup || {}, en = T.energy(b), end = t.ended_at || U.localISO(), comp = t.comp_on_min !== null && t.comp_on_min !== undefined ? t.comp_on_min : T.compressor(b, end).totalMin;
    sheet('Setup', ['Field', 'Value'], [['Test ID', t.test_id], ['Status', t.status === 'finished' ? 'Finished and locked' : 'Running'], ['Product', t.product], ['Template', t.template_name], ['Machine name/code', t.machine_code], ['Machine mode', t.mode], ['Date', U.dmy(t.date || t.started_at)], ['Start time', U.dmyhm(T.startOf(b))], ['End time', t.ended_at ? U.dmyhm(t.ended_at) : ''], ['Total time (hrs)', +(U.minsBetween(T.startOf(b), end) / 60).toFixed(2)], ].concat(T.setupFields(t.columns, t.product).map(function (f) { var v = s[f.id]; return [f.name + (f.unit ? ' (' + f.unit + ')' : ''), f.type === 'number' && U.num(v) !== null ? U.num(v) : (v || '')]; })).concat([['Reading interval (min)', t.interval_min || ''], ['Total energy (kWh)', en && en.total !== null ? +en.total.toFixed(3) : ''], ['Compressor on-time (min)', t.track_compressor ? Math.round(comp) : ''], ['Compressor on-time typed by recorder', t.comp_on_edited ? 'Yes' : 'No'], ['Recorders', b.readings.map(function (r) { return name(r.by); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ')], ['Setup notes', s.notes || ''], ['Final remarks', t.final_remarks || '']]), [34, 60]);
    var head = ['No.', 'Time', 'Time from start (hrs)', 'Recorded by'].concat(cols.map(function (c) { return c.name + (c.unit ? ' (' + c.unit + ')' : ''); })).concat(['Recorder note', 'Reviewer notes', 'Time changed', 'Recorded after handover', 'Used in totals', 'Photos']);
    var fm = [null, 'dd-mmm-yyyy hh:mm', '0.00'];
    sheet('Readings', head, T.sortedReadings(b).map(function (r) {
      return [r.no, xdate(r.time), +hrs(b, r.time).toFixed(2), name(r.by)].concat(cols.map(function (c) { var v = r.values[c.id]; if (v === undefined || v === '') return ''; return c.type === 'number' && U.num(v) !== null ? U.num(v) : v; })).concat([r.note || '', b.notes.filter(function (x) { return x.reading_id === r.reading_id; }).map(function (x) { return name(x.by) + ': ' + x.text; }).join(' | '), r.time_changed ? 'Yes' : '', r.late ? 'Yes' : '', used.indexOf(r) >= 0 ? 'Yes' : 'No', b.photos.filter(function (p) { return p.reading_id === r.reading_id; }).length || '']);
    }), [7, 19, 12, 14].concat(cols.map(function () { return 13; })).concat([40, 40, 10, 12, 10, 8]), fm);
    sheet('Edits', ['Reading no.', 'Column', 'Old value', 'New value', 'Changed by', 'Changed at'], b.edits.map(function (e) { return [e.no, e.column_name, e.old_value, e.new_value, name(e.by), xdate(U.localISO(new Date(e.at)))]; }), [11, 28, 16, 16, 16, 19], [null, null, null, null, null, 'dd-mmm-yyyy hh:mm']);
    var notes = [];
    if (s.notes) notes.push(['Setup', 'Recorder', name(t.created_by), s.notes, xdate(t.started_at)]);
    b.readings.forEach(function (r) { if (r.note) notes.push(['Reading ' + r.no, 'Recorder', name(r.by), r.note, xdate(r.time)]); });
    if (t.final_remarks) notes.push(['Final remarks', 'Recorder', name(t.current_recorder), t.final_remarks, xdate(t.ended_at)]);
    b.notes.forEach(function (x) { notes.push([x.reading_id ? 'Reading ' + no[x.reading_id] : 'Whole test', x.role === 'reviewer' ? 'Reviewer' : 'Recorder', name(x.by), x.text, xdate(U.localISO(new Date(x.at)))]); });
    sheet('Notes', ['About', 'Role', 'Written by', 'Note', 'Written at'], notes, [16, 12, 16, 70, 19], [null, null, null, null, 'dd-mmm-yyyy hh:mm']);
    sheet('Events', ['Time', 'Time from start (hrs)', 'Event', 'By', 'Note'], b.events.slice().sort(function (x, y) { return (x.time || '').localeCompare(y.time || ''); }).map(function (e) { return [xdate(e.time), e.time ? +hrs(b, e.time).toFixed(2) : '', e.text, name(e.by), (e.data && e.data.note) || '']; }), [19, 12, 44, 16, 40], ['dd-mmm-yyyy hh:mm', '0.00']);
    var ph = sheet('Photos', ['About', 'File name', 'Taken by', 'Taken at', 'Link'], photoList(b).map(function (p) { return [p.label, p.name || '', name(p.by), xdate(p.taken_at), p.file_id ? { text: 'Open in Google Drive', hyperlink: 'https://drive.google.com/file/d/' + p.file_id + '/view' } : '']; }), [14, 40, 16, 19, 24], [null, null, null, 'dd-mmm-yyyy hh:mm']);
    ph.getColumn(5).font = { name: 'Arial', size: 10, color: { argb: 'FF0B57C8' }, underline: true };
    return wb.xlsx.writeBuffer().then(function (buf) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = t.test_id + '.xlsx';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    });
  }

  /* ---------- templates ---------- */
  function blankTemplate() { return { id: U.uid(), name: '', product: (D.products[0] || {}).id || '', default_mode: '', track_compressor: true, columns: [], setup: [], isNew: true }; }
  /** One editable table of a template: g = 'setup' (asked once, at the start) or 'columns' (asked at every reading). */
  function colTable(t, g) {
    var list = t[g], isCols = g === 'columns', can = canTemplates();
    return '<div class="between"><h3 style="font-size:16px">' + (isCols ? 'Reading columns' : 'Setup fields') + ' <span class="num muted">' + list.length + '</span> <span class="muted" style="font-size:13px;font-weight:400">· ' + (isCols ? 'filled at every reading' : 'filled once, at the start of the test') + '</span></h3>' + (can ? '<button type="button" class="dbtn sm" data-act="tcAdd" data-g="' + g + '">' + icon('plus', 14) + (isCols ? 'Add column' : 'Add setup field') + '</button>' : '') + '</div>' +
      '<div class="tablewrap"><table><thead><tr><th style="width:84px">Order</th><th>Name</th><th>Type</th><th>Unit</th><th>Choices (pick-list only)</th>' + (isCols ? '<th>On at start</th>' : '') + '<th></th></tr></thead><tbody>' +
      (list.map(function (c, i) {
        var at = ' data-g="' + g + '" data-i="' + i + '"';
        return '<tr><td><button type="button" class="dbtn sm" data-act="tcMove"' + at + ' data-d="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + icon('arrowUp', 14) + '</button> <button type="button" class="dbtn sm" data-act="tcMove"' + at + ' data-d="1" aria-label="Move down"' + (i < list.length - 1 ? '' : ' disabled') + '>' + icon('arrowDown', 14) + '</button></td><td><input class="din" style="width:100%;min-width:170px" data-tc="name"' + at + ' value="' + esc(c.name) + '" aria-label="Name" placeholder="' + (isCols ? 'Example: TE-1 BMC' : 'Example: Box volume') + '"></td><td><select class="din" data-tc="type"' + at + ' aria-label="Type">' + [['number', 'Number'], ['text', 'Text'], ['yesno', 'Yes/No'], ['pick', 'Pick-list']].map(function (x) { return '<option value="' + x[0] + '"' + (c.type === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></td><td><input class="din" style="width:90px" data-tc="unit"' + at + ' value="' + esc(c.unit || '') + '" aria-label="Unit" placeholder="' + (isCols ? '°C' : 'L') + '"' + (c.type === 'number' ? '' : ' disabled') + '></td><td><input class="din" style="width:100%;min-width:150px" data-tc="options"' + at + ' value="' + esc((c.options || []).join(', ')) + '" aria-label="Choices" placeholder="Off, Slow, Fast"' + (c.type === 'pick' ? '' : ' disabled') + '></td>' + (isCols ? '<td><input type="checkbox" data-tc="on"' + at + (c.on !== false ? ' checked' : '') + ' style="width:20px;height:20px" aria-label="On at start"></td>' : '') + '<td><button type="button" class="dbtn sm" data-act="tcDel"' + at + ' aria-label="Remove">' + icon('trash', 14) + '</button></td></tr>';
      }).join('') || '<tr><td colspan="7" class="muted">' + (isCols ? 'No columns yet.' : 'No setup fields. The test asks only for machine code, mode, interval and notes.') + '</td></tr>') + '</tbody></table></div>';
  }
  function templatesScreen() {
    if (!D.meta) return shell('<h1>Templates</h1><div class="panel">' + spin() + ' Loading…</div>', 'templates');
    var q = ui.tplSearch.toLowerCase(), can = canTemplates(), h = '<div class="between" style="flex-wrap:wrap"><h1>Templates <span class="num">' + D.templates.length + '</span></h1>' + (can ? '<button type="button" class="dbtn primary" data-act="tplNew">' + icon('plus', 18) + 'New template</button>' : '') + '</div>';
    if (!can) h += '<div class="msg">Only a reviewer or an engineer can change templates. You can look at them.</div>';
    var left = '<input class="din" data-in="tplSearch" placeholder="Search templates" value="' + esc(ui.tplSearch) + '" aria-label="Search templates">';
    D.products.forEach(function (p) {
      var list = D.templates.filter(function (t) { return t.product === p.id && (!q || t.name.toLowerCase().indexOf(q) >= 0); });
      left += '<div class="col" style="gap:6px"><button type="button" class="between dbtn" style="width:100%;' + (ui.prod === p.id ? 'border-color:var(--ink);border-width:2px' : '') + '" data-act="prodPick" data-id="' + esc(p.id) + '"><strong>' + esc(p.name) + '</strong><span class="num muted">' + list.length + ' templates · ' + p.modes.length + ' modes</span></button>' + list.map(function (t) { return '<button type="button" class="dbtn" style="width:100%;justify-content:space-between;' + (ui.tpl && ui.tpl.id === t.id ? 'background:var(--ink);color:var(--surface)' : '') + '" data-act="tplPick" data-id="' + esc(t.id) + '"><span>' + esc(t.name) + '</span><span class="num" style="opacity:.7;font-size:13px">' + T.readingColumns(t.columns).length + ' columns</span></button>'; }).join('') + '</div>';
    });
    if (can) left += '<div class="col" style="gap:6px"><label style="font-size:12px;font-weight:800" for="prod-new">Add a product</label><div class="row"><input class="din grow" id="prod-new" placeholder="Example: Ice bank"><button type="button" class="dbtn" data-act="prodAdd"' + (ui.busy ? ' disabled' : '') + '>' + icon('plus', 16) + 'Add</button></div></div>';
    var right = '';
    var pr = D.products.find(function (p) { return p.id === ui.prod; });
    if (pr && !ui.tpl) {
      right = '<div class="panel"><h2>Product · ' + esc(pr.name) + '</h2><p class="muted"><strong>Machine modes</strong> · one list for all ' + esc(pr.name) + ' templates. Engineers pick from this list in Setup. Each template only sets the default.</p><div class="chips">' + (ui.modes || pr.modes).map(function (m, i) { return '<span class="cchip">' + esc(m) + (can ? '<button type="button" style="border:0;background:transparent;padding:0;display:grid" data-act="modeDel" data-i="' + i + '" aria-label="Remove mode ' + esc(m) + '">' + icon('close', 14) + '</button>' : '') + '</span>'; }).join('') + '</div>' +
        (can ? '<div class="row"><input class="din grow" id="mode-new" placeholder="New mode. Example: Ice build"><button type="button" class="dbtn" data-act="modeAdd">' + icon('plus', 16) + 'Add mode</button><button type="button" class="dbtn primary" data-act="modesSave"' + (ui.busy ? ' disabled' : '') + '>Save modes</button></div>' : '') + '</div>';
    }
    if (ui.tpl) {
      var t = ui.tpl, tp = D.products.find(function (p) { return p.id === t.product; }) || { modes: [], name: t.product };
      var usedIn = (D.tests || []).filter(function (x) { return x.template_id === t.id; }).length;
      right = '<div class="panel"><div class="between"><h2>' + (t.isNew ? 'New template' : 'Edit template') + '</h2>' + (t.isNew ? '' : '<span class="muted" style="font-size:13px">' + (D.tests ? 'Used in <strong class="num">' + usedIn + '</strong> tests · ' : '') + 'Changes apply to <strong>new tests only</strong>. Old tests keep their own columns.</span>') + '</div>' +
        '<div class="filters"><label>Template name<input class="din" data-tp="name" value="' + esc(t.name) + '" placeholder="Example: BMC 1000 L · Cooling test"></label><label>Product<select class="din" data-tp="product">' + D.products.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === t.product ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label><label>Default mode · from ' + esc(tp.name) + ' modes<select class="din" data-tp="default_mode"><option value="">No default</option>' + tp.modes.map(function (m) { return '<option' + (m === t.default_mode ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select></label></div>' +
        '<label class="row" style="font-weight:700"><input type="checkbox" data-tp="track_compressor"' + (t.track_compressor ? ' checked' : '') + ' style="width:20px;height:20px"> Track compressor ON/OFF <span class="muted" style="font-weight:400">· On: a big ON/OFF button while recording, and on-time worked out from the taps.</span></label>' +
        colTable(t, 'setup') + colTable(t, 'columns') +
        (can ? '<div class="between"><span></span><div class="row">' + (t.isNew ? '' : '<button type="button" class="dbtn" data-act="tplRemove">' + icon('trash', 16) + 'Remove template</button>') + '<button type="button" class="dbtn" data-act="tplCancel">Cancel</button><button type="button" class="dbtn primary" data-act="tplSave"' + (ui.busy ? ' disabled' : '') + '>Save template</button></div></div>' : '') +
        (t.updated_by ? '<span class="muted" style="font-size:13px">Last changed by ' + esc(name(t.updated_by)) + ' · <span class="num">' + esc(U.dmy(t.updated_at)) + '</span></span>' : '') + '</div>';
    }
    if (!right) right = '<div class="panel muted">Pick a template to change it, or pick a product to change its machine modes.</div>';
    return shell(h + '<div style="display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:20px;align-items:start"><div class="col" style="gap:14px">' + left + '</div>' + right + '</div>', 'templates');
  }

  /* ---------- people ---------- */
  function peopleScreen() {
    if (!D.meta) return shell('<h1>People</h1><div class="panel">' + spin() + ' Loading…</div>', 'people', true);
    var can = reviewer(), active = D.people.filter(function (p) { return p.active; }), removed = D.people.filter(function (p) { return !p.active; });
    var h = '<div class="col" style="gap:4px"><h1>People <span class="num">' + active.length + '</span></h1><p class="muted">These people can sign in on the phone and on the computer. Each person has a username and a password that you give.</p></div>';
    if (!can) h += '<div class="msg">Only a reviewer can add or remove people.</div>';
    if (can) h += '<section class="panel"><h2 style="font-size:16px">Add a person</h2><div class="filters"><label>Name<input class="din" id="p-name" placeholder="Example: Krupal"></label><label>Username<input class="din" id="p-user" placeholder="Example: krupal" autocapitalize="none"></label><label>Password (6 or more letters)<input class="din" id="p-pass" placeholder="Example: Cool#2026"></label><label>Role<select class="din" id="p-role"><option value="technician">Technician · records tests</option><option value="engineer">Engineer · records tests, adds and changes templates</option><option value="reviewer">Reviewer · everything, also people and reviewer notes</option></select></label></div><div class="row"><button type="button" class="dbtn primary" data-act="personAdd"' + (ui.busy ? ' disabled' : '') + '>' + icon('plus', 18) + 'Add person</button><span class="muted" style="font-size:13px">New names show on every phone after its next sync. Tell the person their username and password.</span></div></section>';
    h += '<div class="tablewrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th class="r">Tests started</th><th>Last active</th><th>Added on</th><th></th></tr></thead><tbody>' + active.map(function (p) {
      var row = '<tr><td><span class="row"><span class="avatar sm">' + esc(U.initials(p.name)) + '</span><strong>' + esc(p.name) + '</strong></span></td><td class="num">' + esc(p.username) + '</td><td>' + (can && p.username !== S().current ? '<select class="din" style="height:36px" data-role="' + esc(p.username) + '" aria-label="Role of ' + esc(p.name) + '">' + ['technician', 'engineer', 'reviewer'].map(function (x) { return '<option value="' + x + '"' + ((p.role === x || (x === 'technician' && !/^(reviewer|engineer)$/.test(p.role))) ? ' selected' : '') + '>' + T.roleName(x) + '</option>'; }).join('') + '</select>' : T.roleName(p.role)) + '</td><td class="r num" style="font-weight:700">' + p.tests + '</td><td class="num">' + (p.last_active ? esc(U.dmyhm(p.last_active)) : '<span class="muted">Never</span>') + '</td><td class="num muted">' + esc(U.dmy(p.added_at)) + '</td><td style="text-align:right;white-space:nowrap">' + (can ? '<button type="button" class="dbtn sm" data-act="passOpen" data-u="' + esc(p.username) + '">New password</button> ' + (p.username === S().current ? '' : '<button type="button" class="dbtn sm" data-act="removeAsk" data-u="' + esc(p.username) + '">' + icon('trash', 14) + 'Remove</button>') : '') + '</td></tr>';
      if (ui.confirm === p.username) row += '<tr><td colspan="7"><div class="between msg" role="alertdialog"><span><strong>Remove ' + esc(p.name) + '?</strong> ' + esc(p.name) + ' can no longer sign in. Old tests and notes stay.</span><span class="row"><button type="button" class="dbtn sm" data-act="removeCancel">Cancel</button><button type="button" class="dbtn sm bad" data-act="personRemove" data-u="' + esc(p.username) + '">Yes, remove</button></span></div></td></tr>';
      if (ui.newPass[p.username] !== undefined) row += '<tr><td colspan="7"><div class="row"><label class="row" style="font-weight:700">New password for ' + esc(p.name) + '<input class="din" id="np-' + esc(p.username) + '" placeholder="6 or more letters"></label><button type="button" class="dbtn sm primary" data-act="passSave" data-u="' + esc(p.username) + '">Save password</button><button type="button" class="dbtn sm" data-act="passCancel" data-u="' + esc(p.username) + '">Cancel</button><span class="muted" style="font-size:13px">' + esc(p.name) + ' must sign in again on every phone.</span></div></td></tr>';
      return row;
    }).join('') + '</tbody></table></div>';
    h += '<section class="col" style="gap:10px"><div><h2>Phones <span class="num muted" style="font-size:16px">' + D.phones.length + '</span></h2><p class="muted">Each phone has a code. The code is part of every Test ID made on that phone. Example: <strong class="num" style="color:var(--ink)">T-261011-A3-02</strong> is the 2nd test made on phone <strong class="num" style="color:var(--ink)">A3</strong> on 11 Oct 2026.</p></div><div class="tablewrap"><table><thead><tr><th>Phone code</th><th>Last used by</th><th>Last used</th><th class="r">Tests made</th></tr></thead><tbody>' + (D.phones.map(function (p) { return '<tr><td><span class="num" style="display:inline-grid;place-items:center;min-width:44px;height:30px;padding:0 8px;border-radius:8px;background:var(--ink);color:var(--surface);font-weight:700">' + esc(p.code) + '</span></td><td><strong>' + esc(name(p.last_user)) + '</strong></td><td class="num">' + esc(U.dmyhm(p.last_used)) + '</td><td class="r num" style="font-weight:700">' + p.tests_made + '</td></tr>'; }).join('') || '<tr><td colspan="4" class="muted">No phone has signed in yet.</td></tr>') + '</tbody></table></div></section>';
    if (removed.length) h += '<section class="col" style="gap:8px"><h2 style="font-size:15px" class="muted">Removed · ' + removed.length + '</h2>' + removed.map(function (p) { return '<div class="between" style="padding:10px 16px;border-radius:12px;border:1px dashed var(--line-2)"><span class="row muted"><span class="avatar sm">' + esc(U.initials(p.name)) + '</span><span><strong style="color:var(--ink)">' + esc(p.name) + '</strong> · removed <span class="num">' + esc(U.dmy(p.removed_at)) + '</span> · ' + p.tests + ' tests kept</span></span>' + (can ? '<button type="button" class="dbtn sm" data-act="personRestore" data-u="' + esc(p.username) + '">Add back</button>' : '') + '</div>'; }).join('') + '</section>';
    return shell(h, 'people', true);
  }

  /* ---------- select tests: compare 2, delete many (build 13) ---------- */
  function selIds() { return Object.keys(ui.sel || {}).filter(function (k) { return ui.sel[k]; }); }
  function selBar() {
    var ids = selIds(); if (!ids.length) return '';
    var h = '<section class="panel noprint" style="border-color:var(--ink)"><div class="between" style="flex-wrap:wrap"><strong><span class="num">' + ids.length + '</span> selected</strong><div class="row" style="flex-wrap:wrap">' +
      '<button type="button" class="dbtn primary" data-act="cmpOpen"' + (ids.length === 2 ? '' : ' disabled') + '>' + 'Compare 2 tests</button>' +
      (reviewer() ? '<button type="button" class="dbtn bad" data-act="bulkAsk">' + icon('trash', 18) + 'Delete selected</button>' : '') +
      '<button type="button" class="dbtn" data-act="selClear">' + icon('close', 16) + 'Clear</button></div></div>';
    if (ui.bulkOpen && reviewer()) h += '<label class="col" style="gap:4px;font-weight:800;font-size:13px">Reason · one reason for all ' + ids.length + ' tests<textarea class="din" id="bulk-reason" placeholder="Example: Trial entries made during training."></textarea></label><div class="num muted" style="font-size:13px">' + esc(ids.join(', ')) + '</div><div class="row"><button type="button" class="dbtn bad" data-act="bulkDo"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? spin() : icon('trash', 16)) + 'Yes, delete ' + ids.length + ' tests</button><button type="button" class="dbtn" data-act="bulkAsk">No, go back</button></div>';
    return h + '</section>';
  }
  function covChip(t) { var c = T.coverage(t); return c ? '<span class="status"' + (c === 'partial' ? ' style="background:var(--mark-soft);border-color:var(--mark)"' : '') + '>' + T.coverageName(c) + '</span>' : ''; }

  /* ---------- compare 2 tests on one graph (build 13) ---------- */
  function colKey(c) { return (c.name + '|' + (c.unit || '')).toLowerCase(); }
  /** The hour at which a line first reaches the value v. Straight line between two readings. null if never. */
  function crossAt(pts, v) {
    for (var i = 0; i < pts.length; i++) {
      if (pts[i].y === v) return pts[i].x;
      if (i && (pts[i - 1].y - v) * (pts[i].y - v) < 0) return pts[i - 1].x + (v - pts[i - 1].y) / (pts[i].y - pts[i - 1].y) * (pts[i].x - pts[i - 1].x);
    }
    return null;
  }
  /** The value of a line at the hour x. null outside the readings. */
  function valueAt(pts, x) {
    for (var i = 0; i < pts.length; i++) {
      if (Math.abs(pts[i].x - x) < 1e-9) return pts[i].y;
      if (i && pts[i - 1].x < x && x < pts[i].x) return pts[i - 1].y + (x - pts[i - 1].x) / (pts[i].x - pts[i - 1].x) * (pts[i].y - pts[i - 1].y);
    }
    return null;
  }
  function cmpSide(k) {
    var b = D.cmp[k], cols = numCols(b), c = cols.find(function (x) { return x.id === ui.cmp['col' + k]; }) || null;
    return { k: k, b: b, t: b.test, cols: cols, col: c, pts: c ? points(b, c) : [], off: Number(ui.cmp['off' + k]) || 0, color: k === 'A' ? '--s1' : '--s2' };
  }
  function cmpDefaults() {
    var a = numCols(D.cmp.A), b = numCols(D.cmp.B), pick = a.find(function (c) { return /°c/i.test(c.unit) && b.some(function (x) { return colKey(x) === colKey(c); }); }) || a.find(function (c) { return b.some(function (x) { return colKey(x) === colKey(c); }); }) || a[0];
    ui.cmp = { colA: pick ? pick.id : '', colB: '', offA: 0, offB: 0 };
    cmpFollow();
  }
  function cmpFollow() {   // test B takes the column with the same name and unit as test A, when it has one
    var a = numCols(D.cmp.A).find(function (c) { return c.id === ui.cmp.colA; }), b = numCols(D.cmp.B), m = a && b.find(function (x) { return colKey(x) === colKey(a); });
    ui.cmp.colB = m ? m.id : (b.some(function (x) { return x.id === ui.cmp.colB; }) ? ui.cmp.colB : (b[0] || {}).id || '');
  }
  function cmpChart(A, B) {
    var W = 1000, H = 360, L = 56, R = 16, Tp = 12, Bm = 34, sides = [A, B].map(function (s) { return { s: s, pts: s.pts.map(function (p) { return { x: p.x + s.off, y: p.y, r: p.r }; }) }; });
    var all = sides.reduce(function (m, s) { return m.concat(s.pts); }, []);
    if (!all.length) return '<p class="muted">No numbers to plot.</p>';
    var xmax = Math.max(0.1, Math.max.apply(null, all.map(function (p) { return p.x; }))), xmin = Math.min(0, Math.min.apply(null, all.map(function (p) { return p.x; })));
    var ymin = Math.min.apply(null, all.map(function (p) { return p.y; })), ymax = Math.max.apply(null, all.map(function (p) { return p.y; }));
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    var ys = niceStep(ymax - ymin, 6); ymin = Math.floor(ymin / ys) * ys; ymax = Math.ceil(ymax / ys) * ys;
    var xs = niceStep(xmax - xmin, 8);
    var X = function (x) { return L + ((x - xmin) / (xmax - xmin)) * (W - L - R); }, Y = function (y) { return Tp + (1 - (y - ymin) / (ymax - ymin)) * (H - Tp - Bm); }, g = '';
    for (var y = ymin; y <= ymax + ys / 2; y += ys) g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(y).toFixed(1) + '" y2="' + Y(y).toFixed(1) + '" stroke="var(--grid)"/><text x="' + (L - 8) + '" y="' + (Y(y) + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="var(--ink-2)" font-family="var(--mono)">' + (+y.toFixed(6)) + '</text>';
    for (var x = Math.ceil(xmin / xs) * xs; x <= xmax + 1e-9; x += xs) g += '<line x1="' + X(x).toFixed(1) + '" x2="' + X(x).toFixed(1) + '" y1="' + (H - Bm) + '" y2="' + (H - Bm + 5) + '" stroke="var(--axis)"/><text x="' + X(x).toFixed(1) + '" y="' + (H - Bm + 20) + '" text-anchor="middle" font-size="12" fill="var(--ink-2)" font-family="var(--mono)">' + (+x.toFixed(2)) + '</text>';
    g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - Bm) + '" y2="' + (H - Bm) + '" stroke="var(--axis)"/>';
    sides.forEach(function (sd) {
      var col = 'var(' + sd.s.color + ')';
      g += '<polyline fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round"' + (sd.s.k === 'B' ? ' stroke-dasharray="9 5"' : '') + ' points="' + sd.pts.map(function (p) { return X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1); }).join(' ') + '"/>';
      g += sd.pts.map(function (p) { return '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="4" fill="' + col + '"><title>' + esc(sd.s.t.test_id + ' · ' + fmt(p.x) + ' h · ' + U.hhmm(p.r.time) + ' · ' + p.y + (sd.s.col.unit ? ' ' + sd.s.col.unit : '')) + '</title></circle>'; }).join('');
    });
    var legend = '<div class="chips" style="margin-bottom:6px">' + [A, B].map(function (s) { return '<span class="row" style="gap:6px;font-size:13px;font-weight:700"><i style="width:22px;height:0;border-top:4px ' + (s.k === 'B' ? 'dashed' : 'solid') + ' var(' + s.color + ');display:inline-block"></i>' + s.k + ' · ' + esc(s.t.test_id) + ' · ' + esc(T.imp.head(s.col)) + (s.off ? ' · starts at ' + fmt(s.off) + ' h' : '') + '</span>'; }).join('') + '</div>';
    return '<div class="chart" data-chart="cmp" data-xmax="' + xmax + '">' + legend + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Line graph comparing two tests against hours">' + g + '<line class="cross" x1="0" x2="0" y1="0" y2="0" visibility="hidden"/></svg><div class="muted" style="text-align:center;font-size:12px;font-weight:700">Hours</div></div>';
  }
  function compareScreen() {
    var p = parts(), back = '<a class="dbtn sm noprint" href="#/tests" style="align-self:flex-start">' + icon('back', 16) + 'All tests</a><h1>Compare 2 tests</h1>';
    if (!D.cmp || D.cmp.A.test.test_id !== p[1] || D.cmp.B.test.test_id !== p[2]) return shell(back + '<div class="panel">' + spin() + ' Loading the 2 tests…</div>', 'tests');
    if (!ui.cmp) cmpDefaults();
    var A = cmpSide('A'), B = cmpSide('B'), h = back;
    var side = function (s) {
      return '<div class="panel" style="border-top:5px solid var(' + s.color + ')"><div class="row" style="flex-wrap:wrap"><strong class="num" style="font-size:20px">' + s.k + ' · ' + esc(s.t.test_id) + '</strong>' + covChip(s.t) + '<a class="dbtn sm noprint" href="#/t/' + encodeURIComponent(s.t.test_id) + '">Open report</a></div><span class="muted">' + esc(s.t.product) + ' · ' + esc(s.t.template_name) + ' · Machine <strong class="num" style="color:var(--ink)">' + esc(s.t.machine_code || '-') + '</strong> · Mode <strong style="color:var(--ink)">' + esc(s.t.mode || '-') + '</strong> · <span class="num">' + esc(U.dmyhm(T.startOf(s.b))) + '</span></span>' +
        '<div class="row noprint" style="flex-wrap:wrap;align-items:flex-end"><label class="col" style="gap:4px;font-weight:700;font-size:13px">Column<select class="din" data-in="cmpCol' + s.k + '" style="min-width:200px">' + s.cols.map(function (c) { return '<option value="' + esc(c.id) + '"' + (s.col && c.id === s.col.id ? ' selected' : '') + '>' + esc(T.imp.head(c)) + '</option>'; }).join('') + '</select></label>' +
        '<label class="col" style="gap:4px;font-weight:700;font-size:13px">This test starts at (h)<input class="din num" type="number" step="0.01" data-in="cmpOff' + s.k + '" value="' + (+s.off.toFixed(2)) + '" style="width:150px"></label></div></div>';
    };
    h += '<section class="two">' + side(A) + side(B) + '</section>';
    if (!A.col || !B.col) return shell(h + '<div class="panel">One of the tests has no number column.</div>', 'tests');
    h += '<section class="panel noprint"><div class="row" style="flex-wrap:wrap"><button type="button" class="dbtn primary" data-act="cmpMatch">' + icon('swap', 18) + 'Match starting point</button><button type="button" class="dbtn" data-act="cmpReset">Both start at 0 h</button><button type="button" class="dbtn" data-act="pdf">' + icon('pdf', 18) + 'Export PDF</button>' + (ui.cmp.note ? '<span class="muted">' + esc(ui.cmp.note) + '</span>' : '') + '</div></section>';
    h += '<section class="panel"><h2>Graph</h2>' + cmpChart(A, B) + '</section>';

    // --- numbers side by side
    var st = function (s) {
      var en = T.energy(s.b), end = s.t.ended_at || U.localISO(), comp = s.t.comp_on_min !== null && s.t.comp_on_min !== undefined ? s.t.comp_on_min : (s.t.track_compressor ? T.compressor(s.b, end).totalMin : null), f = s.pts[0], l = s.pts[s.pts.length - 1], u = s.col.unit ? ' ' + s.col.unit : '';
      return { 'Test type': T.coverageName(T.coverage(s.t)) || 'Not marked', 'Readings': T.usedReadings(s.b).length, 'Total time': U.dur(U.minsBetween(T.startOf(s.b), end)), 'Starts at': fmt(s.off) + ' h', 'Ends at': l ? fmt(l.x + s.off) + ' h' : '-',
        'Start value': f ? f.y + u : '-', 'End value': l ? l.y + u : '-', 'Rate of change': f && l && l.x > f.x ? fmt((l.y - f.y) / (l.x - f.x)) + u + ' per hour' : '-', 'Total energy': en && en.total !== null ? fmt(en.total) + ' kWh' : '-', 'Compressor on-time': comp === null ? '-' : U.dur(comp) };
    }, sa = st(A), sb = st(B);
    h += '<section class="panel"><h2>Numbers</h2><div class="tablewrap" style="border:0"><table><thead><tr><th></th><th>A · <span class="num">' + esc(A.t.test_id) + '</span></th><th>B · <span class="num">' + esc(B.t.test_id) + '</span></th></tr></thead><tbody>' + Object.keys(sa).map(function (k) { return '<tr><td><strong>' + k + '</strong></td><td class="num">' + esc(sa[k]) + '</td><td class="num">' + esc(sb[k]) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';

    // --- the same range in both tests: from one value to another value
    var ys = function (s) { return s.pts.map(function (q) { return q.y; }); }, lo = Math.max(Math.min.apply(null, ys(A)), Math.min.apply(null, ys(B))), hi = Math.min(Math.max.apply(null, ys(A)), Math.max.apply(null, ys(B)));
    if (A.pts.length > 1 && B.pts.length > 1 && hi > lo && colKey(A.col) === colKey(B.col)) {
      var falling = A.pts[0].y > A.pts[A.pts.length - 1].y, from = falling ? hi : lo, to = falling ? lo : hi, u2 = A.col.unit ? ' ' + A.col.unit : '';
      var span = function (s) {
        var x1 = crossAt(s.pts, from), x2 = crossAt(s.pts, to); if (x1 === null || x2 === null) return null;
        var en = T.energy(s.b), e = null;
        if (en) { var ep = points(s.b, en.col), e1 = valueAt(ep, x1), e2 = valueAt(ep, x2); if (e1 !== null && e2 !== null) e = Math.abs(e2 - e1); }
        return { h: Math.abs(x2 - x1), e: e };
      }, ra = span(A), rb = span(B);
      if (ra && rb) {
        var diff = function (a, b, d, unit) { return a === null || b === null ? '-' : (Math.abs(a - b) < 1e-9 ? 'Same' : (a < b ? 'A' : 'B') + ' is lower by ' + fmt(Math.abs(a - b), d) + unit + (Math.max(a, b) ? ' (' + fmt(Math.abs(a - b) / Math.max(a, b) * 100, 0) + '%)' : '')); };
        h += '<section class="panel"><h2>Same range · ' + esc(A.col.name) + ' from <span class="num">' + (+from.toFixed(2)) + '</span> to <span class="num">' + (+to.toFixed(2)) + esc(u2) + '</span></h2><div class="tablewrap" style="border:0"><table><thead><tr><th></th><th>A · <span class="num">' + esc(A.t.test_id) + '</span></th><th>B · <span class="num">' + esc(B.t.test_id) + '</span></th><th>Difference</th></tr></thead><tbody>' +
          '<tr><td><strong>Time taken</strong></td><td class="num">' + fmt(ra.h) + ' h</td><td class="num">' + fmt(rb.h) + ' h</td><td>' + diff(ra.h, rb.h, 2, ' h') + '</td></tr>' +
          '<tr><td><strong>Energy used</strong></td><td class="num">' + (ra.e === null ? '-' : fmt(ra.e) + ' kWh') + '</td><td class="num">' + (rb.e === null ? '-' : fmt(rb.e) + ' kWh') + '</td><td>' + diff(ra.e, rb.e, 2, ' kWh') + '</td></tr></tbody></table></div></section>';
      }
    }
    return shell(h, 'tests');
  }

  /* ---------- import one old test from an Excel file (build 12) ---------- */
  function saveAs(buf, fileName) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  function issueTable(list, title, cls) {
    return '<div class="panel"' + (cls ? ' style="border-color:var(--' + cls + ')"' : '') + '><h2 style="font-size:16px">' + title + ' <span class="num">' + list.length + '</span></h2><div class="tablewrap" style="border:0"><table><thead><tr><th style="width:34%">Where</th><th>What</th></tr></thead><tbody>' +
      list.map(function (e) { return '<tr><td class="num">' + esc(e.where) + '</td><td>' + esc(e.msg) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
  }
  function importScreen() {
    var back = '<a class="dbtn sm noprint" href="#/tests" style="align-self:flex-start">' + icon('back', 16) + 'All tests</a><h1>Import test from Excel</h1>';
    if (!canTemplates()) return shell(back + '<div class="panel">Only a reviewer or an engineer can import a test.</div>', 'tests');
    if (!D.tests) return shell(back + '<div class="panel">' + spin() + ' Loading…</div>', 'tests');
    if (!ui.impTpl || !D.templates.some(function (t) { return t.id === ui.impTpl; })) ui.impTpl = (D.templates[0] || {}).id || '';
    var h = back, r = ui.imp;
    h += '<section class="panel"><h2 style="font-size:16px">1. Blank Excel format</h2><div class="row" style="flex-wrap:wrap;align-items:flex-end"><label class="col" style="gap:4px;font-weight:700;font-size:13px">Template<select class="din" data-in="impTpl" style="min-width:280px">' + D.templates.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === ui.impTpl ? ' selected' : '') + '>' + esc(t.product + ' · ' + t.name) + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="dbtn" data-act="impBlank"' + (ui.impTpl ? '' : ' disabled') + '>' + icon('download', 18) + 'Download blank Excel format</button></div></section>';
    h += '<section class="panel"><h2 style="font-size:16px">2. Filled Excel file · one file is one test</h2><input type="file" id="imp-file" accept=".xlsx" class="din" style="max-width:520px;height:auto;padding:10px">' + (ui.impBusy === 'check' ? '<div class="row">' + spin() + ' Checking the file…</div>' : '') + '</section>';
    if (r) {
      var ok = !r.errors.length;
      h += '<section class="panel" style="border-color:var(--' + (ok ? 'ok' : 'bad') + ')"><h2 style="font-size:16px">3. Check result · <span class="num">' + esc(r.fileName) + '</span></h2><div class="msg' + (ok ? ' ok' : '') + '" role="status">' + (ok ? 'No errors. ' + r.readings.length + ' readings are ready to import.' + (r.warnings.length ? ' Read the ' + r.warnings.length + ' warning(s) first.' : '') : r.errors.length + ' error(s). Nothing was imported. Correct the file and choose it again.') + '</div>';
      if (ok) {
        var t = r.test, cols = T.readingColumns(t.columns).filter(function (c) { return c.on !== false; }), filled = {}; r.readings.forEach(function (x) { Object.keys(x.values).forEach(function (k) { filled[k] = (filled[k] || 0) + 1; }); });
        var sf = T.setupFields(t.columns, t.product).filter(function (f) { return t.setup[f.id]; }).map(function (f) { return [f.name, t.setup[f.id] + (f.unit ? ' ' + f.unit : '')]; });
        var kv = [['New Test ID', t.test_id], ['Template', t.product + ' · ' + t.template_name], ['Machine name/code', t.machine_code], ['Machine mode', t.mode], ['Start', U.dmyhm(t.started_at)], ['End', U.dmyhm(r.finish.ended_at)], ['Readings', r.readings.length], ['Reading interval', t.interval_min ? t.interval_min + ' min' : '']].concat(sf).concat([['Compressor on-time', r.finish.comp_on_min === null ? '' : r.finish.comp_on_min + ' min'], ['Compressor events', r.events.length || ''], ['Setup notes', t.setup.notes], ['Final remarks', r.finish.final_remarks], ['Recorded by', T.me().name], ['After import', 'Finished · Locked']]);
        h += '<div class="kv">' + kv.map(function (x) { return '<span>' + esc(x[0]) + '</span><span>' + (x[1] !== '' && x[1] !== undefined && x[1] !== null ? esc(x[1]) : '<span class="muted">-</span>') + '</span>'; }).join('') + '</div>';
        h += '<div class="row"><button type="button" class="dbtn primary" data-act="impDo"' + (ui.impBusy ? ' disabled' : '') + '>' + (ui.impBusy === 'send' ? spin() : icon('check', 18)) + 'Import this test</button><button type="button" class="dbtn" data-act="impClear"' + (ui.impBusy ? ' disabled' : '') + '>Cancel</button>' + (ui.impBusy === 'send' ? '<span class="muted num">' + (ui.impSent || 0) + ' of ' + r.ops.length + ' sent</span>' : '') + '</div>';
        h += '</section>';
        if (r.warnings.length) h += issueTable(r.warnings, 'Warnings', 'warn');
        h += '<div class="panel"><h2 style="font-size:16px">Readings as they will be saved <span class="num">' + r.readings.length + '</span></h2><div class="tablewrap" style="max-height:520px;overflow:auto"><table><thead><tr><th class="r">No.</th><th>Time</th>' + cols.map(function (c) { return '<th class="r">' + esc(T.imp.head(c)) + '<br><span class="muted num" style="font-weight:400">' + (filled[c.id] || 0) + ' filled</span></th>'; }).join('') + '<th>Note</th></tr></thead><tbody>' +
          r.readings.map(function (x, i) { return '<tr><td class="r num">' + (i + 1) + '</td><td class="num" style="white-space:nowrap">' + esc(x.time.slice(0, 10) === t.date ? U.hhmm(x.time) : U.dmyhm(x.time)) + '</td>' + cols.map(function (c) { return '<td class="r num">' + (x.values[c.id] === undefined ? '' : esc(x.values[c.id])) + '</td>'; }).join('') + '<td>' + esc(x.note) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      } else {
        h += '</section>' + issueTable(r.errors, 'Errors', 'bad');
        if (r.warnings.length) h += issueTable(r.warnings, 'Warnings', 'warn');
      }
    }
    return shell(h, 'tests');
  }
  function impSend(ops, from) {
    var part = ops.slice(from, from + 200);
    if (!part.length) return Promise.resolve();
    return call('sync', { phone: 'XL', nopull: true, ops: part }).then(function (res) {
      if (res.rejected && res.rejected.length) throw new Error(res.rejected[0].error);
      ui.impSent = from + part.length; render();
      return impSend(ops, from + 200);
    });
  }

  /* ---------- render and events ---------- */
  function render() {
    var st = S(), p = parts(), html;
    var y = window.scrollY, act = document.activeElement, fid = act && act.id, fsel = act && act.dataset && (act.dataset.f ? '[data-f="' + act.dataset.f + '"]' : act.dataset.in ? '[data-in="' + act.dataset.in + '"]' : null), pos = act && act.selectionStart;
    if (!st.current || !T.me()) html = loginScreen();
    else if (p[0] === 't' && p[1]) html = reportScreen();
    else if (p[0] === 'templates') html = templatesScreen();
    else if (p[0] === 'people') html = peopleScreen();
    else if (p[0] === 'import') html = importScreen();
    else if (p[0] === 'compare' && p[1] && p[2]) html = compareScreen();
    else html = testsScreen();
    root.innerHTML = '<div class="fz dk">' + html + '</div>';
    window.scrollTo(0, y);
    var f = fid ? document.getElementById(fid) : fsel ? root.querySelector(fsel) : null;
    if (f) { f.focus(); try { if (pos !== null && f.setSelectionRange && /text|search/.test(f.type)) f.setSelectionRange(pos, pos); } catch (e) {} }
    root.querySelectorAll('.dthumb[data-photo-id]').forEach(function (el) { T.photoSrc(el.dataset.photoId).then(function (src) { if (el.isConnected) el.innerHTML = '<img alt="" src="' + src + '">'; }).catch(function () {}); });
    var big = document.getElementById('viewer-img');
    if (big) T.photoSrc(ui.viewer).then(function (src) { if (!big.isConnected) return; big.innerHTML = '<img alt="Photo" src="' + src + '">'; var a = document.getElementById('viewer-dl'); if (a) a.href = src; }).catch(function (e) { if (big.isConnected) big.textContent = 'Could not load this photo. ' + e.message; });
  }
  function reload() { var p = parts(); if (p[0] === 't') { return call('getTest', { test_id: p[1] }).then(function (r) { D.bundle = r.bundle; D.tests = null; render(); }, fail); } D.meta = false; D.tests = p[0] === 'tests' || !p[0] ? D.tests : null; return load(); }
  function tplRead() { return ui.tpl; }
  var actions = {
    signOut: function () { T.api('logout', { token: T.me().token }).catch(function () {}); T.signOut(); D.tests = null; D.bundle = null; render(); },
    refresh: function () { D.tests = parts()[0] === 't' ? D.tests : null; reload(); },
    clearFilters: function () { ui.filters = {}; ui.page = 0; render(); },
    page: function (el) { ui.page += Number(el.dataset.d); render(); window.scrollTo(0, 0); },
    openTest: function (el) { go('t/' + encodeURIComponent(el.dataset.id)); },
    delToggle: function () { ui.delOpen = !ui.delOpen; render(); },
    delDo: function () {
      var reason = document.getElementById('del-reason').value.trim(), now = U.localISO();
      if (!reason) { ui.err = 'Write the reason first.'; return render(); }
      push('test.delete', { test_id: D.bundle.test.test_id, reason: reason, time: now, event_id: U.uid() }).then(function () { ui.delOpen = false; ui.msg = 'Test deleted. It shows under Status, Deleted.'; D.tests = null; D.bundle = null; go('tests'); }, function () {
        if (/Unknown change/.test(ui.err)) { ui.err = 'The Google script is old. Update it first, then delete.'; render(); }
      });
    },
    exportToggle: function () { ui.exportOpen = !ui.exportOpen; render(); },
    backup: function () {
      ui.backing = true; ui.err = ''; render();
      call('backup').then(backupExcel).then(function () { ui.backing = false; ui.msg = 'Backup saved to your Downloads folder.'; render(); }, function (e) {
        ui.backing = false; ui.err = /Unknown action/.test(e.message) ? 'The Google script is old. Update it first, then back up.' : 'Backup failed. ' + e.message; render();
      });
    },
    impBlank: function () {
      var tpl = D.templates.find(function (t) { return t.id === ui.impTpl; }), product = D.products.find(function (p) { return p.id === tpl.product; });
      T.imp.blank(tpl, product).then(function (buf) { saveAs(buf, 'Test_Log_import_format_' + (tpl.product + '_' + tpl.name).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.xlsx'); }, function (e) { ui.err = 'Could not make the file. ' + e.message; render(); });
    },
    impClear: function () { ui.imp = null; render(); },
    impDo: function () {
      var r = ui.imp; if (!r || r.errors.length || ui.impBusy) return;
      ui.impBusy = 'send'; ui.impSent = 0; ui.err = ''; render();
      impSend(r.ops, 0).then(function () { ui.impBusy = false; ui.imp = null; D.tests = null; D.bundle = null; ui.msg = 'Test imported. It is finished and locked.'; go('t/' + encodeURIComponent(r.test.test_id)); }, function (e) {
        ui.impBusy = false; ui.err = 'Import stopped. ' + e.message + ' Press Import again to send the rest.'; render();
      });
    },
    selToggle: function (el) { ui.sel = ui.sel || {}; ui.sel[el.dataset.id] = !ui.sel[el.dataset.id]; ui.bulkOpen = false; render(); },
    selPage: function () { ui.sel = ui.sel || {}; var rows = filtered().slice(ui.page * PER_PAGE, (ui.page + 1) * PER_PAGE), all = rows.every(function (t) { return ui.sel[t.test_id]; }); rows.forEach(function (t) { ui.sel[t.test_id] = !all; }); ui.bulkOpen = false; render(); },
    selClear: function () { ui.sel = {}; ui.bulkOpen = false; render(); },
    cmpOpen: function () { var ids = selIds(); if (ids.length === 2) go('compare/' + encodeURIComponent(ids[0]) + '/' + encodeURIComponent(ids[1])); },
    bulkAsk: function () { ui.bulkOpen = !ui.bulkOpen; render(); },
    bulkDo: function () {
      var reason = document.getElementById('bulk-reason').value.trim(), now = U.localISO(), ids = selIds();
      if (!reason) { ui.err = 'Write the reason first.'; return render(); }
      var ops = ids.map(function (id) { return { op_id: U.uid(), type: 'test.delete', payload: { test_id: id, reason: reason, time: now, event_id: U.uid() } }; }), bad = [];
      var send = function (from) {
        var part = ops.slice(from, from + 50); if (!part.length) return Promise.resolve();
        return call('sync', { nopull: true, ops: part }).then(function (r) { bad = bad.concat(r.rejected || []); return send(from + 50); });
      };
      ui.busy = true; ui.err = ''; render();
      send(0).then(function () {
        ui.busy = false; ui.bulkOpen = false; ui.sel = {}; D.tests = null;
        if (bad.length) ui.err = bad.length + ' of ' + ids.length + ' tests were not deleted. ' + bad[0].error; else ui.msg = ids.length + ' tests deleted. They show under Status, Deleted.';
        load();
      }, function (e) { ui.busy = false; ui.err = 'Delete stopped. ' + e.message; D.tests = null; load(); });
    },
    mark: function (el) {
      var t = D.bundle.test, v = T.coverage(t) === el.dataset.v ? '' : el.dataset.v;
      push('test.mark', { test_id: t.test_id, coverage: v, time: U.localISO(), event_id: U.uid() }).then(function () { ui.msg = v ? 'Marked as ' + T.coverageName(v) + '.' : 'Mark removed.'; return reload(); }, function () {
        if (/Unknown change/.test(ui.err)) { ui.err = 'The Google script is old. Update it first, then mark the test.'; render(); }
      });
    },
    cmpReset: function () { ui.cmp.offA = 0; ui.cmp.offB = 0; ui.cmp.note = ''; render(); },
    cmpMatch: function () {
      var A = cmpSide('A'), B = cmpSide('B'), x;
      if (!A.pts.length || !B.pts.length) return;
      // The test that starts midway is moved: its first value is put on the line of the other test.
      if ((x = crossAt(A.pts, B.pts[0].y)) !== null && x > 0) { ui.cmp.offA = 0; ui.cmp.offB = +x.toFixed(2); ui.cmp.note = 'B starts at ' + B.pts[0].y + '. A reaches ' + B.pts[0].y + ' at ' + fmt(x) + ' h.'; }
      else if ((x = crossAt(B.pts, A.pts[0].y)) !== null && x > 0) { ui.cmp.offB = 0; ui.cmp.offA = +x.toFixed(2); ui.cmp.note = 'A starts at ' + A.pts[0].y + '. B reaches ' + A.pts[0].y + ' at ' + fmt(x) + ' h.'; }
      else { ui.cmp.offA = 0; ui.cmp.offB = 0; ui.cmp.note = x === 0 ? 'Both tests start at the same value.' : 'No matching point. The start value of one test is not inside the other test. Type the hour by hand.'; }
      render();
    },
    excel: function () { exportExcel().catch(function (e) { ui.err = 'Excel export failed. ' + e.message; render(); }); },
    pdf: function () { ui.printing = true; render(); setTimeout(function () { window.print(); ui.printing = false; render(); }, 400); },
    series: function (el) { ui.series[el.dataset.c] = !ui.series[el.dataset.c]; render(); },
    toggleNotes: function (el) { ui.openNotes[el.dataset.r] = !ui.openNotes[el.dataset.r]; render(); },
    pop: function (el) { var box = el.closest('.tablewrap').getBoundingClientRect(), r = el.getBoundingClientRect(), wrap = el.closest('.tablewrap'); ui.pop = { r: el.dataset.r, c: el.dataset.c, x: Math.max(8, Math.min(r.left - box.left + wrap.scrollLeft, wrap.scrollWidth - 290)), y: r.bottom - box.top + 4 }; render(); },
    closePop: function () { ui.pop = null; render(); },
    viewer: function (el) { ui.viewer = el.dataset.photoId; render(); },
    viewerClose: function () { ui.viewer = null; render(); },
    viewerStep: function (el) { var list = photoList(D.bundle), i = list.findIndex(function (p) { return p.photo_id === ui.viewer; }) + Number(el.dataset.d); if (list[i]) { ui.viewer = list[i].photo_id; render(); } },
    saveNote: function (el) {
      var id = el.dataset.r, ta = document.getElementById('note-' + (id || 'test')), text = ta.value.trim();
      if (!text) { ui.err = 'Write the note first.'; return render(); }
      push('note.add', { note: { note_id: U.uid(), test_id: D.bundle.test.test_id, reading_id: id, text: text } }).then(function () { ui.msg = 'Note saved.'; return reload(); }).catch(function () {});
    },
    useReading: function (el) { push('reading.choose', { test_id: D.bundle.test.test_id, no: Number(el.dataset.n), reading_id: el.dataset.r }).then(reload).catch(function () {}); },
    tplNew: function () { ui.tpl = blankTemplate(); ui.prod = ''; render(); },
    tplPick: function (el) {
      var t = JSON.parse(JSON.stringify(D.templates.find(function (x) { return x.id === el.dataset.id; })));
      t.setup = JSON.parse(JSON.stringify(T.setupFields(t.columns, t.product))); t.columns = T.readingColumns(t.columns);
      ui.tpl = t; ui.prod = ''; render();
    },
    prodAdd: function () {
      var v = document.getElementById('prod-new').value.trim();
      if (!v) { ui.err = 'Type the product name.'; return render(); }
      if (D.products.some(function (p) { return p.id.toLowerCase() === v.toLowerCase(); })) { ui.err = 'This product is already in the list.'; return render(); }
      push('product.save', { product: { id: v, name: v, modes: [] } }).then(function () { ui.msg = v + ' was added. Pick it to add its machine modes.'; ui.prod = v; ui.tpl = null; return reload(); }).catch(function () {});
    },
    tplCancel: function () { ui.tpl = null; render(); },
    prodPick: function (el) { ui.prod = el.dataset.id; ui.tpl = null; ui.modes = null; render(); },
    modeAdd: function () { var v = document.getElementById('mode-new').value.trim(); if (!v) return; var pr = D.products.find(function (p) { return p.id === ui.prod; }); ui.modes = (ui.modes || pr.modes.slice()); if (ui.modes.indexOf(v) < 0) ui.modes.push(v); render(); },
    modeDel: function (el) { var pr = D.products.find(function (p) { return p.id === ui.prod; }); ui.modes = (ui.modes || pr.modes.slice()); ui.modes.splice(Number(el.dataset.i), 1); render(); },
    modesSave: function () { var pr = D.products.find(function (p) { return p.id === ui.prod; }); push('product.save', { product: { id: pr.id, name: pr.name, modes: ui.modes || pr.modes } }).then(function () { ui.msg = 'Modes saved.'; ui.modes = null; return reload(); }).catch(function () {}); },
    tcAdd: function (el) { var g = el.dataset.g; ui.tpl[g].push({ id: (g === 'setup' ? 's' : 'c') + U.uid().slice(0, 8), name: '', type: 'number', unit: g === 'setup' ? '' : '°C', options: [], on: true }); render(); },
    tcDel: function (el) { ui.tpl[el.dataset.g].splice(Number(el.dataset.i), 1); render(); },
    tcMove: function (el) { var c = ui.tpl[el.dataset.g], i = Number(el.dataset.i), j = i + Number(el.dataset.d), x = c[i]; c[i] = c[j]; c[j] = x; render(); },
    tplSave: function () {
      var t = tplRead();
      if (!t.name.trim()) { ui.err = 'Give the template a name.'; return render(); }
      var both = t.columns.concat(t.setup);
      if (both.some(function (c) { return !c.name.trim(); })) { ui.err = 'Every column and setup field needs a name.'; return render(); }
      if (both.some(function (c) { return c.type === 'pick' && (c.options || []).length < 2; })) { ui.err = 'A pick-list column needs 2 or more choices. Example: Off, Slow, Fast'; return render(); }
      var cols = t.columns.map(function (c) { return { id: c.id, name: c.name.trim(), type: c.type, unit: c.type === 'number' ? (c.unit || '') : '', options: c.type === 'pick' ? c.options : [], on: c.on !== false }; })
        .concat(t.setup.map(function (c) { return { id: c.id, name: c.name.trim(), type: c.type, unit: c.type === 'number' ? (c.unit || '') : '', options: c.type === 'pick' ? c.options : [], scope: 'setup' }; }));
      push('template.save', { template: { id: t.id, name: t.name.trim(), product: t.product, default_mode: t.default_mode, track_compressor: !!t.track_compressor, columns: cols } }).then(function () { ui.msg = 'Template saved. Phones get it at their next sync.'; ui.tpl = null; return reload(); }).catch(function () {});
    },
    tplRemove: function () { if (!window.confirm('Remove this template? Old tests keep their own columns.')) return; push('template.remove', { id: ui.tpl.id }).then(function () { ui.msg = 'Template removed.'; ui.tpl = null; return reload(); }).catch(function () {}); },
    personAdd: function () {
      var g = function (id) { return document.getElementById(id).value.trim(); }, person = { name: g('p-name'), username: g('p-user').toLowerCase(), password: document.getElementById('p-pass').value, role: g('p-role') };
      if (!person.name || !person.username) { ui.err = 'Give a name and a username.'; return render(); }
      if (!/^[a-z0-9._-]+$/.test(person.username)) { ui.err = 'Username: use small letters and numbers only, with no spaces. Example: krupal'; return render(); }
      if (D.people.some(function (p) { return p.username === person.username; })) { ui.err = 'This username is already used.'; return render(); }
      if (person.password.length < 6) { ui.err = 'Password must have 6 or more letters.'; return render(); }
      push('person.save', { person: person }).then(function () { ui.msg = person.name + ' was added.'; return reload(); }).catch(function () {});
    },
    removeAsk: function (el) { ui.confirm = el.dataset.u; render(); },
    removeCancel: function () { ui.confirm = ''; render(); },
    personRemove: function (el) { push('person.remove', { username: el.dataset.u }).then(function () { ui.confirm = ''; ui.msg = 'Person removed.'; return reload(); }).catch(function () {}); },
    personRestore: function (el) { push('person.restore', { username: el.dataset.u }).then(function () { ui.msg = 'Person added back.'; return reload(); }).catch(function () {}); },
    passOpen: function (el) { ui.newPass[el.dataset.u] = ''; render(); },
    passCancel: function (el) { delete ui.newPass[el.dataset.u]; render(); },
    passSave: function (el) { var u = el.dataset.u, v = document.getElementById('np-' + u).value; if (v.length < 6) { ui.err = 'Password must have 6 or more letters.'; return render(); } push('person.save', { person: { username: u, password: v } }).then(function () { delete ui.newPass[u]; ui.msg = 'Password changed for ' + name(u) + '.'; if (u === S().current) { T.signOut(); } return reload(); }).catch(function () {}); }
  };
  root.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (ev.target.closest('button,a,input,select,textarea') && ev.target.closest('button,a,input,select,textarea') !== el && el.tagName === 'TR') return;
    var fn = actions[el.dataset.act]; if (fn) { ui.msg = ''; fn(el, ev); }
  });
  root.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var u = document.getElementById('l-user').value, pw = document.getElementById('l-pass').value;
    if (!u || !pw) return;
    ui.busy = true; ui.err = ''; render();
    T.signIn(u, pw).then(function () { ui.busy = false; load(); }, function (e) { ui.busy = false; ui.err = e.network ? 'No internet. The computer view needs internet.' : e.message; render(); });
  });
  root.addEventListener('change', function (ev) {
    var el = ev.target, u = el.dataset && el.dataset.role;
    if (el.id === 'imp-file' && el.files && el.files[0]) {
      var file = el.files[0];
      ui.imp = null; ui.impBusy = 'check'; ui.err = ''; ui.msg = ''; render();
      return file.arrayBuffer().then(function (buf) { return T.imp.parse(buf, { templates: D.templates, products: D.products, tests: D.tests, fileName: file.name }); }).then(function (r) {
        if (!r.errors.length) r.ops = T.imp.ops(r, T.me().name);
        ui.imp = r; ui.impBusy = false; render();
      }, function (e) { ui.impBusy = false; ui.err = 'Could not read the file. ' + e.message; render(); });
    }
    if (el.dataset.in === 'cmpOffA' || el.dataset.in === 'cmpOffB') { var hv = Number(el.value); ui.cmp[el.dataset.in === 'cmpOffA' ? 'offA' : 'offB'] = isFinite(hv) ? Math.max(-1000, Math.min(1000, hv)) : 0; ui.cmp.note = ''; return render(); }
    if (!u) return;
    push('person.save', { person: { username: u, role: el.value } }).then(function () { ui.msg = name(u) + ' is now ' + T.roleName(el.value) + '. It applies at their next sync.'; return reload(); }).catch(function () { reload(); });
  });
  var filterTimer;
  root.addEventListener('input', function (ev) {
    var el = ev.target;
    if (el.dataset.f) { ui.filters[el.dataset.f] = el.value; if (el.dataset.f === 'product') ui.filters.mode = ''; ui.page = 0; clearTimeout(filterTimer); filterTimer = setTimeout(render, el.tagName === 'SELECT' || el.type === 'date' ? 0 : 250); }
    else if (el.dataset.in === 'tplSearch') { ui.tplSearch = el.value; clearTimeout(filterTimer); filterTimer = setTimeout(render, 250); }
    else if (el.dataset.in === 'statCol') { ui.statCol = el.value; render(); }
    else if (el.dataset.in === 'impTpl') { ui.impTpl = el.value; }
    else if (el.dataset.in === 'cmpColA' || el.dataset.in === 'cmpColB') { ui.cmp[el.dataset.in === 'cmpColA' ? 'colA' : 'colB'] = el.value; if (el.dataset.in === 'cmpColA') cmpFollow(); ui.cmp.note = ''; render(); }
    else if (el.dataset.tp) { var k = el.dataset.tp; ui.tpl[k] = el.type === 'checkbox' ? el.checked : el.value; if (k === 'product') { ui.tpl.default_mode = ''; render(); } }
    else if (el.dataset.tc) { var c = ui.tpl[el.dataset.g][Number(el.dataset.i)], f = el.dataset.tc; if (f === 'on') c.on = el.checked; else if (f === 'options') c.options = el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); else c[f] = el.value; if (f === 'type') render(); }
  });
  root.addEventListener('mousemove', function (ev) {
    var box = ev.target.closest('.chart'), b = D.bundle; if (!box || !b) return;
    var svg = box.querySelector('svg'), r = svg.getBoundingClientRect(), xmax = Number(box.dataset.xmax), fx = (ev.clientX - r.left) / r.width * 1000, x = (fx - 56) / (1000 - 56 - 16) * xmax;
    var used = T.usedReadings(b), near = null, best = 1e9;
    used.forEach(function (rd) { var d = Math.abs(hrs(b, rd.time) - x); if (d < best) { best = d; near = rd; } });
    var tip = box.querySelector('.tipbox'), cross = box.querySelector('.cross');
    if (!near) return;
    var hx = hrs(b, near.time), px = 56 + hx / xmax * (1000 - 56 - 16);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    if (!tip) { tip = document.createElement('div'); tip.className = 'tipbox'; box.appendChild(tip); }
    var cols = numCols(b).filter(function (c) { return ui.series[c.id] && (c.unit || 'No unit') === box.dataset.chart; });
    tip.innerHTML = '<strong class="num">' + fmt(hx) + ' h · ' + esc(U.hhmm(near.time)) + ' · Reading ' + near.no + '</strong>' + cols.map(function (c) { return '<br>' + esc(c.name) + ': <strong class="num">' + esc(near.values[c.id] === undefined ? '-' : near.values[c.id]) + '</strong>'; }).join('');
    var left = px / 1000 * r.width + (r.left - box.getBoundingClientRect().left);
    tip.style.left = Math.min(left + 12, box.clientWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = '48px';
  });
  root.addEventListener('mouseleave', function (ev) { if (ev.target.classList && ev.target.classList.contains('chart')) { var t = ev.target.querySelector('.tipbox'); if (t) t.remove(); ev.target.querySelector('.cross').setAttribute('visibility', 'hidden'); } }, true);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && (ui.viewer || ui.pop)) { ui.viewer = null; ui.pop = null; render(); } });
  window.addEventListener('hashchange', load);
  T.on(function (what) { if (what === 'expired' || what === 'signout') render(); });
  T.load().then(load);
})();

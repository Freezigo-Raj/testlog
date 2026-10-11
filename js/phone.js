/* Freezigo Test Log - phone app screens. */
(function () {
  'use strict';
  var T = window.TL, U = T.u, esc = U.esc, icon = U.icon;
  var root = document.getElementById('app');
  var ui = { sheet: null, toast: null, toastTimer: null, allFinished: false, tplSearch: '', edit: null, hand: null, beeped: {}, serverUsers: null };
  var localPhotos = [];

  /* ---------- basics ---------- */
  function S() { return T.state; }
  function parts() { return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent); }
  function go(path) { ui.sheet = null; if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }
  function toast(text, kind) {
    ui.toast = { text: text, kind: kind || 'ok' };
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(function () { ui.toast = null; var t = root.querySelector('.toast'); if (t) t.remove(); }, 3500);
    render();
  }
  function refreshLocalPhotos() {
    return T.photosDb.all().then(function (all) {
      localPhotos = all.map(function (p) { return { photo_id: p.photo_id, test_id: p.test_id, reading_id: p.reading_id, taken_at: p.taken_at, by: p.user, waiting: !p.uploaded }; });
    });
  }
  function photosOf(b, readingId) {
    var id = b.test ? b.test.test_id : b.test_id, list = (b.photos || []).filter(function (p) { return (p.reading_id || '') === (readingId || ''); }).map(function (p) { return Object.assign({ waiting: false }, p); });
    localPhotos.forEach(function (p) {
      if (p.test_id === id && (p.reading_id || '') === (readingId || '') && !list.some(function (x) { return x.photo_id === p.photo_id; })) list.push(p);
    });
    return list;
  }
  function spin() { return icon('spin').replace('class="i"', 'class="i spin"'); }
  function syncBadge() {
    var s = T.syncState(), n = T.waitingCount();
    var map = { saved: [icon('cloudOk'), 'All saved'], waiting: [icon('cloudUp'), n + ' waiting'], saving: [spin(), 'Saving…'], failed: [icon('warn'), 'Sync failed'], offline: [icon('cloudOff'), 'Offline' + (n ? ' · ' + n : '')] };
    return '<button type="button" class="sync" data-state="' + s + '" data-act="syncSheet" aria-label="' + map[s][1] + '. Tap for sync details.">' + map[s][0] + '<span>' + map[s][1] + '</span></button>';
  }
  function torchBtn() {
    var on = T.torch.state.on;
    return '<button type="button" class="iconbtn torchbtn" data-act="torch" aria-pressed="' + on + '" aria-label="Torch. ' + (on ? 'On. Tap to switch off.' : 'Off. Tap to switch on.') + '">' + icon('torch', 26) + '</button>';
  }
  function brand() { return '<div class="brand"><small>FREEZIGO</small><b>Test Log</b></div>'; }
  function avatar(name, cls) { return '<span class="avatar ' + (cls || '') + '">' + esc(U.initials(name)) + '</span>'; }
  function people() { return S().people.filter(function (p) { return p.active !== false; }); }
  function product(id) { return S().products.find(function (p) { return p.id === id; }) || { id: id, name: id, modes: [] }; }
  function typeName(c) { return { number: 'Number', text: 'Text', yesno: 'Yes/No', pick: 'Pick-list' }[c.type] || c.type; }
  function colMeta(c) { var m = typeName(c); if (c.unit) m += ' · ' + c.unit; if (c.type === 'pick' && c.options && c.options.length) m += ' · ' + c.options.join(', '); return m; }

  /* ---------- sign in ---------- */
  function signinScreen() {
    var st = S(), list = people(), last = list.find(function (p) { return p.username === st.lastUser; });
    var body;
    if (!T.cfg.api) {
      body = '<div class="banner bad">' + icon('warn') + '<span><b>App is not connected</b><br>The link to the Google Sheet is missing. Ask your manager.</span></div>';
    } else if (ui.serverUsers === false) {
      body = '<div><h1 style="font-size:28px;font-weight:800;line-height:1.1">First-time setup</h1></div>' +
        field('Your name', '<input class="inp" id="su-name" autocomplete="name">') +
        field('Username', '<input class="inp" id="su-user" autocapitalize="none" autocomplete="username">') +
        field('Password (6 or more letters)', '<input class="inp" id="su-pass" type="password" autocomplete="new-password">') +
        (ui.err ? '<p class="err">' + esc(ui.err) + '</p>' : '') +
        '<button type="button" class="btn" data-act="setupAdmin"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? spin() : '') + 'Create user and sign in</button>';
    } else {
      body = '<div><h1 style="font-size:30px;font-weight:800;line-height:1.1">Who are you?</h1></div>';
      if (last) body += '<section class="col" style="gap:8px"><h2 class="h-caps">Last used on this phone</h2><button type="button" class="person last" data-act="pickUser" data-u="' + esc(last.username) + '">' + avatar(last.name) + '<span class="grow">' + esc(last.name) + '</span>' + icon('chevron', 26) + '</button></section>';
      var others = list.filter(function (p) { return !last || p.username !== last.username; });
      if (others.length) body += '<section class="col" style="gap:8px"><h2 class="h-caps">All names</h2><div class="grid2">' + others.map(function (p) {
        return '<button type="button" class="person" data-act="pickUser" data-u="' + esc(p.username) + '">' + avatar(p.name) + '<span>' + esc(p.name) + '</span></button>';
      }).join('') + '</div></section>';
      if (!list.length) body += '<div class="empty">' + (navigator.onLine ? spin() + '<b>Loading names…</b>' : icon('cloudOff', 32) + '<b>No internet</b>') + '</div>';
    }
    return '<header class="hdr"><div class="between">' + brand() + '</div></header><main class="scroll" style="padding-top:22px;gap:20px">' + body +
      '<p class="build">Build ' + T.BUILD + (st.phone ? ' · Phone ' + esc(st.phone) : '') + '</p></main>' + (ui.sheet && ui.sheet.name === 'password' ? passwordSheet() : '');
  }
  function field(label, inner, hint) {
    return '<div class="field"><label>' + label + '</label>' + (hint ? '<span class="muted" style="margin-top:-4px;font-size:14px">' + hint + '</span>' : '') + inner + '</div>';
  }
  function passwordSheet() {
    var p = people().find(function (x) { return x.username === ui.sheet.username; }) || { name: ui.sheet.username };
    var acct = S().users[ui.sheet.username], left = T.daysLeftOffline(acct);
    var hint = navigator.onLine ? '' : (left > 0 ? 'No internet. You can sign in offline for ' + Math.ceil(left) + ' more day' + (Math.ceil(left) === 1 ? '' : 's') + '.' : 'No internet. This phone needs internet for your sign in.');
    return '<div class="scrim" data-act="closeSheet"><form class="sheet" data-form="signin"><span class="grab"></span>' +
      '<div class="row">' + avatar(p.name) + '<h2>' + esc(p.name) + '</h2></div>' +
      field('Password', '<input class="inp" id="pw" type="password" autocomplete="current-password" autofocus>') +
      (hint ? '<p class="tip">' + icon('cloudOff') + '<span>' + hint + '</span></p>' : '') +
      (ui.err ? '<p class="err">' + esc(ui.err) + '</p>' : '') +
      '<button type="submit" class="btn"' + (ui.busy ? ' disabled' : '') + '>' + (ui.busy ? spin() : '') + 'Sign in</button>' +
      '<button type="button" class="btn second" data-act="closeSheet">Back</button></form></div>';
  }

  /* ---------- home ---------- */
  function testCard(b, mine) {
    var t = b.test, due = T.nextDue(b);
    var right = mine ? '<span class="pill" data-tick="pill" data-id="' + esc(t.test_id) + '">' + pillText(due) + '</span>' : '<span class="pill">' + icon('eye', 16) + 'View only</span>';
    return '<button type="button" class="card' + (mine ? '' : ' viewer') + '" data-act="open" data-id="' + esc(t.test_id) + '">' +
      '<div class="between"><span class="ttl grow">' + esc(T.testTitle(t)) + '</span>' + right + '</div>' +
      '<div class="muted" style="font-size:15px">' + esc([t.machine_code ? t.template_name : '', t.product, t.mode].filter(Boolean).join(' · ')) + '</div>' +
      '<span class="badge-rec' + (mine ? ' me' : '') + '">' + icon('person', 18) + '<span>Recorder: <strong>' + esc(T.personName(t.current_recorder)) + '</strong>' + (mine ? ' (you)' : '') + '</span></span>' +
      '<div class="between muted" style="font-size:15px"><span>Started ' + esc(U.dmhm(t.started_at)) + ' · <strong style="color:var(--ink)">' + b.readings.length + '</strong> readings</span>' + icon('chevron', 20) + '</div><span class="idref">' + esc(t.test_id) + '</span></button>';
  }
  function pillText(due) {
    if (!due) return 'No timer';
    var s = Math.round((due - Date.now()) / 1000);
    if (s <= 0) return 'Reading due';
    return 'Next <span class="num" style="font-size:17px">' + U.pad(Math.floor(s / 60)) + ':' + U.pad(s % 60) + '</span>';
  }
  function homeScreen() {
    var st = S(), all = Object.keys(st.tests).map(function (k) { return st.tests[k]; }).filter(function (b) { return !T.isDeleted(b.test); });
    var running = all.filter(function (b) { return b.test.status !== 'finished'; }).sort(function (a, b) { return (b.test.started_at || '').localeCompare(a.test.started_at || ''); });
    var mine = running.filter(function (b) { return b.test.current_recorder === st.current; }), others = running.filter(function (b) { return b.test.current_recorder !== st.current; });
    var finished = all.filter(function (b) { return b.test.status === 'finished'; }).sort(function (a, b) { return (b.test.ended_at || '').localeCompare(a.test.ended_at || ''); });
    var shown = ui.allFinished ? finished : finished.slice(0, 3);
    var h = '<header class="hdr" style="padding-bottom:4px"><div class="between">' + brand() + '<span class="row" style="gap:4px">' + syncBadge() + '<button type="button" class="iconbtn" style="margin-right:-6px" data-act="settings" aria-label="Settings">' + icon('more', 26) + '</button></span></div>' +
      '<div class="between" style="min-height:36px"><span class="muted" style="font-size:15px">Signed in as <strong style="color:var(--ink)">' + esc(T.me().name) + '</strong></span></div></header>';
    h += '<main class="scroll" style="gap:18px"><button type="button" class="btn large" data-act="startNew">' + icon('plus', 28) + 'Start new test</button>';
    if (st.newTest) h += '<button type="button" class="card" data-act="resumeNew"><div class="between"><span class="ttl">' + esc(st.newTest.machine_code || st.newTest.template_name || 'New test') + '</span><span class="pill">Not started</span></div><span class="idref">' + esc(st.newTest.test_id) + '</span></button>';
    h += '<section class="col" style="gap:10px"><div class="between"><h2 class="h-sec">My tests</h2><span class="num muted" style="font-size:17px;font-weight:700">' + mine.length + '</span></div>';
    h += mine.length ? mine.map(function (b) { return testCard(b, true); }).join('') :
      '<div class="empty">' + icon('timer', 32) + '<b>No tests yet</b></div>';
    h += '</section>';
    if (others.length) h += '<section class="col" style="gap:10px"><div class="between"><h2 class="h-sec">Other running tests</h2><span class="num muted" style="font-size:17px;font-weight:700">' + others.length + '</span></div>' + others.map(function (b) { return testCard(b, false); }).join('') + '</section>';
    h += '<section class="col" style="gap:10px"><div class="between"><h2 class="h-sec">Finished tests</h2>' + (finished.length > 3 ? '<button type="button" class="quiet" data-act="toggleFinished">' + (ui.allFinished ? 'Show less' : 'See all ' + finished.length) + '</button>' : '') + '</div>';
    h += shown.length ? shown.map(function (b) {
      var t = b.test;
      return '<button type="button" class="card" style="flex-direction:row;align-items:center;gap:12px;min-height:76px" data-act="open" data-id="' + esc(t.test_id) + '"><div class="grow col" style="gap:2px"><div class="row" style="align-items:baseline;gap:10px"><span class="ttl" style="font-size:17px">' + esc(T.testTitle(t)) + '</span><span class="muted" style="font-size:14px;white-space:nowrap">' + esc(U.dmy(t.ended_at || t.started_at)) + '</span></div><div class="muted" style="font-size:14px">' + esc([t.machine_code ? t.template_name : '', t.product].filter(Boolean).join(' · ')) + ' · ' + b.readings.length + ' readings</div><span class="idref">' + esc(t.test_id) + '</span></div><span class="col muted" style="align-items:center;gap:2px;font-size:12px;font-weight:700">' + icon('lock', 20) + 'Locked</span></button>';
    }).join('') : '<div class="empty">' + icon('lock', 32) + '<b>No finished tests yet</b></div>';
    h += '</section><p class="build">Build ' + T.BUILD + ' · Phone ' + esc(st.phone || '?') + '</p></main>';
    return h;
  }

  /* ---------- new test: setup, template, columns ---------- */
  function applyTemplate(draft, tpl) {
    draft.template_id = tpl.id; draft.template_name = tpl.name; draft.product = tpl.product; draft.mode = tpl.default_mode || '';
    draft.track_compressor = !!tpl.track_compressor;
    draft.columns = JSON.parse(JSON.stringify(T.readingColumns(tpl.columns)));
    draft.setup_fields = JSON.parse(JSON.stringify(T.setupFields(tpl.columns, tpl.product)));
  }
  function ensureDraft() {
    var st = S();
    if (st.newTest) return st.newTest;
    var d = { test_id: T.newTestId(), template_id: '', template_name: '', product: '', machine_code: '', mode: '', date: U.localISO().slice(0, 10), interval_min: 15, track_compressor: false,
      setup: { notes: '' }, columns: [], setup_fields: [] };
    var tpl = st.templates.find(function (t) { return t.id === st.recentTemplates[0]; }) || st.templates[0];
    if (tpl) applyTemplate(d, tpl);
    st.newTest = d; T.save();
    return d;
  }
  function setupHeader(d, sub, back) {
    return '<header class="hdr" style="padding:8px 12px 8px 8px;border-bottom:0"><div class="row" style="gap:6px"><button type="button" class="iconbtn" data-act="' + back + '" aria-label="Back">' + icon('back', 26) + '</button><div class="grow col" style="min-width:0"><span class="ttl">' + sub + '</span><span class="idref">' + esc(d.test_id) + '</span></div>' + syncBadge() + '</div></header>';
  }
  function stepBar(n) {
    return '<nav class="stepbar" aria-label="Steps"><div class="' + (n === 1 ? 'on' : '') + '"><i></i><span>1 · Setup</span></div><div class="' + (n === 2 ? 'on' : '') + '"><i></i><span>2 · Columns</span></div></nav>';
  }
  /** The inputs for the setup fields of a template. `kind` is 'setup' for a new test and 'se' when changing a running test. */
  function setupInputs(fields, vals, kind) {
    var nums = fields.filter(function (f) { return f.type === 'number'; }), rest = fields.filter(function (f) { return f.type !== 'number'; });
    var h = nums.length ? '<div class="grid2" style="gap:16px 10px;align-items:end">' + nums.map(function (f) {
      return '<div class="field"><label for="sf-' + esc(f.id) + '" style="line-height:1.2">' + esc(f.name) + '</label><div class="unitwrap"><input id="sf-' + esc(f.id) + '" class="inp mono" inputmode="decimal" data-in="' + kind + '" data-k="' + esc(f.id) + '" value="' + esc(vals[f.id] || '') + '"><span>' + esc(f.unit || '') + '</span></div></div>';
    }).join('') + '</div>' : '';
    return h + rest.map(function (f) {
      if (f.type === 'text') return field(esc(f.name), '<input class="inp" id="sf-' + esc(f.id) + '" data-in="' + kind + '" data-k="' + esc(f.id) + '" value="' + esc(vals[f.id] || '') + '">');
      var options = f.type === 'yesno' ? ['Yes', 'No'] : (f.options || []);
      return '<div class="field"><span class="lbl">' + esc(f.name) + '</span><div class="row" style="flex-wrap:wrap;gap:6px" role="radiogroup">' + options.map(function (o) {
        return '<button type="button" role="radio" class="opt" style="flex:1" aria-checked="' + (vals[f.id] === o) + '" data-act="setupPick" data-w="' + kind + '" data-k="' + esc(f.id) + '" data-v="' + esc(o) + '">' + esc(o) + '</button>';
      }).join('') + '</div></div>';
    }).join('');
  }
  function photoRow(testId, readingId, readingNo, canAdd) {
    var b = S().tests[testId] || { test_id: testId, photos: [] }, list = photosOf(b, readingId);
    var h = '<div class="photos">';
    if (canAdd) h += '<label class="photoadd">' + icon('camera', 24) + 'Camera<input type="file" accept="image/*" capture="environment" hidden data-photo data-t="' + esc(testId) + '" data-r="' + esc(readingId || '') + '" data-n="' + esc(readingNo || '') + '"></label>' +
      '<label class="photoadd">' + icon('image', 24) + 'Gallery<input type="file" accept="image/*" multiple hidden data-photo data-t="' + esc(testId) + '" data-r="' + esc(readingId || '') + '" data-n="' + esc(readingNo || '') + '"></label>';
    h += list.map(function (p, i) {
      return '<button type="button" class="thumb" data-act="viewPhoto" data-photo-id="' + esc(p.photo_id) + '" aria-label="Open photo ' + (i + 1) + '">' + icon('image', 24) + (p.waiting ? '<span class="wait">' + icon('cloudUp', 14) + '</span>' : '') + '</button>';
    }).join('');
    return h + '</div>';
  }
  function intervalField(cur, where) {
    var opts = [5, 10, 15, 20, 30, 60];
    return '<div class="field"><label for="f-interval">Reading interval</label>' +
      '<div class="unitwrap"><input id="f-interval" class="inp mono" inputmode="numeric" data-in="interval" data-w="' + where + '" value="' + (cur || '') + '"><span>min</span></div>' +
      '<div class="seg" style="grid-template-columns:repeat(6,1fr)" role="radiogroup" aria-label="Quick pick">' + opts.map(function (m) { return '<button type="button" role="radio" style="min-height:48px" aria-checked="' + (cur === m) + '" data-act="intervalPick" data-w="' + where + '" data-m="' + m + '"><span class="num">' + m + '</span></button>'; }).join('') + '</div></div>';
  }
  function alarmRow(on, act) {
    return '<div class="row" style="gap:10px;padding:12px;border-radius:12px;background:var(--surface);border:1px solid var(--line)">' + icon('timer', 26) + '<span class="grow" style="font-size:17px;font-weight:700;line-height:1.2">Alarm when a reading is due</span>' + switchBtn(on, act, '', 'Alarm when a reading is due') + '</div>';
  }
  function setupScreen() {
    var d = ensureDraft(), pr = product(d.product), tpl = S().templates.find(function (t) { return t.id === d.template_id; });
    var h = setupHeader(d, 'New test', 'home') + stepBar(1) + '<main class="scroll" style="padding:14px 16px 20px">';
    h += '<div class="field"><span class="lbl">Template</span><button type="button" data-act="pickTemplate" style="display:flex;align-items:center;gap:10px;min-height:76px;padding:10px 12px 10px 14px;border-radius:12px;border:2px solid var(--ink);background:var(--surface);text-align:left;width:100%"><span class="grow col" style="gap:2px"><span style="font-size:13px;font-weight:700;color:var(--ink-2);text-transform:uppercase;letter-spacing:.5px">' + esc(d.product || 'No product') + '</span><span style="font-size:18px;font-weight:800;line-height:1.2">' + esc(d.template_name || 'No template') + '</span><span class="muted" style="font-size:14px">' + d.columns.length + ' columns</span></span><span class="row" style="gap:2px;font-size:16px;font-weight:700;color:var(--accent)">Change' + icon('chevron', 20) + '</span></button></div>';
    h += field('Machine name/code', '<input class="inp mono" data-in="draft" data-k="machine_code" autocapitalize="characters" value="' + esc(d.machine_code) + '">');
    if (pr.modes.length) {
      h += '<div class="field"><span class="lbl">Machine mode</span><div class="col" role="radiogroup" style="gap:6px">' + pr.modes.map(function (m) {
        var on = d.mode === m;
        return '<button type="button" class="radio" role="radio" aria-checked="' + on + '" data-act="mode" data-m="' + esc(m) + '">' + (on ? icon('check', 22) : '') + '<span class="grow">' + esc(m) + '</span>' + (tpl && tpl.default_mode === m ? '<span class="tag">Template default</span>' : '') + '</button>';
      }).join('') + '</div></div>';
    }
    h += field('Date', '<input class="inp mono" type="date" data-in="draft" data-k="date" value="' + esc(d.date) + '">');
    h += setupInputs(d.setup_fields || [], d.setup, 'setup');
    h += intervalField(d.interval_min, 'draft') + alarmRow(d.setup.alarm !== false, 'draftAlarm');
    h += field('Notes', '<textarea class="inp" rows="3" data-in="setup" data-k="notes">' + esc(d.setup.notes) + '</textarea>');
    h += '<div class="field"><span class="lbl">Photos</span>' + photoRow(d.test_id, '', '', true) + '</div>';
    h += '<div class="field"><span class="lbl">Recorded by</span><div class="row" style="gap:12px;height:56px;padding:0 14px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)">' + avatar(T.me().name, 'sm') + '<span class="grow" style="font-size:19px;font-weight:700">' + esc(T.me().name) + '</span></div></div>';
    h += '<button type="button" class="quiet" style="align-self:center;color:var(--bad-text)" data-act="discardNew">' + icon('trash', 18) + 'Delete this new test</button>';
    h += '</main><footer class="foot"><button type="button" class="btn" data-act="toColumns">Next: Columns' + icon('next') + '</button></footer>';
    return h;
  }
  function templateScreen() {
    var st = S(), d = ensureDraft(), q = ui.tplSearch.toLowerCase();
    var row = function (t, meta) {
      var sel = t.id === d.template_id;
      return '<button type="button" data-act="useTemplate" data-id="' + esc(t.id) + '" style="display:flex;align-items:center;gap:10px;min-height:64px;padding:8px 14px;border-radius:12px;border:2px solid ' + (sel ? 'var(--ink)' : 'var(--line)') + ';background:var(--surface);text-align:left;width:100%"><span class="grow col"><span style="font-size:17px;font-weight:' + (sel ? 800 : 700) + '">' + esc(t.name) + '</span><span class="muted" style="font-size:14px">' + meta + '</span></span>' + (sel ? '<span style="flex:none;width:32px;height:32px;border-radius:16px;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink)">' + icon('check', 20) + '</span>' : '') + '</button>';
    };
    var list = st.templates.filter(function (t) { return !q || (t.name + ' ' + t.product).toLowerCase().indexOf(q) >= 0; });
    var h = setupHeader(d, 'Pick template', 'toSetup') + '<main class="scroll" style="padding:14px 16px 20px;gap:18px">';
    h += '<div class="unitwrap"><input class="inp" data-in="tplSearch" placeholder="Search templates" value="' + esc(ui.tplSearch) + '"></div>';
    var recent = st.recentTemplates.map(function (id) { return st.templates.find(function (t) { return t.id === id; }); }).filter(Boolean).slice(0, 3);
    if (recent.length && !q) h += '<section class="col" style="gap:8px"><h2 class="h-caps">Recent</h2>' + recent.map(function (t) { return row(t, esc(t.product) + ' · ' + T.readingColumns(t.columns).length + ' columns'); }).join('') + '</section>';
    var groups = {};
    list.forEach(function (t) { (groups[t.product] = groups[t.product] || []).push(t); });
    var names = st.products.map(function (p) { return p.id; }).concat(Object.keys(groups)).filter(function (x, i, a) { return a.indexOf(x) === i && groups[x]; });
    names.forEach(function (g) {
      h += '<section class="col" style="gap:8px"><h2 class="h-caps between"><span>' + esc(g || 'No product') + '</span><span class="num">' + groups[g].length + '</span></h2>' + groups[g].map(function (t) { return row(t, T.readingColumns(t.columns).length + ' columns'); }).join('') + '</section>';
    });
    if (!list.length) h += '<div class="empty">' + icon('search', 32) + '<b>No template found</b></div>';
    return h + '</main>';
  }
  function switchBtn(on, act, attrs, label) {
    return '<button type="button" class="switch" role="switch" aria-checked="' + !!on + '" data-act="' + act + '" ' + (attrs || '') + ' aria-label="' + esc(label || '') + '"><i></i></button>';
  }
  function columnList(cols, actPrefix) {
    return '<ol style="list-style:none;margin:0;padding:0;border-radius:14px;background:var(--surface);border:1px solid var(--line);overflow:hidden">' + cols.map(function (c, i) {
      return '<li class="colrow' + (c.on === false ? ' off' : '') + '"><button type="button" class="mv" data-drag="' + i + '" aria-label="Hold and drag to move ' + esc(c.name) + '">' + icon('grip', 22) + '</button>' +
        '<button type="button" class="main" data-act="' + actPrefix + 'Edit" data-i="' + i + '"><span class="col" style="min-width:0"><span style="font-size:17px;font-weight:700;line-height:1.2">' + esc(c.name) + '</span><span class="muted" style="font-size:14px">' + (c.on === false ? 'Off · ' : '') + esc(colMeta(c)) + '</span></span></button>' +
        switchBtn(c.on !== false, actPrefix + 'Toggle', 'data-i="' + i + '"', 'Use ' + c.name + ' in this test') + '</li>';
    }).join('') + '</ol>';
  }
  function columnsScreen() {
    var d = ensureDraft(), on = d.columns.filter(function (c) { return c.on !== false; }).length;
    var h = setupHeader(d, 'New test', 'toSetup') + stepBar(2) + '<main class="scroll" style="padding:14px 16px 20px;gap:12px">';
    h += '<div class="between" style="align-items:baseline"><h2 class="h-sec">Columns</h2><span class="muted" style="font-size:15px"><strong class="num" style="color:var(--ink)">' + on + '</strong> on · ' + (d.columns.length - on) + ' off</span></div>';
    h += d.columns.length ? columnList(d.columns, 'col') : '<div class="empty">' + icon('list', 32) + '<b>No columns yet</b></div>';
    h += '<button type="button" class="btn second" data-act="colAdd">' + icon('plus') + 'Add column</button>';
    h += '<section class="col" style="gap:12px;padding-top:8px"><h2 class="h-sec">Compressor</h2><div class="row" style="gap:10px;padding:12px;border-radius:12px;background:var(--surface);border:1px solid var(--line)">' + icon('power', 26) + '<span class="grow col" style="gap:2px"><span style="font-size:17px;font-weight:700;line-height:1.2">Track compressor ON/OFF</span></span>' + switchBtn(d.track_compressor, 'trackComp', '', 'Track compressor') + '</div></section>';
    h += '</main><footer class="foot two"><button type="button" class="btn second" style="height:60px" data-act="toSetup">Back</button><button type="button" class="btn" data-act="startTest">Start test' + icon('next') + '</button></footer>';
    return h;
  }
  function columnSheet() {
    var s = ui.sheet, c = s.col, isNew = s.index < 0;
    var types = [['number', '123', 'Number'], ['text', 'Aa', 'Text'], ['yesno', 'Y/N', 'Yes/No'], ['pick', 'List', 'Pick-list']];
    var units = ['°C', 'psi', 'bar', 'kWh', 'A', 'V'];
    var h = '<div class="scrim" data-act="closeSheet"><div class="sheet"><span class="grab"></span><h2>' + (isNew ? 'Add column' : 'Edit column') + '</h2>';
    h += field('Name', '<input class="inp" data-in="colName" value="' + esc(c.name) + '">');
    h += '<div class="field"><span class="lbl">Type</span><div class="seg" style="grid-template-columns:repeat(4,1fr)" role="radiogroup">' + types.map(function (t) {
      return '<button type="button" role="radio" aria-checked="' + (c.type === t[0]) + '" data-act="colType" data-t="' + t[0] + '"><span class="num" style="font-size:15px">' + t[1] + '</span><span style="font-size:13px">' + t[2] + '</span></button>';
    }).join('') + '</div></div>';
    if (c.type === 'number') h += '<div class="field"><span class="lbl">Unit</span><div class="seg" style="grid-template-columns:repeat(4,1fr)">' + units.map(function (u) {
      return '<button type="button" aria-checked="' + (c.unit === u) + '" data-act="colUnit" data-u="' + esc(u) + '">' + esc(u) + '</button>';
    }).join('') + '</div><input class="inp" data-in="colUnit" value="' + esc(units.indexOf(c.unit) < 0 ? c.unit : '') + '"  placeholder="Other unit"></div>';
    if (c.type === 'pick') h += field('Choices (comma between)', '<input class="inp" data-in="colOptions" value="' + esc((c.options || []).join(', ')) + '">');
    if (!isNew && s.where === 'draft') h += '<div class="field"><span class="lbl">Position <span class="muted" style="font-weight:400">· ' + (s.index + 1) + ' of ' + S().newTest.columns.length + '</span></span><div class="grid2"><button type="button" class="btn second" data-act="colMove" data-d="-1">' + icon('arrowUp') + 'Move up</button><button type="button" class="btn second" data-act="colMove" data-d="1">' + icon('arrowDown') + 'Move down</button></div></div>';
    if (ui.err) h += '<p class="err">' + esc(ui.err) + '</p>';
    h += '<button type="button" class="btn" data-act="colDone">' + icon('check') + (isNew ? 'Add column' : 'Done') + '</button>';
    if (!isNew && s.where === 'draft') h += '<button type="button" class="quiet" style="align-self:center;color:var(--bad-text)" data-act="colDelete">' + icon('trash', 18) + 'Remove this column</button>';
    return h + '</div></div>';
  }

  /* ---------- running test ---------- */
  function colWidth(c) { return c.type === 'number' ? (/kwh/i.test(c.unit) ? 96 : 84) : c.type === 'text' ? 130 : 88; }
  function timeline(b) {
    var items = T.sortedReadings(b).map(function (r) { return { t: r.time, kind: 'reading', r: r }; });
    b.events.forEach(function (e) {
      if (['compressor_on', 'compressor_off', 'handover', 'takeover', 'finish'].indexOf(e.kind) >= 0) items.push({ t: e.time || '', kind: e.kind, e: e });
    });
    return items.sort(function (x, y) { return (y.t || '').localeCompare(x.t || '') || (y.kind === 'reading' ? 1 : -1); });
  }
  function readingTable(b) {
    var cols = T.activeColumns(b.test), pending = T.pendingReadingIds();
    var tpl = '92px 78px ' + cols.map(function (c) { return colWidth(c) + 'px'; }).join(' '), minW = 170 + cols.reduce(function (s, c) { return s + colWidth(c); }, 0);
    var style = 'grid-template-columns:' + tpl + ';min-width:' + minW + 'px';
    var h = '<div class="rtable"><div class="gridrow head" aria-hidden="true" style="' + style + '"><span class="stick">No. · Time</span><span style="align-items:flex-start">By</span>' + cols.map(function (c) { return '<span>' + esc(c.name) + '<small>' + esc(c.unit || (c.type === 'yesno' ? 'Yes/No' : c.type === 'pick' ? 'list' : '')) + '</small></span>'; }).join('') + '</div>';
    h += timeline(b).map(function (it) {
      if (it.kind !== 'reading') {
        var hand = it.kind === 'handover' || it.kind === 'takeover' || it.kind === 'finish';
        return '<div class="line' + (hand ? ' hand' : '') + '" style="min-width:' + minW + 'px"><span>' + icon(hand ? (it.kind === 'finish' ? 'lock' : 'swap') : 'power', 18, it.kind === 'compressor_on' ? 'style="color:var(--accent)"' : '') + '<span class="num">' + esc(U.hhmm(it.t)) + '</span><span>· ' + esc(it.e.text) + '</span></span></div>';
      }
      var r = it.r, edited = {}, nPhotos = photosOf(b, r.reading_id).length;
      b.edits.forEach(function (e) { if (e.reading_id === r.reading_id) edited[e.column_id] = true; });
      var marks = (nPhotos ? '<span class="row" style="gap:1px;font-size:12px;font-weight:700">' + icon('camera', 14) + nPhotos + '</span>' : '') + (r.note ? icon('note', 14) : '') + (Object.keys(edited).length ? icon('pencil', 14, 'style="color:var(--mark)"') : '') + (r.time_changed ? icon('clock', 14, 'style="color:var(--mark)"') : '') + (pending[r.reading_id] ? '<span class="onlyphone row" style="gap:1px">' + icon('phone', 14) + '</span>' : '') + (r.late ? icon('warn', 14, 'style="color:var(--warn-text)"') : '');
      return '<button type="button" class="gridrow' + (r.late ? ' late' : '') + '" style="' + style + '" data-act="openReading" data-rid="' + esc(r.reading_id) + '" aria-label="Open reading ' + r.no + '">' +
        '<span class="stick"><span class="row" style="gap:6px"><span class="no num">' + r.no + '</span><span class="num" style="font-size:16px;font-weight:700' + (r.time_changed ? ';text-decoration:underline dotted 2px;text-decoration-color:var(--mark);text-underline-offset:3px' : '') + '">' + esc(U.hhmm(r.time)) + '</span></span><span class="row muted" style="gap:5px;min-height:16px">' + marks + '</span></span>' +
        '<span class="cell by">' + esc(T.personName(r.by)) + '</span>' + cols.map(function (c) { var v = r.values[c.id]; return '<span class="cell num' + (edited[c.id] ? ' ed' : '') + '">' + esc(v === undefined ? '' : v) + '</span>'; }).join('') + '</button>';
    }).join('');
    return h + '</div>';
  }
  function elapsedText(b) { return U.dur(U.minsBetween(b.test.started_at, b.test.ended_at || U.localISO())); }
  function countTile(b, clickable) {
    var t = b.test, due = T.nextDue(b), s = due ? Math.round((due - Date.now()) / 1000) : null, isDue = s !== null && s <= 0;
    var mid = !due ? 'No timer' : isDue ? 'Due now' : (clickable ? U.pad(Math.floor(s / 60)) + ':' + U.pad(s % 60) : U.pad(due.getHours()) + ':' + U.pad(due.getMinutes()));
    return '<button type="button" class="count' + (isDue && clickable ? ' due' : '') + '" ' + (clickable ? 'data-act="intervalSheet"' : 'disabled style="opacity:1"') + ' data-tick="count"><span class="grow col" style="line-height:1.15"><span class="t">Next reading</span><b class="' + (isDue ? '' : 'num') + '">' + mid + '</b><small>' + (t.interval_min ? 'Every ' + t.interval_min + ' min' + (T.alarm.alarmOn(t) ? '' : ' · alarm off') : 'Tap to set') + '</small></span>' + (clickable ? icon('chevron', 20) : '') + '</button>';
  }
  function compTile(b, clickable) {
    var c = T.compressor(b), mins = c.since ? U.minsBetween(c.since, U.localISO()) : 0;
    var l2 = c.known ? (c.on ? 'ON' : 'OFF') + ' for ' + U.hm(mins) : 'Not started';
    var l3 = clickable ? (c.on ? 'Tap when it stops' : 'Tap when it starts') : (c.since ? 'Since ' + U.hhmm(c.since) : '');
    return '<button type="button" class="comp" data-state="' + (c.on ? 'on' : 'off') + '" ' + (clickable ? 'data-act="compressor"' : 'disabled style="opacity:1"') + ' aria-pressed="' + c.on + '" data-tick="comp">' + icon('power', 26) + '<span class="grow col" style="line-height:1.15"><strong>Compressor ' + (c.on ? 'ON' : 'OFF') + '</strong><span class="num">' + l2 + '</span><small>' + l3 + '</small></span></button>';
  }
  function testHeader(b, mine) {
    var t = b.test;
    var h = '<header class="hdr test"><div class="row" style="gap:6px"><button type="button" class="iconbtn" style="margin-left:-6px" data-act="home" aria-label="Back to home">' + icon('back', 26) + '</button><div class="grow col" style="min-width:0"><span class="ttl">' + esc(T.testTitle(t)) + '</span><span class="muted" style="font-size:14px;white-space:nowrap">' +
      (t.status === 'finished' ? 'Finished · ' : mine ? '' : 'Running · ') + '<strong class="num" style="color:var(--ink)" data-tick="elapsed">' + elapsedText(b) + '</strong> · <strong class="num" style="color:var(--ink)">' + b.readings.length + '</strong> readings</span><span class="idref">' + esc(t.test_id) + '</span></div>' +
      (mine ? torchBtn() + '<button type="button" class="iconbtn" style="margin-right:-6px" data-act="menu" aria-label="More actions. Hand over. Finish test.">' + icon('more', 26) + '</button>' : syncBadge()) + '</div>';
    if (mine) h += '<div class="between"><span class="badge-rec big">' + icon('person', 20) + '<span>Recorder: <strong>' + esc(T.personName(t.current_recorder)) + '</strong></span></span>' + syncBadge() + '</div>';
    if (t.status !== 'finished') h += '<div class="tiles2"' + (t.track_compressor ? '' : ' style="grid-template-columns:1fr"') + '>' + countTile(b, mine) + (t.track_compressor ? compTile(b, mine) : '') + '</div>';
    return h + '</header>';
  }
  function draftOf(b) {
    var st = S(), id = b.test.test_id;
    if (!st.drafts[id]) st.drafts[id] = { reading_id: U.uid(), values: {}, note: '', time: '' };
    return st.drafts[id];
  }
  function lastValue(b, colId) {
    var rs = T.sortedReadings(b);
    for (var i = rs.length - 1; i >= 0; i--) { var v = rs[i].values[colId]; if (v !== undefined && v !== '') return v; }
    return '';
  }
  function inputRow(b, c, value, opts) {
    opts = opts || {};
    var id = 'in-' + c.id, dis = opts.readonly ? ' disabled' : '', sub;
    if (opts.was !== undefined) sub = '<b>' + esc(c.unit || typeName(c)) + '</b> · Was <span class="num" style="text-decoration:line-through">' + esc(opts.was === '' ? 'blank' : opts.was) + '</span>';
    else if (opts.edit) sub = '<b>' + esc(c.unit || typeName(c)) + '</b>';
    else { var last = lastValue(b, c.id); sub = (c.unit ? '<b>' + esc(c.unit) + '</b> · ' : '') + 'Last <b class="num">' + esc(last === '' ? '-' : last) + '</b>'; }
    var label = esc(c.name) + (opts.isNew ? ' <span class="tag new">NEW</span>' : '') + (opts.was !== undefined ? ' <span class="tag edited">' + icon('pencil', 12) + 'EDITED</span>' : '');
    var left = '<div class="grow col" style="gap:2px"><label for="' + id + '">' + label + '</label><span class="sub">' + sub + '</span></div>';
    var cls = (value !== '' && value !== undefined ? 'filled' : '') + (opts.was !== undefined ? ' edited' : '');
    if (c.type === 'number') {
      // Line 1: name and last value. Line 2: sign, down, the number, up. The grey number is where the value should be by now.
      var pr = T.predict(b, c, opts.at), hint = opts.edit ? '' : pr.value, cid = esc(c.id);
      var inp = '<input id="' + id + '" class="' + cls + '" inputmode="decimal" enterkeyhint="next" autocomplete="off" data-in="val" data-c="' + cid + '" data-dec="' + pr.dec + '" data-pred="' + esc(hint) + '" placeholder="' + esc(hint) + '" value="' + esc(value || '') + '"' + dis + '>';
      return '<div class="rin num2"><div class="between" style="align-items:baseline"><label for="' + id + '">' + label + '</label><span class="sub" style="white-space:nowrap">' + sub + '</span></div><div class="ctl">' +
        (opts.readonly ? inp : '<button type="button" class="pm" data-act="plusMinus" data-c="' + cid + '" aria-label="Plus or minus for ' + esc(c.name) + '">±</button><button type="button" class="pm" data-act="spin" data-d="-1" data-c="' + cid + '" aria-label="Lower ' + esc(c.name) + '">' + icon('minus') + '</button>' + inp + '<button type="button" class="pm" data-act="spin" data-d="1" data-c="' + cid + '" aria-label="Raise ' + esc(c.name) + '">' + icon('plus') + '</button>') + '</div></div>';
    }
    if (c.type === 'text') return '<div class="rin">' + left + '<input id="' + id + '" class="text ' + cls + '" autocomplete="off" data-in="val" data-c="' + esc(c.id) + '" value="' + esc(value || '') + '"' + dis + '></div>';
    var options = c.type === 'yesno' ? ['Yes', 'No'] : (c.options || []);
    return '<div class="rin">' + left + '<div class="opts" role="radiogroup">' + options.map(function (o) {
      return '<button type="button" role="radio" class="opt' + (c.type === 'yesno' ? ' yn' : '') + '" aria-checked="' + (value === o) + '" data-act="pickVal" data-c="' + esc(c.id) + '" data-v="' + esc(o) + '"' + dis + '>' + esc(o) + '</button>';
    }).join('') + '</div></div>';
  }
  function timeField(time, changed, phoneTime, readonly) {
    return '<div class="timefield" data-changed="' + !!changed + '">' + icon('clock', 26) + '<span class="grow col"><span class="muted" style="font-size:14px;font-weight:700">Time</span><span class="row"><span class="num v"' + (changed || readonly ? '' : ' data-tick="clock"') + '>' + esc(U.hhmm(time)) + '</span>' +
      (changed ? '<span class="chip mark">Changed</span>' : '<span class="chip">Phone time</span>') + '</span>' + (changed && phoneTime ? '<span class="muted" style="font-size:13px">Phone time was <strong class="num">' + esc(U.hhmm(phoneTime)) + '</strong></span>' : '') + '</span>' +
      (readonly ? '' : '<button type="button" class="smallbtn" data-act="timeSheet">Change</button>') + '</div>';
  }
  function handoverNote(b) {
    var evs = b.events.filter(function (e) { return e.kind === 'handover' && e.data && e.data.to === S().current && e.data.note; });
    var e = evs[evs.length - 1];
    if (!e || S().seenTakeover['note:' + e.event_id]) return '';
    return '<div class="banner info" style="margin-bottom:12px">' + icon('note') + '<span class="grow"><b>Note from ' + esc(T.personName(e.data.from)) + '</b><br>' + esc(e.data.note) + '</span><button type="button" class="iconbtn" style="width:36px;height:36px" data-act="dismissNote" data-id="' + esc(e.event_id) + '" aria-label="Close note">' + icon('close', 20) + '</button></div>';
  }
  function recordScreen(b) {
    var t = b.test, d = draftOf(b), cols = T.activeColumns(t), no = T.nextNo(b), firstNew = {};
    cols.forEach(function (c) { if (c.added_at_no && c.added_at_no >= no) firstNew[c.id] = true; });
    var h = testHeader(b, true) + '<main class="scroll" style="padding:12px 16px 24px;gap:0">' + handoverNote(b);
    h += '<div class="between" style="align-items:baseline;margin-bottom:8px"><h2 style="font-size:22px;font-weight:800">Reading ' + no + '</h2></div>';
    h += timeField(d.time || U.localISO(), !!d.time, U.localISO(), false);
    var hintAt = d.time || U.localISO();   // the grey number is for the time shown in the Time box: phone time, or the changed time
    h += cols.map(function (c) { return inputRow(b, c, d.values[c.id], { isNew: firstNew[c.id], at: hintAt }); }).join('');
    h += '<div class="field" style="padding-top:16px"><label for="r-notes" style="font-size:17px">Notes for this reading</label><textarea id="r-notes" class="inp" rows="3" data-in="note">' + esc(d.note) + '</textarea></div>';
    h += '<div class="field" style="padding-top:16px"><span class="lbl" style="font-size:17px">Photos for this reading</span>' + photoRow(t.test_id, d.reading_id, no, true) + '</div>';
    h += '<div class="col" style="gap:6px;padding-top:18px"><button type="button" class="btn second" data-act="addColumn">' + icon('plus') + 'Add column</button></div>';
    h += '<section class="col" style="gap:8px;padding-top:26px"><div class="between" style="align-items:baseline"><h2 class="h-sec">Past readings <span class="num muted">' + b.readings.length + '</span></h2></div>';
    if (b.readings.length || b.events.length) h += readingTable(b);
    else h += '<div class="empty">' + icon('list', 32) + '<b>No readings yet</b></div>';
    h += '<button type="button" class="btn second" style="margin-top:14px" data-act="toFinish">' + icon('flag') + 'Finish test</button></section></main>';
    h += '<footer class="foot"><button type="button" class="btn" data-act="saveReading">' + icon('check') + 'Save reading ' + no + '</button></footer>';
    return h;
  }
  function viewScreen(b) {
    var t = b.test, st = S(), finished = t.status === 'finished', who = T.personName(t.current_recorder);
    var h = testHeader(b, false) + '<main class="scroll" style="padding:14px 16px 24px;gap:10px">';
    if (finished) {
      var en = T.energy(b), comp = t.comp_on_min !== null && t.comp_on_min !== undefined ? t.comp_on_min : T.compressor(b).totalMin;
      h += '<div class="banner">' + icon('lock') + '<span><b>Finished and locked</b><br>' + esc(U.dmyhm(t.started_at)) + ' → ' + esc(U.hhmm(t.ended_at)) + '. Nobody can change this test.</span></div>';
      h += '<div class="grid2">' + stat('Total time', elapsedText(b)) + stat('Readings', b.readings.length) + (en && en.total !== null ? stat('Total energy', en.total.toFixed(2) + ' kWh') : '') + (t.track_compressor ? stat('Compressor on-time', U.dur(comp)) : '') + '</div>';
      var extra = b.notes.filter(function (n) { return !n.reading_id; }).sort(function (x, y) { return (x.at || '').localeCompare(y.at || ''); });
      h += '<section class="col" style="gap:8px;padding:14px;border-radius:14px;background:var(--surface);border:1px solid var(--line)"><h2 class="h-caps">Notes</h2>' +
        (t.final_remarks ? '<div class="col" style="gap:2px"><span class="muted" style="font-size:13px;font-weight:700">Final remarks · <span class="num">' + esc(U.dmhm(t.ended_at)) + '</span></span><span style="white-space:pre-wrap">' + esc(t.final_remarks) + '</span></div>' : '') +
        extra.map(function (n) { return '<div class="col" style="gap:2px;border-top:1px solid var(--line);padding-top:8px"><span class="muted" style="font-size:13px;font-weight:700">' + esc(T.personName(n.by)) + ' · <span class="num">' + esc(U.dmhm(n.at)) + '</span></span><span style="white-space:pre-wrap">' + esc(n.text) + '</span></div>'; }).join('') +
        '<textarea class="inp" rows="2" id="add-note" data-in="addNote" aria-label="New note">' + esc(ui.addNote || '') + '</textarea><button type="button" class="btn second" data-act="addNote">' + icon('plus') + 'Add note</button></section>';
    } else {
      var took = b.events.filter(function (e) { return (e.kind === 'takeover' || e.kind === 'handover') && e.data; }).pop();
      if (took && took.kind === 'takeover' && took.data.from === st.current) h += '<div class="banner">' + icon('swap') + '<span><b>' + esc(who) + ' took over at ' + esc(U.hhmm(took.time)) + '</b><br>Recorder: ' + esc(who) + '. You can only view this test now.</span></div>';
      else h += '<div class="banner">' + icon('eye') + '<span><b>Recorder: ' + esc(who) + '</b><br>View only. Only ' + esc(who) + ' can add readings.</span></div>';
      var late = b.readings.filter(function (r) { return r.late && r.by === st.current; });
      if (late.length) h += '<div class="banner warn">' + icon('warn') + '<span><b>Your reading ' + late[late.length - 1].no + ' at ' + esc(U.hhmm(late[late.length - 1].time)) + ' is kept</b><br>You saved it after the handover, so it is marked <strong>Recorded after handover</strong>. A reviewer will choose which reading to use.</span></div>';
    }
    h += '<div class="between" style="align-items:baseline"><h2 class="h-sec">Readings <span class="num muted">' + b.readings.length + '</span></h2></div>';
    if (!finished) h += '<p class="muted" style="font-size:15px">Last sync <strong class="num" style="color:var(--ink)">' + (T.live.lastSyncAt ? U.hhmm(T.live.lastSyncAt) : 'not yet') + '</strong>. You cannot change these readings.</p>';
    h += b.readings.length || b.events.length ? readingTable(b) : '<div class="empty">' + icon('list', 32) + '<b>No readings yet</b></div>';
    h += '</main>';
    if (!finished) h += '<footer class="foot"><button type="button" class="btn" data-act="takeOver">' + icon('hand') + 'Take over</button></footer>';
    return h;
  }
  function stat(k, v, small) { return '<div class="stat"><span class="k">' + k + '</span><span class="v num">' + v + '</span>' + (small ? '<small>' + small + '</small>' : '') + '</div>'; }

  /* ---------- edit one reading ---------- */
  function editScreen(b, r) {
    var t = b.test, canEdit = T.iAmRecorder(b), e = ui.edit;
    if (!e || e.reading_id !== r.reading_id) e = ui.edit = { reading_id: r.reading_id, values: Object.assign({}, r.values), note: r.note || '', time: r.time };
    var hist = b.edits.filter(function (x) { return x.reading_id === r.reading_id; }).sort(function (x, y) { return (y.at || '').localeCompare(x.at || ''); });
    var first = {};
    hist.slice().reverse().forEach(function (x) { if (first[x.column_id] === undefined) first[x.column_id] = x.old_value; });
    var h = '<header class="hdr" style="padding:8px 12px 8px 8px"><div class="row" style="gap:6px"><button type="button" class="iconbtn" data-act="backToTest" aria-label="Back">' + icon('back', 26) + '</button><div class="grow col"><span style="font-size:20px;font-weight:800;line-height:1.2">Reading ' + r.no + '</span><span class="idref">' + esc(T.testTitle(t)) + ' · ' + esc(t.test_id) + '</span></div>' + torchBtn() + syncBadge() + '</div></header>';
    h += '<main class="scroll" style="padding:14px 16px 24px;gap:0">';
    if (r.late) h += '<div class="banner warn" style="margin-bottom:12px">' + icon('warn') + '<span><b>Recorded after handover</b><br>A reviewer will choose which reading ' + r.no + ' to use.</span></div>';
    h += '<div class="row" style="gap:12px;padding:10px 12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--line);margin-bottom:12px">' + avatar(T.personName(r.by)) + '<span class="grow col"><span class="muted" style="font-size:14px;font-weight:700">Recorded by</span><strong style="font-size:18px;line-height:1.2">' + esc(T.personName(r.by)) + '</strong></span><span class="col muted" style="align-items:flex-end;font-size:14px"><span class="num" style="font-weight:700;color:var(--ink)">' + esc(U.dmhm(r.time)) + '</span><span>Phone <strong class="num" style="color:var(--ink)">' + esc(r.phone || '-') + '</strong></span></span></div>';
    if (hist.length) h += '<section class="hist" style="margin-bottom:12px"><h2 class="row" style="font-size:16px;font-weight:800">' + icon('pencil', 18) + 'Changed ' + hist.length + ' time' + (hist.length === 1 ? '' : 's') + '</h2>' + hist.map(function (x) {
      return '<div class="col" style="gap:2px"><span class="between" style="align-items:baseline"><strong style="font-size:16px">' + esc(x.column_name) + '</strong><span class="num row" style="gap:6px;font-size:17px"><span class="muted" style="text-decoration:line-through">' + esc(x.column_id === '_time' ? U.hhmm(x.old_value) : (x.old_value === '' ? 'blank' : x.old_value)) + '</span><span aria-hidden="true">→</span><strong>' + esc(x.column_id === '_time' ? U.hhmm(x.new_value) : (x.new_value === '' ? 'blank' : x.new_value)) + '</strong></span></span><span class="muted" style="font-size:14px">Changed by <strong style="color:var(--ink)">' + esc(T.personName(x.by)) + '</strong> · <span class="num">' + esc(U.dmyhm(x.at)) + '</span></span></div>';
    }).join('') + '</section>';
    h += timeField(e.time, r.time_changed || e.time !== r.time, r.phone_time, !canEdit);
    h += T.activeColumns(t).map(function (c) { return inputRow(b, c, e.values[c.id], { edit: true, was: first[c.id], readonly: !canEdit }); }).join('');
    h += '<div class="field" style="padding-top:16px"><label for="r-notes" style="font-size:17px">Notes for this reading</label><textarea id="r-notes" class="inp" rows="3" data-in="editNote"' + (canEdit ? '' : ' disabled') + '>' + esc(e.note) + '</textarea></div>';
    h += '<div class="field" style="padding-top:16px"><span class="lbl" style="font-size:17px">Photos</span>' + photoRow(t.test_id, r.reading_id, r.no, canEdit) + '</div></main>';
    h += '<footer class="foot">' + (canEdit ? '<button type="button" class="btn" data-act="saveEdit">' + icon('check') + 'Save changes</button>' : '<p class="muted" style="text-align:center;font-size:15px;font-weight:700">' + icon('eye', 18) + ' View only</p>') + '</footer>';
    return h;
  }

  /* ---------- finish ---------- */
  function finishDraft(b) {
    var st = S(), k = 'finish:' + b.test.test_id;
    if (!st.drafts[k]) st.drafts[k] = { ended_at: '', comp_min: null, remarks: '' };
    return st.drafts[k];
  }
  function finishScreen(b) {
    var t = b.test, f = finishDraft(b), end = f.ended_at || U.localISO(), en = T.energy(b), comp = T.compressor(b, end);
    var compMin = f.comp_min !== null ? f.comp_min : Math.round(comp.totalMin);
    var h = '<header class="hdr" style="padding:8px 12px 8px 8px"><div class="row" style="gap:6px"><button type="button" class="iconbtn" data-act="backToTest" aria-label="Back">' + icon('back', 26) + '</button><div class="grow col" style="min-width:0"><span class="ttl">Finish test · ' + esc(T.testTitle(t)) + '</span><span class="idref">' + esc(t.test_id) + '</span></div>' + syncBadge() + '</div></header><main class="scroll" style="padding:14px 16px 20px">';
    h += '<div class="timefield" data-changed="' + !!f.ended_at + '">' + icon('clock', 26) + '<span class="grow col"><span class="muted" style="font-size:14px;font-weight:700">End time</span><span class="row"><span class="num v"' + (f.ended_at ? '' : ' data-tick="clock"') + '>' + esc(U.hhmm(end)) + '</span>' + (f.ended_at ? '<span class="chip mark">Changed</span>' : '<span class="chip">Phone time</span>') + '</span></span><button type="button" class="smallbtn" data-act="endTimeSheet">Change</button></div>';
    h += '<div class="grid2">' + stat('Started', U.hhmm(t.started_at), U.dm(t.started_at)) + stat('Total time', U.dur(U.minsBetween(t.started_at, end))) + stat('Readings', b.readings.length) +
      (en ? stat('Total energy <span class="chip">Auto</span>', en.total !== null ? en.total.toFixed(2) + ' <span style="font-size:15px">kWh</span>' : '-', en.total !== null ? 'From ' + esc(en.col.name) + ': ' + en.first + ' → ' + en.last : 'Needs 2 readings of ' + esc(en.col.name)) : '') + '</div>';
    if (t.track_compressor) h += '<div class="stat" style="flex-direction:row;align-items:center;gap:10px">' + icon('power', 26) + '<span class="grow col"><span class="k">Compressor on-time</span><span class="v num">' + U.dur(compMin) + '</span><small>' + (f.comp_min !== null ? '<span class="chip mark">Edited</span> Auto was ' + U.dur(comp.totalMin) : '<span class="chip">Auto</span> from ' + comp.taps + ' ON/OFF taps') + '</small></span><button type="button" class="smallbtn" data-act="compSheet">Change</button></div>';
    h += '<div class="field"><label for="f-rem">Final remarks</label><textarea id="f-rem" class="inp" rows="4" data-in="remarks">' + esc(f.remarks) + '</textarea></div>';
    h += '</main>';
    h += '<footer class="foot two"><button type="button" class="btn second" style="height:60px" data-act="backToTest">Back</button><button type="button" class="btn" data-act="lockSheet">' + icon('lock') + 'Finish and lock</button></footer>';
    return h;
  }

  /* ---------- hand over ---------- */
  function handoverScreen(b) {
    var t = b.test, st = S(), hd = ui.hand || (ui.hand = { to: '', where: 'own', note: '' });
    var list = people().filter(function (p) { return p.username !== st.current; }), to = list.find(function (p) { return p.username === hd.to; });
    var needSync = hd.where === 'own' && (!navigator.onLine || T.waitingCount() > 0);
    var h = '<header class="hdr" style="padding:8px 12px 8px 8px"><div class="row" style="gap:6px"><button type="button" class="iconbtn" data-act="backToTest" aria-label="Back">' + icon('back', 26) + '</button><div class="grow col"><span style="font-size:20px;font-weight:800;line-height:1.2">Hand over</span><span class="idref">' + esc(T.testTitle(t)) + ' · ' + esc(t.test_id) + '</span></div>' + syncBadge() + '</div></header><main class="scroll" style="padding:14px 16px 20px">';
    h += '<div class="field"><span class="lbl" style="font-size:18px">Who records next?</span><div class="col" style="gap:6px">' + (list.length ? list.map(function (p) {
      return '<button type="button" class="person" aria-pressed="' + (p.username === hd.to) + '" data-act="handTo" data-u="' + esc(p.username) + '">' + avatar(p.name) + '<span class="grow">' + esc(p.name) + '</span>' + (p.username === hd.to ? icon('check') : '') + '</button>';
    }).join('') : '<div class="empty"><b>No other people yet</b></div>') + '</div></div>';
    if (to) {
      h += '<div class="field"><span class="lbl">' + esc(to.name) + ' will record on</span><div class="seg" style="grid-template-columns:1fr 1fr" role="radiogroup"><button type="button" role="radio" aria-checked="' + (hd.where === 'own') + '" data-act="handWhere" data-w="own">' + icon('phone', 22) + 'Own phone</button><button type="button" role="radio" aria-checked="' + (hd.where === 'this') + '" data-act="handWhere" data-w="this">' + icon('phone', 22) + 'This phone ' + esc(st.phone) + '</button></div></div>';
      if (needSync) h += '<div class="banner warn">' + icon('cloudOff') + '<span class="grow"><b>Sync first, then hand over</b><br>' + (navigator.onLine ? T.waitingCount() + ' item(s) are still on this phone. ' : 'You are offline. ') + esc(to.name) + "'s phone cannot get your readings yet.<br><button type=\"button\" class=\"smallbtn\" style=\"margin-top:8px\" data-act=\"syncNow\">" + icon('syncArrows', 18) + ' Try sync now</button></span></div>';
      h += '<div class="field"><label for="h-note">Note for ' + esc(to.name) + ' <span class="muted" style="font-weight:400">· optional</span></label><textarea id="h-note" class="inp" rows="3" data-in="handNote">' + esc(hd.note) + '</textarea></div>';
    }
    h += '</main><footer class="foot"><button type="button" class="btn" data-act="doHandover"' + (!to || needSync ? ' disabled' : '') + '>' + icon('swap') + 'Hand over' + (to ? ' to ' + esc(to.name) : '') + '</button></footer>';
    return h;
  }

  /* ---------- sheets ---------- */
  function sheetHtml() {
    var s = ui.sheet, p = parts(), b = p[0] === 't' ? S().tests[p[1]] : null, h = '';
    if (!s) return '';
    var open = '<div class="scrim" data-act="closeSheet"><div class="sheet"><span class="grab"></span>', close = '</div></div>';
    if (s.name === 'column') return columnSheet();
    if (s.name === 'password') return '';
    if (s.name === 'menu') {
      return open + '<div class="col"><h2>' + esc(T.testTitle(b.test)) + '</h2><span class="idref">' + esc(b.test.test_id) + '</span></div><button type="button" class="menuitem" data-act="toSetupEdit">' + icon('pencil', 24) + '<span class="grow">Change setup</span>' + icon('chevron', 20) + '</button><button type="button" class="menuitem" data-act="toHandover">' + icon('swap', 24) + '<span class="grow">Hand over</span>' + icon('chevron', 20) + '</button><button type="button" class="menuitem" data-act="toFinish">' + icon('flag', 24) + '<span class="grow">Finish test</span>' + icon('chevron', 20) + '</button><button type="button" class="menuitem" data-act="addColumn">' + icon('plus', 24) + '<span class="grow">Add column</span>' + icon('chevron', 20) + '</button><button type="button" class="menuitem" data-act="settings">' + icon('settings', 24) + '<span class="grow">Settings</span>' + icon('chevron', 20) + '</button><button type="button" class="menuitem bad" data-act="deleteSheet">' + icon('trash', 24) + '<span class="grow">' + (b.readings.length ? 'Delete test' : 'Discard test') + '</span>' + icon('chevron', 20) + '</button><button type="button" class="btn second" data-act="closeSheet">Close</button>' + close;
    }
    if (s.name === 'interval') {
      var cur = s.value, last = b.readings.reduce(function (m, r) { return r.time > m ? r.time : m; }, b.test.started_at || ''), next = cur ? new Date(U.toDate(last).getTime() + cur * 60000) : null;
      return open + '<h2>Reading interval and alarm</h2>' + intervalField(cur, 'sheet') + alarmRow(s.alarm, 'sheetAlarm') +
        (next ? '<p class="tip">' + icon('timer') + '<span>Next reading will be at <strong class="num" style="color:var(--ink)">' + U.pad(next.getHours()) + ':' + U.pad(next.getMinutes()) + '</strong></span></p>' : '') +
        '<button type="button" class="btn" data-act="intervalSave">' + icon('check') + 'Save</button>' + close;
    }
    if (s.name === 'delete') {
      var nR = b.readings.length;
      return open + '<div class="col"><h2>' + (nR ? 'Delete' : 'Discard') + ' ' + esc(T.testTitle(b.test)) + '?</h2><span class="idref">' + esc(b.test.test_id) + '</span></div>' +
        (nR ? '<div class="banner bad">' + icon('warn') + '<span><b>' + nR + ' reading' + (nR === 1 ? '' : 's') + ' will be hidden</b><br>The test is locked and removed from the lists. The data stays in the Google Sheet.</span></div>' + field('Reason', '<textarea class="inp" rows="3" id="del-reason" data-in="delReason">' + esc(s.reason || '') + '</textarea>') : '') +
        '<button type="button" class="btn bad" data-act="doDelete">' + icon('trash') + (nR ? 'Yes, delete test' : 'Yes, discard test') + '</button><button type="button" class="btn second" data-act="closeSheet">No, go back</button>' + close;
    }
    if (s.name === 'time') {
      return open + '<h2>' + esc(s.title) + '</h2>' + field('Time', '<input class="inp mono" type="datetime-local" id="time-in" value="' + esc((s.value || U.localISO()).slice(0, 16)) + '">') +
        '<button type="button" class="btn" data-act="timeSave">' + icon('check') + 'Use this time</button><button type="button" class="btn second" data-act="timeReset">' + icon('clock') + 'Use phone time</button>' + close;
    }
    if (s.name === 'comp') {
      return open + '<h2>Compressor on-time</h2><p class="muted">Auto: <strong class="num" style="color:var(--ink)">' + U.dur(s.auto) + '</strong></p><div class="grid2">' + field('Hours', '<input class="inp mono" inputmode="numeric" id="comp-h" value="' + Math.floor(s.value / 60) + '">') + field('Minutes', '<input class="inp mono" inputmode="numeric" id="comp-m" value="' + (s.value % 60) + '">') + '</div><button type="button" class="btn" data-act="compSave">' + icon('check') + 'Save</button><button type="button" class="btn second" data-act="compReset">Use auto value</button>' + close;
    }
    if (s.name === 'lock') {
      var f = finishDraft(b), end = f.ended_at || U.localISO(), en = T.energy(b);
      return open + '<div class="col"><h2>Finish and lock ' + esc(T.testTitle(b.test)) + '?</h2><span class="idref">' + esc(b.test.test_id) + '</span></div><p class="muted" style="font-size:17px">You cannot add or change readings after this.</p><div class="grid2">' + stat('Readings', b.readings.length) + stat('Total time', U.dur(U.minsBetween(b.test.started_at, end))) + (en && en.total !== null ? stat('Energy', en.total.toFixed(2) + ' kWh') : '') + '</div><button type="button" class="btn" data-act="doFinish">' + icon('lock') + 'Yes, finish and lock</button><button type="button" class="btn second" data-act="closeSheet">No, go back</button>' + close;
    }
    if (s.name === 'takeover') {
      var who = T.personName(b.test.current_recorder), c = T.compressor(b);
      return open + '<h2 class="row">' + icon('hand', 28) + 'Take over from ' + esc(who) + '?</h2><p class="muted" style="font-size:17px">You become the recorder of <strong class="num" style="color:var(--ink)">' + esc(b.test.test_id) + '</strong>. ' + esc(who) + ' can only view it after this.</p><div class="grid2">' + stat('Readings', b.readings.length) + stat('Last sync', T.live.lastSyncAt ? U.hhmm(T.live.lastSyncAt) : '-') + (b.test.track_compressor ? stat('Compressor', c.on ? 'ON' : 'OFF') : '') + '</div>' +
        (navigator.onLine ? '' : '<div class="banner warn">' + icon('cloudOff') + '<span><b>No internet</b><br>Take over needs internet, so this phone gets the latest readings.</span></div>') +
        '<button type="button" class="btn" data-act="doTakeover"' + (navigator.onLine && !ui.busy ? '' : ' disabled') + '>' + (ui.busy ? spin() : icon('hand')) + 'Yes, take over</button><button type="button" class="btn second" data-act="closeSheet">No, go back</button>' + close;
    }
    if (s.name === 'photo') {
      return open + '<div class="between"><h2>Photo</h2><button type="button" class="iconbtn" data-act="closeSheet" aria-label="Close">' + icon('close', 26) + '</button></div><div id="photo-big" style="min-height:240px;display:grid;place-items:center;border-radius:12px;background:var(--photo);color:var(--photo-ink);overflow:hidden">' + spin() + '</div>' + close;
    }
    if (s.name === 'sync') {
      var st = S(), state = T.syncState(), n = st.outbox.length, np = T.live.photosWaiting;
      var title = { saved: 'All saved', waiting: 'Waiting to sync', saving: 'Saving…', failed: 'Could not sync', offline: 'No internet' }[state];
      var text = { saved: 'Everything is saved in the Google Sheet.', waiting: 'Your data is safe on this phone. It will send soon.', saving: 'Sending your data now.', failed: 'Your data is safe on this phone. Check the internet and try again.', offline: 'Your data is safe on this phone. It sends when internet is back.' }[state];
      h = open + '<h2>' + title + '</h2><p class="muted" style="font-size:17px">' + text + '</p><div class="grid2">' + stat('Changes waiting', n) + stat('Photos waiting', np) + '</div>' +
        '<p class="muted" style="font-size:15px">Last sync: <strong class="num" style="color:var(--ink)">' + (T.live.lastSyncAt ? U.dmhm(T.live.lastSyncAt) : 'not yet in this session') + '</strong></p>';
      if (T.live.error && state === 'failed') h += '<p class="err">' + esc(T.live.error) + '</p>';
      if (T.live.blockedUser) h += '<div class="banner warn">' + icon('warn') + '<span><b>' + esc(T.personName(T.live.blockedUser)) + ' must sign in</b><br>Some readings saved by ' + esc(T.personName(T.live.blockedUser)) + ' are waiting. They send after ' + esc(T.personName(T.live.blockedUser)) + ' signs in on this phone with internet.</span></div>';
      if (st.failed.length) h += '<div class="banner bad">' + icon('warn') + '<span><b>' + st.failed.length + ' change(s) were not accepted</b><br>' + esc(st.failed[st.failed.length - 1].error) + '<br>Tell your manager. The data is kept on this phone.</span></div>';
      h += '<button type="button" class="btn" data-act="syncNow"' + (T.live.syncing ? ' disabled' : '') + '>' + icon('syncArrows') + 'Sync now</button><button type="button" class="btn second" data-act="closeSheet">Close</button><p class="build">Build ' + T.BUILD + ' · Phone ' + esc(st.phone || '?') + '</p>' + close;
      return h;
    }
    return '';
  }

  function alarmPanel() {
    var a = T.alarm.info, url = new URL('testlog-alarm.apk', location.href).href;
    var link = function (label) { return '<a class="btn second" href="testlog-alarm.apk" download>' + icon('download') + label + '</a>'; };
    if (!a.present) return '<div class="banner warn">' + icon('timer') + '<span><b>Alarm app is not on this phone</b></span></div>' + link('Download alarm app');
    var p = a.perms || {}, rows = [['notifications', 'Show notifications'], ['exactAlarm', 'Ring at the exact time'], ['fullScreen', 'Show over the lock screen'], ['batteryExempt', 'Run when the phone saves battery']];
    var missing = rows.filter(function (r) { return p[r[0]] === false; }), old = a.shellBuild < T.alarm.LATEST_SHELL;
    var h = '<div class="between"><span class="row" style="font-weight:700">' + icon(old ? 'warn' : 'check', 20) + 'Alarm app</span><span class="chip' + (old ? ' mark' : '') + '">shell build ' + a.shellBuild + (old ? ' · new: ' + T.alarm.LATEST_SHELL : '') + '</span></div>';
    if (missing.length) h += '<span class="err">' + missing.length + ' permission' + (missing.length === 1 ? ' is' : 's are') + ' missing. The alarm may not ring.</span>';
    h += rows.map(function (r) { return '<div class="between" style="min-height:44px"><span class="row">' + icon(p[r[0]] === false ? 'warn' : 'check', 18) + r[1] + '</span>' + (p[r[0]] === false ? '<button type="button" class="smallbtn" style="height:40px" data-act="alarmPerm" data-p="' + r[0] + '">Allow</button>' : '') + '</div>'; }).join('');
    // Shell build 1 and 2 cannot download a file from inside the app, so they get the address to open in Chrome.
    if (a.shellBuild < 3) h += '<div class="banner warn">' + icon('download') + '<span><b>Update the alarm app</b><br>Open Chrome and go to:<br><strong class="num" style="word-break:break-all">' + esc(url.replace(/^https?:\/\//, '')) + '</strong></span></div>';
    else h += link(old ? 'Update alarm app' : 'Download alarm app again');
    return h;
  }
  function settingsScreen() {
    var st = S(), me = T.me(), box = function (title, inner) { return '<section class="col" style="gap:10px;padding:14px;border-radius:14px;background:var(--surface);border:1px solid var(--line)"><h2 class="h-caps">' + title + '</h2>' + inner + '</section>'; };
    var h = '<header class="hdr" style="padding:8px 12px 8px 8px"><div class="row" style="gap:6px"><button type="button" class="iconbtn" data-act="home" aria-label="Back">' + icon('back', 26) + '</button><span class="grow" style="font-size:20px;font-weight:800">Settings</span>' + syncBadge() + '</div></header><main class="scroll">';
    h += box('Account', '<div class="row" style="gap:12px">' + avatar(me.name) + '<span class="grow col"><strong style="font-size:19px">' + esc(me.name) + '</strong><span class="muted" style="font-size:14px">' + esc(me.username) + ' · ' + (me.role === 'reviewer' ? 'Reviewer' : 'Engineer') + '</span></span><button type="button" class="smallbtn" data-act="changeUser">' + icon('swap', 18) + ' Change user</button></div>');
    h += box('Alarm', alarmPanel());
    h += box('Display', '<div class="between" style="min-height:48px"><span style="font-size:17px;font-weight:700">Dark theme</span>' + switchBtn(st.theme === 'dark', 'theme', '', 'Dark theme') + '</div>');
    h += box('Computer', '<a class="btn second" href="desk.html">Open computer view' + icon('chevron') + '</a>');
    var line = function (k, v) { return '<div class="between" style="min-height:40px"><span style="font-size:17px">' + k + '</span><strong class="num" style="font-size:18px">' + v + '</strong></div>'; };
    h += box('Build numbers', line('App build', T.BUILD) + line('Alarm app build', T.alarm.info.present ? T.alarm.info.shellBuild : 'Not installed') + line('Phone code', esc(st.phone || '?')) + (T.update.state.server ? line('Newest app build', T.update.state.server) : '') + '<button type="button" class="btn second" data-act="checkUpdate"' + (ui.updBusy ? ' disabled' : '') + '>' + (ui.updBusy ? spin() : icon('retry')) + 'Check for update</button>');
    return h + '</main>';
  }

  /* ---------- change setup during a test ---------- */
  function setupList(t) { return [{ id: 'machine_code', name: 'Machine name/code' }, { id: 'mode', name: 'Machine mode' }].concat(T.setupFields(t.columns, t.product)).concat([{ id: 'notes', name: 'Notes' }]); }
  function setupOf(t) {
    var x = t.setup || {}, o = { machine_code: t.machine_code || '', mode: t.mode || '', notes: x.notes || '' };
    T.setupFields(t.columns, t.product).forEach(function (f) { o[f.id] = x[f.id] || ''; });
    return o;
  }
  function editSetupScreen(b) {
    var t = b.test, e = ui.setupEdit || (ui.setupEdit = setupOf(t)), pr = product(t.product);
    var h = '<header class="hdr" style="padding:8px 12px 8px 8px"><div class="row" style="gap:6px"><button type="button" class="iconbtn" data-act="backToTest" aria-label="Back">' + icon('back', 26) + '</button><div class="grow col"><span style="font-size:20px;font-weight:800;line-height:1.2">Change setup</span><span class="idref">' + esc(T.testTitle(t)) + ' · ' + esc(t.test_id) + '</span></div>' + syncBadge() + '</div></header><main class="scroll" style="padding:14px 16px 20px">';
    h += field('Machine name/code', '<input class="inp mono" id="se-machine_code" data-in="se" data-k="machine_code" autocapitalize="characters" value="' + esc(e.machine_code) + '">');
    if (pr.modes.length || e.mode) h += '<div class="field"><span class="lbl">Machine mode</span><div class="col" role="radiogroup" style="gap:6px">' + pr.modes.concat(e.mode && pr.modes.indexOf(e.mode) < 0 ? [e.mode] : []).map(function (m) {
      var on = e.mode === m;
      return '<button type="button" class="radio" role="radio" aria-checked="' + on + '" data-act="seMode" data-m="' + esc(m) + '">' + (on ? icon('check', 22) : '') + '<span class="grow">' + esc(m) + '</span></button>';
    }).join('') + '</div></div>';
    h += setupInputs(T.setupFields(t.columns, t.product), e, 'se');
    h += field('Notes', '<textarea class="inp" rows="3" id="se-notes" data-in="se" data-k="notes">' + esc(e.notes) + '</textarea>');
    h += '<div class="field"><span class="lbl">Photos</span>' + photoRow(t.test_id, '', '', true) + '</div>';
    h += '<button type="button" class="btn second" data-act="intervalSheet">' + icon('timer') + 'Reading interval and alarm</button>';
    return h + '</main><footer class="foot two"><button type="button" class="btn second" style="height:60px" data-act="backToTest">Back</button><button type="button" class="btn" data-act="saveSetup">' + icon('check') + 'Save setup</button></footer>';
  }

  /* ---------- render ---------- */
  var lastRouteKey = '';
  function render() {
    var st = S(), p = parts(), html, key = p.join('/');
    var main = root.querySelector('main'), keepScroll = main && key === lastRouteKey ? main.scrollTop : 0;
    var focus = document.activeElement && document.activeElement.id && key === lastRouteKey ? document.activeElement.id : null;
    lastRouteKey = key;
    if (!st.current || !T.me()) html = signinScreen();
    else if (p[0] === 'new' && p[1] === 'template') html = templateScreen();
    else if (p[0] === 'new' && p[1] === 'columns') html = columnsScreen();
    else if (p[0] === 'new') html = setupScreen();
    else if (p[0] === 't' && st.tests[p[1]]) {
      var b = st.tests[p[1]], mine = T.iAmRecorder(b);
      if (p[2] === 'r') { var r = b.readings.find(function (x) { return x.reading_id === p[3]; }); html = r ? editScreen(b, r) : (mine ? recordScreen(b) : viewScreen(b)); }
      else if (p[2] === 'finish' && mine) html = finishScreen(b);
      else if (p[2] === 'handover' && mine) html = handoverScreen(b);
      else if (p[2] === 'setup' && mine) html = editSetupScreen(b);
      else html = mine ? recordScreen(b) : viewScreen(b);
    } else if (p[0] === 'settings') html = settingsScreen();
    else html = homeScreen();
    var offline = !navigator.onLine && st.current ? '<div class="offline-bar">' + icon('cloudOff', 18) + 'No internet. Readings are saved on this phone.</div>' : '';
    root.innerHTML = '<div class="fz ph' + (st.theme === 'dark' ? ' fz-dark' : '') + '">' + offline + html + (st.current ? sheetHtml() : '') + (ui.toast ? '<div class="toast" role="status">' + icon(ui.toast.kind === 'bad' ? 'warn' : ui.toast.kind === 'phone' ? 'phoneOk' : 'check') + '<span>' + esc(ui.toast.text) + '</span></div>' : '') + '</div>';
    document.body.classList.toggle('dark', st.theme === 'dark');
    main = root.querySelector('main');
    if (main && keepScroll) main.scrollTop = keepScroll;
    if (focus) { var f = document.getElementById(focus); if (f) f.focus(); }
    var auto = root.querySelector('[autofocus]'); if (auto) auto.focus();
    loadThumbs();
  }
  function loadThumbs() {
    root.querySelectorAll('.thumb[data-photo-id]').forEach(function (el) {
      T.photoSrc(el.dataset.photoId).then(function (src) {
        if (!el.isConnected) return;
        var img = new Image(); img.src = src; img.alt = '';
        var svg = el.querySelector('svg.i'); if (svg) svg.replaceWith(img);
      }).catch(function () {});
    });
    var big = document.getElementById('photo-big');
    if (big && ui.sheet && ui.sheet.name === 'photo') T.photoSrc(ui.sheet.id).then(function (src) { if (big.isConnected) big.innerHTML = '<img src="' + src + '" alt="Photo" style="width:100%;height:auto;display:block">'; }).catch(function () { if (big.isConnected) big.innerHTML = '<span style="padding:20px;text-align:center">Photo is not on this phone. It needs internet.</span>'; });
  }

  /* ---------- once a second: clocks, countdowns, reminders ---------- */
  function beep() {
    try {
      var A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      var ctx = beep.ctx || (beep.ctx = new A()), t0 = ctx.currentTime;
      [0, 0.35, 0.7].forEach(function (d) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.25);
        o.start(t0 + d); o.stop(t0 + d + 0.3);
      });
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }
  function tick() {
    var st = S(); if (!st || !st.current) return;
    var p = parts(), b = p[0] === 't' ? st.tests[p[1]] : null, now = U.localISO();
    root.querySelectorAll('[data-tick]').forEach(function (el) {
      var k = el.dataset.tick;
      if (k === 'clock') el.textContent = U.hhmm(now);
      else if (k === 'elapsed' && b && b.test.status !== 'finished') el.textContent = elapsedText(b);
      else if (k === 'count' && b) el.outerHTML = countTile(b, T.iAmRecorder(b));
      else if (k === 'comp' && b) el.outerHTML = compTile(b, T.iAmRecorder(b));
      else if (k === 'pill' && st.tests[el.dataset.id]) { var due = T.nextDue(st.tests[el.dataset.id]); el.innerHTML = pillText(due); el.classList.toggle('due', !!due && due <= Date.now()); }
    });
    // The grey numbers follow the clock: they are worked out again every second for the time in the Time box.
    if (b && p.length === 2 && T.iAmRecorder(b)) {
      var at = (st.drafts[b.test.test_id] || {}).time || now;
      root.querySelectorAll('main input[data-in=val][data-pred]').forEach(function (el) {
        var col = b.test.columns.find(function (c) { return c.id === el.dataset.c; });
        if (!col) return;
        var v = T.predict(b, col, at).value;
        if (el.dataset.pred !== v) { el.dataset.pred = v; el.placeholder = v; }
      });
    }
    Object.keys(st.tests).forEach(function (id) {
      var x = st.tests[id]; if (!T.iAmRecorder(x) || T.alarm.info.present || !T.alarm.alarmOn(x.test)) return;
      var due = T.nextDue(x); if (!due || due > Date.now()) return;
      var key = id + '|' + due.getTime();
      if (ui.beeped[key] || Date.now() - due > 120000) { ui.beeped[key] = true; return; }
      ui.beeped[key] = true; beep();
      if (window.Notification && Notification.permission === 'granted' && document.hidden) { try { new Notification('Reading is due', { body: id + ' · Take reading ' + T.nextNo(x) }); } catch (e) {} }
    });
  }

  /* ---------- actions ---------- */
  function curTest() { var p = parts(); return p[0] === 't' ? S().tests[p[1]] : null; }
  function cleanNumber(v) {
    var c = String(v).replace(',', '.').replace(/[^0-9.\-]/g, '').replace(/(?!^)-/g, '').replace(/(\..*)\./g, '$1'), n = Number(c);
    if (n > T.LIMIT) return String(T.LIMIT);
    if (n < -T.LIMIT) return String(-T.LIMIT);
    return c;
  }
  var actions = {
    home: function () { go(''); },
    closeSheet: function () { ui.sheet = null; ui.err = ''; render(); },
    syncSheet: function () { ui.sheet = { name: 'sync' }; render(); },
    syncNow: function () { T.sync(); },
    theme: function () { S().theme = S().theme === 'dark' ? 'light' : 'dark'; T.save(); render(); },
    changeUser: function () { T.signOut(); go(''); },
    toggleFinished: function () { ui.allFinished = !ui.allFinished; render(); },
    pickUser: function (el) { ui.err = ''; ui.sheet = { name: 'password', username: el.dataset.u }; render(); },
    setupAdmin: function () {
      var name = document.getElementById('su-name').value.trim(), user = document.getElementById('su-user').value.trim(), pass = document.getElementById('su-pass').value;
      if (!user || pass.length < 6) { ui.err = 'Give a username and a password of 6 or more letters.'; return render(); }
      ui.busy = true; ui.err = ''; render();
      T.signIn(user, pass, { setup: true, name: name || user }).then(function () { ui.busy = false; ui.serverUsers = true; go(''); }, function (e) { ui.busy = false; ui.err = e.message; render(); });
    },
    open: function (el) { go('t/' + encodeURIComponent(el.dataset.id)); },
    startNew: function () {
      if (!S().templates.length && !S().newTest) toast('No templates on this phone yet. You can still add columns by hand.', 'phone');
      ensureDraft(); go('new');
    },
    resumeNew: function () { go('new'); },
    discardNew: function () { S().newTest = null; T.save(); go(''); },
    toSetup: function () { go('new'); },
    toColumns: function () { go('new/columns'); },
    pickTemplate: function () { ui.tplSearch = ''; go('new/template'); },
    useTemplate: function (el) { var t = S().templates.find(function (x) { return x.id === el.dataset.id; }); if (t) { applyTemplate(S().newTest, t); T.save(); } go('new'); },
    mode: function (el) { var d = S().newTest; d.mode = d.mode === el.dataset.m ? '' : el.dataset.m; T.save(); render(); },
draftAlarm: function () { var d = S().newTest; d.setup.alarm = d.setup.alarm === false; T.save(); render(); },
    sheetAlarm: function () { ui.sheet.alarm = !ui.sheet.alarm; render(); },
    alarmPerm: function (el) { T.alarm.request(el.dataset.p); },
    trackComp: function () { var d = S().newTest; d.track_compressor = !d.track_compressor; T.save(); render(); },
    colToggle: function (el) { var c = S().newTest.columns[el.dataset.i]; c.on = c.on === false; T.save(); render(); },
    colEdit: function (el) { var i = Number(el.dataset.i); ui.err = ''; ui.sheet = { name: 'column', where: 'draft', index: i, col: JSON.parse(JSON.stringify(S().newTest.columns[i])) }; render(); },
    colAdd: function () { ui.err = ''; ui.sheet = { name: 'column', where: 'draft', index: -1, col: { id: 'c' + U.uid().slice(0, 8), name: '', type: 'number', unit: '°C', options: [], on: true } }; render(); },
    addColumn: function () { ui.err = ''; ui.sheet = { name: 'column', where: 'running', index: -1, col: { id: 'c' + U.uid().slice(0, 8), name: '', type: 'number', unit: '°C', options: [], on: true } }; render(); },
    colType: function (el) { var c = ui.sheet.col; c.type = el.dataset.t; if (c.type !== 'number') c.unit = ''; else if (!c.unit) c.unit = '°C'; render(); },
    colUnit: function (el) { ui.sheet.col.unit = el.dataset.u; render(); },
    colMove: function (el) {
      var cols = S().newTest.columns, i = ui.sheet.index, j = i + Number(el.dataset.d);
      if (j < 0 || j >= cols.length) return;
      var x = cols[i]; cols[i] = cols[j]; cols[j] = x; ui.sheet.index = j; T.save(); render();
    },
    colDelete: function () { S().newTest.columns.splice(ui.sheet.index, 1); ui.sheet = null; T.save(); render(); },
    colDone: function () {
      var s = ui.sheet, c = s.col;
      c.name = (c.name || '').trim();
      if (!c.name) { ui.err = 'Give the column a name.'; return render(); }
      if (c.type === 'pick' && (!c.options || c.options.length < 2)) { ui.err = 'Give 2 or more choices. Example: Off, Slow, Fast'; return render(); }
      if (s.where === 'draft') {
        var cols = S().newTest.columns;
        if (s.index < 0) cols.push(c); else cols[s.index] = c;
        T.save();
      } else {
        var b = curTest(), cols2 = b.test.columns.slice();
        c.added_at_no = T.nextNo(b);
        cols2.push(c);
        T.act('test.update', { test_id: b.test.test_id, patch: { columns: cols2 } });
        T.act('event.add', { event: { event_id: U.uid(), test_id: b.test.test_id, kind: 'column_added', time: U.localISO(), text: 'Column added: ' + c.name + (c.unit ? ' (' + c.unit + ')' : '') } });
      }
      ui.sheet = null; ui.err = ''; render();
    },
    startTest: function () {
      var st = S(), d = st.newTest;
      if (!d.columns.some(function (c) { return c.on !== false; })) return toast('Add or switch on 1 column first.', 'bad');
      var test = JSON.parse(JSON.stringify(d));
      test.columns = test.columns.concat(test.setup_fields || []); delete test.setup_fields;
      test.started_at = U.localISO();
      T.act('test.create', { test: test });
      if (d.template_id) st.recentTemplates = [d.template_id].concat(st.recentTemplates.filter(function (x) { return x !== d.template_id; })).slice(0, 5);
      st.newTest = null; T.save();
      if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
      go('t/' + encodeURIComponent(test.test_id));
    },
    menu: function () { ui.sheet = { name: 'menu' }; render(); },
    backToTest: function () { ui.edit = null; ui.setupEdit = null; go('t/' + encodeURIComponent(parts()[1])); },
    toFinish: function () { go('t/' + encodeURIComponent(parts()[1]) + '/finish'); },
    settings: function () { T.alarm.refresh().then(function () { if (parts()[0] === 'settings') render(); }); go('settings'); },
    toSetupEdit: function () { ui.setupEdit = null; go('t/' + encodeURIComponent(parts()[1]) + '/setup'); },
    setupPick: function (el) { var o = el.dataset.w === 'se' ? ui.setupEdit : S().newTest.setup; o[el.dataset.k] = o[el.dataset.k] === el.dataset.v ? '' : el.dataset.v; T.save(); render(); },
    seMode: function (el) { ui.setupEdit.mode = ui.setupEdit.mode === el.dataset.m ? '' : el.dataset.m; render(); },
    saveSetup: function () {
      var b = curTest(), t = b.test, e = ui.setupEdit, old = setupOf(t), changed = [];
      var vals = {};
      setupList(t).forEach(function (f) { e[f.id] = String(e[f.id] || '').trim(); if (f.id !== 'machine_code' && f.id !== 'mode') vals[f.id] = e[f.id]; if (e[f.id] !== old[f.id]) changed.push(f.name + ': ' + (old[f.id] || 'blank') + ' → ' + (e[f.id] || 'blank')); });
      if (changed.length) {
        T.act('test.update', { test_id: t.test_id, patch: { machine_code: e.machine_code, mode: e.mode, setup: Object.assign({}, t.setup, vals) } });
        T.act('event.add', { event: { event_id: U.uid(), test_id: t.test_id, kind: 'setup', time: U.localISO(), text: 'Setup changed. ' + changed.join('; ') } });
      }
      ui.setupEdit = null; go('t/' + encodeURIComponent(t.test_id));
      toast(changed.length ? 'Setup changed.' : 'Nothing was changed.');
    },
    toHandover: function () { ui.hand = null; go('t/' + encodeURIComponent(parts()[1]) + '/handover'); },
    intervalSheet: function () { var t = curTest().test; ui.sheet = { name: 'interval', value: t.interval_min || 15, alarm: !(t.setup && t.setup.alarm === false) }; render(); },
    intervalPick: function (el) { if (el.dataset.w === 'draft') { S().newTest.interval_min = Number(el.dataset.m); T.save(); } else ui.sheet.value = Number(el.dataset.m); render(); },
    intervalSave: function () {
      var b = curTest(), v = Math.round(Number(ui.sheet.value));
      if (!v || v < 1) return toast('Give the minutes. Example: 15', 'bad');
      if (v !== b.test.interval_min) {
        T.act('test.update', { test_id: b.test.test_id, patch: { interval_min: v } });
        T.act('event.add', { event: { event_id: U.uid(), test_id: b.test.test_id, kind: 'interval', time: U.localISO(), text: 'Reading interval changed to ' + v + ' min' } });
      }
      var wasOn = !(b.test.setup && b.test.setup.alarm === false);
      if (wasOn !== ui.sheet.alarm) {
        T.act('test.update', { test_id: b.test.test_id, patch: { setup: Object.assign({}, b.test.setup, { alarm: ui.sheet.alarm }) } });
        T.act('event.add', { event: { event_id: U.uid(), test_id: b.test.test_id, kind: 'interval', time: U.localISO(), text: 'Alarm switched ' + (ui.sheet.alarm ? 'ON' : 'OFF') } });
      }
      ui.sheet = null; render();
    },
    compressor: function () {
      var b = curTest(), c = T.compressor(b), on = !c.on, now = U.localISO();
      T.act('event.add', { event: { event_id: U.uid(), test_id: b.test.test_id, kind: on ? 'compressor_on' : 'compressor_off', time: now, text: 'Compressor ' + (on ? 'ON' : 'OFF') } });
      toast('Compressor ' + (on ? 'ON' : 'OFF') + ' saved at ' + U.hhmm(now));
    },
    plusMinus: function (el) {
      var inp = document.getElementById('in-' + el.dataset.c), v = inp.value;
      inp.value = v[0] === '-' ? v.slice(1) : '-' + v;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    },
    // One press of + or - on an empty box puts in the grey number. Every press after that moves it by one point (1, 0.1 or 0.01).
    spin: function (el) {
      var inp = document.getElementById('in-' + el.dataset.c), v = inp.value.trim(), dec = Math.max(Number(inp.dataset.dec || 0), T.decimalsOf(v)), step = Math.pow(10, -dec), d = Number(el.dataset.d), n;
      if (v === '' || v === '-' || isNaN(Number(v))) n = inp.dataset.pred !== '' ? Number(inp.dataset.pred) : d * step;
      else n = Number(v) + d * step;
      inp.value = Math.max(-T.LIMIT, Math.min(T.LIMIT, n)).toFixed(dec);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    },
    deleteSheet: function () { ui.sheet = { name: 'delete', reason: '' }; render(); },
    doDelete: function () {
      var b = curTest(), st = S(), id = b.test.test_id, n = b.readings.length, reason = n ? (ui.sheet.reason || '').trim() : 'No readings';
      if (!reason) return toast('Write the reason first.', 'bad');
      var opId = function (o) { var q = o.payload; return q.test_id || (q.test && q.test.test_id) || (q.reading && q.reading.test_id) || (q.event && q.event.test_id) || (q.note && q.note.test_id); };
      var neverSent = !T.live.syncing && st.outbox.some(function (o) { return o.type === 'test.create' && o.payload.test.test_id === id; });
      if (neverSent) {
        // The test never reached the Sheet, so it is simply removed from this phone.
        st.outbox = st.outbox.filter(function (o) { return opId(o) !== id; });
        delete st.tests[id];
        T.photosDb.all().then(function (all) { all.forEach(function (ph) { if (ph.test_id === id) T.photosDb.del(ph.photo_id); }); });
      } else {
        var now = U.localISO();
        T.act('event.add', { event: { event_id: U.uid(), test_id: id, kind: 'deleted', time: now, text: 'Test deleted by ' + T.me().name + '. Reason: ' + reason } });
        T.act('test.finish', { test_id: id, ended_at: now, final_remarks: '[DELETED] ' + reason, comp_on_min: null, event_id: U.uid() });
      }
      delete st.drafts[id]; delete st.drafts['finish:' + id]; T.save();
      go(''); toast(n ? 'Test deleted.' : 'Test discarded.');
    },
    pickVal: function (el) {
      var p = parts(), target = p[2] === 'r' ? ui.edit.values : draftOf(curTest()).values;
      target[el.dataset.c] = target[el.dataset.c] === el.dataset.v ? '' : el.dataset.v;
      T.save(); render();
    },
    timeSheet: function () {
      var p = parts();
      ui.sheet = p[2] === 'r' ? { name: 'time', target: 'edit', title: 'Change time of reading', value: ui.edit.time } : { name: 'time', target: 'draft', title: 'Change time of this reading', value: draftOf(curTest()).time };
      render();
    },
    endTimeSheet: function () { ui.sheet = { name: 'time', target: 'end', title: 'Change end time', value: finishDraft(curTest()).ended_at }; render(); },
    timeSave: function () {
      var v = document.getElementById('time-in').value; if (!v) return;
      v = v.length === 16 ? v + ':00' : v;
      var b = curTest();
      if (ui.sheet.target === 'edit') ui.edit.time = v; else if (ui.sheet.target === 'end') finishDraft(b).ended_at = v; else draftOf(b).time = v;
      ui.sheet = null; T.save(); render();
    },
    timeReset: function () {
      var b = curTest();
      if (ui.sheet.target === 'edit') { var r = b.readings.find(function (x) { return x.reading_id === ui.edit.reading_id; }); ui.edit.time = r.phone_time || r.time; }
      else if (ui.sheet.target === 'end') finishDraft(b).ended_at = ''; else draftOf(b).time = '';
      ui.sheet = null; T.save(); render();
    },
    saveReading: function () {
      var b = curTest(), d = draftOf(b), values = {}, any = false, now = U.localISO(), no = T.nextNo(b);
      T.activeColumns(b.test).forEach(function (c) { var v = d.values[c.id]; if (v !== undefined && String(v).trim() !== '' && v !== '-') { values[c.id] = String(v).trim(); any = true; } });
      if (!any && !d.note.trim() && !photosOf(b, d.reading_id).length) return toast('Fill 1 value or a note first.', 'bad');
      T.act('reading.save', { reading: { reading_id: d.reading_id, test_id: b.test.test_id, no: no, time: d.time || now, time_changed: !!d.time, phone_time: now, values: values, note: d.note.trim(), saved_at: now } });
      delete S().drafts[b.test.test_id]; T.save();
      var m = root.querySelector('main'); if (m) m.scrollTop = 0;
      lastRouteKey = '';
      toast('Reading ' + no + (navigator.onLine ? ' saved' : ' saved on phone. It will sync when internet is back.'), navigator.onLine ? 'ok' : 'phone');
    },
    openReading: function (el) { ui.edit = null; go('t/' + encodeURIComponent(parts()[1]) + '/r/' + encodeURIComponent(el.dataset.rid)); },
    saveEdit: function () {
      var b = curTest(), e = ui.edit, r = b.readings.find(function (x) { return x.reading_id === e.reading_id; }), values = {};
      Object.keys(e.values).forEach(function (k) { var v = String(e.values[k] === undefined ? '' : e.values[k]).trim(); if (v !== '' && v !== '-') values[k] = v; });
      var same = JSON.stringify(values) === JSON.stringify(r.values) && e.note.trim() === (r.note || '') && e.time === r.time;
      if (!same) T.act('reading.save', { reading: { reading_id: r.reading_id, test_id: r.test_id, no: r.no, time: e.time, time_changed: r.time_changed || e.time !== r.time, phone_time: r.phone_time, values: values, note: e.note.trim(), saved_at: r.saved_at } });
      ui.edit = null; go('t/' + encodeURIComponent(parts()[1]));
      toast(same ? 'Nothing was changed.' : 'Reading ' + r.no + ' changed. Old values are kept.');
    },
    compSheet: function () { var b = curTest(), f = finishDraft(b), auto = Math.round(T.compressor(b, f.ended_at || U.localISO()).totalMin); ui.sheet = { name: 'comp', auto: auto, value: f.comp_min !== null ? f.comp_min : auto }; render(); },
    compSave: function () { var h = Number(document.getElementById('comp-h').value) || 0, m = Number(document.getElementById('comp-m').value) || 0, v = Math.max(0, Math.round(h * 60 + m)); finishDraft(curTest()).comp_min = v === ui.sheet.auto ? null : v; ui.sheet = null; T.save(); render(); },
    compReset: function () { finishDraft(curTest()).comp_min = null; ui.sheet = null; T.save(); render(); },
    lockSheet: function () { ui.sheet = { name: 'lock' }; render(); },
    doFinish: function () {
      var b = curTest(), f = finishDraft(b), end = f.ended_at || U.localISO(), id = b.test.test_id;
      var auto = Math.round(T.compressor(b, end).totalMin);
      T.act('test.finish', { test_id: id, ended_at: end, end_time_changed: !!f.ended_at, final_remarks: f.remarks.trim(), comp_on_min: b.test.track_compressor ? (f.comp_min !== null ? f.comp_min : auto) : null, comp_on_edited: f.comp_min !== null, event_id: U.uid() });
      delete S().drafts['finish:' + id]; delete S().drafts[id]; T.save();
      go(''); toast(id + ' is finished and locked.');
    },
    handTo: function (el) { ui.hand.to = el.dataset.u; render(); },
    handWhere: function (el) { ui.hand.where = el.dataset.w; render(); },
    doHandover: function () {
      var b = curTest(), hd = ui.hand, name = T.personName(hd.to), same = hd.where === 'this';
      T.act('test.handover', { test_id: b.test.test_id, to: hd.to, note: hd.note.trim(), time: U.localISO(), event_id: U.uid(), same_phone: same });
      ui.hand = null;
      if (same) { S().lastUser = hd.to; T.signOut(); go(''); toast('Handed over. Now ' + name + ' signs in.'); }
      else { go(''); toast('Handed over to ' + name + '.'); }
    },
    takeOver: function () { ui.sheet = { name: 'takeover' }; render(); T.sync(); },
    doTakeover: function () {
      var b = curTest(); if (!navigator.onLine) return render();
      ui.busy = true; render();
      T.sync().then(function () {
        ui.busy = false;
        var fresh = curTest();
        if (!fresh || fresh.test.status === 'finished') { ui.sheet = null; return toast('This test is already finished.', 'bad'); }
        T.act('test.takeover', { test_id: b.test.test_id, time: U.localISO(), event_id: U.uid() });
        ui.sheet = null; toast('You are the recorder now.');
      });
    },
    addNote: function () {
      var b = curTest(), text = (ui.addNote || '').trim();
      if (!text) return toast('Write the note first.', 'bad');
      T.act('note.add', { note: { note_id: U.uid(), test_id: b.test.test_id, reading_id: '', text: text } });
      ui.addNote = ''; toast('Note added.');
    },
    checkUpdate: function () {
      ui.updBusy = true; render();
      T.update.check().then(function (r) {
        ui.updBusy = false;
        if (!r.server) toast('Could not check. No internet.', 'bad');
        else if (r.server > r.mine) toast('Build ' + r.server + ' is downloading. The app restarts by itself.', 'phone');
        else toast('This is the newest build.');
      });
    },
    dismissNote: function (el) { S().seenTakeover['note:' + el.dataset.id] = true; T.save(); render(); },
    torch: function () { T.torch.toggle().then(function (r) { if (r.error) toast(r.error, 'bad'); }); },
    viewPhoto: function (el) { ui.sheet = { name: 'photo', id: el.dataset.photoId }; render(); }
  };

  root.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.classList.contains('scrim') && ev.target !== el) return;   // a tap inside the sheet must not close it
    if (el.dataset.act === 'spin' && hold.n) { hold.n = 0; return; }
    var fn = actions[el.dataset.act];
    if (fn) fn(el, ev);
  });
  // Hold + or - to keep moving the number.
  var hold = { t: null, n: 0 };
  function stopHold() { clearTimeout(hold.t); hold.t = null; }
  root.addEventListener('pointerdown', function (ev) {
    var el = ev.target.closest('[data-act=spin]');
    if (el) {
      stopHold(); hold.n = 0;
      hold.t = setTimeout(function again() { hold.n++; actions.spin(el); hold.t = setTimeout(again, 90); }, 450);
      return;
    }
    // Drag a column by its handle to change the order.
    var h = ev.target.closest('[data-drag]');
    if (!h || !S().newTest) return;
    ev.preventDefault();
    var li = h.closest('li'), rows = Array.prototype.slice.call(li.parentNode.children), from = rows.indexOf(li), to = from;
    var main = root.querySelector('main'), y0 = ev.clientY, s0 = main.scrollTop, rects = rows.map(function (r) { return r.getBoundingClientRect(); });
    try { h.setPointerCapture(ev.pointerId); } catch (e) {}
    li.classList.add('dragging');
    function move(e) {
      var mr = main.getBoundingClientRect();
      if (e.clientY > mr.bottom - 56) main.scrollTop += 14; else if (e.clientY < mr.top + 56) main.scrollTop -= 14;
      var dy = e.clientY - y0 + (main.scrollTop - s0), mid = rects[from].top + rects[from].height / 2 + dy;
      li.style.transform = 'translateY(' + dy + 'px)';
      to = from;
      rows.forEach(function (r, i) {
        if (i === from) return;
        var m = rects[i].top + rects[i].height / 2, shift = 0;
        if (i > from && mid > m) { shift = -rects[from].height; to = Math.max(to, i); }
        if (i < from && mid < m) { shift = rects[from].height; to = Math.min(to, i); }
        r.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
      });
    }
    function up() {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      if (to !== from) { var cols = S().newTest.columns, x = cols.splice(from, 1)[0]; cols.splice(to, 0, x); T.save(); }
      render();
    }
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { window.addEventListener(n, stopHold); });
  // Typing moves to the next box by itself once the number has its usual digits after the point.
  // Example: TE-1 was 30.6 last time (1 digit after the point), so typing 29.5 jumps to the next box.
  // A box that already had a value when it was tapped does not jump, so a value can be corrected in peace.
  function nextBox(el) {
    var list = Array.prototype.slice.call(root.querySelectorAll('main input[data-in=val]')), nx = list[list.indexOf(el) + 1];
    if (nx) { nx.focus(); if (nx.scrollIntoView) nx.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else el.blur();
  }
  root.addEventListener('focusin', function (ev) { var el = ev.target; if (el.matches && el.matches('input[data-in=val]')) el.dataset.had = el.value !== '' ? '1' : ''; });
  root.addEventListener('keydown', function (ev) { var el = ev.target; if (ev.key === 'Enter' && el.matches && el.matches('input[data-in=val]')) { ev.preventDefault(); nextBox(el); } });
  root.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (ev.target.dataset.form !== 'signin') return;
    var pw = document.getElementById('pw').value, user = ui.sheet.username;
    if (!pw) return;
    ui.busy = true; ui.err = ''; render();
    T.signIn(user, pw).then(function () { ui.busy = false; ui.sheet = null; go(''); }, function (e) { ui.busy = false; ui.err = e.message; render(); });
  });
  root.addEventListener('input', function (ev) {
    var el = ev.target, k = el.dataset.in, st = S();
    if (!k) return;
    if (k === 'draft') st.newTest[el.dataset.k] = el.value;
    else if (k === 'setup') { if (el.inputMode === 'decimal') el.value = cleanNumber(el.value); st.newTest.setup[el.dataset.k] = el.value; }
    else if (k === 'tplSearch') { ui.tplSearch = el.value; clearTimeout(ui.searchTimer); ui.searchTimer = setTimeout(function () { render(); var i = root.querySelector('[data-in=tplSearch]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); return; }
    else if (k === 'colName') ui.sheet.col.name = el.value;
    else if (k === 'colUnit') ui.sheet.col.unit = el.value;
    else if (k === 'colOptions') ui.sheet.col.options = el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    else if (k === 'interval') {
      var mins = Math.min(1440, Number(el.value.replace(/\D/g, '')) || 0);
      if (String(mins || '') !== el.value) el.value = mins || '';
      if (el.dataset.w === 'draft') st.newTest.interval_min = mins; else { ui.sheet.value = mins; return; }
      root.querySelectorAll('[data-act=intervalPick]').forEach(function (x) { x.setAttribute('aria-checked', String(Number(x.dataset.m) === mins)); });
    }
    else if (k === 'val') {
      var p = parts(), b = curTest(), col = b.test.columns.find(function (c) { return c.id === el.dataset.c; });
      if (col && col.type === 'number') { var c2 = cleanNumber(el.value); if (c2 !== el.value) el.value = c2; }
      (p[2] === 'r' ? ui.edit.values : draftOf(b).values)[el.dataset.c] = el.value;
      el.classList.toggle('filled', el.value !== '');
      var dec = Number(el.dataset.dec || 0), typed = ev.inputType && ev.inputType.indexOf('insert') === 0, after = /\.(\d+)$/.exec(el.value);
      if (typed && p[2] !== 'r' && col && col.type === 'number' && dec > 0 && el.dataset.had !== '1' && after && after[1].length >= dec) nextBox(el);
    }
    else if (k === 'delReason') { ui.sheet.reason = el.value; return; }
    else if (k === 'se') { if (el.inputMode === 'decimal') el.value = cleanNumber(el.value); ui.setupEdit[el.dataset.k] = el.value; return; }
    else if (k === 'note') draftOf(curTest()).note = el.value;
    else if (k === 'editNote') ui.edit.note = el.value;
    else if (k === 'addNote') { ui.addNote = el.value; return; }
    else if (k === 'remarks') finishDraft(curTest()).remarks = el.value;
    else if (k === 'handNote') ui.hand.note = el.value;
    T.save();
  });
  root.addEventListener('change', function (ev) {
    var el = ev.target;
    if (!el.matches('input[data-photo]') || !el.files.length) return;
    var files = Array.prototype.slice.call(el.files), chain = Promise.resolve();
    files.forEach(function (f) { chain = chain.then(function () { return T.addPhoto(f, el.dataset.t, el.dataset.r, el.dataset.n); }); });
    chain.then(refreshLocalPhotos).then(function () { toast(files.length + ' photo' + (files.length === 1 ? '' : 's') + ' added.'); }, function (e) { toast(e.message, 'bad'); });
  });

  T.on(function (what) {
    if (what === 'expired') { T.signOut(); toast('Please sign in again.', 'bad'); return; }
    if (String(what).indexOf('alarmOpen:') === 0) { var tid = String(what).slice(10); if (S().current && S().tests[tid]) go('t/' + encodeURIComponent(tid)); return; }
    if (what === 'update') { tryUpdate(); return; }
    if (what === 'torch') { root.querySelectorAll('.torchbtn').forEach(function (x) { x.outerHTML = torchBtn(); }); return; }
    if (what === 'alarm') { if (!(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) render(); return; }
    if (what === 'rejected') toast('1 change was not accepted. Open the sync details.', 'bad');
    if (what === 'photo') { refreshLocalPhotos().then(render); return; }
    if (what === 'sync' || what === 'signin' || what === 'signout') {
      // Do not redraw while someone is typing in the form.
      var a = document.activeElement, typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && root.contains(a);
      if (typing) { var badge = root.querySelectorAll('.sync'); badge.forEach(function (x) { x.outerHTML = syncBadge(); }); }
      else refreshLocalPhotos().then(render);
    }
  });
  // A new build restarts the app only where nothing can be lost: sign in, Home or Settings, with no sheet open and nobody typing.
  function tryUpdate() {
    if (!T.update.state.ready) return;
    var p = parts(), a = document.activeElement, typing = a && /INPUT|TEXTAREA/.test(a.tagName) && root.contains(a);
    if (!ui.sheet && !typing && (!S().current || !p.length || p[0] === 'settings')) T.update.apply();
  }
  window.addEventListener('hashchange', function () { ui.sheet = null; ui.err = ''; render(); tryUpdate(); });
  window.addEventListener('online', render); window.addEventListener('offline', render);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) T.scheduleSync(300); });

  // The Android back gesture, when the app runs inside the alarm app. Returns false when there is nowhere to go back to.
  window.__appBack = function () {
    if (ui.sheet) { ui.sheet = null; ui.err = ''; render(); return true; }
    var p = parts();
    if (!S() || !S().current || !p.length) return false;
    if (p[0] === 'settings') { go(''); return true; }
    if (p[0] === 't' && p.length > 2) go('t/' + encodeURIComponent(p[1]));
    else if (p[0] === 'new' && p.length > 1) go('new');
    else go('');
    return true;
  };
  // THE KEYBOARD MUST NOT COVER THE BOTTOM BUTTON (build 7). When the keyboard opens, many phones keep the
  // page at full height and draw the keyboard over its lower part, so "Save reading" was hidden. The page is
  // now made exactly as tall as the free part of the screen, and the box being typed in is scrolled into view.
  (function () {
    var vv = window.visualViewport;
    if (!vv) return;
    function fit() {
      var st = document.documentElement.style;
      st.setProperty('--vh', Math.round(vv.height) + 'px');
      st.setProperty('--vtop', Math.round(vv.offsetTop) + 'px');
      var a = document.activeElement;
      if (a && /INPUT|TEXTAREA/.test(a.tagName) && root.contains(a) && a.closest('main') && a.scrollIntoView) a.scrollIntoView({ block: 'center' });
    }
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    fit();
  })();
  T.cfg.phoneCodes = true;
  T.load().then(refreshLocalPhotos).then(function () {
    render();
    T.alarm.start();
    setInterval(tick, 1000);
    setInterval(function () { T.sync(); }, 60000);
    if (S().current) T.sync();
    if (T.cfg.api && navigator.onLine) {
      T.api('status', {}, 20000).then(function (r) { ui.serverUsers = r.hasUsers; if (!r.hasUsers) render(); else return T.fetchNames().then(function () { if (!S().current) render(); }); }).catch(function () {});
    }
  });
  T.update.init();
})();

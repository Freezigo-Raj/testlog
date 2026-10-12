/* Freezigo Test Log - import one old test from an Excel file (computer view, reviewer and engineer).
   Two jobs: make the blank Excel format for a template, and read a filled file and check it.
   Nothing is saved here. The check result is shown first; the person then presses Import. */
(function () {
  'use strict';
  var T = window.TL, U = T.u;
  var FORMAT = 'Freezigo Test Log import v1';
  var MAX_ROWS = 2000;
  var F = {   // the fixed lines of the Setup sheet. The text in column A is the key, so it must not be changed.
    format: 'Format', tplId: 'Template ID', tpl: 'Template', product: 'Product', machine: 'Machine name/code', mode: 'Machine mode',
    date: 'Test date', interval: 'Reading interval (min)', notes: 'Setup notes', remarks: 'Final remarks', comp: 'Compressor on-time (min)', end: 'End time'
  };

  function head(c) { return c.name + (c.unit ? ' (' + c.unit + ')' : ''); }
  function typeRule(c) {
    if (c.type === 'number') return 'Number only, no unit. Blank if not written.';
    if (c.type === 'yesno') return 'Exactly Yes or No. Blank if not written.';
    if (c.type === 'pick') return 'Exactly one of: ' + (c.options || []).join(', ') + '. Blank if not written.';
    return 'Text. Blank if not written.';
  }
  function exampleValue(c, i) {
    if (c.type === 'number') return [12.5, 12.1, 11.8][i];
    if (c.type === 'yesno') return ['No', 'Yes', 'Yes'][i];
    if (c.type === 'pick') return (c.options || [''])[0];
    return ['', 'text', ''][i];
  }

  /* ---------- the blank format ---------- */
  function blank(tpl, product) {
    var wb = new ExcelJS.Workbook(), n = 0, cols = T.readingColumns(tpl.columns), setup = T.setupFields(tpl.columns, tpl.product), modes = (product && product.modes) || [];
    function sheet(title, headRow, rows, widths) {
      var ws = wb.addWorksheet(title);
      if (!rows.length) rows = [headRow.map(function () { return ''; })];
      ws.addTable({ name: 'F' + (++n) + '_' + title.replace(/\W/g, ''), ref: 'A1', headerRow: true, style: { theme: 'TableStyleLight1', showRowStripes: false }, columns: headRow.map(function (x) { return { name: x, filterButton: true }; }), rows: rows });
      headRow.forEach(function (x, i) { var c = ws.getColumn(i + 1); c.width = (widths && widths[i]) || Math.max(12, Math.min(26, x.length + 4)); c.font = { name: 'Arial', size: 10 }; c.alignment = { vertical: 'top', wrapText: !!(widths && widths[i] >= 40) }; });
      ws.getRow(1).font = { name: 'Arial', size: 10, bold: true }; ws.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
      return ws;
    }
    var heads = ['Time'].concat(cols.map(head)).concat(['Note']);
    var rules = [
      ['One file is one test. Fill the sheets Setup, Readings and Events. The sheets Rules and Example are not imported.', 'A paper page with a pause in the middle is still one test.'],
      ['Do not rename a sheet. Do not change, add, remove or move a heading. Do not change the text in column A of Setup.', 'Heading must stay "' + (heads[1] || 'Time') + '".'],
      ['Readings start at row 2 of the Readings sheet, one reading in one row, with no empty row between readings. At most ' + MAX_ROWS + ' rows.', ''],
      ['A value that is not written on the source stays blank. Never write 0, a dash or NA for a missing value.', 'Source shows "-" under Cont. HP: leave the cell blank.'],
      ['Never guess, average or fill a missing value from the rows around it. Copy only what is written.', ''],
      ['A value that is struck out or cannot be read stays blank. Say which one in the Note of that row.', 'Note: "TE-1 struck out on paper."'],
      ['Numbers: digits only, a dot for decimals, a minus sign in front if negative. No unit, no comma, no space. Between -100000 and 100000.', '1131.27   -5.3   280'],
      ['Keep the digits after the point as written. To keep a last zero, write the cell as text.', '2.0 written as text stays 2.0.'],
      ['Time: 24-hour HH:MM. Every row must be later than the row above. No two rows with the same time.', '08:50   14:17'],
      ['If the test passes midnight, write the full date and time in every row.', '2026-10-11 23:50   2026-10-12 00:20'],
      ['Test date in Setup: YYYY-MM-DD.', '11/10/2026 on paper becomes 2026-10-11.'],
      ['Yes/No columns: exactly Yes or No.', 'Sight glass clear: Yes'],
      ['Pick-list columns and Machine mode: exactly one of the choices listed in column C of Setup or in the heading rule.', modes.length ? 'Machine mode: ' + modes[0] : ''],
      ['A remark written beside one reading goes in the Note of that row.', 'Note: "Over voltage (13:00)"'],
      ['Anything written on the page that has no field goes in Setup notes. A closing remark goes in Final remarks.', 'Setup notes: "Ambient temp 33 °C"'],
      ['Events sheet: fill only when the source gives the exact time the compressor started or stopped. Event must be exactly "Compressor ON" or "Compressor OFF".', '08:50 Compressor ON   13:00 Compressor OFF'],
      ['Compressor on-time in Setup: whole minutes.', '8 hrs 3 min = 483'],
      ['Do not enter total energy or total time. The app works them out from the readings.', ''],
      ['Write values only. No formulas, no merged cells, no colours needed.', ''],
      ['A value with no column in this format goes in the Note of that row. Do not add a column.', 'Note: "Ambient 34 °C"']
    ].map(function (r, i) { return [i + 1, r[0], r[1]]; });
    sheet('Rules', ['No.', 'Rule', 'Example'], rules, [6, 90, 50]);

    var rows = [[F.format, FORMAT, 'Do not change.'], [F.tplId, tpl.id, 'Do not change.'], [F.tpl, tpl.name, 'Do not change.'], [F.product, tpl.product, 'Do not change.'],
      [F.machine, '', 'Text. Example: BMC 1000 L unit 17'],
      [F.mode, tpl.default_mode || '', modes.length ? 'Exactly one of: ' + modes.join(', ') + '. Or blank.' : 'Leave blank.'],
      [F.date, '', 'YYYY-MM-DD. Example: 2026-10-11'],
      [F.interval, '', 'Whole number of minutes, or blank. Example: 60']];
    setup.forEach(function (f) { rows.push([head(f), '', typeRule(f) + (f.type === 'number' ? ' Example: 600' : '')]); });
    rows.push([F.notes, '', 'Text. Example: Ambient temp 33 °C'], [F.remarks, '', 'Text. Example: 8 hrs charging complete'],
      [F.comp, '', 'Whole number of minutes, or blank. Example: 483'], [F.end, '', 'HH:MM, or blank. Blank means the time of the last reading. Example: 18:20']);
    sheet('Setup', ['Field', 'Value', 'Rule'], rows, [30, 34, 70]).getColumn(2).numFmt = '@';

    var rs = sheet('Readings', heads, [], [18].concat(cols.map(function () { return 14; })).concat([40]));
    rs.getColumn(1).numFmt = '@';
    sheet('Events', ['Time', 'Event'], [], [18, 24]).getColumn(1).numFmt = '@';
    var ex = [0, 1, 2].map(function (i) { return [['08:50', '09:50', '10:53'][i]].concat(cols.map(function (c) { return i === 0 && c.on === false ? '' : exampleValue(c, i); })).concat([['Readings noted after 3-4 min', '', ''][i]]); });
    sheet('Example', heads, ex, [18].concat(cols.map(function () { return 14; })).concat([40]));
    var colRules = sheet('Column rules', ['Heading', 'Rule'], [['Time', '24-hour HH:MM, or YYYY-MM-DD HH:MM']].concat(cols.map(function (c) { return [head(c), typeRule(c)]; })).concat([['Note', 'Text. Blank if nothing was written.']]), [30, 70]);
    void colRules;
    return wb.xlsx.writeBuffer();
  }

  /* ---------- reading a filled file ---------- */
  function text(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
      if (v.richText) return v.richText.map(function (x) { return x.text; }).join('').trim();
      if (v.result !== undefined) return text(v.result);
      if (v.text !== undefined) return String(v.text).trim();
      if (v.error) return '';
      return '';
    }
    return typeof v === 'string' ? v.trim() : v;
  }
  function isBlank(v) { return v === '' || (typeof v === 'string' && /^[-–—_.]+$/.test(v)) || (typeof v === 'string' && /^(na|n\/a|nil)$/i.test(v)); }
  function ymd(y, m, d) { return y + '-' + U.pad(m) + '-' + U.pad(d); }
  function validDate(y, m, d) { var x = new Date(Date.UTC(y, m - 1, d)); return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d && y > 2000 && y < 2100; }
  /** Gives 'YYYY-MM-DD' or null. */
  function parseDate(v) {
    if (v instanceof Date) return ymd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
    if (typeof v === 'number' && v > 30000 && v < 80000) { var d = new Date(Math.round((v - 25569) * 86400000)); return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v));
    return m && validDate(+m[1], +m[2], +m[3]) ? ymd(+m[1], +m[2], +m[3]) : null;
  }
  /** Gives a local ISO time 'YYYY-MM-DDTHH:MM:00' or null. A time with no date uses the test date. */
  function parseTime(v, date) {
    var hm = function (h, m) { return h >= 0 && h < 24 && m >= 0 && m < 60 ? U.pad(h) + ':' + U.pad(m) + ':00' : null; }, t;
    if (v instanceof Date) {
      t = hm(v.getUTCHours(), v.getUTCMinutes());
      if (v.getUTCFullYear() < 1905) return date && t ? date + 'T' + t : null;
      return t ? ymd(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()) + 'T' + t : null;
    }
    if (typeof v === 'number') {
      if (v >= 0 && v < 1) { var mins = Math.round(v * 1440); t = hm(Math.floor(mins / 60), mins % 60); return date && t ? date + 'T' + t : null; }
      if (v > 30000 && v < 80000) return parseTime(new Date(Math.round((v - 25569) * 86400000)), date);
      return null;
    }
    var s = String(v), m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
    if (m) { t = hm(+m[4], +m[5]); return t && validDate(+m[1], +m[2], +m[3]) ? ymd(+m[1], +m[2], +m[3]) + 'T' + t : null; }
    m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
    if (m) { t = hm(+m[1], +m[2]); return date && t ? date + 'T' + t : null; }
    return null;
  }
  /** Checks one cell against its column. Gives { value } or { error }. */
  function cellValue(raw, c) {
    if (raw instanceof Date) return { error: 'is a date, not a value' };
    if (c.type === 'number') {
      var s = typeof raw === 'number' ? String(raw) : String(raw);
      if (!/^-?\d+(\.\d+)?$/.test(s)) return { error: '"' + s + '" is not a number' };
      if (Math.abs(Number(s)) > T.LIMIT) return { error: s + ' is outside -' + T.LIMIT + ' to ' + T.LIMIT };
      return { value: s };
    }
    var x = String(raw);
    if (c.type === 'yesno') { if (/^(yes|y)$/i.test(x)) return { value: 'Yes' }; if (/^(no|n)$/i.test(x)) return { value: 'No' }; return { error: '"' + x + '" must be Yes or No' }; }
    if (c.type === 'pick') { var o = (c.options || []).filter(function (k) { return k.toLowerCase() === x.toLowerCase(); })[0]; return o ? { value: o } : { error: '"' + x + '" must be one of: ' + (c.options || []).join(', ') }; }
    return { value: x };
  }

  /**
   * Reads and checks a filled file.
   * ctx = { templates, products, tests (the list of tests already saved), fileName }
   * Gives { errors, warnings, tpl, test, readings, events, finish }. With any error, nothing may be imported.
   */
  // A file saved by another tool (for example openpyxl) can hold a table that ExcelJS cannot find, and the
  // whole file then fails to open. Tables are not needed to read the values, so missing ones are skipped.
  var patched = false;
  function patchTables() {
    if (patched) return; patched = true;
    try {
      var proto = Object.getPrototypeOf(new ExcelJS.Workbook().addWorksheet('x')), d = Object.getOwnPropertyDescriptor(proto, 'model');
      if (d && d.set) Object.defineProperty(proto, 'model', { get: d.get, configurable: true, set: function (m) { if (m && m.tables) m.tables = m.tables.filter(Boolean); d.set.call(this, m); } });
    } catch (e) {}
  }
  function parse(buffer, ctx) {
    patchTables();
    var wb = new ExcelJS.Workbook();
    return wb.xlsx.load(buffer).then(function () {
      var errors = [], warnings = [], out = { errors: errors, warnings: warnings, fileName: ctx.fileName || '' };
      var err = function (where, msg) { if (errors.length < 200) errors.push({ where: where, msg: msg }); }, warn = function (where, msg) { warnings.push({ where: where, msg: msg }); };
      var S = wb.getWorksheet('Setup'), R = wb.getWorksheet('Readings'), E = wb.getWorksheet('Events');
      if (!S) err('File', 'The sheet "Setup" is missing.');
      if (!R) err('File', 'The sheet "Readings" is missing.');
      if (errors.length) return out;

      // --- Setup: column A is the field, column B the value
      var kv = {}, rowOf = {};
      S.eachRow(function (row, i) { if (i === 1) return; var k = text(row.getCell(1).value); if (k !== '' && !(k instanceof Date)) { kv[String(k)] = text(row.getCell(2).value); rowOf[String(k)] = i; } });
      var at = function (k) { return 'Setup, row ' + (rowOf[k] || '?') + ' (' + k + ')'; }, get = function (k) { var v = kv[k]; return v === undefined || isBlank(v) ? '' : v; };
      if (String(get(F.format)) !== FORMAT) err('Setup', 'This is not a Test Log import file, or its format is old. Download the blank format again. Expected "' + FORMAT + '".');
      var tpl = ctx.templates.filter(function (t) { return t.id === String(get(F.tplId)); })[0] || ctx.templates.filter(function (t) { return t.name === String(get(F.tpl)); })[0];
      if (!tpl) { err(at(F.tpl), 'Template "' + get(F.tpl) + '" was not found in the app. It may have been removed. Download the blank format again.'); return out; }
      out.tpl = tpl;
      var product = ctx.products.filter(function (p) { return p.id === tpl.product; })[0] || { modes: [] };
      var cols = T.readingColumns(tpl.columns), setupFields = T.setupFields(tpl.columns, tpl.product);
      var date = get(F.date) === '' ? null : parseDate(get(F.date));
      if (get(F.date) !== '' && !date) err(at(F.date), '"' + (get(F.date) instanceof Date ? 'date' : get(F.date)) + '" is not a date. Write YYYY-MM-DD. Example: 2026-10-11');
      // With no usable Test date, times are still checked against each other, and the date is asked for once.
      var dref = date || '2001-01-01', needDate = false;
      var mode = String(get(F.mode));
      if (mode) { var mm = product.modes.filter(function (m) { return m.toLowerCase() === mode.toLowerCase(); })[0]; if (mm) mode = mm; else err(at(F.mode), '"' + mode + '" is not a mode of ' + tpl.product + '. Use one of: ' + (product.modes.join(', ') || 'none, leave blank') + '.'); }
      var whole = function (k, max) { var v = get(k); if (v === '') return null; if (!/^\d+$/.test(String(v)) || Number(v) > max) { err(at(k), '"' + v + '" must be a whole number from 0 to ' + max + ', or blank.'); return null; } return Number(v); };
      var interval = whole(F.interval, 1440), compMin = whole(F.comp, 100000), setup = {};
      setupFields.forEach(function (f) { var v = get(head(f)); if (v === '') return; var c = cellValue(v, f); if (c.error) err(at(head(f)), c.error + '.'); else setup[f.id] = c.value; });
      var machine = String(get(F.machine));
      if (!machine) warn(at(F.machine), 'No machine name/code. The test will show the template name.');

      // --- Readings: row 1 is the headings
      var want = ['Time'].concat(cols.map(head)).concat(['Note']), have = [];
      for (var i = 1; i <= Math.max(want.length, R.columnCount); i++) { var hv = text(R.getRow(1).getCell(i).value); have.push(hv instanceof Date ? '' : String(hv)); }
      while (have.length && have[have.length - 1] === '') have.pop();
      var headOk = have.length === want.length && want.every(function (h, i) { return have[i] === h; });
      if (!headOk) {
        want.forEach(function (h, i) { if (have[i] !== h) err('Readings, row 1, column ' + (i + 1), 'Heading must be "' + h + '" but it is "' + (have[i] || 'blank') + '".'); });
        if (have.length > want.length) err('Readings, row 1', 'There are ' + (have.length - want.length) + ' extra column(s) after "Note". Remove them. Put such values in the Note.');
        return out;
      }
      var readings = [], prev = null, hasData = {}, dashes = 0, lastRow = 0;
      R.eachRow(function (row, n) { if (n > 1) lastRow = n; });
      if (lastRow - 1 > MAX_ROWS) err('Readings', 'More than ' + MAX_ROWS + ' rows. Split the test.');
      for (var n = 2; n <= Math.min(lastRow, MAX_ROWS + 1); n++) {
        var row = R.getRow(n), cells = want.map(function (h, i) { return text(row.getCell(i + 1).value); }), where = 'Readings, row ' + n;
        if (cells.every(function (c) { return c === ''; })) continue;
        var time = cells[0] === '' ? null : parseTime(cells[0], dref);
        if (time && !date && time.slice(0, 10) === dref) needDate = true;
        if (cells[0] === '') err(where + ', Time', 'Time is blank.');
        else if (!time) err(where + ', Time', '"' + (cells[0] instanceof Date ? 'this cell' : cells[0]) + '" is not a time. Write 24-hour HH:MM. Example: 14:17');
        else if (prev && time <= prev) err(where + ', Time', U.hhmm(time) + ' is not later than the row above (' + U.hhmm(prev) + '). If the test passes midnight, write the full date and time. Example: 2026-10-12 00:20');
        if (time) prev = time;
        var values = {}, any = false;
        cols.forEach(function (c, j) {
          var raw = cells[j + 1];
          if (raw === '') return;
          if (isBlank(raw)) { dashes++; return; }
          var v = cellValue(raw, c);
          if (v.error) err(where + ', ' + head(c), v.error + '.'); else { values[c.id] = v.value; hasData[c.id] = true; any = true; }
        });
        var note = cells[cells.length - 1]; note = note instanceof Date ? '' : String(note);
        if (!any && !note) warn(where, 'This row has a time but no values.');
        readings.push({ row: n, time: time, values: values, note: note });
      }
      if (needDate && get(F.date) === '') err(at(F.date), 'Test date is blank. Fill it. Example: 2026-10-11');
      if (!readings.length) err('Readings', 'There are no readings. Readings start at row 2.');
      if (dashes) warn('Readings', dashes + ' cell(s) held a dash or NA. They were read as blank.');

      // --- Events (optional)
      var events = [];
      if (E) {
        var eh = [text(E.getRow(1).getCell(1).value), text(E.getRow(1).getCell(2).value)];
        if (eh[0] !== 'Time' || eh[1] !== 'Event') err('Events, row 1', 'Headings must be "Time" and "Event".');
        else E.eachRow(function (row, n) {
          if (n === 1) return;
          var tv = text(row.getCell(1).value), ev = text(row.getCell(2).value);
          if (tv === '' && ev === '') return;
          var t = tv === '' ? null : parseTime(tv, dref), kind = /^compressor on$/i.test(String(ev)) ? 'compressor_on' : /^compressor off$/i.test(String(ev)) ? 'compressor_off' : null;
          if (!t) err('Events, row ' + n + ', Time', 'Not a time. Write 24-hour HH:MM. Example: 13:00');
          if (!kind) err('Events, row ' + n + ', Event', '"' + ev + '" must be exactly "Compressor ON" or "Compressor OFF".');
          if (t && kind) events.push({ row: n, time: t, kind: kind, text: kind === 'compressor_on' ? 'Compressor ON' : 'Compressor OFF' });
        });
        events.sort(function (a, b) { return a.time.localeCompare(b.time); });
        events.forEach(function (e, i) { if (i && events[i - 1].kind === e.kind) warn('Events, row ' + e.row, e.text + ' comes twice in a row.'); });
      }

      // --- End time and the checks across rows
      var times = readings.map(function (r) { return r.time; }).filter(Boolean), first = times[0], last = times[times.length - 1], end = last;
      if (get(F.end) !== '' && last) {
        var et = parseTime(get(F.end), last.slice(0, 10));
        if (!et) err(at(F.end), 'Not a time. Write 24-hour HH:MM, or leave blank.');
        else if (et < last) err(at(F.end), 'End time ' + U.hhmm(et) + ' is before the last reading (' + U.hhmm(last) + ').');
        else end = et;
      }
      events.forEach(function (e) { if (end && e.time > end) end = e.time; });
      var en = cols.filter(function (c) { return c.type === 'number' && /kwh/i.test(c.unit || ''); })[0];
      if (en) { var pv = null; readings.forEach(function (r) { var v = U.num(r.values[en.id]); if (v === null) return; if (pv !== null && v < pv) warn('Readings, row ' + r.row + ', ' + head(en), v + ' is lower than the reading before it (' + pv + '). An energy meter does not go down.'); pv = v; }); }
      if (first && (ctx.tests || []).some(function (t) { return !T.isDeleted(t) && (t.machine_code || '') === machine && (t.started_at || '').slice(0, 16) === first.slice(0, 16); })) warn('File', 'A test of "' + (machine || tpl.name) + '" starting at ' + U.dmyhm(first) + ' is already saved. This may be the same test.');
      if (compMin !== null && first && end && compMin > U.minsBetween(first, end) + 1) warn(at(F.comp), compMin + ' min is longer than the whole test (' + Math.round(U.minsBetween(first, end)) + ' min).');
      if (errors.length || !first) return out;

      // --- the test that will be saved
      var key = first.slice(2, 4) + first.slice(5, 7) + first.slice(8, 10), used = {}, k = 1;
      (ctx.tests || []).forEach(function (t) { used[t.test_id] = true; });
      while (used['T-' + key + '-XL-' + U.pad(k)]) k++;
      setup.notes = String(get(F.notes)); setup.alarm = false;
      setup.imported = { file: ctx.fileName || '', format: FORMAT };
      var columns = cols.map(function (c) { return Object.assign({}, c, { on: c.on !== false || !!hasData[c.id] }); }).concat(setupFields.map(function (f) { return Object.assign({}, f, { scope: 'setup' }); }));
      out.test = { test_id: 'T-' + key + '-XL-' + U.pad(k), template_id: tpl.id, template_name: tpl.name, product: tpl.product, machine_code: machine, mode: mode, date: first.slice(0, 10), started_at: first,
        interval_min: interval || 0, track_compressor: !!tpl.track_compressor || events.length > 0 || compMin !== null, setup: setup, columns: columns };
      out.readings = readings; out.events = events;
      out.finish = { ended_at: end, final_remarks: String(get(F.remarks)), comp_on_min: compMin };
      return out;
    }, function () { return { errors: [{ where: 'File', msg: 'This file could not be opened. It must be an Excel .xlsx file.' }], warnings: [], fileName: ctx.fileName || '' }; });
  }

  /** The changes to send to the server, in order: the test, its readings, its events, then finish and lock. */
  function ops(res, userName) {
    var id = res.test.test_id, now = U.localISO(), list = [{ type: 'test.create', payload: { test: res.test } }];
    res.readings.forEach(function (r, i) { list.push({ type: 'reading.save', payload: { reading: { reading_id: U.uid(), test_id: id, no: i + 1, time: r.time, time_changed: false, phone_time: r.time, values: r.values, note: r.note, saved_at: now } } }); });
    res.events.forEach(function (e) { list.push({ type: 'event.add', payload: { event: { event_id: U.uid(), test_id: id, kind: e.kind, time: e.time, text: e.text } } }); });
    list.push({ type: 'event.add', payload: { event: { event_id: U.uid(), test_id: id, kind: 'imported', time: res.finish.ended_at, text: 'Imported from Excel file "' + res.fileName + '" by ' + userName + ' on ' + U.dmyhm(now) } } });
    list.push({ type: 'test.finish', payload: { test_id: id, ended_at: res.finish.ended_at, final_remarks: res.finish.final_remarks, comp_on_min: res.finish.comp_on_min, comp_on_edited: res.finish.comp_on_min !== null, event_id: U.uid() } });
    return list.map(function (o) { o.op_id = U.uid(); return o; });
  }

  T.imp = { FORMAT: FORMAT, head: head, blank: blank, parse: parse, ops: ops };
})();

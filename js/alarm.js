/* Freezigo Test Log - link to the Test Log alarm app (Android).
   The alarm app is this same web app shown inside a small Android shell. When the shell is there,
   window.Capacitor.Plugins.CascadeAlarm exists and a loud alarm rings when a reading is due,
   also when the phone is locked or the app is closed. Without the shell, nothing here runs. */
(function () {
  'use strict';
  var T = window.TL, U = T.u;
  // How the alarm rings. These numbers go to the phone with every alarm; the Android code holds none.
  var RING = { ringSec: 3, everyMin: 1, stopAfterMin: 15, snoozeMin: 2 };
  var PREFIX = 'tl:';
  var info = { present: false, shellBuild: 0, perms: null, armed: {} };
  var busy = false, again = false, timer = null;

  function plugin() { var C = window.Capacitor; return (C && C.Plugins && C.Plugins.CascadeAlarm) || null; }
  function alarmOn(test) { return !!test && test.interval_min > 0 && !(test.setup && test.setup.alarm === false); }

  /** The instant (ms) the alarm should ring for this test, or null for no alarm. */
  function slot(b, now) {
    var t = b.test;
    if (!T.iAmRecorder(b) || !alarmOn(t)) return null;
    var base = U.toDate(b.readings.reduce(function (m, r) { return r.time > m ? r.time : m; }, t.started_at || ''));
    if (!base) return null;
    var baseMs = base.getTime(), step = t.interval_min * 60000, s = baseMs + step;
    // Skip a slot that was cancelled or rang with no answer, and a slot whose 15 minutes are already over.
    var floor = Math.max(now - RING.stopAfterMin * 60000, (T.state.alarmSkip || {})[t.test_id] || 0);
    if (s <= floor) s = baseMs + (Math.floor((floor - baseMs) / step) + 1) * step;
    return s;
  }
  function desired() {
    var st = T.state, out = {}, now = Date.now();
    if (!st || !st.current) return out;
    Object.keys(st.tests).forEach(function (id) {
      var b = st.tests[id], at = slot(b, now);
      if (at === null) return;
      out[PREFIX + id] = { id: PREFIX + id, at: at, armedFor: at, title: 'Reading ' + T.nextNo(b) + ' is due',
        reason: id + (b.test.template_name ? ' · ' + b.test.template_name : ''), snoozeOptions: [RING.snoozeMin], pushTargets: [],
        ringSec: RING.ringSec, autoSnoozeMin: RING.everyMin, autoMax: RING.stopAfterMin, stopAfterMin: RING.stopAfterMin,
        ui: 'simple', openLabel: 'Open test', repeats: false };
    });
    return out;
  }
  /** Makes the phone hold exactly the alarms the tests need. Safe to call often. */
  function sync() {
    var P = plugin();
    if (!P || !T.state) return Promise.resolve();
    if (busy) { again = true; return Promise.resolve(); }
    busy = true;
    var want = desired();
    return P.list().then(function (r) {
      var have = {}, chain = Promise.resolve();
      (r.alarms || []).forEach(function (a) { have[a.id] = a; });
      Object.keys(want).forEach(function (id) {
        var w = want[id], h = have[id];
        if (!h || Number(h.armedFor) !== w.armedFor || h.title !== w.title) chain = chain.then(function () { return P.set(w); });
      });
      Object.keys(have).forEach(function (id) {
        if (id.indexOf(PREFIX) === 0 && !want[id]) chain = chain.then(function () { return P.cancel({ id: id }); });
      });
      return chain;
    }).then(function () {
      info.armed = {};
      T.state.alarmArmed = T.state.alarmArmed || {};
      Object.keys(want).forEach(function (id) { info.armed[id.slice(PREFIX.length)] = want[id].at; T.state.alarmArmed[id.slice(PREFIX.length)] = want[id].at; });
    }).catch(function (e) { console.error('alarm sync', e); }).then(function () {
      busy = false;
      if (again) { again = false; schedule(300); }
    });
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(sync, ms || 400); }

  /** What the person pressed on the lock screen, or that nobody answered. */
  function outcome(o) {
    if (!o || String(o.id).indexOf(PREFIX) !== 0) return;
    var testId = String(o.id).slice(PREFIX.length), st = T.state;
    if (o.verb === 'DISMISS' || o.verb === 'UNANSWERED') {
      st.alarmSkip = st.alarmSkip || {};
      var armed = (st.alarmArmed || {})[testId];
      if (armed) st.alarmSkip[testId] = Math.max(st.alarmSkip[testId] || 0, armed);
      T.save(); schedule(200);
    } else if (o.verb === 'OPEN') {
      T.emit('alarmOpen:' + testId);
    }
  }
  function refresh() {
    var P = plugin();
    info.present = !!P;
    if (!P) return Promise.resolve(info);
    return Promise.all([
      P.version().then(function (r) { info.shellBuild = r.version; }, function () { info.shellBuild = 0; }),
      P.permissions().then(function (r) { info.perms = r; }, function () { info.perms = null; })
    ]).then(function () { return info; });
  }
  function request(what) {
    var P = plugin(); if (!P) return Promise.resolve();
    var fn = { exactAlarm: 'requestExactAlarm', batteryExempt: 'requestBatteryExemption', fullScreen: 'requestFullScreen', notifications: 'requestNotifications' }[what];
    return fn ? P[fn]() : Promise.resolve();
  }
  function start() {
    var P = plugin();
    info.present = !!P;
    if (!P) return;
    try { P.addListener('alarmOutcome', outcome); } catch (e) {}
    P.drainOutcomes().then(function (r) { (r.outcomes || []).forEach(outcome); }).catch(function () {}).then(function () { return refresh(); }).then(function () { sync(); T.emit('alarm'); });
    T.on(function (what) { if (what !== 'alarm' && what !== 'torch' && String(what).indexOf('alarmOpen:') !== 0) schedule(500); });
    setInterval(sync, 30000);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      P.drainOutcomes().then(function (r) { (r.outcomes || []).forEach(outcome); }).catch(function () {});
      refresh().then(function () { T.emit('alarm'); });
    });
  }
  T.alarm = { RING: RING, info: info, plugin: plugin, alarmOn: alarmOn, slot: slot, desired: desired, sync: sync, refresh: refresh, request: request, start: start, outcome: outcome };
})();

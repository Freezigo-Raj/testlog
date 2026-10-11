/* Freezigo Test Log - torch (phone light), for reading gauges in the dark.
   Inside the alarm app (shell build 2 or newer) the Android side switches the light, and no camera
   permission is needed. In Chrome the camera is asked for the light, so Chrome asks for camera access once. */
(function () {
  'use strict';
  var T = window.TL;
  var s = { on: false, busy: false, error: '' };
  var stream = null;

  function native() {
    var P = T.alarm && T.alarm.plugin();
    return P && T.alarm.info.shellBuild >= 2 ? P : null;
  }
  function done(on, error) { s.on = on; s.busy = false; s.error = error || ''; T.emit('torch'); return s; }
  function webOff() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
  function set(on) {
    if (s.busy) return Promise.resolve(s);
    s.busy = true; s.error = '';
    var P = native();
    if (P) return P.torch({ on: on }).then(function (r) { return done(!!r.on); }, function (e) { return done(false, (e && e.message) || 'The torch did not switch on.'); });
    if (T.alarm && T.alarm.info.present) return Promise.resolve(done(false, 'Update the alarm app to use the torch.'));
    if (!on) { webOff(); return Promise.resolve(done(false)); }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(done(false, 'This browser cannot switch on the torch.'));
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } }).then(function (st) {
      stream = st;
      var track = st.getVideoTracks()[0], caps = track.getCapabilities ? track.getCapabilities() : {};
      if (!caps.torch) { webOff(); return done(false, 'This browser cannot switch on the torch. Use the alarm app.'); }
      return track.applyConstraints({ advanced: [{ torch: true }] }).then(function () { return done(true); });
    }).catch(function (e) {
      webOff();
      return done(false, e && e.name === 'NotAllowedError' ? 'Allow the camera for this app. The torch is part of the camera.' : 'The torch did not switch on.');
    });
  }
  // In Chrome the light belongs to the camera, and the camera stops when the app is hidden.
  document.addEventListener('visibilitychange', function () { if (document.hidden && stream) { webOff(); done(false); } });
  T.torch = { state: s, set: set, toggle: function () { return set(!s.on); } };
})();

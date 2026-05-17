// Bootstrap. countdown.js / settings.js が先に window.Overlay に登録されている前提。

(function () {
  'use strict';
  var O = window.Overlay;

  async function boot() {
    O.countdown.init();
    await O.api.start();
    console.log('[overlay] ready');
  }

  boot();
})();

// Bootstrap. dottimer.js / api.js が先に window.Overlay に登録されている前提。

(function () {
  'use strict';
  var O = window.Overlay;

  async function boot() {
    O.dottimer.init();
    await O.api.start();
    console.log('[dottimer] ready');
  }

  boot();
})();

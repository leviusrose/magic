// Bootstrap. dmp4.js / api.js が先に window.Overlay に登録されている前提。

(function () {
  'use strict';
  var O = window.Overlay;

  async function boot() {
    O.dmp4.init();
    await O.api.start();
    console.log('[dmp4] ready');
  }

  boot();
})();

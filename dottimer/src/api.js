// OverlayPlugin event bridge.
//
// OverlayPlugin always injects window.OverlayPluginApi.callHandler when the
// page is loaded inside its CEF host. It does NOT always inject the higher
// level addOverlayListener / callOverlayHandler wrappers (those depend on the
// preset type and bundled common.js). So we drive everything from the
// low-level callHandler and dispatchOverlayEvent contract:
//
//   1. We define window.dispatchOverlayEvent — OverlayPlugin calls this to
//      deliver an event to the page.
//   2. We call OverlayPluginApi.callHandler({call:'subscribe', events:[...]})
//      to register interest.
//   3. If the modern wrappers happen to be present we use them in preference.

(function () {
  'use strict';
  var ns = window.Overlay = window.Overlay || {};

  var resolveReady;
  var apiReady = new Promise(function (r) { resolveReady = r; });
  var apiMode = 'detached';

  var subscribers = {};   // eventType -> [callback]
  var diag = { dispatch: 0, callback: 0, lastType: null };
  ns._diag = diag;

  function dispatchToSubs(msg) {
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg); } catch (e) { return; }
    }
    if (!msg || !msg.type) return;
    diag.lastType = msg.type;
    var subs = subscribers[msg.type];
    if (!subs) return;
    for (var i = 0; i < subs.length; i++) {
      try { subs[i](msg); } catch (e) { console.error('[overlay] handler:', e); }
    }
  }

  var existingDispatch = window.dispatchOverlayEvent;
  window.dispatchOverlayEvent = function (msg) {
    diag.dispatch++;
    if (existingDispatch) {
      try { existingDispatch(msg); } catch (e) { console.error(e); }
    }
    dispatchToSubs(msg);
  };

  // OverlayPlugin の legacy CEF push は __OverlayCallback(eventName, data) または
  // __OverlayCallback({type, ...}) で来ることがある。両形式を吸収。
  var existingCallback = window.__OverlayCallback;
  window.__OverlayCallback = function (a, b) {
    diag.callback++;
    if (existingCallback) {
      try { existingCallback(a, b); } catch (e) { console.error(e); }
    }
    if (typeof a === 'string' && b !== undefined) {
      dispatchToSubs(Object.assign({ type: a }, b || {}));
    } else {
      dispatchToSubs(a);
    }
  };

  // OverlayPluginApi.callHandler in CefSharp requires a (json, callback) pair —
  // calling it with a single arg throws "Missing Parameters: 1". Wrap it as a
  // Promise so the rest of the code can stay Promise-based.
  function rawCall(payload) {
    if (!window.OverlayPluginApi || typeof window.OverlayPluginApi.callHandler !== 'function') {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      try {
        window.OverlayPluginApi.callHandler(JSON.stringify(payload), function (s) {
          if (s == null) { resolve(null); return; }
          try { resolve(JSON.parse(s)); }
          catch (e) { resolve(s); }
        });
      } catch (e) {
        console.error('[overlay] callHandler failed:', e);
        resolve(null);
      }
    });
  }

  function on(eventType, callback) {
    return apiReady.then(function () {
      if (apiMode === 'modern' && typeof window.addOverlayListener === 'function') {
        window.addOverlayListener(eventType, callback);
        return;
      }
      // legacy: ローカルに登録のみ。実際の購読は start() でまとめて行う
      // (個別 subscribe を連続で投げると版によって "replace" 挙動になり取りこぼすため)
      if (!subscribers[eventType]) subscribers[eventType] = [];
      subscribers[eventType].push(callback);
    });
  }

  function off(eventType, callback) {
    return apiReady.then(function () {
      if (apiMode === 'modern' && typeof window.removeOverlayListener === 'function') {
        window.removeOverlayListener(eventType, callback);
        return;
      }
      var subs = subscribers[eventType];
      if (!subs) return;
      var idx = subs.indexOf(callback);
      if (idx >= 0) subs.splice(idx, 1);
    });
  }

  function call(payload) {
    return apiReady.then(function () {
      if (apiMode === 'modern' && typeof window.callOverlayHandler === 'function') {
        return window.callOverlayHandler(payload);
      }
      return rawCall(payload);
    });
  }

  function start() {
    return apiReady.then(function () {
      if (apiMode === 'modern' && typeof window.startOverlayEvents === 'function') {
        window.startOverlayEvents();
        return;
      }
      if (apiMode === 'legacy') {
        var events = Object.keys(subscribers);
        if (events.length > 0) return rawCall({ call: 'subscribe', events: events });
      }
    });
  }

  (function waitForApi(retries) {
    if (retries == null) retries = 200;
    var modern = typeof window.addOverlayListener === 'function' &&
                 typeof window.callOverlayHandler === 'function';
    var legacy = window.OverlayPluginApi &&
                 typeof window.OverlayPluginApi.callHandler === 'function';
    if (modern) {
      apiMode = 'modern';
      console.log('[overlay] API detected: modern');
      resolveReady();
      return;
    }
    if (legacy) {
      apiMode = 'legacy';
      console.log('[overlay] API detected: legacy (OverlayPluginApi.callHandler)');
      resolveReady();
      return;
    }
    if (retries <= 0) {
      console.warn('[overlay] no OverlayPlugin API found; running detached');
      resolveReady();
      return;
    }
    setTimeout(function () { waitForApi(retries - 1); }, 50);
  })();

  ns.api = {
    ready: function () { return apiReady; },
    mode: function () { return apiMode; },
    on: on,
    off: off,
    call: call,
    start: start,
  };
})();

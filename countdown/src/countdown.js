// 戦闘開始カウントダウン専用モジュール。
//
// - LogLine を直接購読。「戦闘開始まで{N}秒！」で発動、「カウントダウン中止」で停止
// - 数字 / ラベル / ドットのサイズは CSS の cqmin (container query 単位) で
//   オーバーレイ枠サイズに自動フィットするので、JS 側でサイズ計算はしない
// - フェーズ別の色変化 / サイズ拡大 / GO! 表示はなし

(function () {
  'use strict';
  var O = window.Overlay = window.Overlay || {};

  var root = null;
  var current = null;

  function init() {
    root = document.getElementById('countdown');
    if (!O.api) {
      console.error('[countdown] Overlay.api is not initialized');
      return;
    }
    O.api.on('LogLine', onLogLine);
  }

  function onLogLine(e) {
    var line = e.line || [];
    if (line[0] !== '00') return;
    var msg = line[4] || '';
    var m = msg.match(/戦闘開始まで(\d+)秒/);
    if (m) {
      var sec = parseInt(m[1], 10);
      if (sec > 0 && sec <= 60) start(sec);
      return;
    }
    if (/カウントダウン.*中止|中止.*カウントダウン/.test(msg)) {
      stop();
    }
  }

  function start(seconds) {
    stop();

    var wrap = document.createElement('div');
    wrap.className = 'countdown-wrap';

    var labelEl = document.createElement('div');
    labelEl.className = 'countdown-label';
    labelEl.textContent = '戦闘開始まで';

    var num = document.createElement('div');
    num.className = 'countdown-number';
    num.textContent = String(seconds);

    wrap.appendChild(labelEl);
    wrap.appendChild(num);

    var tickEls = [];
    if (seconds <= 30) {
      var ticks = document.createElement('div');
      ticks.className = 'countdown-ticks';
      for (var i = 0; i < seconds; i++) {
        var dot = document.createElement('div');
        dot.className = 'countdown-tick';
        ticks.appendChild(dot);
        tickEls.push(dot);
      }
      wrap.appendChild(ticks);
    }

    root.appendChild(wrap);

    var startedAt = performance.now();
    var totalMs = seconds * 1000;

    current = {
      wrap: wrap, num: num, tickEls: tickEls,
      rafId: null, safetyTimer: null,
      startedAt: startedAt, totalMs: totalMs, lastSec: seconds,
    };

    function paintTicks(remaining) {
      for (var j = 0; j < tickEls.length; j++) {
        tickEls[j].classList.toggle('elapsed', (tickEls.length - j) > remaining);
      }
    }
    paintTicks(seconds);

    function tick(now) {
      if (!current) return;
      var elapsed = (now || performance.now()) - startedAt;
      var remainingMs = Math.max(0, totalMs - elapsed);
      var remainingSec = Math.ceil(remainingMs / 1000);
      if (remainingSec !== current.lastSec && remainingSec > 0) {
        current.lastSec = remainingSec;
        num.textContent = String(remainingSec);
        num.classList.remove('pulse');
        void num.offsetWidth;
        num.classList.add('pulse');
        paintTicks(remainingSec);
      }
      if (remainingMs > 0) {
        current.rafId = requestAnimationFrame(tick);
      } else {
        stop();
      }
    }
    current.rafId = requestAnimationFrame(tick);
    current.safetyTimer = setTimeout(stop, totalMs + 1500);
  }

  function stop() {
    if (!current) return;
    if (current.rafId) cancelAnimationFrame(current.rafId);
    if (current.safetyTimer) clearTimeout(current.safetyTimer);
    if (current.wrap && current.wrap.parentNode) {
      current.wrap.parentNode.removeChild(current.wrap);
    }
    current = null;
  }

  O.countdown = { init: init, start: start, stop: stop };
})();

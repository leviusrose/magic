// 自キャラが付与した DoT の残り時間を可視化し、残り 5 秒で点滅＋音で知らせる。
//
// ■ 検出に使うログ (ACT ネットワークログ。e.line が | 区切りの配列)
//   02 ChangePrimaryPlayer : 02|t|<自キャラID hex>|<名前>          → 自キャラ確定
//   26 NetworkBuff (付与)   : 26|t|<statusId hex>|<名>|<秒>|<srcId>|<src名>|<tgtId>|<tgt名>|...
//   30 NetworkBuff (消失)   : 26 と同フォーマット。秒が 0.00。早期に消えた時のクリア用
//   25 NetworkDeath         : 25|t|<死亡ID>|<名>|<killerID>|<名>  → 対象が死んだら消去
//
//   ★注意: 26/30 は「ソースが先、ターゲットが後」(ffxiv/LOG_FORMAT.md は逆だが、実ログで確認)。
//
// ■ 自キャラ ID の取得経路 (1 つでも当たれば確定)
//   1. OverlayPlugin の ChangePrimaryPlayer イベント (charID 10進)
//   2. ログ行 02 ChangePrimaryPlayer (hex)
//   3. CONFIG.ownNameHint が設定されているなら、任意のログ行から `<PCのID> <ヒント名>`
//      のペアを見つけて拾う (戦闘中に起動した場合のフォールバック)

(function () {
  'use strict';
  var O = window.Overlay = window.Overlay || {};

  console.log('[dottimer] script loaded');

  // ===== 設定 (ここを編集する) =====
  var CONFIG = {
    // ヒーラー (WHM/SCH/AST/SGE) の 30 秒 DoT を全レベル帯で網羅する。
    // FFXIV 公式ジョブガイドと実ログ (Network_30109_*.log) でクロスチェック済み。
    // 「置き換え」で status 名自体が変わるので名前ごとに列挙が必要。
    dotNamesExact: [
      'ディア',     // WHM Lv72+
      'エアロラ',   // WHM Lv46-71
      'エアロ',     // WHM Lv4-45
      '蠱毒法',     // SCH (DT 7.x の追加 DoT)
    ],
    dotNamesPrefix: [
      'バイオ',                       // SCH: バイオ / バイオラ (Biolysis)
      'コンバ',                       // AST: コンバス / コンバラ / コンバガ (※コンバストではない)
      'エウクラシア・ドシス',         // SGE: ドシス / II / III
      'エウクラシア・ディスクラシア', // SGE AoE
    ],
    alertAtSec:     5,
    minDurationSec: 15,

    // ---- 音 ----
    sound:       true,
    // soundFile が指定されていればそのファイルを再生 (wav/mp3/ogg)。
    // 相対パスは index.html からの相対 (例: 'sounds/alert.wav')。
    // 絶対パスは file:///C:/... 形式で書く。空文字なら内蔵のビープを使う。
    soundFile:   '',
    soundVolume: 0.7,   // 0.0 - 1.0

    showStatus:  false,  // 左下の「● 自キャラ名」表示。切り分け時だけ true に

    // ★トラブルシュート用★
    // 戦闘中にオーバーレイを起動すると ChangePrimaryPlayer/02 のいずれも来ないことがあるので、
    // 自キャラのフルネーム (ログ表記) をここに入れると、任意のログ行から ID を拾える。
    // 例: 'Forename Surname' (自キャラのフルネーム / 空文字なら無効)
    ownNameHint: '',

    // 上部に診断バナーを表示する。動いているか切り分けたい時だけ true に。
    debug: false,

    // 動作確認用ダミー DoT (15 秒で減衰、5 秒で点滅＋音)。
    // 起動時にゲーム側のログがなくても表示と音を試せる。
    demo: false,
  };

  var root = null;
  var statusEl = null;
  var debugEl = null;
  var ownId = null;
  var ownName = null;
  var tracked = {};
  var diag = { logLines: 0, cpps: 0, recentCodes: [], booted: false, mode: '?' };

  function init() {
    root = document.getElementById('dottimer');
    statusEl = document.getElementById('dot-status');
    debugEl = document.getElementById('dot-debug');
    if (CONFIG.debug) {
      if (debugEl) debugEl.style.display = 'block';
      document.body.classList.add('debug');   // CSS で上部余白を確保
    }

    if (!O.api) { console.error('[dottimer] Overlay.api is not initialized'); return; }
    O.api.on('ChangePrimaryPlayer', onPrimaryPlayer);
    O.api.on('LogLine', onLogLine);
    O.api.ready().then(function () { diag.booted = true; diag.mode = O.api.mode(); });

    renderStatus();
    renderDebug();

    if (CONFIG.demo) startDemo();
    requestAnimationFrame(loop);
  }

  function normId(s) {
    return String(s == null ? '' : s).toUpperCase().replace(/^0+(?=.)/, '');
  }

  function setOwn(id, name) {
    var nid = normId(id);
    if (nid && nid !== ownId) ownId = nid;
    if (name) ownName = name;
    renderStatus();
  }

  function onPrimaryPlayer(e) {
    diag.cpps++;
    if (e.charID != null) setOwn(Number(e.charID).toString(16), e.charName);
    else if (e.charName) setOwn(ownId, e.charName);
  }

  function onLogLine(e) {
    var L = e.line || [];
    diag.logLines++;
    if (L[0]) {
      diag.recentCodes.push(L[0]);
      if (diag.recentCodes.length > 8) diag.recentCodes.shift();
    }
    if (ownId == null) tryBootstrapByHint(L);
    switch (L[0]) {
      case '02': setOwn(L[2], L[3]); break;
      case '26': onStatusAdd(L);     break;
      case '30': onStatusRemove(L);  break;
      case '25': onDeath(L);         break;
    }
  }

  // CONFIG.ownNameHint と一致する名前フィールドが見つかり、直前が PC ID (10xxxxxx) なら採用。
  function tryBootstrapByHint(L) {
    var hint = CONFIG.ownNameHint;
    if (!hint) return;
    for (var i = 1; i < L.length; i++) {
      if (L[i] === hint && /^10[0-9A-F]{6}$/i.test(L[i - 1] || '')) {
        setOwn(L[i - 1], L[i]);
        return;
      }
    }
  }

  function isTrackedDot(name) {
    var i;
    for (i = 0; i < CONFIG.dotNamesExact.length; i++) {
      if (name === CONFIG.dotNamesExact[i]) return true;
    }
    for (i = 0; i < CONFIG.dotNamesPrefix.length; i++) {
      if (name.indexOf(CONFIG.dotNamesPrefix[i]) === 0) return true;
    }
    return false;
  }

  function keyOf(statusId, sourceId, targetId) {
    return normId(sourceId) + '|' + normId(targetId) + '|' + String(statusId).toUpperCase();
  }

  function onStatusAdd(L) {
    if (ownId == null) return;
    var statusId = L[2], statusName = L[3];
    var duration = parseFloat(L[4]) || 0;
    var sourceId = L[5], targetId = L[7], targetName = L[8] || '';
    if (normId(sourceId) !== ownId) return;
    if (!isTrackedDot(statusName)) return;
    if (duration < CONFIG.minDurationSec) return;
    upsert(keyOf(statusId, sourceId, targetId), statusName, targetName, duration);
  }

  function onStatusRemove(L) {
    if (ownId == null) return;
    if (normId(L[5]) !== ownId) return;
    remove(keyOf(L[2], L[5], L[7]));
  }

  function onDeath(L) {
    var deadId = normId(L[2]);
    for (var k in tracked) {
      if (tracked.hasOwnProperty(k) && k.split('|')[1] === deadId) remove(k);
    }
  }

  // ---- 表示要素 ----
  function makeRow() {
    var wrap = document.createElement('div');
    wrap.className = 'dot-row';
    var info = document.createElement('div'); info.className = 'dot-info';
    var name = document.createElement('span'); name.className = 'dot-name';
    var target = document.createElement('span'); target.className = 'dot-target';
    var time = document.createElement('span'); time.className = 'dot-time';
    info.appendChild(name); info.appendChild(target); info.appendChild(time);
    var bar = document.createElement('div'); bar.className = 'dot-bar';
    var fill = document.createElement('div'); fill.className = 'dot-bar-fill';
    bar.appendChild(fill);
    wrap.appendChild(info); wrap.appendChild(bar);
    return { wrap: wrap, name: name, target: target, time: time, fill: fill };
  }

  function upsert(key, statusName, targetName, duration) {
    var now = performance.now();
    var entry = tracked[key];
    if (!entry) { entry = tracked[key] = { el: makeRow() }; root.appendChild(entry.el.wrap); }
    entry.el.name.textContent = statusName;
    entry.el.target.textContent = targetName;
    entry.totalMs = duration * 1000;
    entry.expiresAt = now + entry.totalMs;
    entry.alerted = false;
    entry.el.wrap.classList.remove('alert');
  }

  function remove(key) {
    var entry = tracked[key];
    if (!entry) return;
    if (entry.el.wrap.parentNode) entry.el.wrap.parentNode.removeChild(entry.el.wrap);
    delete tracked[key];
  }

  // ---- メインループ ----
  function loop() {
    var now = performance.now();
    for (var k in tracked) {
      if (!tracked.hasOwnProperty(k)) continue;
      var e = tracked[k];
      var remainMs = e.expiresAt - now;
      var remain = remainMs / 1000;
      e.el.time.textContent = (remain > 0 ? remain.toFixed(1) : '0.0') + 's';
      var pct = e.totalMs > 0 ? Math.max(0, Math.min(100, (remainMs / e.totalMs) * 100)) : 0;
      e.el.fill.style.width = pct + '%';
      if (!e.alerted && remain > 0 && remain <= CONFIG.alertAtSec) {
        e.alerted = true;
        e.el.wrap.classList.add('alert');
        if (CONFIG.sound) playAlert();
      }
      if (remainMs <= -300) remove(k);
    }
    renderDebug();
    requestAnimationFrame(loop);
  }

  function renderStatus() {
    if (!CONFIG.showStatus || !statusEl) return;
    if (ownId) {
      statusEl.className = 'ok';
      statusEl.textContent = '● ' + (ownName || ownId);
    } else {
      statusEl.className = 'warn';
      statusEl.textContent = '⚠ 自キャラ未検出';
    }
  }

  function renderDebug() {
    if (!CONFIG.debug || !debugEl) return;
    var mode = (O.api && O.api.mode) ? O.api.mode() : '?';
    debugEl.textContent =
      'API:' + mode +
      ' | LogLine:' + diag.logLines +
      ' | CPP:' + diag.cpps +
      ' | own:' + (ownId || '?') + (ownName ? '(' + ownName + ')' : '') +
      ' | tracked:' + Object.keys(tracked).length +
      ' | codes:' + (diag.recentCodes.length ? diag.recentCodes.join(',') : '-');
  }

  // ---- デモ: 12 秒 DoT を 1 件流して可視化と音を確認 ----
  function startDemo() {
    setTimeout(function () {
      if (!ownId) setOwn('DEADBEEF', '(DEMO)');
      upsert('demo|demo|74F', 'ディア (DEMO)', '木人', 12);
    }, 600);
  }

  // ---- 通知音 ----
  // CONFIG.soundFile が指定されていればそれを再生 (wav/mp3/ogg)。
  // 失敗時 or 未指定なら Web Audio で内蔵ビープを鳴らす。
  var actx = null;
  var audioEl = null, audioElPath = null;

  function playAlert() {
    if (CONFIG.soundFile) {
      try {
        if (!audioEl || audioElPath !== CONFIG.soundFile) {
          audioEl = new Audio(CONFIG.soundFile);
          audioElPath = CONFIG.soundFile;
        }
        audioEl.volume = clamp01(CONFIG.soundVolume);
        try { audioEl.currentTime = 0; } catch (_) {}
        var p = audioEl.play();
        if (p && p.catch) p.catch(function (err) {
          console.warn('[dottimer] audio file play failed, fallback to beep:', err);
          webAudioBeep();
        });
        return;
      } catch (err) {
        console.warn('[dottimer] audio init failed, fallback to beep:', err);
      }
    }
    webAudioBeep();
  }

  // Web Audio で「ワンポイントなベル/チャイム」を合成する。
  // 基音 + 整数倍音 + 非整数倍音 (4.16x) の組み合わせで金属的な響き、各パーシャルは
  // 異なる減衰で「キン…ン」と短く美しく鳴る (FM/サンプル不要)。
  function webAudioBeep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      actx = actx || new Ctx();
      if (actx.state === 'suspended') actx.resume();
      var vol = clamp01(CONFIG.soundVolume);
      var t0 = actx.currentTime;
      var f0 = 1175;  // D6 — 通知音にちょうど良い高さ
      var partials = [
        { mult: 1.00, amp: 0.55, decay: 0.55 },
        { mult: 2.00, amp: 0.22, decay: 0.40 },
        { mult: 3.00, amp: 0.12, decay: 0.28 },
        { mult: 4.16, amp: 0.07, decay: 0.20 }   // 非整数倍音 (鐘らしさ)
      ];
      partials.forEach(function (p) {
        var osc = actx.createOscillator();
        var gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f0 * p.mult;
        osc.connect(gain); gain.connect(actx.destination);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(p.amp * vol, t0 + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
        osc.start(t0);
        osc.stop(t0 + p.decay + 0.05);
      });
    } catch (err) { console.warn('[dottimer] beep failed:', err); }
  }

  function clamp01(v) { v = Number(v); if (!(v >= 0)) return 0; if (v > 1) return 1; return v; }

  O.dottimer = { init: init, _config: CONFIG, _diag: diag };
})();

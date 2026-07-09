// 絶妖星乱舞(絶ケフカ) P3「アルテマブラスター」サイコロ位置カンペ。
// ケフカの連続突入(観察フェーズ)から「1回目の突入先」と「回転方向(時計/反時計)」を
// 自動判定し、8 人のサイコロ番号(1〜8)の立ち位置を八角形の中間スポットに描画する。
// 自キャラの頭マーカー(サイコロ番号)を検出したら、その行き先をハイライトする。
//
// ■ 検出に使うログ (実ログ Network_30203_*.log で確定)
//   観察フェーズ 突入 : 22|t|<cloneId>|ケフカ|BAE3|アルテマブラスター|<tgt>|…|<srcX>|<srcY>|…
//                       → clone のソース座標 = 突入の「エッジ」。1 体ごと ~2 秒間隔で 8 回、
//                         八方位を時計回り or 反時計回りに一周する。
//   頭マーカー(番号) : 27|t|<tgtId>|<名>|0000|0000|<icon>|…
//                       → icon 0150-0153 / 01B5-01B8 の 8 種 = サイコロ番号(既定 1-8)。
//   解決フェーズ ﾚｰｻﾞｰ : 21|t|<cloneId>|ケフカ|BAE4|アルテマブラスター|<番号持ち>|… (この時点で解決)
//   自キャラ ID       : 02 ChangePrimaryPlayer / ChangePrimaryPlayer イベント (dottimer と同じ)
//
// ■ 立ち位置の数式 (実ログ 10 バースト /複数日で検証。JP 攻略マクロとも一致)
//   フィールド中心 (100,100)。突入は八方位(N/NE/E/…/NW)から中心を貫いて対辺へ。
//   安置は「隣り合う突入線の中間」= 中心から 22.5°ずれた八角形の頂点 8 つ。
//   D = 1 回目の突入先の方角(北からの時計回り角)。s = ケフカが反時計回りなら +1 / 時計回りなら −1
//   (番号はケフカの回転と逆回りに増える)。
//     angle(サイコロ N) = ( D + s × (22.5 + (N−1)×45) ) mod 360
//   → D は サイコロ1(回転と逆側)と サイコロ8(回転側)に挟まれる。
//
//   ★注意: サイコロ番号の位置(1〜8)は D と回転から常に正しく描画される。頭マーカー icon →
//   番号の対応(diceIconMap)が万一ズレていても、頭の数字を見て同じ番号のスポットへ行けばよい。

(function () {
  'use strict';
  var O = window.Overlay = window.Overlay || {};
  console.log('[ultima] script loaded');

  // ===== 設定 (ここを編集する) =====
  var CONFIG = {
    // 頭マーカー icon(16進) → サイコロ番号。実ログで 8 種確認。
    // 既定は連番 (0150-0153 = 1-4, 01B5-01B8 = 5-8)。自分の頭の数字と食い違う場合はここを直す。
    diceIconMap: {
      '0150': 1, '0151': 2, '0152': 3, '0153': 4,
      '01B5': 5, '01B6': 6, '01B7': 7, '01B8': 8,
    },

    // フィールドマーカー配置。A〜D は十字(北/東/南/西)。
    // ※ うちのPTは 数字 1〜4 を標準から「左(反時計回り)に90°回転」した位置に置く:
    //   1=北西, 2=北東, 3=南東, 4=南西 (A/B/C/D は標準どおり)。
    // 色はマーカー識別ごと固定(1/A=赤, 2/B=黄, 3/C=青, 4/D=紫)。angle は北からの時計回り deg。
    // 別配置の静地は label/angle を書き換える。
    waymarks: [
      { label: 'A', angle: 0,   color: '#ff5b5b' },  // 北
      { label: '2', angle: 45,  color: '#ffd23d' },  // 北東
      { label: 'B', angle: 90,  color: '#ffd23d' },  // 東
      { label: '3', angle: 135, color: '#4fc3ff' },  // 南東
      { label: 'C', angle: 180, color: '#4fc3ff' },  // 南
      { label: '4', angle: 225, color: '#d17bff' },  // 南西
      { label: 'D', angle: 270, color: '#d17bff' },  // 西
      { label: '1', angle: 315, color: '#ff5b5b' },  // 北西
    ],

    // バースト終了後、これだけ経過したら待機状態へ戻す(秒)。
    resetAfterSec: 30,

    // 自キャラ判定のフォールバック (戦闘中起動時)。フルネーム or 空。
    ownNameHint: '',

    // 音 (自分の行き先が確定したら通知)
    sound: true,
    soundFile: '',
    soundVolume: 0.7,

    showStatus: false,  // 左下に自キャラ検出状況
    debug: false,       // 上部に診断バナー
    demo: false,        // ゲームログ無しで表示確認 (D=東・時計回り・自分3番)
  };

  // ===== 定数 =====
  var ABIL_OBS = 'BAE3';   // 観察フェーズ: 突入(type 22)
  var ABIL_RES = 'BAE4';   // 解決フェーズ: レーザー(type 21)
  var CENTER = { x: 100, y: 100 };
  var CENTER_EPS = 5;      // ソース座標が中心付近(突入途中)なら方角不定として捨てる
  // 16 方位 (英字) — サイコロ安置は 22.5°刻みの中間方位
  var WIND16 = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
    '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
  var WIND8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

  // ===== 状態 =====
  var els = {};
  var ownId = null, ownName = null;
  var state = null;
  var diag = { logLines: 0, codes: [], booted: false, lastIcon: null };

  function freshState() {
    return {
      active: false,
      startAt: 0,
      charges: [],       // クリーンな突入 [{id, dir}] を出現順に
      chargeIds: {},     // dedup 用
      D: null,           // 1 回目の突入先(北からの時計回り角, deg)
      rot: null,         // 'CW' | 'CCW'
      s: null,           // +1 / -1
      selfIcon: null,
      selfNumber: null,
      lastChargeAt: 0,
      resolvedAt: 0,
      alerted: false,
    };
  }

  function init() {
    els.root = document.getElementById('ub');
    els.canvas = document.getElementById('ub-arena');
    els.ctx = els.canvas.getContext('2d');
    els.head = document.getElementById('ub-head');
    els.self = document.getElementById('ub-self');
    els.status = document.getElementById('ub-status');
    els.debug = document.getElementById('ub-debug');

    if (CONFIG.debug && els.debug) { els.debug.style.display = 'block'; document.body.classList.add('debug'); }

    state = freshState();

    if (!O.api) { console.error('[ultima] Overlay.api missing'); return; }
    O.api.on('ChangePrimaryPlayer', onPrimaryPlayer);
    O.api.on('LogLine', onLogLine);
    O.api.ready().then(function () { diag.booted = true; });

    if (CONFIG.demo) startDemo();
    renderStatus();
    requestAnimationFrame(loop);
  }

  function normId(s) { return String(s == null ? '' : s).toUpperCase().replace(/^0+(?=.)/, ''); }
  function setOwn(id, name) {
    var nid = normId(id);
    if (nid && nid !== ownId) ownId = nid;
    if (name) ownName = name;
    renderStatus();
  }
  function onPrimaryPlayer(e) {
    if (e.charID != null) setOwn(Number(e.charID).toString(16), e.charName);
    else if (e.charName) setOwn(ownId, e.charName);
  }

  function onLogLine(e) {
    var L = e.line || [];
    diag.logLines++;
    if (L[0]) { diag.codes.push(L[0]); if (diag.codes.length > 10) diag.codes.shift(); }
    if (ownId == null) tryBootstrap(L);
    switch (L[0]) {
      case '02':  setOwn(L[2], L[3]);   break;
      case '01':  onZoneChange();       break;   // ゾーン移動(再入場) → リセット
      case '22':  onAbility(L, false);  break;   // BAE3 突入
      case '21':  onAbility(L, true);   break;   // BAE4 解決レーザー
      case '27':  onHeadMarker(L);      break;
      case '260': onCombatFlag(L);      break;   // 戦闘終了(ワイプ/撃破) → リセット
    }
  }

  function tryBootstrap(L) {
    var hint = CONFIG.ownNameHint;
    if (!hint) return;
    for (var i = 1; i < L.length; i++) {
      if (L[i] === hint && /^10[0-9A-F]{6}$/i.test(L[i - 1] || '')) { setOwn(L[i - 1], L[i]); return; }
    }
  }

  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  // ソース(ケフカ clone)座標を頑健に取り出す。type 22/21 は前段のダメージ欄が可変長なので、
  // 「空|空」ペア(HP/MP ブロック末尾)を探し、2 個目のペア直後 = ソース x,y とする。
  // 見つからなければ固定 index 40/41 にフォールバック。
  function srcPos(L) {
    var pairs = [];
    for (var i = 10; i < L.length - 3; i++) {
      if (L[i] === '' && L[i + 1] === '') pairs.push(i);
    }
    var j;
    if (pairs.length >= 2) j = pairs[1] + 2;
    else if (L.length > 41) j = 40;
    else return null;
    var x = parseFloat(L[j]), y = parseFloat(L[j + 1]);
    if (isNaN(x) || isNaN(y)) return null;
    return { x: x, y: y };
  }

  // 座標 → 北からの時計回り角(deg)。dx=+東, dy=+南。
  function dirDeg(x, y) {
    var dx = x - CENTER.x, dy = y - CENTER.y;
    return (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
  }
  function signedDiff(a, b) { return ((b - a) % 360 + 540) % 360 - 180; }
  function mod360(a) { return ((a % 360) + 360) % 360; }

  // BAE3(突入) / BAE4(解決レーザー)
  function onAbility(L, isResolve) {
    var abil = (L[4] || '').toUpperCase();
    if (isResolve) {
      if (abil !== ABIL_RES || !state.active) return;
      if (!state.resolvedAt) state.resolvedAt = now();
      return;
    }
    if (abil !== ABIL_OBS) return;

    var t = now();
    // 前のバーストから充分あいていたら新規バースト開始
    if (!state.active || (t - state.lastChargeAt) > CONFIG.resetAfterSec * 1000) {
      state = freshState();
      state.active = true;
      state.startAt = t;
      console.log('[ultima] アルテマブラスター開始');
    }
    state.lastChargeAt = t;

    var srcId = L[2];
    if (state.chargeIds[srcId]) return;   // 同 clone は 8 人ヒット分の重複行あり → 初回のみ

    var pos = srcPos(L);
    if (!pos) return;
    var dx = pos.x - CENTER.x, dy = pos.y - CENTER.y;
    if (Math.sqrt(dx * dx + dy * dy) < CENTER_EPS) return;  // 突入途中(中心)は方角不定
    state.chargeIds[srcId] = true;
    var dir = dirDeg(pos.x, pos.y);   // clone の湧いた方角(=突入元エッジ)
    state.charges.push({ id: srcId, dir: dir });

    // 1 個目のクリーン突入 → D(1 回目の突入先 = ソースの対角)
    if (state.D == null) state.D = mod360(dir + 180);
    // 2 個目 → 回転方向を確定 (中心スキップがあっても符号は不変)
    if (state.rot == null && state.charges.length >= 2) {
      var d = signedDiff(state.charges[0].dir, state.charges[1].dir);
      state.rot = d > 0 ? 'CW' : 'CCW';
      state.s = (state.rot === 'CW') ? -1 : 1;
      maybeAlert();
    }
  }

  // 頭マーカー(サイコロ番号)
  function onHeadMarker(L) {
    var icon = (L[6] || '').toUpperCase();
    var num = CONFIG.diceIconMap[icon];
    if (num == null) return;
    diag.lastIcon = icon;
    if (!state.active) { state.active = true; state.startAt = now(); state.lastChargeAt = now(); }
    var tgt = normId(L[2]);
    if (ownId != null && tgt === ownId) {
      state.selfIcon = icon;
      state.selfNumber = num;
      maybeAlert();
    }
  }

  // 260 InCombat: field2 = 戦闘フラグ(0/1)。0 = 戦闘終了 → 何度ワイプしても即クリア。
  // (戦闘中は 1 のままなので、ギミック進行中に誤リセットはしない)
  function onCombatFlag(L) {
    if (L[2] === '0' && (state.active || state.D != null)) {
      state = freshState();
      console.log('[ultima] 戦闘終了 → リセット');
    }
  }
  function onZoneChange() { state = freshState(); }

  function maybeAlert() {
    // D+回転+自分番号 が全部そろったら 1 度だけ通知
    if (!state.alerted && state.D != null && state.s != null && state.selfNumber != null) {
      state.alerted = true;
      if (CONFIG.sound) playAlert();
    }
  }

  // サイコロ N の方角(北からの時計回り角)
  function diceAngle(N) {
    if (state.D == null || state.s == null) return null;
    return mod360(state.D + state.s * (22.5 + (N - 1) * 45));
  }
  function wind16(angle) { return WIND16[Math.round(angle / 22.5) % 16]; }
  function wind8(angle) { return WIND8[Math.round(angle / 45) % 8]; }

  // その方角に最も近いフィールドマーカーの label ('A'..'4')。突入先(D)の呼称に使う。
  function waymarkAt(angle) {
    var best = null, bd = 999;
    CONFIG.waymarks.forEach(function (w) {
      var d = Math.abs(signedDiff(w.angle, angle));
      if (d < bd) { bd = d; best = w; }
    });
    return best ? best.label : wind8(angle);
  }
  // 安置(中間スポット)を挟む 2 つのマーカー → 'A/1' のような呼称。
  function betweenWaymarks(angle) {
    var lo = mod360(angle - 22.5), hi = mod360(angle + 22.5);
    return waymarkAt(lo) + '/' + waymarkAt(hi);
  }

  function isLive() {
    return state.active && (now() - state.lastChargeAt) < CONFIG.resetAfterSec * 1000;
  }

  // ===== 描画 =====
  function loop() { draw(); updateHud(); requestAnimationFrame(loop); }

  function pt(cx, cy, r, angle) {
    var a = angle * Math.PI / 180;
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  }

  function draw() {
    var ctx = els.ctx, C = els.canvas.width;
    var cx = C / 2, cy = C / 2;
    var RA = C * 0.44, RS = C * 0.335;
    ctx.clearRect(0, 0, C, C);

    // アリーナ
    var g = ctx.createRadialGradient(cx, cy * 0.98, RA * 0.2, cx, cy, RA);
    g.addColorStop(0, 'rgba(23,35,52,0.92)'); g.addColorStop(1, 'rgba(12,20,32,0.92)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, RA, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3d526e'; ctx.lineWidth = 3; ctx.stroke();

    // 方位 N
    ctx.fillStyle = 'rgba(160,180,210,0.6)';
    ctx.font = '700 ' + Math.round(C * 0.05) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - RA + C * 0.045);

    var live = isLive();

    // 突入線(フィールドマーカー方向・中心貫通)。危険ライン。
    ctx.strokeStyle = 'rgba(120,140,170,0.20)'; ctx.lineWidth = 1.5;
    for (var k = 0; k < 8; k++) {
      var e1 = pt(cx, cy, RA, k * 45), e2 = pt(cx, cy, RA, k * 45 + 180);
      ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
    }

    // フィールドマーカー (A-D / 1-4) を外周に描画
    var RW = RA * 0.9;
    CONFIG.waymarks.forEach(function (w) {
      var wp = pt(cx, cy, RW, w.angle);
      var isNum = /^[0-9]$/.test(w.label);
      ctx.beginPath();
      if (isNum) { // 数字マーカーは四角
        var s = C * 0.036;
        ctx.rect(wp.x - s, wp.y - s, s * 2, s * 2);
      } else {     // 英字マーカーは円
        ctx.arc(wp.x, wp.y, C * 0.04, 0, Math.PI * 2);
      }
      ctx.fillStyle = w.color; ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = w.color; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = w.color; ctx.font = '900 ' + Math.round(C * 0.045) + 'px sans-serif';
      ctx.fillText(w.label, wp.x, wp.y);
    });

    // 1 回目の突入先(D) 矢印
    if (state.D != null) {
      var d = pt(cx, cy, RA * 0.98, state.D);
      ctx.strokeStyle = '#ff6d6d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(d.x, d.y); ctx.stroke();
      // 矢じり
      var da = state.D * Math.PI / 180;
      drawArrowHead(ctx, d.x, d.y, da, C * 0.03, '#ff6d6d');
      var dl = pt(cx, cy, RA * 0.72, state.D);
      ctx.fillStyle = '#ffb3b3'; ctx.font = '800 ' + Math.round(C * 0.035) + 'px sans-serif';
      ctx.fillText('1回目', dl.x, dl.y);
    }

    // 回転方向アーク
    if (state.rot) drawRotationArc(ctx, cx, cy, RA * 0.86, state.rot);

    // ボス中心
    ctx.beginPath(); ctx.arc(cx, cy, C * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#d8e4f6'; ctx.fill();
    ctx.fillStyle = '#1c2a3e'; ctx.font = '900 ' + Math.round(C * 0.026) + 'px sans-serif';
    ctx.fillText('ケフカ', cx, cy);

    // サイコロ安置(8 中間スポット)
    if (state.D != null && state.s != null) {
      for (var n = 1; n <= 8; n++) {
        var p = pt(cx, cy, RS, diceAngle(n));
        var isSelf = (state.selfNumber === n);
        var rad = isSelf ? C * 0.052 : C * 0.04;
        if (isSelf) {
          var pulse = 1 + Math.sin(now() / 180) * 0.16;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad * 1.7 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,231,131,0.20)'; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = isSelf ? '#ffe783' : 'rgba(70,110,190,0.85)';
        ctx.strokeStyle = isSelf ? '#fff' : '#8fb2ff';
        ctx.lineWidth = isSelf ? 3 : 2; ctx.fill(); ctx.stroke();
        ctx.fillStyle = isSelf ? '#1c2a3e' : '#eaf1ff';
        ctx.font = '900 ' + Math.round(rad * 1.2) + 'px sans-serif';
        ctx.fillText(String(n), p.x, p.y);
      }
      // 自分スポットへの線
      if (state.selfNumber != null) {
        var sp = pt(cx, cy, RS, diceAngle(state.selfNumber));
        ctx.strokeStyle = 'rgba(255,231,131,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sp.x, sp.y); ctx.stroke(); ctx.setLineDash([]);
      }
    } else if (live) {
      ctx.fillStyle = 'rgba(200,215,240,0.8)'; ctx.font = '700 ' + Math.round(C * 0.03) + 'px sans-serif';
      ctx.fillText('突入を観察中…', cx, cy + RA * 0.6);
    }
    renderDebug();
  }

  function drawArrowHead(ctx, x, y, ang, size, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(0, -size); ctx.lineTo(size * 0.7, size * 0.7); ctx.lineTo(-size * 0.7, size * 0.7);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawRotationArc(ctx, cx, cy, r, rot) {
    var start = -Math.PI / 2, end = start + (rot === 'CW' ? 1 : -1) * Math.PI * 0.9;
    ctx.strokeStyle = 'rgba(140,220,255,0.75)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.min(start, end), Math.max(start, end), false); ctx.stroke();
    var tipAng = end;
    var tx = cx + r * Math.cos(tipAng), ty = cy + r * Math.sin(tipAng);
    var tang = tipAng + (rot === 'CW' ? 1 : -1) * Math.PI / 2 + Math.PI / 2;
    drawArrowHead(ctx, tx, ty, tang, r * 0.14, 'rgba(140,220,255,0.9)');
  }

  function updateHud() {
    if (!els.head) return;
    if (!isLive()) {
      els.head.textContent = 'アルテマブラスター待機';
      els.head.className = 'ub-head';
      els.self.textContent = ''; els.self.className = 'ub-self';
      return;
    }
    // 1 行目: 1 回目の突入先(マーカー) + 回転
    var parts = [];
    if (state.D != null) parts.push('1回目→' + waymarkAt(state.D) + '(' + wind8(state.D) + ')');
    if (state.rot) parts.push(state.rot === 'CW' ? '時計回り' : '反時計回り');
    els.head.textContent = parts.length ? parts.join('  ／  ') : '突入を観察中…';
    els.head.className = 'ub-head ' + (state.rot === 'CW' ? 'cw' : state.rot === 'CCW' ? 'ccw' : '');

    // 2 行目: 自分の番号と行き先(マーカー間)
    if (state.D != null && state.s != null && state.selfNumber != null) {
      var a = diceAngle(state.selfNumber);
      els.self.textContent = 'あなた ' + state.selfNumber + '番 → ' + betweenWaymarks(a) + ' の間';
      els.self.className = 'ub-self show';
    } else if (state.selfNumber != null) {
      els.self.textContent = 'あなた ' + state.selfNumber + '番 (突入待ち)';
      els.self.className = 'ub-self show';
    } else {
      els.self.textContent = '頭のサイコロ番号を確認';
      els.self.className = 'ub-self dim';
    }
  }

  // ===== 通知音 (dottimer 流用) =====
  var actx = null, audioEl = null, audioPath = null;
  function playAlert() {
    if (CONFIG.soundFile) {
      try {
        if (!audioEl || audioPath !== CONFIG.soundFile) { audioEl = new Audio(CONFIG.soundFile); audioPath = CONFIG.soundFile; }
        audioEl.volume = clamp01(CONFIG.soundVolume);
        try { audioEl.currentTime = 0; } catch (_) {}
        var pr = audioEl.play(); if (pr && pr.catch) pr.catch(beep);
        return;
      } catch (e) {}
    }
    beep();
  }
  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      actx = actx || new Ctx(); if (actx.state === 'suspended') actx.resume();
      var vol = clamp01(CONFIG.soundVolume), t0 = actx.currentTime, f0 = 1175;
      [[1, 0.5, 0.5], [2, 0.2, 0.38], [3, 0.1, 0.26]].forEach(function (a) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f0 * a[0]; o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(a[1] * vol, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + a[2]); o.start(t0); o.stop(t0 + a[2] + 0.05);
      });
    } catch (e) {}
  }
  function clamp01(v) { v = Number(v); if (!(v >= 0)) return 0; if (v > 1) return 1; return v; }

  function renderStatus() {
    if (!CONFIG.showStatus || !els.status) return;
    if (ownId) { els.status.className = 'ok'; els.status.textContent = '● ' + (ownName || ownId); }
    else { els.status.className = 'warn'; els.status.textContent = '⚠ 自キャラ未検出'; }
  }
  function renderDebug() {
    if (!CONFIG.debug || !els.debug) return;
    els.debug.textContent = 'log:' + diag.logLines + ' own:' + (ownId || '?') +
      ' active:' + state.active + ' chg:' + state.charges.length +
      ' D:' + (state.D != null ? Math.round(state.D) : '-') + ' rot:' + (state.rot || '-') +
      ' self:' + (state.selfNumber || '-') + '(' + (state.selfIcon || diag.lastIcon || '-') + ')' +
      ' codes:' + diag.codes.join(',');
  }

  // ===== デモ (D=東・時計回り・自分3番) =====
  function startDemo() {
    setTimeout(function () {
      if (!ownId) setOwn('10AAAAAA', '(DEMO)');
      state = freshState();
      state.active = true; state.startAt = now(); state.lastChargeAt = now();
      state.charges = [{ id: 'c1', dir: 270 }, { id: 'c2', dir: 315 }];  // 西→北西(時計回り)
      state.chargeIds = { c1: true, c2: true };
      state.D = 90; state.rot = 'CW'; state.s = -1;   // 1 回目の突入先=東
      state.selfIcon = '0152'; state.selfNumber = 3;
      // lastChargeAt を進めて live 維持
      var iv = setInterval(function () { if (state && state.active) state.lastChargeAt = now(); else clearInterval(iv); }, 3000);
    }, 500);
  }

  O.ultima = {
    init: init,
    _config: CONFIG,
    _state: function () { return state; },
    _diag: diag,
    _diceAngle: diceAngle,
  };
})();

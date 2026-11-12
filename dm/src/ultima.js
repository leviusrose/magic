// dm の P3「アルテマブラスター」サイコロ位置。magic/ultimablaster の判定部分をそのまま移植したもの
// (描画は dm の draw.js、表示の切り替えは dmp4.js が持つ)。
//
// ■ 判定 (実ログで確定。詳しくは magic/ultimablaster)
//   突入 : 264|t|<cloneId>|BAE3|…|heading の反対側 = 突入の「エッジ」(パケット値なので全員同じ)。8 回、八方位を一周
//          22 行のソース座標は予備。ACT がメモリから読むのでクライアントごとに違い、中心の向こう側で読めると 180° ずれる
//   番号 : 27|t|<tgtId>|…|<icon> の icon 0150-0153 / 01B5-01B8 = サイコロ 1〜8
//   解決 : 21|t|<cloneId>|ケフカ|BAE4|… (レーザー)
//   立ち位置: D = 1 回目の突入先 / s = ケフカが反時計なら +1・時計なら −1
//     angle(サイコロ N) = ( D + s × (22.5 + (N−1)×45) ) mod 360

(function () {
  'use strict';
  var O = window.Overlay = window.Overlay || {};

  var DICE_ICON = {
    '0150': 1, '0151': 2, '0152': 3, '0153': 4,
    '01B5': 5, '01B6': 6, '01B7': 7, '01B8': 8,
  };
  var ABIL_OBS = 'BAE3', ABIL_RES = 'BAE4';
  var CENTER = { x: 100, y: 100 };
  var CENTER_EPS = 5;          // ソース座標が中心付近 (突入途中) なら方角不定として捨てる
  var RESET_AFTER_MS = 30000;  // 最後の突入からこれだけ経ったら待機へ戻す
  var RESOLVED_HOLD_MS = 4000; // 解決 (BAE4) のあと、これだけ図を残す

  var nowFn = function () { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); };
  var ownId = null, onAlert = null;
  var state = fresh();

  function fresh() {
    return { active: false, charges: [], chargeIds: {}, D: null, rot: null, s: null,
      selfNumber: null, lastChargeAt: 0, resolvedAt: 0, alerted: false };
  }
  function now() { return nowFn(); }
  function normId(s) { return String(s == null ? '' : s).toUpperCase().replace(/^0+(?=.)/, ''); }
  function mod360(a) { return ((a % 360) + 360) % 360; }
  function signedDiff(a, b) { return ((b - a) % 360 + 540) % 360 - 180; }
  function dirDeg(x, y) { return (Math.atan2(x - CENTER.x, -(y - CENTER.y)) * 180 / Math.PI + 360) % 360; }

  // ソース座標: type 22/21 は前段が可変長なので「空|空」ペアの 2 個目の直後をソース x,y とする
  function srcPos(L) {
    var pairs = [];
    for (var i = 10; i < L.length - 3; i++) if (L[i] === '' && L[i + 1] === '') pairs.push(i);
    var j;
    if (pairs.length >= 2) j = pairs[1] + 2;
    else if (L.length > 41) j = 40;
    else return null;
    var x = parseFloat(L[j]), y = parseFloat(L[j + 1]);
    return (isNaN(x) || isNaN(y)) ? null : { x: x, y: y };
  }

  function onLogLine(L) {
    switch (L[0]) {
      case '22': onAbility(L, false); break;
      case '21': onAbility(L, true); break;
      case '27': onHeadMarker(L); break;
      case '264': onAbilityExtra(L); break;
    }
  }
  function onAbility(L, isResolve) {
    var abil = (L[4] || '').toUpperCase();
    if (isResolve) {
      if (abil === ABIL_RES && state.active && !state.resolvedAt) state.resolvedAt = now();
      return;
    }
    if (abil !== ABIL_OBS) return;
    var t = now();
    if (!state.active || (t - state.lastChargeAt) > RESET_AFTER_MS) { state = fresh(); state.active = true; }
    state.lastChargeAt = t;
    var srcId = L[2];
    if (state.chargeIds[srcId]) return;   // 同じ clone は 8 人ヒットぶん重複行がある
    var dir = null, pos = srcPos(L);
    if (pos && Math.hypot(pos.x - CENTER.x, pos.y - CENTER.y) >= CENTER_EPS) dir = dirDeg(pos.x, pos.y);
    addCharge(srcId, dir, false);
  }
  // 264|t|<cloneId>|BAE3|seq|flag|x|y|z|heading|… : 突入時の分身の向き (パケットの値なので全員同じ)。
  // 22 行のソース座標は ACT がメモリから読むのでクライアントごとに違い、突入途中 (中心や中心の向こう側) で
  // 取れることがある → 向きがあればそちらを優先する。heading 0 = 南向き。エッジは向きの反対側
  function onAbilityExtra(L) {
    if ((L[3] || '').toUpperCase() !== ABIL_OBS) return;
    var h = parseFloat(L[9]);
    if (isNaN(h)) return;
    var t = now();
    if (!state.active || (t - state.lastChargeAt) > RESET_AFTER_MS) { state = fresh(); state.active = true; }
    state.lastChargeAt = t;
    addCharge(L[2], mod360(Math.round(Math.atan2(-Math.sin(h), Math.cos(h)) * 180 / Math.PI / 45) * 45), true);
  }
  function addCharge(id, dir, fromHeading) {
    var c = state.chargeIds[id];
    if (!c) {
      c = state.chargeIds[id] = { id: id, dir: dir, sure: fromHeading };
      state.charges.push(c);
    } else if (fromHeading && !c.sure) {
      c.dir = dir; c.sure = true;
    } else return;
    solve();
  }
  // クリーンな突入 2 本から 1 本あたりの回転 (±45°) を出し、1 本目のソース方角を逆算 → D はその対角
  function solve() {
    var clean = [], sure = [];
    state.charges.forEach(function (c, i) {
      if (c.dir == null) return;
      clean.push({ i: i, dir: c.dir });
      if (c.sure) sure.push({ i: i, dir: c.dir });
    });
    if (sure.length >= 2 || (sure.length === 1 && sure[0].i === 0 && clean.length < 2)) clean = sure;
    if (clean.length < 2) {
      if (clean.length === 1 && clean[0].i === 0) state.D = mod360(clean[0].dir + 180);
      return;
    }
    var a = clean[0], b = clean[1];
    var rotStep = signedDiff(a.dir, b.dir) / (b.i - a.i) > 0 ? 45 : -45;
    state.rot = rotStep > 0 ? 'CW' : 'CCW';
    state.s = state.rot === 'CW' ? -1 : 1;
    state.D = mod360(mod360(a.dir - a.i * rotStep) + 180);
    maybeAlert();
  }
  function onHeadMarker(L) {
    var num = DICE_ICON[(L[6] || '').toUpperCase()];
    if (num == null) return;
    if (!state.active) { state.active = true; state.lastChargeAt = now(); }
    if (ownId != null && normId(L[2]) === ownId) { state.selfNumber = num; maybeAlert(); }
  }
  function maybeAlert() {
    if (!state.alerted && state.D != null && state.s != null && state.selfNumber != null) {
      state.alerted = true;
      if (onAlert) onAlert();
    }
  }
  function diceAngle(N) {
    if (state.D == null || state.s == null) return null;
    return mod360(state.D + state.s * (22.5 + (N - 1) * 45));
  }
  // 観察中〜解決後少しまでを「動いている」とみなす (このあいだパネルを光らせる)
  function live() {
    var t = now();
    if (!state.active) return false;
    if (state.resolvedAt) return t - state.resolvedAt < RESOLVED_HOLD_MS;
    return t - state.lastChargeAt < RESET_AFTER_MS;
  }
  function done() { return !!(state.resolvedAt && now() - state.resolvedAt >= RESOLVED_HOLD_MS); }

  // 方角に最も近いフィールドマーカー / 安置を挟む 2 つのマーカー → 'A/1'
  function waymarkAt(waymarks, angle) {
    var best = null, bd = 999;
    waymarks.forEach(function (w) { var d = Math.abs(signedDiff(w.angle, angle)); if (d < bd) { bd = d; best = w; } });
    return best ? best.label : '?';
  }
  function between(waymarks, angle) {
    return waymarkAt(waymarks, mod360(angle - 22.5)) + '/' + waymarkAt(waymarks, mod360(angle + 22.5));
  }

  // dm の図に渡すシーン
  function scene() {
    var spots = [];
    if (state.D != null && state.s != null) for (var n = 1; n <= 8; n++) spots.push({ n: n, angle: diceAngle(n) });
    return { kind: 'dice', spots: spots, self: state.selfNumber, observing: live() && !spots.length,
      known: spots.length > 0 && state.selfNumber != null };
  }
  // 一言: 「3番 A/1」/ 番号だけ分かっていれば「3番」/ それ以外は null
  function text(waymarks) {
    if (state.selfNumber == null) return live() ? '番号?' : null;
    var a = diceAngle(state.selfNumber);
    return state.selfNumber + '番' + (a != null ? ' ' + between(waymarks, a) : '');
  }

  O.dmUltima = {
    onLogLine: onLogLine,
    setOwn: function (id) { ownId = normId(id); },
    setClock: function (fn) { nowFn = fn; },
    setAlert: function (fn) { onAlert = fn; },
    reset: function () { state = fresh(); },
    live: live, done: done, scene: scene, text: text, diceAngle: diceAngle,
    _state: function () { return state; },
  };
})();

// dmp4 の ③④⑤⑦⑧ で使う「実際の範囲」の計算。
// ゲーム座標 (x = 東, y = 南, 中央 (100,100), 半径 20) で、範囲の形・安置・行き先を出す。
//
// ■ 範囲は補助アクター (ケフカ名義の見えない actor) の詠唱で取る (着弾の約 5 秒前)。
//   ★ 20 行の座標は古いことがある (一度 4 本とも (100,100) で来た) ので 263 行を優先する。
//   直線 = 幅 10 の帯を 45° 斜めに 4 本並べたうちの 2 本
//     BA9F = 本当 (予兆どおりに当たる) / BAA0 = 嘘の予兆 (見た目だけ) / BAA1 = 嘘のときの本物
//   扇 = 中央から斜め 4 方向の 90° のうち対角の 2 つ
//     BA98 = 本当 / BA9B = 嘘の予兆 (見た目だけ) / BA9E = 嘘のときの本物
//   混沌の炎・水 = 置いた人の位置に出る (下の WATER)
//   ※ 実ログ (2026-09-20〜10-02) の 263 の座標・向きと 21/22 の当たり判定で確認済み。

(function () {
  'use strict';
  var O = window.Overlay = window.Overlay || {};

  var GEO = {
    center: { x: 100, y: 100 },
    arenaRadius: 20,
    laneHalfWidth: 5,
    coneHalfAngle: 45,
    // 混沌の炎/水。実ログ: ドーナツは 混沌の炎 で中心から 4.36、混沌の水 で 5.77 以上でしか当たっていない / タケノコは 5.77 まで当たっている。
    // 正確な値は未確定なので安全側に寄せている。
    donutInner: 4,
    puddleRadius: 6,
    // 行き先を範囲の縁からどれだけ離すか。左から順に試す。
    margins: [2, 1, 0.5],
  };

  var SHAPE = {
    'BA9F': { elem: 'thunder', kind: 'lane', dmg: true, tell: true, truth: true },
    'BAA0': { elem: 'thunder', kind: 'lane', dmg: false, tell: true, truth: false },
    'BAA1': { elem: 'thunder', kind: 'lane', dmg: true, tell: false, truth: false },
    'BA98': { elem: 'ice', kind: 'cone', dmg: true, tell: true, truth: true },
    'BA9B': { elem: 'ice', kind: 'cone', dmg: false, tell: true, truth: false },
    'BA9E': { elem: 'ice', kind: 'cone', dmg: true, tell: false, truth: false },
  };
  // 混沌の炎 BB22 = タケノコ (本当) / BB23 = ドーナツ (嘘)、混沌の水 BB24 = ドーナツ (本当) / BB25 = タケノコ (嘘)
  var WATER = { 'BB22': 'puddle', 'BB23': 'donut', 'BB24': 'donut', 'BB25': 'puddle' };

  // 範囲の外にどれだけ離れているか (正 = 外 = 安全 / 負 = 中)。h は FFXIV の heading (rad)。
  function zoneMargin(z, x, y) {
    var dx = Math.sin(z.h), dy = Math.cos(z.h);
    var px = x - z.x, py = y - z.y;
    if (z.kind === 'lane') {
      var along = px * dx + py * dy, side = Math.abs(px * dy - py * dx);
      if (along < 0) return Math.max(-along, side - GEO.laneHalfWidth);
      return side - GEO.laneHalfWidth;
    }
    var dist = Math.hypot(px, py);
    if (dist < 1e-6) return 0;
    var half = GEO.coneHalfAngle * Math.PI / 180;
    var ang = Math.acos(Math.max(-1, Math.min(1, (px * dx + py * dy) / dist)));
    return dist * Math.sin(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ang - half)));
  }
  function waterMargin(w, x, y) {
    var d = Math.hypot(x - w.x, y - w.y);
    return w.type === 'donut' ? GEO.donutInner - d : d - GEO.puddleRadius;
  }
  function inZone(z, x, y) { return zoneMargin(z, x, y) < 0; }

  // 安置と行き先。zones の dmg だけを避ける。water は行き先の計算にだけ使う
  // (水は ⑦ に描くので、⑧ の緑の安置は範囲だけで塗る)。
  // 行き先: 範囲も水も margin 以上離れた点のうち中央に最も近い所
  //   → 無ければ 範囲からは離れて水にいちばん掛かりにくい所 → 無ければ範囲から最も離れた所
  function solve(zones, water, step) {
    var C = GEO.center, R = GEO.arenaRadius;
    step = step || 0.5;
    var dmg = (zones || []).filter(function (z) { return z.dmg; });
    water = water || [];
    var cells = [], all = [];
    for (var gx = -R; gx <= R; gx += step) {
      for (var gy = -R; gy <= R; gy += step) {
        if (gx * gx + gy * gy > R * R) continue;
        var x = C.x + gx, y = C.y + gy;
        var cs = R - Math.sqrt(gx * gx + gy * gy);
        for (var i = 0; i < dmg.length; i++) cs = Math.min(cs, zoneMargin(dmg[i], x, y));
        var cw = Infinity;
        for (var j = 0; j < water.length; j++) cw = Math.min(cw, waterMargin(water[j], x, y));
        cells.push({ x: x, y: y, c: cs });
        all.push({ x: x, y: y, cs: cs, cw: cw, d: Math.hypot(gx, gy) });
      }
    }
    var ms = GEO.margins, best = null, fit = null, k, n, a;
    for (k = 0; k < ms.length && !best; k++) {
      for (n = 0; n < all.length; n++) {
        a = all[n];
        if (a.cs >= ms[k] && a.cw >= ms[k] && (!best || a.d < best.d - 1e-9)) best = a;
      }
      if (best) fit = 'all';
    }
    for (k = 0; k < ms.length && !best; k++) {
      for (n = 0; n < all.length; n++) {
        a = all[n];
        if (a.cs >= ms[k] && (!best || a.cw > best.cw + 1e-9 || (Math.abs(a.cw - best.cw) <= 1e-9 && a.d < best.d))) best = a;
      }
      if (best) fit = 'spell';
    }
    if (!best) {
      all.forEach(function (c) { if (c.cs > 0 && (!best || c.cs > best.cs)) best = c; });
      fit = 'least';
    }
    return { step: step, cells: cells, spot: best ? { x: best.x, y: best.y, fit: fit } : null };
  }

  // ③ 単発の直線: 中央付近の 2 本の帯 (中心からのずれ ±5) のうち、本物が当たらないほうに乗る。
  // 今いる位置 (bx, by) から帯の真ん中の線へ横にスライドした点を返す (全員がその帯に一直線に並ぶ)。
  // 予兆が本当なら赤 (予兆) の外の帯、嘘なら赤の帯になる。
  function laneLineup(zones, bx, by) {
    var lanes = (zones || []).filter(function (z) { return z.kind === 'lane'; });
    if (!lanes.length) return null;
    var C = GEO.center, h = lanes[0].h, dx = Math.sin(h), dy = Math.cos(h), nx = dy, ny = -dx;
    var dmgOff = lanes.filter(function (z) { return z.dmg; })
      .map(function (z) { return (z.x - C.x) * nx + (z.y - C.y) * ny; });
    var pick = null;
    [GEO.laneHalfWidth, -GEO.laneHalfWidth].forEach(function (o) {
      if (pick == null && !dmgOff.some(function (d) { return Math.abs(d - o) < 1; })) pick = o;
    });
    if (pick == null) return null;
    var lim = GEO.arenaRadius - 2;
    var t = (bx - C.x) * dx + (by - C.y) * dy;
    var tmax = Math.sqrt(Math.max(0, lim * lim - pick * pick));
    t = Math.max(-tmax, Math.min(tmax, t));
    return { x: C.x + nx * pick + dx * t, y: C.y + ny * pick + dy * t, offset: pick };
  }
  // ⑤ 単発の扇: 今いる位置が本物の範囲の中か縁にあるとき、中央の周りに少しだけ回して
  // 範囲の縁から margin 以上離れた所へずらす (南北/東西の立ち位置はちょうど扇の境目にあるため)。
  function nudgeOut(zones, bx, by, margin) {
    margin = margin == null ? 2 : margin;
    var dmg = (zones || []).filter(function (z) { return z.dmg; });
    if (!dmg.length) return null;
    var C = GEO.center, r = Math.hypot(bx - C.x, by - C.y), a0 = Math.atan2(bx - C.x, -(by - C.y));
    function m(x, y) { return Math.min.apply(null, dmg.map(function (z) { return zoneMargin(z, x, y); })); }
    if (m(bx, by) >= margin) return { x: bx, y: by, moved: false };
    for (var deg = 1; deg <= 90; deg += 1) {
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var a = a0 + sgn * deg * Math.PI / 180, x = C.x + r * Math.sin(a), y = C.y - r * Math.cos(a);
        if (m(x, y) >= margin) return { x: x, y: y, moved: true };
      }
    }
    return null;
  }

  O.dmp4geo = { GEO: GEO, SHAPE: SHAPE, WATER: WATER, zoneMargin: zoneMargin, inZone: inZone, solve: solve,
    laneLineup: laneLineup, nudgeOut: nudgeOut };
})();

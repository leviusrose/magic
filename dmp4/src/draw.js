// dmp4 の描画。ロジック側 (dmp4.js) が作った「シーン」を受け取って canvas に描くだけの純関数群。
// 見出し・一言も canvas に焼くので、パネルの幅は高さ(と縦横比)だけで決まる
// → 高さに合わせて並べて、横は溢れたら切れる/詰まったらスライドしてくる、という並びにできる。
//
// ■ 優先順位
//   1. 自分の行き先 … 大きい黄色のマーカー + 中心からの点線。文字は入れない(つぶれるので)
//   2. 全員の候補   … 小さい暗い点 (TH / D の文字だけ薄く)
//   3. 危険/安置の形 … 円・ドーナツ・扇・帯
//   「何をするか」の言葉は図の下の一言に持たせるので、図の中に長い文字を置かない。
//   立ち位置は全部マップ基準なので、ボスの位置は描かない。
//
// ■ 文字はすべて「入る箱」を渡して自動で縮める (txtBox / labelIn)。
//   キャンバスの大きさが変わっても潰れないし、はみ出さない。
//
// 角度はすべて「北から時計回りの度数」。北が上・ウェイマーク配置は絶対方角のままなので、
// 図を頭の中で回さなくてよい。

(function () {
  'use strict';
  var O = window.Overlay = window.Overlay || {};

  var COL = {
    ink: '#cfe0f5', dim: 'rgba(150,170,200,0.5)', faint: 'rgba(120,140,170,0.16)',
    rim: '#3d526e', floor0: 'rgba(23,35,52,0.92)', floor1: 'rgba(12,20,32,0.92)',
    self: '#ffe783', boss: '#ff8b6b',
    other: 'rgba(70,110,190,0.45)', otherEdge: 'rgba(140,170,225,0.5)', otherInk: 'rgba(220,232,255,0.7)',
    safe: 'rgba(90,220,160,0.5)', danger: 'rgba(255,90,90,0.38)',
    stop: '#ff9a6b', go: '#8fe6c2',
  };

  // 縦を 4 つの帯に割り振る。バーの帯には何も描かないので、DOM のプログレスバーと重ならない。
  //   0  .. t1  見出し
  //   t1 .. a1  アリーナ (残りに収まる最大の円)
  //   v0 .. v1  一言
  //   v1 .. H   プログレスバー用の余白 (何も描かない。CSS の .p-bar と合わせる)
  function geom(W, H) {
    var t1 = H * 0.115;         // 見出し帯の下端
    var a1 = H * 0.775;         // アリーナ帯の下端
    var v0 = H * 0.785;         // 一言帯の上端
    var v1 = H * 0.950;         // 一言帯の下端
    var R = Math.min(W * 0.45, (a1 - t1) / 2);
    return { W: W, H: H, S: W, cx: W / 2, cy: (t1 + a1) / 2, R: R, t1: t1, v0: v0, v1: v1 };
  }
  function pt(cx, cy, r, angle) {
    var a = angle * Math.PI / 180;
    return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
  }
  function font(size, weight) {
    return (weight || 800) + ' ' + Math.max(5, Math.round(size)) + 'px "Noto Sans JP","Yu Gothic UI",sans-serif';
  }
  function draw(ctx, s, x, y, size, color, weight) {
    ctx.fillStyle = color || COL.ink;
    ctx.font = font(size, weight);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function widthOf(ctx, s) {
    var m = ctx.measureText ? ctx.measureText(s) : null;
    return (m && m.width) ? m.width : 0;
  }
  // 幅 maxW / 高さ maxH の箱に収まるまで縮めて中央に描く
  function txtBox(ctx, s, cx, cy, maxW, maxH, color, weight) {
    if (s == null || s === '') return;
    var size = maxH * 0.84;
    ctx.font = font(size, weight);
    var w = widthOf(ctx, s);
    if (w > maxW) size *= (maxW / w);
    draw(ctx, s, cx, cy, size, color, weight);
  }
  // 丸の中のラベル。文字数で基準の高さを決めてから幅で詰める。
  function labelIn(ctx, s, x, y, rad, color) {
    if (!s) return;
    var n = String(s).length;
    txtBox(ctx, s, x, y, rad * 1.62, rad * (n <= 1 ? 1.25 : n <= 2 ? 1.00 : 0.80), color, 900);
  }

  // アリーナ。表現は magic/ultimablaster と揃える
  // (放射グラデの床 + 八方位の薄い線 + 北の N + 英字マーカーは円/数字マーカーは四角)。
  function arena(ctx, G, waymarks) {
    var g = ctx.createRadialGradient(G.cx, G.cy * 0.98, G.R * 0.2, G.cx, G.cy, G.R);
    g.addColorStop(0, COL.floor0); g.addColorStop(1, COL.floor1);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.rim; ctx.lineWidth = Math.max(1, G.S * 0.011); ctx.stroke();

    draw(ctx, 'N', G.cx, G.cy - G.R + G.S * 0.042, G.S * 0.046, 'rgba(160,180,210,0.55)', 700);

    ctx.strokeStyle = 'rgba(120,140,170,0.18)'; ctx.lineWidth = Math.max(1, G.S * 0.005);
    for (var k = 0; k < 8; k++) {
      var e1 = pt(G.cx, G.cy, G.R, k * 45), e2 = pt(G.cx, G.cy, G.R, k * 45 + 180);
      ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y); ctx.stroke();
    }

    (waymarks || []).forEach(function (w) {
      var wp = pt(G.cx, G.cy, G.R * 0.90, w.angle);
      var r = G.S * 0.036;
      ctx.beginPath();
      if (/^[0-9]$/.test(w.label)) ctx.rect(wp.x - r, wp.y - r, r * 2, r * 2);
      else ctx.arc(wp.x, wp.y, r, 0, Math.PI * 2);
      ctx.fillStyle = w.color; ctx.globalAlpha = 0.22; ctx.fill();
      ctx.strokeStyle = w.color; ctx.globalAlpha = 0.7;
      ctx.lineWidth = Math.max(1, G.S * 0.010); ctx.stroke();
      ctx.globalAlpha = 0.85; labelIn(ctx, w.label, wp.x, wp.y, r, w.color);
      ctx.globalAlpha = 1;
    });
  }

  // 全員の候補 (脇役)。小さく暗く、文字は入れない (自分の位置が読みにくくなるので)。
  function other(ctx, G, x, y) {
    var r = G.S * 0.040;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = COL.other; ctx.fill();
    ctx.strokeStyle = COL.otherEdge; ctx.lineWidth = Math.max(1, G.S * 0.006); ctx.stroke();
  }
  // 自分の行き先 (主役)。大きさは magic/ultimablaster のサイコロ強調と同じ。
  // label は 1 文字だけ (止/動)。長い言葉は下の一言に任せる。
  function mine(ctx, G, x, y, label) {
    var r = G.S * 0.052;
    ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,231,131,0.20)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = COL.self; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, G.S * 0.009); ctx.stroke();
    if (label) labelIn(ctx, label, x, y, r, '#1c2a3e');
  }
  function leader(ctx, G, x, y) {
    ctx.strokeStyle = 'rgba(255,231,131,0.45)'; ctx.lineWidth = Math.max(1, G.S * 0.007);
    ctx.setLineDash([G.S * 0.028, G.S * 0.028]);
    ctx.beginPath(); ctx.moveTo(G.cx, G.cy); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]);
  }
  function otherAt(ctx, G, angle, r) {
    var p = pt(G.cx, G.cy, G.R * r, angle == null ? 0 : angle);
    other(ctx, G, p.x, p.y);
  }
  function mineAt(ctx, G, angle, r, label) {
    var p = pt(G.cx, G.cy, G.R * r, angle == null ? 0 : angle);
    leader(ctx, G, p.x, p.y); mine(ctx, G, p.x, p.y, label);
  }

  function fan(ctx, G, angle, halfWidth, color) {
    var a0 = (angle - halfWidth) * Math.PI / 180, a1 = (angle + halfWidth) * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(G.cx, G.cy);
    ctx.arc(G.cx, G.cy, G.R, a0 - Math.PI / 2, a1 - Math.PI / 2);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function lane(ctx, G, angle, halfW, color, offset) {
    var d = pt(0, 0, 1, angle), n = pt(0, 0, 1, angle + 90);
    var ox = (offset || 0) * n.x, oy = (offset || 0) * n.y;
    ctx.save();
    ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath();
    var Ln = G.R * 1.6;
    [[1, 1], [1, -1], [-1, -1], [-1, 1]].forEach(function (s, i) {
      var x = G.cx + ox + d.x * Ln * s[0] + n.x * halfW * s[1];
      var y = G.cy + oy + d.y * Ln * s[0] + n.y * halfW * s[1];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }
  function donut(ctx, G, innerRatio, color) {
    ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R, 0, Math.PI * 2);
    ctx.arc(G.cx, G.cy, G.R * innerRatio, 0, Math.PI * 2, true);
    ctx.fillStyle = color; ctx.fill('evenodd');
  }
  function disc(ctx, G, ratio, color) {
    ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R * ratio, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }
  // 視線の向き
  function arrow(ctx, G, from, outward) {
    var a = pt(G.cx, G.cy, G.R * (outward ? 0.52 : 0.50), from);
    var tip = pt(G.cx, G.cy, G.R * (outward ? 0.98 : 0.20), from);
    var back = pt(G.cx, G.cy, G.R * (outward ? 0.84 : 0.34), from);
    var n = pt(0, 0, 1, from + 90), w = G.S * 0.036;
    ctx.strokeStyle = COL.self; ctx.lineWidth = Math.max(1.5, G.S * 0.013);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(back.x + n.x * w, back.y + n.y * w);
    ctx.lineTo(back.x - n.x * w, back.y - n.y * w);
    ctx.closePath(); ctx.fillStyle = COL.self; ctx.fill();
  }
  function unknown(ctx, G) { draw(ctx, '?', G.cx, G.cy, G.S * 0.13, COL.dim, 900); }

  // ===== パネルごとの図 =====

  // 無の氾濫: 必要なのは「どっちの色に行くか」だけなので、左右に並べず 1 枚の色板で出す。
  // 色は GC3 のデバフが揃った時点で確定する (無の氾濫の真偽では反転しない)。
  function paintLaser(ctx, G, sc) {
    var w = G.W * 0.60, x = (G.W - w) / 2;
    var h = G.R * 1.55, y = G.cy - h / 2;
    if (!sc.known) {
      ctx.strokeStyle = 'rgba(120,140,170,0.35)'; ctx.lineWidth = Math.max(1, G.S * 0.008);
      ctx.setLineDash([G.S * 0.03, G.S * 0.03]);
      ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
      draw(ctx, '?', G.cx, G.cy, G.S * 0.20, COL.dim, 900);
      return;
    }
    var isBlue = (sc.color === 'black');
    var rgb = isBlue ? '79,195,255' : '192,123,255';
    ctx.fillStyle = 'rgba(' + rgb + ',0.40)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, G.S * 0.014);
    ctx.strokeRect(x, y, w, h);
    txtBox(ctx, isBlue ? '青' : '紫', G.cx, G.cy, w * 0.7, h * 0.55, '#fff', 900);
    if (sc.showSide && sc.dir) {
      txtBox(ctx, sc.dir === 'left' ? '左' : '右', G.cx, y + h * 0.86, w * 0.5, h * 0.16, COL.self, 800);
    }
  }

  // 雷水/加速度: 頭割り(南北) と 1人受け(東西)。マップ基準。
  function paintWindow(ctx, G, wm, sc) {
    arena(ctx, G, wm);
    if (sc.stack) {
      if (sc.stack.th != null) otherAt(ctx, G, sc.stack.th, 0.40);
      if (sc.stack.dps != null) otherAt(ctx, G, sc.stack.dps, 0.40);
    }
    if (sc.spread) {
      [].concat(sc.spread.th || []).forEach(function (a) { otherAt(ctx, G, a, 0.68); });
      [].concat(sc.spread.dps || []).forEach(function (a) { otherAt(ctx, G, a, 0.68); });
    }
    if (!sc.known) { unknown(ctx, G); return; }
    // 止/動 は自分マーカーの中に入れる (隅の小さい字だと見落とすので)
    var bomb = sc.bomb == null ? null : (sc.bomb ? '止' : '動');
    [].concat(sc.myAngles || []).forEach(function (a) {
      mineAt(ctx, G, a, sc.action === 'stack' ? 0.40 : 0.68, bomb);
    });
  }

  // 視線: 持ちは中央。真=全員外を向く / 偽=中央を見る。
  function paintGaze(ctx, G, wm, sc) {
    arena(ctx, G, wm);
    if (!sc.known) { other(ctx, G, G.cx, G.cy); unknown(ctx, G); return; }
    if (sc.mine) {
      // 自分が視線持ち → 中央が主役
      arrow(ctx, G, 180, false);
      mine(ctx, G, G.cx, G.cy);
    } else {
      var r = G.S * 0.055;
      ctx.beginPath(); ctx.arc(G.cx, G.cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,139,107,0.30)'; ctx.fill();
      ctx.strokeStyle = COL.boss; ctx.lineWidth = Math.max(1, G.S * 0.009); ctx.stroke();
      labelIn(ctx, '視', G.cx, G.cy, r, COL.boss);
      arrow(ctx, G, 0, sc.truth);
      mineAt(ctx, G, 0, 0.68);
    }
  }

  // 混沌の炎 / 混沌の水: 立ち位置は常に中央なので、出る範囲の形だけを見せる。
  //   タケノコ = 中央の円範囲 / それ以外 = ドーナツ (中央が安置)
  function paintChaos(ctx, G, wm, sc) {
    arena(ctx, G, wm);
    if (!sc.known) { unknown(ctx, G); return; }
    var lw = Math.max(1, G.S * 0.008);
    var r = sc.bait ? 0.30 : 0.42;
    if (sc.bait) disc(ctx, G, r, COL.danger);
    else donut(ctx, G, r, COL.danger);
    ctx.strokeStyle = 'rgba(255,120,120,0.6)'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(G.cx, G.cy, G.R * r, 0, Math.PI * 2); ctx.stroke();
  }

  // マジックアウト: 位置ではなく真偽そのものが答えなので、図にせず 扇/直線 を 踏む/踏まない の 2 行で出す。
  function paintTruth(ctx, G, sc) {
    var y0 = G.t1, y1 = G.v0, h = (y1 - y0) / 2;
    if (!sc.known) {
      // 答えは出た瞬間まで確定しない。チャージ済みの予兆だけ「溜」として破線で仮表示する。
      var c = sc.charged;
      [['扇', c ? c.ice : null], ['直線', c ? c.thunder : null]].forEach(function (row, i) {
        var cy = y0 + h * (i + 0.5);
        ctx.fillStyle = 'rgba(120,140,170,0.10)';
        ctx.fillRect(G.W * 0.05, cy - h * 0.40, G.W * 0.90, h * 0.80);
        ctx.strokeStyle = 'rgba(120,140,170,0.40)'; ctx.lineWidth = Math.max(1, G.S * 0.006);
        ctx.setLineDash([G.S * 0.03, G.S * 0.026]);
        ctx.strokeRect(G.W * 0.05, cy - h * 0.40, G.W * 0.90, h * 0.80);
        ctx.setLineDash([]);
        txtBox(ctx, row[0], G.W * 0.27, cy, G.W * 0.34, h * 0.48, COL.dim, 800);
        txtBox(ctx, row[1] == null ? '?' : ('溜' + (row[1] ? '真' : '偽')),
          G.W * 0.68, cy, G.W * 0.44, h * 0.54, COL.dim, 900);
      });
      return;
    }
    [['扇', sc.ice], ['直線', sc.thunder]].forEach(function (row, i) {
      var cy = y0 + h * (i + 0.5);
      var step = !row[1];                  // 嘘 = 予兆の中が安全 = 踏む
      // 色: 踏む = 赤系 / 踏まない = 緑系。逆にしたいときはこの 2 行の三項を入れ替える。
      var tint = step ? 'rgba(255,90,90,0.16)' : 'rgba(90,220,160,0.16)';
      var ink = step ? COL.stop : COL.go;
      ctx.fillStyle = tint;
      ctx.fillRect(G.W * 0.05, cy - h * 0.40, G.W * 0.90, h * 0.80);
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1, G.S * 0.006);
      ctx.strokeRect(G.W * 0.05, cy - h * 0.40, G.W * 0.90, h * 0.80); ctx.globalAlpha = 1;
      txtBox(ctx, row[0], G.W * 0.27, cy, G.W * 0.34, h * 0.48, COL.ink, 800);
      txtBox(ctx, step ? '踏む' : '踏まない', G.W * 0.68, cy, G.W * 0.44, h * 0.58, ink, 900);
    });
  }

  O.dmp4draw = {
    // label = { title, value, mine }
    paint: function (ctx, W, H, waymarks, sc, label) {
      var G = geom(W, H);
      ctx.clearRect(0, 0, W, H);
      label = label || {};
      txtBox(ctx, label.title || '', W / 2, G.t1 * 0.48, W * 0.98, G.t1 * 0.86, COL.dim, 700);

      switch (sc && sc.kind) {
        case 'laser': paintLaser(ctx, G, sc); break;
        case 'window': paintWindow(ctx, G, waymarks, sc); break;
        case 'gaze': paintGaze(ctx, G, waymarks, sc); break;
        case 'chaos': paintChaos(ctx, G, waymarks, sc); break;
        case 'truth': paintTruth(ctx, G, sc); break;
        default: arena(ctx, G, waymarks); break;
      }

      // 一言は必ず 1 行 (2 行に折って小さくしない)。帯の高さと幅に自動フィット。
      var band = G.v1 - G.v0;
      txtBox(ctx, label.value == null ? '' : String(label.value),
        W / 2, G.v0 + band * 0.52, W * 0.98, band * 0.95,
        label.mine ? COL.self : COL.ink, 900);
    },
    _pt: pt,
    _geom: geom,
  };
})();

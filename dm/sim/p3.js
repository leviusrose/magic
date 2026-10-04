// dm シミュレータの台本: P3「アルテマブラスター」→ P4 を通しで流す。
// P4 部分は p4-sim/timeline.js (window.P4Sim) をそのまま使い、時刻を P4_AT 秒ずらす。
// P3 の時刻は実ログ (2026-10-02) の間隔に合わせた:
//   突入 BAE3 が 2.0 秒ごとに 8 回 / 番号の頭マーカーは 9.9 秒 (5 本目と 6 本目の間) /
//   レーザー BAE4 は 22.06 秒から 0.22 秒ごとに 8 本。
//   ★ 突入の座標は途中のスナップで中央 (100,100) になることがある (実ログでも 8 本中 2 本)。
// 実際は P3 の後 3 分半ほどで P4 が始まるが、シミュレータでは詰めて P4_AT 秒にしている。

(function () {
  'use strict';
  var NS = window.P4Sim;
  var P4_AT = 30;                      // P4 (おちょくりソウル詠唱) の開始時刻
  var CHARGE_GAP = 2.0, DICE_AT = 9.9, LASER_AT = 22.06, LASER_GAP = 0.22;
  var ICON = ['0150', '0151', '0152', '0153', '01B5', '01B6', '01B7', '01B8'];
  var SELF = (NS.ID && NS.ID.SELF) || '10AA0001';
  var WIND8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function mod360(a) { return ((a % 360) + 360) % 360; }

  // BAE3 の 22 行。ソース座標は「空|空」ペアの 2 個目の直後 (ultima.js の srcPos と同じ形)
  function chargeLine(id, x, y) {
    return ['22', 't', id, 'ケフカ', 'BAE3', 'アルテマブラスター', SELF, 'You Player',
      '750603', '1000', '1B', 'BAE38000', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0',
      '200000', '200000', '10000', '10000', '', '', '100.00', '100.00', '0.00', '0.00',
      '9415000', '9415000', '10000', '10000', '', '', x.toFixed(2), y.toFixed(2), '0.00', '0.00',
      '000014CF', '0', '8', '00'];
  }
  function laserLine(id) { return ['21', 't', id, 'ケフカ', 'BAE4', 'アルテマブラスター', SELF, 'You Player', '0', '0']; }
  function diceLine(tgt, name, icon) { return ['27', 't', tgt, name, '0000', '0000', icon, tgt, '0000', '0000']; }

  var baseRandom = NS.randomScenario, baseBuild = NS.build, baseDescribe = NS.describe;

  NS.P4_AT = P4_AT;
  NS.END = P4_AT + 120;

  NS.randomScenario = function () {
    var s = baseRandom();
    s.p3 = {
      first: Math.floor(Math.random() * 8),       // 1 本目の突入元 (八方位 0〜7、北から時計回り)
      cw: Math.random() < 0.5,                    // ケフカの回転 (時計回りか)
      self: 1 + Math.floor(Math.random() * 8),    // 自分のサイコロ番号
      // 中央 (方角が取れない) で記録される突入 (1 本目は必ず読める形にはしない = 実ログどおり)
      blind: [pick([0, 1, 2, 3]), pick([4, 5, 6, 7])],
    };
    return s;
  };

  NS.build = function (scn) {
    var p3 = scn.p3 || NS.randomScenario().p3;
    var ev = [];
    function add(t, kind, actor, label, lines, mine) {
      ev.push({ t: t, kind: kind, actor: actor, label: label, lines: lines || [], mine: !!mine });
    }
    var step = p3.cw ? 45 : -45, ids = [];
    for (var i = 0; i < 8; i++) {
      var id = '400017' + (0xBD - i).toString(16).toUpperCase();
      ids.push(id);
      var a = mod360((p3.first * 45) + i * step) * Math.PI / 180;
      var blind = p3.blind.indexOf(i) >= 0;
      var x = blind ? 100 : 100 + 20 * Math.sin(a), y = blind ? 100 : 100 - 20 * Math.cos(a);
      add(i * CHARGE_GAP, 'cast', 'ケフカ', 'アルテマブラスター 突入 ' + (i + 1) + '本目'
        + (blind ? '（中央で記録 = 方角不明）' : '（' + WIND8[mod360(p3.first + i * (p3.cw ? 1 : -1)) % 8] + 'から）'),
        [chargeLine(id, x, y)]);
    }
    add(DICE_AT, 'debuff', 'ケフカ', 'サイコロ番号の頭マーカー（自分 = ' + p3.self + '番）', [
      diceLine(SELF, 'You Player', ICON[p3.self - 1]),
      diceLine('10AA0002', 'Mate Player', ICON[p3.self % 8]),
    ]);
    add(LASER_AT, 'resolve', 'ケフカ', 'P3 アルテマブラスター ← レーザー（自分の番号の場所へ）', [laserLine(ids[0])], true);
    for (var k = 1; k < 8; k++) add(LASER_AT + k * LASER_GAP, 'hit', 'ケフカ', 'レーザー ' + (k + 1), [laserLine(ids[k])]);
    // P4 は p4-sim の台本を P4_AT 秒ずらして流す
    baseBuild(scn).forEach(function (e) {
      add(e.t + P4_AT, e.kind, e.actor, e.label, e.lines, e.mine);
    });
    ev.sort(function (x, y) { return x.t - y.t; });
    return ev;
  };

  NS.describe = function (scn) {
    var p3 = scn.p3 || {};
    var first = p3.first == null ? null : p3.first;
    var D = first == null ? null : mod360(first * 45 + 180);
    var s = p3.cw ? -1 : 1;
    var ang = (D == null || !p3.self) ? null : mod360(D + s * (22.5 + (p3.self - 1) * 45));
    return [
      ['P3 1本目の突入', first == null ? '?' : WIND8[first] + 'から（突入先 = ' + WIND8[D / 45] + '）'],
      ['P3 ケフカの回転', p3.cw ? '時計回り' : '反時計回り'],
      ['P3 自分の番号', p3.self + '番 → 北から ' + (ang == null ? '?' : ang.toFixed(1) + '°')],
    ].concat(baseDescribe(scn));
  };
})();

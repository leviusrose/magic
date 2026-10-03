// 絶妖星乱舞 P4 のタイムラインとシナリオ生成。
// 「おちょくりソウルの詠唱開始」を 0 秒とした相対秒。数値は cactbot の
// dancing_mad タイムライン (ゾーン 553) から取った。
//
// ★ 詠唱開始と着弾は別物。ログに流すのは詠唱開始 (type 20) なので、
//   着弾時刻から詠唱時間を引いた時刻に流す。ここを混同すると
//   オーバーレイのカウントダウンが詠唱時間ぶんズレる。

(function () {
  'use strict';
  var NS = window.P4Sim = window.P4Sim || {};

  // ---- 実タイムライン (着弾ベース) ----
  var T = {
    phaseCast: 0.0, phaseHit: 5.0,        // おちょくりソウル (5.0s 詠唱)
    middle: 8.1,
    mystery1: 14.5, mystery2: 29.3, mystery3: 44.4,   // なぞなぞマジック (予兆が出る)
    gc1Hit: 18.9, gc2Hit: 33.7, gc3Hit: 48.6,         // グランドクロス (8.7s 詠唱)
    gc3Debuff: 49.6,
    chaos1Hit: 23.9, chaos2Hit: 38.7,                 // ほのお/つなみ (8.7s 詠唱)
    floodHit: 60.7, antilight: 61.1,                  // 無の氾濫 (5.0s 詠唱) → アンチライト/デスエッジ
    deathSurge: 64.9,                                 // デスサージ (BB1C/BB1D)
    manaCharge: 69.2,
    shortRes: 69.5,
    boltRes: 77.5,                                    // ★単発サンダガ = 直線 (もりもりサンダガ)                                   // ★早の枠が解決 = デスボルト/デスウェイブ 1 回目
    gaze1Res: 78.5,                                   // ★視線1 = デスシュリーク 1 回目
    fireCast: 85.2,                                   // ★混沌の炎の詠唱開始 (5.0s) = ここで位置が確定
    upsurge: 87.5,
    strayFlames: 90.2,                                // 混沌の炎 着弾
    longRes: 94.4,                                    // ★遅の枠が解決 = デスボルト/デスウェイブ 2 回目
    coneRes: 95.5,                                    // ★単発ブリザガ = 扇 (ひろげるブリザガ)
    gaze2Res: 102.4,                                  // ★視線2 = デスシュリーク 2 回目
    waterCast: 108.0,                                 // ★混沌の水の詠唱開始 (5.0s) = ここで位置が確定
    manaReleaseHit: 108.8,                            // マジックアウト (6.7s 詠唱)
    straySpray: 113.0,                                // 混沌の水 着弾
    thunder2: 113.9,                                  // もりもりサンダガ/ひろげるブリザガ 着弾
    enrage: 118.2,
  };
  // bolt/cone は実ログの詠唱時間 (4.7s)。範囲の補助アクターも同じ瞬間に詠唱する。
  // place = 混沌の炎/水の設置 (置いた人の位置で 5 秒後に発動)。out = マジックアウトの範囲 (108.8 → 113.9)。
  var CAST = { gc: 8.7, chaos: 8.7, flood: 5.0, manaRelease: 6.7, phase: 5.0, bolt: 4.7, cone: 4.7,
    place: 5.0, out: 5.1 };

  // ---- デバフの残り時間 (秒) ----
  // ★ 実測値ではなく「解決時刻 − 付与時刻」で逆算した値。解決時刻は cactbot の
  //   dancing_mad タイムライン (デスボルト/デスウェイブ/デスシュリーク、混沌の炎/水の詠唱開始)
  //   をそのまま採用しているので、カウントダウンが 0 になる瞬間 = 実際に処理する瞬間になる。
  //   ゲームが送ってくる実際の秒数は整数かもしれないが、その場合でも誤差は 0.5 秒以内。
  // 付与は GC1 = 19.0 / GC2 = 33.8、カオスは着弾と同時 (23.9 / 38.7)。
  var DUR = {
    shriek1: 59.5, shriek2: 68.6,   // 視線 → 78.5 / 102.4
    short1: 50.5, short2: 35.7,     // 早の枠 → どちらで付いても 69.5
    long1: 75.4, long2: 60.6,       // 遅の枠 → どちらで付いても 94.4
    entropy1: 61.3, entropy2: 46.5, // 混沌の炎 → どちらで付いても 85.2
    fluid1: 84.1, fluid2: 69.3,     // 混沌の水 → どちらで付いても 108.0
    wound: 15,
  };

  // ---- ログ行ビルダー ----
  var ID = { SELF: '10AA0001', MATE: '10AA0002', KEFKA: '4000A001', NEO: '4000A002', CHAOS: '4000A003' };
  function cast(src, name, id, abil, ct) { return ['20', 't', src, name, id, abil, src, name, String(ct)]; }
  function abil(src, name, id, a) { return ['21', 't', src, name, id, a, src, name, '0', '0']; }
  function stat(id, name, dur, tgt, tgtName) {
    return ['26', 't', id, name, dur.toFixed(2), ID.NEO, 'ネオエクスデス', tgt, tgtName, '00', '0', '0'];
  }
  function tell(count) { return ['26', 't', '808', '-', '9999.00', ID.NEO, 'Boss', ID.NEO, 'Boss', count, '0', '0']; }
  function head(icon) { return ['27', 't', ID.KEFKA, 'ケフカ', '0000', '0000', icon, ID.KEFKA, '0000', '0000']; }
  var TELL_EX = { true: '462', false: '461' };
  var TELL_CH = { true: '460', false: '45F' };
  var HEAD_ICE = { true: '02A4', false: '02A3' };
  var HEAD_THU = { true: '02A6', false: '02A5' };

  // ---- 自分の担当パターン ----
  // 各プレイヤーは「早」と「遅」にひとつずつ担当を持つ。視線持ちは必ず加速度も持つ。
  var ASSIGN = [
    { key: 'fork-short', label: '早=フォーク / 遅=加速度', short: 'fork', long: 'bomb' },
    { key: 'water-short', label: '早=水圧縮 / 遅=加速度', short: 'water', long: 'bomb' },
    { key: 'fork-long', label: '早=加速度 / 遅=フォーク', short: 'bomb', long: 'fork' },
    { key: 'water-long', label: '早=加速度 / 遅=水圧縮', short: 'bomb', long: 'water' },
    { key: 'gaze1', label: '視線1持ち / 遅=加速度', short: 'gaze', long: 'bomb' },
    { key: 'gaze2', label: '早=加速度 / 視線2持ち', short: 'bomb', long: 'gaze' },
    { key: 'bomb-both', label: '早=加速度 / 遅=加速度 (雷水なし)', short: 'bomb', long: 'bomb' },
  ];
  var FLOOD_IDS = [
    { id: 'C392', label: '本当 / 青が右' },
    { id: 'C393', label: '本当 / 青が左' },
    { id: 'C3A1', label: '嘘 / 青が右' },
    { id: 'C3A2', label: '嘘 / 青が左' },
  ];

  NS.T = T;
  NS.CAST = CAST;
  NS.DUR = DUR;
  NS.ID = ID;
  NS.ASSIGN = ASSIGN;
  NS.FLOOD_IDS = FLOOD_IDS;

  // ---- ランダムなシナリオ ----
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function coin() { return Math.random() < 0.5; }
  NS.randomScenario = function () {
    return {
      role: pick(['th', 'dps']),
      assign: pick(ASSIGN).key,
      gc1: coin(), chaos1: coin(), gc2: coin(), chaos2: coin(),
      fireFirst: coin(),                 // カオスの詠唱順 (ほのお先か)
      wound: pick(['white', 'black']),
      dof: pick(['death', 'field']),
      flood: pick(FLOOD_IDS).id,
      // なぞなぞマジックの予兆 (単発 2 発とは別。古い予兆が漏れないことの確認用)
      mysteryIce: coin(), mysteryThunder: coin(),
      // ★マジックチャージと一緒に出る予兆。⑧ (単発 2 発) の答えはこれで決まる
      lineTruth: coin(), coneTruth: coin(),
      // マジックアウトで出る予兆。チャージ時の答えとの XNOR で ⑧ が上書きされる
      outIce: coin(), outThunder: coin(),
      // ★範囲の位置は 単発の直線 / 単発の扇 / マジックアウト でそれぞれ独立にランダム
      //   (実ログでも単発とアウトで直線の向きが変わった回がある)
      boltGeo: { dir: coin(), parity: coin() }, coneGeo: { pair: coin() },
      outLineGeo: { dir: coin(), parity: coin() }, outConeGeo: { pair: coin() },
      // 混沌の炎/水を置く位置 (8 人ぶん。ボス下に集まっているが少しずれる)
      firePos: jitter8(), waterPos: jitter8(),
    };
  };
  function jitter8() {
    var a = [];
    for (var i = 0; i < 8; i++) a.push([100 + (Math.random() - 0.5) * 3, 100 + (Math.random() - 0.5) * 3]);
    return a;
  }

  // ---- 範囲の補助アクター (実ログと同じ形) ----
  // 直線: 幅 10 の帯を 45° 斜めに 4 本 (中心からのずれ ±5 / ±15)。始点は中心から 20 の線上。
  //   dir: true = 南東向き (heading 0.785) / false = 南西向き (-0.785)
  //   parity: 当たる (本当) / 予兆 (嘘) の 2 本が {+15,-5} か {+5,-15} か
  // 扇: 中央から斜め 4 方向の 90° のうち対角 2 つ。pair: true = 北西+南東 / false = 南西+北東
  var helperSeq = 0;
  function helperLines(id, x, y, h, ct) {
    var src = '4000C' + ('00' + (helperSeq++ % 256).toString(16).toUpperCase()).slice(-3);
    return [
      ['20', 't', src, 'ケフカ', id, '-', src, 'ケフカ', ct.toFixed(3), x.toFixed(2), y.toFixed(2), '0.00', h.toFixed(2)],
      ['263', 't', src, id, x.toFixed(3), y.toFixed(3), '0.000', h.toFixed(3)],
    ];
  }
  function lanes(geo, truth, ct) {
    var h = geo.dir ? 0.785 : -0.785, dx = Math.sin(h), dy = Math.cos(h), nx = dy, ny = -dx;
    var a = geo.parity ? [15, -5] : [5, -15], b = geo.parity ? [5, -15] : [15, -5];
    var out = [];
    function put(id, offs) {
      offs.forEach(function (o) {
        out = out.concat(helperLines(id, 100 - dx * 20 + nx * o, 100 - dy * 20 + ny * o, h, ct));
      });
    }
    if (truth) put('BA9F', a);
    else { put('BAA0', a); put('BAA1', b); }
    return out;
  }
  function cones(geo, truth, ct) {
    var a = geo.pair ? [-2.356, 0.785] : [-0.785, 2.356], b = geo.pair ? [-0.785, 2.356] : [-2.356, 0.785];
    var out = [];
    function put(id, hs) { hs.forEach(function (h) { out = out.concat(helperLines(id, 99.99, 99.99, h, ct)); }); }
    if (truth) put('BA98', a);
    else { put('BA9B', a); put('BA9E', b); }
    return out;
  }
  function placements(id, pos) {
    var out = [];
    pos.forEach(function (q) { out = out.concat(helperLines(id, q[0], q[1], -3.142, CAST.place)); });
    return out;
  }
  NS._lanes = lanes; NS._cones = cones;

  // ---- シナリオ → タイムライン (イベント列) ----
  // 各イベント: { t, kind, actor, label, lines[], mine }
  //   kind: 'cast' 詠唱開始 / 'hit' 着弾 / 'debuff' デバフ付与 / 'resolve' 自分が動く瞬間
  NS.build = function (scn) {
    var a = ASSIGN.filter(function (x) { return x.key === scn.assign; })[0] || ASSIGN[0];
    var ev = [];
    function add(t, kind, actor, label, lines, mine) {
      ev.push({ t: t, kind: kind, actor: actor, label: label, lines: lines || [], mine: !!mine });
    }
    var S = ID.SELF, M = ID.MATE, K = ID.KEFKA, N = ID.NEO, C = ID.CHAOS;
    var SN = 'You Player', MN = 'Mate Player';

    // --- フェーズ開始 ---
    add(T.phaseCast, 'cast', 'ケフカ', 'おちょくりソウル 詠唱', [cast(K, 'ケフカ', 'C2DC', 'おちょくりソウル', CAST.phase)]);
    add(T.phaseHit, 'hit', 'ケフカ', 'おちょくりソウル 着弾', [abil(K, 'ケフカ', 'C2DC', 'おちょくりソウル')]);

    // --- なぞなぞマジック 3 回 (予兆) ---
    [T.mystery1, T.mystery2, T.mystery3].forEach(function (t, i) {
      add(t, 'hit', 'ケフカ', 'なぞなぞマジック' + (i + 1), [
        abil(K, 'ケフカ', 'BA94', 'なぞなぞマジック'),
        head(HEAD_ICE[scn.mysteryIce]), head(HEAD_THU[scn.mysteryThunder]),
      ]);
    });

    // --- グランドクロス 1 / 2 ---
    [[1, T.gc1Hit, scn.gc1], [2, T.gc2Hit, scn.gc2]].forEach(function (g) {
      var n = g[0], hit = g[1], truth = g[2];
      add(hit - CAST.gc, 'cast', 'ネオエクスデス', 'グランドクロス' + n + ' 詠唱', [cast(N, 'ネオエクスデス', 'BB14', 'グランドクロス', CAST.gc)]);
      add(hit - CAST.gc + 1, 'tell', 'ネオエクスデス', 'GC' + n + ' 真偽 = ' + (truth ? '本当' : '嘘'), [tell(TELL_EX[truth])]);
      add(hit, 'hit', 'ネオエクスデス', 'グランドクロス' + n + ' 着弾', [abil(N, 'ネオエクスデス', 'BB14', 'グランドクロス')]);
    });

    // --- GC のデバフ (2 セット) ---
    // 早の枠 = GC1 なら 51s / GC2 なら 36s。遅の枠 = GC1 なら 76s / GC2 なら 61s。
    // 自分の担当は「早に何を持つか」「遅に何を持つか」で決まり、片方は必ず GC1・もう片方は GC2 に置く。
    var g1 = [], g2 = [];
    function put(set, id, name, dur, tgt, tgtName) {
      (set === 1 ? g1 : g2).push(stat(id, name, dur, tgt, tgtName));
    }
    // 自分ぶん: 早は GC1 の 51s、遅は GC2 の 61s に置く (どちらのセットでも成立する形)
    var kindId = { fork: ['15A8', 'フォークライトニング'], water: ['15A9', '水属性圧縮'], bomb: ['15AA', '加速度爆弾'] };
    if (a.short === 'gaze') {
      put(1, '15A7', '呪詛の叫声', DUR.shriek1, S, SN);
    } else {
      put(1, kindId[a.short][0], kindId[a.short][1], DUR.short1, S, SN);
    }
    if (a.long === 'gaze') {
      put(2, '15A7', '呪詛の叫声', DUR.shriek2, S, SN);
    } else {
      put(2, kindId[a.long][0], kindId[a.long][1], DUR.long2, S, SN);
    }
    // 他人ぶん (枠と視線の持ち主を埋める)
    if (a.short !== 'gaze') put(1, '15A7', '呪詛の叫声', DUR.shriek1, M, MN);
    if (a.long !== 'gaze') put(2, '15A7', '呪詛の叫声', DUR.shriek2, M, MN);
    put(1, '15A9', '水属性圧縮', DUR.long1, M, MN);
    put(2, '15AA', '加速度爆弾', DUR.short2, M, MN);

    add(T.gc1Hit + 0.1, 'debuff', 'ネオエクスデス', 'GC1 のデバフ (1セット目)', g1);
    add(T.gc2Hit + 0.1, 'debuff', 'ネオエクスデス', 'GC2 のデバフ (2セット目) → 雷水が確定', g2);

    // --- ほのお / つなみ (詠唱順はランダム。着弾は必ず 炎 → 水) ---
    var first = scn.fireFirst
      ? { id: 'BB20', name: 'ほのお', st: ['15AB', '混沌の炎', DUR.entropy1] }
      : { id: 'BB21', name: 'つなみ', st: ['15AC', '混沌の水', DUR.fluid1] };
    var second = scn.fireFirst
      ? { id: 'BB21', name: 'つなみ', st: ['15AC', '混沌の水', DUR.fluid2] }
      : { id: 'BB20', name: 'ほのお', st: ['15AB', '混沌の炎', DUR.entropy2] };
    // 詠唱順が入れ替わっても切れる時刻はほぼ同じだが、正確に出すため実際の付与から計算する
    var fireExp = scn.fireFirst ? T.chaos1Hit + DUR.entropy1 : T.chaos2Hit + DUR.entropy2;
    var waterExp = scn.fireFirst ? T.chaos2Hit + DUR.fluid2 : T.chaos1Hit + DUR.fluid1;
    [[1, T.chaos1Hit, first, scn.chaos1], [2, T.chaos2Hit, second, scn.chaos2]].forEach(function (c) {
      var n = c[0], hit = c[1], w = c[2], truth = c[3];
      add(hit - CAST.chaos, 'cast', 'カオス', w.name + ' 詠唱 (' + n + '回目)', [cast(C, 'カオス', w.id, w.name, CAST.chaos)]);
      add(hit - CAST.chaos + 1, 'tell', 'カオス', 'カオス' + n + ' 真偽 = ' + (truth ? '本当' : '嘘'), [tell(TELL_CH[truth])]);
      add(hit, 'debuff', 'カオス', w.name + ' 着弾 → ' + w.st[1] + ' 付与', [
        abil(C, 'カオス', w.id, w.name),
        stat(w.st[0], w.st[1], w.st[2], S, SN),
      ]);
    });

    // --- グランドクロス 3 → 傷 + 死の超越/アラガンフィールド ---
    add(T.gc3Hit - CAST.gc, 'cast', 'ネオエクスデス', 'グランドクロス3 詠唱', [cast(N, 'ネオエクスデス', 'BB14', 'グランドクロス', CAST.gc)]);
    add(T.gc3Hit, 'hit', 'ネオエクスデス', 'グランドクロス3 着弾', [abil(N, 'ネオエクスデス', 'BB14', 'グランドクロス')]);
    add(T.gc3Debuff, 'debuff', 'ネオエクスデス', 'GC3 のデバフ → 無の氾濫の色が確定', [
      stat(scn.wound === 'white' ? '15A5' : '15A6', scn.wound === 'white' ? '生者の傷' : '死者の傷', DUR.wound, S, SN),
      stat(scn.dof === 'death' ? '1558' : '1C6', scn.dof === 'death' ? '死の超越' : 'アラガンフィールド', DUR.wound, S, SN),
    ]);

    // --- 無の氾濫 ---
    var fl = FLOOD_IDS.filter(function (x) { return x.id === scn.flood; })[0] || FLOOD_IDS[0];
    add(T.floodHit - CAST.flood, 'cast', 'ネオエクスデス', '無の氾濫 詠唱 (' + fl.label + ')', [cast(N, 'ネオエクスデス', scn.flood, '無の氾濫', CAST.flood)]);
    add(T.floodHit, 'resolve', 'ネオエクスデス', '無の氾濫 着弾 ← ① レーザーに入る', [], true);
    add(T.antilight, 'hit', 'ネオエクスデス', 'アンチライト / デスエッジ', [abil(N, 'ネオエクスデス', 'C394', 'ホワイトアンチライト')]);

    // --- マジックチャージ ---
    // ★実ログでは、チャージの予兆 (頭マーカー) と 5CD/5CC は「単発の詠唱と同じ瞬間」に来る
    //   (チャージの瞬間ではない)。範囲の補助アクターも同じ瞬間に詠唱する (263 に位置)。
    add(T.manaCharge, 'hit', 'ケフカ', 'マジックチャージ', [abil(K, 'ケフカ', 'BAA4', 'マジックチャージ')]);
    var fireTruth = scn.fireFirst ? scn.chaos1 : scn.chaos2;
    var waterTruth = scn.fireFirst ? scn.chaos2 : scn.chaos1;

    // --- 自分が動く瞬間 (デバフ切れ) ---
    // ★ デバフ切れの時刻は cactbot のタイムラインにある実際の技 (デスボルト/デスウェイブ =
    //   雷水、デスシュリーク = 視線) の時刻をそのまま使う。DUR はそこから逆算してある。
    add(T.deathSurge, 'hit', 'ネオエクスデス', 'デスサージ', []);
    add(T.shortRes, 'resolve', '—', '② 早 雷水/加速度 ← デスボルト/デスウェイブ', [], true);
    // ★単発サンダガ (直線)
    add(T.boltRes - CAST.bolt, 'cast', 'ケフカ', 'もりもりサンダガ 詠唱 + 範囲（⑧ 直線 = '
      + (scn.lineTruth ? '本当' : '嘘') + '）', [
      stat('5CD', 'チャージ：サンダガ', 9999, K, 'ケフカ'), head(HEAD_THU[scn.lineTruth]),
      cast(K, 'ケフカ', 'C5DE', 'もりもりサンダガ', CAST.bolt),
    ].concat(lanes(scn.boltGeo, scn.lineTruth, CAST.bolt)));
    add(T.boltRes, 'resolve', 'ケフカ', '⑧ 直線 ← もりもりサンダガ 着弾', [], true);
    add(T.gaze1Res, 'resolve', '—', '③ 視線1 ← デスシュリーク', [], true);
    add(fireExp, 'resolve', 'カオス', '④ 炎 (ボス下に置く) ← 混沌の炎 ' + (fireTruth ? 'タケノコ' : 'ドーナツ'),
      placements(fireTruth ? 'BB22' : 'BB23', scn.firePos), true);
    add(T.upsurge, 'hit', 'ケフカ', 'アルテマアップサージ', [abil(K, 'ケフカ', 'C24A', 'アルテマアップサージ')]);
    add(fireExp + CAST.place, 'hit', 'カオス', '混沌の炎 発動', []);
    add(T.longRes, 'resolve', '—', '⑤ 遅 雷水/加速度 ← デスボルト/デスウェイブ', [], true);
    // ★単発ブリザガ (扇)
    add(T.coneRes - CAST.cone, 'cast', 'ケフカ', 'ひろげるブリザガ 詠唱 + 範囲（⑧ 扇 = '
      + (scn.coneTruth ? '本当' : '嘘') + '）', [
      stat('5CC', 'チャージ：ブリザガ', 9999, K, 'ケフカ'), head(HEAD_ICE[scn.coneTruth]),
      cast(K, 'ケフカ', 'BA95', 'ひろげるブリザガ', CAST.cone),
    ].concat(cones(scn.coneGeo, scn.coneTruth, CAST.cone)));
    add(T.coneRes, 'resolve', 'ケフカ', '⑧ 扇 ← ひろげるブリザガ 着弾', [], true);
    add(T.gaze2Res, 'resolve', '—', '⑥ 視線2 ← デスシュリーク', [], true);

    // --- マジックアウト ---
    // ★実ログではマジックアウトの予兆は詠唱 (BAA5) の 0.1 秒前に来る。
    //   チャージ時の答えとの XNOR で ⑧ の 2 行が上書きされる。
    var outLine = scn.lineTruth === scn.outThunder, outCone = scn.coneTruth === scn.outIce;
    add(T.manaReleaseHit - CAST.manaRelease - 0.1, 'tell', 'ケフカ', 'マジックアウトの予兆 → ⑧ 上書き（直線='
      + (outLine ? '踏まない' : '踏む') + ' / 扇=' + (outCone ? '踏まない' : '踏む') + '）', [
      head(HEAD_ICE[scn.outIce]), head(HEAD_THU[scn.outThunder]),
    ]);
    add(T.manaReleaseHit - CAST.manaRelease, 'cast', 'ケフカ', 'マジックアウト 詠唱', [
      cast(K, 'ケフカ', 'BAA5', 'マジックアウト', CAST.manaRelease),
    ]);
    add(waterExp, 'resolve', 'カオス', '⑦ つなみ (ボス下に置く) ← 混沌の水 ' + (waterTruth ? 'ドーナツ' : 'タケノコ'),
      placements(waterTruth ? 'BB24' : 'BB25', scn.waterPos), true);
    // マジックアウトの範囲は着弾 (108.8) で出る。位置は単発のときとは別にランダム
    add(T.manaReleaseHit, 'hit', 'ケフカ', 'マジックアウト 着弾 → 範囲が出る（⑧ 行き先）',
      lanes(scn.outLineGeo, outLine, CAST.out).concat(cones(scn.outConeGeo, outCone, CAST.out)));
    add(T.straySpray, 'hit', 'カオス', '混沌の水 発動', []);
    add(T.thunder2, 'resolve', 'ケフカ', '⑧ マジックアウト ← サンダガ/ブリザガ 着弾', [], true);

    ev.sort(function (x, y) { return x.t - y.t; });
    return ev;
  };

  // ---- シナリオの内訳 (答え合わせ用) ----
  NS.describe = function (scn) {
    var a = ASSIGN.filter(function (x) { return x.key === scn.assign; })[0] || ASSIGN[0];
    var fl = FLOOD_IDS.filter(function (x) { return x.id === scn.flood; })[0] || FLOOD_IDS[0];
    var tf = function (v) { return v ? '本当' : '嘘'; };
    return [
      ['ロール', scn.role === 'th' ? 'TH (北=頭割り / 西=1人受け)' : 'DPS (南=頭割り / 東=1人受け)'],
      ['自分の担当', a.label],
      ['GC1 の真偽', tf(scn.gc1)],
      ['GC2 の真偽', tf(scn.gc2)],
      ['カオス1 の真偽', tf(scn.chaos1) + '（' + (scn.fireFirst ? 'ほのお' : 'つなみ') + '）'],
      ['カオス2 の真偽', tf(scn.chaos2) + '（' + (scn.fireFirst ? 'つなみ' : 'ほのお') + '）'],
      ['GC3 の傷', scn.wound === 'white' ? '生者の傷（紫）' : '死者の傷（青）'],
      ['GC3 のもう1つ', scn.dof === 'death' ? '死の超越（色そのまま）' : 'アラガンフィールド（逆の色）'],
      ['無の氾濫', fl.label],
      ['単発の予兆', '直線=' + tf(scn.lineTruth) + ' / 扇=' + tf(scn.coneTruth)],
      ['⑧ 直線（サンダガ 77.5s）', scn.lineTruth ? '踏まない' : '踏む'],
      ['⑧ 扇（ブリザガ 95.5s）', scn.coneTruth ? '踏まない' : '踏む'],
      ['マジックアウトの予兆', '直線=' + tf(scn.outThunder) + ' / 扇=' + tf(scn.outIce)],
      ['④ 炎 / ⑦ 水', ((scn.fireFirst ? scn.chaos1 : scn.chaos2) ? 'タケノコ' : 'ドーナツ') + ' / '
        + ((scn.fireFirst ? scn.chaos2 : scn.chaos1) ? 'ドーナツ' : 'タケノコ')],
      ['⑧ マジックアウト（113.9s）', '直線 ' + (scn.lineTruth === scn.outThunder ? '踏まない' : '踏む')
        + ' / 扇 ' + (scn.coneTruth === scn.outIce ? '踏まない' : '踏む')],
      ['なぞなぞの古い予兆', '扇=' + tf(scn.mysteryIce) + ' / 直線=' + tf(scn.mysteryThunder)
        + '（マジックチャージの予兆で上書きされる）'],
    ];
  };
})();

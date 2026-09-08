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
    shortRes: 69.5,                                   // ★早の枠が解決 = デスボルト/デスウェイブ 1 回目
    thunder1: 77.5,
    gaze1Res: 78.5,                                   // ★視線1 = デスシュリーク 1 回目
    fireCast: 85.2,                                   // ★混沌の炎の詠唱開始 (5.0s) = ここで位置が確定
    upsurge: 87.5,
    strayFlames: 90.2,                                // 混沌の炎 着弾
    longRes: 94.4,                                    // ★遅の枠が解決 = デスボルト/デスウェイブ 2 回目
    blizzard1: 95.5,
    gaze2Res: 102.4,                                  // ★視線2 = デスシュリーク 2 回目
    waterCast: 108.0,                                 // ★混沌の水の詠唱開始 (5.0s) = ここで位置が確定
    manaReleaseHit: 108.8,                            // マジックアウト (6.7s 詠唱)
    straySpray: 113.0,                                // 混沌の水 着弾
    thunder2: 113.9,                                  // もりもりサンダガ/ひろげるブリザガ 着弾
    enrage: 118.2,
  };
  var CAST = { gc: 8.7, chaos: 8.7, flood: 5.0, manaRelease: 6.7, phase: 5.0 };

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
      chargedIce: coin(), chargedThunder: coin(),
      liveIce: coin(), liveThunder: coin(),
    };
  };

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
        head(HEAD_ICE[scn.chargedIce]), head(HEAD_THU[scn.chargedThunder]),
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
    add(T.manaCharge, 'hit', 'ケフカ', 'マジックチャージ (予兆を記憶)', [
      abil(K, 'ケフカ', 'BAA4', 'マジックチャージ'),
      stat('5CC', 'ブリザガチャージ', 60, K, 'ケフカ'),
      stat('5CD', 'サンダガチャージ', 60, K, 'ケフカ'),
    ]);

    // --- 自分が動く瞬間 (デバフ切れ) ---
    // ★ デバフ切れの時刻は cactbot のタイムラインにある実際の技 (デスボルト/デスウェイブ =
    //   雷水、デスシュリーク = 視線) の時刻をそのまま使う。DUR はそこから逆算してある。
    add(T.deathSurge, 'hit', 'ネオエクスデス', 'デスサージ', []);
    add(T.shortRes, 'resolve', '—', '② 早 雷水/加速度 ← デスボルト/デスウェイブ', [], true);
    add(T.thunder1, 'hit', 'ケフカ', 'もりもりサンダガ 着弾', [abil(K, 'ケフカ', 'BA9F', 'もりもりサンダガ')]);
    add(T.gaze1Res, 'resolve', '—', '③ 視線1 ← デスシュリーク', [], true);
    add(fireExp, 'resolve', 'カオス', '④ 炎 (位置を取る) ← 混沌の炎 詠唱開始', [], true);
    add(T.upsurge, 'hit', 'ケフカ', 'アルテマアップサージ', [abil(K, 'ケフカ', 'C24A', 'アルテマアップサージ')]);
    add(T.strayFlames, 'hit', 'カオス', '混沌の炎 着弾', [abil(C, 'カオス', 'BB22', '混沌の炎')]);
    add(T.longRes, 'resolve', '—', '⑤ 遅 雷水/加速度 ← デスボルト/デスウェイブ', [], true);
    add(T.blizzard1, 'hit', 'ケフカ', 'ひろげるブリザガ 着弾', [abil(K, 'ケフカ', 'BA98', 'ひろげるブリザガ')]);
    add(T.gaze2Res, 'resolve', '—', '⑥ 視線2 ← デスシュリーク', [], true);

    // --- マジックアウト ---
    add(T.manaReleaseHit - CAST.manaRelease, 'cast', 'ケフカ', 'マジックアウト 詠唱', [
      head(HEAD_ICE[scn.liveIce]), head(HEAD_THU[scn.liveThunder]),
      cast(K, 'ケフカ', 'BAA5', 'マジックアウト', CAST.manaRelease),
    ]);
    add(waterExp, 'resolve', 'カオス', '⑧ つなみ (位置を取る) ← 混沌の水 詠唱開始', [], true);
    add(T.manaReleaseHit, 'hit', 'ケフカ', 'マジックアウト 着弾 → 扇/直線の予兆が出る (⑦ の答えが確定)', []);
    add(T.straySpray, 'hit', 'カオス', '混沌の水 着弾', [abil(C, 'カオス', 'BB24', '混沌の水')]);
    // 予兆が出てから着弾まで 5.1 秒ある。⑦ を処理し終わるのはここ。
    add(T.thunder2, 'resolve', 'ケフカ', '⑦ 扇/直線 着弾 ← サンダガ/ブリザガ', [
      abil(K, 'ケフカ', 'BA9F', 'もりもりサンダガ'), abil(K, 'ケフカ', 'BA98', 'ひろげるブリザガ'),
    ], true);

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
      ['チャージ時の予兆', '扇=' + tf(scn.chargedIce) + ' / 直線=' + tf(scn.chargedThunder)],
      ['出た瞬間の予兆', '扇=' + tf(scn.liveIce) + ' / 直線=' + tf(scn.liveThunder)],
    ];
  };
})();

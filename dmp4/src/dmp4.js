// 絶妖星乱舞(絶ケフカ) P4「ネオエクスデス & カオス」カンペ。
// 「どこに行けばいいか」を小さいアリーナ図 8 枚に分けて、時系列で横 1 行に並べる。
// 高さに合わせて図を並べ、横は溢れたら切れる。終わった図は消えるので残りが左にスライドしてくる。
// 並びは攻略マクロ（早水雷｜視線1｜炎 ┃ 遅水雷｜視線2｜つなみ）と同じ順 + 無の氾濫 / マジックアウト。
//
// ■ 真偽(本当/嘘)の判定
//   ボスに付く隠しステータス 808 の count で確定する:
//     45F=カオス 嘘 / 460=カオス 本当 / 461=ネオエクスデス 嘘 / 462=ネオエクスデス 本当
//   グランドクロス由来のデバフは「その時点の最新のネオエクスデス側 count」、
//   ほのお/つなみ由来は「最新のカオス側 count」を採用する(ボス別に持つので順番に依存しない)。
//
// ■ 早/遅 はデバフ残り時間で決まる
//   呪詛の叫声  60s → 視線1 / 69s → 視線2
//   フォークライトニング・水属性圧縮・加速度爆弾  51s/36s → 早 / 76s/61s → 遅 (しきい値 55s)
//
// ■ 立ち位置の基準
//   早(1セット目)・遅(2セット目) ともに **マップ基準**。TH は 北と西、DPS は 南と東で、
//   南北が 3人頭割り・東西が 1人受け。ネオエクスデス基準と書いている解説もあるが実際はマップ基準。
//   全部マップ基準なのでボスの位置は使わない。図は常に北が上・ウェイマークも実配置のまま描く。
//
// ■ 注意
//   ID は cactbot の絶妖星乱舞データ(ゾーン 553)由来。P4 のネットログはまだ手元に無いので、
//   初回は CONFIG.debug=true で流してコンソールの [dmp4] 行と実際の挙動を突き合わせること。

(function () {
  'use strict';
  var O = window.Overlay = window.Overlay || {};
  console.log('[dmp4] script loaded');

  // ===== 設定 (ここを編集する) =====
  var CONFIG = {
    // 立ち位置。マップ基準で、角度は北からの時計回り deg (北 0 / 東 90 / 南 180 / 西 270)。
    // TH は 北と西、DPS は 南と東。南北が 3人頭割り、東西が 1人受け。早/遅 とも同じ配置。
    // ネオエクスデス基準と書いている解説もあるが、実際はマップ基準。
    positions: {
      stack: { th: 0, dps: 180 },     // 北 / 南 = 3人頭割り
      spread: { th: 270, dps: 90 },   // 西 / 東 = 1人受け
    },

    // フィールドマーカー配置。A〜D は十字。数字 1〜4 は標準から左(反時計)に 90° 回転。
    waymarks: [
      { label: 'A', angle: 0, color: '#ff5b5b' },
      { label: '2', angle: 45, color: '#ffd23d' },
      { label: 'B', angle: 90, color: '#ffd23d' },
      { label: '3', angle: 135, color: '#4fc3ff' },
      { label: 'C', angle: 180, color: '#4fc3ff' },
      { label: '4', angle: 225, color: '#d17bff' },
      { label: 'D', angle: 270, color: '#d17bff' },
      { label: '1', angle: 315, color: '#ff5b5b' },
    ],

    // 混沌の炎/水 が「タケノコ」のとき、円を捨てに行く場所。
    //   'center' = 中央固定 / 'next' = 次の散開集合の方向 / 数値 = 北からの時計回り deg
    baitAt: 'center',

    // 'auto' はパーティ情報のジョブから判定。外れるときだけ 'th' / 'dps' に固定する。
    role: 'auto',

    // 表示文言。使っているマクロの言い回しに合わせて差し替える。
    labels: {
      spread: '散開', stack: '頭割り',
      stop: '止まる', move: '動く',
      lookAway: '見ない', lookAt: '見る',
      bait: 'タケノコ', center: '中央',
      purple: '紫', blue: '青', left: '左', right: '右',
      avoidBoth: '両方踏まない', coneOnly: '扇だけ踏む', lineOnly: '直線だけ踏む', coneAndLine: '両方踏む',
    },

    // 自キャラ判定のフォールバック (戦闘中に起動したとき用)。フルネーム or 空。
    ownNameHint: '',

    // 自分の番の 3 秒前に鳴らす
    sound: true,
    soundFile: '',
    soundVolume: 0.7,

    showStatus: false,  // 左下に自キャラ検出状況
    debug: false,       // 上部に診断バナー + 未知 ID をコンソールへ
    demo: false,        // ゲームログ無しで表示確認
  };

  // ===== ID (cactbot dancing_mad 由来) =====
  var AB = {
    PHASE: 'C2DC',                              // おちょくりソウル = P4 開始
    GRAND_CROSS: 'BB14',                        // グランドクロス (ネオエクスデス)
    INFERNO: 'BB20', TSUNAMI: 'BB21',           // ほのお / つなみ
    FLOOD: ['C392', 'C393', 'C3A1', 'C3A2'],    // 無の氾濫 (C392/C393=本当, C3A2/C393=青が左)
    ANTILIGHT: ['C394', 'C395'],                // 白/黒アンチライト → 早デバフ解決の合図
    UPSURGE: 'C24A',                            // アルテマアップサージ → 遅デバフ解決の合図
    MANA_CHARGE: 'BAA4',                        // マジックチャージ
    MANA_RELEASE: 'BAA5',                       // マジックアウト
    ENRAGE: 'BABB',                             // 裁きの光 (時間切れ)
  };
  var ST = {
    TELL: '808',                                // 真偽フラグ (count で判定)
    SHRIEK: '15A7',                             // 呪詛の叫声 (視線)
    FORK: '15A8',                               // フォークライトニング
    WATER: '15A9',                              // 水属性圧縮
    BOMB: '15AA',                               // 加速度爆弾
    ENTROPY: '15AB',                            // 混沌の炎
    FLUID: '15AC',                              // 混沌の水
    CHARGE_ICE: '5CC', CHARGE_THUNDER: '5CD',   // ブリザガ/サンダガ チャージ
  };
  var WOUND_WHITE = { '15A5': 1, '1317': 1 };   // 生者の傷 (紫)
  var WOUND_BLACK = { '15A6': 1, '1318': 1 };   // 死者の傷 (青)
  var DEATH = { '1558': 1, '566': 1 };          // 死の超越
  var FIELD = { '1C6': 1 };                     // アラガンフィールド

  var TELL = {
    '45F': { boss: 'chaos', truth: false },
    '460': { boss: 'chaos', truth: true },
    '461': { boss: 'exdeath', truth: false },
    '462': { boss: 'exdeath', truth: true },
  };
  var HEAD = {
    '02A1': ['fire', false], '02A2': ['fire', true],
    '02A3': ['ice', false], '02A4': ['ice', true],
    '02A5': ['thunder', false], '02A6': ['thunder', true],
  };
  // ジョブ ID (10進)。ここに無いものは全部 DPS 扱い。
  var TANK_JOBS = { 1: 1, 3: 1, 19: 1, 21: 1, 32: 1, 37: 1 };          // GLA MRD PLD WAR DRK GNB
  var HEAL_JOBS = { 6: 1, 24: 1, 28: 1, 33: 1, 40: 1 };                // CNJ WHM SCH AST SGE

  var WINDOW_SPLIT = 55;     // 早(51/36) と 遅(76/61) の境目(秒)
  var SHRIEK_SPLIT = 65;     // 視線1(60) と 視線2(69) の境目(秒)
  var RESET_AFTER_SEC = 120;
  var PANEL_AR = 0.76;       // 図 1 枚の 幅/高さ (styles.css の aspect-ratio と揃える)

  // 表示順 = 解決される順。終わったものは消えて左に詰まる。
  var PANELS = [
    { key: 'laser', name: '① 無の氾濫' },
    { key: 'short', name: '② 早 雷水' },
    { key: 'gaze1', name: '③ 視線1' },
    { key: 'fire', name: '④ 炎' },
    { key: 'long', name: '⑤ 遅 雷水' },
    { key: 'gaze2', name: '⑥ 視線2' },
    { key: 'mana', name: '⑦ マジックアウト' },
    { key: 'water', name: '⑧ つなみ' },
  ];

  // ===== 状態 =====
  var els = {};
  var ownId = null, ownName = null, ownRole = null;
  var partyCache = [];   // PartyChanged の生リスト (自キャラ ID が後から来る場合に備えて持つ)
  var jobById = {};      // 03 行から拾ったジョブ (id → 10進)。PartyChanged が来ない場合の保険
  var state = null;
  var diag = { logLines: 0, booted: false, unknown: {} };

  function freshState() {
    return {
      active: false,
      startAt: 0,
      lastEventAt: 0,
      gcCount: 0,
      tell: { exdeath: null, chaos: null },
      steps: {
        laser: null,   // { at, color, dir, id }
        short: null,   // { at, kind, truth, bomb, mine }
        gaze1: null,   // { at, truth, players[], mine }
        fire: null,    // { at, truth }
        long: null,
        gaze2: null,
        mana: null,    // { at, ice, thunder }
        water: null,   // { at, truth }
      },
      done: {},
      wound: null,     // 'white' | 'black'
      dof: null,       // 'death' | 'field'
      liveTruth: { fire: null, ice: null, thunder: null },
      charged: { ice: null, thunder: null },
      alerted: {},
    };
  }

  function init() {
    els.root = document.getElementById('dm');
    els.nowMain = document.getElementById('dm-now-main');
    els.nowSub = document.getElementById('dm-now-sub');
    els.grid = document.getElementById('dm-grid');
    els.status = document.getElementById('dm-status');
    els.debug = document.getElementById('dm-debug');

    if (CONFIG.debug && els.debug) { els.debug.style.display = 'block'; document.body.classList.add('debug'); }

    state = freshState();
    buildPanels();

    if (!O.api) { console.error('[dmp4] Overlay.api missing'); return; }
    O.api.on('ChangePrimaryPlayer', onPrimaryPlayer);
    O.api.on('PartyChanged', onPartyChanged);
    O.api.on('LogLine', onLogLine);
    O.api.ready().then(function () { diag.booted = true; });

    if (CONFIG.demo) startDemo();
    renderStatus();
    requestAnimationFrame(loop);
  }

  // ===== 共通 =====
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function normId(s) { return String(s == null ? '' : s).toUpperCase().replace(/^0+(?=.)/, ''); }
  function mod360(a) { return ((a % 360) + 360) % 360; }
  function L(k) { return CONFIG.labels[k] || k; }

  function setOwn(id, name) {
    var nid = normId(id);
    if (nid && nid !== ownId) ownId = nid;
    if (name) ownName = name;
    resolveRole();        // ID が後から分かることもあるので、そのたびに引き直す
    renderStatus();
  }
  function onPrimaryPlayer(e) {
    if (e.charID != null) setOwn(Number(e.charID).toString(16), e.charName);
    else if (e.charName) setOwn(ownId, e.charName);
  }
  function onPartyChanged(e) {
    partyCache = (e && e.party) || [];
    resolveRole();
  }
  function roleOfJob(job) {
    if (!job) return null;
    return (TANK_JOBS[job] || HEAL_JOBS[job]) ? 'th' : 'dps';
  }
  // 自分のジョブ → TH / DPS。PartyChanged と 03 行の両方から引くので、
  // どちらが先に来ても・PartyChanged が来なくても決まる。
  function resolveRole() {
    if (ownId == null) return;
    var job = null;
    for (var i = 0; i < partyCache.length; i++) {
      var m = partyCache[i] || {};
      var id = normId(typeof m.id === 'number' ? m.id.toString(16) : m.id);
      if (id === ownId) { job = Number(m.job); break; }
    }
    var src = 'PartyChanged';
    if (!job) { job = jobById[ownId]; src = '03'; }
    var r = roleOfJob(job);
    if (r && r !== ownRole) {
      ownRole = r;
      if (CONFIG.debug) console.log('[dmp4] ロール判定 job', job, '→', r, '(' + src + ')');
      renderStatus();
    }
  }
  function myRole() { return CONFIG.role === 'th' || CONFIG.role === 'dps' ? CONFIG.role : ownRole; }

  function onLogLine(e) {
    var p = e.line || [];
    diag.logLines++;
    if (ownId == null) tryBootstrap(p);
    switch (p[0]) {
      case '02': setOwn(p[2], p[3]); break;
      case '03': onAddCombatant(p); break;
      case '01': jobById = {}; reset('ゾーン移動'); break;
      case '260': if (p[2] === '0') reset('戦闘終了'); break;
      case '20': onCast(p); break;
      case '21': case '22': onAbility(p); break;
      case '26': onStatusGain(p); break;
      case '27': onHeadMarker(p); break;
    }
  }

  // 03|t|id|name|job(16進)|level|... — プレイヤーのジョブを拾う。
  // 実ログで確認済み: 1C=SCH / 13=PLD / 20=DRK / 18=WHM / 16=DRG …
  function onAddCombatant(p) {
    var id = normId(p[2]);
    if (!/^10[0-9A-F]{0,6}$/.test(id)) return;      // プレイヤーだけ
    var job = parseInt(p[4], 16);
    if (!job) return;
    jobById[id] = job;
    if (id === ownId) resolveRole();
  }

  function tryBootstrap(p) {
    var hint = CONFIG.ownNameHint;
    if (!hint) return;
    for (var i = 1; i < p.length; i++) {
      if (p[i] === hint && /^10[0-9A-F]{6}$/i.test(p[i - 1] || '')) { setOwn(p[i - 1], p[i]); return; }
    }
  }

  function reset(why) {
    if (!state.active && state.gcCount === 0) return;
    state = freshState();
    console.log('[dmp4] リセット:', why);
  }
  function touch() { state.lastEventAt = now(); }
  function begin() {
    state = freshState();
    state.active = true;
    state.startAt = now();
    touch();
    console.log('[dmp4] P4 開始');
  }

  // ===== 詠唱開始 (type 20) =====
  function onCast(p) {
    var id = (p[4] || '').toUpperCase();
    var castMs = (parseFloat(p[8]) || 0) * 1000;

    if (id === AB.PHASE) { begin(); return; }
    if (!state.active) return;
    touch();

    if (id === AB.GRAND_CROSS) { state.gcCount++; return; }
    if (onProgress(id)) return;

    if (AB.FLOOD.indexOf(id) >= 0) {
      var lz = computeLaser(id);
      state.steps.laser = { at: now() + castMs, total: castMs, color: lz && lz.color, dir: lz && lz.dir, id: id };
      return;
    }
    if (id === AB.MANA_RELEASE) {
      // 詠唱明け(+0.3s)の予兆で確定するので、その時刻に評価する
      state.steps.mana = { at: now() + castMs + 300, total: castMs + 300, ice: null, thunder: null };
      return;
    }
    if (CONFIG.debug && (id === AB.INFERNO || id === AB.TSUNAMI || id === AB.MANA_CHARGE)) {
      console.log('[dmp4] cast', id, p[5]);
    }
  }

  // ===== 実行 (type 21/22) =====
  function onAbility(p) {
    var id = (p[4] || '').toUpperCase();
    if (id === AB.PHASE) { if (!state.active) begin(); return; }
    if (!state.active) return;
    onProgress(id);
  }

  // 進行の節目。詠唱(20)でも実行(21/22)でも来るので両方から呼ぶ。
  function onProgress(id) {
    if (AB.ANTILIGHT.indexOf(id) >= 0) { state.done.laser = true; touch(); return true; }
    if (id === AB.UPSURGE) { state.done.short = true; state.done.gaze1 = true; touch(); return true; }
    if (id === AB.ENRAGE) { touch(); return true; }
    return false;
  }

  // ===== ステータス付与 (type 26) =====
  // 26|t|statusId|name|duration|srcId|srcName|tgtId|tgtName|count|...
  function onStatusGain(p) {
    var id = (p[2] || '').toUpperCase();
    var dur = parseFloat(p[4]) || 0;
    var tgtId = normId(p[7]);
    var tgtName = p[8] || '';
    var count = (p[9] || '').toUpperCase();

    if (id === ST.TELL) {
      var t = TELL[count];
      if (!t) return;
      if (!state.active) begin();     // 保険: P4 開始を取りこぼしても真偽で拾う
      state.tell[t.boss] = t.truth;
      touch();
      if (CONFIG.debug) console.log('[dmp4] 真偽', t.boss, t.truth ? '本当' : '嘘', '(count ' + count + ')');
      return;
    }
    if (!state.active) return;

    var mine = (ownId != null && tgtId === ownId);
    var at = now() + dur * 1000;
    var s = state.steps;

    if (id === ST.SHRIEK) {
      var gk = dur < SHRIEK_SPLIT ? 'gaze1' : 'gaze2';
      var g = s[gk] || (s[gk] = { at: at, total: dur * 1000, truth: state.tell.exdeath, players: [], mine: false });
      g.at = at; g.total = dur * 1000;
      if (g.truth == null) g.truth = state.tell.exdeath;
      if (tgtName && g.players.indexOf(tgtName) < 0) g.players.push(tgtName);
      if (mine) g.mine = true;
      touch();
      return;
    }
    if (id === ST.FORK || id === ST.WATER || id === ST.BOMB) {
      var wk = dur >= WINDOW_SPLIT ? 'long' : 'short';
      var w = s[wk] || (s[wk] = { at: at, total: dur * 1000, kind: null, truth: null, bomb: null, mine: false });
      w.at = at; w.total = dur * 1000;
      if (mine) {
        w.mine = true;
        if (id === ST.BOMB) w.bomb = state.tell.exdeath;
        else { w.kind = (id === ST.FORK) ? 'fork' : 'water'; w.truth = state.tell.exdeath; }
      }
      touch();
      return;
    }
    if (id === ST.ENTROPY) {   // 混沌の炎
      if (!s.fire || mine) s.fire = { at: at, total: dur * 1000, truth: state.tell.chaos };
      touch(); return;
    }
    if (id === ST.FLUID) {     // 混沌の水
      if (!s.water || mine) s.water = { at: at, total: dur * 1000, truth: state.tell.chaos };
      touch(); return;
    }
    if (id === ST.CHARGE_ICE || id === ST.CHARGE_THUNDER) {
      // 頭マーカーが同時に飛んでくるので少し待ってからスナップする
      var key = (id === ST.CHARGE_ICE) ? 'ice' : 'thunder';
      setTimeout(function () {
        if (!state.active) return;
        state.charged[key] = state.liveTruth[key];
        if (CONFIG.debug) console.log('[dmp4] チャージ', key, state.charged[key]);
      }, 250);
      touch(); return;
    }
    if (mine) {
      if (WOUND_WHITE[id]) { state.wound = 'white'; touch(); return; }
      if (WOUND_BLACK[id]) { state.wound = 'black'; touch(); return; }
      if (DEATH[id]) { state.dof = 'death'; touch(); return; }
      if (FIELD[id]) { state.dof = 'field'; touch(); return; }
    }
    if (CONFIG.debug && !diag.unknown[id] && /^1[0-9A-F]{2,3}$/.test(id)) {
      diag.unknown[id] = p[3];
      // 対象は「自分/他人」だけ出す (コンソールを貼り付けたときにキャラ名が漏れないように)
      console.log('[dmp4] 未知ステータス', id, p[3], dur + 's', '→', mine ? '自分' : '他人');
    }
  }

  // ===== 頭マーカー (type 27) =====
  function onHeadMarker(p) {
    var icon = (p[6] || '').toUpperCase();
    var h = HEAD[icon];
    if (!h) return;
    state.liveTruth[h[0]] = h[1];
    if (CONFIG.debug) console.log('[dmp4] なぞなぞ', h[0], h[1] ? '本当' : '嘘');
  }

  // ===== 判定ロジック =====
  // 無の氾濫: 立つべきレーザーの色と左右。
  //   C392/C393 = 本当、C3A2/C393 = 青が自分から見て左。
  //   死の超越 は「氾濫が本当なら色そのまま」、アラガンフィールド は「本当なら色が入れ替わる」。
  function computeLaser(abilId) {
    if (!state.wound || !state.dof) return null;
    var floodTrue = (abilId === 'C392' || abilId === 'C393');
    var blueLeft = (abilId === 'C3A2' || abilId === 'C393');
    var keep = (state.dof === 'death' && floodTrue) || (state.dof === 'field' && !floodTrue);
    var color = keep ? state.wound : (state.wound === 'white' ? 'black' : 'white');
    var dir = (color === 'black')
      ? (blueLeft ? 'left' : 'right')
      : (blueLeft ? 'right' : 'left');
    return { color: color, dir: dir };
  }

  // マジックアウト: チャージ時の予兆の真偽と、出た瞬間の予兆の真偽が一致なら「その予兆は本当」。
  function computeManaOut() {
    var c = state.charged, l = state.liveTruth;
    if (c.ice == null || c.thunder == null || l.ice == null || l.thunder == null) return null;
    return { ice: (c.ice === l.ice), thunder: (c.thunder === l.thunder) };
  }

  // 雷水の枠 → 'spread'(1人受け) / 'stack'(3人頭割り)
  function windowAction(w) {
    if (!w) return null;
    if (w.kind === 'fork') return w.truth == null ? null : (w.truth ? 'spread' : 'stack');
    if (w.kind === 'water') return w.truth == null ? null : (w.truth ? 'stack' : 'spread');
    return 'stack';                       // 雷も水も無ければ頭割り側
  }

  // ===== 文言 =====
  // short = 図の下の一言 (1 語だけ)。長い版は上の「今やること」で使う。
  function windowText(w, short) {
    if (!w) return null;
    var act = windowAction(w);
    var base = act === 'spread' ? L('spread') : act === 'stack' ? L('stack') : '?';
    // 止まる/動く は図の隅に出しているので、一言には足さない (2 行になって字が小さくなる)
    if (!short && w.bomb != null) base += ' / ' + (w.bomb ? L('stop') : L('move'));
    return base;
  }
  function gazeText(g, short) {
    if (!g) return null;
    if (g.truth == null) return '?';
    var t = g.truth ? L('lookAway') : L('lookAt');
    // 自分持ちなら図で中央が主役になっているので、一言は動作だけにする
    if (g.mine) return short ? t : '中央 → ' + t;
    if (!short && g.players.length) t += '（' + g.players.map(shortName).join('・') + '）';
    return t;
  }
  function shortName(n) { return (n || '').split(' ')[0]; }

  // 混沌の炎: 本当=自分中心の円 → 捨てに行く / 嘘=ドーナツ → 中央
  // 混沌の水: 本当=ドーナツ → 中央     / 嘘=円     → 捨てに行く
  function chaosBait(f, isFire) {
    if (!f || f.truth == null) return null;
    return isFire ? f.truth : !f.truth;
  }
  function chaosText(f, isFire) {
    if (!f) return null;
    var b = chaosBait(f, isFire);
    return b == null ? '?' : (b ? L('bait') : L('center'));
  }
  function laserText(z) {
    if (!z) return null;
    if (!z.color) return '?';
    return (z.color === 'white' ? L('purple') : L('blue')) + ' ' + (z.dir === 'left' ? L('left') : L('right'));
  }
  function manaText(m) {
    if (!m) return null;
    if (m.ice == null) return '?';
    if (m.ice && m.thunder) return L('avoidBoth');
    if (!m.ice && m.thunder) return L('coneOnly');
    if (m.ice && !m.thunder) return L('lineOnly');
    return L('coneAndLine');
  }

  function stepValue(key, short) {
    var s = state.steps;
    switch (key) {
      case 'laser': return laserText(s.laser);
      case 'short': return windowText(s.short, short);
      case 'long': return windowText(s.long, short);
      case 'gaze1': return gazeText(s.gaze1, short);
      case 'gaze2': return gazeText(s.gaze2, short);
      case 'fire': return chaosText(s.fire, true);
      case 'water': return chaosText(s.water, false);
      case 'mana': return manaText(s.mana);
    }
    return null;
  }
  function stepAt(key) { var v = state.steps[key]; return v ? v.at : null; }
  function stepIsMine(key) {
    var s = state.steps;
    if (key === 'short' || key === 'long' || key === 'gaze1' || key === 'gaze2') return !!(s[key] && s[key].mine);
    if (key === 'laser') return !!(s.laser && s.laser.color);
    return false;
  }

  // ===== 図に渡すシーン =====
  function windowScene(key) {
    var w = state.steps[key];
    var P = CONFIG.positions;
    function absAll(a) { return [].concat(a == null ? [] : a).map(mod360); }

    var sc = {
      kind: 'window',
      stack: { th: mod360(P.stack.th), dps: mod360(P.stack.dps) },
      spread: { th: absAll(P.spread.th), dps: absAll(P.spread.dps) },
      action: null, bomb: w ? w.bomb : null, myAngles: [], known: false,
    };
    var act = windowAction(w);
    if (!act) return sc;
    sc.action = act;
    sc.known = true;
    var role = myRole();
    if (role) sc.myAngles = act === 'stack' ? [sc.stack[role]] : sc.spread[role];
    return sc;
  }
  // タケノコの捨て場所。既定は中央固定。
  function baitTarget() {
    var b = CONFIG.baitAt;
    if (b === 'center' || b == null) return { atCenter: true, angle: null };
    if (b === 'next') {
      var sc = windowScene('long');
      return { atCenter: false, angle: (sc.myAngles && sc.myAngles.length) ? sc.myAngles[0] : null };
    }
    return { atCenter: false, angle: mod360(Number(b) || 0) };
  }

  function scene(key) {
    var s = state.steps;
    switch (key) {
      case 'laser': {
        var z = s.laser;
        return {
          kind: 'laser',
          blueLeft: z ? (z.id === 'C3A2' || z.id === 'C393') : false,
          color: z && z.color, dir: z && z.dir, known: !!(z && z.color),
        };
      }
      case 'short': case 'long': return windowScene(key);
      case 'gaze1': case 'gaze2': {
        var g = s[key];
        return { kind: 'gaze', truth: g && g.truth, mine: !!(g && g.mine), known: !!(g && g.truth != null) };
      }
      case 'fire': case 'water': {
        var b = chaosBait(s[key], key === 'fire');
        var bt = baitTarget();
        return { kind: 'chaos', bait: b, known: b != null, atCenter: bt.atCenter, myAngle: bt.angle };
      }
      case 'mana': {
        var m = s.mana;
        var c = state.charged;
        return {
          // 位置ではなく真偽そのものが答えなので、図ではなくテキストで出す
          kind: 'truth', ice: m && m.ice, thunder: m && m.thunder,
          known: !!(m && m.ice != null),
          // マジックチャージで溜まった予兆の真偽。答えは出た瞬間まで確定しないので仮表示に使う。
          charged: (c.ice != null && c.thunder != null) ? { ice: c.ice, thunder: c.thunder } : null,
        };
      }
    }
    return null;
  }
  function sceneSig(sc) {
    if (!sc) return '-';
    return [sc.kind, sc.known, sc.action, sc.bomb, sc.truth, sc.mine, sc.bait, sc.color, sc.dir,
      sc.blueLeft, sc.ice, sc.thunder, sc.atCenter, sc.charged ? (sc.charged.ice + '/' + sc.charged.thunder) : '',
      (sc.myAngles || []).map(Math.round).join(','), sc.myAngle == null ? '' : Math.round(sc.myAngle)].join('|');
  }

  function isLive() { return state.active && (now() - state.lastEventAt) < RESET_AFTER_SEC * 1000; }

  // ===== 描画 =====
  function buildPanels() {
    if (!els.grid) return;
    els.grid.innerHTML = '';
    els.panels = {};
    PANELS.forEach(function (P) {
      // 見出しと一言は canvas に焼く (パネル幅を高さだけで決めたいので DOM に文字を持たせない)。
      // 残り秒だけは 0.1 秒ごとに変わるので DOM で重ねる。
      var root = document.createElement('div'); root.className = 'dm-panel';
      var cv = document.createElement('canvas'); cv.className = 'p-canvas';
      cv.width = 200; cv.height = Math.round(200 / PANEL_AR);
      var time = document.createElement('div'); time.className = 'p-time';
      // 解決までの進み具合 = このパネルが消えて左に詰まるまでの残り
      var bar = document.createElement('div'); bar.className = 'p-bar';
      var fill = document.createElement('div'); fill.className = 'p-bar-fill';
      bar.appendChild(fill);
      root.appendChild(cv); root.appendChild(time); root.appendChild(bar);
      els.grid.appendChild(root);
      els.panels[P.key] = {
        root: root, canvas: cv, time: time, fill: fill, name: P.name,
        ctx: (typeof cv.getContext === 'function') ? cv.getContext('2d') : null,
        sig: null,
      };
    });
  }

  // 高さに合わせてパネル幅とバッキングストアを決める。横は溢れたら切れる (詰まればスライドしてくる)。
  var lastGridH = 0;
  function syncSize() {
    if (!els.grid) return;
    var h = els.grid.clientHeight || 0;
    if (!h || h === lastGridH) return;
    lastGridH = h;
    var w = Math.round(h * PANEL_AR);
    var bw = Math.max(160, Math.min(360, w));
    var bh = Math.round(bw / PANEL_AR);
    PANELS.forEach(function (P) {
      var pan = els.panels && els.panels[P.key];
      if (!pan) return;
      pan.root.style.width = w + 'px';
      if (pan.canvas.width !== bw) { pan.canvas.width = bw; pan.canvas.height = bh; }
      pan.sig = null;   // canvas をリサイズすると内容が消えるので描き直す
    });
  }

  function loop() { render(); requestAnimationFrame(loop); }

  function render() {
    var t = now();
    syncSize();

    // マジックアウトは詠唱明けの瞬間に確定させる
    var m = state.steps.mana;
    if (m && m.ice == null && t >= m.at) {
      var r = computeManaOut();
      if (r) { m.ice = r.ice; m.thunder = r.thunder; }
    }

    var live = isLive();
    var cur = null;

    PANELS.forEach(function (P) {
      var pan = els.panels && els.panels[P.key];
      if (!pan) return;
      var val = stepValue(P.key);
      var shortVal = stepValue(P.key, true);
      var mine = stepIsMine(P.key);
      var at = stepAt(P.key);
      var left = at != null ? (at - t) / 1000 : null;
      var done = !!state.done[P.key] || (left != null && left < -3);

      pan.time.textContent = (left != null && left > -3 && !done) ? left.toFixed(1) : '';

      // プログレスバー: 100% になった時点でこのパネルが消えて左に詰まる
      var step = state.steps[P.key];
      var total = (step && step.total) ? step.total / 1000 : null;
      var prog = (left != null && total) ? (1 - left / total) : 0;
      pan.fill.style.width = Math.round(Math.max(0, Math.min(1, prog)) * 100) + '%';

      var cls = 'dm-panel';
      if (val != null) cls += ' has';
      if (mine) cls += ' mine';
      if (done) cls += ' done';
      else if (left != null && !cur) { cur = { val: val, left: left, name: P.name }; cls += ' cur'; }
      if (left != null && left <= 5 && left > -1 && !done) cls += ' soon';
      pan.root.className = cls;

      // 図はシーンが変わったときだけ描き直す (canvas 8 枚を毎フレームは重い)
      var sc = scene(P.key);
      var sig = sceneSig(sc) + '|' + shortVal + '|' + mine;
      if (pan.ctx && sig !== pan.sig) {
        pan.sig = sig;
        O.dmp4draw.paint(pan.ctx, pan.canvas.width, pan.canvas.height, CONFIG.waymarks, sc,
          { title: pan.name, value: shortVal == null ? '—' : shortVal, mine: mine });
      }

      if (CONFIG.sound && !state.alerted[P.key] && mine && left != null && left <= 3 && left > 0) {
        state.alerted[P.key] = true;
        playAlert();
      }
    });

    if (!els.nowMain) return;
    if (!live) {
      els.nowMain.textContent = 'P4 待機';
      els.nowMain.className = 'idle';
      els.nowSub.textContent = '';
    } else if (cur && cur.val != null) {
      els.nowMain.textContent = cur.name + '：' + cur.val;
      els.nowMain.className = 'go';
      els.nowSub.textContent = (cur.left > 0 ? cur.left.toFixed(1) : '0.0');
    } else {
      els.nowMain.textContent = 'デバフ確認中…';
      els.nowMain.className = 'wait';
      els.nowSub.textContent = 'グランドクロス ' + Math.min(state.gcCount, 3) + '/3';
    }
    renderDebug();
  }

  // ===== 通知音 (ultimablaster と同じ) =====
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
    if (ownId) { els.status.className = 'ok'; els.status.textContent = '● ' + (ownName || ownId) + (myRole() ? ' / ' + myRole().toUpperCase() : ''); }
    else { els.status.className = 'warn'; els.status.textContent = '⚠ 自キャラ未検出'; }
  }
  function renderDebug() {
    if (!CONFIG.debug || !els.debug) return;
    els.debug.textContent = 'log:' + diag.logLines + ' own:' + (ownId || '?') + '/' + (myRole() || '?') +
      ' p4:' + state.active + ' GC:' + state.gcCount +
      ' tell(E/C):' + tf(state.tell.exdeath) + '/' + tf(state.tell.chaos) +
      ' wound:' + (state.wound || '-') + ' dof:' + (state.dof || '-') +
      ' charge(i/t):' + tf(state.charged.ice) + '/' + tf(state.charged.thunder) +
      ' live(i/t):' + tf(state.liveTruth.ice) + '/' + tf(state.liveTruth.thunder);
  }
  function tf(v) { return v == null ? '-' : (v ? 'T' : 'F'); }

  // ===== デモ =====
  function startDemo() {
    setTimeout(function () {
      if (!ownId) setOwn('10AAAAAA', '(DEMO)');
      if (!ownRole) ownRole = 'dps';
      begin();
      state.gcCount = 3;
      state.tell.exdeath = true; state.tell.chaos = false;
      state.wound = 'white'; state.dof = 'death';
      var t = now();
      state.steps.laser = { at: t + 8000, total: 8000, color: 'white', dir: 'left', id: 'C393' };
      state.steps.short = { at: t + 16000, total: 16000, kind: 'fork', truth: true, bomb: null, mine: true };
      state.steps.gaze1 = { at: t + 25000, total: 25000, truth: true, players: ['Demo A', 'Demo B'], mine: false };
      state.steps.fire = { at: t + 36000, total: 36000, truth: true };
      state.steps.long = { at: t + 41000, total: 41000, kind: null, truth: null, bomb: false, mine: true };
      state.steps.gaze2 = { at: t + 49000, total: 49000, truth: false, players: ['Demo C'], mine: true };
      state.steps.mana = { at: t + 55000, total: 55000, ice: false, thunder: true };
      state.steps.water = { at: t + 60000, total: 60000, truth: false };
      var iv = setInterval(function () { if (state && state.active) touch(); else clearInterval(iv); }, 5000);
    }, 400);
  }

  O.dmp4 = {
    init: init,
    _config: CONFIG,
    _state: function () { return state; },
    _diag: diag,
    _computeLaser: computeLaser,
    _computeManaOut: computeManaOut,
    _stepValue: stepValue,
    _scene: scene,
    _setRole: function (r) { ownRole = r; },
    _role: function () { return myRole(); },
  };
})();

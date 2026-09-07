// dmp4.js のロジック検証用スタブハーネス (Node 実行)。
// ブラウザ依存 (window/document/performance/rAF/Web Audio) を最小スタブし、
// ACT ネットログと同形式の行を流して
//   ・P4 開始検出 (おちょくりソウル C2DC)
//   ・真偽フラグ 808 の count → ネオエクスデス/カオス 別の 本当/嘘
//   ・グランドクロスのデバフ → 早/遅 の振り分けと 散開/頭割り/止まる/動く
//   ・呪詛の叫声の残り時間 → 視線1 / 視線2
//   ・混沌の炎 / 混沌の水 → タケノコ / 中央
//   ・GC3 の 傷 + 死の超越/アラガンフィールド → 無の氾濫のレーザー色と左右 (全16通り)
//   ・マジックチャージ → マジックアウトの 扇/直線 判定
//   ・戦闘終了リセット
// を検証する。ID は cactbot の絶妖星乱舞データ由来。
'use strict';
const path = require('path');

const SELF = '10AA0001';
const OTHER = '10AA0002';
const BOSS = '4000BEEF';

let NOW = 0;
const rafQueue = [];
function fakeCtx() {
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'measureText') return (s) => ({ width: String(s).length * 12 });
      return function () {};
    },
    set() { return true; },
  });
}
function fakeEl() {
  return { textContent: '', className: '', style: {}, innerHTML: '', width: 200, height: 200,
    appendChild() {}, getContext: fakeCtx, classList: { add() {}, remove() {} } };
}
const elements = {};
function getEl(id) { return elements[id] || (elements[id] = fakeEl()); }

global.window = global;
global.performance = { now: () => NOW };
global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
global.document = { getElementById: getEl, createElement: () => fakeEl(), body: { classList: { add() {}, remove() {} } } };
global.AudioContext = function () {
  return { state: 'running', currentTime: 0, resume() {},
    createOscillator() { return { type: '', frequency: {}, connect() {}, start() {}, stop() {} }; },
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } };
};
const handlers = {};
global.window.Overlay = { api: { on: (t, cb) => { (handlers[t] = handlers[t] || []).push(cb); }, start: () => Promise.resolve(), ready: () => Promise.resolve(), mode: () => 'legacy' } };

require(path.join(__dirname, '..', 'src', 'draw.js'));
require(path.join(__dirname, '..', 'src', 'dmp4.js'));
const O = global.window.Overlay;
O.dmp4._config.sound = false;
O.dmp4.init();
O.dmp4._setRole('dps');

function tick() { const cbs = rafQueue.splice(0, rafQueue.length); cbs.forEach((cb) => cb()); }
function advance(ms) { NOW += ms; tick(); }
function emit(line) { (handlers['LogLine'] || []).forEach((cb) => cb({ type: 'LogLine', line: line.split('|') })); }
function setOwn(id) { (handlers['ChangePrimaryPlayer'] || []).forEach((cb) => cb({ type: 'ChangePrimaryPlayer', charID: parseInt(id, 16), charName: 'Self' })); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 実ログ形式の行ビルダー ----
// 20|t|srcId|srcName|abilId|abilName|tgtId|tgtName|castTime|...
const cast = (src, name, id, abil, ct) => `20|t|${src}|${name}|${id}|${abil}|${src}|${name}|${ct}|`;
// 21|t|srcId|srcName|abilId|abilName|tgtId|tgtName|...
const abil = (src, name, id, a) => `21|t|${src}|${name}|${id}|${a}|${src}|${name}|0|0|`;
// 26|t|statusId|name|duration|srcId|srcName|tgtId|tgtName|count|...
const pname = (id) => (id === SELF ? 'You Player' : id === OTHER ? 'Mate Player' : 'NPC Actor');
const stat = (id, name, dur, tgt, count) => `26|t|${id}|${name}|${dur.toFixed(2)}|${BOSS}|ネオエクスデス|${tgt}|${pname(tgt)}|${count || '00'}|0|0|`;
const tell = (count) => `26|t|808|-|9999.00|${BOSS}|Boss|${BOSS}|Boss|${count}|0|0|`;
const head = (icon) => `27|t|${BOSS}|ケフカ|0000|0000|${icon}|${BOSS}|0000|0000`;

let pass = 0, fail = 0;
function check(name, cond, extra) { cond ? (pass++, console.log('  PASS', name)) : (fail++, console.log('  FAIL', name, extra != null ? '→ ' + extra : '')); }
const st = () => O.dmp4._state();
const val = (k, short) => O.dmp4._stepValue(k, short);
const scn = (k) => O.dmp4._scene(k);
const pos = (k) => (scn(k).myAngles || []).map(Math.round).join(',');

async function main() {
setOwn(SELF);

console.log('1) おちょくりソウル(C2DC) で P4 開始');
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
check('active', st().active === true);
check('GC カウント 0', st().gcCount === 0, st().gcCount);

console.log('2) 真偽フラグ 808 は count でボス別に確定する');
emit(tell('462'));   // ネオエクスデス 本当
check('exdeath = 本当', st().tell.exdeath === true, st().tell.exdeath);
check('chaos は未確定のまま', st().tell.chaos === null, st().tell.chaos);
emit(tell('45F'));   // カオス 嘘
check('chaos = 嘘', st().tell.chaos === false, st().tell.chaos);
check('exdeath は据え置き', st().tell.exdeath === true, st().tell.exdeath);
emit(tell('999'));   // 無関係の count は無視
check('未知 count は無視', st().tell.exdeath === true && st().tell.chaos === false);

console.log('3) グランドクロス1回目(本当): フォークライトニング 51s = 早 → 散開');
emit(cast(BOSS, 'ネオエクスデス', 'BB14', 'グランドクロス', '8.700'));
check('GC カウント 1', st().gcCount === 1, st().gcCount);
emit(stat('15A8', 'フォークライトニング', 51, SELF));
check('早の枠に入る', st().steps.short != null && st().steps.long == null);
check('自分のギミック', st().steps.short.mine === true);
check('1 セット目だけでは図は確定しない', scn('short').known === false);

console.log('4) 水属性圧縮は真偽が逆 (本当 = 頭割り)');
emit(stat('15A9', '水属性圧縮', 76, SELF));
check('遅の枠に入る (76s >= 55)', st().steps.long != null);

console.log('5) グランドクロス2回目(嘘): 加速度爆弾 36s = 早 → 動く');
emit(tell('461'));   // ネオエクスデス 嘘
emit(cast(BOSS, 'ネオエクスデス', 'BB14', 'グランドクロス', '8.700'));
check('GC カウント 2', st().gcCount === 2, st().gcCount);
advance(15000);
emit(stat('15AA', '加速度爆弾', 36, SELF));
check('デバフ 2 セット揃った', st().gcDebuffSets === 2, st().gcDebuffSets);
check('早 = 散開 (GC1 のフォークは本当)', val('short', true).indexOf('散開') === 0, val('short', true));
check('遅 = 頭割り (GC1 の水圧縮は本当)', val('long') === '頭割り', val('long'));
check('早 = 散開 / 動く (今やること用)', val('short') === '散開 / 動く', val('short'));
check('早 = 図の一言は 1 行で横並び', val('short', true) === '散開 動', val('short', true));

console.log('6) デバフ無しの枠は頭割り (加速度だけでも頭割りに入る)');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(tell('462'));
emit(stat('15AA', '加速度爆弾', 61, SELF));
emit(stat('15A8', 'フォークライトニング', 51, OTHER));   // 他人ぶん → 時刻だけ入る
check('他人のデバフでも早の時刻は入る', st().steps.short != null);
check('1 セット目だけでは両方「?」', scn('short').known === false && scn('long').known === false);
advance(15000);
emit(stat('15AA', '加速度爆弾', 36, OTHER));             // 2 セット目
check('遅 = 頭割り / 止まる (今やること用)', val('long') === '頭割り / 止まる', val('long'));
check('遅 = 図の一言も 1 行で横並び', val('long', true) === '頭割り 止', val('long', true));
check('早 = 頭割り (自分は無デバフ)', val('short') === '頭割り', val('short'));

console.log('7) 呪詛の叫声は残り時間で 視線1 / 視線2 に分かれる');
emit(stat('15A7', '呪詛の叫声', 60, OTHER));
emit(stat('15A7', '呪詛の叫声', 60, SELF));
check('60s → 視線1', st().steps.gaze1 != null && st().steps.gaze2 == null);
check('視線1 = 自分持ちなら中央へ (今やること用)', val('gaze1') === '中央 → 見ない', val('gaze1'));
check('視線1 = 図の一言は 1 語だけ', val('gaze1', true) === '見ない', val('gaze1', true));
check('自分持ち', st().steps.gaze1.mine === true);
emit(tell('461'));   // ネオエクスデス 嘘
emit(stat('15A7', '呪詛の叫声', 69, OTHER));
check('69s → 視線2', st().steps.gaze2 != null);
check('視線2 = 見る (嘘)', val('gaze2').indexOf('見る') === 0, val('gaze2'));

console.log('8) 混沌の炎 / 混沌の水 はカオス側の真偽を使い、判定が互いに逆');
emit(tell('460'));   // カオス 本当
emit(stat('15AB', '混沌の炎', 60, SELF));
check('炎 本当 = タケノコ', val('fire') === 'タケノコ', val('fire'));
emit(stat('15AC', '混沌の水', 84, SELF));
check('つなみ 本当 = 中央', val('water') === '中央', val('water'));
emit(tell('45F'));   // カオス 嘘
emit(stat('15AB', '混沌の炎', 45, SELF));
check('炎 嘘 = 中央', val('fire') === '中央', val('fire'));
emit(stat('15AC', '混沌の水', 69, SELF));
check('つなみ 嘘 = タケノコ', val('water') === 'タケノコ', val('water'));

console.log('9) 無の氾濫: 色はデバフだけで決まり、氾濫の真偽では反転しない');
// C392=本当/青右, C393=本当/青左, C3A1=嘘/青右, C3A2=嘘/青左
// 色 = 死の超越なら傷の色そのまま / アラガンフィールドなら逆の色 (氾濫の真偽は無関係)
const LZ = O.dmp4._computeLaser;
function laser(wound, dof, id) {
  st().wound = wound; st().dof = dof;
  const r = LZ(id);
  return r ? (r.color + '/' + r.dir) : null;
}
const IDS = ['C392', 'C393', 'C3A1', 'C3A2'];
function colorFor(wound, dof) {
  const set = new Set(IDS.map((id) => laser(wound, dof, id).split('/')[0]));
  return set.size === 1 ? [...set][0] : 'ばらつき(' + [...set].join(',') + ')';
}
check('紫+死の超越 → どのIDでも 紫', colorFor('white', 'death') === 'white', colorFor('white', 'death'));
check('青+死の超越 → どのIDでも 青', colorFor('black', 'death') === 'black', colorFor('black', 'death'));
check('紫+アラガン → どのIDでも 青', colorFor('white', 'field') === 'black', colorFor('white', 'field'));
check('青+アラガン → どのIDでも 紫', colorFor('black', 'field') === 'white', colorFor('black', 'field'));

// 左右は「行く色」と「青が左か」だけで決まる (showLaserSide=true のときだけ使う)
check('紫 / 青が左(C393) → 右', laser('white', 'death', 'C393') === 'white/right');
check('紫 / 青が右(C392) → 左', laser('white', 'death', 'C392') === 'white/left');
check('紫 / 青が左(C3A2) → 右', laser('white', 'death', 'C3A2') === 'white/right');
check('紫 / 青が右(C3A1) → 左', laser('white', 'death', 'C3A1') === 'white/left');
check('青 / 青が左(C393) → 左', laser('black', 'death', 'C393') === 'black/left');
check('青 / 青が右(C392) → 右', laser('black', 'death', 'C392') === 'black/right');
check('青 / 青が左(C3A2) → 左', laser('black', 'death', 'C3A2') === 'black/left');
check('青 / 青が右(C3A1) → 右', laser('black', 'death', 'C3A1') === 'black/right');

console.log('10) GC3 のデバフは自分ぶんだけ拾う (偽IDも同じ意味)');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(stat('1317', '生者の傷', 15, OTHER));           // 他人 → 無視
check('他人の傷は無視', st().wound === null, st().wound);
emit(stat('15A6', '死者の傷', 15, SELF));
emit(stat('1C6', 'アラガンフィールド', 15, SELF));
check('自分 = 青(黒)', st().wound === 'black', st().wound);
check('自分 = アラガンフィールド', st().dof === 'field', st().dof);
emit(cast(BOSS, 'ネオエクスデス', 'C3A1', '無の氾濫', '6.000'));
check('レーザー行 = 色だけ (左右は既定で出さない)', val('laser') === '紫', val('laser'));
O.dmp4._config.showLaserSide = true;
check('showLaserSide=true なら左右も付く', val('laser') === '紫 左', val('laser'));
O.dmp4._config.showLaserSide = false;

console.log('11) マジックチャージ → マジックアウト (チャージ時と一致なら予兆は本当)');
emit(head('02A4'));                       // ブリザガ 本当
emit(head('02A5'));                       // サンダガ 嘘
emit(stat('5CC', 'ブリザガチャージ', 60, '4000AAAA'));
emit(stat('5CD', 'サンダガチャージ', 60, '4000AAAA'));
await sleep(400);                         // 頭マーカー待ちのスナップショット
check('チャージ 氷 = 本当', st().charged.ice === true, st().charged.ice);
check('チャージ 雷 = 嘘', st().charged.thunder === false, st().charged.thunder);
emit(head('02A4'));                       // 出る側も 氷 本当 → 一致 = 本当
emit(head('02A6'));                       // 雷は 本当 → チャージ(嘘)と不一致 = 嘘
const mo = O.dmp4._computeManaOut();
check('氷 = 本当 (予兆を避ける)', mo.ice === true, mo.ice);
check('雷 = 嘘 (直線に入る)', mo.thunder === false, mo.thunder);
emit(cast('4000AAAA', 'ケフカ', 'BAA5', 'マジックアウト', '6.700'));
advance(7100);
check('マジックアウト = 直線だけ踏む', val('mana') === '直線だけ踏む', val('mana'));

console.log('12) 4 通りのマジックアウト文言');
function manaOut(ci, ct, li, lt) {
  st().charged.ice = ci; st().charged.thunder = ct;
  st().liveTruth.ice = li; st().liveTruth.thunder = lt;
  st().steps.mana = { at: NOW - 1, ice: null, thunder: null };
  tick();
  return val('mana');
}
check('氷本当+雷本当 → 両方踏まない', manaOut(true, true, true, true) === '両方踏まない');
check('氷嘘+雷本当 → 扇だけ踏む', manaOut(true, true, false, true) === '扇だけ踏む');
check('氷本当+雷嘘 → 直線だけ踏む', manaOut(true, true, true, false) === '直線だけ踏む');
check('氷嘘+雷嘘 → 両方踏む', manaOut(true, true, false, false) === '両方踏む');

console.log('13) 戦闘終了(260 flag=0)で即リセット (ワイプ対策)');
emit('260|t|0'); tick();
check('active = false', st().active === false, st().active);
check('GC カウント 0', st().gcCount === 0, st().gcCount);
check('全ステップ空', Object.keys(st().steps).every((k) => st().steps[k] == null));
check('真偽クリア', st().tell.exdeath === null && st().tell.chaos === null);

console.log('14) P4 開始を取りこぼしても 808 で拾える (途中参加/再入場)');
emit(tell('460'));
check('808 で active に', st().active === true);
check('chaos = 本当', st().tell.chaos === true);

console.log('15) 図に渡す立ち位置 (マップ基準・ロール別)');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(cast(BOSS, 'ネオエクスデス', 'BB14', 'グランドクロス', '8.700'));

O.dmp4._setRole('dps');
emit(tell('462'));                                          // ネオエクスデス 本当
emit(stat('15A8', 'フォークライトニング', 51, SELF));        // 早 = 1人受け
emit(stat('15A9', '水属性圧縮', 76, SELF));                  // 遅 = 本当なら頭割り
check('ボスの位置は図に渡さない (全部マップ基準)', scn('short').bossAngle === undefined);
advance(15000);
emit(stat('15AA', '加速度爆弾', 36, OTHER));                 // 2 セット目で確定
check('早/DPS 1人受け = 東(90)', pos('short') === '90', pos('short'));
check('遅も同じ配置 (早/遅で共通)', JSON.stringify(scn('short').spread) === JSON.stringify(scn('long').spread));
check('遅/DPS 頭割り = 南(180)', pos('long') === '180', pos('long'));
O.dmp4._setRole('th');
check('遅/TH 頭割り = 北(0)', pos('long') === '0', pos('long'));
check('早/TH 1人受け = 西(270)', pos('short') === '270', pos('short'));

console.log('16) 炎/つなみ は範囲の形だけ。タケノコの捨て場所は中央固定');
emit(tell('45F'));
emit(stat('15AB', '混沌の炎', 60, SELF));
check('炎 = 中央 (カオス嘘)', scn('fire').bait === false, scn('fire').bait);
emit(tell('460'));
emit(stat('15AB', '混沌の炎', 60, SELF));
check('炎 = タケノコ (カオス本当)', scn('fire').bait === true, scn('fire').bait);
check('捨て場所は中央固定', scn('fire').atCenter === true, scn('fire').atCenter);

console.log('17) 無の氾濫: GC3 のデバフが揃った時点で色が確定する (詠唱を待たない)');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
check('デバフ前は未確定', scn('laser').known === false);
emit(stat('15A5', '生者の傷', 15, SELF));
check('傷だけでは決まらない', scn('laser').known === false);
emit(stat('1558', '死の超越', 15, SELF));
check('デバフが揃えば確定', scn('laser').known === true);
check('死の超越 → 傷の色そのまま (紫)', scn('laser').color === 'white', scn('laser').color);
check('詠唱前なので左右はまだ無い', scn('laser').dir == null, scn('laser').dir);
emit(cast(BOSS, 'ネオエクスデス', 'C3A1', '無の氾濫', '5.000'));   // 嘘
check('氾濫が嘘でも色は変わらない', scn('laser').color === 'white', scn('laser').color);
check('詠唱で左右だけ付く', scn('laser').dir === 'left', scn('laser').dir);

emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(stat('15A5', '生者の傷', 15, SELF));
emit(stat('1C6', 'アラガンフィールド', 15, SELF));
check('アラガンフィールド → 逆の色 (青)', scn('laser').color === 'black', scn('laser').color);
emit(cast(BOSS, 'ネオエクスデス', 'C392', '無の氾濫', '5.000'));   // 本当
check('氾濫が本当でも色は変わらない', scn('laser').color === 'black', scn('laser').color);

console.log('18) 基準が未確定なら図は「?」のまま (known=false)');
emit('260|t|0'); tick();
check('P4 前は laser 未確定', scn('laser').known === false);
check('P4 前は short 未確定', scn('short').known === false);
check('P4 前は gaze1 未確定', scn('gaze1').known === false);
check('P4 前は mana 未確定', scn('mana').known === false);

console.log('19) リセット: ワイプ / 撃破 / ゾーン移動 / 次のプルで持ち越さない');
function fillP4() {
  emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
  emit(tell('462')); emit(tell('460'));
  emit(cast(BOSS, 'ネオエクスデス', 'BB14', 'グランドクロス', '8.700'));
  emit(stat('15A8', 'フォークライトニング', 51, SELF));
  emit(stat('15A9', '水属性圧縮', 76, SELF));
  emit(stat('15A7', '呪詛の叫声', 60, SELF));
  emit(stat('15A7', '呪詛の叫声', 69, OTHER));
  emit(stat('15AB', '混沌の炎', 60, SELF));
  emit(stat('15AC', '混沌の水', 84, SELF));
  emit(stat('15A5', '生者の傷', 15, SELF));
  emit(stat('1558', '死の超越', 15, SELF));
  emit(cast(BOSS, 'ネオエクスデス', 'C393', '無の氾濫', '5.000'));
  emit(cast('4000AAAA', 'ケフカ', 'BAA5', 'マジックアウト', '6.700'));
  tick();
}
const KEYS = ['laser', 'short', 'gaze1', 'fire', 'long', 'gaze2', 'mana', 'water'];
function boardFilled() { return KEYS.filter((k) => st().steps[k] != null).length; }

fillP4();
check('8 枚ぶん埋まった', boardFilled() === 8, boardFilled());
emit('260|t|0'); tick();                       // ワイプ / 撃破 = 戦闘終了フラグ
check('ワイプで全部空', boardFilled() === 0, boardFilled());
check('ワイプで真偽もクリア', st().tell.exdeath === null && st().tell.chaos === null);
check('ワイプで傷/超越もクリア', st().wound === null && st().dof === null);
check('ワイプでチャージもクリア', st().charged.ice === null && st().charged.thunder === null);
check('ワイプで GC カウント 0', st().gcCount === 0, st().gcCount);
check('ワイプで音の発火済みフラグもクリア', Object.keys(st().alerted).length === 0);
check('ワイプで done もクリア', Object.keys(st().done).length === 0);

fillP4();
emit('01|t|553|Dancing Mad (Ultimate)|hash'); tick();   // 再入場
check('ゾーン移動で全部空', boardFilled() === 0, boardFilled());

fillP4();
const before = val('laser');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));  // 次のプル
check('次のプルに前回の答えを持ち越さない', val('laser') == null, before + ' → ' + val('laser'));
check('次のプルでも active', st().active === true);

fillP4();
emit('260|t|1'); tick();                       // 戦闘中フラグはリセットしない
check('戦闘中フラグ(260 flag=1)ではリセットしない', boardFilled() === 8, boardFilled());
emit('260|t|0'); tick();

console.log('20) P4 に入っていないログではリセット処理を空振りさせる');
const calm = st();
emit('260|t|0'); tick();
check('待機中の 260 で state を作り直さない', st() === calm);


console.log('21) TH / DPS はジョブから判定 (PartyChanged と 03 行の両方・順序非依存)');
// 03|t|id|name|job(16進)|level|... 実ログで確認: 1C=SCH 13=PLD 20=DRK 18=WHM 16=DRG 1F=MCH 23=RDM 27=RPR
const add = (id, name, jobHex) => `03|t|${id}|${name}|${jobHex}|64|0000|00||0|0|0|0|0|0|||100.00|100.00|0.00|0.00|h`;
const party = (id, job) => ({ type: 'PartyChanged', party: [{ id: id, name: 'You Player', job: job, inParty: true }] });
function partyChanged(e) { (handlers['PartyChanged'] || []).forEach((cb) => cb(e)); }

O.dmp4._setRole(null);
emit(add(SELF, 'You Player', '13'));            // PLD
check('03 の job 13 → TH', O.dmp4._role() === 'th', O.dmp4._role());
emit(add(SELF, 'You Player', '23'));            // RDM
check('03 の job 23 → DPS', O.dmp4._role() === 'dps', O.dmp4._role());
emit(add(SELF, 'You Player', '18'));            // WHM
check('03 の job 18 → TH (ヒラも TH 側)', O.dmp4._role() === 'th', O.dmp4._role());
emit(add(OTHER, 'Mate Player', '1F'));          // 他人の 03 ではロールを変えない
check('他人の 03 では変わらない', O.dmp4._role() === 'th', O.dmp4._role());

O.dmp4._setRole(null);
partyChanged(party(SELF, 32));                  // DRK
check('PartyChanged の job 32 → TH', O.dmp4._role() === 'th', O.dmp4._role());
partyChanged(party(SELF, 38));                  // DNC
check('PartyChanged の job 38 → DPS', O.dmp4._role() === 'dps', O.dmp4._role());

console.log('22) 自キャラ ID が後から来ても引き直す (順序が逆のケース)');
O.dmp4._setRole(null);
setOwn('10AA00FF');                             // いったん別 ID にしておく
partyChanged(party(SELF, 40));                  // SGE。まだ ownId が違うので決まらない
check('ID が合わないうちは未確定', O.dmp4._role() == null, O.dmp4._role());
setOwn(SELF);                                   // ここで自キャラ ID が判明
check('ID 判明で引き直して TH', O.dmp4._role() === 'th', O.dmp4._role());

console.log('23) CONFIG.role で上書きできる (自動判定が外れたとき用)');
O.dmp4._config.role = 'dps';
check('CONFIG.role が優先される', O.dmp4._scene('short').stack.dps === 180);
O.dmp4._setRole('th');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(tell('462'));
emit(stat('15A8', 'フォークライトニング', 51, SELF));
advance(15000);
emit(stat('15AA', '加速度爆弾', 36, OTHER));                 // 2 セット目で確定
check('CONFIG.role=dps なら 1人受けは東(90)', pos('short') === '90', pos('short'));
O.dmp4._config.role = 'auto';
check('auto に戻すとジョブ判定(th)の西(270)', pos('short') === '270', pos('short'));


console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
}

main();

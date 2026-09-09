// dmp4.js のロジック検証用スタブハーネス (Node 実行)。
// ブラウザ依存 (window/document/performance/rAF/Web Audio) を最小スタブし、
// ACT ネットログと同形式の行を流して
//   ・P4 開始検出 (おちょくりソウル C2DC)
//   ・真偽フラグ 808 の count → ネオエクスデス/カオス 別の 本当/嘘
//   ・グランドクロスのデバフ → 早/遅 の振り分けと 散開/頭割り/止まる/動く
//   ・呪詛の叫声の残り時間 → 視線1 / 視線2
//   ・混沌の炎 / 混沌の水 → タケノコ / 中央
//   ・GC3 の 傷 + 死の超越/アラガンフィールド → 無の氾濫のレーザー色と左右 (全16通り)
//   ・マジックチャージ後の単発 直線(サンダガ)/扇(ブリザガ) の 踏む/踏まない
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

console.log('11) マジックチャージ後の単発 直線/扇 (予兆が本当=踏まない / 嘘=踏む)');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(stat('5CC', 'ブリザガチャージ', 60, '4000AAAA'));
check('予兆が無いうちは ?', val('spell') === '直線 ?', val('spell'));
check('予兆が無いうちは枠も点かない', scn('spell').known === false);

emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(head('02A5'));                       // なぞなぞの予兆: サンダガ 嘘
emit(head('02A4'));                       // なぞなぞの予兆: ブリザガ 本当
emit(stat('5CC', 'ブリザガチャージ', 60, '4000AAAA'));
emit(stat('5CD', 'サンダガチャージ', 60, '4000AAAA'));
check('チャージでパネルが出る', st().steps.spell != null);
// ★チャージの時点で扇まで判定する。詠唱を待つと扇だけ 22 秒「?」のままになる
check('チャージで直線も扇も判定される',
  scn('spell').rows[0].truth === false && scn('spell').rows[1].truth === true,
  JSON.stringify(scn('spell').rows));
check('一言は次に来る直線', val('spell') === '直線 踏む', val('spell'));
check('枠は最初から点く', scn('spell').known === true);
emit(cast('4000AAAA', 'ケフカ', 'C5DE', 'もりもりサンダガ', '4.000'));
check('詠唱が来ても直線の答えは同じ', val('spell') === '直線 踏む', val('spell'));
advance(4100);                            // 直線が着弾
check('直線の行は done になる', scn('spell').rows[0].done === true);
// ★ここで枠が消えると「光って消えてまた光る」になるので、点けたままにする
check('扇の詠唱待ちでも枠は消えない', scn('spell').known === true);
check('一言は扇に切り替わる', val('spell') === '扇 踏まない', val('spell'));
emit(head('02A3'));                       // チャージ後に新しい予兆: ブリザガ 嘘
check('あとから来た予兆で扇は焼き直される', val('spell') === '扇 踏む', val('spell'));
emit(cast('4000AAAA', 'ケフカ', 'BA95', 'ひろげるブリザガ', '4.000'));
check('扇 = 嘘 → 踏む', scn('spell').rows[1].truth === false);

console.log('12) 4 通りの組み合わせ');
function spellOut(lineTruth, coneTruth) {
  emit('260|t|0'); tick();
  emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
  emit(stat('5CD', 'サンダガチャージ', 60, '4000AAAA'));
  emit(head(lineTruth ? '02A6' : '02A5'));
  emit(cast('4000AAAA', 'ケフカ', 'C5DE', 'もりもりサンダガ', '4.000'));
  emit(head(coneTruth ? '02A4' : '02A3'));
  emit(cast('4000AAAA', 'ケフカ', 'BA95', 'ひろげるブリザガ', '22.000'));
  return scn('spell').rows.map((r) => r.label + (r.truth ? '踏まない' : '踏む')).join(' / ');
}
check('直線本当+扇本当 → 両方踏まない',
  spellOut(true, true) === '直線踏まない / 扇踏まない', spellOut(true, true));
check('直線嘘+扇本当 → 直線だけ踏む',
  spellOut(false, true) === '直線踏む / 扇踏まない', spellOut(false, true));
check('直線本当+扇嘘 → 扇だけ踏む',
  spellOut(true, false) === '直線踏まない / 扇踏む', spellOut(true, false));
check('直線嘘+扇嘘 → 両方踏む',
  spellOut(false, false) === '直線踏む / 扇踏む', spellOut(false, false));

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
check('P4 前は spell 未確定', scn('spell').known === false);

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
  emit(stat('5CC', 'ブリザガチャージ', 60, '4000AAAA'));
  tick();
}
const KEYS = ['laser', 'short', 'gaze1', 'fire', 'long', 'gaze2', 'spell', 'water'];
function boardFilled() { return KEYS.filter((k) => st().steps[k] != null).length; }

fillP4();
check('8 枚ぶん埋まった', boardFilled() === 8, boardFilled());
emit('260|t|0'); tick();                       // ワイプ / 撃破 = 戦闘終了フラグ
check('ワイプで全部空', boardFilled() === 0, boardFilled());
check('ワイプで真偽もクリア', st().tell.exdeath === null && st().tell.chaos === null);
check('ワイプで傷/超越もクリア', st().wound === null && st().dof === null);
check('ワイプで予兆もクリア', st().liveTruth.ice === null && st().liveTruth.thunder === null);
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


console.log('24) ほのお/つなみ: 詠唱順はランダムだが着弾は必ず 炎 → 水。真偽はそれぞれ別');
// 実タイムライン: カオスの詠唱 2 回は約 16 秒あき、デバフはその 8.7 秒後に付く。
// 炎(15AB) は 60s か 45s、水(15AC) は 84s か 69s なので、どちらの順で詠唱されても
// 切れる時刻は 炎 ≈ +69s / 水 ≈ +93s になり、着弾順は必ず 炎 → 水。
function chaosRun(firstIsFire, firstTrue, secondTrue) {
  emit('260|t|0'); tick();
  const t0 = NOW;
  emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
  // 1 回目の詠唱 → 真偽 → 9 秒後に着弾してデバフ付与
  emit(cast(BOSS, 'カオス', firstIsFire ? 'BB20' : 'BB21', firstIsFire ? 'ほのお' : 'つなみ', '8.700'));
  emit(tell(firstTrue ? '460' : '45F'));
  advance(9000);
  if (firstIsFire) emit(stat('15AB', '混沌の炎', 60, SELF));
  else emit(stat('15AC', '混沌の水', 84, SELF));
  // 2 回目 (約 16 秒後)
  advance(7000);
  emit(cast(BOSS, 'カオス', firstIsFire ? 'BB21' : 'BB20', firstIsFire ? 'つなみ' : 'ほのお', '8.700'));
  emit(tell(secondTrue ? '460' : '45F'));
  advance(9000);
  if (firstIsFire) emit(stat('15AC', '混沌の水', 69, SELF));
  else emit(stat('15AB', '混沌の炎', 45, SELF));
  tick();
  return {
    fire: scn('fire').bait, water: scn('water').bait,
    fireAt: (st().steps.fire.at - t0) / 1000, waterAt: (st().steps.water.at - t0) / 1000,
  };
}

// 順番A: ほのお → つなみ。炎の真偽 = 1回目(本当) / 水の真偽 = 2回目(嘘)
let r = chaosRun(true, true, false);
check('A: 炎 = 1回目の真偽(本当) → タケノコ', r.fire === true, r.fire);
check('A: 水 = 2回目の真偽(嘘) → タケノコ', r.water === true, r.water);
check('A: 着弾は 炎 → 水', r.fireAt < r.waterAt, r.fireAt.toFixed(1) + ' / ' + r.waterAt.toFixed(1));

// 順番B: つなみ → ほのお (逆順)。炎の真偽 = 2回目 / 水の真偽 = 1回目
r = chaosRun(false, true, false);
check('B: 炎 = 2回目の真偽(嘘) → 中央', r.fire === false, r.fire);
check('B: 水 = 1回目の真偽(本当) → 中央', r.water === false, r.water);
check('B: 逆順で詠唱されても着弾は 炎 → 水', r.fireAt < r.waterAt, r.fireAt.toFixed(1) + ' / ' + r.waterAt.toFixed(1));

// 真偽が同じでも 炎 と 水 で答えが逆になる (判定が互いに反転しているため)
r = chaosRun(true, true, true);
check('両方 本当 → 炎=タケノコ / 水=中央', r.fire === true && r.water === false, r.fire + '/' + r.water);
r = chaosRun(false, false, false);
check('両方 嘘 → 炎=中央 / 水=タケノコ', r.fire === false && r.water === true, r.fire + '/' + r.water);


console.log('25) プログレスバーの total は「最初に見えた時から解決まで」で、後続デバフで飛ばない');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(tell('462'));
const t0 = NOW;
emit(stat('15A8', 'フォークライトニング', 51, SELF));       // GC1 の 51s
const total1 = st().steps.short.total;
check('1 本目で total = 51s', Math.round(total1 / 1000) === 51, total1);
advance(15000);
emit(stat('15AA', '加速度爆弾', 36, OTHER));                // GC2 の 36s (他人ぶん)
const total2 = st().steps.short.total;
check('2 本目が来ても total は縮まない', total2 >= total1, total1 + ' → ' + total2);
check('解決時刻は 51s 後 ≒ 36s 後 でほぼ同じ',
  Math.abs((st().steps.short.at - t0) - 51000) < 1500, (st().steps.short.at - t0));


console.log('26) 無の氾濫: 詠唱が来てもプログレスバーが巻き戻らない');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
const lz0 = NOW;
emit(stat('15A6', '死者の傷', 15, SELF));
emit(stat('1558', '死の超越', 15, SELF));
const lTotal1 = st().steps.laser.total;
check('確定時は傷の残り 15s ぶん', Math.round(lTotal1 / 1000) === 15, lTotal1);
advance(6000);
const progBefore = 1 - (st().steps.laser.at - NOW) / st().steps.laser.total;
emit(cast(BOSS, 'ネオエクスデス', 'C393', '無の氾濫', '5.000'));
const lz = st().steps.laser;
const progAfter = 1 - (lz.at - NOW) / lz.total;
// 傷の残り (仮の締め切り) より本当の着弾のほうが早いので total は縮むが、
// from を持ち続けているのでバーの進み具合は前に進むだけ = 巻き戻らない。
check('バーは巻き戻らない', progAfter >= progBefore,
  progBefore.toFixed(3) + ' -> ' + progAfter.toFixed(3));
check('total は 確定 -> 着弾 の 11s', Math.round(lz.total / 1000) === 11, lz.total);
check('着弾は詠唱開始の 5s 後', Math.round((lz.at - lz0 - 6000) / 1000) === 5, lz.at - lz0);
check('バーは 6/11 付近まで進んでいる',
  Math.abs((1 - (lz.at - NOW) / lz.total) - 6 / 11) < 0.02, 1 - (lz.at - NOW) / lz.total);

console.log('27) CONFIG.clock で時計を差し替えられる (任意の時点に飛ばすため)');
let simT = 500000;
O.dmp4._config.clock = function () { return simT; };
emit('260|t|0');
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(tell('462'));
emit(stat('15A9', '水属性圧縮', 50.5, SELF));      // GC1 の早
emit(stat('15A7', '呪詛の叫声', 59.5, OTHER));     // 視線1
check('差し替えた時計で at が入る',
  Math.abs(st().steps.short.at - (simT + 50500)) < 1, st().steps.short.at - simT);
simT += 14800;                                     // GC2 まで進める (rAF は回さない)
emit(stat('15A8', 'フォークライトニング', 60.6, SELF));   // GC2 の遅
emit(stat('15A7', '呪詛の叫声', 68.6, SELF));      // 視線2
check('早の枠に入る', st().steps.short != null && st().steps.short.mine === true);
check('遅の枠に入る', st().steps.long != null && st().steps.long.mine === true);
check('視線1は他人ぶん', st().steps.gaze1 != null && st().steps.gaze1.mine === false);
check('視線2は自分ぶん', st().steps.gaze2 != null && st().steps.gaze2.mine === true);
check('早と遅の解決はどちらも同じ時刻に揃う',
  Math.abs((st().steps.long.at - st().steps.short.at) - 24900) < 100,
  st().steps.long.at - st().steps.short.at);
O.dmp4._config.clock = null;

console.log('27b) 予兆は詠唱の前後どちらの順でも取れる (行の順に依存しない)');
[['予兆が先', ['head', 'cast']], ['詠唱が先', ['cast', 'head']]].forEach(function (c) {
  emit('260|t|0'); tick();
  emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
  emit(stat('5CD', 'サンダガチャージ', 60, '4000AAAA'));
  c[1].forEach(function (step) {
    if (step === 'head') emit(head('02A5'));                                     // 雷 嘘
    else emit(cast('4000AAAA', 'ケフカ', 'C5DE', 'もりもりサンダガ', '4.000'));
  });
  check(c[0] + ' → 直線 踏む', val('spell') === '直線 踏む', val('spell'));
});

console.log('28) ⑦ はマジックチャージで出る。バーは扇まで通しで伸びる');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
check('チャージ前は枠が無い', st().steps.spell == null, st().steps.spell);
emit(stat('5CC', 'ブリザガチャージ', 60, '4000AAAA'));
emit(stat('5CD', 'サンダガチャージ', 60, '4000AAAA'));
const sFrom = st().steps.spell.from;
check('暫定の残り秒は次に来る直線ぶん 8.3s',
  Math.round((st().steps.spell.at - sFrom) / 1000) === 8, st().steps.spell.at - sFrom);
check('暫定のバーは遅い扇ぶん 26.3s',
  Math.round((st().steps.spell.barAt - sFrom) / 1000) === 26, st().steps.spell.barAt - sFrom);
advance(4000);
emit(head('02A5'));
emit(cast('4000AAAA', 'ケフカ', 'C5DE', 'もりもりサンダガ', '4.300'));
check('残り秒は先に来る直線 (8.3s 後)',
  Math.round((st().steps.spell.at - sFrom) / 1000) === 8, st().steps.spell.at - sFrom);
check('詠唱が来ても from は動かない', st().steps.spell.from === sFrom);
advance(4400);                            // 直線が着弾 → 残り秒の対象が扇に移る
emit(head('02A4'));
emit(cast('4000AAAA', 'ケフカ', 'BA95', 'ひろげるブリザガ', '4.000'));
check('残り秒は扇に切り替わる (12.4s 後)',
  Math.round((st().steps.spell.at - sFrom) / 1000) === 12, st().steps.spell.at - sFrom);
check('バーは巻き戻らない (total は縮まない)',
  st().steps.spell.total >= 12400, st().steps.spell.total);
check('両方確定したら一言は次に来る扇', val('spell') === '扇 踏まない', val('spell'));
advance(4100);
check('両方 done', scn('spell').rows.every((r) => r.done === true));

console.log('29) ⑦ は「いま処理する 1 行」だけ光る (2 行同時に色を付けない)');
emit('260|t|0'); tick();
emit(cast('4000AAAA', 'ケフカ', 'C2DC', 'おちょくりソウル', '5.000'));
emit(head('02A6')); emit(head('02A4'));   // 直線 本当 / 扇 本当
emit(stat('5CC', 'ブリザガチャージ', 60, '4000AAAA'));
emit(stat('5CD', 'サンダガチャージ', 60, '4000AAAA'));
let rw = scn('spell').rows;
check('両方とも答えは出ている', rw[0].truth === true && rw[1].truth === true);
check('光るのは直線だけ', rw[0].active === true && rw[1].active === false,
  JSON.stringify(rw.map((r) => r.active)));
emit(cast('4000AAAA', 'ケフカ', 'C5DE', 'もりもりサンダガ', '4.000'));
advance(4100);                            // 直線が着弾
rw = scn('spell').rows;
check('直線が済んだら光るのは扇だけ', rw[0].active === false && rw[1].active === true,
  JSON.stringify(rw.map((r) => r.active)));
check('済んだ直線も答えは残る', rw[0].truth === true && rw[0].done === true);

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
}

main();

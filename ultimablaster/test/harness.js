// ultimablaster.js のロジック検証用スタブハーネス (Node 実行)。
// ブラウザ依存 (window/document/canvas/performance/rAF/Web Audio) を最小スタブし、
// 実ログ (ACTネットログ) と同形式の行を流して
//   ・1回目の突入先(D) と 回転(CW/CCW) の自動判定
//   ・サイコロ番号 → 立ち位置(八角形の中間スポット)の数式
//   ・頭マーカー icon → 自分の番号
//   ・バースト間リセット
// を検証する。角度・座標は実ログ 実ログ の 22:44 / 23:12 バーストに準拠。
'use strict';
const path = require('path');

const SELF = '10AA0001';
const C1 = '40002CE5', C2 = '40002CE4', C3 = '40002CE3';  // ケフカ clone(突入体)

let NOW = 0;
const rafQueue = [];
function fakeCtx() {
  return new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      return function () {};
    },
    set() { return true; },
  });
}
const elements = {};
function fakeEl() { return { textContent: '', className: '', style: {}, classList: { add() {}, remove() {} } }; }
function getEl(id) {
  if (id === 'ub-arena') return elements[id] || (elements[id] = { width: 360, height: 360, getContext: fakeCtx });
  return elements[id] || (elements[id] = fakeEl());
}
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

require(path.join(__dirname, '..', 'src', 'ultimablaster.js'));
const O = global.window.Overlay;
O.ultima._config.sound = false;
O.ultima.init();

function tick() { const cbs = rafQueue.splice(0, rafQueue.length); cbs.forEach((cb) => cb()); }
function advance(ms) { NOW += ms; tick(); }
function emit(line) { (handlers['LogLine'] || []).forEach((cb) => cb({ type: 'LogLine', line: line.split('|') })); }
function setOwn(id) { (handlers['ChangePrimaryPlayer'] || []).forEach((cb) => cb({ type: 'ChangePrimaryPlayer', charID: parseInt(id, 16), charName: 'Self' })); }

// 実ログ形式の BAE3 突入行 (ソース座標を fields 40/41 に置く)。
function charge(id, x, y) {
  return ['22', 't', id, 'ケフカ', 'BAE3', 'アルテマブラスター', SELF, 'Self',
    '750603', '1000', '1B', 'BAE38000', '0','0','0','0','0','0','0','0','0','0','0','0',
    '200000', '200000', '10000', '10000', '', '', '90.00', '90.00', '0.00', '0.00',
    '9415000', '9415000', '10000', '10000', '', '', x.toFixed(2), y.toFixed(2), '0.00', '0.00',
    '000014CF', '0', '8', '00'].join('|');
}
const hm = (id, icon) => `27|t|${id}|Name|0000|0000|${icon}|${id}|0000|0000`;
// 8 方位のエッジ座標 (中心 100,100 / 半径 20)
const EDGE = {
  N: [100, 80], NE: [114.14, 85.86], E: [120, 100], SE: [114.14, 114.14],
  S: [100, 120], SW: [85.86, 114.14], W: [80, 100], NW: [85.86, 85.86],
};
function chargeFrom(id, dir) { return charge(id, EDGE[dir][0], EDGE[dir][1]); }

let pass = 0, fail = 0;
function check(name, cond, extra) { cond ? (pass++, console.log('  PASS', name)) : (fail++, console.log('  FAIL', name, extra != null ? '→ ' + extra : '')); }
const st = () => O.ultima._state();
function near(a, b, eps) { return Math.abs(((a - b) % 360 + 540) % 360 - 180) <= (eps == null ? 0.5 : eps); }

setOwn(SELF);

console.log('1) バースト0: 1回目=西発(突入先=東) → 北西 で 時計回り');
emit(chargeFrom(C1, 'W'));    // clone1 = 西エッジ → 突入先 D = 東(90)
check('active', st().active === true);
check('D = 東(90)', near(st().D, 90), st().D);
emit(chargeFrom(C2, 'NW'));   // clone2 = 北西(315) → 西(270)→北西(315) = 時計回り
check('回転 = CW', st().rot === 'CW', st().rot);
check('s = -1', st().s === -1, st().s);

console.log('2) 立ち位置の数式 (D=東, CW): 実ログ観測の中間スポットと一致');
// N1=67.5(ENE) N2=22.5(NNE) N3=337.5(NNW) N4=292.5(WNW) N5=247.5(WSW) N6=202.5(SSW) N7=157.5(SSE) N8=112.5(ESE)
check('サイコロ1 = 67.5', near(O.ultima._diceAngle(1), 67.5), O.ultima._diceAngle(1));
check('サイコロ2 = 22.5', near(O.ultima._diceAngle(2), 22.5), O.ultima._diceAngle(2));
check('サイコロ3 = 337.5', near(O.ultima._diceAngle(3), 337.5), O.ultima._diceAngle(3));
check('サイコロ4 = 292.5', near(O.ultima._diceAngle(4), 292.5), O.ultima._diceAngle(4));
check('サイコロ8 = 112.5 (Dの反対隣)', near(O.ultima._diceAngle(8), 112.5), O.ultima._diceAngle(8));

console.log('3) 頭マーカー icon 0152 → 自分=3番, 行き先=337.5(NNW)');
emit(hm(SELF, '0152'));
check('selfNumber = 3', st().selfNumber === 3, st().selfNumber);
check('自分の行き先 = 337.5', near(O.ultima._diceAngle(st().selfNumber), 337.5));

console.log('4) 中心付近の突入(途中スナップ)は方角不定として無視');
const before = st().charges.length;
emit(charge('40002C00', 100, 100));  // 中心
check('中心突入はカウントされない', st().charges.length === before, st().charges.length);

console.log('5) resetAfterSec 経過後の新規突入で状態リセット → バースト1: 東発(突入先=西), 反時計回り');
advance(31000);                        // 30s 超で idle
emit(chargeFrom('40004165', 'E'));     // clone1 = 東エッジ → 突入先 D = 西(270)
check('D = 西(270)', near(st().D, 270), st().D);
check('前バーストの番号はクリア', st().selfNumber == null, st().selfNumber);
emit(chargeFrom('40004164', 'N'));     // clone2 = 北(0): 東(90)→北(0) = 反時計回り
check('回転 = CCW', st().rot === 'CCW', st().rot);
check('s = +1', st().s === 1, st().s);
// D=西, CCW: N3 = 270 + (22.5+90) = 382.5 → 22.5 (実ログ 23:12 バースト観測と一致)
check('サイコロ3 = 22.5', near(O.ultima._diceAngle(3), 22.5), O.ultima._diceAngle(3));
check('サイコロ1 = 292.5 (Dの回転逆隣)', near(O.ultima._diceAngle(1), 292.5), O.ultima._diceAngle(1));

console.log('6) 番号 8 と 1 が突入先 D を挟む (どの向きでも)');
// D=270 の両隣: 1 = 292.5, 8 = 247.5
check('サイコロ8 = 247.5', near(O.ultima._diceAngle(8), 247.5), O.ultima._diceAngle(8));
check('D は 1 と 8 の中間', near((O.ultima._diceAngle(1) + O.ultima._diceAngle(8)) / 2, 270), (O.ultima._diceAngle(1) + O.ultima._diceAngle(8)) / 2);

console.log('7) 戦闘終了(260 flag=0)で即リセット (ワイプ対策)');
emit('260|t|0');
tick();
check('active = false', st().active === false, st().active);
check('D クリア', st().D == null, st().D);
check('自分番号クリア', st().selfNumber == null, st().selfNumber);

console.log('8) 数字マーカーは左90°回転配置: 1=北西(315), 2=北東(45), 3=南東(135), 4=南西(225)');
function wm(label){ var arr=O.ultima._config.waymarks.filter(function(w){return w.label===label;}); return arr[0]?arr[0].angle:null; }
check('1 = 315(北西)', wm('1') === 315, wm('1'));
check('2 = 45(北東)', wm('2') === 45, wm('2'));
check('3 = 135(南東)', wm('3') === 135, wm('3'));
check('4 = 225(南西)', wm('4') === 225, wm('4'));
check('A = 0 / B = 90 / C = 180 / D = 270 (十字は標準)', wm('A')===0&&wm('B')===90&&wm('C')===180&&wm('D')===270);

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);

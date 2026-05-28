// dottimer.js のロジック検証用スタブハーネス (Node 実行)。
// ブラウザ依存 (window/document/performance/requestAnimationFrame/Web Audio) を最小スタブ。
// 個人情報は含めず、ダミー ID/名前で動作確認する。
'use strict';
const fs = require('fs');
const path = require('path');

// ダミー識別子 (実在の actor ID / プレイヤー名ではない)
const SELF_ID = '10AAAAAA';
const SELF_NAME = 'Self Tester';
const OTHER_ID = '10BBBBBB';
const OTHER_NAME = 'Other Player';
const ENEMY_A_ID = '40001111';
const ENEMY_A_NAME = '木人';
const ENEMY_B_ID = '40002222';
const ENEMY_B_NAME = '巨大木人';

let NOW = 0;                       // 疑似クロック (ms)
const rafQueue = [];
let oscStarts = 0;

function fakeEl() {
  const cls = new Set();
  return {
    children: [],
    parentNode: null,
    textContent: '',
    style: {},
    classList: {
      add: (c) => cls.add(c),
      remove: (c) => cls.delete(c),
      contains: (c) => cls.has(c),
    },
    _cls: cls,
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; return c; },
  };
}

const elements = { dottimer: fakeEl(), 'dot-status': fakeEl(), 'dot-debug': fakeEl() };

global.window = global;
global.performance = { now: () => NOW };
global.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
global.document = {
  getElementById: (id) => elements[id] || (elements[id] = fakeEl()),
  createElement: () => fakeEl(),
  body: { classList: { add() {}, remove() {} } },
};
global.AudioContext = function () {
  return {
    state: 'running', currentTime: 0, resume() {},
    createOscillator() { return { type: '', frequency: {}, connect() {}, start() { oscStarts++; }, stop() {} }; },
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; },
  };
};

const handlers = {};
global.window.Overlay = {
  api: {
    on: (type, cb) => { (handlers[type] = handlers[type] || []).push(cb); },
    start: () => Promise.resolve(),
    ready: () => Promise.resolve(),
    mode:  () => 'legacy',
  },
};

require(path.join(__dirname, '..', 'src', 'dottimer.js'));
const O = global.window.Overlay;
O.dottimer.init();

function tick() {
  const cbs = rafQueue.splice(0, rafQueue.length);
  cbs.forEach((cb) => cb());
}
function advance(ms) { NOW += ms; tick(); }
function emitLog(line) {
  (handlers['LogLine'] || []).forEach((cb) => cb({ type: 'LogLine', line: line.split('|') }));
}
function rowCount() { return elements.dottimer.children.length; }
function alertRows() { return elements.dottimer.children.filter(c => c._cls.has('alert')).length; }

let pass = 0, fail = 0;
function check(name, cond) { (cond ? (pass++, console.log('  PASS', name)) : (fail++, console.log('  FAIL', name))); }

console.log('1) 自キャラ未確定では追跡しない');
emitLog(`26|t|74F|ディア|30.00|${SELF_ID}|${SELF_NAME}|${ENEMY_A_ID}|${ENEMY_A_NAME}|00|1|2|h`);
check('追跡 0 件', rowCount() === 0);

console.log('2) ChangePrimaryPlayer で自キャラ確定 (charID 10進 → hex)');
const charID = parseInt(SELF_ID, 16);
(handlers['ChangePrimaryPlayer'] || []).forEach(cb => cb({ type: 'ChangePrimaryPlayer', charID, charName: SELF_NAME }));
check('status OK 表示', elements['dot-status'].textContent.indexOf(SELF_NAME) >= 0);

console.log('3) 自キャラのディア付与 → 1 件追跡 (source=自キャラ)');
emitLog(`26|t|74F|ディア|30.00|${SELF_ID}|${SELF_NAME}|${ENEMY_A_ID}|${ENEMY_A_NAME}|00|1|2|h`);
tick();
check('追跡 1 件', rowCount() === 1);
check('まだアラートなし', alertRows() === 0);

console.log('4) 他人が付与したディアは無視');
emitLog(`26|t|74F|ディア|30.00|${OTHER_ID}|${OTHER_NAME}|${ENEMY_A_ID}|${ENEMY_A_NAME}|00|1|2|h`);
tick();
check('追跡は 1 件のまま', rowCount() === 1);

console.log('5) 25 秒経過 → 残り 5 秒でアラート＋音');
advance(25100);
check('アラート行 1 件', alertRows() === 1);
check('ビープが鳴った (oscillator start)', oscStarts > 0);

console.log('6) 再付与でアラート解除 (リフレッシュ)');
emitLog(`26|t|74F|ディア|30.00|${SELF_ID}|${SELF_NAME}|${ENEMY_A_ID}|${ENEMY_A_NAME}|00|1|2|h`);
tick();
check('アラート解除', alertRows() === 0);

console.log('7) 30 (消失) で行が消える');
emitLog(`30|t|74F|ディア|0.00|${SELF_ID}|${SELF_NAME}|${ENEMY_A_ID}|${ENEMY_A_NAME}|00|1|2|h`);
tick();
check('追跡 0 件', rowCount() === 0);

console.log('8) 対象死亡(25)で消える');
emitLog(`26|t|74F|ディア|30.00|${SELF_ID}|${SELF_NAME}|${ENEMY_B_ID}|${ENEMY_B_NAME}|00|1|2|h`);
tick();
check('追跡 1 件', rowCount() === 1);
emitLog(`25|t|${ENEMY_B_ID}|${ENEMY_B_NAME}|${SELF_ID}|${SELF_NAME}|h`);
tick();
check('死亡で 0 件', rowCount() === 0);

console.log('9) 対象外DoT(別ジョブ)は無視');
emitLog(`26|t|4B1|ストームバイト|45.00|${SELF_ID}|${SELF_NAME}|${ENEMY_A_ID}|${ENEMY_A_NAME}|00|1|2|h`);  // BARD 45s - 対象外
tick();
check('追跡 0 件 (ストームバイトは対象外)', rowCount() === 0);

console.log('10) エウクラシア・ドシスIII (前方一致) は対象');
emitLog(`26|t|C24|エウクラシア・ドシスIII|30.00|${SELF_ID}|${SELF_NAME}|${ENEMY_A_ID}|${ENEMY_A_NAME}|00|1|2|h`);
tick();
check('追跡 1 件', rowCount() === 1);

console.log(`\n結果: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);

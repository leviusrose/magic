# DoT Timer Overlay

自キャラが付与した **DoT の残り時間**を可視化し、**残り 5 秒**で行を赤く点滅＋ビープ音で知らせる
OverlayPlugin (ACT) 用オーバーレイ。`magic/countdown` と同じ構造（`index.html` + `src/*.js` + `styles.css`）。

既定の対象は**ヒーラーの 30 秒 DoT**を**全レベル帯（置き換え含む）で網羅**する。

FFXIV 公式ジョブガイド (`https://jp.finalfantasyxiv.com/jobguide/`) と実ログでクロスチェック済み。

| ジョブ | 監視名 | レベル帯 | 効果時間 |
|---|---|---|---|
| WHM  | `エアロ` / `エアロラ` / `ディア` | Lv4-45 / Lv46-71 / Lv72+ | 30s |
| SCH  | `バイオ` 前方一致 / `蠱毒法` | バイオ / バイオラ(Biolysis) + 蠱毒法 | 30s |
| AST  | `コンバ` 前方一致 | コンバス / コンバラ / コンバガ | 30s |
| SGE  | `エウクラシア・ドシス` / `エウクラシア・ディスクラシア` 前方一致 | ドシスI/II/III + AoEディスクラシア | 30s |

うるさい場合は [src/dottimer.js](src/dottimer.js) 冒頭の `CONFIG` から個別に削れる。

## 仕組み

ACT のネットワークログ（`e.line` が `|` 区切り配列）を購読して判定する。

| ログ行 | 用途 |
|---|---|
| `02` ChangePrimaryPlayer / `ChangePrimaryPlayer` イベント | **自キャラ ID** の確定 |
| `26` NetworkBuff（付与） | `source == 自キャラ` かつ対象 DoT 名なら追跡開始／更新 |
| `30` NetworkBuff（消失） | 早期に消えた DoT を行から消去 |
| `25` NetworkDeath | 対象が死んだら消去 |

> **重要:** `26`/`30` は **ソースが先・ターゲットが後**。
> 例 `26|t|74F|ディア|30.00|<srcId>|<src名>|<tgtId>|<tgt名>|...`
> （リポジトリの `ffxiv/LOG_FORMAT.md` は逆に書かれているが、実ログで確認済み）

リフレッシュ（再付与）すると残り時間とアラートはリセットされる。
30 秒 DoT は通常 27〜28 秒で更新するため、**5 秒アラートが鳴る ＝ 更新を忘れている**合図になる。

## OverlayPlugin への追加

1. ACT → OverlayPlugin → 新規 → **カスタムオーバーレイ**を追加
2. URL にこの `index.html` を指定（例: `file:///C:/Users/&lt;user&gt;/GitLab/magic/dottimer/index.html`）
3. 位置・サイズ調整は「背景を白にする」にチェック → Width/Height/X/Y で合わせる → チェックを外す
4. 左下に検出した自キャラ名（`● Forename Surname`）が出れば購読 OK。
   `⚠ 自キャラ未検出` のときはログイン or ゾーン移動で確定する。

## 設定

[src/dottimer.js](src/dottimer.js) 冒頭の `CONFIG` を編集する。

```js
var CONFIG = {
  // 監視する DoT (ヒーラー 30 秒 DoT を網羅) — 表「対応」参照
  dotNamesExact:  ['エアロ', 'エアロラ', 'ディア', '蠱毒法'],
  dotNamesPrefix: ['バイオ', 'コンバ', 'エウクラシア・ドシス', 'エウクラシア・ディスクラシア'],

  alertAtSec:     5,        // 残りこの秒数で点滅＋音
  minDurationSec: 15,       // この秒以上の付与のみ対象 (保険)

  // 音
  sound:        true,
  soundFile:    '',         // ★音声ファイル指定★ 空ならビープ。例: 'sounds/alert.wav'
  soundVolume:  0.7,        // 0.0 - 1.0

  showStatus:   true,       // 左下に自キャラ検出状況
  ownNameHint:  '',         // 例 'Forename Surname' (戦闘中起動時のフォールバック)
  debug:        false,      // 上部に診断バナー (切り分け用)
};
```

### 音声ファイルを差し替える

`CONFIG.soundFile` に wav/mp3/ogg のパスを指定する。

- 相対パス: `index.html` からの相対 (例: `'sounds/alert.wav'` で `magic/dottimer/sounds/alert.wav` を再生)
- 絶対パス: `'file:///C:/Users/&lt;user&gt;/sounds/myalert.mp3'` のように `file:///` ＋ forward slash
- 失敗したり空文字なら**内蔵ビープ**にフォールバック

音量は `CONFIG.soundVolume` (0.0〜1.0) で調整。

### 別ジョブを足す

ステータス名（日本語）を `dotNamesExact` / `dotNamesPrefix` に追加する。
全 DoT を出すとうるさいので、名前のホワイトリストで絞る方針。

## トラブルシュート (UI に何も表示されない時)

オーバーレイは画面上部に**診断バナー**（`CONFIG.debug=true` で常時表示）を出すので、まずそれが見えるかを確認する。

| 見えるもの | 状態 | 対処 |
|---|---|---|
| バナーすら出ない | ページが読まれていない | 1.URL に `file:///C:/Users/&lt;user&gt;/GitLab/magic/dottimer/index.html` のように **forward slash** で指定する。 2.OverlayPlugin で右クリック→「**Reload**」。 3.OverlayPlugin の Width/Height/X/Y を 300×120 以上に。「背景を白にする」で位置確認 |
| `API:detached` | OverlayPlugin API を検出できず | オーバーレイ種別を「カスタム」で追加しているか確認。CefSharp 系の OverlayPlugin か |
| `API:legacy/modern \| LogLine:0` | 購読できているがログが来ない | ACT が FFXIV のログを取れているか / 自分のキャラがいるゾーンに入っているか。ACT で「Network parse」が緑か |
| `LogLine:N \| own:?` | 自キャラ ID 未確定 | `src/dottimer.js` の `CONFIG.ownNameHint` に**自キャラのフルネーム**（例 `Forename Surname`）を入れて Reload。任意の戦闘行動 1 回で確定する |
| `own:XXXX(自分の名前)` | 検出OK。あとは DoT 待ち | 該当ジョブ(WHM/SCH/AST/SGE)で対象 DoT を撃てば行が出る |

### 表示と音だけテストする（**デモモード**）

ゲーム側ログが来なくても表示・音を確認したいときは:
1. `src/dottimer.js` の `CONFIG.demo` を `true` にする
2. オーバーレイを Reload
3. 12 秒の「ディア (DEMO)」が現れ、残り 5 秒で赤点滅＋ビープが鳴る

確認後は `demo: false` に戻す。

### コンソールログ

OverlayPlugin のオーバーレイを右クリック → DevTools / デベロッパーツール → Console。
読み込まれていれば `[dottimer] script loaded` と `[overlay] API detected: legacy/modern` が見える。

## テスト

ブラウザ依存をスタブして、実ログ行フォーマットに対するロジックを検証する。

```
node test/harness.js
```

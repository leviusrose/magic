# DoT Timer Overlay

自キャラが付与した **DoT の残り時間**を可視化し、**残り 5 秒**で行を赤く点滅＋ビープ音で知らせる
OverlayPlugin (ACT) 用オーバーレイ。`magic/countdown` と同じ構造（`index.html` + `src/*.js` + `styles.css`）。

既定の対象は**ヒーラーの 30 秒 DoT**（ディア/エアロ系・バイオ・コンバ・エウクラシア各種）。
ACT のネットログ（`26`付与 / `30`消失、自キャラが source のもの）で判定し、名前やキャラ名はハードコードしない。

## 追加

OverlayPlugin → カスタムオーバーレイ → URL にこの `index.html` を `file:///` で指定。

## 設定

[src/dottimer.js](src/dottimer.js) 冒頭の `CONFIG`：

- `dotNamesExact` / `dotNamesPrefix` … 監視する DoT 名（ホワイトリスト。増減はここで）
- `alertAtSec` … 何秒前に点滅＋音（既定 5）
- `sound` / `soundFile` / `soundVolume` … 通知音（空ならビープ）
- `debug` / `demo`

## テスト

`node test/harness.js`（実ログ行フォーマットでロジックを検証）。

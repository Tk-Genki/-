# 入浴タイムスタンプ記録アプリ

高齢者施設職員がスマホで片手操作しやすいことを重視した、Google Apps Script ベースの入浴工程記録アプリです。  
standalone の Apps Script プロジェクトから Google スプレッドシートへ保存する前提です。

## 特徴

- 1つのアプリで曜日ごとに利用者候補を切り替え
- 利用者一覧はコード直書きではなく `Residents` シート管理
- 複数端末対応
- `session_id` はサーバー側で管理
- `BathLog` に各工程を1行ずつ保存
- `ActiveBathSessions` で進行中セッションを管理
- `LockService` により同時更新競合を抑制
- 工程は以下の5つ
  - `脱衣開始`
  - `洗体開始`
  - `入浴開始`
  - `着衣開始`
  - `終了`

## 構成ファイル

- `Code.gs`
  - 画面表示
  - スプレッドシート保存
  - 複数端末対応のセッション管理
  - Residents シート読み込み
- `Index.html`
  - 入力画面本体
- `Stylesheet.html`
  - スマホ向け UI
- `JavaScript.html`
  - ボタン押下時の送信処理
  - 曜日変更時の利用者再描画
- `appsscript.json`
  - Apps Script 設定

## 画面でできること

- 曜日を選択
- 曜日に応じた利用者候補を表示
- 利用者を選択
- 担当者名を入力
- メモを入力
- 工程ボタンを押して記録
- 状態表示と直近記録を確認

## スプレッドシート構成

このアプリでは次の3シートを使用します。

### 1. `BathLog`

各イベントを1行ずつ保存するログシートです。

| 列 | 項目名 | 内容 |
| --- | --- | --- |
| A | `record_id` | 一意な記録ID |
| B | `session_id` | 1回の入浴を識別するID |
| C | `event_order` | 工程順 (`1` から `5`) |
| D | `event_key` | 内部キー |
| E | `event_label` | 表示名 |
| F | `resident_id` | 利用者ID |
| G | `resident_name` | 利用者名 |
| H | `staff_name` | 担当者名 |
| I | `selected_weekday` | 画面上で選択した曜日 |
| J | `recorded_at_iso` | ISO形式時刻 |
| K | `recorded_at_epoch_ms` | Unixミリ秒 |
| L | `recorded_date` | 記録日 |
| M | `recorded_time` | 記録時刻 |
| N | `weekday` | 実記録時の曜日 |
| O | `hour` | 実記録時の時 |
| P | `recorded_at_client` | 端末で押した時刻 |
| Q | `recorded_at_server` | サーバー受信時刻 |
| R | `device_info` | 端末情報 |
| S | `memo` | 任意メモ |

### 2. `ActiveBathSessions`

利用者ごとの進行中セッションを管理するシートです。

| 列 | 項目名 | 内容 |
| --- | --- | --- |
| A | `resident_id` | 利用者ID |
| B | `resident_name` | 利用者名 |
| C | `session_id` | 現在のセッションID |
| D | `status` | `active` または `closed` |
| E | `started_at` | セッション開始時刻 |
| F | `updated_at` | 最終更新時刻 |
| G | `closed_at` | 終了時刻 |
| H | `last_event_key` | 最後に記録した工程キー |
| I | `last_event_label` | 最後に記録した工程名 |

### 3. `Residents`

曜日ごとの入浴対象利用者を管理するシートです。

| 列 | 項目名 | 内容 |
| --- | --- | --- |
| A | `resident_id` | 利用者ID |
| B | `resident_name` | 利用者名 |
| C | `monday` | 月曜対象なら `1` |
| D | `tuesday` | 火曜対象なら `1` |
| E | `wednesday` | 水曜対象なら `1` |
| F | `thursday` | 木曜対象なら `1` |
| G | `friday` | 金曜対象なら `1` |
| H | `saturday` | 土曜対象なら `1` |
| I | `sunday` | 日曜対象なら `1` |
| J | `active` | 有効なら `1` |

利用者候補として表示される条件は以下です。

- `active = 1`
- 選択された曜日列が `1`

## セッション管理の考え方

- `脱衣開始` を押すとセッションを開始
- ただし、その利用者に `active` なセッションがすでにあれば新規作成せず再利用
- `洗体開始` `入浴開始` `着衣開始` `終了` は進行中のセッションを参照
- `終了` 時にそのセッションを `closed` に更新
- 同じ利用者の同じ入浴は、別端末・別職員から押しても同じ `session_id` にまとまる

## 複数端末対応

このアプリは `localStorage` で `session_id` を持ちません。  
`session_id` は `ActiveBathSessions` シート上でサーバー側が管理します。

- クライアント側 `localStorage` は担当者名保持のみに使用
- セッション制御は `Code.gs` 側で実施
- 保存時は `LockService` を使って同時更新競合に備える

## 導入手順

1. Google スプレッドシートを新規作成
2. `拡張機能 > Apps Script` を開く
3. `Code.gs`, `Index.html`, `Stylesheet.html`, `JavaScript.html`, `appsscript.json` を貼り付け
4. `Code.gs` の `SPREADSHEET_ID` に保存先スプレッドシートIDを設定
5. `setupSheet()` を1回実行
6. 権限承認を行う
7. `Residents` シートに利用者データを登録
8. `デプロイ > 新しいデプロイ > ウェブアプリ` で公開
9. スマホで Web アプリ URL を開いて利用

## `setupSheet()` で行われること

`setupSheet()` を実行すると、次の3シートを整備します。

- `BathLog`
- `ActiveBathSessions`
- `Residents`

既存シートがある場合は壊さず、不足しているヘッダーのみ追加します。

## Residents シート初期データ例

```text
resident_id | resident_name | monday | tuesday | wednesday | thursday | friday | saturday | sunday | active
A001        | 山田 太郎     | 1      | 0       | 1         | 0        | 1      | 0        | 0      | 1
A002        | 鈴木 花子     | 0      | 1       | 0         | 1        | 0      | 0        | 0      | 1
A003        | 佐藤 次郎     | 1      | 1       | 1         | 1        | 1      | 0        | 0      | 1
A004        | 休止中 利用者 | 1      | 1       | 1         | 1        | 1      | 1        | 1      | 0

# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリのコードを扱う際のガイドラインを提供します。

## 概要

ClaudeStock は仮想株式取引シミュレーターです。Yahoo Finance を通じて実際の市場データを使用しますが、すべて仮想の資金（初期設定 100,000円）で動作します。実際の金銭は一切関与しません。

## コマンド

```bash
# フロントエンド (Vite) とバックエンド (Express) を同時に起動
npm run dev

# フロントエンドのみ起動 (ポート 5173)
npm run dev:front

# バックエンドのみ起動 (ポート 3001)
npm run dev:server

# 型チェックおよびプロダクション用ビルド
npm run build

# リンターの実行
npm run lint
```

## アーキテクチャ

このプロジェクトは、2つの個別のランタイムを持つフルスタックのモノレポ構成です：

- **フロントエンド**: React + TypeScript (Vite)、`localhost:5173` で動作
- **バックエンド**: Express.js (Node.js ESM)、`localhost:3001` で動作

フロントエンドは `src/api.ts` を介してバックエンドを呼び出します。ベースURLは相対パス `/api` で、開発時は `vite.config.ts` のプロキシ設定（`/api` → `http://localhost:3001`）経由、本番（Railway等）では Express が `dist/` を同一オリジンで配信するため変更不要です。APIレスポンスのすべての型定義は `src/api.ts` に配置されています。

### バックエンド (`server/`)

| ファイル | 役割 |
|------|------|
| `index.js` | Express アプリケーション、すべてのルート定義、本番時は `dist/` の静的配信も兼ねる |
| `db.js` | `better-sqlite3` を使用した SQLite の設定、テーブル作成、WAL モード（`DATA_DIR` 環境変数でDB保存先を変更可能） |
| `api/stocks.js` | Yahoo Finance からのデータ取得（1時間の SQLite キャッシュ付き） |
| `api/trading.js` | アカウント/ポートフォリオの CRUD、売買ロジック |
| `engine/strategy.js` | テクニカル分析 (SMA20, SMA50, RSI-14) および自動取引の実行（`mapWithConcurrency` で銘柄分析を並列化） |
| `scheduler.js` | 自動売買の定期実行（デフォルト1時間ごと、JST平日9:00-15:30のみ） |
| `data/universe.js` | 東証全銘柄（プライム・スタンダード・グロース、約3,700社）のユニバース読み込み |

### 自動売買の定期実行

`scheduler.js` がサーバー起動時に自動で開始し、デフォルトで1時間ごとに `executeAutoTrade` を東証全銘柄対象で実行します（市場時間外・前回実行中はスキップ）。以下の環境変数で制御：
- `AUTO_TRADE_SCHEDULE_ENABLED`（デフォルト `true`）
- `AUTO_TRADE_INTERVAL_MINUTES`（デフォルト `60`）
- `AUTO_TRADE_SCHEDULE_UNIVERSE`（`ALL_TSE` | `DEFAULT_50`、デフォルト `ALL_TSE`）

### デプロイ（Railway）

`railway.json` で `npm run build` → `npm start` を実行する単一サービス構成。SQLiteの永続化には Railway のボリュームを `DATA_DIR` が指す場所にマウントすること。

### データベース (`data/claude_stock.db`)

以下の4つのテーブルで構成されています：
- `account`: 単一行（id=1）、残高情報
- `portfolio`: 銘柄ごとの保有状況（シンボルに UNIQUE 制約）
- `transactions`: 取引履歴
- `stock_cache`: OHLCV（始値・高値・安値・終値・出来高）データ（銘柄 + 日付がキー）

### 自動取引ロジック

`executeAutoTrade` は銘柄をループし、`generateSignals`（SMA クロスオーバー + RSI）を実行します。`confidence >= 40` の場合に取引を行います。買い注文のサイズは信頼度とバリュースコアに応じて現金の5%〜30%で、売り注文は信頼度に応じて保有の40%〜100%を売却します。デフォルトの対象銘柄は約50銘柄（自動車、電機、半導体、通信、金融、素材、医薬品、食品、小売、不動産、運輸、商社の各セクターをカバー）。

### 日本株のシンボル

4桁の数字銘柄コード（例：`7203`）は、`server/api/stocks.js` 内で自動的に Yahoo Finance 形式（`7203.T`）に変換されます。

### 株価データのキャッシュ

`fetchDailyData` は、Yahoo Finance にリクエストを投げる前に、`stock_cache` に1時間以内の同一データがあるか確認します。データ取得時には、6ヶ月分の履歴 OHLCV データを保存します。メモリ内でのレート制限は、1分あたり20リクエストに設定されています。

## 環境設定

サーバー起動時に `.env` を読み込みます。`.env.example` を `.env` にコピーして使用してください。
主な変数：`PORT`（デフォルト 3001）、`DATA_DIR`（SQLite保存先）、`AUTO_TRADE_SCHEDULE_ENABLED`/`AUTO_TRADE_INTERVAL_MINUTES`/`AUTO_TRADE_SCHEDULE_UNIVERSE`（自動売買の定期実行設定）。Yahoo Finance は API キーなしで使用されます。

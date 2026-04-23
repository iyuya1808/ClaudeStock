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

フロントエンドは `src/api.ts` を介してバックエンドを呼び出します。ベースURLは `http://localhost:3001/api` に固定されています。APIレスポンスのすべての型定義は `src/api.ts` に配置されています。

### バックエンド (`server/`)

| ファイル | 役割 |
|------|------|
| `index.js` | Express アプリケーション、すべてのルート定義 |
| `db.js` | `better-sqlite3` を使用した SQLite の設定、テーブル作成、WAL モード |
| `api/stocks.js` | Yahoo Finance からのデータ取得（1時間の SQLite キャッシュ付き） |
| `api/trading.js` | アカウント/ポートフォリオの CRUD、売買ロジック |
| `engine/strategy.js` | テクニカル分析 (SMA20, SMA50, RSI-14) および自動取引の実行 |

### データベース (`data/claude_stock.db`)

以下の4つのテーブルで構成されています：
- `account`: 単一行（id=1）、残高情報
- `portfolio`: 銘柄ごとの保有状況（シンボルに UNIQUE 制約）
- `transactions`: 取引履歴
- `stock_cache`: OHLCV（始値・高値・安値・終値・出来高）データ（銘柄 + 日付がキー）

### 自動取引ロジック

`executeAutoTrade` は銘柄をループし、`generateSignals`（SMA クロスオーバー + RSI）を実行します。`confidence >= 40` の場合に取引を行います。買い注文のサイズは現在の現金の 10% で、売り注文は全ポジションを売却します。デフォルトの対象銘柄：`7203.T, 6758.T, 9984.T, 7974.T, 6861.T`。

### 日本株のシンボル

4桁の数字銘柄コード（例：`7203`）は、`server/api/stocks.js` 内で自動的に Yahoo Finance 形式（`7203.T`）に変換されます。

### 株価データのキャッシュ

`fetchDailyData` は、Yahoo Finance にリクエストを投げる前に、`stock_cache` に1時間以内の同一データがあるか確認します。データ取得時には、6ヶ月分の履歴 OHLCV データを保存します。メモリ内でのレート制限は、1分あたり20リクエストに設定されています。

## 環境設定

サーバー起動時に `.env` を読み込みます。`.env.example` を `.env` にコピーして使用してください。
主な変数：`PORT`（デフォルト 3001）。Yahoo Finance は API キーなしで使用されます。サーバー起動時の出力に表示される `ALPHA_VANTAGE_API_KEY` は古いログメッセージの名残であり、機能上の影響はありません。

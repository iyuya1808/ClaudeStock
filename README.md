# ClaudeStock

仮想株式取引シミュレーター。Yahoo Finance の実際の市場データを使いながら、すべて仮想の資金（初期設定 100,000円）で取引できます。実際の金銭は一切関与しません。

## 主な機能

- **手動取引**: 銘柄検索・チャート表示・テクニカル分析・売買
- **自動売買**: SMA20/50クロスオーバー + RSI-14 + バリュースコア（PER/PBR/配当利回り/ROE/売上成長率）に基づくシグナルで自動売買
- **割安株スクリーニング**: バリュースコアによる銘柄ランキング
- **全銘柄対応**: デフォルトの主要50銘柄、または東証プライム・スタンダード・グロース全銘柄（約3,700社）を対象に分析・売買が可能
- **定期自動売買**: サーバー起動中は1時間ごと（JST平日9:00-15:30）に自動売買を自動実行

## セットアップ

```bash
npm install
cp .env.example .env
```

## コマンド

```bash
# フロントエンド (Vite) とバックエンド (Express) を同時に起動
npm run dev

# フロントエンドのみ起動 (http://localhost:5173)
npm run dev:front

# バックエンドのみ起動 (http://localhost:3001)
npm run dev:server

# 型チェック + プロダクションビルド (dist/ を生成)
npm run build

# プロダクションモードで起動（ビルド済み dist/ をExpressが配信）
npm start

# リンター
npm run lint
```

## アーキテクチャ

フルスタックのモノレポ構成です。

- **フロントエンド**: React + TypeScript (Vite)
- **バックエンド**: Express.js (Node.js ESM)、SQLite (`better-sqlite3`)

開発時はフロントエンド (`5173`) とバックエンド (`3001`) を別プロセスで動かし、`vite.config.ts` のプロキシ設定で `/api` をバックエンドに転送します。本番（`npm start`）ではExpressが `dist/` を同一オリジンで配信するため、単一サービスとして動作します。

### バックエンド (`server/`)

| ファイル | 役割 |
|------|------|
| `index.js` | Express アプリケーション、ルート定義、本番時は `dist/` の静的配信も兼ねる |
| `db.js` | SQLite の設定・テーブル作成・WALモード（`DATA_DIR` でDB保存先を変更可能） |
| `api/stocks.js` | Yahoo Finance からのデータ取得（1時間キャッシュ付き） |
| `api/trading.js` | アカウント/ポートフォリオのCRUD、売買ロジック |
| `engine/strategy.js` | テクニカル分析・自動取引の実行（銘柄分析は並列実行） |
| `scheduler.js` | 自動売買の定期実行 |
| `data/universe.js` | 東証全銘柄ユニバースの読み込み |

### データベース (`data/claude_stock.db`)

- `account`: 残高情報（単一行）
- `portfolio`: 銘柄ごとの保有状況
- `transactions`: 取引履歴
- `stock_cache`: 株価OHLCVキャッシュ（1時間有効）

## 環境変数 (`.env`)

| 変数 | デフォルト | 説明 |
|---|---|---|
| `PORT` | `3001` | バックエンドのポート |
| `DATA_DIR` | `data/` | SQLiteの保存先（Railway等の永続ボリューム用） |
| `AUTO_TRADE_SCHEDULE_ENABLED` | `true` | 自動売買の定期実行を有効化するか |
| `AUTO_TRADE_INTERVAL_MINUTES` | `60` | 定期実行の間隔（分） |
| `AUTO_TRADE_SCHEDULE_UNIVERSE` | `ALL_TSE` | 定期実行の対象（`ALL_TSE` または `DEFAULT_50`） |

Yahoo Finance はAPIキー不要で利用しています。

## デプロイ (Railway)

`railway.json` に基づき `npm run build` → `npm start` で単一サービスとして動作します。SQLiteを永続化するため、Railwayでボリュームを作成し `DATA_DIR` が指すパスにマウントしてください。

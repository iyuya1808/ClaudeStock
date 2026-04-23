import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'claude_stock.db');

// dataディレクトリがなければ作成
import fs from 'fs';
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// WALモード有効化（パフォーマンス向上）
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// テーブル作成
db.exec(`
  -- アカウント情報
  CREATE TABLE IF NOT EXISTS account (
    id INTEGER PRIMARY KEY,
    initial_balance REAL NOT NULL DEFAULT 100000,
    current_cash REAL NOT NULL DEFAULT 100000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ポートフォリオ（保有株）
  CREATE TABLE IF NOT EXISTS portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    shares INTEGER NOT NULL,
    avg_cost REAL NOT NULL,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol)
  );

  -- 売買履歴
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
    shares INTEGER NOT NULL,
    price REAL NOT NULL,
    total REAL NOT NULL,
    strategy TEXT,
    reason TEXT,
    pnl REAL DEFAULT 0,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 株価キャッシュ
  CREATE TABLE IF NOT EXISTS stock_cache (
    symbol TEXT NOT NULL,
    date TEXT NOT NULL,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume INTEGER,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(symbol, date)
  );
`);

// 初期アカウントが存在しなければ作成
const accountExists = db.prepare('SELECT COUNT(*) as count FROM account').get();
if (accountExists.count === 0) {
  db.prepare('INSERT INTO account (id, initial_balance, current_cash) VALUES (1, 100000, 100000)').run();
}

export default db;

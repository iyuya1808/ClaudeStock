import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

import db from './db.js';
import { fetchDailyData, getLatestPrice, searchSymbol } from './api/stocks.js';
import { getAccount, getPortfolio, getTransactions, buyStock, sellStock, getPortfolioSummary, getTradeStats, topUp } from './api/trading.js';
import { executeAutoTrade, analyzeStock, screenStocks } from './engine/strategy.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ===== 株価API =====

// 日次株価データ取得
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    const data = await fetchDailyData(req.params.symbol.toUpperCase());
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 最新株価取得
app.get('/api/stocks/:symbol/latest', async (req, res) => {
  try {
    const data = await getLatestPrice(req.params.symbol.toUpperCase());
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 銘柄検索
app.get('/api/search', async (req, res) => {
  try {
    const results = await searchSymbol(req.query.q || '');
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});


// ===== 取引API =====

// アカウント情報
app.get('/api/account', (req, res) => {
  try {
    const account = getAccount();
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ポートフォリオサマリー（現在価格込み）
app.get('/api/portfolio/summary', async (req, res) => {
  try {
    const summary = await getPortfolioSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ポートフォリオ（生データ）
app.get('/api/portfolio', (req, res) => {
  try {
    const portfolio = getPortfolio();
    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 株購入
app.post('/api/trade/buy', async (req, res) => {
  try {
    const { symbol, shares } = req.body;
    if (!symbol || !shares || shares <= 0) {
      return res.status(400).json({ success: false, error: '銘柄と株数を指定してください' });
    }
    const result = await buyStock(symbol, parseInt(shares), req.body.strategy, req.body.reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 株売却
app.post('/api/trade/sell', async (req, res) => {
  try {
    const { symbol, shares } = req.body;
    if (!symbol || !shares || shares <= 0) {
      return res.status(400).json({ success: false, error: '銘柄と株数を指定してください' });
    }
    const result = await sellStock(symbol, parseInt(shares), req.body.strategy, req.body.reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 取引履歴
app.get('/api/transactions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = getTransactions(limit, offset);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 取引統計
app.get('/api/stats', (req, res) => {
  try {
    const stats = getTradeStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===== 自動売買API =====

// 銘柄分析
app.get('/api/analyze/:symbol', async (req, res) => {
  try {
    const analysis = await analyzeStock(req.params.symbol.toUpperCase());
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 自動売買実行
app.post('/api/auto-trade', async (req, res) => {
  try {
    // 空配列 or 未指定の場合はデフォルトユニバース（50銘柄）を使用
    const reqSymbols = req.body?.symbols;
    const symbols = Array.isArray(reqSymbols) && reqSymbols.length > 0 ? reqSymbols : undefined;
    const results = await executeAutoTrade(symbols);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 割安株スクリーニング
app.get('/api/screen', async (req, res) => {
  try {
    let symbols;
    if (req.query.symbols) {
      symbols = req.query.symbols
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);
    }
    // symbols が未指定なら screenStocks 内でデフォルトユニバースを使用
    const results = await screenStocks(symbols);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===== アカウントチャージ =====
app.post('/api/topup', (req, res) => {
  try {
    const amount = req.body.amount || 100000;
    const account = topUp(amount);
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===== アカウントリセット =====
app.post('/api/reset', (req, res) => {
  try {
    db.exec(`
      DELETE FROM portfolio;
      DELETE FROM transactions;
      UPDATE account SET current_cash = initial_balance, updated_at = CURRENT_TIMESTAMP WHERE id = 1;
    `);
    res.json({ success: true, message: 'アカウントがリセットされました' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Claude Stock Server running on http://localhost:${PORT}`);
});

import db from '../db.js';
import { getLatestPrice } from './stocks.js';

// アカウント情報取得
function getAccount() {
  return db.prepare('SELECT * FROM account WHERE id = 1').get();
}

// ポートフォリオ取得
function getPortfolio() {
  return db.prepare('SELECT * FROM portfolio ORDER BY symbol').all();
}

// 取引履歴取得
function getTransactions(limit = 50, offset = 0) {
  const transactions = db.prepare(
    'SELECT * FROM transactions ORDER BY executed_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  return { transactions, total: total.count };
}

// 株を購入
async function buyStock(symbol, shares, strategy = 'MANUAL', reason = '') {
  symbol = symbol.toUpperCase();
  const account = getAccount();
  const priceData = await getLatestPrice(symbol);
  const price = priceData.price;
  const total = price * shares;

  if (total > account.current_cash) {
    throw new Error(`資金不足です。必要: $${total.toFixed(2)}, 残高: $${account.current_cash.toFixed(2)}`);
  }

  const buyTransaction = db.transaction(() => {
    // 現金を減らす
    db.prepare('UPDATE account SET current_cash = current_cash - ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(total);

    // ポートフォリオ更新（既存ポジションがあれば平均取得単価を更新）
    const existing = db.prepare('SELECT * FROM portfolio WHERE symbol = ?').get(symbol);
    if (existing) {
      const newShares = existing.shares + shares;
      const newAvgCost = ((existing.avg_cost * existing.shares) + total) / newShares;
      db.prepare('UPDATE portfolio SET shares = ?, avg_cost = ? WHERE symbol = ?').run(newShares, newAvgCost, symbol);
    } else {
      db.prepare('INSERT INTO portfolio (symbol, shares, avg_cost) VALUES (?, ?, ?)').run(symbol, shares, price);
    }

    // 取引履歴に記録
    db.prepare(
      'INSERT INTO transactions (symbol, type, shares, price, total, strategy, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(symbol, 'BUY', shares, price, total, strategy, reason);
  });

  buyTransaction();

  return {
    type: 'BUY',
    symbol,
    shares,
    price,
    total,
    strategy,
    reason,
    remainingCash: getAccount().current_cash,
  };
}

// 株を売却
async function sellStock(symbol, shares, strategy = 'MANUAL', reason = '') {
  symbol = symbol.toUpperCase();
  const portfolio = db.prepare('SELECT * FROM portfolio WHERE symbol = ?').get(symbol);

  if (!portfolio) {
    throw new Error(`${symbol}は保有していません`);
  }
  if (portfolio.shares < shares) {
    throw new Error(`売却可能株数を超えています。保有: ${portfolio.shares}株, 売却: ${shares}株`);
  }

  const priceData = await getLatestPrice(symbol);
  const price = priceData.price;
  const total = price * shares;
  const pnl = (price - portfolio.avg_cost) * shares;

  const sellTransaction = db.transaction(() => {
    // 現金を増やす
    db.prepare('UPDATE account SET current_cash = current_cash + ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(total);

    // ポートフォリオ更新
    const remainingShares = portfolio.shares - shares;
    if (remainingShares === 0) {
      db.prepare('DELETE FROM portfolio WHERE symbol = ?').run(symbol);
    } else {
      db.prepare('UPDATE portfolio SET shares = ? WHERE symbol = ?').run(remainingShares, symbol);
    }

    // 取引履歴に記録（損益付き）
    db.prepare(
      'INSERT INTO transactions (symbol, type, shares, price, total, strategy, reason, pnl) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(symbol, 'SELL', shares, price, total, strategy, reason, pnl);
  });

  sellTransaction();

  return {
    type: 'SELL',
    symbol,
    shares,
    price,
    total,
    pnl,
    strategy,
    reason,
    remainingCash: getAccount().current_cash,
  };
}

// ポートフォリオサマリー（現在価格込み）
async function getPortfolioSummary() {
  const account = getAccount();
  const positions = getPortfolio();
  let totalMarketValue = 0;
  let totalCost = 0;

  const enrichedPositions = [];
  for (const pos of positions) {
    try {
      const priceData = await getLatestPrice(pos.symbol);
      const marketValue = priceData.price * pos.shares;
      const cost = pos.avg_cost * pos.shares;
      const pnl = marketValue - cost;
      const pnlPercent = ((priceData.price - pos.avg_cost) / pos.avg_cost) * 100;

      totalMarketValue += marketValue;
      totalCost += cost;

      enrichedPositions.push({
        ...pos,
        currentPrice: priceData.price,
        marketValue,
        cost,
        pnl,
        pnlPercent,
        priceDate: priceData.date,
      });
    } catch (error) {
      // 価格取得失敗時はキャッシュデータで計算
      enrichedPositions.push({
        ...pos,
        currentPrice: pos.avg_cost,
        marketValue: pos.avg_cost * pos.shares,
        cost: pos.avg_cost * pos.shares,
        pnl: 0,
        pnlPercent: 0,
        priceDate: 'N/A',
        error: error.message,
      });
    }
  }

  const totalAssets = account.current_cash + totalMarketValue;
  const totalPnl = totalAssets - account.initial_balance;
  const totalPnlPercent = (totalPnl / account.initial_balance) * 100;

  return {
    account: {
      ...account,
      totalMarketValue,
      totalAssets,
      totalPnl,
      totalPnlPercent,
    },
    positions: enrichedPositions,
  };
}

// 取引統計
function getTradeStats() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as totalTrades,
      SUM(CASE WHEN type = 'BUY' THEN 1 ELSE 0 END) as totalBuys,
      SUM(CASE WHEN type = 'SELL' THEN 1 ELSE 0 END) as totalSells,
      SUM(CASE WHEN type = 'SELL' AND pnl > 0 THEN 1 ELSE 0 END) as profitableSells,
      SUM(CASE WHEN type = 'SELL' AND pnl <= 0 THEN 1 ELSE 0 END) as losingSells,
      SUM(CASE WHEN type = 'SELL' THEN pnl ELSE 0 END) as totalRealizedPnl,
      AVG(CASE WHEN type = 'SELL' THEN pnl ELSE NULL END) as avgPnlPerSell
    FROM transactions
  `).get();

  const winRate = stats.totalSells > 0 
    ? (stats.profitableSells / stats.totalSells * 100).toFixed(1) 
    : '0.0';

  return { ...stats, winRate };
}

export { getAccount, getPortfolio, getTransactions, buyStock, sellStock, getPortfolioSummary, getTradeStats };

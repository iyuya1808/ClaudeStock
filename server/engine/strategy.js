import db from '../db.js';
import { fetchDailyData, getLatestPrice } from '../api/stocks.js';
import { buyStock, sellStock, getAccount, getPortfolio } from '../api/trading.js';

// テクニカル指標計算
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < period; i++) {
    const diff = prices[i] - prices[i + 1]; // 新しい方が先（descending order）
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// 売買シグナル生成
function generateSignals(data) {
  if (data.length < 50) return { signal: 'HOLD', reason: 'データ不足（50日分必要）', indicators: {} };

  const closes = data.map(d => d.close);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const rsi = calculateRSI(closes, 14);
  const currentPrice = closes[0];
  const prevPrice = closes[1];

  const indicators = {
    currentPrice,
    sma20: sma20 ? parseFloat(sma20.toFixed(2)) : null,
    sma50: sma50 ? parseFloat(sma50.toFixed(2)) : null,
    rsi: rsi ? parseFloat(rsi.toFixed(2)) : null,
    priceChange: parseFloat(((currentPrice - prevPrice) / prevPrice * 100).toFixed(2)),
  };

  // シグナルロジック
  let signal = 'HOLD';
  let reason = '';
  let confidence = 0;

  // SMAクロスオーバー戦略
  if (sma20 && sma50) {
    if (sma20 > sma50 && currentPrice > sma20) {
      signal = 'BUY';
      reason = 'SMA20がSMA50を上回り、価格がSMA20より上（上昇トレンド）';
      confidence += 30;
    } else if (sma20 < sma50 && currentPrice < sma20) {
      signal = 'SELL';
      reason = 'SMA20がSMA50を下回り、価格がSMA20より下（下降トレンド）';
      confidence += 30;
    }
  }

  // RSI戦略
  if (rsi !== null) {
    if (rsi < 30) {
      if (signal !== 'SELL') {
        signal = 'BUY';
        reason += (reason ? ' + ' : '') + `RSI過売り圏 (${rsi.toFixed(1)})`;
        confidence += 25;
      }
    } else if (rsi > 70) {
      if (signal !== 'BUY') {
        signal = 'SELL';
        reason += (reason ? ' + ' : '') + `RSI過買い圏 (${rsi.toFixed(1)})`;
        confidence += 25;
      }
    }
  }

  if (!reason) {
    reason = '現在明確なシグナルなし。市場を観察中。';
  }

  return {
    signal,
    reason,
    confidence: Math.min(confidence, 100),
    indicators,
  };
}

// 自動売買実行
async function executeAutoTrade(symbols = ['7203.T', '6758.T', '9984.T', '7974.T', '6861.T']) {
  const results = [];
  const account = getAccount();
  const portfolio = getPortfolio();

  for (const symbol of symbols) {
    try {
      const data = await fetchDailyData(symbol);
      const analysis = generateSignals(data);

      let action = null;

      if (analysis.signal === 'BUY' && analysis.confidence >= 30) {
        // ポジションサイズ: 残高の10%まで
        const maxInvestment = account.current_cash * 0.1;
        const currentPrice = analysis.indicators.currentPrice;
        const shares = Math.floor(maxInvestment / currentPrice);

        if (shares > 0 && maxInvestment >= currentPrice) {
          try {
            action = await buyStock(symbol, shares, 'AUTO_SMA_RSI', analysis.reason);
          } catch (e) {
            action = { error: e.message };
          }
        }
      } else if (analysis.signal === 'SELL' && analysis.confidence >= 30) {
        // 保有していれば全株売却
        const position = portfolio.find(p => p.symbol === symbol);
        if (position) {
          try {
            action = await sellStock(symbol, position.shares, 'AUTO_SMA_RSI', analysis.reason);
          } catch (e) {
            action = { error: e.message };
          }
        }
      }

      results.push({
        symbol,
        analysis,
        action,
      });
    } catch (error) {
      results.push({
        symbol,
        error: error.message,
      });
    }
  }

  return results;
}

// 特定銘柄の分析のみ（売買なし）
async function analyzeStock(symbol) {
  const data = await fetchDailyData(symbol);
  const analysis = generateSignals(data);
  return {
    symbol,
    ...analysis,
    dataPoints: data.length,
    latestDate: data[0]?.date,
  };
}

export { generateSignals, executeAutoTrade, analyzeStock };

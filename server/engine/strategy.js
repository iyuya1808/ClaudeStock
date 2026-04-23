import db from '../db.js';
import { fetchDailyData, getLatestPrice, getStockFundamentals } from '../api/stocks.js';
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

// ===== バリュースコア計算 (stock_skills の indicators.py を移植) =====

function _scorePER(per, perMax = 15.0) {
  if (per === null || per <= 0) return 0;
  if (per >= perMax * 2) return 0;
  return Math.max(0, 25 * (1 - per / (perMax * 2)));
}

function _scorePBR(pbr, pbrMax = 1.0) {
  if (pbr === null || pbr <= 0) return 0;
  if (pbr >= pbrMax * 2) return 0;
  return Math.max(0, 25 * (1 - pbr / (pbrMax * 2)));
}

function _scoreDividend(dividendYield, divMin = 0.03) {
  if (dividendYield === null || dividendYield <= 0) return 0;
  const cap = divMin * 3;
  const ratio = Math.min(dividendYield / cap, 1.0);
  return 20 * ratio;
}

function _scoreROE(roe, roeMin = 0.08) {
  if (roe === null || roe <= 0) return 0;
  const cap = roeMin * 3;
  const ratio = Math.min(roe / cap, 1.0);
  return 15 * ratio;
}

function _scoreGrowth(revenueGrowth) {
  if (revenueGrowth === null || revenueGrowth <= 0) return 0;
  const cap = 0.30;
  const ratio = Math.min(revenueGrowth / cap, 1.0);
  return 15 * ratio;
}

// 割安度スコア (0-100点)
// PER: 25pt / PBR: 25pt / 配当利回り: 20pt / ROE: 15pt / 売上成長率: 15pt
function calculateValueScore(fundamentals) {
  if (!fundamentals) return null;
  const { per, pbr, dividendYield, roe, revenueGrowth } = fundamentals;
  const total =
    _scorePER(per) +
    _scorePBR(pbr) +
    _scoreDividend(dividendYield) +
    _scoreROE(roe) +
    _scoreGrowth(revenueGrowth);
  return Math.round(Math.min(total, 100) * 100) / 100;
}

// 売買シグナル生成
function generateSignals(data, fundamentals = null) {
  if (data.length < 50) return { signal: 'HOLD', reason: 'データ不足（50日分必要）', indicators: {} };

  const closes = data.map(d => d.close);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const rsi = calculateRSI(closes, 14);
  const currentPrice = closes[0];
  const prevPrice = closes[1];

  const valueScore = calculateValueScore(fundamentals);

  const indicators = {
    currentPrice,
    sma20: sma20 ? parseFloat(sma20.toFixed(2)) : null,
    sma50: sma50 ? parseFloat(sma50.toFixed(2)) : null,
    rsi: rsi ? parseFloat(rsi.toFixed(2)) : null,
    priceChange: parseFloat(((currentPrice - prevPrice) / prevPrice * 100).toFixed(2)),
    valueScore: valueScore !== null ? parseFloat(valueScore.toFixed(1)) : null,
    fundamentals: fundamentals || null,
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

  // バリュースコアによる信頼度調整
  if (valueScore !== null) {
    if (signal === 'BUY') {
      if (valueScore >= 60) {
        confidence += 20;
        reason += ` + 割安度高 (${valueScore.toFixed(0)}pt)`;
      } else if (valueScore < 30) {
        confidence -= 15;
      }
    }
  }

  if (!reason) {
    reason = '現在明確なシグナルなし。市場を観察中。';
  }

  return {
    signal,
    reason,
    confidence: Math.min(Math.max(confidence, 0), 100),
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
      const [data, fundamentals] = await Promise.all([
        fetchDailyData(symbol),
        getStockFundamentals(symbol),
      ]);
      const analysis = generateSignals(data, fundamentals);

      let action = null;

      if (analysis.signal === 'BUY' && analysis.confidence >= 30) {
        const maxInvestment = account.current_cash * 0.1;
        const currentPrice = analysis.indicators.currentPrice;
        const shares = Math.floor(maxInvestment / currentPrice);

        if (shares > 0 && maxInvestment >= currentPrice) {
          try {
            action = await buyStock(symbol, shares, 'AUTO_SMA_RSI_VALUE', analysis.reason);
          } catch (e) {
            action = { error: e.message };
          }
        }
      } else if (analysis.signal === 'SELL' && analysis.confidence >= 30) {
        const position = portfolio.find(p => p.symbol === symbol);
        if (position) {
          try {
            action = await sellStock(symbol, position.shares, 'AUTO_SMA_RSI_VALUE', analysis.reason);
          } catch (e) {
            action = { error: e.message };
          }
        }
      }

      results.push({ symbol, analysis, action });
    } catch (error) {
      results.push({ symbol, error: error.message });
    }
  }

  return results;
}

// 特定銘柄の分析のみ（売買なし）
async function analyzeStock(symbol) {
  const [data, fundamentals] = await Promise.all([
    fetchDailyData(symbol),
    getStockFundamentals(symbol),
  ]);
  const analysis = generateSignals(data, fundamentals);
  return {
    symbol,
    name: fundamentals.name || symbol,
    ...analysis,
    dataPoints: data.length,
    latestDate: data[0]?.date,
  };
}

// 複数銘柄をバリュースコアでスクリーニング
async function screenStocks(symbols) {
  const results = [];

  for (const symbol of symbols) {
    try {
      const [data, fundamentals] = await Promise.all([
        fetchDailyData(symbol),
        getStockFundamentals(symbol),
      ]);
      const analysis = generateSignals(data, fundamentals);
      const valueScore = calculateValueScore(fundamentals);

      results.push({
        symbol,
        name: fundamentals.name || symbol,
        signal: analysis.signal,
        confidence: analysis.confidence,
        reason: analysis.reason,
        valueScore,
        fundamentals,
        indicators: analysis.indicators,
      });
    } catch (error) {
      results.push({ symbol, error: error.message, valueScore: null });
    }
  }

  // バリュースコア降順でソート
  results.sort((a, b) => (b.valueScore ?? -1) - (a.valueScore ?? -1));
  return results;
}

export { generateSignals, executeAutoTrade, analyzeStock, screenStocks, calculateValueScore };

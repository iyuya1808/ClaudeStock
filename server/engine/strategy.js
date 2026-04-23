import { fetchDailyData, getStockFundamentals } from '../api/stocks.js';
import { buyStock, sellStock, getAccount, getPortfolio, getTransactions } from '../api/trading.js';

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

const COOLDOWN_DAYS = 3;
const AUTO_TRADE_CONFIDENCE_THRESHOLD = 40;

// 信頼度・バリュースコアから買い投資割合を算出 (5%〜25%)
function calcBuyRatio(confidence, valueScore) {
  // 信頼度 40→5%, 60→12%, 80→20%, 100→25%
  const baseRatio = 0.05 + ((confidence - 40) / 60) * 0.20;
  let ratio = Math.min(Math.max(baseRatio, 0.05), 0.25);

  // バリュースコアが高ければ上乗せ（最大+5%）
  if (valueScore !== null && valueScore >= 60) {
    ratio += 0.05 * ((valueScore - 60) / 40);
  }

  return Math.min(ratio, 0.30);
}

// 信頼度から売却割合を算出 (40%〜100%)
function calcSellRatio(confidence) {
  // 信頼度 40→40%, 70→70%, 100→100%
  const ratio = 0.40 + ((confidence - 40) / 60) * 0.60;
  return Math.min(Math.max(ratio, 0.40), 1.0);
}

// 銘柄ごとの最終取引日時をチェックしてクールダウン中かどうか判定
function isInCooldown(symbol, recentTxns) {
  const lastTxn = recentTxns.find(t => t.symbol === symbol);
  if (!lastTxn) return { inCooldown: false };

  const lastDate = new Date(lastTxn.executed_at + 'Z'); // UTCとして扱う
  const elapsed = Date.now() - lastDate.getTime();
  const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  if (elapsed < cooldownMs) {
    const daysAgo = (elapsed / (24 * 60 * 60 * 1000)).toFixed(1);
    return {
      inCooldown: true,
      reason: `クールダウン中（${daysAgo}日前に${lastTxn.type === 'BUY' ? '購入' : '売却'}済み、${COOLDOWN_DAYS}日間は再取引しない）`,
    };
  }
  return { inCooldown: false };
}

// デフォルトのスクリーニング対象銘柄（日本株ユニバース）
const DEFAULT_UNIVERSE = [
  '7203.T', '6758.T', '9984.T', '7974.T', '6861.T',
  '8306.T', '9432.T', '6501.T', '4063.T', '6902.T',
  '9983.T', '8035.T', '6594.T', '4519.T', '7832.T',
];

// 自動売買実行
async function executeAutoTrade(symbols = DEFAULT_UNIVERSE) {
  const results = [];
  const account = getAccount();
  const portfolio = getPortfolio();

  // 直近100件の取引履歴を取得してクールダウン判定に使う
  const { transactions: recentTxns } = getTransactions(100, 0);

  for (const symbol of symbols) {
    try {
      const [data, fundamentals] = await Promise.all([
        fetchDailyData(symbol),
        getStockFundamentals(symbol),
      ]);
      const analysis = generateSignals(data, fundamentals);
      const position = portfolio.find(p => p.symbol === symbol);

      let action = null;
      let skipped = null;

      // クールダウンチェック（BUY/SELL 共通）
      const cooldown = isInCooldown(symbol, recentTxns);
      if (cooldown.inCooldown) {
        skipped = cooldown.reason;
      } else if (analysis.signal === 'BUY' && analysis.confidence >= AUTO_TRADE_CONFIDENCE_THRESHOLD) {
        if (position) {
          // 既に保有中はスキップ（ナンピン買い防止）
          skipped = `既に${position.shares}株保有中のためスキップ`;
        } else {
          const valueScore = analysis.indicators.valueScore;
          const buyRatio = calcBuyRatio(analysis.confidence, valueScore);
          const maxInvestment = account.current_cash * buyRatio;
          const currentPrice = analysis.indicators.currentPrice;
          const shares = Math.floor(maxInvestment / currentPrice);
          const ratioPercent = (buyRatio * 100).toFixed(0);

          if (shares > 0 && maxInvestment >= currentPrice) {
            try {
              action = await buyStock(symbol, shares, 'AUTO_SMA_RSI_VALUE',
                `${analysis.reason}（信頼度${analysis.confidence}% → 現金の${ratioPercent}%を投資）`);
              account.current_cash = action.remainingCash;
            } catch (e) {
              action = { error: e.message };
            }
          } else {
            skipped = '購入可能株数が0（資金不足）';
          }
        }
      } else if (analysis.signal === 'SELL' && analysis.confidence >= AUTO_TRADE_CONFIDENCE_THRESHOLD) {
        if (!position) {
          skipped = '保有なしのためスキップ';
        } else {
          const sellRatio = calcSellRatio(analysis.confidence);
          const sharesToSell = Math.max(1, Math.floor(position.shares * sellRatio));
          const ratioPercent = (sellRatio * 100).toFixed(0);
          try {
            action = await sellStock(symbol, sharesToSell, 'AUTO_SMA_RSI_VALUE',
              `${analysis.reason}（信頼度${analysis.confidence}% → 保有の${ratioPercent}%を売却）`);
            account.current_cash = action.remainingCash;
          } catch (e) {
            action = { error: e.message };
          }
        }
      } else if (analysis.signal === 'HOLD' || analysis.confidence < AUTO_TRADE_CONFIDENCE_THRESHOLD) {
        skipped = `シグナル弱いためスキップ（${analysis.signal} / 信頼度${analysis.confidence}%）`;
      }

      results.push({ symbol, analysis, action, skipped });
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

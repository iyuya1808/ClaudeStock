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

  // SMAクロスオーバー戦略（基礎信頼度 35%）
  if (sma20 && sma50) {
    if (sma20 > sma50 && currentPrice > sma20) {
      signal = 'BUY';
      reason = 'SMA20がSMA50を上回り、価格がSMA20より上（上昇トレンド）';
      confidence += 35;
    } else if (sma20 < sma50 && currentPrice < sma20) {
      signal = 'SELL';
      reason = 'SMA20がSMA50を下回り、価格がSMA20より下（下降トレンド）';
      confidence += 35;
    }
  }

  // RSI戦略（過売り/過買い: +25、中立域でもシグナル補強: +10）
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
    } else if (signal === 'BUY' && rsi < 50) {
      // RSI50以下で買いシグナルと一致 → まだ上昇余地あり
      confidence += 10;
      reason += ` + RSI中立域下位 (${rsi.toFixed(1)})`;
    } else if (signal === 'SELL' && rsi > 50) {
      // RSI50以上で売りシグナルと一致 → 過熱気味
      confidence += 10;
      reason += ` + RSI中立域上位 (${rsi.toFixed(1)})`;
    }
  }

  // 価格モメンタムによる信頼度補強
  if (signal === 'BUY' && indicators.priceChange > 0.5) {
    confidence += 5;
    reason += ` + 直近上昇 (${indicators.priceChange.toFixed(1)}%)`;
  } else if (signal === 'SELL' && indicators.priceChange < -0.5) {
    confidence += 5;
    reason += ` + 直近下落 (${indicators.priceChange.toFixed(1)}%)`;
  }

  // バリュースコアによる信頼度調整
  if (valueScore !== null) {
    if (signal === 'BUY') {
      if (valueScore >= 60) {
        confidence += 20;
        reason += ` + 割安度高 (${valueScore.toFixed(0)}pt)`;
      } else if (valueScore >= 40) {
        confidence += 10;
        reason += ` + 割安度中 (${valueScore.toFixed(0)}pt)`;
      } else if (valueScore < 30) {
        confidence -= 10;
      }
    } else if (signal === 'SELL') {
      if (valueScore < 30) {
        confidence += 10;
        reason += ` + 割高 (${valueScore.toFixed(0)}pt)`;
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

const COOLDOWN_DAYS_DEFAULT = 2;
const AUTO_TRADE_CONFIDENCE_THRESHOLD = 40;
// 高信頼度ならクールダウンを短縮/無視するための閾値
const COOLDOWN_OVERRIDE_CONFIDENCE = 70;  // この信頼度以上ならクールダウン無視
const COOLDOWN_REDUCE_CONFIDENCE = 60;    // この信頼度以上ならクールダウン1日に短縮
const MIN_INVESTMENT_YEN = 10000;         // 最低投資額（円）

// 信頼度・バリュースコアから買い投資割合を算出 (10%〜40%)
function calcBuyRatio(confidence, valueScore) {
  // 信頼度 40→10%, 60→20%, 80→30%, 100→40%
  const baseRatio = 0.10 + ((confidence - 40) / 60) * 0.30;
  let ratio = Math.min(Math.max(baseRatio, 0.10), 0.40);

  // バリュースコアが高ければ上乗せ（最大+10%）
  if (valueScore !== null && valueScore >= 60) {
    ratio += 0.10 * ((valueScore - 60) / 40);
  }

  return Math.min(ratio, 0.50);
}

// 信頼度から売却割合を算出 (40%〜100%)
function calcSellRatio(confidence) {
  // 信頼度 40→40%, 70→70%, 100→100%
  const ratio = 0.40 + ((confidence - 40) / 60) * 0.60;
  return Math.min(Math.max(ratio, 0.40), 1.0);
}

// 銘柄ごとの最終取引日時をチェックしてクールダウン中かどうか判定
// 高信頼度のシグナルではクールダウンを短縮/無視して急変に対応
function isInCooldown(symbol, recentTxns, confidence = 0) {
  const lastTxn = recentTxns.find(t => t.symbol === symbol);
  if (!lastTxn) return { inCooldown: false };

  const lastDate = new Date(lastTxn.executed_at + 'Z'); // UTCとして扱う
  const elapsed = Date.now() - lastDate.getTime();
  const daysElapsed = elapsed / (24 * 60 * 60 * 1000);

  // 信頼度に応じてクールダウン期間を動的に決定
  let effectiveCooldownDays;
  if (confidence >= COOLDOWN_OVERRIDE_CONFIDENCE) {
    // 信頼度70%以上: クールダウン無視（急変対応）
    effectiveCooldownDays = 0;
  } else if (confidence >= COOLDOWN_REDUCE_CONFIDENCE) {
    // 信頼度60%以上: クールダウン1日に短縮
    effectiveCooldownDays = 1;
  } else {
    // 通常: デフォルトのクールダウン
    effectiveCooldownDays = COOLDOWN_DAYS_DEFAULT;
  }

  if (daysElapsed < effectiveCooldownDays) {
    const daysAgoStr = daysElapsed.toFixed(1);
    let msg = `クールダウン中（${daysAgoStr}日前に${lastTxn.type === 'BUY' ? '購入' : '売却'}済み`;
    if (effectiveCooldownDays < COOLDOWN_DAYS_DEFAULT) {
      msg += `、信頼度${confidence}%で短縮適用中、残り${(effectiveCooldownDays - daysElapsed).toFixed(1)}日）`;
    } else {
      msg += `、${effectiveCooldownDays}日間は再取引しない）`;
    }
    return { inCooldown: true, reason: msg };
  }
  return { inCooldown: false };
}

// デフォルトのスクリーニング対象銘柄（日本株ユニバース）
// セクター別に主要銘柄を幅広くカバー（約50銘柄）
const DEFAULT_UNIVERSE = [
  // === 自動車・輸送機器 ===
  '7203.T',  // トヨタ自動車
  '7267.T',  // ホンダ
  '7261.T',  // マツダ
  '7269.T',  // スズキ
  '7201.T',  // 日産自動車

  // === 電機・精密機器 ===
  '6758.T',  // ソニーグループ
  '6501.T',  // 日立製作所
  '6503.T',  // 三菱電機
  '6752.T',  // パナソニック
  '6861.T',  // キーエンス
  '6902.T',  // デンソー

  // === 半導体・電子部品 ===
  '8035.T',  // 東京エレクトロン
  '6594.T',  // ニデック（日本電産）
  '6723.T',  // ルネサスエレクトロニクス
  '6857.T',  // アドバンテスト
  '6146.T',  // ディスコ
  '6762.T',  // TDK
  '6981.T',  // 村田製作所

  // === 通信・IT ===
  '9432.T',  // NTT（日本電信電話）
  '9433.T',  // KDDI
  '9434.T',  // ソフトバンク
  '9984.T',  // ソフトバンクグループ
  '4689.T',  // Zホールディングス (LINEヤフー)
  '4755.T',  // 楽天グループ

  // === 金融（銀行・保険・証券） ===
  '8306.T',  // 三菱UFJフィナンシャル・グループ
  '8316.T',  // 三井住友フィナンシャルグループ
  '8411.T',  // みずほフィナンシャルグループ
  '8766.T',  // 東京海上ホールディングス
  '8591.T',  // オリックス

  // === 素材・化学 ===
  '4063.T',  // 信越化学工業
  '4188.T',  // 三菱ケミカルグループ
  '3407.T',  // 旭化成

  // === 医薬品・ヘルスケア ===
  '4519.T',  // 中外製薬
  '4502.T',  // 武田薬品工業
  '4568.T',  // 第一三共
  '4523.T',  // エーザイ

  // === 食品・消費財 ===
  '2914.T',  // 日本たばこ産業 (JT)
  '2802.T',  // 味の素
  '4452.T',  // 花王

  // === 小売・サービス ===
  '9983.T',  // ファーストリテイリング
  '7974.T',  // 任天堂
  '7832.T',  // バンダイナムコ
  '3382.T',  // セブン&アイ・ホールディングス

  // === 不動産・建設 ===
  '8801.T',  // 三井不動産
  '8802.T',  // 三菱地所

  // === 運輸・インフラ ===
  '9020.T',  // JR東日本
  '9022.T',  // JR東海

  // === 商社 ===
  '8058.T',  // 三菱商事
  '8031.T',  // 三井物産
  '8001.T',  // 伊藤忠商事
];

// 自動売買実行
async function executeAutoTrade(symbols = DEFAULT_UNIVERSE) {
  const results = [];
  const account = getAccount();
  const portfolio = getPortfolio();

  // 直近100件の取引履歴を取得してクールダウン判定に使う
  const { transactions: recentTxns } = getTransactions(100, 0);

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    // Yahoo Finance のレート制限対策: 銘柄間に間隔を空ける（50銘柄対応）
    if (i > 0) await new Promise(r => setTimeout(r, 500));

    try {
      const [data, fundamentals] = await Promise.all([
        fetchDailyData(symbol),
        getStockFundamentals(symbol),
      ]);
      const analysis = generateSignals(data, fundamentals);
      const position = portfolio.find(p => p.symbol === symbol);

      let action = null;
      let skipped = null;

      // クールダウンチェック（信頼度に応じて動的に判定）
      const cooldown = isInCooldown(symbol, recentTxns, analysis.confidence);
      if (cooldown.inCooldown) {
        skipped = cooldown.reason;
      } else if (analysis.signal === 'BUY' && analysis.confidence >= AUTO_TRADE_CONFIDENCE_THRESHOLD) {
        if (position) {
          // 既に保有中はスキップ（ナンピン買い防止）
          skipped = `既に${position.shares}株保有中のためスキップ`;
        } else {
          const valueScore = analysis.indicators.valueScore;
          const buyRatio = calcBuyRatio(analysis.confidence, valueScore);
          const currentPrice = analysis.indicators.currentPrice;

          // 投資額 = max(現金×比率, 最低投資額) ただし現金を超えない
          const ratioInvestment = account.current_cash * buyRatio;
          const maxInvestment = Math.min(
            Math.max(ratioInvestment, MIN_INVESTMENT_YEN),
            account.current_cash * 0.90  // 全資金の90%を上限にして最低限の現金を残す
          );
          const shares = Math.floor(maxInvestment / currentPrice);
          const actualInvestment = shares * currentPrice;
          const actualPercent = (actualInvestment / account.current_cash * 100).toFixed(0);

          if (shares > 0 && account.current_cash >= currentPrice) {
            try {
              action = await buyStock(symbol, shares, 'AUTO_SMA_RSI_VALUE',
                `${analysis.reason}（信頼度${analysis.confidence}% → ${shares}株×¥${Math.round(currentPrice).toLocaleString()} = ¥${Math.round(actualInvestment).toLocaleString()}、現金の${actualPercent}%）`);
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
              `${analysis.reason}（信頼度${analysis.confidence}% → ${sharesToSell}/${position.shares}株、保有の${ratioPercent}%を売却）`);
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
async function screenStocks(symbols = DEFAULT_UNIVERSE) {
  const results = [];

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (i > 0) await new Promise(r => setTimeout(r, 500));
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

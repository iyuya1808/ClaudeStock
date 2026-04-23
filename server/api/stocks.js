import YahooFinanceClass from 'yahoo-finance2';
import db from '../db.js';

const yahooFinance = new YahooFinanceClass();

// レート制限管理 (Yahoo Financeはゆるめですが一応)
let requestCount = 0;
let lastResetTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 20; // 少し多めに設定

function checkRateLimit() {
  const now = Date.now();
  if (now - lastResetTime > 60000) {
    requestCount = 0;
    lastResetTime = now;
  }
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    throw new Error('レート制限: しばらく待ってからお試しください。');
  }
}

// Yahoo Financeから日次株価データ取得
async function fetchDailyData(symbol) {
  // シンボルが数字のみの場合は .T を付与 (日本株)
  if (/^\d{4}$/.test(symbol)) {
    symbol = `${symbol}.T`;
  }
  
  // まずキャッシュをチェック
  const today = new Date().toISOString().split('T')[0];
  const cached = db.prepare(
    "SELECT * FROM stock_cache WHERE symbol = ? AND date = ? AND cached_at > datetime('now', '-1 hour')"
  ).get(symbol, today);

  if (cached) {
    const allCached = db.prepare(
      'SELECT * FROM stock_cache WHERE symbol = ? ORDER BY date DESC LIMIT 100'
    ).all(symbol);
    return allCached;
  }

  checkRateLimit();
  requestCount++;

  try {
    console.log(`Fetching data from Yahoo Finance for ${symbol}...`);
    
    // 直近半年分のデータを取得
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const result = await yahooFinance.chart(symbol, {
      period1: startDate,
      interval: '1d'
    });

    if (!result || !result.quotes || result.quotes.length === 0) {
      throw new Error('株価データが見つかりませんでした。');
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO stock_cache (symbol, date, open, high, low, close, volume)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((quotes) => {
      for (const entry of quotes) {
        if (!entry.date || entry.close === undefined) continue;
        const dateStr = new Date(entry.date).toISOString().split('T')[0];
        insertStmt.run(
          symbol,
          dateStr,
          entry.open ?? entry.close,
          entry.high ?? entry.close,
          entry.low ?? entry.close,
          entry.close,
          entry.volume ?? 0
        );
      }
    });

    insertMany(result.quotes);

    return db.prepare(
      'SELECT * FROM stock_cache WHERE symbol = ? ORDER BY date DESC LIMIT 100'
    ).all(symbol);
  } catch (error) {
    console.error(`Yahoo Finance Error for ${symbol}:`, error.message);
    const fallback = db.prepare(
      'SELECT * FROM stock_cache WHERE symbol = ? ORDER BY date DESC LIMIT 100'
    ).all(symbol);
    if (fallback.length > 0) {
      return fallback;
    }
    throw new Error(`株価データの取得に失敗しました (${symbol}): ${error.message}`);
  }
}

// 株価のクイック取得（最新の終値）
async function getLatestPrice(symbol) {
  if (/^\d{4}$/.test(symbol)) {
    symbol = `${symbol}.T`;
  }
  
  try {
    const quote = await yahooFinance.quote(symbol);
    return {
      symbol,
      name: quote.longName || quote.shortName || symbol,
      price: quote.regularMarketPrice,
      date: new Date(quote.regularMarketTime).toISOString().split('T')[0],
      open: quote.regularMarketOpen,
      high: quote.regularMarketDayHigh,
      low: quote.regularMarketDayLow,
      volume: quote.regularMarketVolume,
    };
  } catch (e) {
    // quoteが失敗した場合はhistoricalから取得を試みる
    const data = await fetchDailyData(symbol);
    if (data.length === 0) {
      throw new Error(`${symbol}の株価データが見つかりません`);
    }
    return {
      symbol,
      price: data[0].close,
      date: data[0].date,
      open: data[0].open,
      high: data[0].high,
      low: data[0].low,
      volume: data[0].volume,
    };
  }
}

// 銘柄検索
async function searchSymbol(keywords) {
  try {
    const result = await yahooFinance.search(keywords);
    return result.quotes.map(q => ({
      symbol: q.symbol,
      name: q.longname || q.shortname,
      type: q.quoteType,
      region: q.region,
      currency: q.currency,
    }));
  } catch (error) {
    return [];
  }
}

// ファンダメンタルズデータ取得（PER/PBR/ROE/配当利回り/売上成長率）
async function getStockFundamentals(symbol) {
  if (/^\d{4}$/.test(symbol)) {
    symbol = `${symbol}.T`;
  }

  try {
    checkRateLimit();
    requestCount++;

    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ['defaultKeyStatistics', 'summaryDetail', 'financialData', 'price'],
    });

    const keyStats = summary.defaultKeyStatistics || {};
    const summaryDetail = summary.summaryDetail || {};
    const financialData = summary.financialData || {};
    const price = summary.price || {};

    return {
      symbol,
      name: price.longName || price.shortName || symbol,
      per: summaryDetail.trailingPE ?? keyStats.trailingPE ?? null,
      pbr: keyStats.priceToBook ?? null,
      dividendYield: summaryDetail.dividendYield ?? null,
      roe: financialData.returnOnEquity ?? null,
      revenueGrowth: financialData.revenueGrowth ?? null,
    };
  } catch (error) {
    console.error(`Fundamentals fetch error for ${symbol}:`, error.message);
    return { symbol, name: symbol, per: null, pbr: null, dividendYield: null, roe: null, revenueGrowth: null };
  }
}

export { fetchDailyData, getLatestPrice, searchSymbol, getStockFundamentals };

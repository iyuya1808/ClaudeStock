const API_BASE = 'http://localhost:3001/api';

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'APIエラーが発生しました');
  return data.data;
}

// 株価API
export const stocksApi = {
  getDaily: (symbol: string) => apiCall<StockData[]>(`/stocks/${symbol}`),
  getLatest: (symbol: string) => apiCall<LatestPrice>(`/stocks/${symbol}/latest`),
  search: (query: string) => apiCall<SearchResult[]>(`/search?q=${encodeURIComponent(query)}`),
};

// 取引API
export const tradingApi = {
  getAccount: () => apiCall<Account>('/account'),
  getPortfolio: () => apiCall<PortfolioPosition[]>('/portfolio'),
  getPortfolioSummary: () => apiCall<PortfolioSummary>('/portfolio/summary'),
  buy: (symbol: string, shares: number, reason?: string) =>
    apiCall<TradeResult>('/trade/buy', {
      method: 'POST',
      body: JSON.stringify({ symbol, shares, strategy: 'MANUAL', reason }),
    }),
  sell: (symbol: string, shares: number, reason?: string) =>
    apiCall<TradeResult>('/trade/sell', {
      method: 'POST',
      body: JSON.stringify({ symbol, shares, strategy: 'MANUAL', reason }),
    }),
  getTransactions: (limit = 50, offset = 0) =>
    apiCall<TransactionsResult>(`/transactions?limit=${limit}&offset=${offset}`),
  getStats: () => apiCall<TradeStats>('/stats'),
  reset: () => apiCall<{ message: string }>('/reset', { method: 'POST' }),
  // 10万円チャージ
  topUp: (amount = 100000) => apiCall<Account>('/topup', { 
    method: 'POST',
    body: JSON.stringify({ amount })
  }),
};

// 分析API
export const analysisApi = {
  analyze: (symbol: string) => apiCall<Analysis>(`/analyze/${symbol}`),
  autoTrade: (symbols?: string[]) =>
    apiCall<AutoTradeResult[]>('/auto-trade', {
      method: 'POST',
      body: JSON.stringify({ symbols }),
    }),
  screen: (symbols?: string[]) => {
    const q = symbols ? `?symbols=${symbols.join(',')}` : '';
    return apiCall<ScreenResult[]>(`/screen${q}`);
  },
};

// 型定義
export interface StockData {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LatestPrice {
  symbol: string;
  name?: string;
  price: number;
  date: string;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}


export interface Account {
  id: number;
  initial_balance: number;
  current_cash: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioPosition {
  id: number;
  symbol: string;
  shares: number;
  avg_cost: number;
  purchased_at: string;
}

export interface EnrichedPosition extends PortfolioPosition {
  currentPrice: number;
  marketValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  priceDate: string;
  error?: string;
}

export interface PortfolioSummary {
  account: Account & {
    totalMarketValue: number;
    totalAssets: number;
    totalPnl: number;
    totalPnlPercent: number;
  };
  positions: EnrichedPosition[];
}

export interface TradeResult {
  type: 'BUY' | 'SELL';
  symbol: string;
  shares: number;
  price: number;
  total: number;
  pnl?: number;
  strategy: string;
  reason: string;
  remainingCash: number;
}

export interface Transaction {
  id: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  total: number;
  strategy: string;
  reason: string;
  pnl: number;
  executed_at: string;
}

export interface TransactionsResult {
  transactions: Transaction[];
  total: number;
}

export interface TradeStats {
  totalTrades: number;
  totalBuys: number;
  totalSells: number;
  profitableSells: number;
  losingSells: number;
  totalRealizedPnl: number;
  avgPnlPerSell: number | null;
  winRate: string;
}

export interface Analysis {
  symbol: string;
  name?: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
  confidence: number;
  indicators: {
    currentPrice: number;
    sma20: number | null;
    sma50: number | null;
    rsi: number | null;
    priceChange: number;
    valueScore: number | null;
    fundamentals: Fundamentals | null;
  };
  dataPoints: number;
  latestDate: string;
}

export interface AutoTradeResult {
  symbol: string;
  analysis?: Analysis;
  action?: TradeResult | { error: string };
  skipped?: string;
  error?: string;
}

export interface Fundamentals {
  symbol: string;
  name?: string;
  per: number | null;
  pbr: number | null;
  dividendYield: number | null;
  roe: number | null;
  revenueGrowth: number | null;
}

export interface ScreenResult {
  symbol: string;
  name?: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  valueScore: number | null;
  fundamentals: Fundamentals | null;
  indicators: Analysis['indicators'] & { valueScore: number | null };
  error?: string;
}

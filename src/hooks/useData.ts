import { useState, useEffect, useCallback } from 'react';
import { tradingApi, stocksApi, analysisApi, type PortfolioSummary, type TradeStats, type TransactionsResult, type ApiUsage, type Analysis, type StockData } from '../api';

export function usePortfolioSummary() {
  const [data, setData] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await tradingApi.getPortfolioSummary();
      setData(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export function useTradeStats() {
  const [data, setData] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await tradingApi.getStats();
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useTransactions(limit = 50) {
  const [data, setData] = useState<TransactionsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await tradingApi.getTransactions(limit);
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useApiUsage() {
  const [data, setData] = useState<ApiUsage | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await stocksApi.getUsage();
      setData(result);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, refresh };
}

export function useAnalysis(symbol: string) {
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (sym?: string) => {
    const targetSymbol = sym || symbol;
    if (!targetSymbol) return;
    try {
      setLoading(true);
      setError(null);
      const result = await analysisApi.analyze(targetSymbol);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  return { data, loading, error, analyze };
}

export function useStockData(symbol: string) {
  const [data, setData] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (sym?: string) => {
    const targetSymbol = sym || symbol;
    if (!targetSymbol) return;
    try {
      setLoading(true);
      setError(null);
      const result = await stocksApi.getDaily(targetSymbol);
      setData(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  return { data, loading, error, fetch };
}

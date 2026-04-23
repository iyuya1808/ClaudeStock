import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { tradingApi, analysisApi, stocksApi, type StockData, type Analysis, type AutoTradeResult, type SearchResult } from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Trading() {
  const [symbol, setSymbol] = useState('7203.T');
  const [shares, setShares] = useState(1);
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [trading, setTrading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [autoTrading, setAutoTrading] = useState(false);
  const [autoResults, setAutoResults] = useState<AutoTradeResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchStockData = useCallback(async () => {
    if (!symbol) return;
    try {
      setLoading(true);
      const data = await stocksApi.getDaily(symbol.toUpperCase());
      setStockData(data);
    } catch (e) {
      showMessage('error', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const analyzeStock = useCallback(async () => {
    if (!symbol) return;
    try {
      setAnalyzing(true);
      const result = await analysisApi.analyze(symbol.toUpperCase());
      setAnalysis(result);
    } catch (e) {
      showMessage('error', (e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }, [symbol]);

  const handleBuy = async () => {
    try {
      setTrading(true);
      const result = await tradingApi.buy(symbol.toUpperCase(), shares);
      showMessage('success', `${result.symbol} を ${result.shares}株 @¥${Math.round(result.price).toLocaleString()} で購入しました`);
      setAnalysis(null);
    } catch (e) {
      showMessage('error', (e as Error).message);
    } finally {
      setTrading(false);
    }
  };

  const handleSell = async () => {
    try {
      setTrading(true);
      const result = await tradingApi.sell(symbol.toUpperCase(), shares);
      showMessage('success', `${result.symbol} を ${result.shares}株 @¥${Math.round(result.price).toLocaleString()} で売却（損益: ¥${Math.round(result.pnl || 0).toLocaleString()}）`);
      setAnalysis(null);
    } catch (e) {
      showMessage('error', (e as Error).message);
    } finally {
      setTrading(false);
    }
  };

  const handleAutoTrade = async () => {
    try {
      setAutoTrading(true);
      setAutoResults([]);
      // 銘柄リストはサーバーのデフォルトユニバース（15銘柄）を使用
      const results = await analysisApi.autoTrade([]);
      setAutoResults(results);
      const traded = results.filter(r => r.action && !('error' in r.action)).length;
      showMessage('success', `自動売買完了: ${results.length}銘柄を分析 / ${traded}件取引実行`);
    } catch (e) {
      showMessage('error', (e as Error).message);
    } finally {
      setAutoTrading(false);
    }
  };

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 銘柄検索（デバウンス）
  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await stocksApi.search(q);
        setSearchResults(results.filter(r => r.type === 'EQUITY').slice(0, 8));
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectSearchResult = (result: SearchResult) => {
    setSymbol(result.symbol);
    setSearchQuery(result.name ? `${result.name} (${result.symbol})` : result.symbol);
    setSearchOpen(false);
    setStockData([]);
    setAnalysis(null);
  };

  // 外クリックでドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!symbol || symbol.length < 3) {
      setStockData([]);
      setAnalysis(null);
      return;
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchStockData();
      analyzeStock();
    }, 600);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [symbol, fetchStockData, analyzeStock]);

  const chartData = stockData.length > 0 ? {
    labels: [...stockData].reverse().map(d => d.date.slice(5)),
    datasets: [{
      label: `${symbol.toUpperCase()} 終値`,
      data: [...stockData].reverse().map(d => d.close),
      borderColor: '#e8950a',
      backgroundColor: 'rgba(232, 149, 10, 0.07)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: true,
      tension: 0.3,
    }],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1815',
        titleColor: '#f0ead8',
        bodyColor: '#f5b030',
        borderColor: '#332f28',
        borderWidth: 1,
        padding: 12,
        titleFont: { family: "'Syne', sans-serif" },
        bodyFont: { family: "'IBM Plex Mono', monospace" },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(32, 30, 26, 0.6)' },
        ticks: { color: '#48453e', font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(32, 30, 26, 0.6)' },
        ticks: { color: '#48453e', font: { family: "'IBM Plex Mono', monospace", size: 11 } },
      },
    },
    interaction: { intersect: false, mode: 'index' as const },
  };

  // autoResults stats
  const tradedCount = autoResults.filter(r => r.action && !('error' in r.action)).length;
  const skippedCount = autoResults.filter(r => r.skipped).length;
  const errorCount = autoResults.filter(r => r.error || (r.action && 'error' in r.action)).length;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">取引</h1>
        <p className="page-subtitle">Trade Execution / Analysis</p>
      </div>

      {/* ===== HERO: 自動売買 ===== */}
      <div className="card" style={{
        marginBottom: 28,
        border: '1px solid rgba(232, 149, 10, 0.3)',
        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(232,149,10,0.04) 100%)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: autoResults.length > 0 ? 20 : 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Syne', sans-serif" }}>
                自動売買
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: 'rgba(232,149,10,0.15)', color: 'var(--yellow)', letterSpacing: '0.05em',
              }}>AUTO</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              15銘柄をスクリーニング → SMA × RSI × バリュースコアで最適銘柄を自動選別・売買
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {autoResults.length > 0 && (
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  分析 <strong style={{ color: 'var(--text-primary)' }}>{autoResults.length}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  取引 <strong style={{ color: tradedCount > 0 ? 'var(--green)' : 'var(--text-primary)' }}>{tradedCount}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  スキップ <strong style={{ color: 'var(--text-primary)' }}>{skippedCount}</strong>
                </span>
                {errorCount > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    エラー <strong style={{ color: 'var(--red)' }}>{errorCount}</strong>
                  </span>
                )}
              </div>
            )}
            <button
              className="btn btn-primary"
              onClick={handleAutoTrade}
              disabled={autoTrading}
              style={{ minWidth: 140, fontWeight: 700, fontSize: 14, padding: '10px 20px' }}
            >
              {autoTrading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  分析中...
                </span>
              ) : '▶ 自動売買 実行'}
            </button>
          </div>
        </div>

        {/* Results Table */}
        {autoResults.length > 0 && (
          <div className="table-container" style={{ marginTop: 4 }}>
            <table>
              <thead>
                <tr>
                  <th>銘柄</th>
                  <th>シグナル</th>
                  <th style={{ textAlign: 'center' }}>信頼度</th>
                  <th>アクション</th>
                  <th>理由</th>
                </tr>
              </thead>
              <tbody>
                {autoResults.map((r, i) => {
                  const isTraded = r.action && !('error' in r.action);
                  const isError = r.error || (r.action && 'error' in r.action);
                  return (
                    <tr key={i} style={isTraded ? { background: 'rgba(0,200,100,0.04)' } : undefined}>
                      <td>
                        <strong className="text-accent mono">{r.symbol}</strong>
                      </td>
                      <td>
                        {r.analysis ? (
                          <span className={`badge ${r.analysis.signal === 'BUY' ? 'badge-buy' : r.analysis.signal === 'SELL' ? 'badge-sell' : 'badge-hold'}`}>
                            <span className={`signal-dot ${r.analysis.signal.toLowerCase()}`} />
                            {r.analysis.signal}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {r.analysis ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <div style={{ width: 48, height: 4, background: 'var(--bg-input)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                width: `${r.analysis.confidence}%`, height: '100%', borderRadius: 2,
                                background: r.analysis.confidence >= 60 ? 'var(--green)' : r.analysis.confidence >= 40 ? 'var(--yellow)' : 'var(--red)',
                              }} />
                            </div>
                            <span className="mono" style={{ fontSize: 11, minWidth: 28 }}>{r.analysis.confidence}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {isTraded && r.action && !('error' in r.action) ? (
                          <span style={{ fontWeight: 700, color: r.action.type === 'BUY' ? 'var(--green)' : 'var(--red)' }}>
                            {r.action.type === 'BUY' ? '▲ 購入' : '▼ 売却'} {r.action.shares}株
                          </span>
                        ) : isError ? (
                          <span style={{ fontSize: 11, color: 'var(--red)' }}>エラー</span>
                        ) : r.skipped ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>スキップ</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 240 }}>
                        {r.skipped || r.analysis?.reason || r.error || (r.action && 'error' in r.action ? r.action.error : '') || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state when not yet run */}
        {!autoTrading && autoResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0 8px', color: 'var(--text-muted)', fontSize: 13 }}>
            「実行」ボタンで15銘柄を自動スクリーニングして最適な売買を行います
          </div>
        )}

        {autoTrading && (
          <div style={{ textAlign: 'center', padding: '24px 0 8px', color: 'var(--yellow)', fontSize: 13 }}>
            15銘柄を分析中... しばらくお待ちください
          </div>
        )}
      </div>

      {/* ===== 手動取引 + チャート ===== */}
      <div className="grid-2">
        {/* Left: Trade Form */}
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">手動取引 / 銘柄分析</div>
            </div>

            {/* 銘柄検索 */}
            <div className="form-group" ref={searchRef} style={{ position: 'relative' }}>
              <label className="form-label">銘柄を検索</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    className="form-input"
                    value={searchQuery}
                    onChange={e => handleSearchInput(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                    placeholder="銘柄名・コードで検索 (例: トヨタ、7203)"
                  />
                  {searching && (
                    <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>
                      検索中...
                    </span>
                  )}
                  {searchOpen && searchResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', marginTop: 4, overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}>
                      {searchResults.map(r => (
                        <button
                          key={r.symbol}
                          onClick={() => selectSearchResult(r)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            width: '100%', padding: '10px 14px', background: 'transparent',
                            border: 'none', borderBottom: '1px solid var(--border)',
                            cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontSize: 13 }}>{r.name || r.symbol}</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.symbol}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn btn-primary" onClick={fetchStockData} disabled={loading || !symbol}>
                  {loading ? '取得中...' : 'チャート'}
                </button>
                <button className="btn btn-ghost" onClick={analyzeStock} disabled={analyzing || !symbol}>
                  {analyzing ? '分析中...' : '分析'}
                </button>
              </div>
              {symbol && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  選択中: <span className="mono" style={{ color: 'var(--yellow)' }}>{symbol}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">株数</label>
              <input
                className="form-input mono"
                type="number"
                min={1}
                value={shares}
                onChange={e => setShares(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleBuy} disabled={trading || !symbol}>
                {trading ? '処理中...' : '▲ 購入'}
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleSell} disabled={trading || !symbol}>
                {trading ? '処理中...' : '▼ 売却'}
              </button>
            </div>
          </div>

          {/* Analysis Result */}
          {analysis && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  {analysis.name ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 18 }}>{analysis.name}</span>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{analysis.symbol}</span>
                    </div>
                  ) : (
                    `${analysis.symbol} 分析結果`
                  )}
                </div>
                <span className={`badge ${analysis.signal === 'BUY' ? 'badge-buy' : analysis.signal === 'SELL' ? 'badge-sell' : 'badge-hold'}`}>
                  <span className={`signal-dot ${analysis.signal.toLowerCase()}`} />
                  {analysis.signal === 'BUY' ? '買いシグナル' : analysis.signal === 'SELL' ? '売りシグナル' : '様子見'}
                </span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="stat-label">判定理由</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{analysis.reason}</p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="stat-label">信頼度</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${analysis.confidence}%`,
                      height: '100%',
                      background: analysis.confidence >= 60 ? 'var(--green)' : analysis.confidence >= 30 ? 'var(--yellow)' : 'var(--red)',
                      borderRadius: 4,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span className="mono" style={{ fontSize: 14 }}>{analysis.confidence}%</span>
                </div>
              </div>

              <div className="stats-grid" style={{ gap: 8 }}>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>現在価格</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>¥{Math.round(analysis.indicators.currentPrice).toLocaleString()}</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>SMA20</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{analysis.indicators.sma20 ? `¥${Math.round(analysis.indicators.sma20).toLocaleString()}` : 'N/A'}</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>SMA50</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{analysis.indicators.sma50 ? `¥${Math.round(analysis.indicators.sma50).toLocaleString()}` : 'N/A'}</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>RSI</div>
                  <div className="mono" style={{
                    fontSize: 16, fontWeight: 600,
                    color: analysis.indicators.rsi ? (analysis.indicators.rsi > 70 ? 'var(--red-light)' : analysis.indicators.rsi < 30 ? 'var(--green-light)' : 'var(--text-primary)') : undefined,
                  }}>
                    {analysis.indicators.rsi?.toFixed(1) || 'N/A'}
                  </div>
                </div>
              </div>

              {analysis.indicators.fundamentals && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="stat-label">割安度スコア</div>
                    {analysis.indicators.valueScore !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 120, height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${analysis.indicators.valueScore}%`, height: '100%',
                            background: analysis.indicators.valueScore >= 60 ? 'var(--green)' : analysis.indicators.valueScore >= 40 ? 'var(--yellow)' : 'var(--red)',
                            borderRadius: 3,
                          }} />
                        </div>
                        <span className="mono" style={{
                          fontSize: 15, fontWeight: 700,
                          color: analysis.indicators.valueScore >= 60 ? 'var(--green)' : analysis.indicators.valueScore >= 40 ? 'var(--yellow)' : 'var(--red)',
                        }}>
                          {analysis.indicators.valueScore.toFixed(1)}pt
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          color: analysis.indicators.valueScore >= 70 ? 'var(--green)' : analysis.indicators.valueScore >= 50 ? 'var(--blue)' : analysis.indicators.valueScore >= 30 ? 'var(--yellow)' : 'var(--red)',
                          background: analysis.indicators.valueScore >= 70 ? 'rgba(0,200,100,0.1)' : analysis.indicators.valueScore >= 50 ? 'rgba(60,120,220,0.1)' : analysis.indicators.valueScore >= 30 ? 'rgba(240,180,0,0.1)' : 'rgba(220,50,50,0.1)',
                        }}>
                          {analysis.indicators.valueScore >= 70 ? '割安' : analysis.indicators.valueScore >= 50 ? '適正' : analysis.indicators.valueScore >= 30 ? 'やや高' : '割高'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {[
                      { label: 'PER', value: analysis.indicators.fundamentals.per, fmt: (v: number) => `${v.toFixed(1)}x` },
                      { label: 'PBR', value: analysis.indicators.fundamentals.pbr, fmt: (v: number) => `${v.toFixed(2)}x` },
                      { label: 'ROE', value: analysis.indicators.fundamentals.roe, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
                      { label: '配当利回り', value: analysis.indicators.fundamentals.dividendYield, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
                      { label: '売上成長率', value: analysis.indicators.fundamentals.revenueGrowth, fmt: (v: number) => `${(v * 100).toFixed(1)}%` },
                    ].map(item => (
                      <div key={item.label} style={{ padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <div className="stat-label" style={{ fontSize: 9, marginBottom: 4 }}>{item.label}</div>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                          {item.value !== null ? item.fmt(item.value) : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                    ※ 割安度スコア = PER(25pt) + PBR(25pt) + 配当利回り(20pt) + ROE(15pt) + 売上成長率(15pt)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Chart */}
        <div>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                {analysis?.name || symbol.toUpperCase()} チャート
              </div>
              {stockData.length > 0 && (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  {stockData.length}日分のデータ
                </span>
              )}
            </div>
            {stockData.length > 0 && chartData ? (
              <div className="chart-container">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📉</div>
                <div className="empty-state-text">
                  銘柄を選択して「チャート」ボタンをクリックすると、株価チャートが表示されます。
                </div>
              </div>
            )}

            {stockData.length > 0 && (
              <div className="stats-grid" style={{ marginTop: 16, gap: 8 }}>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>最新終値</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>¥{Math.round(stockData[0]?.close).toLocaleString()}</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>高値</div>
                  <div className="mono text-green" style={{ fontSize: 18, fontWeight: 700 }}>¥{Math.round(stockData[0]?.high).toLocaleString()}</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>安値</div>
                  <div className="mono text-red" style={{ fontSize: 18, fontWeight: 700 }}>¥{Math.round(stockData[0]?.low).toLocaleString()}</div>
                </div>
                <div style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div className="stat-label" style={{ fontSize: 10 }}>出来高</div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{(stockData[0]?.volume / 1000000).toFixed(1)}M</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div className={`toast ${message.type}`}>
          <span style={{ marginRight: 8 }}>{message.type === 'success' ? '✅' : '❌'}</span>
          {message.text}
        </div>
      )}
    </div>
  );
}

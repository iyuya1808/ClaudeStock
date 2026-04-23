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
import { tradingApi, analysisApi, stocksApi, type StockData, type Analysis } from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const POPULAR_SYMBOLS = [
  { symbol: '7203.T', name: 'トヨタ' },
  { symbol: '6758.T', name: 'ソニーG' },
  { symbol: '9984.T', name: 'ソフトバンクG' },
  { symbol: '7974.T', name: '任天堂' },
  { symbol: '6861.T', name: 'キーエンス' },
  { symbol: '8306.T', name: '三菱UFJ' },
  { symbol: '9432.T', name: 'NTT' },
  { symbol: '6501.T', name: '日立' },
];

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
  const [autoResults, setAutoResults] = useState<any[]>([]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
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
      const results = await analysisApi.autoTrade(POPULAR_SYMBOLS.map(s => s.symbol));
      setAutoResults(results);
      showMessage('success', `自動売買分析完了: ${results.length}銘柄を分析しました`);
    } catch (e) {
      showMessage('error', (e as Error).message);
    } finally {
      setAutoTrading(false);
    }
  };

  // Auto-fetch and Analyze on symbol change (debounced)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Chart Data
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
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">取引</h1>
        <p className="page-subtitle">Trade Execution / Analysis</p>
      </div>

      <div className="grid-2">
        {/* Left: Trade Form */}
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <div className="card-title">銘柄選択・分析</div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {POPULAR_SYMBOLS.map(s => (
                <button
                  key={s.symbol}
                  className={`btn btn-sm ${symbol === s.symbol ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setSymbol(s.symbol); setStockData([]); setAnalysis(null); }}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">ティッカーシンボル</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  value={symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                  placeholder="例: 7203.T"
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={fetchStockData} disabled={loading || !symbol}>
                  {loading ? '取得中...' : 'チャート'}
                </button>
                <button className="btn btn-ghost" onClick={analyzeStock} disabled={analyzing || !symbol}>
                  {analyzing ? '分析中...' : '分析'}
                </button>
              </div>
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
            <div className="card" style={{ marginBottom: 24 }}>
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
            </div>
          )}

          {/* Auto Trade */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">自動売買</div>
                <div className="card-subtitle">SMA + RSI 戦略で自動分析・売買</div>
              </div>
              <button className="btn btn-primary" onClick={handleAutoTrade} disabled={autoTrading}>
                {autoTrading ? '分析中...' : '実行'}
              </button>
            </div>

            {autoResults.length > 0 && (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>銘柄</th>
                      <th>シグナル</th>
                      <th>アクション</th>
                      <th>理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoResults.map((r, i) => (
                      <tr key={i}>
                        <td><strong className="text-accent">{r.symbol}</strong></td>
                        <td>
                          {r.analysis ? (
                            <span className={`badge ${r.analysis.signal === 'BUY' ? 'badge-buy' : r.analysis.signal === 'SELL' ? 'badge-sell' : 'badge-hold'}`}>
                              {r.analysis.signal}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          {r.action && !r.action.error ? (
                            <span className={r.action.type === 'BUY' ? 'text-green' : 'text-red'}>
                              {r.action.type === 'BUY' ? '買い' : '売り'} {r.action.shares}株
                            </span>
                          ) : r.action?.error ? (
                            <span className="text-muted" style={{ fontSize: 12 }}>{r.action.error}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, color: 'var(--text-secondary)' }}>
                          {r.analysis?.reason || r.error || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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

      {/* Message Toast */}
      {message && (
        <div className={`toast ${message.type}`}>
          <span style={{ marginRight: 8 }}>{message.type === 'success' ? '✅' : '❌'}</span>
          {message.text}
        </div>
      )}
    </div>
  );
}

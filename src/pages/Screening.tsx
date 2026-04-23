import { useState } from 'react';
import { analysisApi, tradingApi, type ScreenResult } from '../api';

const DEFAULT_SYMBOLS = '7203.T,6758.T,9984.T,7974.T,6861.T,4063.T,8306.T,9432.T,6902.T,7741.T';

const VALUE_SCORE_LABEL = (score: number | null) => {
  if (score === null) return { label: 'N/A', color: 'var(--text-muted)' };
  if (score >= 70) return { label: '割安', color: 'var(--green)' };
  if (score >= 50) return { label: '適正', color: 'var(--blue)' };
  if (score >= 30) return { label: 'やや高', color: 'var(--yellow)' };
  return { label: '割高', color: 'var(--red)' };
};

const SIGNAL_STYLE = (signal: string) => {
  if (signal === 'BUY') return { color: 'var(--green)', bg: 'rgba(0,200,100,0.1)' };
  if (signal === 'SELL') return { color: 'var(--red)', bg: 'rgba(220,50,50,0.1)' };
  return { color: 'var(--text-muted)', bg: 'var(--bg-card)' };
};

const fmt = (v: number | null, digits = 2, suffix = '') =>
  v !== null ? `${v.toFixed(digits)}${suffix}` : '-';

const fmtPct = (v: number | null) =>
  v !== null ? `${(v * 100).toFixed(1)}%` : '-';

export default function Screening() {
  const [symbolInput, setSymbolInput] = useState(DEFAULT_SYMBOLS);
  const [results, setResults] = useState<ScreenResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyStatus, setBuyStatus] = useState<Record<string, string>>({});

  const runScreen = async () => {
    setLoading(true);
    setError(null);
    try {
      const symbols = symbolInput.split(',').map(s => s.trim()).filter(Boolean);
      const data = await analysisApi.screen(symbols);
      setResults(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (symbol: string, price: number) => {
    const shares = Math.max(1, Math.floor(10000 / price));
    setBuyStatus(s => ({ ...s, [symbol]: '購入中...' }));
    try {
      await tradingApi.buy(symbol, shares, `スクリーニング買い (割安度スコア)`);
      setBuyStatus(s => ({ ...s, [symbol]: `✓ ${shares}株購入` }));
    } catch (e: any) {
      setBuyStatus(s => ({ ...s, [symbol]: `✗ ${e.message}` }));
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">割安株スクリーニング</h1>
        <p className="page-subtitle">Value Stock Screener — PER / PBR / ROE / 配当利回り / 売上成長率</p>
      </div>

      {/* 銘柄入力 */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">スクリーニング対象銘柄</h2>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <textarea
            value={symbolInput}
            onChange={e => setSymbolInput(e.target.value)}
            rows={2}
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              padding: '8px 12px',
              resize: 'vertical',
            }}
            placeholder="カンマ区切りで銘柄コードを入力 (例: 7203.T,AAPL)"
          />
          <button
            className="btn btn-primary"
            onClick={runScreen}
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? '分析中...' : 'スクリーニング実行'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          ※ バリュースコア = PER(25pt) + PBR(25pt) + 配当利回り(20pt) + ROE(15pt) + 売上成長率(15pt)
        </p>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', padding: 12, marginBottom: 16, background: 'rgba(220,50,50,0.1)', borderRadius: 'var(--radius-sm)' }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-spinner">
          <div className="spinner" />
          <span>ファンダメンタルズを取得中...</span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">スクリーニング結果</h2>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{results.length}銘柄（バリュースコア降順）</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-muted)', fontSize: 11 }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', minWidth: 120 }}>銘柄 / 会社名</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px' }}>バリュースコア</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>PER</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>PBR</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>ROE</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>配当利回り</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>売上成長率</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px' }}>シグナル</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>現在値</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  if (r.error) {
                    return (
                      <tr key={r.symbol} style={{ borderBottom: '1px solid var(--border-primary)', opacity: 0.5 }}>
                        <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{r.symbol}</td>
                        <td colSpan={9} style={{ padding: '10px 12px', color: 'var(--red)', fontSize: 12 }}>{r.error}</td>
                      </tr>
                    );
                  }

                  const { label: vsLabel, color: vsColor } = VALUE_SCORE_LABEL(r.valueScore);
                  const sig = SIGNAL_STYLE(r.signal);
                  const f = r.fundamentals;
                  const currentPrice = r.indicators?.currentPrice;

                  return (
                    <tr key={r.symbol} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{r.name || '-'}</span>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.symbol}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ color: vsColor, fontWeight: 700, fontSize: 15, fontFamily: "'IBM Plex Mono', monospace" }}>
                            {r.valueScore !== null ? r.valueScore.toFixed(1) : '-'}
                          </span>
                          <span style={{ fontSize: 10, color: vsColor, background: `${vsColor}20`, padding: '1px 6px', borderRadius: 4 }}>
                            {vsLabel}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {fmt(f?.per ?? null, 1, 'x')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {fmt(f?.pbr ?? null, 2, 'x')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {fmtPct(f?.roe ?? null)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {fmtPct(f?.dividendYield ?? null)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {fmtPct(f?.revenueGrowth ?? null)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          color: sig.color,
                          background: sig.bg,
                          padding: '3px 10px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}>
                          {r.signal}
                        </span>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {r.confidence}%
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>
                        {currentPrice ? `¥${currentPrice.toLocaleString()}` : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {buyStatus[r.symbol] ? (
                          <span style={{ fontSize: 11, color: buyStatus[r.symbol].startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>
                            {buyStatus[r.symbol]}
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 11, padding: '4px 12px' }}
                            onClick={() => currentPrice && handleBuy(r.symbol, currentPrice)}
                            disabled={!currentPrice}
                          >
                            買う
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-secondary)' }}>スコアの見方：</strong>
            　70pt以上＝割安　50-69pt＝適正　30-49pt＝やや高　30pt未満＝割高
            　｜　シグナルはSMA/RSIによるテクニカル分析。バリュースコアが高い銘柄はBUYの信頼度が+20pt。
          </div>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          「スクリーニング実行」ボタンを押すとPER・PBR・ROEなどのファンダメンタルズを取得してスコアリングします
        </div>
      )}
    </div>
  );
}

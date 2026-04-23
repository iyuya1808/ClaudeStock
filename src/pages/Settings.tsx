import { useState } from 'react';
import { tradingApi } from '../api';
import { useApiUsage } from '../hooks/useData';

export default function Settings() {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { data: usage, refresh: refreshUsage } = useApiUsage();

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleReset = async () => {
    if (!window.confirm('⚠️ 本当にリセットしますか？\n\n全てのポジション、取引履歴が削除され、資金が¥100,000に戻ります。')) {
      return;
    }
    try {
      setResetting(true);
      await tradingApi.reset();
      showMessage('success', 'アカウントがリセットされました。');
    } catch (e) {
      showMessage('error', (e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">設定</h1>
        <p className="page-subtitle">Simulator Config / Account</p>
      </div>

      <div className="grid-2">
        {/* API Usage */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">API使用状況</div>
            <button className="btn btn-ghost btn-sm" onClick={refreshUsage}>更新</button>
          </div>
          {usage && (
            <>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="stat-label">1分間リクエスト</span>
                  <span className="mono" style={{ fontSize: 13 }}>{usage.minuteRequests} / {usage.minuteLimit}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(usage.minuteRequests / usage.minuteLimit) * 100}%`,
                    height: '100%',
                    background: usage.minuteRequests >= usage.minuteLimit ? 'var(--red)' : 'var(--accent)',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="stat-label">1日リクエスト</span>
                  <span className="mono" style={{ fontSize: 13 }}>{usage.dailyRequests} / {usage.dailyLimit}</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(usage.dailyRequests / usage.dailyLimit) * 100}%`,
                    height: '100%',
                    background: usage.dailyRequests >= usage.dailyLimit ? 'var(--red)' : 'var(--green)',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>

              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-muted)' }}>
                💡 Alpha Vantage 無料プラン: 1分間5リクエスト、1日25リクエストまで。
                株価データはキャッシュされるため、同じ銘柄の再取得はAPIを消費しません。
              </div>
            </>
          )}
        </div>

        {/* Account Management */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">アカウント管理</div>
          </div>

          <div style={{ padding: 20, background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>シミュレーターについて</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              このシミュレーターは仮想資金を使用して株式投資の練習を行うツールです。
              実際のお金は使用されません。
            </p>
            <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, marginTop: 8 }}>
              <li>初期資金: ¥100,000</li>
              <li>対象市場: 東京証券取引所（日本株）</li>
              <li>株価データ: Alpha Vantage API（15分遅延）</li>
              <li>売買戦略: SMA20/50クロスオーバー + RSI</li>
              <li>データ保存: SQLite3 ローカルDB</li>
            </ul>
          </div>

          <div style={{ padding: 20, background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--red-light)', marginBottom: 8 }}>データリセット</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              全てのポジション、取引履歴を削除し、資金を初期状態（¥100,000）に戻します。この操作は取り消せません。
            </p>
            <button className="btn btn-danger" onClick={handleReset} disabled={resetting}>
              {resetting ? 'リセット中...' : 'アカウントリセット'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`toast ${message.type}`}>
          <span style={{ marginRight: 8 }}>{message.type === 'success' ? '✅' : '❌'}</span>
          {message.text}
        </div>
      )}
    </div>
  );
}

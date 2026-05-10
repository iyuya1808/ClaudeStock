import { useState } from 'react';
import { tradingApi } from '../api';
import { useTheme } from '../hooks/useTheme';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Appearance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">外観</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <button 
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTheme('dark')}
              style={{ height: 80, flexDirection: 'column', gap: 8 }}
            >
              <span style={{ fontSize: 20 }}>☾</span>
              ダークモード
            </button>
            <button 
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTheme('light')}
              style={{ height: 80, flexDirection: 'column', gap: 8 }}
            >
              <span style={{ fontSize: 20 }}>☀</span>
              ライトモード
            </button>
          </div>
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
              <li>株価データ: Yahoo Finance API</li>
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

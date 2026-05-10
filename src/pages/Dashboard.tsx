import { usePortfolioSummary, useTradeStats, useTransactions } from '../hooks/useData';
import { tradingApi } from '../api';
import { useState } from 'react';

export default function Dashboard() {
  const { data: portfolio, loading: portfolioLoading, refresh: refreshPortfolio } = usePortfolioSummary();
  const { data: stats, refresh: refreshStats } = useTradeStats();
  const { data: txData, refresh: refreshTx } = useTransactions(5);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);

  if (portfolioLoading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>データを読み込み中...</span>
      </div>
    );
  }

  const account = portfolio?.account;
  const positions = portfolio?.positions || [];
  const recentTx = txData?.transactions || [];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
    }).format(Math.round(val));
  };

  const formatPercent = (val: number) => {
    return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
  };

  const handleTopUp = async () => {
    try {
      setIsTopUpLoading(true);
      await tradingApi.topUp(100000);
      await Promise.all([refreshPortfolio(), refreshStats(), refreshTx()]);
      alert('10万円（仮想）をチャージしました！');
    } catch (e) {
      alert('エラーが発生しました');
    } finally {
      setIsTopUpLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">ダッシュボード</h1>
          <p className="page-subtitle">Claude Stock / Overview</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleTopUp} 
          disabled={isTopUpLoading}
          style={{ marginBottom: '4px' }}
        >
          {isTopUpLoading ? '処理中...' : '💰 10万円もらう'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className={`stat-card ${(account?.totalPnl || 0) >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">総資産</div>
          <div className="stat-value">{formatCurrency(account?.totalAssets || 0)}</div>
          <div className={`stat-change ${(account?.totalPnl || 0) >= 0 ? 'positive' : 'negative'}`}>
            {(account?.totalPnl || 0) >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(account?.totalPnl || 0))} ({formatPercent(account?.totalPnlPercent || 0)})
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">現金残高</div>
          <div className="stat-value mono">{formatCurrency(account?.current_cash || 0)}</div>
          <div className="stat-change" style={{color: 'var(--text-muted)'}}>
            初期: {formatCurrency(account?.initial_balance || 100000)}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">保有銘柄数</div>
          <div className="stat-value">{positions.length}</div>
          <div className="stat-change" style={{color: 'var(--text-muted)'}}>
            評価額: {formatCurrency(account?.totalMarketValue || 0)}
          </div>
        </div>

        <div className={`stat-card ${(stats?.totalRealizedPnl || 0) >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">実現損益</div>
          <div className="stat-value" style={{color: (stats?.totalRealizedPnl || 0) >= 0 ? 'var(--green-light)' : 'var(--red-light)'}}>
            {formatCurrency(stats?.totalRealizedPnl || 0)}
          </div>
          <div className="stat-change" style={{color: 'var(--text-muted)'}}>
            勝率: {stats?.winRate || '0.0%'} ({stats?.totalSells || 0}件)
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Portfolio Positions */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">保有ポジション</div>
              <div className="card-subtitle">現在の保有株一覧</div>
            </div>
          </div>
          {positions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">保有銘柄がありません。取引画面から株を購入してみましょう。</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>銘柄</th>
                    <th>株数</th>
                    <th>現在値</th>
                    <th>損益</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(pos => (
                    <tr key={pos.symbol}>
                      <td><strong className="text-accent">{pos.symbol}</strong></td>
                      <td className="mono">{pos.shares}</td>
                      <td className="mono">{formatCurrency(pos.currentPrice)}</td>
                      <td>
                        <span className={pos.pnl >= 0 ? 'text-green' : 'text-red'}>
                          {formatCurrency(pos.pnl)} ({formatPercent(pos.pnlPercent)})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">最近の取引</div>
              <div className="card-subtitle">直近の売買履歴</div>
            </div>
          </div>
          {recentTx.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">取引履歴がありません。</div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>種別</th>
                    <th>銘柄</th>
                    <th>株数</th>
                    <th>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map(tx => (
                    <tr key={tx.id}>
                      <td>
                        <span className={`badge ${tx.type === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                          {tx.type === 'BUY' ? '買い' : '売り'}
                        </span>
                      </td>
                      <td><strong>{tx.symbol}</strong></td>
                      <td className="mono">{tx.shares}</td>
                      <td className="mono">{formatCurrency(tx.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Trading Stats */}
      {stats && stats.totalTrades > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <div className="card-title">取引統計</div>
          </div>
          <div className="stats-grid">
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">総取引数</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{stats.totalTrades}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">買い注文</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green-light)', fontFamily: "'JetBrains Mono', monospace" }}>{stats.totalBuys}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">売り注文</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red-light)', fontFamily: "'JetBrains Mono', monospace" }}>{stats.totalSells}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="stat-label">勝率</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-purple-light)', fontFamily: "'JetBrains Mono', monospace" }}>{stats.winRate}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

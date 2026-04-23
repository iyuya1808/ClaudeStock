import { useState } from 'react';
import { useTransactions } from '../hooks/useData';

export default function History() {
  const [limit] = useState(100);
  const { data, loading, refresh } = useTransactions(limit);

  const transactions = data?.transactions || [];
  const total = data?.total || 0;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(Math.round(val));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['日時', '種別', '銘柄', '株数', '価格', '金額', '損益', '戦略', '理由'];
    const rows = transactions.map(tx => [
      tx.executed_at,
      tx.type,
      tx.symbol,
      tx.shares,
      tx.price.toFixed(2),
      tx.total.toFixed(2),
      tx.pnl.toFixed(2),
      tx.strategy,
      tx.reason,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude_stock_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>取引履歴を読み込み中...</span>
      </div>
    );
  }

  // 損益サマリー
  const totalPnl = transactions
    .filter(tx => tx.type === 'SELL')
    .reduce((sum, tx) => sum + tx.pnl, 0);
  const totalBuyAmount = transactions
    .filter(tx => tx.type === 'BUY')
    .reduce((sum, tx) => sum + tx.total, 0);
  const totalSellAmount = transactions
    .filter(tx => tx.type === 'SELL')
    .reduce((sum, tx) => sum + tx.total, 0);

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">取引履歴</h1>
          <p className="page-subtitle">Transaction Log / {total} records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={refresh}>🔄 更新</button>
          <button className="btn btn-primary btn-sm" onClick={exportCSV} disabled={transactions.length === 0}>
            CSV出力
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">総取引数</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">総購入額</div>
          <div className="stat-value mono" style={{ fontSize: 22 }}>{formatCurrency(totalBuyAmount)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">総売却額</div>
          <div className="stat-value mono" style={{ fontSize: 22 }}>{formatCurrency(totalSellAmount)}</div>
        </div>
        <div className={`stat-card ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">実現損益合計</div>
          <div className="stat-value mono" style={{ fontSize: 22, color: totalPnl >= 0 ? 'var(--green-light)' : 'var(--red-light)' }}>
            {formatCurrency(totalPnl)}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">取引明細</div>
        </div>

        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">取引履歴がありません。取引画面から株の売買を行ってください。</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>種別</th>
                  <th>銘柄</th>
                  <th>株数</th>
                  <th>単価</th>
                  <th>金額</th>
                  <th>損益</th>
                  <th>戦略</th>
                  <th>理由</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td className="mono text-muted" style={{ fontSize: 12 }}>{formatDate(tx.executed_at)}</td>
                    <td>
                      <span className={`badge ${tx.type === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
                        {tx.type === 'BUY' ? '買い' : '売り'}
                      </span>
                    </td>
                    <td><strong className="text-accent">{tx.symbol}</strong></td>
                    <td className="mono">{tx.shares}</td>
                    <td className="mono">{formatCurrency(tx.price)}</td>
                    <td className="mono">{formatCurrency(tx.total)}</td>
                    <td>
                      {tx.type === 'SELL' ? (
                        <span className={`mono ${tx.pnl >= 0 ? 'text-green' : 'text-red'}`} style={{ fontWeight: 600 }}>
                          {formatCurrency(tx.pnl)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {tx.strategy !== 'MANUAL' ? (
                        <span className="badge badge-auto">{tx.strategy}</span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 12 }}>手動</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {tx.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

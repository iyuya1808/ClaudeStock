import { usePortfolioSummary } from '../hooks/useData';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6'];

export default function Portfolio() {
  const { data: portfolio, loading } = usePortfolioSummary();

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <span>ポートフォリオを読み込み中...</span>
      </div>
    );
  }

  const positions = portfolio?.positions || [];
  const account = portfolio?.account;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(Math.round(val));

  const formatPercent = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;

  // Doughnut chart data
  const doughnutData = positions.length > 0 ? {
    labels: positions.map(p => p.symbol),
    datasets: [{
      data: positions.map(p => p.marketValue),
      backgroundColor: positions.map((_, i) => COLORS[i % COLORS.length]),
      borderColor: '#12121c',
      borderWidth: 3,
      hoverBorderWidth: 0,
    }],
  } : null;

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#8888a0',
          font: { family: "'Inter', sans-serif", size: 12 },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#1a1a2e',
        titleColor: '#e8e8f0',
        bodyColor: '#a78bfa',
        borderColor: '#2d2d50',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`,
        },
      },
    },
  };

  // 現金とポジションの配分
  const cashPercent = account ? (account.current_cash / account.totalAssets * 100) : 100;
  const investedPercent = 100 - cashPercent;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">💼 ポートフォリオ</h1>
        <p className="page-subtitle">保有ポジションと資産配分</p>
      </div>

      {/* Asset Allocation */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">現金</div>
          <div className="stat-value mono" style={{ fontSize: 22 }}>{formatCurrency(account?.current_cash || 0)}</div>
          <div className="stat-change" style={{ color: 'var(--blue)' }}>{cashPercent.toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">投資額（時価）</div>
          <div className="stat-value mono" style={{ fontSize: 22 }}>{formatCurrency(account?.totalMarketValue || 0)}</div>
          <div className="stat-change" style={{ color: 'var(--accent-purple-light)' }}>{investedPercent.toFixed(1)}%</div>
        </div>
        <div className={`stat-card ${(account?.totalPnl || 0) >= 0 ? 'positive' : 'negative'}`}>
          <div className="stat-label">未実現損益</div>
          <div className="stat-value mono" style={{ fontSize: 22, color: (account?.totalPnl || 0) >= 0 ? 'var(--green-light)' : 'var(--red-light)' }}>
            {formatCurrency(account?.totalPnl || 0)}
          </div>
          <div className={`stat-change ${(account?.totalPnlPercent || 0) >= 0 ? 'positive' : 'negative'}`}>
            {formatPercent(account?.totalPnlPercent || 0)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Allocation Chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📊 資産配分</div>
          </div>
          {positions.length > 0 && doughnutData ? (
            <div style={{ height: 300 }}>
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🥧</div>
              <div className="empty-state-text">ポジションを保有するとチャートが表示されます</div>
            </div>
          )}
        </div>

        {/* Positions Table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 保有銘柄詳細</div>
          </div>
          {positions.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>銘柄</th>
                    <th>株数</th>
                    <th>取得単価</th>
                    <th>現在値</th>
                    <th>時価評価額</th>
                    <th>損益</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(pos => (
                    <tr key={pos.symbol}>
                      <td><strong className="text-accent">{pos.symbol}</strong></td>
                      <td className="mono">{pos.shares}</td>
                      <td className="mono">{formatCurrency(pos.avg_cost)}</td>
                      <td className="mono">{formatCurrency(pos.currentPrice)}</td>
                      <td className="mono">{formatCurrency(pos.marketValue)}</td>
                      <td>
                        <div className={pos.pnl >= 0 ? 'text-green' : 'text-red'}>
                          <div className="mono" style={{ fontWeight: 600 }}>{formatCurrency(pos.pnl)}</div>
                          <div style={{ fontSize: 11 }}>{formatPercent(pos.pnlPercent)}</div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">保有銘柄がありません</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

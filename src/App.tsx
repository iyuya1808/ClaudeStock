import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import Portfolio from './pages/Portfolio';
import History from './pages/History';
import Settings from './pages/Settings';
import Screening from './pages/Screening';
import './index.css';

type Page = 'dashboard' | 'trading' | 'portfolio' | 'history' | 'settings' | 'screening';

const NAV_ITEMS: { id: Page; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '▦', label: 'ダッシュボード' },
  { id: 'trading', icon: '◈', label: '取引' },
  { id: 'screening', icon: '◧', label: 'スクリーニング' },
  { id: 'portfolio', icon: '◉', label: 'ポートフォリオ' },
  { id: 'history', icon: '≡', label: '取引履歴' },
  { id: 'settings', icon: '◎', label: '設定' },
];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'trading': return <Trading />;
      case 'portfolio': return <Portfolio />;
      case 'screening': return <Screening />;
      case 'history': return <History />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">▲</div>
          <div>
            <h1>ClaudeStock</h1>
            <span>Investment Simulator</span>
          </div>
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div style={{
            padding: '12px 14px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
            borderLeft: '2px solid var(--green)',
          }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>SIM MODE</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--green-light)' }}>仮想資金モード</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>リアルマネー不使用</div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;

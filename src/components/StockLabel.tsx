import { useStockNav } from '../context/StockNavContext';

interface StockLabelProps {
  symbol: string;
  name?: string | null;
}

// どの画面でも銘柄コードと銘柄名をセットで表示し、クリックでその銘柄の取引/詳細ページへ遷移する共通コンポーネント
export default function StockLabel({ symbol, name }: StockLabelProps) {
  const { viewStock } = useStockNav();

  return (
    <button
      type="button"
      onClick={() => viewStock(symbol)}
      title={`${name ? name + ' ' : ''}${symbol} の詳細を見る`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        lineHeight: 1.3,
      }}
      className="stock-label-link"
    >
      {name ? (
        <>
          <span style={{ fontWeight: 700 }}>{name}</span>
          <span className="mono text-muted" style={{ fontSize: 11 }}>{symbol}</span>
        </>
      ) : (
        <span className="text-accent mono" style={{ fontWeight: 700 }}>{symbol}</span>
      )}
    </button>
  );
}

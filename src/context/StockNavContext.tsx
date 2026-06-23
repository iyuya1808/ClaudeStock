import { createContext, useContext } from 'react';

interface StockNavContextType {
  // 銘柄名/コードをクリックした際に取引（詳細）ページへ遷移する
  viewStock: (symbol: string) => void;
}

export const StockNavContext = createContext<StockNavContextType>({ viewStock: () => {} });

export function useStockNav() {
  return useContext(StockNavContext);
}

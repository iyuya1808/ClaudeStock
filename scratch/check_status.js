import { getAccount, getPortfolioSummary } from '../server/api/trading.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkStatus() {
  try {
    const summary = await getPortfolioSummary();
    console.log('--- アカウントステータス ---');
    console.log(`残高: ¥${summary.account.current_cash.toLocaleString()}`);
    console.log(`時価評価額: ¥${summary.account.totalMarketValue.toLocaleString()}`);
    console.log(`総資産: ¥${summary.account.totalAssets.toLocaleString()}`);
    console.log(`損益: ¥${summary.account.totalPnl.toLocaleString()} (${summary.account.totalPnlPercent.toFixed(2)}%)`);
    
    if (summary.positions.length > 0) {
      console.log('\n--- 保有銘柄 ---');
      summary.positions.forEach(pos => {
        console.log(`${pos.symbol}: ${pos.shares}株 (現在値: ¥${pos.currentPrice.toLocaleString()}, 損益: ¥${pos.pnl.toLocaleString()})`);
      });
    } else {
      console.log('\n保有銘柄はありません。');
    }
  } catch (error) {
    console.error('エラー:', error.message);
  }
}

checkStatus();

import { executeAutoTrade } from './engine/strategy.js';
import { getFullTseUniverse } from './data/universe.js';

// .env で上書き可能（未設定時はデフォルト値を使用）
//   AUTO_TRADE_SCHEDULE_ENABLED=false        スケジュール実行を無効化
//   AUTO_TRADE_INTERVAL_MINUTES=60           実行間隔（分）
//   AUTO_TRADE_SCHEDULE_UNIVERSE=ALL_TSE     DEFAULT_50 | ALL_TSE
const ENABLED = process.env.AUTO_TRADE_SCHEDULE_ENABLED !== 'false';
const INTERVAL_MINUTES = Number(process.env.AUTO_TRADE_INTERVAL_MINUTES) || 60;
const UNIVERSE_MODE = process.env.AUTO_TRADE_SCHEDULE_UNIVERSE || 'ALL_TSE';

let isRunning = false;

// 東証の取引時間帯か判定（平日 9:00-15:30 JST、土日祝はスキップ。祝日は判定しない簡易版）
function isWithinMarketHours() {
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9
  const day = jstNow.getUTCDay(); // JSTにずらした上でgetUTCDayを使う
  if (day === 0 || day === 6) return false;

  const hour = jstNow.getUTCHours();
  const minute = jstNow.getUTCMinutes();
  const minutesSinceMidnight = hour * 60 + minute;
  return minutesSinceMidnight >= 9 * 60 && minutesSinceMidnight <= 15 * 60 + 30;
}

async function runScheduledAutoTrade() {
  if (isRunning) {
    console.log('[scheduler] 前回の自動売買がまだ実行中のためスキップします');
    return;
  }
  if (!isWithinMarketHours()) {
    console.log('[scheduler] 取引時間外のためスキップします');
    return;
  }

  isRunning = true;
  const startedAt = new Date();
  try {
    const symbols = UNIVERSE_MODE === 'ALL_TSE' ? getFullTseUniverse() : undefined;
    console.log(`[scheduler] 自動売買を開始します（対象: ${symbols ? symbols.length : 'デフォルト50'}銘柄）`);

    const results = await executeAutoTrade(symbols);
    const traded = results.filter(r => r.action && !r.action.error).length;
    const errors = results.filter(r => r.error || (r.action && r.action.error)).length;
    const elapsedSec = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);

    console.log(`[scheduler] 完了: ${results.length}銘柄を分析 / ${traded}件取引実行 / ${errors}件エラー（${elapsedSec}秒）`);
  } catch (error) {
    console.error('[scheduler] 自動売買の実行に失敗しました:', error.message);
  } finally {
    isRunning = false;
  }
}

function startAutoTradeScheduler() {
  if (!ENABLED) {
    console.log('[scheduler] 自動売買スケジューラは無効化されています（AUTO_TRADE_SCHEDULE_ENABLED=false）');
    return;
  }

  console.log(`[scheduler] 自動売買スケジューラを起動しました（${INTERVAL_MINUTES}分間隔、対象: ${UNIVERSE_MODE}）`);
  setInterval(runScheduledAutoTrade, INTERVAL_MINUTES * 60 * 1000);

  // 起動直後にも一度実行（取引時間内であれば）
  runScheduledAutoTrade();
}

export { startAutoTradeScheduler };

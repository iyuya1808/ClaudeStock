import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
const DB_RELATIVE_PATH = 'data/claude_stock.db';

// 取引が連続発生しても1回のpushにまとめるためのデバウンス時間
const DEBOUNCE_MS = 15000;

let timer = null;

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout);
    });
  });
}

async function pushDb() {
  try {
    // WALの内容をdbファイル本体に反映してからdiffを確認する
    db.pragma('wal_checkpoint(TRUNCATE)');

    const status = await run(`git status --porcelain -- ${DB_RELATIVE_PATH}`);
    if (!status.trim()) {
      return;
    }

    await run(`git add ${DB_RELATIVE_PATH}`);
    await run(`git commit -m "Update database snapshot" -- ${DB_RELATIVE_PATH}`);
    await run('git push');
    console.log('[gitSync] データベースの変更をGitHubにpushしました');
  } catch (error) {
    console.error('[gitSync] データベースのpushに失敗しました:', error.message);
  }
}

// データベース書き込み後に呼び出す。連続呼び出しはまとめて1回のpushになる
function scheduleDbSync() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    pushDb();
  }, DEBOUNCE_MS);
}

export { scheduleDbSync };

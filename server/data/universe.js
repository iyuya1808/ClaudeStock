import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TSE_UNIVERSE_PATH = path.join(__dirname, '..', '..', 'data', 'tse_universe.json');

let cachedFullUniverse = null;
let cachedNameMap = null;

function loadUniverseRaw() {
  if (!fs.existsSync(TSE_UNIVERSE_PATH)) {
    throw new Error('東証全銘柄リスト（data/tse_universe.json）が見つかりません。');
  }
  return JSON.parse(fs.readFileSync(TSE_UNIVERSE_PATH, 'utf-8'));
}

// 東証プライム・スタンダード・グロース全銘柄（JPX公式の上場銘柄一覧 data_j.xls から抽出）
// https://www.jpx.co.jp/markets/statistics-equities/misc/01.html
function getFullTseUniverse() {
  if (cachedFullUniverse) return cachedFullUniverse;

  const raw = loadUniverseRaw();
  cachedFullUniverse = raw.map(({ code }) => `${code}.T`);
  return cachedFullUniverse;
}

// 銘柄コード（4桁 or "XXXX.T"）から銘柄名を引く。東証銘柄リストに無ければnull。
function getSymbolName(symbol) {
  if (!cachedNameMap) {
    const raw = loadUniverseRaw();
    cachedNameMap = new Map(raw.map(({ code, name }) => [code, name]));
  }
  const code = symbol.replace(/\.T$/i, '');
  return cachedNameMap.get(code) || null;
}

export { getFullTseUniverse, getSymbolName };

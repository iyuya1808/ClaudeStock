// 配列の各要素に対して非同期処理を「最大 limit 件」同時実行するヘルパー
// Promise.all による無制限の並列化は外部APIへの負荷が大きすぎるため、
// 同時実行数を絞った上で並列化し、分析（ネットワークI/O）のボトルネックを解消する
async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export { mapWithConcurrency };

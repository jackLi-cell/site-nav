/**
 * 网站导入数据可达性修复脚本
 *
 * 用途：
 * 1. 对当前 5000 条 CSV 做轻量 HTTP 检查。
 * 2. 删除明显硬失败的新增候选。
 * 3. 用未使用候选源补足到 5000 条。
 * 4. 继续保持域名、名称和 slug 去重。
 */

const fs = require('fs');
const {
  TARGET_TOTAL,
  CSV_PATH,
  SEED_FILES,
  SOURCES,
  readExistingCsv,
  extractSeedDomains,
  fetchMarkdownSource,
  parseMarkdownLinks,
  candidateToRecord,
  appendUnique,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
// 5000 条数据全量检查时需要更短超时和更高并发，否则慢站点会拖垮整批修复。
const REQUEST_TIMEOUT_MS = 3500;
const CHECK_CONCURRENCY = 96;
const REFILL_BATCH_SIZE = 240;
const MIN_KEEP_RATIO = 0.7;
const KEEP_SOFT_BLOCK_STATUS = new Set([401, 403, 429]);
const KEEP_MAJOR_DOMAINS = new Set([
  'microsoft.com',
  'azure.microsoft.com',
  'powerbi.microsoft.com',
  'copilot.microsoft.com',
  'teams.microsoft.com',
  'facebook.com',
  'zoho.com',
]);

// 轻量检查 URL 是否能直接打开；反爬、登录限制单独标记为 soft_block。
async function checkReachability(record) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const result = {
    ok: false,
    status: null,
    note: '',
  };

  try {
    let response;
    try {
      response = await fetch(record.url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      });
    } catch {
      // 有些站点拒绝 HEAD，请继续用 GET 验证。
    }

    if (!response || response.status >= 400 || response.status === 405) {
      response = await fetch(record.url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      });
    }

    result.status = response.status;
    result.ok = response.status >= 200 && response.status < 400;
    if (!result.ok && KEEP_SOFT_BLOCK_STATUS.has(response.status)) {
      result.note = 'soft_block';
    }
  } catch (error) {
    result.note = error.name || error.message;
  } finally {
    clearTimeout(timer);
  }

  return result;
}

// 并发检查一批记录，避免一次打开过多连接。
async function checkRecords(records, concurrency = CHECK_CONCURRENCY) {
  const results = [];
  let index = 0;
  let completed = 0;
  const total = records.length;

  async function worker() {
    while (index < records.length) {
      const record = records[index++];
      results.push({ record, result: await checkReachability(record) });
      completed += 1;
      if (completed % 250 === 0 || completed === total) {
        console.log(`可达性检查进度：${completed}/${total}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// 判断当前记录是否应保留；前 90 条为人工首批确认数据，主要官网即使 Node fetch 失败也保留。
function shouldKeepCheckedRecord(item, index) {
  if (!item.record.url.startsWith('https://')) return false;
  if (item.result.ok || item.result.note === 'soft_block') return true;
  if (index < 90) return true;

  try {
    const domain = normalizeDomain(new URL(item.record.url).hostname);
    if (KEEP_MAJOR_DOMAINS.has(domain)) return true;
  } catch {
    return false;
  }

  return false;
}

// 为保留记录重建去重索引，后续补位时继续按同一口径过滤。
function buildIndexes(records) {
  const indexes = {
    domains: new Set(),
    names: new Set(),
    slugs: new Set(),
    seedDomains: extractSeedDomains(SEED_FILES),
  };

  const unique = [];
  for (const record of records) {
    appendUnique(unique, record, indexes, { allowSeedDomain: true });
  }

  return { unique, indexes };
}

// 从候选源生成补位记录，并只追加可直接访问或软拦截的候选。
async function refillRecords(records, indexes) {
  const candidates = [];
  for (const source of SOURCES) {
    try {
      const markdown = await fetchMarkdownSource(source);
      candidates.push(...parseMarkdownLinks(markdown, source.name));
    } catch (error) {
      // 单个候选源网络失败时跳过，后续来源仍可补足缺口。
      console.warn(`跳过候选源：${source.name} ${error.message || error}`);
    }
  }

  const batch = [];
  for (const candidate of candidates) {
    if (records.length >= TARGET_TOTAL) break;
    const record = candidateToRecord(candidate);
    const added = appendUnique(batch, record, indexes);
    if (!added) continue;

    if (batch.length >= REFILL_BATCH_SIZE) {
      await appendReachableBatch(records, batch, indexes);
      batch.length = 0;
    }
  }

  if (records.length < TARGET_TOTAL && batch.length > 0) {
    await appendReachableBatch(records, batch, indexes);
  }

  if (records.length < TARGET_TOTAL) {
    throw new Error(`补位后仍不足 ${TARGET_TOTAL} 条，当前 ${records.length} 条`);
  }

  return records.slice(0, TARGET_TOTAL);
}

// 并发检查补位批次，保留可访问或软拦截候选，失败候选撤销索引占用。
async function appendReachableBatch(records, batch, indexes) {
  const checked = await checkRecords(batch, CHECK_CONCURRENCY);
  for (const item of checked) {
    if (records.length >= TARGET_TOTAL) {
      rollbackIndex(item.record, indexes);
      continue;
    }
    if (item.result.ok || item.result.note === 'soft_block') {
      records.push(item.record);
    } else {
      rollbackIndex(item.record, indexes);
    }
  }
}

// 候选检查失败时撤销索引占用，避免后续同域名候选被误判为重复。
function rollbackIndex(record, indexes) {
  try {
    indexes.domains.delete(normalizeDomain(new URL(record.url).hostname));
  } catch {
    // URL 已经在 appendUnique 验证过，这里只是兜底。
  }
  indexes.names.delete(record.name.toLowerCase());
  indexes.slugs.delete(generateSlug(record.name));
}

// 主流程：检查、剔除硬失败、补足并写回 CSV。
async function main() {
  const records = readExistingCsv(CSV_PATH);
  const checked = await checkRecords(records);
  const kept = checked.filter((item, index) => shouldKeepCheckedRecord(item, index)).map((item) => item.record);
  if (kept.length / checked.length < MIN_KEEP_RATIO) {
    throw new Error(`可达性检查疑似误判过多：保留 ${kept.length}/${checked.length}，未写回 CSV`);
  }
  const removed = checked.length - kept.length;
  const { unique, indexes } = buildIndexes(kept);
  const repaired = await refillRecords(unique, indexes);

  fs.writeFileSync(CSV_PATH, toCsv(repaired), 'utf8');
  console.log(`可达性修复完成：移除 ${removed} 条硬失败候选，最终 ${repaired.length} 条。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

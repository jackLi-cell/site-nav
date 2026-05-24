/**
 * 使用公开 Majestic Million 排名更新 CSV 热度字段。
 *
 * 说明：
 * 1. Majestic Million 提供的是域名全局排名、引用子网数和引用 IP 数，不是精确访问量。
 * 2. popularity_score 是 0-100 的相对热度分，用于排序和筛选；未进入前 100 万的站点保留低分。
 * 3. 子域名优先匹配自身域名，找不到时回退到主域名，避免 docs.example.com 这类入口没有独立排名。
 */

const https = require('https');
const readline = require('readline');
const fs = require('fs');
const {
  CSV_PATH,
  readExistingCsv,
  normalizeDomain,
  toCsv,
} = require('./expand-websites-import');

const MAJESTIC_MILLION_URL = 'https://downloads.majestic.com/majestic_million.csv';
const SOURCE_NAME = 'majestic_million';
const NOT_RANKED_SOURCE = 'majestic_million_not_top_1m';
const COMPOUND_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'com.au',
  'net.au',
  'org.au',
  'com.br',
  'com.mx',
  'co.jp',
  'ne.jp',
  'co.kr',
  'co.in',
  'com.cn',
  'net.cn',
  'org.cn',
  'edu.cn',
  'ac.cn',
]);

// 解析 Majestic CSV 单行；官方字段里没有带逗号文本，保留轻量实现即可。
function parseMajesticLine(line) {
  const columns = String(line || '').split(',');
  return {
    rank: Number.parseInt(columns[0], 10),
    domain: normalizeDomain(columns[2] || ''),
    refSubnets: Number.parseInt(columns[4], 10) || 0,
    refIps: Number.parseInt(columns[5], 10) || 0,
  };
}

// 提取可用于回退匹配的主域名，覆盖常见二级后缀，避免把 co.uk 当作主域。
function getRegistrableDomain(hostname) {
  const domain = normalizeDomain(hostname);
  const parts = domain.split('.').filter(Boolean);
  if (parts.length <= 2) return domain;
  const suffix2 = parts.slice(-2).join('.');
  if (COMPOUND_SUFFIXES.has(suffix2) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

// 将 Majestic 排名压缩成 0-100 分；前 100 万内最低约 20 分，未入榜单独给 5 分。
function rankToScore(rank) {
  if (!Number.isFinite(rank) || rank <= 0) return 5;
  const score = Math.round(100 - (Math.log10(rank) / 6) * 80);
  return Math.max(20, Math.min(100, score));
}

// 根据热度分生成粗粒度等级，方便前端筛选或人工审阅。
function scoreToLevel(score) {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 55) return 'B';
  if (score >= 35) return 'C';
  if (score >= 15) return 'D';
  return 'U';
}

// 从网站 URL 构建精确域名和主域名索引，便于流式排名数据快速命中。
function buildDomainIndexes(records) {
  const exact = new Map();
  const root = new Map();

  records.forEach((record, index) => {
    try {
      const hostname = normalizeDomain(new URL(record.url).hostname);
      const rootDomain = getRegistrableDomain(hostname);
      appendIndex(exact, hostname, index);
      appendIndex(root, rootDomain, index);
    } catch {
      // URL 格式问题会由导入校验处理，这里只跳过热度匹配。
    }
  });

  return { exact, root };
}

// 给索引追加行号；同一个主域可能对应多个子页面，需要全部更新。
function appendIndex(index, domain, rowIndex) {
  if (!domain) return;
  if (!index.has(domain)) index.set(domain, []);
  index.get(domain).push(rowIndex);
}

// 判断是否应该用新排名覆盖当前记录；精确域名优先级高于主域名回退。
function shouldApply(record, rank, priority) {
  const currentPriority = Number.parseInt(record.__popularityPriority || '0', 10);
  const currentRank = Number.parseInt(record.popularity_rank || '', 10);
  if (priority > currentPriority) return true;
  if (priority < currentPriority) return false;
  if (!Number.isFinite(currentRank) || currentRank <= 0) return true;
  return rank < currentRank;
}

// 将排名数据写入单条 CSV 记录，保留来源和引用网络指标，避免把它伪装成精确访问量。
function applyPopularity(record, item, priority, updatedAt) {
  if (!shouldApply(record, item.rank, priority)) return false;
  const score = rankToScore(item.rank);
  record.popularity_score = String(score);
  record.popularity_level = scoreToLevel(score);
  record.popularity_rank = String(item.rank);
  record.popularity_source = SOURCE_NAME;
  record.popularity_ref_subnets = String(item.refSubnets);
  record.popularity_ref_ips = String(item.refIps);
  record.popularity_updated_at = updatedAt;
  record.__popularityPriority = String(priority);
  return true;
}

// 对未进入 Majestic 前 100 万的站点补齐默认热度字段，保证每行都有可排序的分值。
function applyDefaultPopularity(records, updatedAt) {
  let notRanked = 0;
  for (const record of records) {
    if (record.popularity_score) continue;
    record.popularity_score = '5';
    record.popularity_level = 'U';
    record.popularity_rank = '';
    record.popularity_source = NOT_RANKED_SOURCE;
    record.popularity_ref_subnets = '';
    record.popularity_ref_ips = '';
    record.popularity_updated_at = updatedAt;
    notRanked += 1;
  }
  return notRanked;
}

// 清理内部匹配优先级字段，避免写进最终 CSV。
function cleanupInternalFields(records) {
  for (const record of records) {
    delete record.__popularityPriority;
  }
}

// 流式读取 Majestic Million 并更新命中的 CSV 记录。
async function updateFromMajestic(records, indexes, updatedAt) {
  return new Promise((resolve, reject) => {
    let lineNumber = 0;
    let exactMatches = 0;
    let rootMatches = 0;

    https.get(MAJESTIC_MILLION_URL, {
      headers: {
        'user-agent': 'site-nav-popularity-updater/1.0',
        accept: 'text/csv,*/*',
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`下载 Majestic Million 失败：HTTP ${response.statusCode}`));
        return;
      }

      const reader = readline.createInterface({ input: response, crlfDelay: Infinity });
      reader.on('line', (line) => {
        lineNumber += 1;
        if (lineNumber === 1) return;

        const item = parseMajesticLine(line);
        if (!item.domain || !Number.isFinite(item.rank)) return;

        const exactRows = indexes.exact.get(item.domain) || [];
        for (const rowIndex of exactRows) {
          if (applyPopularity(records[rowIndex], item, 2, updatedAt)) exactMatches += 1;
        }

        const rootRows = indexes.root.get(item.domain) || [];
        for (const rowIndex of rootRows) {
          if (applyPopularity(records[rowIndex], item, 1, updatedAt)) rootMatches += 1;
        }
      });
      reader.on('close', () => resolve({ exactMatches, rootMatches }));
      reader.on('error', reject);
    }).on('error', reject);
  });
}

// 主流程：读取 CSV、匹配公开排名、补齐默认分值并写回 CSV。
async function main() {
  const records = readExistingCsv(CSV_PATH);
  const updatedAt = new Date().toISOString().slice(0, 10);
  const indexes = buildDomainIndexes(records);
  const matches = await updateFromMajestic(records, indexes, updatedAt);
  const notRanked = applyDefaultPopularity(records, updatedAt);
  cleanupInternalFields(records);
  fs.writeFileSync(CSV_PATH, toCsv(records), 'utf8');

  console.log(`热度更新完成：总计 ${records.length} 条，精确命中 ${matches.exactMatches} 条，主域名回退命中 ${matches.rootMatches} 条，未进前 100 万 ${notRanked} 条。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

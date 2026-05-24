/**
 * 按当前主大类配额补充可访问网站。
 *
 * 业务意图：
 * 1. 只补 category_1 现有主大类，不新增 SQL，不修改表结构。
 * 2. 每个主大类目标为国内 3000、海外 7000，总量至少 10000。
 * 3. 候选必须通过首页访问、敏感词、域名/名称/slug 去重和主大类匹配。
 * 4. 这是可分批执行脚本，单批不强行填满几十万缺口。
 */

const fs = require('fs');
const path = require('path');
const {
  CSV_PATH,
  readExistingCsv,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');
const {
  readMajesticCandidates,
  fetchHomepage,
  inferRegion,
  hasSensitiveContent,
} = require('./append-industry-websites');

const CHINA_REGION = '中国';
const OUTPUT_REPORT = path.join(__dirname, '../data/major-quota-supplement-report.json');
const ATTEMPTED_PATH = path.join(__dirname, '../data/cache/major-quota-attempted-domains.json');
const TARGET_CHINA = Number.parseInt(process.env.TARGET_CHINA || '3000', 10);
const TARGET_OVERSEAS = Number.parseInt(process.env.TARGET_OVERSEAS || '7000', 10);
const MAX_CANDIDATES = Number.parseInt(process.env.MAX_CANDIDATES || '100000', 10);
const MAX_FETCHES = Number.parseInt(process.env.MAX_FETCHES || '300', 10);
const MAX_APPEND = Number.parseInt(process.env.MAX_APPEND || '100', 10);
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY || '8', 10);
const UPDATED_AT = '2026-05-12';
const TARGET_MAJOR_ALIASES = {
  efficiency: '效率办公',
  life: '生活服务',
};
const TARGET_MAJORS = parseTargetMajors();

const GENERIC_SIGNALS = new Set([
  '推荐',
  '热门',
  '已补全',
  '国内网站',
  '海外网站',
  '可访问',
  '合规检测',
  '在线服务',
  '可访问网站',
  'web',
  'api',
  'tools',
  'global website',
  'online service',
  'website',
  'resources',
]);

/**
 * 读取历史尝试过的域名，避免连续批次重复访问失败候选。
 * @returns {Set<string>} 已尝试域名集合。
 */
function loadAttemptedDomains() {
  try {
    const content = fs.readFileSync(ATTEMPTED_PATH, 'utf8');
    const values = JSON.parse(content);
    return new Set(Array.isArray(values) ? values.map(normalizeDomain).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

/**
 * 解析本批次只补充哪些主大类；为空时补全部大类。
 * @returns {Set<string>} 目标主大类集合。
 */
function parseTargetMajors() {
  const keys = String(process.env.TARGET_MAJOR_KEYS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const names = keys.map((key) => TARGET_MAJOR_ALIASES[key] || key).filter(Boolean);
  return new Set(names);
}

/**
 * 写回已尝试域名缓存。
 * @param {Set<string>} attempted 已尝试域名集合。
 */
function writeAttemptedDomains(attempted) {
  fs.mkdirSync(path.dirname(ATTEMPTED_PATH), { recursive: true });
  fs.writeFileSync(ATTEMPTED_PATH, `${JSON.stringify([...attempted].sort(), null, 2)}\n`, 'utf8');
}

/**
 * 构建当前 CSV 的去重索引。
 * @param {object[]} rows 当前 CSV 记录。
 * @returns {{domains: Set<string>, names: Set<string>, slugs: Set<string>}} 去重索引。
 */
function buildIndexes(rows) {
  const indexes = {
    domains: new Set(),
    names: new Set(),
    slugs: new Set(),
  };
  for (const row of rows) {
    try {
      indexes.domains.add(normalizeDomain(new URL(row.url).hostname));
    } catch {
      // 非法 URL 会在最终校验中暴露，这里只避免索引构建中断。
    }
    indexes.names.add(String(row.name || '').toLowerCase());
    indexes.slugs.add(generateSlug(row.name || ''));
  }
  return indexes;
}

/**
 * 统计每个主大类的国内/海外数量。
 * @param {object[]} rows 当前 CSV 记录。
 * @returns {Map<string, {china: number, overseas: number, total: number}>} 主大类统计。
 */
function countMajorStats(rows) {
  const stats = new Map();
  for (const row of rows) {
    const major = String(row.category_1 || '').trim() || '未分类';
    if (!stats.has(major)) stats.set(major, { china: 0, overseas: 0, total: 0 });
    const item = stats.get(major);
    item.total += 1;
    if (row.region === CHINA_REGION) item.china += 1;
    else item.overseas += 1;
  }
  return stats;
}

/**
 * 根据现有记录为每个主大类生成关键词画像，优先保持与当前 CSV 分类风格一致。
 * @param {object[]} rows 当前 CSV 记录。
 * @returns {Map<string, {major: string, signals: string[], subcategories: string[]}>} 主大类画像。
 */
function buildMajorProfiles(rows) {
  const profileMap = new Map();
  for (const row of rows) {
    const major = String(row.category_1 || '').trim() || '未分类';
    if (!profileMap.has(major)) {
      profileMap.set(major, {
        major,
        signalCounts: new Map(),
        subcategoryCounts: new Map(),
      });
    }
    const profile = profileMap.get(major);
    addSignal(profile.signalCounts, major, 20);
    for (let index = 2; index <= 8; index += 1) {
      addSignal(profile.signalCounts, row[`category_${index}`], 8);
      if (index <= 5) addSignal(profile.subcategoryCounts, row[`category_${index}`], 5);
    }
    for (const value of splitList(row.keywords)) addSignal(profile.signalCounts, value, 3);
    for (const value of splitList(row.tags)) addSignal(profile.signalCounts, value, 2);
    for (const value of splitList(row.features)) addSignal(profile.signalCounts, value, 1);
  }

  const entries = [...profileMap.entries()]
    .filter(([major]) => TARGET_MAJORS.size === 0 || TARGET_MAJORS.has(major));

  return new Map(entries.map(([major, profile]) => {
    const signals = [...profile.signalCounts.entries()]
      .filter(([signal]) => isUsefulSignal(signal))
      .sort((left, right) => right[1] - left[1])
      .slice(0, 80)
      .map(([signal]) => signal);
    const subcategories = [...profile.subcategoryCounts.entries()]
      .filter(([signal]) => isUsefulSignal(signal) && signal !== major)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([signal]) => signal);
    return [major, { major, signals: uniqueList([major, ...signals]), subcategories }];
  }));
}

/**
 * 向计数器添加信号词。
 * @param {Map<string, number>} counts 计数器。
 * @param {string} value 信号词。
 * @param {number} weight 权重。
 */
function addSignal(counts, value, weight) {
  const signal = String(value || '').trim();
  if (!signal) return;
  counts.set(signal, (counts.get(signal) || 0) + weight);
}

/**
 * 判断信号词是否适合参与分类匹配。
 * @param {string} signal 信号词。
 * @returns {boolean} true 表示可用。
 */
function isUsefulSignal(signal) {
  const value = String(signal || '').trim();
  if (!value || GENERIC_SIGNALS.has(value.toLowerCase())) return false;
  if (value.length < 2 || value.length > 36) return false;
  if (/^\d+$/.test(value)) return false;
  return true;
}

/**
 * 拆分逗号分隔字段。
 * @param {string} value 原始字段值。
 * @returns {string[]} 去除空白后的列表。
 */
function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 列表去重并保留顺序。
 * @param {string[]} values 原始列表。
 * @returns {string[]} 去重列表。
 */
function uniqueList(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const item = String(value || '').trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * 按当前缺口判断主大类是否还需要指定地区的新记录。
 * @param {string} major 主大类。
 * @param {string} region 地区。
 * @param {Map<string, {china: number, overseas: number, total: number}>} stats 当前统计。
 * @returns {boolean} true 表示仍有缺口。
 */
function hasDeficit(major, region, stats) {
  const item = stats.get(major);
  if (!item) return false;
  if (region === CHINA_REGION) return item.china < TARGET_CHINA;
  return item.overseas < TARGET_OVERSEAS;
}

/**
 * 根据当前主大类画像给候选页面分类。
 * @param {string} domain 候选域名。
 * @param {object} page 首页检测结果。
 * @param {string} region 地区。
 * @param {Map<string, object>} profiles 主大类画像。
 * @param {Map<string, object>} stats 当前统计。
 * @returns {{major: string, subcategory: string, score: number}|null} 分类结果。
 */
function classifyByCurrentMajors(domain, page, region, profiles, stats) {
  const searchText = `${domain} ${page.title || ''} ${page.description || ''} ${(page.text || '').slice(0, 1600)}`.toLowerCase();
  const scored = [];
  for (const profile of profiles.values()) {
    if (!hasDeficit(profile.major, region, stats)) continue;
    const score = scoreSignals(searchText, profile.signals);
    if (score <= 0) continue;
    scored.push({ profile, score });
  }
  scored.sort((left, right) => right.score - left.score);
  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < 5) return null;
  if (second && best.score - second.score < 2) return null;
  return {
    major: best.profile.major,
    subcategory: best.profile.subcategories[0] || best.profile.major,
    score: best.score,
  };
}

/**
 * 计算文本与信号词的匹配分。
 * @param {string} searchText 搜索文本。
 * @param {string[]} signals 信号词列表。
 * @returns {number} 匹配分。
 */
function scoreSignals(searchText, signals) {
  let score = 0;
  for (const signal of signals) {
    const normalized = String(signal || '').toLowerCase();
    if (!normalized) continue;
    if (/^[a-z0-9+#.]+$/i.test(normalized) && normalized.length <= 3) {
      if (new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalized)}([^a-z0-9]|$)`, 'i').test(searchText)) score += 1;
    } else if (searchText.includes(normalized)) {
      score += normalized.length >= 4 ? 2 : 1;
    }
  }
  return score;
}

/**
 * 转义正则特殊字符。
 * @param {string} value 原始字符串。
 * @returns {string} 可放入正则的字符串。
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 从页面标题和域名生成站点名称。
 * @param {string} domain 候选域名。
 * @param {object} page 首页检测结果。
 * @returns {string} 网站名称。
 */
function buildName(domain, page) {
  const title = String(page.title || '').replace(/\s+/g, ' ').trim();
  if (title && !/^home|index|welcome|403|404|502|503$/i.test(title)) {
    return title.replace(/[|-].{0,80}$/u, '').trim().slice(0, 80) || domain;
  }
  const label = domain.split('.').slice(0, -1).pop() || domain;
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || domain;
}

/**
 * 把已通过检测的候选转换成 CSV 记录。
 * @param {object} candidate Majestic 候选。
 * @param {object} page 首页检测结果。
 * @param {object} classification 主大类分类结果。
 * @param {string} region 地区。
 * @returns {object} CSV 记录。
 */
function candidateToRecord(candidate, page, classification, region) {
  const name = buildName(candidate.domain, page);
  const major = classification.major;
  const subcategory = classification.subcategory;
  const keywords = uniqueList([name, candidate.domain, major, subcategory, ...splitList(page.description)]).slice(0, 15);
  return {
    name,
    url: page.url,
    short_summary: `${name} 是一个${region === CHINA_REGION ? '国内' : '海外'}网站，主要提供与${major}相关的内容、工具或在线服务。`,
    full_description: `${name} 已在 ${UPDATED_AT} 通过首页访问检测，访问状态码为 ${page.status}。根据首页标题、描述、页面文本与当前 CSV 主大类画像匹配，该站点归入${major}大类。页面摘要：${(page.description || page.title || candidate.domain).slice(0, 180)}。本记录基于可访问首页和公开域名排名信号生成，后续可继续人工核验公司、创始人、总部和定价细节。`,
    category_1: major,
    category_2: subcategory,
    category_3: region === CHINA_REGION ? '国内网站' : '海外网站',
    category_4: major,
    category_5: subcategory,
    category_6: '配额补充',
    category_7: region === CHINA_REGION ? '国内网站' : '海外网站',
    category_8: '可访问网站',
    keywords: keywords.join(','),
    company: name,
    language: region === CHINA_REGION ? '中文' : '多语言',
    is_free: '未知',
    region,
    launch_year: '',
    tags: uniqueList(['可访问', '合规检测', '配额补充', region === CHINA_REGION ? '国内网站' : '海外网站', major]).join(','),
    star_rating: String(popularityScore(candidate.rank) >= 50 ? 4 : 3),
    monthly_visits: String(estimateVisits(candidate.rank, candidate.refSubnets)),
    screenshot_url: '',
    founder: '',
    headquarters: '',
    pricing_model: '未公开或需人工核验',
    alternatives: '',
    target_audience: `${major}用户,行业从业者,内容检索用户,企业或个人用户`,
    features: `${major},${subcategory},在线服务,信息检索,可访问首页`,
    platforms: 'Web',
    social_links: '',
    popularity_score: String(popularityScore(candidate.rank)),
    popularity_level: popularityScore(candidate.rank) >= 50 ? 'B' : 'C',
    popularity_rank: String(candidate.rank || 0),
    popularity_source: 'major_quota_accessible_homepage',
    popularity_ref_subnets: String(candidate.refSubnets || 0),
    popularity_ref_ips: String(candidate.refIps || 0),
    popularity_updated_at: UPDATED_AT,
  };
}

/**
 * 估算热度访问量，明确它是排名信号估算值而非真实访问量。
 * @param {number} rank 公开排名。
 * @param {number} refSubnets 引用子网数。
 * @returns {number} 估算值。
 */
function estimateVisits(rank, refSubnets) {
  if (!rank) return 0;
  return Math.max(1000, Math.round(20_000_000 / Math.sqrt(rank) + (refSubnets || 0) * 120));
}

/**
 * 根据排名给出 0-100 热度分。
 * @param {number} rank 公开排名。
 * @returns {number} 热度分。
 */
function popularityScore(rank) {
  if (!rank) return 20;
  if (rank <= 1000) return 80;
  if (rank <= 10000) return 65;
  if (rank <= 100000) return 50;
  return 35;
}

/**
 * 判断记录是否可以安全追加。
 * @param {object} record CSV 记录。
 * @param {object} indexes 去重索引。
 * @returns {boolean} true 表示没有重复。
 */
function canAppend(record, indexes) {
  const domain = normalizeDomain(new URL(record.url).hostname);
  const name = String(record.name || '').toLowerCase();
  const slug = generateSlug(rowSafeName(record.name));
  return !indexes.domains.has(domain) && !indexes.names.has(name) && !indexes.slugs.has(slug);
}

/**
 * 处理名称为空时的 slug 输入。
 * @param {string} name 网站名称。
 * @returns {string} 安全名称。
 */
function rowSafeName(name) {
  return String(name || '').trim() || 'untitled';
}

/**
 * 追加记录后更新去重索引和配额统计。
 * @param {object} record CSV 记录。
 * @param {object} indexes 去重索引。
 * @param {Map<string, object>} stats 配额统计。
 */
function registerRecord(record, indexes, stats) {
  const domain = normalizeDomain(new URL(record.url).hostname);
  indexes.domains.add(domain);
  indexes.names.add(String(record.name || '').toLowerCase());
  indexes.slugs.add(generateSlug(rowSafeName(record.name)));
  const item = stats.get(record.category_1);
  item.total += 1;
  if (record.region === CHINA_REGION) item.china += 1;
  else item.overseas += 1;
}

/**
 * 并发处理候选域名。
 * @param {object[]} candidates 候选列表。
 * @param {object} context 运行上下文。
 */
async function processCandidates(candidates, context) {
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length && context.fetched < MAX_FETCHES && context.appended.length < MAX_APPEND) {
      const candidate = candidates[cursor];
      cursor += 1;
      const result = await processCandidate(candidate, context);
      context.status[result.status] = (context.status[result.status] || 0) + 1;
      if (result.status === 'accepted') {
        console.log(`补充：${result.domain} -> ${result.region}/${result.major}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

/**
 * 处理单个候选域名。
 * @param {object} candidate 候选域名。
 * @param {object} context 运行上下文。
 * @returns {Promise<object>} 处理结果。
 */
async function processCandidate(candidate, context) {
  if (context.attempted.has(candidate.domain)) return { status: 'attempted' };
  if (context.indexes.domains.has(candidate.domain) || hasSensitiveContent(candidate.domain)) return { status: 'skipped' };
  context.attempted.add(candidate.domain);
  context.fetched += 1;
  const page = await fetchHomepage(candidate.domain);
  if (!page) return { status: 'inaccessible' };
  const combined = `${candidate.domain} ${page.title || ''} ${page.description || ''} ${(page.text || '').slice(0, 1600)}`;
  if (hasSensitiveContent(combined)) return { status: 'sensitive' };
  const region = inferRegion(candidate.domain, combined);
  const classification = classifyByCurrentMajors(candidate.domain, page, region, context.profiles, context.stats);
  if (!classification) return { status: 'unclassified' };
  const record = candidateToRecord(candidate, page, classification, region);
  if (!canAppend(record, context.indexes)) return { status: 'duplicate' };
  context.appended.push(record);
  registerRecord(record, context.indexes, context.stats);
  return { status: 'accepted', domain: candidate.domain, region, major: classification.major };
}

/**
 * 写出本批次补充报告。
 * @param {object} context 运行上下文。
 */
function writeReport(context) {
  const addedByMajor = new Map();
  for (const record of context.appended) {
    if (!addedByMajor.has(record.category_1)) addedByMajor.set(record.category_1, { china: 0, overseas: 0, total: 0 });
    const item = addedByMajor.get(record.category_1);
    item.total += 1;
    if (record.region === CHINA_REGION) item.china += 1;
    else item.overseas += 1;
  }
  const report = {
    updated_at: new Date().toISOString(),
    target: {
      china: TARGET_CHINA,
      overseas: TARGET_OVERSEAS,
      total: TARGET_CHINA + TARGET_OVERSEAS,
      ratio: '3:7',
    },
    target_majors: [...TARGET_MAJORS],
    max_candidates: MAX_CANDIDATES,
    max_fetches: MAX_FETCHES,
    max_append: MAX_APPEND,
    fetched: context.fetched,
    appended: context.appended.length,
    status: context.status,
    added_by_major: Object.fromEntries([...addedByMajor.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))),
    appended_domains: context.appended.map((record) => ({
      name: record.name,
      url: record.url,
      region: record.region,
      category_1: record.category_1,
    })),
  };
  fs.writeFileSync(OUTPUT_REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

/**
 * 主流程：按当前大类缺口补充通过检测的网站。
 */
async function main() {
  const rows = readExistingCsv(CSV_PATH);
  const stats = countMajorStats(rows);
  const profiles = buildMajorProfiles(rows);
  if (TARGET_MAJORS.size > 0 && profiles.size === 0) {
    throw new Error(`没有匹配到目标大类：${[...TARGET_MAJORS].join(',')}`);
  }
  const indexes = buildIndexes(rows);
  const attempted = loadAttemptedDomains();
  const candidates = await readMajesticCandidates(MAX_CANDIDATES);
  const context = {
    stats,
    profiles,
    indexes,
    attempted,
    fetched: 0,
    appended: [],
    status: {},
  };

  await processCandidates(candidates, context);
  if (context.appended.length) {
    fs.writeFileSync(CSV_PATH, toCsv([...rows, ...context.appended]), 'utf8');
  }
  writeAttemptedDomains(context.attempted);
  writeReport(context);
  console.log(`候选读取：${candidates.length}`);
  console.log(`首页检测：${context.fetched}`);
  console.log(`实际补充：${context.appended.length}`);
  console.log(`报告文件：${OUTPUT_REPORT}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  buildMajorProfiles,
  classifyByCurrentMajors,
  countMajorStats,
};

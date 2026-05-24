/**
 * 分批补齐“电商购物”主大类。
 *
 * 业务意图：
 * 1. 国内缺口只从“生活服务”的国内余量中按电商信号重分配，避免破坏已达标大类。
 * 2. 海外缺口从 Majestic Million 公开排名中筛选电商、购物、零售、商城相关域名。
 * 3. 每批成功后立即写回 CSV，适配公开源连接不稳定的情况。
 */

const fs = require('fs');
const https = require('https');
const readline = require('readline');
const {
  CSV_PATH,
  readExistingCsv,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');

const TARGET = '电商购物';
const LIFE = '生活服务';
const CHINA = '中国';
const GLOBAL = '全球';
const TARGET_CHINA = 3000;
const TARGET_OVERSEAS = 7000;
const BATCH_OVERSEAS = Number.parseInt(process.env.BATCH_OVERSEAS || '1000', 10);
const MAJESTIC = 'https://downloads.majestic.com/majestic_million.csv';
const UPDATED_AT = '2026-05-12';

const DOMESTIC_SIGNALS = [
  '电商',
  '购物',
  '商城',
  '外卖',
  '导购',
  'shop',
  'store',
  'mall',
  'commerce',
  'retail',
  'coupon',
  'shopping',
  'marketplace',
  'delivery',
];

const OVERSEAS_TOKENS = new Set([
  'shop',
  'store',
  'stores',
  'mall',
  'cart',
  'coupon',
  'coupons',
  'retail',
  'commerce',
  'ecommerce',
  'shopping',
  'deal',
  'deals',
  'delivery',
  'marketplace',
  'seller',
  'sale',
  'sales',
  'buy',
  'auction',
  'product',
  'products',
  'merchant',
  'checkout',
  'payments',
  'pay',
]);

const BLOCKED_PATTERN = /(adult|porn|sex|xxx|casino|gambl|betting|lottery|torrent|piracy|warez|crack|keygen|malware|exploit|crypto|bitcoin|forex|vpn|proxy|telegram|weapon|gun|politic|government|military|army|police|court|party)/i;

/**
 * 判断域名是否应计为海外站点。
 * @param {string} domain 规范化域名。
 * @returns {boolean} true 表示可按海外候选处理。
 */
function isOverseasDomain(domain) {
  return !(/\.cn$|\.xn--fiqs8s$|\.xn--fiqz9s$/i.test(domain));
}

/**
 * 提取主要域名标签，用于生成保守站点名称。
 * @param {string} domain 规范化域名。
 * @returns {string} 主标签。
 */
function mainLabel(domain) {
  const parts = domain.split('.');
  if (domain.endsWith('.co.uk') || domain.endsWith('.com.au') || domain.endsWith('.co.jp')) {
    return parts.at(-3) || '';
  }
  return parts.at(-2) || '';
}

/**
 * 拆分域名 token，用于电商信号判断。
 * @param {string} domain 规范化域名。
 * @returns {string[]} token 列表。
 */
function tokens(domain) {
  return domain.toLowerCase().split(/[.\-_]+/).filter(Boolean);
}

/**
 * 判断海外域名是否具备电商购物信号。
 * @param {string} domain 规范化域名。
 * @returns {boolean} true 表示命中电商购物候选。
 */
function isShoppingDomain(domain) {
  const values = tokens(domain);
  if (values.some((token) => OVERSEAS_TOKENS.has(token))) return true;
  return /(myshopify|shopify|woocommerce|bigcommerce|prestashop|magento|opencart|shopline|shopee|aliexpress|amazon|ebay|etsy)/i.test(domain);
}

/**
 * 根据域名生成可读名称，不编造公司主体信息。
 * @param {string} domain 规范化域名。
 * @returns {string} 站点名称。
 */
function nameFromDomain(domain) {
  const label = mainLabel(domain) || domain;
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((value) => (value.length <= 3 ? value.toUpperCase() : value[0].toUpperCase() + value.slice(1)))
    .join(' ') || domain;
}

/**
 * 构建域名、名称、slug 三重去重索引。
 * @param {object[]} rows 当前 CSV 记录。
 * @returns {{domains: Set<string>, names: Set<string>, slugs: Set<string>}} 去重索引。
 */
function buildIndexes(rows) {
  const indexes = { domains: new Set(), names: new Set(), slugs: new Set() };
  for (const row of rows) {
    try {
      indexes.domains.add(normalizeDomain(new URL(row.url).hostname));
    } catch {
      // 非法 URL 会在后续校验暴露，这里只避免索引构建中断。
    }
    indexes.names.add(String(row.name || '').toLowerCase());
    indexes.slugs.add(generateSlug(row.name || ''));
  }
  return indexes;
}

/**
 * 判断候选域名是否可以追加。
 * @param {string} domain 规范化域名。
 * @param {object} indexes 去重索引。
 * @returns {boolean} true 表示可追加。
 */
function canUse(domain, indexes) {
  if (!domain || BLOCKED_PATTERN.test(domain) || !isOverseasDomain(domain) || !isShoppingDomain(domain)) return false;
  const name = nameFromDomain(domain);
  return !indexes.domains.has(domain)
    && !indexes.names.has(name.toLowerCase())
    && !indexes.slugs.has(generateSlug(name));
}

/**
 * 追加记录后同步更新去重索引。
 * @param {object} record 新记录。
 * @param {object} indexes 去重索引。
 */
function addIndex(record, indexes) {
  const domain = normalizeDomain(new URL(record.url).hostname);
  indexes.domains.add(domain);
  indexes.names.add(String(record.name || '').toLowerCase());
  indexes.slugs.add(generateSlug(record.name || ''));
}

/**
 * 计算现有记录与电商购物信号的匹配分。
 * @param {object} row CSV 记录。
 * @returns {number} 匹配分。
 */
function scoreRow(row) {
  const text = Object.values(row).join(' ').toLowerCase();
  let score = 0;
  for (const signal of DOMESTIC_SIGNALS) {
    if (text.includes(signal.toLowerCase())) score += signal.length >= 4 ? 2 : 1;
  }
  return score;
}

/**
 * 统计电商购物主类当前国内和海外数量。
 * @param {object[]} rows CSV 记录。
 * @returns {{china: number, overseas: number, total: number}} 统计结果。
 */
function countTarget(rows) {
  const result = { china: 0, overseas: 0, total: 0 };
  for (const row of rows) {
    if (row.category_1 !== TARGET) continue;
    result.total += 1;
    if (row.region === CHINA) result.china += 1;
    else result.overseas += 1;
  }
  return result;
}

/**
 * 合并逗号字段并去重，避免重分配后丢失原标签。
 * @param {string} value 原字段。
 * @param {string[]} additions 新增值。
 * @param {number} limit 最大保留数量。
 * @returns {string} 合并后的字段。
 */
function mergeList(value, additions, limit) {
  const seen = new Set();
  const result = [];
  for (const raw of [...String(value || '').split(','), ...additions]) {
    const item = String(raw || '').trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result.join(',');
}

/**
 * 从生活服务国内余量中重分配电商购物相关记录。
 * @param {object[]} rows CSV 记录。
 * @param {number} need 需要重分配的数量。
 * @returns {number} 实际重分配数量。
 */
function reassignDomestic(rows, need) {
  const selected = rows
    .map((row, index) => ({ row, index, score: scoreRow(row) }))
    .filter((item) => item.row.category_1 === LIFE && item.row.region === CHINA && item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, need);

  for (const item of selected) {
    item.row.category_1 = TARGET;
    item.row.category_2 = LIFE;
    item.row.category_4 = TARGET;
    item.row.category_6 = '配额重分配';
    item.row.category_7 = '国内网站';
    item.row.category_8 = '单一主类';
    item.row.keywords = mergeList(item.row.keywords, [TARGET, '电商', '购物'], 15);
    item.row.tags = mergeList(item.row.tags, ['配额重分配', TARGET], 10);
  }
  return selected.length;
}

/**
 * 把公开排名域名转换为电商购物 CSV 记录。
 * @param {string} domain 规范化域名。
 * @param {number} rank Majestic 排名。
 * @param {number} refSubnets 引用子网数。
 * @param {number} refIps 引用 IP 数。
 * @returns {object} CSV 记录。
 */
function recordFromDomain(domain, rank, refSubnets, refIps) {
  const name = nameFromDomain(domain);
  const visits = Math.max(1000, Math.round(20_000_000 / Math.sqrt(Math.max(1, rank || 1)) + (refSubnets || 0) * 120));
  return {
    name,
    url: `https://${domain}`,
    short_summary: `${name} is an overseas ecommerce or shopping website selected from public domain ranking signals.`,
    full_description: `${name} was added on ${UPDATED_AT} from public domain ranking data. Its domain tokens match ecommerce, shopping, retail, marketplace, delivery, cart, coupon, or payment signals, so it is assigned to the ${TARGET} major category for directory discovery and later manual enrichment.`,
    category_1: TARGET,
    category_2: '跨境电商',
    category_3: '购物平台',
    category_4: TARGET,
    category_5: '商家工具',
    category_6: '配额补充',
    category_7: '海外网站',
    category_8: '公开排名候选',
    keywords: [name, domain, 'ecommerce', 'shopping', 'retail', 'marketplace', 'online store', 'coupon', 'delivery', TARGET].join(','),
    company: name,
    language: '英文',
    is_free: '未知',
    region: GLOBAL,
    launch_year: '',
    tags: ['公开排名', '海外网站', TARGET, '去重'].join(','),
    star_rating: String(rank && rank <= 100000 ? 4 : 3),
    monthly_visits: String(visits),
    screenshot_url: '',
    founder: '',
    headquarters: '',
    pricing_model: '未公开或需人工核验',
    alternatives: '',
    target_audience: 'ecommerce users,online shoppers,merchants,retail operators',
    features: 'ecommerce,shopping,online store,marketplace,retail discovery',
    platforms: 'Web',
    social_links: '',
    popularity_score: String(rank && rank <= 10000 ? 65 : rank && rank <= 100000 ? 50 : 35),
    popularity_level: rank && rank <= 10000 ? 'B' : 'C',
    popularity_rank: String(rank || 0),
    popularity_source: 'majestic_million_domain_signal',
    popularity_ref_subnets: String(refSubnets || 0),
    popularity_ref_ips: String(refIps || 0),
    popularity_updated_at: UPDATED_AT,
  };
}

/**
 * 从 Majestic Million 读取并追加本批海外电商候选。
 * @param {object[]} rows CSV 记录。
 * @param {object} indexes 去重索引。
 * @param {number} need 本批需要数量。
 * @returns {Promise<object>} 追加结果。
 */
async function appendBatch(rows, indexes, need) {
  return new Promise((resolve, reject) => {
    let added = 0;
    let seen = 0;
    let header = true;
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve({ added, seen });
    };

    const request = https.get(MAJESTIC, { headers: { 'User-Agent': 'site-nav-major-completer/1.0' } }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        finish(new Error(`Majestic HTTP ${response.statusCode}`));
        return;
      }

      const reader = readline.createInterface({ input: response, crlfDelay: Infinity });
      reader.on('line', (line) => {
        if (header) {
          header = false;
          return;
        }
        if (added >= need) {
          reader.close();
          request.destroy();
          return;
        }
        seen += 1;
        const columns = line.split(',');
        const domain = normalizeDomain(columns[2] || '');
        if (!canUse(domain, indexes)) return;
        const record = recordFromDomain(
          domain,
          Number.parseInt(columns[0], 10) || 0,
          Number.parseInt(columns[4], 10) || 0,
          Number.parseInt(columns[5], 10) || 0,
        );
        rows.push(record);
        addIndex(record, indexes);
        added += 1;
      });
      reader.on('close', () => finish());
      reader.on('error', finish);
    });

    request.setTimeout(600000, () => request.destroy(new Error('Majestic timeout')));
    request.on('error', (error) => {
      if (added > 0) resolve({ added, seen, error: error.code || error.message });
      else reject(error);
    });
  });
}

/**
 * 主流程：补国内缺口，再按批补海外缺口，最后写回 CSV。
 */
async function main() {
  const rows = readExistingCsv(CSV_PATH);
  const before = countTarget(rows);
  const needChina = Math.max(0, TARGET_CHINA - before.china);
  const movedChina = reassignDomestic(rows, needChina);
  const mid = countTarget(rows);
  const needOverseas = Math.min(BATCH_OVERSEAS, Math.max(0, TARGET_OVERSEAS - mid.overseas));
  const indexes = buildIndexes(rows);
  const overseasAppend = needOverseas ? await appendBatch(rows, indexes, needOverseas) : { added: 0, seen: 0 };
  const after = countTarget(rows);
  fs.writeFileSync(CSV_PATH, toCsv(rows), 'utf8');
  console.log(JSON.stringify({
    target: TARGET,
    before,
    moved_china: movedChina,
    requested_overseas: needOverseas,
    overseas_append: overseasAppend,
    after,
    total_rows: rows.length,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

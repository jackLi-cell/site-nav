/**
 * 国外网站批量追加脚本。
 *
 * 用途：
 * 1. 从公开 Majestic Million 域名排行中筛选非中国站点。
 * 2. 按现有导入模板生成 CSV 记录，并复用项目内的三重去重逻辑。
 * 3. 排除黄赌政、盗版、恶意、安全风险和明显不适合导航收录的候选。
 */

const fs = require('fs');
const https = require('https');
const readline = require('readline');
const {
  CSV_PATH,
  SEED_FILES,
  readExistingCsv,
  extractSeedDomains,
  appendUnique,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');

const DEFAULT_OVERSEAS_ADD_TARGET = 10000;
const OVERSEAS_ADD_TARGET = parsePositiveInteger(process.argv[2]) || parsePositiveInteger(process.env.OVERSEAS_ADD_TARGET) || DEFAULT_OVERSEAS_ADD_TARGET;
const MAJESTIC_MILLION_URL = 'https://downloads.majestic.com/majestic_million.csv';
const MAX_MAJESTIC_LINES = 1000000;

const FIELDS = [
  'name',
  'url',
  'short_summary',
  'full_description',
  'category_1',
  'category_2',
  'category_3',
  'category_4',
  'category_5',
  'category_6',
  'category_7',
  'category_8',
  'keywords',
  'company',
  'language',
  'is_free',
  'region',
  'launch_year',
  'tags',
  'star_rating',
  'monthly_visits',
  'screenshot_url',
  'founder',
  'headquarters',
  'pricing_model',
  'alternatives',
  'target_audience',
  'features',
  'platforms',
  'social_links',
  'popularity_score',
  'popularity_level',
  'popularity_rank',
  'popularity_source',
  'popularity_ref_subnets',
  'popularity_ref_ips',
  'popularity_updated_at',
];

const CHINA_DOMAIN_SUFFIXES = [
  '.cn',
  '.中国',
  '.香港',
  '.澳门',
  '.台湾',
  '.xn--fiqs8s',
  '.xn--j6w193g',
  '.xn--mix891f',
  '.xn--kpry57d',
];

const BLOCKED_TLD_SUFFIXES = [
  '.adult',
  '.porn',
  '.sex',
  '.sexy',
  '.xxx',
  '.casino',
  '.bet',
  '.poker',
  '.gov',
  '.mil',
];

const BLOCKED_EXACT_TOKENS = new Set([
  'adult',
  'porn',
  'porno',
  'sex',
  'xxx',
  'nsfw',
  'hentai',
  'escort',
  'dating',
  'casino',
  'gamble',
  'gambling',
  'bet',
  'betting',
  'poker',
  'lottery',
  'torrent',
  'pirate',
  'piracy',
  'warez',
  'crack',
  'keygen',
  'activation',
  'hack',
  'hacker',
  'malware',
  'exploit',
  'proxy',
  'vpn',
  'telegram',
  'tiktok',
  'binance',
  'coinbase',
  'crypto',
  'bitcoin',
  'forex',
  'weapon',
  'weapons',
  'gun',
  'guns',
  'gov',
  'government',
  'politic',
  'politics',
  'political',
  'election',
  'campaign',
  'party',
  'mil',
  'military',
  'army',
  'navy',
  'police',
  'court',
  'parliament',
  'senate',
  'congress',
  'ministry',
  'news',
]);

const BLOCKED_SUBSTRINGS = [
  'onlyfans',
  'porn',
  'hentai',
  'escort',
  'casino',
  'gambl',
  'lottery',
  'torrent',
  'pirat',
  'warez',
  'keygen',
  'malware',
  'exploit',
  'telegram',
  'tiktok',
  'binance',
  'coinbase',
  'bitcoin',
  'forex',
  'paydayloan',
  'weapon',
  'politic',
  'election',
  'government',
  'military',
];

const DOMESTIC_HINTS = [
  'baidu',
  'qq',
  'taobao',
  'tmall',
  'jd',
  'aliyun',
  'alipay',
  'tencent',
  'weixin',
  'wechat',
  'xiaomi',
  'huawei',
  'bilibili',
  'youku',
  'iqiyi',
  'douyin',
  'kuaishou',
  'zhihu',
  'weibo',
  'csdn',
  'juejin',
  'gitee',
  'oschina',
  '51cto',
  'netease',
  '163',
  'sina',
  'sohu',
  'bytedance',
  'toutiao',
  'meituan',
  'dianping',
  'ctrip',
  'ximalaya',
];

const GENERIC_LABELS = new Set([
  'www',
  'web',
  'app',
  'api',
  'cdn',
  'static',
  'img',
  'mail',
  'blog',
]);

const CATEGORY_RULES = [
  { pattern: /ai|gpt|llm|chatbot|robot|prompt|neural|ml|machinelearning/, categories: ['AI 工具', '开发者工具', '效率办公'], keywords: ['AI', 'global website', 'automation', 'online service', 'productivity'] },
  { pattern: /dev|code|coder|coding|git|api|sdk|tech|js|java|python|php|linux|mysql|redis|k8s|docker|stack|docs/, categories: ['开发者工具', '开源项目', '学习教育'], keywords: ['developer tools', 'programming', 'technology', 'documentation', 'online service'] },
  { pattern: /cloud|server|host|hosting|idc|dns|cdn|vps|ssl|domain|storage|backup/, categories: ['云服务', '域名主机', '开发者工具'], keywords: ['cloud service', 'hosting', 'infrastructure', 'domain', 'developer tools'] },
  { pattern: /design|ui|ux|icon|font|photo|image|img|pic|stock|creative|color|vector|logo/, categories: ['设计资源', '图片素材', '效率办公'], keywords: ['design resources', 'creative assets', 'images', 'icons', 'online tools'] },
  { pattern: /video|music|audio|media|podcast|stream|player|sound|record/, categories: ['影音娱乐', '视频工具', '社交媒体'], keywords: ['media', 'video', 'audio', 'content', 'online service'] },
  { pattern: /shop|store|market|commerce|cart|retail|deal|coupon|delivery|book/, categories: ['电商购物', '营销推广', '生活服务'], keywords: ['ecommerce', 'shopping', 'marketplace', 'service', 'products'] },
  { pattern: /job|jobs|career|resume|talent|hire|hiring|work|freelance|remote/, categories: ['求职招聘', '远程办公', '效率办公'], keywords: ['jobs', 'career', 'remote work', 'hiring', 'professional service'] },
  { pattern: /edu|learn|course|school|university|academy|tutorial|training|study|science|math/, categories: ['学习教育', '写作工具', '数据分析'], keywords: ['learning', 'education', 'courses', 'knowledge', 'resources'] },
  { pattern: /data|analytics|chart|map|report|index|bigdata|insight|metrics|stat/, categories: ['数据分析', '搜索引擎', '营销推广'], keywords: ['data analytics', 'reports', 'insights', 'metrics', 'tools'] },
  { pattern: /mail|email|newsletter|smtp|postmark|inbox|message/, categories: ['邮件工具', '效率办公', '网络安全'], keywords: ['email', 'communication', 'newsletter', 'office tools', 'online service'] },
  { pattern: /safe|security|sec|password|auth|identity|privacy|scan|ssl|verify/, categories: ['网络安全', '开发者工具', '效率办公'], keywords: ['security', 'privacy', 'authentication', 'protection', 'tools'] },
  { pattern: /doc|pdf|file|drive|disk|office|word|excel|ppt|note|wiki|form/, categories: ['文件工具', '效率办公', '云服务'], keywords: ['file tools', 'documents', 'office', 'collaboration', 'online service'] },
  { pattern: /health|med|doctor|clinic|wellness|fitness|care|nutrition/, categories: ['健康医疗', '学习教育', '生活服务'], keywords: ['health', 'wellness', 'medical information', 'lifestyle', 'reference'] },
  { pattern: /pay|bank|finance|money|fund|invoice|accounting|tax|billing/, categories: ['金融理财', '数据分析', '生活服务'], keywords: ['finance', 'payment', 'billing', 'accounting', 'service'] },
  { pattern: /crm|seo|sem|ad|ads|marketing|growth|brand|sales|campaigns/, categories: ['营销推广', '数据分析', '创业工具'], keywords: ['marketing', 'growth', 'brand', 'sales', 'analytics'] },
  { pattern: /startup|venture|product|maker|launch|founder|incubator|innovation/, categories: ['创业工具', '效率办公', '营销推广'], keywords: ['startup tools', 'product', 'business', 'growth', 'service'] },
  { pattern: /search|find|lookup|directory|nav|engine|discover/, categories: ['搜索引擎', '生活服务', '数据分析'], keywords: ['search', 'directory', 'discovery', 'lookup', 'online service'] },
  { pattern: /translate|dict|language|grammar|writing|word|text|copy/, categories: ['翻译语言', '写作工具', '学习教育'], keywords: ['translation', 'language', 'writing', 'grammar', 'learning'] },
  { pattern: /meeting|team|collab|project|task|calendar|workspace|office/, categories: ['远程办公', '效率办公', '文件工具'], keywords: ['remote work', 'collaboration', 'team', 'office', 'productivity'] },
  { pattern: /social|community|forum|club|creator|profile|network/, categories: ['社交媒体', '营销推广', '生活服务'], keywords: ['community', 'social media', 'content', 'creator', 'network'] },
];

// 解析命令行或环境变量中的新增数量，非法值回落到默认值。
function parsePositiveInteger(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number;
}

// 构建现有数据索引，新增记录必须同时通过域名、名称和 slug 去重。
function buildIndexes(rows) {
  const indexes = {
    domains: new Set(),
    names: new Set(),
    slugs: new Set(),
    seedDomains: extractSeedDomains(SEED_FILES),
  };

  for (const row of rows) {
    try {
      indexes.domains.add(normalizeDomain(new URL(row.url).hostname));
    } catch {
      // 非法 URL 会由导入校验暴露，这里只避免索引构建中断。
    }
    indexes.names.add(String(row.name || '').toLowerCase());
    indexes.slugs.add(generateSlug(row.name || ''));
  }

  return indexes;
}

// 判断域名是否属于中国范围或明显中国平台，保证本脚本只补充国外站点。
function isChinaRelatedDomain(domain) {
  if (CHINA_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix))) return true;
  return DOMESTIC_HINTS.some((hint) => domain.includes(hint));
}

// 将域名拆成可检查的 token，避免用过宽的字符串匹配造成大量误杀。
function getDomainTokens(domain) {
  return domain
    .split(/[.\-_]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

// 对候选域名做保守风控过滤，黄赌政、盗版、恶意、安全风险和纯噪声域名都会跳过。
function shouldSkipDomain(domain) {
  if (!domain) return true;
  if (isChinaRelatedDomain(domain)) return true;
  if (BLOCKED_TLD_SUFFIXES.some((suffix) => domain.endsWith(suffix))) return true;
  if (/[^\x00-\x7F]/.test(domain)) return true;

  const label = getMainLabel(domain);
  if (!label || label.length < 2 || label.length > 34) return true;
  if (GENERIC_LABELS.has(label)) return true;
  if (/^\d+$/.test(label)) return true;
  if ((label.match(/\d/g) || []).length / label.length > 0.45) return true;
  if (/^[a-f0-9]{16,}$/.test(label)) return true;
  if (/(.)\1{4,}/.test(label)) return true;
  if (/[qxz]{4,}/.test(label)) return true;

  const tokens = getDomainTokens(domain);
  if (tokens.some((token) => BLOCKED_EXACT_TOKENS.has(token))) return true;
  return BLOCKED_SUBSTRINGS.some((part) => domain.includes(part));
}

// 提取用于名称、分类和 slug 判断的主域名标签。
function getMainLabel(domain) {
  const parts = domain.split('.');
  if (domain.endsWith('.co.uk') || domain.endsWith('.com.au') || domain.endsWith('.com.br') || domain.endsWith('.co.jp') || domain.endsWith('.co.in')) {
    return parts.at(-3) || '';
  }
  return parts.at(-2) || '';
}

// 根据域名生成简洁可读的网站名称，避免虚构公司主体。
function buildName(domain) {
  const label = getMainLabel(domain);
  if (!label) return domain;
  if (label.length <= 4) return label.toUpperCase();
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || domain;
}

// 通过域名关键词推断站点分类；无法判断时放入通用效率/生活服务类。
function inferProfile(domain) {
  const label = getMainLabel(domain);
  const text = domain.replace(/\./g, ' ');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text) || rule.pattern.test(label)) {
      return {
        categories: rule.categories,
        keywords: rule.keywords,
      };
    }
  }
  return {
    categories: ['效率办公', '生活服务', '搜索引擎'],
    keywords: ['global website', 'online service', 'productivity', 'tools', 'web resources'],
  };
}

// 根据顶级域名粗略标记服务地区，避免把所有国外站点都写成同一个区域。
function inferRegion(domain) {
  if (domain.endsWith('.us')) return '美国';
  if (domain.endsWith('.uk') || domain.endsWith('.co.uk')) return '英国';
  if (domain.endsWith('.eu') || /\.(de|fr|it|es|nl|se|no|fi|dk|pl|ch|at|be)$/.test(domain)) return '欧洲';
  if (domain.endsWith('.in') || domain.endsWith('.co.in')) return '印度';
  return '全球';
}

// 将合规域名转换为导入模板记录，描述保持克制，不编造无法确认的细节。
function domainToRecord(domain) {
  const name = buildName(domain);
  const profile = inferProfile(domain);
  const categories = profile.categories;
  const keywords = Array.from(new Set([name, ...profile.keywords])).slice(0, 8).join(',');

  return {
    name,
    url: `https://${domain}`,
    short_summary: `${name} 是一个国外网站，提供与${categories[0]}相关的在线服务、工具或信息入口。`,
    full_description: '',
    category_1: categories[0],
    category_2: categories[1] || '',
    category_3: categories[2] || '',
    keywords,
    is_free: '部分免费',
    language: '英文',
    region: inferRegion(domain),
    company: '',
    launch_year: '',
  };
}

// 补齐字段顺序，防止写回 CSV 时出现缺列或列错位。
function normalizeRecord(record) {
  const normalized = {};
  for (const field of FIELDS) {
    normalized[field] = record[field] || '';
  }
  return normalized;
}

// 流式读取 Majestic Million，边筛选边追加，避免一次性加载百万行。
async function appendFromMajestic(rows, indexes, needed) {
  return new Promise((resolve, reject) => {
    let added = 0;
    let lineNumber = 0;
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      resolve(added);
    };

    const request = https.get(MAJESTIC_MILLION_URL, {
      headers: {
        'user-agent': 'site-nav-overseas-collector/1.0',
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
        if (added >= needed) return;
        lineNumber += 1;
        if (lineNumber === 1) return;
        if (lineNumber > MAX_MAJESTIC_LINES) {
          request.destroy();
          reader.close();
          return;
        }

        const columns = line.split(',');
        const domain = normalizeDomain(columns[2] || '');
        if (shouldSkipDomain(domain)) return;
        if (appendUnique(rows, normalizeRecord(domainToRecord(domain)), indexes, { allowSeedDomain: false })) {
          added += 1;
          if (added % 1000 === 0) {
            console.log(`已新增国外网站：${added}/${needed}`);
          }
        }
        if (added >= needed) {
          request.destroy();
          reader.close();
        }
      });
      reader.on('close', done);
      reader.on('error', reject);
    });

    request.on('error', (error) => {
      if (isExpectedEarlyClose(error) && added >= needed) {
        done();
        return;
      }
      reject(error);
    });
  });
}

// request.destroy() 用于达到目标后提前结束下载，这类错误不应视为失败。
function isExpectedEarlyClose(error) {
  return error && ['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE'].includes(error.code);
}

// 主流程：读取现有 CSV，追加指定数量国外站点，最后以 UTF-8 无 BOM 写回。
async function main() {
  const rows = readExistingCsv(CSV_PATH).map(normalizeRecord);
  const initialCount = rows.length;
  const indexes = buildIndexes(rows);
  const added = await appendFromMajestic(rows, indexes, OVERSEAS_ADD_TARGET);

  if (added < OVERSEAS_ADD_TARGET) {
    throw new Error(`国外候选不足：目标新增 ${OVERSEAS_ADD_TARGET} 条，实际新增 ${added} 条，当前总数 ${rows.length}`);
  }

  fs.writeFileSync(CSV_PATH, toCsv(rows), 'utf8');
  console.log(`国外网站追加完成：原 ${initialCount} 条，新增 ${added} 条，当前 ${rows.length} 条。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

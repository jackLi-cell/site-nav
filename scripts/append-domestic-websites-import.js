/**
 * 国内网站批量追加脚本。
 *
 * 用途：
 * 1. 从公开 Majestic Million 域名排行中筛选 .cn / .com.cn / .net.cn 等中国域名。
 * 2. 在现有 CSV 基础上追加国内网站，目标总量为 15000 条。
 * 3. 按域名、名称、slug 三重去重，并排除黄赌政、盗版、恶意、安全风险较高的候选。
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');
const { parse } = require('csv-parse/sync');
const {
  CSV_PATH,
  SEED_FILES,
  extractSeedDomains,
  appendUnique,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');

const MIN_TARGET_TOTAL = 15000;
const DEFAULT_DOMESTIC_ADD_TARGET = 10000;
const DOMESTIC_ADD_TARGET = parsePositiveInteger(process.argv[2]) || parsePositiveInteger(process.env.DOMESTIC_ADD_TARGET) || DEFAULT_DOMESTIC_ADD_TARGET;
const MAJESTIC_MILLION_URL = 'https://downloads.majestic.com/majestic_million.csv';
const CHINA_DOMAIN_LIST_URL = 'https://raw.githubusercontent.com/carrnot/china-domain-list/release/domain.txt';

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

const CHINA_TLD_PATTERN = /(^|\.)cn$/;
const CHINA_SECOND_LEVEL_PATTERN = /\.(com|net|org|edu|ac)\.cn$/;
const COMMON_CHINA_LIST_TLD_PATTERN = /\.(com|net|org|cn)$/;
const GENERIC_LABELS = new Set(['www', 'web', 'app', 'api', 'm', 'wap', 'static', 'cdn', 'img', 'mail', 'bbs']);

const BLOCKED_DOMAIN_PARTS = [
  'adult',
  'porn',
  'sex',
  'xxx',
  'casino',
  'gamble',
  'gambling',
  'bet',
  'betting',
  'lottery',
  'caipiao',
  'sporttery',
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
  'loan-shark',
  'gov',
  'government',
  'dang',
  'party',
  'cpc',
  'police',
  'court',
  'procuratorate',
  'xinhuanet',
  'people',
  'cctv',
  'cntv',
  'mil',
  'army',
  'mod',
  'weapon',
  'gun',
  'game',
  'manhua',
  'comic',
  'anime',
  'dongman',
  'movie',
  'film',
  'vod',
  'zhibo',
  'tiyu',
  'sport',
];

const BLOCKED_DOMAIN_SUFFIXES = [
  '.gov.cn',
  '.mil.cn',
];

const FALLBACK_DOMESTIC_DOMAINS = [
  'baidu.com',
  'qq.com',
  'taobao.com',
  'tmall.com',
  'jd.com',
  'mi.com',
  'xiaomi.com',
  'huawei.com',
  'aliyun.com',
  'alipay.com',
  'youku.com',
  'iqiyi.com',
  'bilibili.com',
  'douban.com',
  'zhihu.com',
  'jianshu.com',
  'oschina.net',
  'gitee.com',
  'segmentfault.com',
  'juejin.cn',
  'csdn.net',
  'cnblogs.com',
  'runoob.com',
  '36kr.com',
  'huxiu.com',
  'ifanr.com',
  'sspai.com',
  'zol.com.cn',
  'yesky.com',
  '51cto.com',
  'imooc.com',
  'xuetangx.com',
  'icourse163.org',
  'lagou.com',
  'zhipin.com',
  'liepin.com',
  '51job.com',
  'maimai.cn',
  'qiniu.com',
  'ucloud.cn',
  'qingcloud.com',
  'dnspod.cn',
  'west.cn',
  'ename.net',
  'now.cn',
  'processon.com',
  'shimo.im',
  'teambition.com',
  'tower.im',
];

const CATEGORY_RULES = [
  { pattern: /ai|aigc|gpt|llm|robot|bot|zhineng|smart/, categories: ['AI 工具', '开发者工具', '效率办公'], keywords: ['AI', '智能工具', '国内网站', '在线服务', '效率'] },
  { pattern: /dev|code|coder|coding|git|api|sdk|tech|js|java|python|php|linux|mysql|redis|k8s/, categories: ['开发者工具', '开源项目', '学习教育'], keywords: ['开发者工具', '技术', '编程', '国内网站', '在线服务'] },
  { pattern: /cloud|yun|server|host|idc|dns|cdn|vps|ssl|domain/, categories: ['云服务', '域名主机', '开发者工具'], keywords: ['云服务', '主机', '域名', '国内网站', '基础设施'] },
  { pattern: /design|ui|ux|icon|font|photo|image|img|pic|sucai|sheji/, categories: ['设计资源', '图片素材', '效率办公'], keywords: ['设计资源', '素材', '图片', '国内网站', '创意'] },
  { pattern: /video|tv|music|audio|movie|film|live|media|yinyue|shipin|yingyin/, categories: ['影音娱乐', '视频工具', '社交媒体'], keywords: ['影音娱乐', '视频', '媒体', '国内网站', '内容'] },
  { pattern: /shop|mall|store|buy|sale|b2b|b2c|tao|gou|youhui|coupon|market/, categories: ['电商购物', '营销推广', '生活服务'], keywords: ['电商', '购物', '商品', '国内网站', '服务'] },
  { pattern: /job|jobs|hr|zhaopin|career|resume|liepin|rencai|work/, categories: ['求职招聘', '远程办公', '效率办公'], keywords: ['招聘', '求职', '职业', '国内网站', '人才'] },
  { pattern: /edu|xue|study|school|university|course|kecheng|kaoshi|peixun|learn/, categories: ['学习教育', '写作工具', '文件工具'], keywords: ['学习教育', '课程', '知识', '国内网站', '资料'] },
  { pattern: /data|analytics|tongji|chart|map|report|index|bigdata|shuju/, categories: ['数据分析', '搜索引擎', '营销推广'], keywords: ['数据分析', '统计', '报告', '国内网站', '工具'] },
  { pattern: /mail|email|newsletter|smtp|post/, categories: ['邮件工具', '效率办公', '网络安全'], keywords: ['邮件', '通信', '办公', '国内网站', '工具'] },
  { pattern: /safe|security|sec|password|auth|privacy|scan|ssl|anquan/, categories: ['网络安全', '开发者工具', '效率办公'], keywords: ['网络安全', '隐私', '检测', '国内网站', '工具'] },
  { pattern: /doc|docs|pdf|file|pan|drive|disk|office|word|excel|ppt|wendang/, categories: ['文件工具', '效率办公', '云服务'], keywords: ['文件工具', '办公', '文档', '国内网站', '在线服务'] },
  { pattern: /health|med|doctor|hospital|clinic|yao|yiliao|jiankang/, categories: ['健康医疗', '学习教育', '生活服务'], keywords: ['健康医疗', '科普', '医疗', '国内网站', '生活'] },
  { pattern: /pay|bank|finance|money|fund|stock|insure|caifu|licai/, categories: ['金融理财', '数据分析', '生活服务'], keywords: ['金融理财', '支付', '数据', '国内网站', '服务'] },
  { pattern: /crm|seo|sem|ad|ads|market|yingxiao|growth|brand/, categories: ['营销推广', '数据分析', '创业工具'], keywords: ['营销推广', '增长', '品牌', '国内网站', '运营'] },
  { pattern: /startup|chuangye|incubator|vc|product|maker|chuangxin/, categories: ['创业工具', '效率办公', '营销推广'], keywords: ['创业工具', '产品', '增长', '国内网站', '服务'] },
  { pattern: /search|soso|so|find|cha|chaxun|hao|nav/, categories: ['搜索引擎', '生活服务', '数据分析'], keywords: ['搜索', '查询', '导航', '国内网站', '工具'] },
  { pattern: /translate|dict|fanyi|language|yingyu|word/, categories: ['翻译语言', '写作工具', '学习教育'], keywords: ['翻译', '语言', '词典', '国内网站', '学习'] },
  { pattern: /remote|meeting|team|work|oa|xiezuo|office/, categories: ['远程办公', '效率办公', '文件工具'], keywords: ['远程办公', '协作', '团队', '国内网站', '办公'] },
  { pattern: /social|sns|club|community|shequ|luntan|forum/, categories: ['社交媒体', '营销推广', '生活服务'], keywords: ['社交媒体', '社区', '内容', '国内网站', '互动'] },
];

// 解析命令行或环境变量传入的新增数量，非法值直接回落到默认值。
function parsePositiveInteger(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number;
}

// 读取现有 CSV，保留已有人工确认数据，并补齐字段避免写回时列错位。
function readExistingRows() {
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }).map((row) => {
    const normalized = {};
    for (const field of FIELDS) {
      normalized[field] = row[field] || '';
    }
    return normalized;
  });
}

// 构建跨批次去重索引，新增国内网站必须同时通过域名、名称、slug 三重检查。
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
      // 非法 URL 会在导入校验中暴露，这里只避免索引构建中断。
    }
    indexes.names.add(row.name.toLowerCase());
    indexes.slugs.add(generateSlug(row.name));
  }

  return indexes;
}

// 判断域名是否属于本次要追加的国内域名范围。
function isDomesticDomain(domain) {
  return CHINA_TLD_PATTERN.test(domain) || CHINA_SECOND_LEVEL_PATTERN.test(domain);
}

// 保守过滤高风险域名，黄赌政、盗版、恶意、代理和高风险金融交易相关候选不进入 CSV。
function shouldSkipDomain(domain, options = {}) {
  if (!domain) return true;
  const isFallbackDomestic = FALLBACK_DOMESTIC_DOMAINS.includes(domain);
  const isChinaListDomain = options.allowCommonTld && COMMON_CHINA_LIST_TLD_PATTERN.test(domain);
  if (!isDomesticDomain(domain) && !isFallbackDomestic && !isChinaListDomain) return true;
  if (BLOCKED_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix))) return true;
  if (BLOCKED_DOMAIN_PARTS.some((part) => domain.includes(part))) return true;
  const label = getMainLabel(domain);
  if (!label || label.length < 2 || GENERIC_LABELS.has(label)) return true;
  if (/^\d+$/.test(label)) return true;
  if (/[^\x00-\x7F]/.test(label)) return true;
  if (label.length > 30) return true;
  if ((label.match(/\d/g) || []).length / label.length > 0.45) return true;
  if (/^[a-f0-9]{16,}$/.test(label)) return true;
  if (/(.)\1{4,}/.test(label)) return true;
  if (/[qxz]{4,}/.test(label)) return true;
  return false;
}

// 从域名里提取主识别标签，用于生成显示名称和分类判断。
function getMainLabel(domain) {
  const parts = domain.split('.');
  if (domain.endsWith('.com.cn') || domain.endsWith('.net.cn') || domain.endsWith('.org.cn') || domain.endsWith('.edu.cn') || domain.endsWith('.ac.cn')) {
    return parts.at(-3) || '';
  }
  return parts.at(-2) || '';
}

// 根据域名主标签生成可读名称，优先保留品牌拼音和缩写，不虚构公司主体。
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

// 根据域名关键词推断分类；无法判断时归入生活服务，避免虚构具体业务类型。
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
    categories: ['生活服务', '效率办公', '搜索引擎'],
    keywords: ['国内网站', '在线服务', '生活服务', '工具', '信息查询'],
  };
}

// 将域名转换为导入模板需要的完整记录，描述保持客观克制。
function domainToRecord(domain) {
  const name = buildName(domain);
  const profile = inferProfile(domain);
  const categories = profile.categories;
  const keywords = Array.from(new Set([name, ...profile.keywords])).slice(0, 8).join(',');
  return {
    name,
    url: `https://${domain}`,
    short_summary: `${name} 是一个国内网站，提供与${categories[0]}相关的在线服务或信息入口。`,
    full_description: '',
    category_1: categories[0],
    category_2: categories[1] || '',
    category_3: categories[2] || '',
    keywords,
    is_free: '部分免费',
    language: '中文',
    region: '中国',
    company: '',
    launch_year: '',
  };
}

// 流式读取 Majestic Million，避免一次性把百万域名文件全部载入内存。
async function collectDomesticDomains(limit) {
  return new Promise((resolve, reject) => {
    const domains = [];
    const request = https.get(MAJESTIC_MILLION_URL, {
      headers: {
        'user-agent': 'site-nav-domestic-collector/1.0',
        accept: 'text/csv,*/*',
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`下载 Majestic Million 失败：HTTP ${response.statusCode}`));
        return;
      }

      let lineNumber = 0;
      const reader = readline.createInterface({ input: response, crlfDelay: Infinity });
      reader.on('line', (line) => {
        lineNumber += 1;
        if (lineNumber === 1) return;
        const columns = line.split(',');
        const domain = normalizeDomain(columns[2] || '');
        if (shouldSkipDomain(domain)) return;
        domains.push(domain);
        if (domains.length % 1000 === 0) {
          console.log(`已筛选国内候选：${domains.length}/${limit}`);
        }
        if (domains.length >= limit) {
          request.destroy();
          reader.close();
        }
      });
      reader.on('close', () => resolve(domains));
      reader.on('error', reject);
    });

    request.on('error', (error) => {
      if (domainsEnoughError(error)) {
        resolve([]);
        return;
      }
      reject(error);
    });
  });
}

// 流式读取 china-domain-list，在 Majestic 候选耗尽后作为国内常见域名补充来源。
async function collectChinaDomainListDomains(limit) {
  return new Promise((resolve, reject) => {
    const domains = [];
    const request = https.get(CHINA_DOMAIN_LIST_URL, {
      headers: {
        'user-agent': 'site-nav-domestic-collector/1.0',
        accept: 'text/plain,*/*',
      },
    }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`下载 China Domain List 失败：HTTP ${response.statusCode}`));
        return;
      }

      const reader = readline.createInterface({ input: response, crlfDelay: Infinity });
      reader.on('line', (line) => {
        const domain = normalizeDomain(line);
        if (shouldSkipDomain(domain, { allowCommonTld: true })) return;
        domains.push(domain);
        if (domains.length % 1000 === 0) {
          console.log(`已筛选国内补充候选：${domains.length}/${limit}`);
        }
        if (domains.length >= limit) {
          request.destroy();
          reader.close();
        }
      });
      reader.on('close', () => resolve(domains));
      reader.on('error', reject);
    });

    request.on('error', (error) => {
      if (domainsEnoughError(error)) {
        resolve(domains);
        return;
      }
      reject(error);
    });
  });
}

// request.destroy() 用于提前结束下载；这里不把主动中断当成采集失败。
function domainsEnoughError(error) {
  return error && ['ECONNRESET', 'ERR_STREAM_PREMATURE_CLOSE'].includes(error.code);
}

// 主流程：读取现有 CSV，按传入数量追加国内网站，并写回导入文件。
async function main() {
  const rows = readExistingRows();
  const initialCount = rows.length;
  const target = Math.max(MIN_TARGET_TOTAL, initialCount + DOMESTIC_ADD_TARGET);
  const indexes = buildIndexes(rows);
  const needed = target - rows.length;
  const candidates = await collectDomesticDomains(needed * 3);

  let added = 0;
  for (const domain of candidates) {
    if (rows.length >= target) break;
    const record = domainToRecord(domain);
    if (appendUnique(rows, record, indexes, { allowSeedDomain: false })) {
      added += 1;
    }
  }

  if (rows.length < target) {
    const supplementNeeded = target - rows.length;
    const supplementCandidates = await collectChinaDomainListDomains(supplementNeeded * 4);
    for (const domain of supplementCandidates) {
      if (rows.length >= target) break;
      const record = domainToRecord(domain);
      if (appendUnique(rows, record, indexes, { allowSeedDomain: false })) {
        added += 1;
      }
    }
  }

  for (const domain of FALLBACK_DOMESTIC_DOMAINS) {
    if (rows.length >= target) break;
    if (shouldSkipDomain(domain)) continue;
    const record = domainToRecord(domain);
    if (appendUnique(rows, record, indexes, { allowSeedDomain: false })) {
      added += 1;
    }
  }

  if (rows.length < target) {
    throw new Error(`国内候选不足：目标新增 ${DOMESTIC_ADD_TARGET} 条，实际新增 ${added} 条，当前总数 ${rows.length}`);
  }

  fs.writeFileSync(CSV_PATH, toCsv(rows), 'utf8');
  console.log(`国内网站追加完成：原 ${initialCount} 条，新增 ${added} 条，当前 ${rows.length} 条。`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

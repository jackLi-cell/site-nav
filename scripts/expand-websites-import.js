/**
 * 网站候选数据扩容脚本
 *
 * 用途：
 * 1. 保留现有 data/websites-import.csv 中已人工确认的数据。
 * 2. 从公开整理目录抓取候选网站。
 * 3. 按域名、名称和 slug 去重，并过滤明显高风险候选。
 * 4. 生成满足导入模板的 5000 条 CSV。
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const TARGET_TOTAL = 5000;
const CSV_PATH = path.join(__dirname, '../data/websites-import.csv');
const SEED_FILES = [
  path.join(__dirname, '../drizzle/seed.sql'),
  path.join(__dirname, '../drizzle/seed-extended.sql'),
];

const SOURCES = [
  {
    name: 'awesome-useful-websites',
    url: 'https://raw.githubusercontent.com/atakanaltok/awesome-useful-websites/main/README.md',
  },
  {
    name: 'design-resources-for-developers',
    url: 'https://raw.githubusercontent.com/bradtraversy/design-resources-for-developers/master/readme.md',
  },
  {
    name: 'free-for-dev',
    url: 'https://raw.githubusercontent.com/ripienaar/free-for-dev/master/README.md',
  },
  {
    name: 'best-websites-programmer',
    url: 'https://raw.githubusercontent.com/sdmg15/Best-websites-a-programmer-should-visit/master/README.md',
  },
  {
    name: 'public-apis',
    url: 'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md',
  },
  {
    name: 'awesome-selfhosted',
    url: 'https://raw.githubusercontent.com/awesome-selfhosted/awesome-selfhosted/master/README.md',
  },
  {
    name: 'awesome-sysadmin',
    url: 'https://raw.githubusercontent.com/kahun/awesome-sysadmin/master/README.md',
  },
  {
    name: 'frontend-dev-bookmarks',
    url: 'https://raw.githubusercontent.com/dypsilon/frontend-dev-bookmarks/master/README.md',
  },
  {
    name: 'awesome-datascience',
    url: 'https://raw.githubusercontent.com/academic/awesome-datascience/master/README.md',
  },
  {
    name: 'awesome-machine-learning',
    url: 'https://raw.githubusercontent.com/josephmisiti/awesome-machine-learning/master/README.md',
  },
  {
    name: 'awesome-bigdata',
    url: 'https://raw.githubusercontent.com/onurakpolat/awesome-bigdata/master/README.md',
  },
  {
    name: 'awesome-dataviz',
    url: 'https://raw.githubusercontent.com/fasouto/awesome-dataviz/master/README.md',
  },
  {
    name: 'awesome-design-tools',
    url: 'https://raw.githubusercontent.com/goabstract/Awesome-Design-Tools/master/README.md',
  },
  {
    name: 'awesome-learning-resources',
    url: 'https://raw.githubusercontent.com/lauragift21/awesome-learning-resources/master/README.md',
  },
  {
    name: 'awesome-nodejs',
    url: 'https://raw.githubusercontent.com/sindresorhus/awesome-nodejs/main/readme.md',
  },
  {
    name: 'awesome-python',
    url: 'https://raw.githubusercontent.com/vinta/awesome-python/master/README.md',
  },
  {
    name: 'awesome-javascript',
    url: 'https://raw.githubusercontent.com/sorrycc/awesome-javascript/master/README.md',
  },
  {
    name: 'project-based-learning',
    url: 'https://raw.githubusercontent.com/practical-tutorials/project-based-learning/master/README.md',
  },
  {
    name: 'free-programming-books',
    url: 'https://raw.githubusercontent.com/EbookFoundation/free-programming-books/main/books/free-programming-books-langs.md',
  },
  {
    name: 'awesome-oss-alternatives',
    url: 'https://raw.githubusercontent.com/RunaCapital/awesome-oss-alternatives/master/README.md',
  },
  {
    name: 'awesome-lowcode',
    url: 'https://raw.githubusercontent.com/antdimot/awesome-lowcode/master/README.md',
  },
  {
    name: 'awesome-productivity',
    url: 'https://raw.githubusercontent.com/jyguyomarch/awesome-productivity/master/README.md',
  },
  {
    name: 'awesome-remote-job',
    url: 'https://raw.githubusercontent.com/lukasz-madon/awesome-remote-job/master/README.md',
  },
  {
    name: 'awesome-newsletters',
    url: 'https://raw.githubusercontent.com/zudochkin/awesome-newsletters/master/README.md',
  },
  {
    name: 'awesome-stock-resources',
    url: 'https://raw.githubusercontent.com/neutraltone/awesome-stock-resources/master/README.md',
  },
  {
    name: 'awesome-design-systems',
    url: 'https://raw.githubusercontent.com/alexpate/awesome-design-systems/master/README.md',
  },
  {
    name: 'awesome-analytics',
    url: 'https://raw.githubusercontent.com/onurakpolat/awesome-analytics/master/README.md',
  },
];

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

const BLOCKED_WORDS = [
  'adult',
  'porn',
  'sex',
  'xxx',
  'casino',
  'gambl',
  'betting',
  'lottery',
  'torrent',
  'pirate',
  'piracy',
  'warez',
  'crack',
  'keygen',
  'activation',
  'drama free',
  'wcostream',
  'ustvgo',
  'anime streaming',
  'top anime streaming',
  'free cartoon',
  'free live tv',
  'iptv',
  'proxy',
  'vpn',
  'telegram',
  'tiktok',
  'binance',
  'coinbase',
  'temu',
  'shein',
  'crypto',
  'bitcoin',
  'forex',
  'politic',
  'government',
  'election',
  'campaign',
  'military',
  'weapon',
  'guns',
  'nsfw',
  'dating',
  'escort',
  'exploit',
  'malware',
];

const EXCLUDED_HEADINGS = new Set([
  'Anime',
  'Movies and Series',
  'URL Shortener',
  'Disposable Email',
  'X / Twitter',
  'Reddit',
  'Economy',
  'Finance',
  'Government',
  'Politics',
  'Cryptocurrency',
  'Blockchain',
  'Dating',
]);

const BLOCKED_DOMAINS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'npmjs.com',
  'pypi.org',
  'packagist.org',
  'crates.io',
  'rubygems.org',
  'medium.com',
  'reddit.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  't.me',
  'telegram.me',
  'discord.gg',
  'youtube.com',
  'youtu.be',
  'wikipedia.org',
  'archive.org',
  'web.archive.org',
  'localhost',
];

const GENERIC_LINK_NAMES = new Set([
  'website',
  'homepage',
  'home page',
  'docs',
  'documentation',
  'readme',
  'repo',
  'repository',
  'source',
  'source code',
  'demo',
  'api',
  'link',
  'here',
  'official website',
]);

const CATEGORY_ALIASES = new Map([
  ['AI 工具', ['AI 工具', '开发者工具', '写作工具']],
  ['开发者工具', ['开发者工具', '开源项目', '学习教育']],
  ['设计资源', ['设计资源', '图片素材', '开发者工具']],
  ['效率办公', ['效率办公', '远程办公', '文件工具']],
  ['云服务', ['云服务', '开发者工具', '域名主机']],
  ['数据分析', ['数据分析', '学习教育', '营销推广']],
  ['营销推广', ['营销推广', '数据分析', '社交媒体']],
  ['学习教育', ['学习教育', '写作工具', '数据分析']],
  ['开源项目', ['开源项目', '开发者工具', '学习教育']],
  ['搜索引擎', ['搜索引擎', '数据分析', '学习教育']],
  ['代码托管', ['代码托管', '开发者工具', '开源项目']],
  ['创业工具', ['创业工具', '数据分析', '营销推广']],
  ['社交媒体', ['社交媒体', '营销推广', '生活服务']],
  ['影音娱乐', ['影音娱乐', '视频工具', '社交媒体']],
  ['电商购物', ['电商购物', '营销推广', '生活服务']],
  ['新闻资讯', ['新闻资讯', '学习教育', '数据分析']],
  ['金融理财', ['金融理财', '数据分析', '学习教育']],
  ['求职招聘', ['求职招聘', '远程办公', '效率办公']],
  ['生活服务', ['生活服务', '学习教育', '数据分析']],
  ['写作工具', ['写作工具', '效率办公', '翻译语言']],
  ['图片素材', ['图片素材', '设计资源', '视频工具']],
  ['视频工具', ['视频工具', '设计资源', '营销推广']],
  ['网络安全', ['网络安全', '开发者工具', '效率办公']],
  ['远程办公', ['远程办公', '效率办公', '视频工具']],
  ['邮件工具', ['邮件工具', '效率办公', '网络安全']],
  ['域名主机', ['域名主机', '云服务', '开发者工具']],
  ['低代码平台', ['低代码平台', '效率办公', '开发者工具']],
  ['翻译语言', ['翻译语言', '写作工具', '学习教育']],
  ['文件工具', ['文件工具', '效率办公', '云服务']],
  ['健康医疗', ['健康医疗', '学习教育', '生活服务']],
]);

const KEYWORD_BY_CATEGORY = new Map([
  ['AI 工具', ['AI', '智能工具', '生成式AI', '自动化', '在线服务']],
  ['开发者工具', ['开发', '编程', '工具', '技术', '效率']],
  ['设计资源', ['设计', 'UI', '素材', '灵感', '创意']],
  ['效率办公', ['效率', '办公', '协作', '任务', '工具']],
  ['云服务', ['云服务', '托管', '基础设施', '服务器', '开发']],
  ['数据分析', ['数据', '分析', '可视化', '报表', '研究']],
  ['营销推广', ['营销', '推广', '增长', '内容', '运营']],
  ['学习教育', ['学习', '教育', '课程', '知识', '资料']],
  ['开源项目', ['开源', '项目', '代码', '社区', '软件']],
  ['搜索引擎', ['搜索', '发现', '检索', '资料', '工具']],
  ['代码托管', ['代码托管', 'Git', '协作', '版本控制', '开发']],
  ['创业工具', ['创业', '产品', '公司', '商业', '增长']],
  ['社交媒体', ['社交', '社区', '内容', '互动', '媒体']],
  ['影音娱乐', ['影音', '娱乐', '音乐', '视频', '内容']],
  ['电商购物', ['电商', '购物', '商品', '交易', '市场']],
  ['新闻资讯', ['新闻', '资讯', '媒体', '趋势', '阅读']],
  ['金融理财', ['金融', '理财', '支付', '数据', '知识']],
  ['求职招聘', ['求职', '招聘', '简历', '远程工作', '职业']],
  ['生活服务', ['生活', '服务', '查询', '地图', '工具']],
  ['写作工具', ['写作', '编辑', '文本', '语法', '内容']],
  ['图片素材', ['图片', '素材', '图库', '插画', '设计']],
  ['视频工具', ['视频', '剪辑', '字幕', '录屏', '媒体']],
  ['网络安全', ['安全', '隐私', '密码', '检测', '防护']],
  ['远程办公', ['远程办公', '会议', '协作', '团队', '沟通']],
  ['邮件工具', ['邮件', '邮箱', '订阅', '通信', '办公']],
  ['域名主机', ['域名', '主机', 'DNS', '托管', '服务器']],
  ['低代码平台', ['低代码', '无代码', '自动化', '建站', '应用']],
  ['翻译语言', ['翻译', '语言', '词典', '语法', '学习']],
  ['文件工具', ['文件', 'PDF', '转换', '传输', '存储']],
  ['健康医疗', ['健康', '医疗', '科普', '生活', '资料']],
]);

// 从 CSV 中读取已有人工数据，并保持字段结构一致。
function readExistingCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }).map(normalizeRecord);
}

// 规范化单条记录，防止空字段导致 CSV 列错位。
function normalizeRecord(record) {
  const normalized = {};
  for (const field of FIELDS) {
    normalized[field] = record[field] || '';
  }
  return normalized;
}

// 从已有 seed SQL 中提取域名，用来避免与初始数据库数据重复。
function extractSeedDomains(filePaths) {
  const domains = new Set();
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const sql = fs.readFileSync(filePath, 'utf8');
    for (const match of sql.matchAll(/'https?:\/\/([^/'?]+)[^']*'/g)) {
      domains.add(normalizeDomain(match[1]));
    }
  }
  return domains;
}

// 下载候选源 markdown，失败时直接抛错，避免静默生成不足量数据。
async function fetchMarkdownSource(source) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(source.url, {
        headers: {
          'user-agent': 'site-nav-data-collector/1.0',
          accept: 'text/markdown,text/plain,*/*',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw new Error(`下载候选源失败：${source.name} ${lastError?.message || lastError}`);
}

// 解析 Markdown 列表项，保留链接所在标题作为后续分类依据。
function parseMarkdownLinks(markdown, sourceName) {
  const lines = markdown.split(/\r?\n/);
  const candidates = [];
  let heading = '';

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      heading = cleanText(headingMatch[2]);
      continue;
    }

    const linkRegex = /\[([^\]]{2,120})\]\((https?:\/\/[^\s)]+)\)/g;
    let linkMatch = null;
    while ((linkMatch = linkRegex.exec(line))) {
      const name = cleanText(linkMatch[1]);
      const url = cleanUrl(linkMatch[2]);
      const sourceDescription = cleanText(line.replace(linkMatch[0], ''));

      if (!name || !url || shouldSkipCandidate({ name, url, sourceDescription, heading, sourceName })) {
        continue;
      }

      try {
        const domain = normalizeDomain(new URL(url).hostname);
        candidates.push({ name, url, sourceDescription, heading, sourceName, domain });
      } catch {
        // URL 解析失败说明不是稳定候选，直接丢弃。
      }
    }
  }

  return candidates;
}

// 判断候选是否明显不适合收录，先做保守过滤，疑似高风险类别不进入 CSV。
function shouldSkipCandidate(candidate) {
  const text = `${candidate.name} ${candidate.url} ${candidate.sourceDescription} ${candidate.heading} ${candidate.sourceName || ''}`.toLowerCase();
  if (!candidate.url.startsWith('https://')) return true;
  if (EXCLUDED_HEADINGS.has(candidate.heading)) return true;
  if (BLOCKED_WORDS.some((word) => text.includes(word))) return true;
  if (GENERIC_LINK_NAMES.has(candidate.name.toLowerCase())) return true;
  if (/githubusercontent|rawgit|badge|\.svg$|\.png$|\.jpg$|\.jpeg$|\.gif$/i.test(candidate.url)) return true;
  if (/\.(webp|pdf|zip|tar|gz|tgz|mp4|mp3|rss|xml)$/i.test(candidate.url)) return true;
  if (/^https?:\/\/[^/]+\/?#/.test(candidate.url)) return true;
  try {
    const domain = normalizeDomain(new URL(candidate.url).hostname);
    if (BLOCKED_DOMAINS.some((blockedDomain) => domain === blockedDomain || domain.endsWith(`.${blockedDomain}`))) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

// 根据来源标题推断导入文档中的 30 个固定分类。
function inferCategory(heading, sourceName) {
  const h = heading.toLowerCase();
  const source = sourceName.toLowerCase();

  if (/lowcode/.test(source)) return '低代码平台';
  if (/remote-job/.test(source)) return '求职招聘';
  if (/newsletter/.test(source)) return '邮件工具';
  if (/stock|design-tools|design-systems/.test(source)) return '设计资源';
  if (/analytics|dataviz|datascience|bigdata/.test(source)) return '数据分析';
  if (/machine-learning/.test(source)) return 'AI 工具';
  if (/public-apis/.test(source)) {
    if (/health|medical|medicine/.test(h)) return '健康医疗';
    if (/music|video|entertainment|anime|games/.test(h)) return '影音娱乐';
    if (/business|commerce|shopping/.test(h)) return '电商购物';
    if (/finance|payment|bank/.test(h)) return '金融理财';
    if (/email/.test(h)) return '邮件工具';
    if (/weather|food|travel|transportation|maps/.test(h)) return '生活服务';
    return '开发者工具';
  }
  if (/selfhosted|sysadmin|free-for-dev|oss-alternatives/.test(source)) {
    if (/analytics|monitoring|log|metrics|database|data/.test(h)) return '数据分析';
    if (/email|mail/.test(h)) return '邮件工具';
    if (/security|auth|password|identity|privacy/.test(h)) return '网络安全';
    if (/hosting|cloud|paas|server|storage|cdn|dns|domain/.test(h)) return '云服务';
    if (/cms|automation|collaboration|project|task|calendar/.test(h)) return '效率办公';
    return '开发者工具';
  }
  if (/nodejs|python|javascript|programming|project-based-learning|free-programming-books/.test(source)) {
    if (/book|course|learning|tutorial|education|resource/.test(h)) return '学习教育';
    return '开发者工具';
  }

  if (sourceName === 'design-resources-for-developers') {
    if (/stock photos|stock videos|vectors|clip art|mockups|icons|logos|favicons|fonts|colors|ui graphics|design inspiration|design systems|online design tools/.test(h)) return '设计资源';
    if (/javascript chart/.test(h)) return '数据分析';
    if (/css|javascript|react|vue|angular|svelte|chrome extensions|ui components|frameworks/.test(h)) return '开发者工具';
    if (/compression/.test(h)) return '文件工具';
    return '设计资源';
  }

  if (/ai\/ml|llms|prompt engineering|embeddings/.test(h)) return 'AI 工具';
  if (/web development|front-end|html|css|javascript|back-end|apis|sql|software engineering|android development|game development|linux|vim|git|github|ides|linters|regex|programming languages|python|coding practice|competitive programming|data structures|big-o|computer science|snippets|testing|keyboard shortcuts/.test(h)) return '开发者工具';
  if (/open source|licensing|hackathons|projects/.test(h)) return '开源项目';
  if (/design|colors|fonts|icons|stock images|wallpapers|art|photography|infographic/.test(h)) return '设计资源';
  if (/white board|mind map|note taking|diagrams|texts|meetings|calculators|time|tools|comparison|data entry|softwares|keyboard|typing practice/.test(h)) return '效率办公';
  if (/file/.test(h)) return '文件工具';
  if (/visual|music|audio|media|spotify|movies|games/.test(h)) return '影音娱乐';
  if (/language|grammar|words|meanings|rhyme/.test(h)) return '翻译语言';
  if (/travel|globetrotting|flight|weather|food|lawn|yard|diy|culture|internet|connectivity/.test(h)) return '生活服务';
  if (/health|air quality/.test(h)) return '健康医疗';
  if (/business|startups|failures|finding ideas|trends|patents/.test(h)) return '创业工具';
  if (/jobs|remote jobs|freelancing|portfolio|cv|resume|careers/.test(h)) return '求职招聘';
  if (/academia|studying|mooc|science|biographies|books|articles|book recommendations|history|geoscience|biology|physics|quantum|astronomy|mathematics|engineering|philosophy|social sciences|mechanical engineering|materials|electronics engineering|robotics|cheat sheets/.test(h)) return '学习教育';
  if (/maps and data|data science|databases|web analytics/.test(h)) return '数据分析';
  if (/privacy|cryptography|ad blocker|data breach|password generation/.test(h)) return '网络安全';
  if (/emails/.test(h)) return '邮件工具';
  if (/domain names|dns/.test(h)) return '域名主机';
  if (/search|other websites of websites/.test(h)) return '搜索引擎';
  if (/no-code/.test(h)) return '低代码平台';
  if (/url/.test(h)) return '网络安全';
  return '效率办公';
}

// 生成用户可见的一句话简介，避免照搬英文源文案造成风格不统一。
function buildSummary(candidate, category) {
  const useCase = headingToChineseUseCase(candidate.heading);
  const name = candidate.name;
  return `${name} 是一个面向${useCase}的${category}网站，适合查找相关工具、资料或在线服务。`;
}

// 将英文标题压缩成中文用途短语，用于简介和关键词。
function headingToChineseUseCase(heading) {
  const h = heading.toLowerCase();
  if (/ai|llm|prompt/.test(h)) return 'AI 和自动化';
  if (/web|front|back|javascript|python|github|git|api|sql|coding|programming/.test(h)) return '开发者和技术学习';
  if (/design|icon|font|color|stock|art|photo/.test(h)) return '设计和创意素材';
  if (/remote|jobs|career|resume|freelanc/.test(h)) return '求职招聘和远程工作';
  if (/health|air quality/.test(h)) return '健康信息和生活参考';
  if (/music|audio|media|visual|video|games/.test(h)) return '影音内容和媒体工具';
  if (/language|grammar|words/.test(h)) return '语言学习和写作';
  if (/travel|weather|food|diy|culture/.test(h)) return '生活查询和兴趣探索';
  if (/math|science|books|course|mooc|academia|engineering|history/.test(h)) return '学习教育和知识资料';
  if (/privacy|security|password|breach|cryptography/.test(h)) return '隐私安全和账号防护';
  if (/startup|business|patent|trend/.test(h)) return '创业、产品和商业研究';
  return '日常效率和在线资源发现';
}

// 按分类补全二级、三级分类，保证分类字段都来自导入文档白名单。
function buildCategoryFields(category) {
  const aliases = CATEGORY_ALIASES.get(category) || ['效率办公', '学习教育', '文件工具'];
  return {
    category_1: aliases[0],
    category_2: aliases[1] || '',
    category_3: aliases[2] || '',
  };
}

// 根据分类和标题生成 3-10 个英文逗号分隔关键词。
function buildKeywords(candidate, category) {
  const defaults = KEYWORD_BY_CATEGORY.get(category) || KEYWORD_BY_CATEGORY.get('效率办公');
  const headingKeyword = cleanText(candidate.heading).replace(/[,|]/g, ' ').split(/\s+/).slice(0, 2).join('');
  const keywords = [candidate.name, ...defaults, headingKeyword].filter(Boolean);
  return Array.from(new Set(keywords)).slice(0, 8).join(',');
}

// 将候选转换成导入 CSV 记录。
function candidateToRecord(candidate) {
  const category = inferCategory(candidate.heading, candidate.sourceName);
  const categories = buildCategoryFields(category);
  return normalizeRecord({
    name: candidate.name,
    url: candidate.url,
    short_summary: buildSummary(candidate, category),
    full_description: '',
    ...categories,
    keywords: buildKeywords(candidate, category),
    is_free: candidate.sourceDescription.includes('($)') ? '否' : '部分免费',
    language: '英文',
    region: '全球',
    company: '',
    launch_year: '',
  });
}

// 规范化文本，去掉 Markdown 标记和列表中用于价格/学生优惠的符号。
function cleanText(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]/g, '')
    .replace(/\[[^\]]+\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .replace(/^\s*[$@!]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 清理 URL 末尾常见 Markdown 残留符号。
function cleanUrl(value) {
  return String(value || '').replace(/[),.]+$/g, '').trim();
}

// 域名统一去掉 www，作为跨批次去重主键。
function normalizeDomain(domain) {
  return String(domain || '').toLowerCase().replace(/^www\./, '');
}

// 生成稳定 slug，用于判断同名或同站点是否已经存在。
function generateSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// 将记录写成标准 CSV，所有需要转义的字段都使用双引号保护。
function toCsv(records) {
  const lines = [FIELDS.join(',')];
  for (const record of records) {
    lines.push(FIELDS.map((field) => csvEscape(record[field] || '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

// CSV 字段转义，保证逗号、换行和引号不会破坏列结构。
function csvEscape(value) {
  const text = String(value || '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// 去重追加记录，域名、名称和 slug 任一重复都跳过。
function appendUnique(records, record, indexes, options = {}) {
  let domain = '';
  try {
    domain = normalizeDomain(new URL(record.url).hostname);
  } catch {
    return false;
  }
  const nameKey = record.name.toLowerCase();
  const slugKey = generateSlug(record.name);

  if (!options.allowSeedDomain && indexes.seedDomains.has(domain)) return false;
  if (indexes.domains.has(domain) || indexes.names.has(nameKey) || indexes.slugs.has(slugKey)) return false;

  indexes.domains.add(domain);
  indexes.names.add(nameKey);
  indexes.slugs.add(slugKey);
  records.push(record);
  return true;
}

// 主流程：保留已有 CSV，再补足到 5000 条。
async function main() {
  const existingRecords = readExistingCsv(CSV_PATH);
  const seedDomains = extractSeedDomains(SEED_FILES);
  const records = [];
  const indexes = {
    domains: new Set(),
    names: new Set(),
    slugs: new Set(),
    seedDomains,
  };

  for (const record of existingRecords) {
    appendUnique(records, record, indexes, { allowSeedDomain: true });
  }

  const candidates = [];
  for (const source of SOURCES) {
    try {
      const markdown = await fetchMarkdownSource(source);
      candidates.push(...parseMarkdownLinks(markdown, source.name));
    } catch (error) {
      // 单个公开来源临时不可用时跳过，避免影响其他来源完成 5000 条扩容。
      console.warn(`跳过候选源：${source.name} ${error.message || error}`);
    }
  }

  for (const candidate of candidates) {
    if (records.length >= TARGET_TOTAL) break;
    appendUnique(records, candidateToRecord(candidate), indexes);
  }

  if (records.length < TARGET_TOTAL) {
    throw new Error(`候选不足：目标 ${TARGET_TOTAL} 条，实际 ${records.length} 条`);
  }

  const finalRecords = records.slice(0, TARGET_TOTAL);
  fs.writeFileSync(CSV_PATH, toCsv(finalRecords), 'utf8');
  console.log(`已生成 ${finalRecords.length} 条网站数据：${CSV_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
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
};

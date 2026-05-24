/**
 * 按新版导入文档补全 websites-import.csv 字段。
 *
 * 说明：
 * 1. 该脚本只更新 CSV，不生成 SQL。
 * 2. 对无法可靠获知的创始人、总部、社交链接等字段保持为空，避免伪造事实。
 * 3. monthly_visits 使用 Majestic 排名和引用 IP 做估算，不等同于真实访问量。
 */

const fs = require('fs');
const path = require('path');
const {
  CSV_PATH,
  readExistingCsv,
  normalizeDomain,
  toCsv,
} = require('./expand-websites-import');

const MAX_KEYWORDS = 15;
const TARGET_CATEGORY_COUNT = 6;

const CATEGORY_PROFILES = [
  {
    match: ['AI 工具', '人工智能', '自然语言处理', '机器学习平台', '语音识别', '计算机视觉'],
    extras: ['内容创作', '写作工具', '自动化工具', '学习教育', '开发者工具'],
    keywords: ['AI', '人工智能', '自动化', '大模型', '智能助手', '生成式 AI'],
    features: ['智能生成', '自动化处理', '内容辅助', '问答交互', '工作流提效'],
    audience: ['内容创作者', '开发者', '学生', '知识工作者', '企业团队'],
    alternatives: ['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Perplexity'],
  },
  {
    match: ['开发者工具', '代码托管', '开源项目', 'API 市场', '测试工具', '监控运维', '数据库工具', '容器编排', '微服务', '消息队列'],
    extras: ['技术文档', 'API 工具', '软件开发', '测试工具', '监控运维'],
    keywords: ['开发者工具', '编程', 'API', '代码', '技术', '软件开发'],
    features: ['代码开发', '接口调试', '技术文档', '项目协作', '自动化集成'],
    audience: ['开发者', '技术团队', '产品团队', '运维人员', '开源贡献者'],
    alternatives: ['GitHub', 'GitLab', 'Postman', 'Stack Overflow', 'Vercel'],
  },
  {
    match: ['设计资源', '图片素材', '图片编辑', '字体工具', '图标素材', 'UI 设计'],
    extras: ['创意素材', '图片编辑', 'UI 设计', '品牌设计', '内容创作'],
    keywords: ['设计', '素材', '图片', '创意', 'UI', '图标'],
    features: ['素材查找', '图片处理', '设计参考', '视觉创作', '资源管理'],
    audience: ['设计师', '内容创作者', '营销人员', '产品经理', '独立开发者'],
    alternatives: ['Figma', 'Canva', 'Adobe Express', 'Unsplash', 'Iconfinder'],
  },
  {
    match: ['效率办公', '远程办公', '文件工具', '在线文档', '思维导图', '项目管理', '笔记工具'],
    extras: ['协作工具', '项目管理', '在线文档', '任务管理', '团队办公'],
    keywords: ['效率', '办公', '协作', '任务', '文档', '团队'],
    features: ['任务管理', '文档协作', '流程整理', '信息记录', '团队沟通'],
    audience: ['团队成员', '知识工作者', '项目经理', '远程办公用户', '企业用户'],
    alternatives: ['Notion', 'Trello', 'Asana', 'Monday.com', 'Google Workspace'],
  },
  {
    match: ['云服务', '域名主机', '独立站建设', '浏览器插件'],
    extras: ['基础设施', '服务器托管', '域名服务', '开发者工具', '监控运维'],
    keywords: ['云服务', '主机', '服务器', '域名', '部署', '基础设施'],
    features: ['云端部署', '资源托管', '域名管理', '性能扩展', '服务监控'],
    audience: ['开发者', '站长', '企业 IT 团队', '创业团队', '运维人员'],
    alternatives: ['AWS', 'Cloudflare', 'DigitalOcean', 'Vercel', 'Netlify'],
  },
  {
    match: ['数据分析', '数据标注', '推荐系统', '搜索技术'],
    extras: ['商业智能', '数据可视化', '报表工具', '研究工具', '营销推广'],
    keywords: ['数据', '分析', '报表', '可视化', '指标', '洞察'],
    features: ['数据查询', '指标分析', '报表展示', '趋势观察', '决策支持'],
    audience: ['数据分析师', '运营人员', '产品经理', '研究人员', '企业团队'],
    alternatives: ['Google Analytics', 'Tableau', 'Power BI', 'Looker Studio', 'Mixpanel'],
  },
  {
    match: ['营销推广', '广告投放', '内容分发', 'CRM 系统'],
    extras: ['增长工具', 'SEO 工具', '广告投放', '客户管理', '数据分析'],
    keywords: ['营销', '推广', '增长', 'SEO', '广告', '品牌'],
    features: ['营销分析', '客户触达', '内容推广', '广告管理', '增长优化'],
    audience: ['市场团队', '运营人员', '创业者', '品牌方', '电商卖家'],
    alternatives: ['Semrush', 'Ahrefs', 'HubSpot', 'Mailchimp', 'Buffer'],
  },
  {
    match: ['学习教育', '科研学术', '知识付费'],
    extras: ['在线课程', '知识资料', '考试培训', '学术研究', '写作工具'],
    keywords: ['学习', '教育', '课程', '知识', '资料', '培训'],
    features: ['课程学习', '资料检索', '知识整理', '技能训练', '学习辅助'],
    audience: ['学生', '教师', '自学者', '研究人员', '职场学习者'],
    alternatives: ['Coursera', 'edX', 'Khan Academy', 'Udemy', 'Duolingo'],
  },
  {
    match: ['搜索引擎', '翻译语言'],
    extras: ['信息检索', '语言工具', '学习教育', '写作工具', '在线工具'],
    keywords: ['搜索', '查询', '翻译', '语言', '词典', '检索'],
    features: ['信息搜索', '语言转换', '结果筛选', '资料查询', '文本处理'],
    audience: ['普通用户', '学生', '研究人员', '内容创作者', '办公用户'],
    alternatives: ['Google', 'Bing', 'DuckDuckGo', 'DeepL', 'Google Translate'],
  },
  {
    match: ['社交媒体', '内容创作', '短视频', '直播平台', '播客平台'],
    extras: ['内容社区', '创作者工具', '品牌运营', '影音娱乐', '营销推广'],
    keywords: ['社交', '社区', '内容', '创作者', '互动', '媒体'],
    features: ['内容发布', '用户互动', '社区运营', '粉丝管理', '品牌传播'],
    audience: ['内容创作者', '品牌方', '社区用户', '运营人员', '媒体团队'],
    alternatives: ['Instagram', 'YouTube', 'TikTok', 'X', 'LinkedIn'],
  },
  {
    match: ['影音娱乐', '视频工具', '音乐工具', '游戏娱乐', '音频工具'],
    extras: ['媒体工具', '内容创作', '流媒体', '音频工具', '视频工具'],
    keywords: ['视频', '音乐', '音频', '媒体', '娱乐', '内容'],
    features: ['内容播放', '媒体处理', '音视频创作', '资源浏览', '在线体验'],
    audience: ['内容消费者', '创作者', '媒体团队', '娱乐用户', '营销人员'],
    alternatives: ['YouTube', 'Spotify', 'Netflix', 'Vimeo', 'Twitch'],
  },
  {
    match: ['电商购物', '跨境电商', '二手交易', '供应链', '物流快递'],
    extras: ['在线购物', '交易平台', '品牌零售', '物流服务', '营销推广'],
    keywords: ['电商', '购物', '商品', '交易', '零售', '平台'],
    features: ['商品浏览', '在线交易', '订单管理', '商家服务', '支付结算'],
    audience: ['消费者', '商家', '电商运营', '品牌方', '采购人员'],
    alternatives: ['Amazon', 'eBay', 'Shopify', 'AliExpress', 'Etsy'],
  },
  {
    match: ['新闻资讯', '科研学术'],
    extras: ['资讯阅读', '行业观察', '研究资料', '内容平台', '数据分析'],
    keywords: ['新闻', '资讯', '报道', '观点', '行业', '阅读'],
    features: ['资讯浏览', '专题阅读', '信息检索', '趋势观察', '内容订阅'],
    audience: ['读者', '研究人员', '媒体从业者', '行业观察者', '知识工作者'],
    alternatives: ['Google News', 'Reuters', 'AP News', 'The Verge', 'TechCrunch'],
  },
  {
    match: ['金融理财', '量化交易', '保险服务', '财务软件'],
    extras: ['投资工具', '财务管理', '数据分析', '商业服务', '生活服务'],
    keywords: ['金融', '理财', '投资', '支付', '财务', '数据'],
    features: ['金融信息查询', '资产管理', '支付结算', '数据分析', '风险参考'],
    audience: ['投资者', '财务人员', '企业用户', '消费者', '研究人员'],
    alternatives: ['Investopedia', 'Morningstar', 'Yahoo Finance', 'Wise', 'PayPal'],
  },
  {
    match: ['求职招聘', '人力资源'],
    extras: ['职业发展', '简历工具', '远程办公', '企业服务', '学习教育'],
    keywords: ['招聘', '求职', '职位', '简历', '职业', '人才'],
    features: ['职位搜索', '简历展示', '人才匹配', '雇主服务', '职业信息'],
    audience: ['求职者', '招聘人员', 'HR 团队', '职场人', '企业用户'],
    alternatives: ['LinkedIn', 'Indeed', 'Glassdoor', 'Boss 直聘', '猎聘'],
  },
  {
    match: ['生活服务', '本地生活', '旅游出行', '美食餐饮', '宠物服务', '母婴育儿', '汽车服务', '房产平台'],
    extras: ['本地服务', '消费指南', '工具查询', '出行服务', '信息服务'],
    keywords: ['生活', '服务', '查询', '本地', '工具', '信息'],
    features: ['信息查询', '服务发现', '在线预约', '资源导航', '生活辅助'],
    audience: ['普通用户', '家庭用户', '本地消费者', '服务商家', '办公用户'],
    alternatives: ['Google Maps', 'Yelp', 'Tripadvisor', '大众点评', '携程'],
  },
  {
    match: ['网络安全', '密码管理', '法务合规'],
    extras: ['隐私保护', '账号安全', '安全检测', '开发者工具', '企业服务'],
    keywords: ['安全', '隐私', '密码', '检测', '防护', '合规'],
    features: ['安全检测', '隐私保护', '账号防护', '风险提示', '合规管理'],
    audience: ['安全人员', '开发者', '企业 IT 团队', '个人用户', '合规团队'],
    alternatives: ['Bitwarden', '1Password', 'Cloudflare', 'Have I Been Pwned', 'Sentry'],
  },
  {
    match: ['健康医疗', '体育健身'],
    extras: ['健康管理', '医疗信息', '科普资料', '生活服务', '数据分析'],
    keywords: ['健康', '医疗', '科普', '健身', '生活', '咨询'],
    features: ['健康信息查询', '科普阅读', '服务预约', '数据记录', '生活建议'],
    audience: ['普通用户', '患者', '健康管理人群', '医护人员', '家庭用户'],
    alternatives: ['Mayo Clinic', 'WebMD', 'Healthline', '丁香医生', 'Keep'],
  },
];

const DEFAULT_PROFILE = {
  extras: ['在线工具', '信息服务', '效率办公', '生活服务', '资源导航'],
  keywords: ['网站', '在线服务', '工具', '信息', '资源', '导航'],
  features: ['信息查询', '在线服务', '资源导航', '工具使用', '内容浏览'],
  audience: ['普通用户', '办公用户', '站长', '研究人员', '内容创作者'],
  alternatives: ['同类工具', '同类服务', '在线平台'],
};

const DOMAIN_COMPANY_SUFFIXES = new Set([
  'com',
  'net',
  'org',
  'cn',
  'io',
  'ai',
  'app',
  'dev',
  'co',
  'site',
  'cloud',
  'xyz',
  'top',
  'shop',
  'tech',
  'info',
  'me',
]);

// 主流程：逐行补全新版 CSV 字段，并保留已有热度字段。
function main() {
  const records = readExistingCsv(CSV_PATH);
  const enriched = records.map((record) => enrichRecord(record));
  const outputPath = normalizeValue(process.argv[2]) || CSV_PATH;
  const actualOutputPath = writeCsvWithFallback(outputPath, enriched);
  console.log(`CSV 补全完成：${enriched.length} 条记录，输出文件：${actualOutputPath}`);
}

// 写入 CSV；如果正式文件被表格软件锁定，则落到同目录 .enriched 临时文件。
function writeCsvWithFallback(outputPath, records) {
  try {
    fs.writeFileSync(outputPath, toCsv(records), 'utf8');
    return outputPath;
  } catch (error) {
    if (error && error.code === 'EBUSY' && outputPath === CSV_PATH) {
      const fallbackPath = path.join(path.dirname(CSV_PATH), 'websites-import.enriched.csv');
      fs.writeFileSync(fallbackPath, toCsv(records), 'utf8');
      return fallbackPath;
    }
    throw error;
  }
}

// 补全单条网站记录；保留可信原值，只补缺失或明显不足的字段。
function enrichRecord(record) {
  const domain = getDomain(record.url);
  const categories = buildCategories(record, domain);
  const profile = getProfile(categories);
  const keywords = buildKeywords(record, domain, categories, profile);
  const features = buildFeatures(record, categories, profile);
  const company = normalizeValue(record.company) || inferCompany(record, domain);
  const monthlyVisits = normalizeValue(record.monthly_visits) || estimateMonthlyVisits(record);
  const starRating = normalizeValue(record.star_rating) || inferStarRating(record);
  const tags = buildTags(record, categories, starRating);
  const targetAudience = normalizeValue(record.target_audience) || uniqueList(profile.audience).join(',');
  const pricingModel = normalizeValue(record.pricing_model) || inferPricingModel(record.is_free);
  const platforms = normalizeValue(record.platforms) || inferPlatforms(categories).join(',');
  const alternatives = normalizeValue(record.alternatives) || inferAlternatives(record.name, profile);

  const result = {
    ...record,
    name: normalizeValue(record.name),
    url: normalizeValue(record.url),
    short_summary: normalizeValue(record.short_summary) || buildShortSummary(record, categories, features),
    full_description: buildFullDescription(record, categories, keywords, features, targetAudience, company),
    keywords: keywords.join(','),
    company,
    language: normalizeValue(record.language) || inferLanguage(record.region, domain),
    is_free: normalizeValue(record.is_free) || '部分免费',
    region: normalizeValue(record.region) || inferRegion(domain),
    launch_year: normalizeValue(record.launch_year),
    tags,
    star_rating: String(starRating),
    monthly_visits: String(monthlyVisits),
    screenshot_url: normalizeValue(record.screenshot_url),
    founder: normalizeValue(record.founder),
    headquarters: normalizeValue(record.headquarters),
    pricing_model: pricingModel,
    alternatives,
    target_audience: targetAudience,
    features: features.join(','),
    platforms,
    social_links: normalizeValue(record.social_links),
  };

  for (let i = 0; i < 8; i += 1) {
    result[`category_${i + 1}`] = categories[i] || '';
  }

  return result;
}

// 提取规范化域名，供分类、公司名和访问量估算使用。
function getDomain(url) {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return '';
  }
}

// 读取字段值并去除空白，避免把 null/undefined 写进 CSV。
function normalizeValue(value) {
  return String(value || '').trim();
}

// 根据现有分类、关键词和域名重新组合 3-8 个相关分类。
function buildCategories(record, domain) {
  const existing = [];
  for (let i = 1; i <= 8; i += 1) {
    const value = normalizeValue(record[`category_${i}`]);
    if (value) existing.push(value);
  }

  const profile = getProfile(existing);
  const text = `${record.name || ''} ${record.url || ''} ${record.short_summary || ''} ${record.keywords || ''} ${domain}`.toLowerCase();
  const inferred = [];

  for (const item of CATEGORY_PROFILES) {
    if (item.match.some((category) => existing.includes(category))) continue;
    if (item.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
      inferred.push(item.match[0]);
    }
  }

  return uniqueList([...existing, ...profile.extras, ...inferred, ...DEFAULT_PROFILE.extras]).slice(0, TARGET_CATEGORY_COUNT);
}

// 根据分类找到最匹配的画像，用于生成关键词、功能和人群。
function getProfile(categories) {
  for (const profile of CATEGORY_PROFILES) {
    if (categories.some((category) => profile.match.includes(category))) {
      return profile;
    }
  }
  return DEFAULT_PROFILE;
}

// 生成 5-15 个关键词，覆盖名称、域名、分类、功能和用途。
function buildKeywords(record, domain, categories, profile) {
  const current = splitList(record.keywords);
  const domainLabel = getDomainLabel(domain);
  const words = [
    normalizeValue(record.name),
    domainLabel,
    ...current,
    ...categories,
    ...profile.keywords,
  ];
  return uniqueList(words).slice(0, MAX_KEYWORDS);
}

// 生成核心功能列表，优先使用现有字段，再补充分类画像功能。
function buildFeatures(record, categories, profile) {
  const current = splitList(record.features);
  const categoryFeatures = categories.map((category) => category.replace(/平台|工具|服务|资源/g, '')).filter(Boolean);
  return uniqueList([...current, ...profile.features, ...categoryFeatures]).slice(0, 10);
}

// 构造一句话简介；仅在原简介缺失时使用。
function buildShortSummary(record, categories, features) {
  const name = normalizeValue(record.name) || '该网站';
  return `${name} 是一个提供${features.slice(0, 2).join('、')}能力的${categories[0] || '在线服务'}网站。`;
}

// 生成 100-500 字详细描述，避免虚构创始人、融资、真实流量等不可验证信息。
function buildFullDescription(record, categories, keywords, features, targetAudience, company) {
  const current = normalizeValue(record.full_description);
  if (current.length >= 80) return current;

  const name = normalizeValue(record.name) || '该网站';
  const region = normalizeValue(record.region) || '全球';
  const language = normalizeValue(record.language) || inferLanguage(region, getDomain(record.url));
  const pricing = normalizeValue(record.is_free) || '部分免费';
  const score = normalizeValue(record.popularity_score);
  const rank = normalizeValue(record.popularity_rank);
  const companyPart = company ? `由 ${company} 或相关团队运营，` : '';
  const heatPart = rank
    ? `公开域名排名信号显示其 Majestic 排名约为 ${rank}，热度评分 ${score || '未知'}。`
    : '当前未进入 Majestic 前 100 万域名，热度按低曝光站点处理。';

  return `${name} 是一个面向${targetAudience || '普通用户和专业用户'}的${categories[0] || '在线服务'}网站，${companyPart}主要提供${features.slice(0, 5).join('、')}等能力。它适合${region}或相关地区用户在${categories.slice(0, 4).join('、')}场景中查找工具、资料或在线服务。该站点界面语言标记为${language}，收费模式标记为${pricing}。关键词包括${keywords.slice(0, 8).join('、')}。${heatPart} 本描述基于现有 CSV、域名、分类、关键词和公开热度字段批量补全，后续可继续人工核验公司、创始人、总部和定价细节。`;
}

// 从域名或名称推断公司/团队名；这是保守填充，不推断法人实体。
function inferCompany(record, domain) {
  const name = normalizeValue(record.name);
  if (name && !looksLikeBareDomain(name)) return name;
  const label = getDomainLabel(domain);
  return label || name || '';
}

// 判断名称是否只是裸域名，裸域名需要转成更像团队名的文本。
function looksLikeBareDomain(value) {
  const text = normalizeValue(value).toLowerCase();
  if (!text.includes('.')) return false;
  const last = text.split('.').pop();
  return DOMAIN_COMPANY_SUFFIXES.has(last);
}

// 提取主域标签并转成标题形式，用于公司名和关键词。
function getDomainLabel(domain) {
  if (!domain) return '';
  const parts = domain.split('.').filter(Boolean);
  const label = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (!label) return '';
  if (label.length <= 4) return label.toUpperCase();
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// 根据公开排名估算月访问量；无排名时使用 0 表示未知或低曝光。
function estimateMonthlyVisits(record) {
  const rank = Number.parseInt(record.popularity_rank || '', 10);
  const refIps = Number.parseInt(record.popularity_ref_ips || '', 10);
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  const rankEstimate = Math.round(3000000000 / Math.pow(rank, 0.78));
  const linkEstimate = Number.isFinite(refIps) && refIps > 0 ? Math.round(refIps * 8) : 0;
  return Math.max(1000, Math.min(5000000000, Math.max(rankEstimate, linkEstimate)));
}

// 推荐星级由公开热度分推导，后续可以被人工运营覆盖。
function inferStarRating(record) {
  const score = Number.parseInt(record.popularity_score || '', 10);
  if (!Number.isFinite(score)) return 3;
  if (score >= 85) return 5;
  if (score >= 60) return 4;
  if (score >= 35) return 3;
  if (score >= 15) return 2;
  return 1;
}

// 根据热度、地区和分类生成运营标签。
function buildTags(record, categories, starRating) {
  const current = splitList(record.tags);
  const tags = [...current];
  if (starRating >= 5) tags.push('热门', '推荐');
  else if (starRating >= 4) tags.push('推荐');
  if (normalizeValue(record.region) === '中国') tags.push('国内网站');
  else tags.push('海外网站');
  tags.push(categories[0] || '在线服务', '已补全');
  return uniqueList(tags).slice(0, 8).join(',');
}

// 根据收费字段生成定价模式说明，避免写入具体价格。
function inferPricingModel(isFree) {
  const value = normalizeValue(isFree);
  if (value === '是') return '免费使用';
  if (value === '否') return '付费或订阅制';
  return '基础功能免费，部分高级功能或企业服务可能收费';
}

// 根据地区和域名推断语言字段。
function inferLanguage(region, domain) {
  if (normalizeValue(region) === '中国' || domain.endsWith('.cn')) return '中文';
  return '英文';
}

// 根据域名推断地区；只作为字段缺失时的兜底。
function inferRegion(domain) {
  if (!domain) return '全球';
  if (domain.endsWith('.cn')) return '中国';
  if (domain.endsWith('.us')) return '美国';
  if (domain.endsWith('.jp')) return '日本';
  if (domain.endsWith('.kr')) return '韩国';
  if (/\.(de|fr|it|es|nl|se|no|fi|dk|pl|ch|at|be|eu)$/.test(domain)) return '欧洲';
  return '全球';
}

// 根据分类推断支持平台，Web 是网站类条目的默认平台。
function inferPlatforms(categories) {
  const platforms = ['Web'];
  if (categories.some((category) => /社交|视频|音乐|电商|生活|健康|招聘|金融/.test(category))) {
    platforms.push('iOS', 'Android');
  }
  if (categories.some((category) => /开发|云服务|AI|数据|安全/.test(category))) {
    platforms.push('API');
  }
  if (categories.some((category) => /办公|文件|设计|开发/.test(category))) {
    platforms.push('Desktop');
  }
  return uniqueList(platforms);
}

// 生成同类替代项；仅使用分类级参考，避免虚构直接竞品关系。
function inferAlternatives(name, profile) {
  const normalizedName = normalizeValue(name).toLowerCase();
  return uniqueList(profile.alternatives)
    .filter((item) => item.toLowerCase() !== normalizedName)
    .slice(0, 5)
    .join(',');
}

// 拆分逗号、中文逗号、顿号和竖线分隔的列表字段。
function splitList(value) {
  return normalizeValue(value)
    .split(/[,，、|/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// 去重并过滤过长噪声字段，保持 CSV 可读。
function uniqueList(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const value = normalizeValue(item);
    if (!value || value.length > 60) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

main();

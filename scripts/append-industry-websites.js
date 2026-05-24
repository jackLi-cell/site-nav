/**
 * 按行业大类追加可访问、合规的网站记录。
 *
 * 业务意图：
 * 1. 每个行业大类最多新增 5000 个网站，默认国内 3500、海外 1500，体现国内优先。
 * 2. 候选网站必须通过首页访问、HTML 内容、敏感词和去重检测，不能为了凑数伪造。
 * 3. 如果公开候选源不足或检测不通过，就保留实际通过数量，不强制填满。
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');
const {
  CSV_PATH,
  readExistingCsv,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');

const CACHE_DIR = path.join(__dirname, '../data/cache');
const REPORT_PATH = path.join(CACHE_DIR, 'industry-collection-report.json');
const ATTEMPTED_PATH = path.join(CACHE_DIR, 'industry-attempted-domains.json');
const MAJESTIC_MILLION_URL = 'https://downloads.majestic.com/majestic_million.csv';
const UPDATED_AT = '2026-05-12';
const TARGET_PER_MAJOR = parseInteger(process.env.TARGET_PER_MAJOR, 5000);
const DOMESTIC_PER_MAJOR = parseInteger(process.env.DOMESTIC_PER_MAJOR, 3500);
const OVERSEAS_PER_MAJOR = Math.max(0, TARGET_PER_MAJOR - DOMESTIC_PER_MAJOR);
const MAX_CANDIDATES = parseInteger(process.env.MAX_CANDIDATES, 8000);
const MAX_FETCHES = parseInteger(process.env.MAX_FETCHES, 600);
const MAX_APPEND = parseInteger(process.env.MAX_APPEND, 300);
const FETCH_TIMEOUT_MS = parseInteger(process.env.FETCH_TIMEOUT_MS, 9000);
const SOURCE_TIMEOUT_MS = parseInteger(process.env.SOURCE_TIMEOUT_MS, 120000);
const CONCURRENCY = parseInteger(process.env.CONCURRENCY, 8);

const CHINA_REGION = '中国';
const OVERSEAS_REGION = '全球';
const USER_AGENT = 'Mozilla/5.0 (compatible; SiteDirectoryCollector/1.0; +https://example.com)';
const CHINA_DOMAIN_HINTS = [
  'baidu',
  'qq',
  'weixin',
  'taobao',
  'tmall',
  'jd',
  'bilibili',
  'zhihu',
  'douyin',
  'kuaishou',
  'aliyun',
  'alipay',
  'mi',
  'xiaomi',
  'huawei',
  'netease',
  'sina',
  'sohu',
  'youku',
  'iqiyi',
  'douban',
  'gitee',
  'csdn',
  'juejin',
];

const DOMAIN_CLASSIFICATION_OVERRIDES = new Map([
  ['300.cn', ['独立站建站', '建站工具']],
  ['32.cn', ['法律服务', '知识产权']],
  ['bit.edu.cn', ['科研学术', '高校资源']],
  ['4399.cn', ['游戏娱乐', '游戏平台']],
  ['playstation.com', ['游戏娱乐', '游戏平台']],
  ['wordpress.com', ['独立站建站', 'CMS 系统']],
  ['wordpress.org', ['独立站建站', 'CMS 系统']],
  ['firefox.com', ['浏览器插件', 'Firefox 扩展']],
  ['mozilla.org', ['浏览器插件', 'Firefox 扩展']],
  ['wanwang.aliyun.com', ['云计算主机', '域名主机']],
  ['zdnet.com', ['新闻资讯', '科技媒体']],
]);

const SENSITIVE_PATTERNS = [
  /adult|porn|sex|xxx|nsfw|escort|dating/i,
  /casino|gambl|betting|lottery|poker/i,
  /torrent|piracy|warez|crack|keygen/i,
  /crypto|bitcoin|forex|binance|coinbase/i,
  /vpn|proxy|telegram/i,
  /politic|government|election|campaign|military|weapon|guns/i,
  /dangjian|dangzheng|partybuilding|xinhuanet|people\.com|cctv|cntv/i,
  /(^|\.)gov(\.|$)|(^|\.)mil(\.|$)/i,
  /色情|成人|情色|黄网站|博彩|赌博|彩票|分分彩|六合彩|赌球|炸金花|德州扑克/i,
  /政治|政府|政务|党建|党政|选举|军事|军队|武器|枪支|翻墙|代理工具|虚拟币|比特币|外汇/i,
];

const GENERIC_TITLE_PATTERNS = [
  /^home$/i,
  /^index$/i,
  /^welcome$/i,
  /^default page$/i,
  /^403|404|502|503/,
  /coming soon/i,
  /domain parked/i,
];

const INDUSTRY_TAXONOMY = [
  major('游戏娱乐', '数字娱乐', ['game', 'gaming', 'games', 'play', 'steam', 'xbox', 'nintendo', 'gamer', '游戏', '手游', '电竞'], ['游戏平台', '手游社区', '游戏开发', '电竞赛事', '游戏媒体']),
  major('短视频直播', '内容媒体', ['short video', 'video', 'live', 'stream', 'creator', 'reels', 'douyin', 'kuaishou', '直播', '短视频', '创作者'], ['短视频平台', '直播工具', '创作者服务', '直播电商', '视频号运营']),
  major('音乐音频', '内容媒体', ['music', 'audio', 'podcast', 'sound', 'radio', 'song', '音乐', '音频', '播客', '电台'], ['音乐平台', '播客平台', '音频剪辑', '听书电台', '声音素材']),
  major('影视动漫', '内容媒体', ['movie', 'film', 'tv', 'video', 'anime', 'animation', 'cinema', '影视', '动漫', '电影', '剧集'], ['影视平台', '动漫社区', '影评资讯', '字幕工具', '视频资料']),
  major('社交社区', '内容媒体', ['social', 'community', 'forum', 'club', 'chat', 'sns', '社交', '社区', '论坛', '群组'], ['综合社交', '兴趣社区', '论坛社区', '即时通讯', '会员社群']),
  major('新闻资讯', '内容媒体', ['news', 'media', 'press', 'magazine', 'article', '资讯', '新闻', '媒体', '科技媒体'], ['综合资讯', '科技媒体', '财经资讯', '行业媒体', '订阅阅读']),
  major('电商购物', '消费生活', ['shop', 'store', 'mall', 'commerce', 'retail', 'coupon', 'shopping', '电商', '购物', '商城'], ['综合电商', '跨境电商', '独立站', '比价导购', '商家工具']),
  major('本地生活', '消费生活', ['local', 'city', 'life', 'service', '生活', '本地', '城市服务', '便民'], ['生活服务', '同城信息', '到店服务', '生活缴费', '便民查询']),
  major('旅游出行', '消费生活', ['travel', 'trip', 'hotel', 'flight', 'map', 'route', 'booking', '旅游', '出行', '酒店', '机票'], ['旅游攻略', '酒店预订', '机票交通', '地图导航', '行程工具']),
  major('美食餐饮', '消费生活', ['food', 'restaurant', 'recipe', 'coffee', 'delivery', 'menu', '美食', '餐饮', '菜谱', '外卖'], ['餐厅点评', '菜谱工具', '外卖服务', '食品品牌', '餐饮管理']),
  major('健康医疗', '消费生活', ['health', 'medical', 'doctor', 'hospital', 'clinic', 'fitness', '健康', '医疗', '医生', '医院'], ['在线问诊', '健康管理', '运动健康', '医疗信息', '药品服务']),
  major('体育健身', '消费生活', ['sport', 'fitness', 'workout', 'running', 'yoga', '体育', '健身', '运动', '赛事'], ['健身课程', '运动社区', '赛事资讯', '户外运动', '训练工具']),
  major('房产家居', '消费生活', ['house', 'home', 'real estate', 'rent', 'furniture', '房产', '家居', '租房', '装修'], ['房产平台', '租房服务', '家装设计', '家居商城', '物业社区']),
  major('汽车服务', '消费生活', ['car', 'auto', 'ev', 'vehicle', 'drive', '汽车', '车主', '二手车', '充电'], ['汽车资讯', '二手车', '车主服务', '新能源车', '维修保养']),
  major('母婴育儿', '消费生活', ['baby', 'parenting', 'kids', 'family', 'mother', '母婴', '育儿', '亲子', '儿童'], ['育儿知识', '母婴商城', '亲子教育', '儿童健康', '家庭服务']),
  major('宠物服务', '消费生活', ['pet', 'dog', 'cat', 'animal', '宠物', '猫', '狗', '萌宠'], ['宠物社区', '宠物医疗', '宠物用品', '宠物领养', '养宠知识']),
  major('二手交易', '消费生活', ['used', 'second hand', 'marketplace', 'resale', '二手', '闲置', '转卖'], ['闲置交易', '二手数码', '二手车房', '回收服务', '交易社区']),
  major('物流快递', '企业服务', ['logistics', 'shipping', 'express', 'delivery', 'track', '物流', '快递', '仓储'], ['快递查询', '物流平台', '仓储配送', '跨境物流', '供应链物流']),
  major('教育培训', '学习教育', ['edu', 'learn', 'course', 'school', 'training', 'study', '教育', '课程', '学习', '培训'], ['在线课程', '考试培训', '语言学习', '职业教育', 'K12 教育']),
  major('科研学术', '学习教育', ['research', 'science', 'academic', 'paper', 'journal', 'lab', '科研', '学术', '论文'], ['论文检索', '学术期刊', '科研工具', '实验数据', '高校资源']),
  major('求职招聘', '企业服务', ['job', 'career', 'recruit', 'resume', 'hire', '招聘', '求职', '简历', '人才'], ['招聘平台', '简历工具', '职业社区', '远程工作', '人才服务']),
  major('金融理财', '商业服务', ['finance', 'bank', 'money', 'fund', 'stock', 'payment', '金融', '理财', '银行', '支付'], ['支付工具', '银行服务', '基金理财', '行情数据', '财务信息']),
  major('保险服务', '商业服务', ['insurance', 'insure', 'policy', 'claim', '保险', '保单', '理赔'], ['保险平台', '保单管理', '理赔服务', '车险服务', '健康险']),
  major('法律服务', '商业服务', ['law', 'legal', 'contract', 'compliance', '律师', '法律', '合同', '合规'], ['法律咨询', '合同工具', '法务合规', '知识产权', '企业法务']),
  major('企业管理', '企业服务', ['enterprise', 'business', 'erp', 'oa', 'workflow', '企业', '管理', '流程'], ['ERP 系统', 'OA 办公', '流程管理', '供应链管理', '企业知识库']),
  major('营销增长', '企业服务', ['marketing', 'growth', 'seo', 'ads', 'brand', 'crm', '营销', '增长', '广告', 'SEO'], ['SEO 工具', '广告投放', '内容营销', '品牌管理', '增长分析']),
  major('客服销售', '企业服务', ['support', 'sales', 'crm', 'customer', 'helpdesk', '客服', '销售', '客户'], ['客服系统', 'CRM 系统', '销售管理', '客户成功', '工单系统']),
  major('财务税务', '企业服务', ['accounting', 'invoice', 'tax', 'expense', 'finance', '财务', '税务', '发票', '报销'], ['会计软件', '发票工具', '税务服务', '报销管理', '财务分析']),
  major('人力资源', '企业服务', ['hr', 'payroll', 'employee', 'recruit', 'talent', '人力', 'HR', '员工', '薪酬'], ['招聘管理', '薪酬绩效', '员工培训', '组织管理', '人才测评']),
  major('项目协作', '效率办公', ['project', 'task', 'team', 'collaboration', 'kanban', '项目', '协作', '任务'], ['项目管理', '任务看板', '团队协作', '需求管理', '远程协作']),
  major('内容创作', '内容媒体', ['content', 'writing', 'blog', 'creator', 'publish', '写作', '内容', '创作'], ['写作工具', '博客平台', '创作者平台', '内容发布', '知识付费']),
  major('设计创意', '创意设计', ['design', 'creative', 'ui', 'ux', 'template', '设计', '创意', '模板'], ['设计工具', '原型设计', '模板素材', '品牌设计', '设计协作']),
  major('摄影图片', '创意设计', ['photo', 'image', 'picture', 'camera', 'gallery', '摄影', '图片', '图库'], ['图片素材', '摄影社区', '图片编辑', '图库检索', '版权图片']),
  major('视频剪辑', '创意设计', ['video editor', 'clip', 'subtitle', 'screen record', '视频', '剪辑', '字幕', '录屏'], ['视频编辑', '字幕工具', '录屏工具', '转码压缩', '视频素材']),
  major('办公效率', '效率办公', ['productivity', 'office', 'tool', 'calendar', 'note', '效率', '办公', '日历', '笔记'], ['日程管理', '笔记工具', '效率工具', '自动化工具', '时间管理']),
  major('文件文档', '效率办公', ['document', 'docs', 'pdf', 'file', 'drive', '文档', '文件', 'PDF', '网盘'], ['在线文档', 'PDF 工具', '文件转换', '云盘存储', '表格工具']),
  major('开发编程', '开发技术', ['developer', 'code', 'programming', 'api', 'git', '开发', '编程', '代码'], ['代码托管', 'API 开发', '编程学习', '开发框架', '技术文档']),
  major('云计算主机', '开发技术', ['cloud', 'hosting', 'server', 'cdn', 'domain', '云', '主机', '服务器', 'CDN'], ['云服务器', '域名主机', 'CDN 服务', '对象存储', '边缘计算']),
  major('数据库数据', '开发技术', ['database', 'sql', 'data warehouse', 'postgres', 'mysql', '数据库', '数据仓库'], ['数据库管理', '数据仓库', '数据同步', 'SQL 工具', '缓存服务']),
  major('网络安全', '开发技术', ['security', 'auth', 'password', 'privacy', 'scan', '安全', '密码', '认证'], ['密码管理', '身份认证', '安全检测', '漏洞管理', '隐私保护']),
  major('运维监控', '开发技术', ['monitoring', 'observability', 'devops', 'log', 'uptime', '监控', '运维', '日志'], ['监控告警', '日志分析', '可观测性', '部署运维', '性能检测']),
  major('AI 工具', '数据智能', ['ai', 'gpt', 'llm', 'chatbot', 'aigc', '人工智能', '大模型', '智能'], ['AI 助手', '文本生成', '图像生成', '智能客服', 'AI 编程']),
  major('机器学习', '数据智能', ['machine learning', 'ml', 'model', 'training', 'deep learning', '机器学习', '模型训练'], ['模型训练', '机器学习平台', '深度学习', 'MLOps', '算法工具']),
  major('数据分析', '数据智能', ['analytics', 'bi', 'dashboard', 'report', 'chart', '数据分析', '报表', '看板'], ['商业智能', '数据可视化', '统计分析', '产品分析', '报表工具']),
  major('搜索推荐', '数据智能', ['search', 'recommendation', 'index', 'query', '搜索', '推荐', '检索'], ['搜索引擎', '站内搜索', '推荐系统', '知识检索', 'SEO 查询']),
  major('物联网', '智能硬件', ['iot', 'sensor', 'device', 'smart home', '物联网', '传感器', '设备'], ['IoT 平台', '智能家居', '设备管理', '工业物联', '传感数据']),
  major('智能硬件', '智能硬件', ['hardware', 'device', 'robot', 'wearable', '智能硬件', '机器人', '穿戴'], ['机器人', '可穿戴设备', '智能设备', '硬件开发', '设备社区']),
  major('VR/AR', '智能硬件', ['vr', 'ar', 'xr', 'metaverse', 'virtual reality', '增强现实', '虚拟现实'], ['VR 内容', 'AR 工具', 'XR 设备', '三维空间', '沉浸体验']),
  major('独立站建站', '电商营销', ['website builder', 'site builder', 'cms', 'wordpress', 'shopify', '建站', '独立站'], ['建站工具', 'CMS 系统', '网站模板', '托管部署', '站长工具']),
  major('跨境电商', '电商营销', ['cross border', 'shopify', 'amazon seller', 'dropshipping', '跨境', '外贸', '独立站'], ['跨境平台', '外贸工具', '独立站运营', '店铺管理', '物流支付']),
  major('浏览器插件', '开发技术', ['extension', 'browser', 'chrome', 'firefox addon', '插件', '浏览器扩展'], ['Chrome 插件', 'Firefox 扩展', '效率插件', '开发者插件', '安全插件']),
  major('移动应用', '移动生态', ['app', 'ios', 'android', 'mobile', '应用', '移动端', '手机'], ['iOS 应用', 'Android 应用', '应用分发', '移动开发', '应用工具']),
  major('小程序生态', '移动生态', ['mini program', 'wechat mini', '小程序', '微信小程序', '支付宝小程序'], ['微信小程序', '小程序工具', '小程序开发', '小程序运营', '本地小程序']),
  major('公益慈善', '公共服务', ['charity', 'nonprofit', 'donation', 'foundation', '公益', '慈善', '捐赠'], ['公益组织', '慈善捐赠', '志愿服务', '公益项目', '社会服务']),
  major('农业农村', '公共服务', ['agriculture', 'farm', 'rural', 'crop', '农业', '农村', '农产品'], ['农业资讯', '农产品平台', '智慧农业', '乡村服务', '农业技术']),
];

/**
 * 生成行业大类配置，统一结构便于后续评分和写入。
 * @param {string} name 大类名称。
 * @param {string} group 上级领域。
 * @param {string[]} signals 大类匹配信号。
 * @param {string[]} subcategories 小类别名称。
 * @returns {object} 标准化行业配置。
 */
function major(name, group, signals, subcategories) {
  return {
    name,
    group,
    signals,
    subcategories: subcategories.map((subcategory) => ({
      name: subcategory,
      signals: [...signals, ...subcategory.split(/\s+|\/|-/).filter(Boolean), subcategory],
    })),
  };
}

/**
 * 解析正整数配置，不合法时使用默认值。
 * @param {string|undefined} value 原配置值。
 * @param {number} fallback 默认值。
 * @returns {number} 解析后的正整数。
 */
function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

/**
 * 建立当前 CSV 的三重去重索引。
 * @param {object[]} records 当前记录。
 * @returns {{domains: Set<string>, names: Set<string>, slugs: Set<string>}} 去重索引。
 */
function buildIndexes(records) {
  const indexes = {
    domains: new Set(),
    names: new Set(),
    slugs: new Set(),
  };
  for (const row of records) {
    try {
      indexes.domains.add(normalizeDomain(new URL(row.url).hostname));
    } catch {
      // 非法 URL 会在最终校验暴露，这里只避免索引构建中断。
    }
    indexes.names.add(String(row.name || '').toLowerCase());
    indexes.slugs.add(generateSlug(row.name || ''));
  }
  return indexes;
}

/**
 * 读取历史尝试过的候选域名，避免连续批次重复访问失败站点。
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
 * 写回历史尝试域名，供下一批继续采集时跳过。
 * @param {Set<string>} attempted 已尝试域名集合。
 */
function writeAttemptedDomains(attempted) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(ATTEMPTED_PATH, `${JSON.stringify([...attempted].sort(), null, 2)}\n`, 'utf8');
}

/**
 * 判断域名是否明显属于国内站点候选。
 * @param {string} domain 规范化域名。
 * @returns {boolean} true 表示域名层面偏国内。
 */
function isDomesticDomain(domain) {
  return /\.cn$/.test(domain) || /\.(com|net|org|edu|ac)\.cn$/.test(domain);
}

/**
 * 检查域名和页面文本是否命中禁收规则。
 * @param {string} value 待检测文本。
 * @returns {boolean} true 表示高风险。
 */
function hasSensitiveContent(value) {
  const text = String(value || '').toLowerCase();
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * 从页面 HTML 中提取标题、描述和纯文本片段。
 * @param {string} html 原始 HTML。
 * @returns {{title: string, description: string, text: string}} 页面摘要。
 */
function extractPageText(html) {
  const title = cleanText(matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = cleanText(
    matchFirst(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      || matchFirst(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i)
  );
  const body = cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).slice(0, 1200);
  return { title, description, text: [title, description, body].filter(Boolean).join(' ') };
}

/**
 * 获取正则的第一个捕获组。
 * @param {string} value 原始文本。
 * @param {RegExp} pattern 匹配规则。
 * @returns {string} 捕获内容。
 */
function matchFirst(value, pattern) {
  const match = pattern.exec(value);
  return match ? match[1] : '';
}

/**
 * 清理 HTML 实体和多余空白，得到可用于 CSV 的短文本。
 * @param {string} value 原始文本。
 * @returns {string} 清理后的文本。
 */
function cleanText(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 判断标题是否过于泛化，不适合做站点名称。
 * @param {string} title 页面标题。
 * @returns {boolean} true 表示标题不可用。
 */
function isGenericTitle(title) {
  const text = String(title || '').trim();
  return !text || GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * 根据域名生成保守的网站名。
 * @param {string} domain 规范化域名。
 * @param {string} title 页面标题。
 * @returns {string} 网站名称。
 */
function buildName(domain, title) {
  if (!isGenericTitle(title)) {
    return title
      .replace(/[|-].{0,80}$/u, '')
      .trim()
      .slice(0, 80) || domain;
  }
  const label = domain.split('.').slice(0, -1).pop() || domain;
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || domain;
}

/**
 * 计算中文字符占比，用来辅助判断国内/海外。
 * @param {string} text 页面文本。
 * @returns {number} 中文字符占比。
 */
function chineseRatio(text) {
  const compact = String(text || '').replace(/\s+/g, '');
  if (!compact) return 0;
  const chinese = compact.match(/[\u4e00-\u9fff]/g) || [];
  return chinese.length / compact.length;
}

/**
 * 判断页面记录的地区，国内优先但不把纯英文 .com 强行标为国内。
 * @param {string} domain 规范化域名。
 * @param {string} pageText 页面文本。
 * @returns {string} 中国或全球。
 */
function inferRegion(domain, pageText) {
  if (isDomesticDomain(domain)) return CHINA_REGION;
  const labels = domain.split('.');
  if (CHINA_DOMAIN_HINTS.some((hint) => labels.includes(hint))) return CHINA_REGION;
  if (chineseRatio(pageText) >= 0.18 && /\.(com|net|org)$/.test(domain) && /[\u4e00-\u9fff]/.test(domain)) return CHINA_REGION;
  return OVERSEAS_REGION;
}

/**
 * 对行业大类和小类别打分，选择最匹配的行业。
 * @param {string} domain 规范化域名。
 * @param {string} pageText 页面文本。
 * @returns {{major: object, subcategory: object, score: number}|null} 分类结果。
 */
function classifyIndustry(domain, pageText) {
  const override = DOMAIN_CLASSIFICATION_OVERRIDES.get(domain);
  if (override) {
    return findTaxonomyMatch(override[0], override[1], 99);
  }
  const searchText = `${domain} ${pageText}`.toLowerCase();
  const results = [];
  for (const item of INDUSTRY_TAXONOMY) {
    const majorScore = scoreSignals(searchText, item.signals) + scoreSignals(searchText, [item.name, item.group]);
    for (const subcategory of item.subcategories) {
      const score = majorScore + scoreSignals(searchText, subcategory.signals) + scoreSignals(searchText, [subcategory.name]);
      results.push({ major: item, subcategory, score });
    }
  }
  results.sort((left, right) => right.score - left.score);
  const best = results[0];
  const second = results[1];
  if (!best || best.score < 6) return null;
  if (second && best.score - second.score < 2) return null;
  return best;
}

/**
 * 根据明确域名规则查找行业分类，避免大站首页导航噪声影响结果。
 * @param {string} majorName 大类名称。
 * @param {string} subcategoryName 小类名称。
 * @param {number} score 置信分。
 * @returns {{major: object, subcategory: object, score: number}|null} 分类结果。
 */
function findTaxonomyMatch(majorName, subcategoryName, score) {
  const majorItem = INDUSTRY_TAXONOMY.find((item) => item.name === majorName);
  if (!majorItem) return null;
  const subcategory = majorItem.subcategories.find((item) => item.name === subcategoryName) || majorItem.subcategories[0];
  return { major: majorItem, subcategory, score };
}

/**
 * 统计搜索文本中信号词的得分。
 * @param {string} searchText 搜索文本。
 * @param {string[]} signals 信号词。
 * @returns {number} 匹配分。
 */
function scoreSignals(searchText, signals) {
  let score = 0;
  for (const signal of signals) {
    const normalized = String(signal || '').toLowerCase();
    if (!normalized) continue;
    if (isShortAsciiSignal(normalized) ? hasExactAsciiSignal(searchText, normalized) : searchText.includes(normalized)) {
      score += normalized.length >= 4 ? 2 : 1;
    }
  }
  return score;
}

/**
 * 判断短英文信号词是否需要按完整词匹配，避免 app/api 等词造成噪声分类。
 * @param {string} signal 信号词。
 * @returns {boolean} true 表示需要完整词匹配。
 */
function isShortAsciiSignal(signal) {
  return /^[a-z0-9+#.]+$/i.test(signal) && signal.length <= 3;
}

/**
 * 对短英文信号词做完整词匹配。
 * @param {string} text 搜索文本。
 * @param {string} signal 信号词。
 * @returns {boolean} true 表示完整词命中。
 */
function hasExactAsciiSignal(text, signal) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(signal)}([^a-z0-9]|$)`, 'i').test(text);
}

/**
 * 转义正则特殊字符。
 * @param {string} value 原始文本。
 * @returns {string} 可安全放入正则的文本。
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 从 Majestic Million 流式读取候选域名，避免一次载入百万行。
 * @param {number} limit 最大候选数量。
 * @returns {Promise<object[]>} 候选域名列表。
 */
async function readMajesticCandidates(limit) {
  return new Promise((resolve, reject) => {
    const candidates = [];
    let settled = false;
    const request = https.get(MAJESTIC_MILLION_URL, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Majestic source unavailable: ${response.statusCode}`));
        response.resume();
        return;
      }
      const rl = readline.createInterface({ input: response });
      let isHeader = true;
      rl.on('line', (line) => {
        if (isHeader) {
          isHeader = false;
          return;
        }
        const parts = line.split(',');
        const domain = normalizeDomain(parts[2]);
        if (!domain || domain.includes('_')) return;
        candidates.push({
          rank: Number.parseInt(parts[0], 10) || 0,
          domain,
          refSubnets: Number.parseInt(parts[4], 10) || 0,
          refIps: Number.parseInt(parts[5], 10) || 0,
        });
        if (candidates.length >= limit && !settled) {
          settled = true;
          rl.close();
          request.destroy();
          resolve(prioritizeCandidates(candidates));
        }
      });
      rl.on('close', () => {
        if (!settled) {
          settled = true;
          resolve(prioritizeCandidates(candidates));
        }
      });
    });
    request.setTimeout(SOURCE_TIMEOUT_MS, () => {
      request.destroy(new Error('Majestic source timeout'));
    });
    request.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

/**
 * 候选排序时把国内域名提前，同时保留公开排名的热度顺序。
 * @param {object[]} candidates 候选列表。
 * @returns {object[]} 排序后的候选列表。
 */
function prioritizeCandidates(candidates) {
  return candidates.sort((left, right) => {
    const leftDomestic = isDomesticDomain(left.domain) ? 1 : 0;
    const rightDomestic = isDomesticDomain(right.domain) ? 1 : 0;
    if (rightDomestic !== leftDomestic) return rightDomestic - leftDomestic;
    return left.rank - right.rank;
  });
}

/**
 * 访问候选首页并抽取可分类文本。
 * @param {string} domain 候选域名。
 * @returns {Promise<object|null>} 首页检测结果。
 */
async function fetchHomepage(domain) {
  for (const protocol of ['https:', 'http:']) {
    const url = `${protocol}//${domain}`;
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      if (response.status < 200 || response.status >= 400) continue;
      const contentType = response.headers.get('content-type') || '';
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) continue;
      const length = Number.parseInt(response.headers.get('content-length') || '0', 10);
      if (length > 2_000_000) continue;
      const html = await response.text();
      if (html.length < 300) continue;
      const extracted = extractPageText(html);
      if (extracted.text.length < 120) continue;
      return {
        url: response.url || url,
        status: response.status,
        contentType,
        ...extracted,
      };
    } catch {
      // 单个协议访问失败时尝试下一个协议，两个都失败才视为不可访问。
    }
  }
  return null;
}

/**
 * 判断候选记录是否可以写入当前配额。
 * @param {object} classification 分类结果。
 * @param {string} region 地区。
 * @param {Map<string, {china: number, overseas: number}>} addedCounts 本轮新增统计。
 * @returns {boolean} true 表示该分类地区仍有新增空间。
 */
function hasQuota(classification, region, addedCounts) {
  const key = classification.major.name;
  const count = addedCounts.get(key) || { china: 0, overseas: 0 };
  if (region === CHINA_REGION) return count.china < DOMESTIC_PER_MAJOR;
  return count.overseas < OVERSEAS_PER_MAJOR;
}

/**
 * 记录一次成功追加的分类配额。
 * @param {object} classification 分类结果。
 * @param {string} region 地区。
 * @param {Map<string, {china: number, overseas: number}>} addedCounts 本轮新增统计。
 */
function incrementQuota(classification, region, addedCounts) {
  const key = classification.major.name;
  if (!addedCounts.has(key)) addedCounts.set(key, { china: 0, overseas: 0 });
  const count = addedCounts.get(key);
  if (region === CHINA_REGION) count.china += 1;
  else count.overseas += 1;
}

/**
 * 将已通过检测的候选站点转换成 CSV 记录。
 * @param {object} candidate Majestic 候选。
 * @param {object} page 首页检测结果。
 * @param {object} classification 分类结果。
 * @param {string} region 地区。
 * @returns {object} CSV 记录。
 */
function candidateToRecord(candidate, page, classification, region) {
  const name = buildName(candidate.domain, page.title);
  const majorName = classification.major.name;
  const subName = classification.subcategory.name;
  const keywords = uniqueList([
    name,
    candidate.domain,
    majorName,
    subName,
    classification.major.group,
    ...classification.major.signals.slice(0, 6),
  ]).slice(0, 15);
  const monthlyVisits = estimateVisits(candidate.rank, candidate.refSubnets);
  const score = popularityScore(candidate.rank);
  return {
    name,
    url: page.url,
    short_summary: `${name} 是一个${region === CHINA_REGION ? '国内' : '海外'}网站，主要提供与${majorName}、${subName}相关的内容、工具或服务。`,
    full_description: `${name} 已在 ${UPDATED_AT} 通过首页访问检测，访问状态码为 ${page.status}。根据公开域名排名、首页标题、描述和页面文本信号，该站点归入${majorName}大类及${subName}小类，适合需要查找${classification.major.group}相关工具、资讯或在线服务的用户。页面摘要：${(page.description || page.title || candidate.domain).slice(0, 180)}。本记录只基于可访问首页和公开排名信号生成，后续可继续人工核验公司、创始人、总部和定价细节。`,
    category_1: majorName,
    category_2: subName,
    category_3: classification.major.group,
    category_4: majorName,
    category_5: subName,
    category_6: classification.major.group,
    category_7: region === CHINA_REGION ? '国内网站' : '海外网站',
    category_8: '可访问网站',
    keywords: keywords.join(','),
    company: name,
    language: region === CHINA_REGION ? '中文' : '多语言',
    is_free: '未知',
    region,
    launch_year: '',
    tags: uniqueList(['可访问', '合规检测', region === CHINA_REGION ? '国内网站' : '海外网站', majorName, subName]).join(','),
    star_rating: String(score >= 70 ? 5 : score >= 50 ? 4 : 3),
    monthly_visits: String(monthlyVisits),
    screenshot_url: '',
    founder: '',
    headquarters: '',
    pricing_model: '未公开或需人工核验',
    alternatives: '',
    target_audience: `${majorName}用户,${subName}用户,行业从业者,内容检索用户,企业或个人用户`,
    features: `${majorName},${subName},在线服务,信息检索,可访问首页`,
    platforms: 'Web',
    social_links: '',
    popularity_score: String(score),
    popularity_level: score >= 70 ? 'A' : score >= 50 ? 'B' : 'C',
    popularity_rank: String(candidate.rank || 0),
    popularity_source: 'majestic_million_accessible_homepage',
    popularity_ref_subnets: String(candidate.refSubnets || 0),
    popularity_ref_ips: String(candidate.refIps || 0),
    popularity_updated_at: UPDATED_AT,
  };
}

/**
 * 按公开排名估算热度值，避免把它伪装成真实访问量。
 * @param {number} rank Majestic 排名。
 * @param {number} refSubnets 引用子网数。
 * @returns {number} 估算热度访问量。
 */
function estimateVisits(rank, refSubnets) {
  if (!rank) return 0;
  const rankSignal = Math.round(20_000_000 / Math.sqrt(rank));
  return Math.max(1000, Math.round(rankSignal + refSubnets * 120));
}

/**
 * 根据公开排名计算 0-100 的热度评分。
 * @param {number} rank Majestic 排名。
 * @returns {number} 热度评分。
 */
function popularityScore(rank) {
  if (!rank) return 20;
  if (rank <= 1000) return 80;
  if (rank <= 10000) return 65;
  if (rank <= 100000) return 50;
  return 35;
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
 * 判断新记录是否通过名称、slug 和域名三重去重。
 * @param {object} record CSV 记录。
 * @param {object} indexes 去重索引。
 * @returns {boolean} true 表示可以追加。
 */
function canAppend(record, indexes) {
  const domain = normalizeDomain(new URL(record.url).hostname);
  const name = String(record.name || '').toLowerCase();
  const slug = generateSlug(record.name || '');
  return !indexes.domains.has(domain) && !indexes.names.has(name) && !indexes.slugs.has(slug);
}

/**
 * 更新去重索引，防止同一轮采集内重复追加。
 * @param {object} record CSV 记录。
 * @param {object} indexes 去重索引。
 */
function addToIndexes(record, indexes) {
  const domain = normalizeDomain(new URL(record.url).hostname);
  indexes.domains.add(domain);
  indexes.names.add(String(record.name || '').toLowerCase());
  indexes.slugs.add(generateSlug(record.name || ''));
}

/**
 * 处理一个候选域名，完成访问、合规、分类和记录生成。
 * @param {object} candidate 候选域名。
 * @param {object} context 采集上下文。
 * @returns {Promise<object>} 处理结果。
 */
async function processCandidate(candidate, context) {
  if (context.fetched >= MAX_FETCHES || context.appended.length >= MAX_APPEND) {
    return { status: 'limit' };
  }
  if (context.attempted.has(candidate.domain)) {
    return { status: 'attempted' };
  }
  if (context.indexes.domains.has(candidate.domain) || hasSensitiveContent(candidate.domain)) {
    return { status: 'skipped' };
  }
  context.attempted.add(candidate.domain);
  context.fetched += 1;
  const page = await fetchHomepage(candidate.domain);
  if (!page) return { status: 'inaccessible' };
  const combined = `${candidate.domain} ${page.title} ${page.description} ${page.text.slice(0, 1000)}`;
  if (hasSensitiveContent(combined)) return { status: 'sensitive' };
  const classification = classifyIndustry(candidate.domain, combined);
  if (!classification) return { status: 'unclassified' };
  const region = inferRegion(candidate.domain, combined);
  if (!hasQuota(classification, region, context.addedCounts)) return { status: 'quota_full' };
  const record = candidateToRecord(candidate, page, classification, region);
  if (!canAppend(record, context.indexes)) return { status: 'duplicate' };
  context.appended.push(record);
  addToIndexes(record, context.indexes);
  incrementQuota(classification, region, context.addedCounts);
  return {
    status: 'accepted',
    domain: candidate.domain,
    major: classification.major.name,
    subcategory: classification.subcategory.name,
    region,
  };
}

/**
 * 并发处理候选列表，但限制最大访问和追加数量。
 * @param {object[]} candidates 候选列表。
 * @param {object} context 采集上下文。
 */
async function processCandidates(candidates, context) {
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length && context.fetched < MAX_FETCHES && context.appended.length < MAX_APPEND) {
      const candidate = candidates[cursor];
      cursor += 1;
      const result = await processCandidate(candidate, context);
      context.report[result.status] = (context.report[result.status] || 0) + 1;
      if (result.status === 'accepted') {
        console.log(`追加候选：${result.domain} -> ${result.region}/${result.major}/${result.subcategory}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

/**
 * 写入采集报告，便于后续复盘哪些源通过了检测。
 * @param {object} context 采集上下文。
 */
function writeReport(context) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const report = {
    updated_at: new Date().toISOString(),
    source: MAJESTIC_MILLION_URL,
    target_per_major: TARGET_PER_MAJOR,
    domestic_per_major: DOMESTIC_PER_MAJOR,
    overseas_per_major: OVERSEAS_PER_MAJOR,
    max_candidates: MAX_CANDIDATES,
    max_fetches: MAX_FETCHES,
    max_append: MAX_APPEND,
    source_timeout_ms: SOURCE_TIMEOUT_MS,
    fetch_timeout_ms: FETCH_TIMEOUT_MS,
    fetched: context.fetched,
    appended: context.appended.length,
    attempted_total: context.attempted.size,
    status_counts: context.report,
    added_counts: Object.fromEntries([...context.addedCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'))),
    appended_domains: context.appended.map((record) => ({
      name: record.name,
      url: record.url,
      region: record.region,
      category_1: record.category_1,
      category_2: record.category_2,
    })),
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

/**
 * 主流程：读取现有 CSV、拉取候选、检测追加、写回 CSV 和报告。
 */
async function main() {
  const records = readExistingCsv(CSV_PATH);
  const indexes = buildIndexes(records);
  const attempted = loadAttemptedDomains();
  const candidates = await readMajesticCandidates(MAX_CANDIDATES);
  const context = {
    indexes,
    attempted,
    fetched: 0,
    appended: [],
    addedCounts: new Map(),
    report: {},
  };

  await processCandidates(candidates, context);
  if (context.appended.length) {
    fs.writeFileSync(CSV_PATH, toCsv([...records, ...context.appended]), 'utf8');
  }
  writeReport(context);
  writeAttemptedDomains(context.attempted);

  console.log(`候选读取：${candidates.length}`);
  console.log(`首页检测：${context.fetched}`);
  console.log(`实际追加：${context.appended.length}`);
  console.log(`报告文件：${REPORT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  INDUSTRY_TAXONOMY,
  SENSITIVE_PATTERNS,
  readMajesticCandidates,
  fetchHomepage,
  classifyIndustry,
  candidateToRecord,
  inferRegion,
  hasSensitiveContent,
  buildIndexes,
};

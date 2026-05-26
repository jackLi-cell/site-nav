/**
 * Build repeatable MySQL seed SQL chunks from the collected website resources.
 *
 * Canonical source:
 * - data/websites-import.csv is the authoritative full collected list.
 * - data/websites-import.before-*.csv are historical snapshots; only the few
 *   domains that are still missing from the canonical CSV are reused as
 *   supplemental fallback.
 * - src/data-categories.json is the curated public category tree.
 * - src/data-sites.json and data/sites-local.json only fill domains missing
 *   from the CSV, so older mojibake snapshots do not overwrite cleaned data.
 * - data/major-category-csv/*.csv are split inspection copies of the canonical
 *   CSV, not separate data sources.
 */

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { parse } = require('csv-parse');

const ROOT = path.join(__dirname, '..');
const CATEGORY_FILE = path.join(ROOT, 'src/data-categories.json');
const SRC_SITE_FILE = path.join(ROOT, 'src/data-sites.json');
const LOCAL_SITE_FILE = path.join(ROOT, 'data/sites-local.json');
const CSV_FILE = path.join(ROOT, 'data/websites-import.csv');
const LEGACY_SNAPSHOT_CSVS = [
  path.join(ROOT, 'data/websites-import.before-enrich-20260512-105213.csv'),
  path.join(ROOT, 'data/websites-import.before-industry-20260512.csv'),
  path.join(ROOT, 'data/websites-import.before-major-quota-20260512.csv'),
  path.join(ROOT, 'data/websites-import.before-subcategories-20260512.csv'),
  path.join(ROOT, 'data/websites-import.before-taxonomy-20260512.csv'),
];
const OUTPUT_DIR = path.join(ROOT, 'drizzle-mysql/import-websites-chunks');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'manifest.json');

const CHUNK_SIZE = Number(process.env.SEED_SQL_CHUNK_SIZE || '5000');
const CREATED_AT = process.env.SEED_SQL_CREATED_AT || '2026-05-12T00:00:00.000Z';

const DEFAULT_TAGS = [
  { id: 'tag_hot', name: '热门', slug: 'hot', color: '#ef4444' },
  { id: 'tag_recommended', name: '推荐', slug: 'recommended', color: '#3b82f6' },
  { id: 'tag_new', name: '新上线', slug: 'new', color: '#22c55e' },
  { id: 'tag_essential', name: '必备', slug: 'essential', color: '#f59e0b' },
  { id: 'tag_trending', name: '趋势', slug: 'trending', color: '#8b5cf6' },
  { id: 'tag_free', name: '免费精品', slug: 'free-pick', color: '#06b6d4' },
];

const DERIVED_CATEGORY_CONFIG = new Map([
  ['开发技术', { slug: 'developer-technology', parentName: '开发者工具' }],
  ['数据智能', { slug: 'data-intelligence', parentName: '数据分析' }],
  ['创意设计', { slug: 'creative-design', parentName: '设计资源' }],
  ['教育培训', { slug: 'education-training', parentName: '学习教育' }],
  ['内容媒体', { slug: 'content-media', parentName: '新闻资讯' }],
  ['购物平台', { slug: 'shopping-platforms', parentName: '电商购物' }],
  ['商家工具', { slug: 'merchant-tools', parentName: '电商购物' }],
  ['设计素材', { slug: 'design-assets', parentName: '设计资源' }],
  ['企业服务', { slug: 'business-services', parentName: null }],
  ['内容创作', { slug: 'content-creation', parentName: '写作工具' }],
  ['数据洞察', { slug: 'data-insights', parentName: '数据分析' }],
  ['数字出版', { slug: 'digital-publishing', parentName: '新闻资讯' }],
  ['设计协作', { slug: 'design-collaboration', parentName: '设计资源' }],
  ['社群运营', { slug: 'community-operations', parentName: '社交媒体' }],
  ['电商服务', { slug: 'ecommerce-services', parentName: '电商购物' }],
  ['短视频工具', { slug: 'short-video-tools', parentName: '视频工具' }],
  ['项目协作', { slug: 'project-collaboration', parentName: '效率办公' }],
  ['图片编辑', { slug: 'image-editing', parentName: '图片素材' }],
  ['API 开发', { slug: 'api-development', parentName: '开发者工具' }],
  ['测试自动化', { slug: 'test-automation', parentName: '开发者工具' }],
  ['企业知识库', { slug: 'business-knowledge-base', parentName: '企业服务' }],
  ['供应链管理', { slug: 'supply-chain-management', parentName: '企业服务' }],
  ['人力资源软件', { slug: 'hr-software', parentName: '企业服务' }],
  ['客户成功', { slug: 'customer-success', parentName: '企业服务' }],
  ['财务报销', { slug: 'expense-management', parentName: '企业服务' }],
  ['播客音频', { slug: 'podcast-audio', parentName: '影音娱乐' }],
  ['低代码开发', { slug: 'low-code-development', parentName: '低代码平台' }],
  ['技术服务', { slug: 'technical-services', parentName: '开发者工具' }],
  ['字体图标', { slug: 'fonts-icons', parentName: '设计资源' }],
  ['UI 组件库', { slug: 'ui-component-libraries', parentName: '设计资源' }],
  ['视频剪辑', { slug: 'video-editing', parentName: '视频工具' }],
  ['电商营销', { slug: 'ecommerce-marketing', parentName: '营销推广' }],
  ['数字娱乐', { slug: 'digital-entertainment', parentName: '影音娱乐' }],
  ['CMS 系统', { slug: 'cms-systems', parentName: '低代码平台' }],
  ['餐饮管理', { slug: 'restaurant-management', parentName: '企业服务' }],
  ['测试工具', { slug: 'testing-tools', parentName: '开发者工具' }],
  ['独立站建站', { slug: 'independent-site-builders', parentName: '域名主机' }],
  ['法律服务', { slug: 'legal-services', parentName: '企业服务' }],
  ['高校资源', { slug: 'university-resources', parentName: '学习教育' }],
  ['技术文档', { slug: 'technical-documentation', parentName: '开发者工具' }],
  ['建站工具', { slug: 'site-building-tools', parentName: '域名主机' }],
  ['科技媒体', { slug: 'tech-media', parentName: '新闻资讯' }],
  ['科研学术', { slug: 'research-academia', parentName: '学习教育' }],
  ['美食餐饮', { slug: 'food-dining', parentName: '生活服务' }],
  ['商业服务', { slug: 'commercial-services', parentName: '企业服务' }],
  ['数据库工具', { slug: 'database-tools', parentName: '开发者工具' }],
  ['数据库管理', { slug: 'database-management', parentName: '开发者工具' }],
  ['消费生活', { slug: 'consumer-lifestyle', parentName: '生活服务' }],
  ['协作工具', { slug: 'collaboration-tools', parentName: '效率办公' }],
  ['游戏娱乐', { slug: 'gaming-entertainment', parentName: '影音娱乐' }],
  ['远程会议', { slug: 'remote-meetings', parentName: '远程办公' }],
  ['云计算主机', { slug: 'cloud-hosting', parentName: '云服务' }],
  ['云原生运维', { slug: 'cloud-native-ops', parentName: '云服务' }],
  ['在线工具', { slug: 'online-tools', parentName: '效率办公' }],
  ['知识产权', { slug: 'intellectual-property', parentName: '企业服务' }],
  ['Firefox 扩展', { slug: 'firefox-extensions', parentName: '开发者工具' }],
  ['UI 设计', { slug: 'ui-design', parentName: '设计资源' }],
]);

const CATEGORY_SYNONYMS = new Map([
  ['开发技术', '开发者工具'],
  ['数据智能', '数据分析'],
  ['创意设计', '设计资源'],
  ['内容媒体', '新闻资讯'],
  ['教育培训', '学习教育'],
  ['推荐搜索', '搜索引擎'],
  ['项目协作', '效率办公'],
  ['办公效率', '效率办公'],
  ['购物平台', '电商购物'],
  ['商家工具', '电商购物'],
  ['在线课程', '学习教育'],
  ['PDF工具', '文件工具'],
  ['PDF 工具', '文件工具'],
  ['AI', 'AI 工具'],
  ['人工智能', 'AI 工具'],
  ['云计算主机', '云服务'],
  ['独立站建站', '域名主机'],
]);

const RAW_CATEGORY_IMPLIED_SLUGS = new Map([
  ['API 开发', ['dev-api']],
  ['测试自动化', ['dev-devops']],
  ['测试工具', ['dev-devops']],
  ['数据库工具', ['dev-database']],
  ['数据库管理', ['dev-database']],
  ['UI 组件库', ['dev-frontend', 'design-ui']],
  ['UI 设计', ['design-ui']],
  ['字体图标', ['design-icons']],
  ['设计素材', ['design-icons']],
  ['设计协作', ['design-ui', 'prod-project']],
  ['项目协作', ['prod-project']],
  ['企业知识库', ['prod-notes', 'prod-docs']],
  ['内容创作', ['ai-writing', 'prod-docs']],
  ['短视频工具', ['ent-video']],
  ['视频剪辑', ['ent-video']],
  ['播客音频', ['ent-music']],
  ['购物平台', ['shop-general']],
  ['商家工具', ['shop-general']],
  ['电商服务', ['shop-general']],
  ['电商营销', ['shop-general']],
  ['在线课程', ['learn-courses']],
  ['编程学习', ['learn-coding']],
  ['云计算主机', ['cloud-public']],
  ['云原生运维', ['cloud-edge', 'dev-devops']],
  ['低代码开发', ['dev-frontend']],
  ['远程会议', ['social-messaging', 'prod-project']],
]);

const SUBCATEGORY_RULES = [
  {
    slug: 'ai-chat',
    contextSlugs: ['ai-tools', 'data-intelligence', 'search-engines'],
    any: ['chatgpt', 'claude', 'gemini', '对话', '聊天', '问答', '智能助手', 'assistant'],
  },
  {
    slug: 'ai-image',
    contextSlugs: ['ai-tools', 'data-intelligence', 'creative-design', 'design-resources', 'images-stock', 'image-editing'],
    any: ['midjourney', 'dall-e', 'stable diffusion', 'ai 绘画', 'ai绘画', '图像生成', '图片生成', '文生图'],
  },
  {
    slug: 'ai-coding',
    contextSlugs: ['ai-tools', 'data-intelligence', 'developer-tools', 'developer-technology', 'api-development', 'open-source'],
    any: ['cursor', 'codeium', 'tabnine', 'replit', 'sourcegraph', 'coderabbit', 'codium', 'github copilot', 'ai 编程', 'ai编程', '代码助手', '编程助手', 'code assistant', 'coding assistant', '代码生成'],
  },
  {
    slug: 'ai-video',
    contextSlugs: ['ai-tools', 'video-tools', 'short-video-tools'],
    any: ['runway', 'pika', 'sora', 'kling', 'veo', 'ai 视频', 'ai视频', '视频生成', '文生视频'],
  },
  {
    slug: 'ai-audio',
    contextSlugs: ['ai-tools', 'podcast-audio', 'entertainment'],
    any: ['elevenlabs', 'suno', 'udio', 'tts', '语音合成', '音频生成', 'ai 音频', 'ai音频', '播客音频'],
  },
  {
    slug: 'ai-search',
    contextSlugs: ['ai-tools', 'search-engines', 'data-intelligence'],
    any: ['perplexity', 'you.com', 'bing', 'ai 搜索', 'ai搜索', '搜索', '问答搜索', '智能搜索'],
  },
  {
    slug: 'ai-writing',
    contextSlugs: ['ai-tools', 'writing-tools', 'content-creation'],
    any: ['jasper', 'copy.ai', '写作', '文案', '内容生成', 'ai 写作', 'ai写作', '博客生成'],
  },
  {
    slug: 'ai-platform',
    contextSlugs: ['ai-tools', 'developer-tools', 'data-intelligence'],
    any: ['openai', 'hugging face', 'huggingface', 'anthropic', '大模型', '模型平台', 'llm', 'api'],
  },
  {
    slug: 'dev-frontend',
    contextSlugs: ['developer-tools', 'developer-technology', 'open-source', 'learn-coding'],
    any: ['前端', 'react', 'vue', 'angular', 'svelte', 'javascript', 'typescript', 'css', 'html', '组件库', 'ui 组件'],
  },
  {
    slug: 'dev-backend',
    contextSlugs: ['developer-tools', 'developer-technology', 'open-source'],
    any: ['后端', 'node.js', 'nodejs', 'django', 'flask', 'fastapi', 'laravel', 'rails', 'spring', 'server side', '服务器端'],
  },
  {
    slug: 'dev-database',
    contextSlugs: ['developer-tools', 'developer-technology', 'data-analytics', 'database-tools', 'database-management'],
    any: ['数据库', 'database', 'mysql', 'postgres', 'postgresql', 'redis', 'mongodb', 'sql', 'supabase'],
  },
  {
    slug: 'dev-api',
    contextSlugs: ['developer-tools', 'developer-technology', 'api-development', 'testing-tools', 'test-automation'],
    any: ['api', '接口', 'postman', 'swagger', 'openapi', 'graphql', 'webhook', '接口测试'],
  },
  {
    slug: 'dev-ide',
    contextSlugs: ['developer-tools', 'developer-technology'],
    any: ['ide', '编辑器', 'editor', 'vscode', 'vs code', 'visual studio code', 'jetbrains', 'intellij', '代码编辑'],
  },
  {
    slug: 'dev-devops',
    contextSlugs: ['developer-tools', 'developer-technology', 'cloud-services', 'cloud-native-ops', 'test-automation'],
    any: ['devops', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'cicd', 'terraform', '部署', '运维', '监控', '自动化测试'],
  },
  {
    slug: 'design-ui',
    contextSlugs: ['design-resources', 'creative-design', 'ui-design', 'ui-component-libraries'],
    any: ['figma', 'sketch', 'ui', 'ux', '原型', '界面设计', '设计工具', 'wireframe', 'prototype'],
  },
  {
    slug: 'design-icons',
    contextSlugs: ['design-resources', 'design-assets', 'fonts-icons', 'images-stock'],
    any: ['图标', 'icon', 'icons', 'svg', '字体图标', 'iconify', 'feather'],
  },
  {
    slug: 'design-inspiration',
    contextSlugs: ['design-resources', 'creative-design', 'design-assets'],
    any: ['dribbble', 'behance', '灵感', 'inspiration', 'showcase', '设计参考'],
  },
  {
    slug: 'prod-project',
    contextSlugs: ['productivity', 'project-collaboration', 'collaboration-tools', 'remote-work'],
    any: ['项目管理', '任务管理', 'jira', 'linear', 'asana', 'trello', '看板', '协作', '流程'],
  },
  {
    slug: 'prod-notes',
    contextSlugs: ['productivity', 'business-knowledge-base', 'writing-tools'],
    any: ['notion', 'obsidian', '笔记', '知识库', 'note', 'notes', '记录'],
  },
  {
    slug: 'prod-docs',
    contextSlugs: ['productivity', 'business-knowledge-base', 'technical-documentation', 'writing-tools'],
    any: ['文档', 'docs', 'document', 'google docs', 'wiki', '在线文档', '技术文档'],
  },
  {
    slug: 'prod-automation',
    contextSlugs: ['productivity', 'online-tools', 'project-collaboration'],
    any: ['自动化', 'automation', 'zapier', 'make.com', 'make ', 'workflow', '工作流'],
  },
  {
    slug: 'social-general',
    contextSlugs: ['social-media', 'content-media'],
    any: ['社交媒体', 'social media', 'twitter', 'x.com', 'facebook', 'instagram', '小红书', '微博'],
  },
  {
    slug: 'social-messaging',
    contextSlugs: ['social-media', 'remote-work', 'productivity', 'project-collaboration', 'collaboration-tools'],
    any: ['whatsapp', 'telegram', '微信', 'slack', 'discord', '聊天', '即时通讯', 'message', 'messaging', '团队沟通', '视频会议'],
  },
  {
    slug: 'social-community',
    contextSlugs: ['social-media', 'community-operations', 'content-media'],
    any: ['reddit', '论坛', '社区', 'community', '社群', 'forum'],
  },
  {
    slug: 'ent-video',
    contextSlugs: ['entertainment', 'video-tools', 'short-video-tools', 'digital-entertainment'],
    any: ['youtube', 'bilibili', '视频', '直播', 'streaming', 'video', '短视频'],
  },
  {
    slug: 'ent-music',
    contextSlugs: ['entertainment', 'podcast-audio', 'digital-entertainment'],
    any: ['spotify', '音乐', 'music', '音频', 'podcast', '播客'],
  },
  {
    slug: 'ent-gaming',
    contextSlugs: ['entertainment', 'gaming-entertainment', 'digital-entertainment'],
    any: ['steam', 'epic games', '游戏', 'gaming', 'game'],
  },
  {
    slug: 'shop-general',
    contextSlugs: ['ecommerce', 'shopping-platforms', 'merchant-tools', 'ecommerce-services'],
    any: ['amazon', '淘宝', '京东', '购物', '电商', '商城', 'shop', 'shopping', 'marketplace'],
  },
  {
    slug: 'shop-cross-border',
    contextSlugs: ['ecommerce', 'ecommerce-services', 'shopping-platforms'],
    any: ['跨境', 'aliexpress', 'shopee', 'shopify', 'temu', '跨境电商', 'cross-border'],
  },
  {
    slug: 'learn-courses',
    contextSlugs: ['learning', 'education-training', 'university-resources'],
    any: ['在线课程', '课程', 'coursera', 'udemy', 'edx', 'khan academy', '学习平台', 'course'],
  },
  {
    slug: 'learn-coding',
    contextSlugs: ['learning', 'developer-tools', 'developer-technology', 'education-training'],
    any: ['freecodecamp', '编程学习', '编程课程', 'coding course', 'learn coding', '代码学习', '编程', '代码', '开发者'],
  },
  {
    slug: 'cloud-public',
    contextSlugs: ['cloud-services', 'cloud-hosting'],
    any: ['aws', 'azure', 'google cloud', 'gcp', '阿里云', '腾讯云', '公有云', '云计算', '云服务'],
  },
  {
    slug: 'cloud-edge',
    contextSlugs: ['cloud-services', 'cloud-native-ops', 'hosting'],
    any: ['cloudflare', 'vercel', 'netlify', 'cdn', '边缘计算', 'edge', '边缘网络'],
  },
  {
    slug: 'fin-payment',
    contextSlugs: ['finance', 'expense-management', 'ecommerce-services'],
    any: ['支付', 'paypal', 'stripe', 'alipay', '支付宝', '微信支付', 'payment'],
  },
  {
    slug: 'fin-crypto',
    contextSlugs: ['finance'],
    any: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'web3', '加密货币', '区块链', 'coinbase', 'binance'],
  },
];

const OPERATION_MARKERS = new Set([
  '单一主类',
  '配额重分配',
  '配额回补',
  '国内配额补齐',
  '国内配额回补',
  '国内候选补充',
  '海外网站',
  '国内网站',
  '已补全',
  '主类合并',
  '配额补充',
  '违规清理后配额回补',
  '可访问网站',
  '热门',
  '推荐',
]);

function readJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureCleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-\/|,，。·]+/g, '');
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stableId(prefix, value, length = 24) {
  return `${prefix}_${createHash('sha1').update(String(value || '')).digest('hex').slice(0, length)}`;
}

function extractDomain(url) {
  try {
    const normalizedUrl = /^https?:\/\//i.test(String(url || '')) ? url : `https://${url}`;
    const parsed = new URL(normalizedUrl);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function normalizeRegion(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text.includes('中') || text.includes('国') || ['china', 'cn', 'mainland', 'domestic'].includes(text)) {
    return 'china';
  }
  return 'overseas';
}

function splitList(value) {
  return String(value || '')
    .split(/[,\uFF0C;；]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toInt(value, fallback = null) {
  const parsed = Number.parseInt(String(value ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampRating(value) {
  const parsed = toInt(value, 1);
  return Math.max(1, Math.min(5, parsed || 1));
}

function hasMojibake(value) {
  return /[锟�]|[æåç][^\s]{1,}|�/.test(String(value || ''));
}

function sqlString(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x1a/g, '\\Z')
    .replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? String(Math.trunc(numberValue)) : 'NULL';
}

function tuple(values) {
  return `(${values.map((value) => (typeof value === 'number' ? sqlNumber(value) : sqlString(value))).join(', ')})`;
}

function writeChunk(table, columns, rows, options = {}) {
  const { insertVerb = 'INSERT INTO', update = [], ignore = false } = options;
  if (!rows.length) return [];
  const files = [];
  const verb = ignore ? 'INSERT IGNORE INTO' : insertVerb;
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const part = Math.floor(index / CHUNK_SIZE) + 1;
    const fileName = `${String(files.length + 1).padStart(2, '0')}_${table}_${String(part).padStart(5, '0')}.sql`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    const batch = rows.slice(index, index + CHUNK_SIZE);
    const updateSql = update.length ? `\nON DUPLICATE KEY UPDATE ${update.join(', ')};\n` : ';\n';
    const sql = [
      `-- ${table} ${index + 1}-${index + batch.length} / ${rows.length}`,
      `${verb} \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES`,
      batch.map(tuple).join(',\n'),
      updateSql,
    ].join('\n');
    fs.writeFileSync(filePath, sql, 'utf8');
    files.push({ file: fileName, table, rows: batch.length });
  }
  return files;
}

function buildCategoryLookup(categories) {
  const lookup = new Map();
  for (const category of categories) {
    lookup.set(normalizeLookupKey(category.name), category.id);
    lookup.set(normalizeLookupKey(category.slug), category.id);
  }
  for (const [from, to] of CATEGORY_SYNONYMS.entries()) {
    const targetId = lookup.get(normalizeLookupKey(to));
    const fromKey = normalizeLookupKey(from);
    if (targetId && !lookup.has(fromKey)) lookup.set(fromKey, targetId);
  }
  return lookup;
}

function buildSlugLookup(categories) {
  return new Map(categories.map((category) => [category.slug, category.id]));
}

async function collectRawCategoryNames(filePath, names) {
  if (!fs.existsSync(filePath)) return;

  const parser = fs.createReadStream(filePath, { encoding: 'utf8' }).pipe(parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }));

  for await (const record of parser) {
    for (let index = 1; index <= 8; index += 1) {
      const raw = String(record[`category_${index}`] || '').trim();
      if (!raw || OPERATION_MARKERS.has(raw)) continue;
      names.add(raw);
    }
  }
}

async function buildFullCategoryList(baseCategories) {
  const categories = baseCategories.map((category) => ({ ...category }));
  const byName = new Map(categories.map((category) => [normalizeLookupKey(category.name), category]));
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const rawNames = new Set();

  await collectRawCategoryNames(CSV_FILE, rawNames);

  for (const rawName of [...rawNames].sort((left, right) => left.localeCompare(right, 'zh-CN'))) {
    const rawKey = normalizeLookupKey(rawName);
    if (byName.has(rawKey)) continue;

    const config = DERIVED_CATEGORY_CONFIG.get(rawName) || {};
    const parent = config.parentName ? byName.get(normalizeLookupKey(config.parentName)) : null;
    const slug = config.slug || `extra-${createHash('sha1').update(rawName).digest('hex').slice(0, 10)}`;
    let uniqueSlug = slug;
    let suffix = 2;
    while (bySlug.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${suffix}`;
      suffix += 1;
    }

    const category = {
      id: `cat_${uniqueSlug.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')}`,
      name: rawName,
      slug: uniqueSlug,
      description: `${rawName}相关网站、工具和在线资源。`,
      icon: null,
      parent_id: parent?.id || null,
      level: parent ? 2 : 1,
      sort_order: categories.length + 1,
      website_count: 0,
    };

    categories.push(category);
    byName.set(rawKey, category);
    bySlug.set(uniqueSlug, category);
  }

  for (const category of categories) {
    const config = DERIVED_CATEGORY_CONFIG.get(category.name);
    if (!config?.parentName) continue;
    const parent = byName.get(normalizeLookupKey(config.parentName));
    if (parent && parent.id !== category.id) {
      category.parent_id = parent.id;
      category.level = 2;
    }
  }

  return categories;
}

function pickCategoryIds(record, categoryLookup) {
  const ids = [];
  for (let index = 1; index <= 8; index += 1) {
    const raw = String(record[`category_${index}`] || '').trim();
    if (!raw || OPERATION_MARKERS.has(raw)) continue;
    const categoryId = categoryLookup.get(normalizeLookupKey(raw));
    if (categoryId && !ids.includes(categoryId)) {
      ids.push(categoryId);
    }
  }
  return ids;
}

function addCategoryId(ids, categoryId) {
  if (categoryId && !ids.includes(categoryId)) {
    ids.push(categoryId);
  }
}

function recordSearchText(record) {
  const fields = [
    'name',
    'short_summary',
    'full_description',
    'keywords',
    'tags',
    'company',
    'alternatives',
    'target_audience',
    'features',
    'platforms',
  ];
  return fields.map((field) => record[field] || '').join(' ').toLowerCase();
}

function applyPresetSubcategoryRules(record, ids, state) {
  const slugSet = new Set(ids
    .map((id) => state.categoryById.get(id)?.slug)
    .filter(Boolean));

  for (let index = 1; index <= 8; index += 1) {
    const raw = String(record[`category_${index}`] || '').trim();
    if (!raw || OPERATION_MARKERS.has(raw)) continue;
    const impliedSlugs = RAW_CATEGORY_IMPLIED_SLUGS.get(raw);
    if (!impliedSlugs) continue;
    for (const slug of impliedSlugs) {
      const categoryId = state.categoryBySlug.get(slug);
      addCategoryId(ids, categoryId);
      if (categoryId) slugSet.add(slug);
    }
  }

  const text = recordSearchText(record);
  for (const rule of SUBCATEGORY_RULES) {
    if (slugSet.has(rule.slug)) continue;
    const hasContext = !rule.contextSlugs?.length || rule.contextSlugs.some((slug) => slugSet.has(slug));
    if (!hasContext) continue;
    if (!rule.any.some((term) => text.includes(term.toLowerCase()))) continue;
    const categoryId = state.categoryBySlug.get(rule.slug);
    addCategoryId(ids, categoryId);
    if (categoryId) slugSet.add(rule.slug);
  }
}

function addKeyword(keywordMap, value) {
  const name = String(value || '').trim();
  const normalized = normalizeLookupKey(name);
  if (!normalized) return null;
  if (!keywordMap.has(normalized)) {
    keywordMap.set(normalized, [
      stableId('kw', normalized),
      name.slice(0, 255),
      normalized.slice(0, 255),
      CREATED_AT,
    ]);
  }
  return keywordMap.get(normalized)[0];
}

function addTag(tagMap, value) {
  const name = String(value || '').trim();
  const normalized = normalizeLookupKey(name);
  if (!normalized) return null;
  if (!tagMap.has(normalized)) {
    tagMap.set(normalized, [
      stableId('tag', normalized),
      name.slice(0, 120),
      (slugify(name) || normalized).slice(0, 120),
      null,
      CREATED_AT,
    ]);
  }
  return tagMap.get(normalized)[0];
}

function upsertWebsiteFromRecord(state, record, source) {
  const name = String(record.name || '').trim();
  const url = normalizeUrl(record.url || '');
  const shortSummary = String(record.short_summary || record.shortSummary || '').trim();
  if (!name || !url || !shortSummary) {
    state.skipped += 1;
    return;
  }

  const domain = extractDomain(url);
  if (!domain) {
    state.skipped += 1;
    return;
  }

  if (state.domainSet.has(domain)) {
    state.duplicateDomains += 1;
    return;
  }

  const rawSlug = slugify(record.slug || name) || slugify(domain);
  const slug = `${rawSlug}-${createHash('sha1').update(domain).digest('hex').slice(0, 8)}`.slice(0, 255);
  const websiteId = stableId('site', domain);
  const isCsvSource = source === 'csv' || source === 'canonical-csv' || source === 'legacy-snapshot';
  const categoryIds = isCsvSource
    ? pickCategoryIds(record, state.categoryLookup)
    : (Array.isArray(record.categories)
      ? record.categories
        .map((category) => state.categoryLookup.get(normalizeLookupKey(category)))
        .filter(Boolean)
      : []);

  if (!categoryIds.length) {
    const fallback = state.categoryLookup.get(normalizeLookupKey(record.category_1 || '资源导航'));
    if (fallback) categoryIds.push(fallback);
  }
  applyPresetSubcategoryRules(record, categoryIds, state);

  const keywordIds = [];
  for (const keyword of splitList(record.keywords)) {
    const keywordId = addKeyword(state.keywordMap, keyword);
    if (keywordId && !keywordIds.includes(keywordId)) keywordIds.push(keywordId);
  }
  for (const categoryId of categoryIds) {
    const category = state.categoryById.get(categoryId);
    if (category) {
      const keywordId = addKeyword(state.keywordMap, category.name);
      if (keywordId && !keywordIds.includes(keywordId)) keywordIds.push(keywordId);
    }
  }

  const tagIds = [];
  for (const tag of splitList(record.tags)) {
    if (hasMojibake(tag)) continue;
    const tagId = addTag(state.tagMap, tag);
    if (tagId && !tagIds.includes(tagId)) tagIds.push(tagId);
  }

  const viewCount = toInt(record.view_count, 0) || 0;
  const popularityScore = toInt(record.popularity_score, null);
  const popularityRank = toInt(record.popularity_rank, null);
  const monthlyVisits = toInt(record.monthly_visits, null);
  const starRating = clampRating(record.star_rating || (popularityScore && popularityScore >= 80 ? 5 : popularityScore && popularityScore >= 60 ? 4 : 3));
  const createdAt = String(record.created_at || record.createdAt || CREATED_AT);

  state.websiteRows.push([
    websiteId,
    name.slice(0, 255),
    slug,
    url.slice(0, 2048),
    domain.slice(0, 255),
    shortSummary.slice(0, 500),
    record.full_description ? String(record.full_description).trim() : null,
    'active',
    normalizeRegion(record.region),
    starRating,
    Math.max(viewCount, popularityScore || 0, popularityRank ? Math.max(1, 1000000 - popularityRank) : 0),
    monthlyVisits,
    record.company ? String(record.company).trim().slice(0, 255) : null,
    record.founder ? String(record.founder).trim().slice(0, 255) : null,
    record.headquarters ? String(record.headquarters).trim().slice(0, 255) : null,
    record.language ? String(record.language).trim().slice(0, 80) : null,
    record.is_free ? String(record.is_free).trim().slice(0, 40) : null,
    toInt(record.launch_year, null),
    record.pricing_model ? String(record.pricing_model).trim().slice(0, 255) : null,
    record.alternatives ? String(record.alternatives).trim() : null,
    record.target_audience ? String(record.target_audience).trim() : null,
    record.features ? String(record.features).trim() : null,
    record.platforms ? String(record.platforms).trim() : null,
    record.social_links ? String(record.social_links).trim() : null,
    record.screenshot_url ? String(record.screenshot_url).trim().slice(0, 2048) : null,
    null,
    null,
    0,
    null,
    null,
    null,
    createdAt,
    createdAt,
  ]);

  for (const categoryId of categoryIds) {
    state.websiteCategoryRows.push([websiteId, categoryId]);
  }
  for (const keywordId of keywordIds) {
    state.websiteKeywordRows.push([websiteId, keywordId]);
  }
  for (const tagId of tagIds) {
    state.websiteTagRows.push([websiteId, tagId]);
  }

  state.domainSet.add(domain);
}

async function readCsvIntoState(state, filePath, sourceLabel) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing CSV source: ${path.relative(ROOT, filePath)}`);
  }

  const parser = fs.createReadStream(filePath, { encoding: 'utf8' }).pipe(parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }));

  for await (const record of parser) {
    upsertWebsiteFromRecord(state, record, sourceLabel);
    if (state.websiteRows.length > 0 && state.websiteRows.length % 25000 === 0) {
      console.log(`[build-seed-sql] prepared ${sourceLabel} websites: ${state.websiteRows.length}`);
    }
  }
}

async function readSupplementalCsvs(state) {
  let addedFiles = 0;
  for (const filePath of LEGACY_SNAPSHOT_CSVS) {
    if (!fs.existsSync(filePath)) continue;
    await readCsvIntoState(state, filePath, 'legacy-snapshot');
    addedFiles += 1;
  }
  console.log(`[build-seed-sql] legacy snapshot CSVs processed: ${addedFiles}`);
}

function addJsonFallbackSites(state) {
  for (const filePath of [SRC_SITE_FILE, LOCAL_SITE_FILE]) {
    const sites = readJson(filePath, []);
    let added = 0;
    for (const site of sites) {
      const before = state.websiteRows.length;
      upsertWebsiteFromRecord(state, site, 'json');
      if (state.websiteRows.length > before) added += 1;
    }
    console.log(`[build-seed-sql] ${path.relative(ROOT, filePath)} fallback added: ${added}`);
  }
}

function uniqueRows(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = row.join('\u0001');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

async function main() {
  ensureCleanDir(OUTPUT_DIR);

  const baseCategories = readJson(CATEGORY_FILE);
  if (!baseCategories.length) {
    throw new Error('Missing categories. Expected src/data-categories.json.');
  }
  const categories = await buildFullCategoryList(baseCategories);

  const categoryLookup = buildCategoryLookup(categories);
  const state = {
    categoryLookup,
    categoryById: new Map(categories.map((category) => [category.id, category])),
    categoryBySlug: buildSlugLookup(categories),
    domainSet: new Set(),
    keywordMap: new Map(),
    tagMap: new Map(DEFAULT_TAGS.map((tag) => [
      normalizeLookupKey(tag.name),
      [tag.id, tag.name, tag.slug, tag.color, CREATED_AT],
    ])),
    websiteRows: [],
    websiteCategoryRows: [],
    websiteKeywordRows: [],
    websiteTagRows: [],
    skipped: 0,
    duplicateDomains: 0,
  };

  console.log('[build-seed-sql] reading canonical CSV...');
  await readCsvIntoState(state, CSV_FILE, 'canonical-csv');
  await readSupplementalCsvs(state);
  addJsonFallbackSites(state);

  state.websiteCategoryRows = uniqueRows(state.websiteCategoryRows);
  state.websiteKeywordRows = uniqueRows(state.websiteKeywordRows);
  state.websiteTagRows = uniqueRows(state.websiteTagRows);

  const categoryRows = categories.map((category) => [
    category.id,
    category.name,
    category.slug,
    category.description || null,
    category.icon || null,
    category.parent_id || null,
    category.level || 1,
    category.sort_order || 0,
    0,
    category.created_at || CREATED_AT,
  ]);

  const files = [];

  fs.writeFileSync(path.join(OUTPUT_DIR, '00_reset.sql'), [
    '-- Reset catalog seed tables. User/session/submission/audit/click tables are intentionally preserved.',
    'SET FOREIGN_KEY_CHECKS=0;',
    'TRUNCATE TABLE `website_tags`;',
    'TRUNCATE TABLE `website_keywords`;',
    'TRUNCATE TABLE `website_categories`;',
    'TRUNCATE TABLE `websites`;',
    'TRUNCATE TABLE `tags`;',
    'TRUNCATE TABLE `keywords`;',
    'TRUNCATE TABLE `categories`;',
    'SET FOREIGN_KEY_CHECKS=1;',
    '',
  ].join('\n'), 'utf8');
  files.push({ file: '00_reset.sql', table: 'reset', rows: 0 });

  files.push(...writeChunk('categories', [
    'id', 'name', 'slug', 'description', 'icon', 'parent_id', 'level', 'sort_order', 'website_count', 'created_at',
  ], categoryRows, {
    update: [
      '`name`=VALUES(`name`)',
      '`slug`=VALUES(`slug`)',
      '`description`=VALUES(`description`)',
      '`icon`=VALUES(`icon`)',
      '`parent_id`=VALUES(`parent_id`)',
      '`level`=VALUES(`level`)',
      '`sort_order`=VALUES(`sort_order`)',
      '`created_at`=VALUES(`created_at`)',
    ],
  }));

  files.push(...writeChunk('tags', ['id', 'name', 'slug', 'color', 'created_at'], [...state.tagMap.values()], {
    update: ['`name`=VALUES(`name`)', '`slug`=VALUES(`slug`)', '`color`=VALUES(`color`)', '`created_at`=VALUES(`created_at`)'],
  }));

  files.push(...writeChunk('keywords', ['id', 'name', 'normalized', 'created_at'], [...state.keywordMap.values()], {
    update: ['`name`=VALUES(`name`)', '`normalized`=VALUES(`normalized`)', '`created_at`=VALUES(`created_at`)'],
  }));

  files.push(...writeChunk('websites', [
    'id',
    'name',
    'slug',
    'url',
    'normalized_domain',
    'short_summary',
    'full_description',
    'status',
    'region',
    'star_rating',
    'view_count',
    'monthly_visits',
    'company',
    'founder',
    'headquarters',
    'language',
    'is_free',
    'launch_year',
    'pricing_model',
    'alternatives',
    'target_audience',
    'features',
    'platforms',
    'social_links',
    'screenshot_url',
    'screenshot_at',
    'last_health_check',
    'consecutive_failures',
    'submitter_user_id',
    'approved_by_user_id',
    'approved_at',
    'created_at',
    'updated_at',
  ], state.websiteRows, {
    update: [
      '`name`=VALUES(`name`)',
      '`slug`=VALUES(`slug`)',
      '`url`=VALUES(`url`)',
      '`normalized_domain`=VALUES(`normalized_domain`)',
      '`short_summary`=VALUES(`short_summary`)',
      '`full_description`=VALUES(`full_description`)',
      '`status`=VALUES(`status`)',
      '`region`=VALUES(`region`)',
      '`star_rating`=VALUES(`star_rating`)',
      '`view_count`=VALUES(`view_count`)',
      '`monthly_visits`=VALUES(`monthly_visits`)',
      '`company`=VALUES(`company`)',
      '`founder`=VALUES(`founder`)',
      '`headquarters`=VALUES(`headquarters`)',
      '`language`=VALUES(`language`)',
      '`is_free`=VALUES(`is_free`)',
      '`launch_year`=VALUES(`launch_year`)',
      '`pricing_model`=VALUES(`pricing_model`)',
      '`alternatives`=VALUES(`alternatives`)',
      '`target_audience`=VALUES(`target_audience`)',
      '`features`=VALUES(`features`)',
      '`platforms`=VALUES(`platforms`)',
      '`social_links`=VALUES(`social_links`)',
      '`screenshot_url`=VALUES(`screenshot_url`)',
      '`updated_at`=VALUES(`updated_at`)',
    ],
  }));

  files.push(...writeChunk('website_categories', ['website_id', 'category_id'], state.websiteCategoryRows, { ignore: true }));
  files.push(...writeChunk('website_keywords', ['website_id', 'keyword_id'], state.websiteKeywordRows, { ignore: true }));
  files.push(...writeChunk('website_tags', ['website_id', 'tag_id'], state.websiteTagRows, { ignore: true }));

  fs.writeFileSync(path.join(OUTPUT_DIR, '99_update_counts.sql'), [
    'UPDATE `categories` c',
    'SET `website_count` = (',
    '  SELECT COUNT(*)',
    '  FROM `website_categories` wc',
    '  WHERE wc.`category_id` = c.`id`',
    ');',
    '',
  ].join('\n'), 'utf8');
  files.push({ file: '99_update_counts.sql', table: 'category_counts', rows: categories.length });

  const manifest = {
    generated_at: new Date().toISOString(),
    source_csv: path.relative(ROOT, CSV_FILE).replace(/\\/g, '/'),
    chunk_size: CHUNK_SIZE,
    counts: {
      categories: categoryRows.length,
      tags: state.tagMap.size,
      keywords: state.keywordMap.size,
      websites: state.websiteRows.length,
      website_categories: state.websiteCategoryRows.length,
      website_keywords: state.websiteKeywordRows.length,
      website_tags: state.websiteTagRows.length,
      skipped: state.skipped,
      duplicate_domains: state.duplicateDomains,
    },
    source_files: {
      canonical_csv: path.relative(ROOT, CSV_FILE).replace(/\\/g, '/'),
      legacy_snapshot_csvs: LEGACY_SNAPSHOT_CSVS
        .filter((filePath) => fs.existsSync(filePath))
        .map((filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/')),
      supplemental_json: [
        path.relative(ROOT, SRC_SITE_FILE).replace(/\\/g, '/'),
        path.relative(ROOT, LOCAL_SITE_FILE).replace(/\\/g, '/'),
      ],
    },
    files,
  };

  fs.writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log('[build-seed-sql] done');
  console.log(JSON.stringify(manifest.counts, null, 2));
  console.log(`[build-seed-sql] manifest: ${path.relative(ROOT, MANIFEST_FILE)}`);
}

main().catch((error) => {
  console.error('[build-seed-sql] failed:', error);
  process.exitCode = 1;
});

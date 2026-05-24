const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CATEGORY_MAP = {
  'AI 工具': 'ai-tools', '开发者工具': 'developer-tools', '设计资源': 'design-resources',
  '效率办公': 'productivity', '云服务': 'cloud-services', '数据分析': 'data-analytics',
  '营销推广': 'marketing', '学习教育': 'learning', '开源项目': 'open-source',
  '搜索引擎': 'search-engines', '代码托管': 'code-hosting', '创业工具': 'startup-tools',
  '社交媒体': 'social-media', '影音娱乐': 'entertainment', '电商购物': 'ecommerce',
  '新闻资讯': 'news', '金融理财': 'finance', '求职招聘': 'jobs',
  '生活服务': 'lifestyle', '写作工具': 'writing-tools', '图片素材': 'images-stock',
  '视频工具': 'video-tools', '网络安全': 'security', '远程办公': 'remote-work',
  '邮件工具': 'email-tools', '域名主机': 'hosting', '低代码平台': 'low-code',
  '翻译语言': 'translation', '文件工具': 'file-tools', '健康医疗': 'health',
};

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-+|-+$/g, '');
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Load existing data
const existingPath = path.join(__dirname, '../src/data-sites.json');
const existingSites = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));

const seenDomains = new Set(existingSites.map(s => s.normalized_domain));
const seenSlugs = new Set(existingSites.map(s => s.slug));

// Load new overseas CSV
const csvPath = path.join(__dirname, '../data/websites-overseas-10000.csv');
if (!fs.existsSync(csvPath)) {
  console.error('❌ 找不到文件：data/websites-overseas-10000.csv');
  console.log('请先让 Codex 生成 CSV 并放到该路径。');
  process.exit(1);
}

const content = fs.readFileSync(csvPath, 'utf-8');
const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

console.log(`📖 读取到 ${records.length} 条新数据`);

const added = [];
let skipped = 0;
let idCounter = 0;

for (const r of records) {
  if (!r.name || !r.url || !r.short_summary || !r.category_1) { skipped++; continue; }
  if (!CATEGORY_MAP[r.category_1]) { skipped++; continue; }

  const region = (r.region || '').trim();
  if (region === '中国' || !region) { skipped++; continue; }

  const domain = extractDomain(r.url);
  if (!domain || seenDomains.has(domain)) { skipped++; continue; }

  let slug = generateSlug(r.name);
  while (seenSlugs.has(slug)) slug = slug + '-' + (++idCounter);
  if (!slug) { skipped++; continue; }

  seenDomains.add(domain);
  seenSlugs.add(slug);

  const cats = [r.category_1, r.category_2, r.category_3]
    .filter(c => c && CATEGORY_MAP[c])
    .map(c => CATEGORY_MAP[c]);

  added.push({
    id: 'site_' + slug,
    name: r.name,
    slug,
    url: r.url,
    normalized_domain: domain,
    short_summary: r.short_summary,
    view_count: Math.floor(Math.random() * 200) + 10,
    created_at: new Date().toISOString(),
    region: 'overseas',
    categories: cats,
  });
}

console.log(`✅ 新增 ${added.length} 条海外网站`);
console.log(`⚠️  跳过 ${skipped} 条（重复/无效/中国）`);

const merged = [...existingSites, ...added];
fs.writeFileSync(existingPath, JSON.stringify(merged), 'utf-8');

const stats = { china: 0, overseas: 0 };
for (const s of merged) stats[s.region] = (stats[s.region] || 0) + 1;
console.log(`\n📊 当前总数：${merged.length}`);
console.log(`  China: ${stats.china}`);
console.log(`  Overseas: ${stats.overseas}`);

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
    if (targetId) lookup.set(normalizeLookupKey(from), targetId);
  }
  return lookup;
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

  const categories = readJson(CATEGORY_FILE);
  if (!categories.length) {
    throw new Error('Missing categories. Expected src/data-categories.json.');
  }

  const categoryLookup = buildCategoryLookup(categories);
  const state = {
    categoryLookup,
    categoryById: new Map(categories.map((category) => [category.id, category])),
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

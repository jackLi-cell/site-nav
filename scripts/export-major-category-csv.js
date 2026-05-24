/**
 * 按主大类导出 CSV 文件。
 *
 * 业务意图：
 * 1. 一个网站只属于一个主大类，导出时只看 category_1。
 * 2. 每个主大类生成一个 CSV 文件，小类字段保留但不参与拆分。
 * 3. 输出目录每次重建，避免旧分类文件残留造成误读。
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

const OUTPUT_DIR = path.join(__dirname, '../data/major-category-csv');
const DEFAULT_CATEGORY = '未分类';

/**
 * 生成适合 Windows 文件名的分类 CSV 文件名。
 * @param {number} index 文件序号。
 * @param {string} category 主大类名称。
 * @returns {string} 安全文件名。
 */
function buildFileName(index, category) {
  const safeCategory = String(category || DEFAULT_CATEGORY)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || DEFAULT_CATEGORY;
  return `${String(index + 1).padStart(3, '0')}_${safeCategory}.csv`;
}

/**
 * 确保只清理 data/major-category-csv 这个固定输出目录。
 * @param {string} outputDir 输出目录。
 */
function resetOutputDir(outputDir) {
  const dataDir = path.resolve(__dirname, '../data');
  const resolvedOutput = path.resolve(outputDir);
  const relative = path.relative(dataDir, resolvedOutput);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`输出目录不在 data 目录内，拒绝清理：${resolvedOutput}`);
  }
  fs.rmSync(resolvedOutput, { recursive: true, force: true });
  fs.mkdirSync(resolvedOutput, { recursive: true });
}

/**
 * 按 category_1 对所有网站分组。
 * @param {object[]} rows CSV 记录。
 * @returns {Map<string, object[]>} 主大类到记录列表的映射。
 */
function groupByMajorCategory(rows) {
  const groups = new Map();
  for (const row of rows) {
    const category = String(row.category_1 || '').trim() || DEFAULT_CATEGORY;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(row);
  }
  return groups;
}

/**
 * 校验拆分结果：总行数一致，并且域名、名称、slug 没有在导出集合内重复出现。
 * @param {object[]} rows 原始记录。
 * @param {Map<string, object[]>} groups 分组结果。
 */
function validateExport(rows, groups) {
  const exported = [...groups.values()].reduce((sum, groupRows) => sum + groupRows.length, 0);
  if (exported !== rows.length) {
    throw new Error(`导出行数不一致：source=${rows.length}, exported=${exported}`);
  }

  const domains = new Set();
  const names = new Set();
  const slugs = new Set();
  for (const groupRows of groups.values()) {
    for (const row of groupRows) {
      const domain = normalizeDomain(new URL(row.url).hostname);
      const name = String(row.name || '').toLowerCase();
      const slug = generateSlug(row.name || '');
      if (domains.has(domain)) throw new Error(`导出域名重复：${domain}`);
      if (names.has(name)) throw new Error(`导出名称重复：${row.name}`);
      if (slugs.has(slug)) throw new Error(`导出 slug 重复：${slug}`);
      domains.add(domain);
      names.add(name);
      slugs.add(slug);
    }
  }
}

/**
 * 主流程：读取总 CSV，按主大类拆分并写入文件。
 */
function main() {
  const rows = readExistingCsv(CSV_PATH);
  const groups = groupByMajorCategory(rows);
  validateExport(rows, groups);
  resetOutputDir(OUTPUT_DIR);

  const sortedGroups = [...groups.entries()].sort((left, right) => {
    if (right[1].length !== left[1].length) return right[1].length - left[1].length;
    return left[0].localeCompare(right[0], 'zh-CN');
  });

  for (const [index, [category, groupRows]] of sortedGroups.entries()) {
    const filePath = path.join(OUTPUT_DIR, buildFileName(index, category));
    fs.writeFileSync(filePath, toCsv(groupRows), 'utf8');
    console.log(`${category}: ${groupRows.length} -> ${filePath}`);
  }

  console.log(`导出完成：${rows.length} 行，${sortedGroups.length} 个大类，目录 ${OUTPUT_DIR}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  OUTPUT_DIR,
  DEFAULT_CATEGORY,
  buildFileName,
  groupByMajorCategory,
  validateExport,
};

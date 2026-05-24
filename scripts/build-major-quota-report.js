/**
 * 生成主大类配额缺口报告。
 *
 * 业务意图：
 * 1. 一个网站只归属 category_1 这个主大类。
 * 2. 每个主大类目标为国内 3000、海外 7000，总数至少 10000。
 * 3. 只输出 JSON 报告，不修改 CSV，不生成 SQL。
 */

const fs = require('fs');
const path = require('path');
const {
  CSV_PATH,
  readExistingCsv,
} = require('./expand-websites-import');

const OUTPUT_PATH = path.join(__dirname, '../data/major-category-quota-report.json');
const TARGET_CHINA = Number.parseInt(process.env.TARGET_CHINA || '3000', 10);
const TARGET_OVERSEAS = Number.parseInt(process.env.TARGET_OVERSEAS || '7000', 10);
const CHINA_REGION = '中国';

/**
 * 按 category_1 统计国内和海外数量。
 * @param {object[]} rows CSV 记录。
 * @returns {Map<string, {china: number, overseas: number, total: number}>} 分类统计。
 */
function countMajorCategories(rows) {
  const stats = new Map();
  for (const row of rows) {
    const major = String(row.category_1 || '').trim() || '未分类';
    if (!stats.has(major)) stats.set(major, { china: 0, overseas: 0, total: 0 });
    const item = stats.get(major);
    item.total += 1;
    if (row.region === CHINA_REGION) item.china += 1;
    else item.overseas += 1;
  }
  return stats;
}

/**
 * 生成每个大类的配额缺口。
 * @param {Map<string, {china: number, overseas: number, total: number}>} stats 分类统计。
 * @returns {object[]} 缺口列表。
 */
function buildDeficits(stats) {
  return [...stats.entries()]
    .map(([major, count]) => ({
      major,
      ...count,
      target_china: TARGET_CHINA,
      target_overseas: TARGET_OVERSEAS,
      target_total: TARGET_CHINA + TARGET_OVERSEAS,
      need_china: Math.max(0, TARGET_CHINA - count.china),
      need_overseas: Math.max(0, TARGET_OVERSEAS - count.overseas),
      need_total: Math.max(0, TARGET_CHINA - count.china) + Math.max(0, TARGET_OVERSEAS - count.overseas),
      satisfied: count.china >= TARGET_CHINA && count.overseas >= TARGET_OVERSEAS,
    }))
    .sort((left, right) => {
      if (right.need_total !== left.need_total) return right.need_total - left.need_total;
      return left.major.localeCompare(right.major, 'zh-CN');
    });
}

/**
 * 主流程：读取 CSV 并写出配额报告。
 */
function main() {
  const rows = readExistingCsv(CSV_PATH);
  const stats = countMajorCategories(rows);
  const deficits = buildDeficits(stats);
  const report = {
    updated_at: new Date().toISOString(),
    source_csv: CSV_PATH,
    total_rows: rows.length,
    major_count: deficits.length,
    target: {
      china: TARGET_CHINA,
      overseas: TARGET_OVERSEAS,
      total: TARGET_CHINA + TARGET_OVERSEAS,
      ratio: '3:7',
    },
    satisfied_major_count: deficits.filter((item) => item.satisfied).length,
    unsatisfied_major_count: deficits.filter((item) => !item.satisfied).length,
    total_need_china: deficits.reduce((sum, item) => sum + item.need_china, 0),
    total_need_overseas: deficits.reduce((sum, item) => sum + item.need_overseas, 0),
    total_need: deficits.reduce((sum, item) => sum + item.need_total, 0),
    deficits,
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`配额报告已生成：${OUTPUT_PATH}`);
  console.log(`当前总量 ${rows.length}，大类 ${deficits.length}，总缺口 ${report.total_need}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  OUTPUT_PATH,
  TARGET_CHINA,
  TARGET_OVERSEAS,
  countMajorCategories,
  buildDeficits,
};

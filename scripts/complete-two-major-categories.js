/**
 * 用现有合规网站补齐两个主大类配额。
 *
 * 业务意图：
 * 1. 不复制网站、不制造假域名，一个网站仍只属于一个 category_1 主大类。
 * 2. 只选择文本、关键词或其它分类字段中已有相关信号的网站做主大类重分配。
 * 3. 本脚本专门补齐「效率办公」和「生活服务」两个大类到国内 3000、海外 7000。
 */

const fs = require('fs');
const {
  CSV_PATH,
  readExistingCsv,
  toCsv,
} = require('./expand-websites-import');

const CHINA_REGION = '中国';
const TARGETS = {
  '效率办公': { china: 3000, overseas: 7000 },
  '生活服务': { china: 3000, overseas: 7000 },
};

const EFFICIENCY_SIGNALS = [
  '效率办公',
  '办公',
  '协作',
  '项目',
  '任务',
  '文档',
  '文件',
  '会议',
  '远程',
  '流程',
  'productivity',
  'office',
  'collaboration',
  'team',
  'task',
  'project',
  'document',
  'docs',
  'workflow',
  'meeting',
  'remote',
  'file',
  'pdf',
  'note',
];

const LIFE_SIGNALS = [
  '生活服务',
  '消费生活',
  '本地服务',
  '旅游出行',
  '美食餐饮',
  '健康医疗',
  '房产家居',
  '汽车服务',
  '体育健身',
  '电商购物',
  '生活',
  '本地',
  '服务',
  '健康',
  '旅游',
  '美食',
  '餐饮',
  '购物',
  'local',
  'life',
  'health',
  'travel',
  'food',
  'shop',
  'shopping',
  'restaurant',
  'home',
  'car',
  'auto',
  'hotel',
];

/**
 * 统计目标主大类的国内和海外数量。
 * @param {object[]} rows CSV 记录。
 * @returns {Map<string, {china: number, overseas: number, total: number}>} 主大类统计。
 */
function countTargets(rows) {
  const stats = new Map(Object.keys(TARGETS).map((major) => [major, { china: 0, overseas: 0, total: 0 }]));
  for (const row of rows) {
    if (!stats.has(row.category_1)) continue;
    const item = stats.get(row.category_1);
    item.total += 1;
    if (row.region === CHINA_REGION) item.china += 1;
    else item.overseas += 1;
  }
  return stats;
}

/**
 * 拼接一行记录的可检索文本，用于判断是否适合重分配到目标大类。
 * @param {object} row CSV 记录。
 * @returns {string} 小写后的检索文本。
 */
function buildSearchText(row) {
  return Object.values(row).join(' ').toLowerCase();
}

/**
 * 计算一行记录与指定信号词的匹配分。
 * @param {object} row CSV 记录。
 * @param {string[]} signals 信号词列表。
 * @returns {number} 匹配分。
 */
function scoreRow(row, signals) {
  const text = buildSearchText(row);
  let score = 0;
  for (const signal of signals) {
    const normalized = signal.toLowerCase();
    if (text.includes(normalized)) score += normalized.length >= 4 ? 2 : 1;
  }
  return score;
}

/**
 * 选出可重分配候选记录，优先选择更相关、且来自当前非目标大类的记录。
 * @param {object[]} rows CSV 记录。
 * @param {object} options 筛选条件。
 * @returns {object[]} 候选记录。
 */
function selectCandidates(rows, options) {
  return rows
    .map((row, index) => ({ row, index, score: scoreRow(row, options.signals) }))
    .filter((item) => {
      if (item.score <= 0) return false;
      if (item.row.category_1 === options.targetMajor) return false;
      if (options.region === 'china' && item.row.region !== CHINA_REGION) return false;
      if (options.region === 'overseas' && item.row.region === CHINA_REGION) return false;
      if (options.excludeMajors && options.excludeMajors.has(item.row.category_1)) return false;
      return true;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.row.category_1 !== right.row.category_1) {
        return left.row.category_1.localeCompare(right.row.category_1, 'zh-CN');
      }
      return left.index - right.index;
    })
    .map((item) => item.row);
}

/**
 * 把记录重分配到目标主大类，并保留原主类到 category_2 作为来源线索。
 * @param {object} row CSV 记录。
 * @param {string} targetMajor 目标主大类。
 */
function reassignRow(row, targetMajor) {
  const previousMajor = row.category_1;
  row.category_1 = targetMajor;
  if (previousMajor && previousMajor !== targetMajor) row.category_2 = previousMajor;
  row.category_4 = targetMajor;
  row.category_6 = '配额重分配';
  row.category_7 = row.region === CHINA_REGION ? '国内网站' : '海外网站';
  row.category_8 = '单一主类';
  row.tags = mergeList(row.tags, ['配额重分配', targetMajor], 10);
  row.keywords = mergeList(row.keywords, [targetMajor], 15);
}

/**
 * 合并逗号分隔字段，保留顺序并去重。
 * @param {string} value 原字段。
 * @param {string[]} additions 新增条目。
 * @param {number} limit 最大条目数。
 * @returns {string} 合并后的字段。
 */
function mergeList(value, additions, limit) {
  const seen = new Set();
  const result = [];
  for (const item of [...String(value || '').split(','), ...additions]) {
    const text = item.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result.join(',');
}

/**
 * 按目标数量重分配指定候选记录。
 * @param {object[]} candidates 候选记录。
 * @param {number} count 需要重分配数量。
 * @param {string} targetMajor 目标主大类。
 * @returns {number} 实际重分配数量。
 */
function reassignCandidates(candidates, count, targetMajor) {
  const selected = candidates.slice(0, count);
  for (const row of selected) {
    reassignRow(row, targetMajor);
  }
  return selected.length;
}

/**
 * 校验两个目标大类是否达成国内 3000、海外 7000。
 * @param {object[]} rows CSV 记录。
 */
function assertTargets(rows) {
  const stats = countTargets(rows);
  const failures = [];
  for (const [major, target] of Object.entries(TARGETS)) {
    const count = stats.get(major);
    if (count.china < target.china || count.overseas < target.overseas) {
      failures.push(`${major}: china=${count.china}, overseas=${count.overseas}`);
    }
  }
  if (failures.length) throw new Error(`目标大类未补齐：${failures.join('; ')}`);
}

/**
 * 主流程：重分配现有相关网站，补齐效率办公和生活服务两个大类。
 */
function main() {
  const rows = readExistingCsv(CSV_PATH);
  const before = countTargets(rows);

  const efficiencyNeedChina = Math.max(0, TARGETS['效率办公'].china - before.get('效率办公').china);
  const lifeNeedOverseas = Math.max(0, TARGETS['生活服务'].overseas - before.get('生活服务').overseas);

  const efficiencyDomestic = selectCandidates(rows, {
    targetMajor: '效率办公',
    region: 'china',
    signals: EFFICIENCY_SIGNALS,
  });
  const movedEfficiencyChina = reassignCandidates(efficiencyDomestic, efficiencyNeedChina, '效率办公');

  const lifeOverseasNonEfficiency = selectCandidates(rows, {
    targetMajor: '生活服务',
    region: 'overseas',
    signals: LIFE_SIGNALS,
    excludeMajors: new Set(['效率办公']),
  });
  let movedLifeOverseas = reassignCandidates(lifeOverseasNonEfficiency, lifeNeedOverseas, '生活服务');

  if (movedLifeOverseas < lifeNeedOverseas) {
    const remaining = lifeNeedOverseas - movedLifeOverseas;
    const lifeOverseasFromEfficiency = selectCandidates(rows, {
      targetMajor: '生活服务',
      region: 'overseas',
      signals: LIFE_SIGNALS,
    }).filter((row) => row.category_1 === '效率办公');
    movedLifeOverseas += reassignCandidates(lifeOverseasFromEfficiency, remaining, '生活服务');
  }

  assertTargets(rows);
  fs.writeFileSync(CSV_PATH, toCsv(rows), 'utf8');

  const after = countTargets(rows);
  console.log(JSON.stringify({
    before: Object.fromEntries(before.entries()),
    moved: {
      efficiency_china: movedEfficiencyChina,
      life_overseas: movedLifeOverseas,
    },
    after: Object.fromEntries(after.entries()),
  }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  countTargets,
  selectCandidates,
  scoreRow,
};

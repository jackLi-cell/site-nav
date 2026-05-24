/**
 * 按导入文档扩展网站分类体系。
 *
 * 业务意图：
 * 1. 保留 category_1~category_3 的原始核心分类。
 * 2. 使用 category_4~category_8 增加覆盖面更广的大分类和小分类。
 * 3. 按国内/海外分别做配额平衡，确保每个新增分类都满足最低覆盖量。
 */

const fs = require('fs');
const {
  CSV_PATH,
  readExistingCsv,
  toCsv,
} = require('./expand-websites-import');

const CHINA_REGION = '中国';
const CATEGORY_FIELDS = ['category_4', 'category_5', 'category_6', 'category_7', 'category_8'];
const MIN_REGION_COUNT = 5000;
const MAX_KEYWORDS = 15;
const MAX_TAGS = 10;

const TAXONOMY_SLOTS = [
  {
    field: 'category_4',
    categories: [
      {
        name: '企业服务',
        signals: ['企业', 'SaaS', 'B2B', 'CRM', 'ERP', '人力资源', '财务', '项目', '协作', '客服', '办公', '团队', 'workflow', 'business'],
      },
      {
        name: '消费生活',
        signals: ['生活', '购物', '电商', '旅游', '美食', '餐饮', '医疗', '健康', '音乐', '视频', '社交', '本地', '汽车', '房产', 'travel', 'shopping'],
      },
      {
        name: '内容媒体',
        signals: ['新闻', '资讯', '媒体', '视频', '音频', '播客', '直播', '短视频', '写作', '内容', '创作', '图片', 'article', 'media'],
      },
    ],
  },
  {
    field: 'category_5',
    categories: [
      {
        name: '开发技术',
        signals: ['开发', '代码', 'API', '云服务', '主机', '数据库', '监控', '测试', '安全', 'Git', '开源', 'DevOps', 'Python', 'JavaScript'],
      },
      {
        name: '数据智能',
        signals: ['数据', '分析', 'BI', 'AI', '人工智能', '机器学习', '模型', '推荐', '搜索', '语音', '视觉', '报表', 'analytics'],
      },
      {
        name: '创意设计',
        signals: ['设计', '素材', '图片', '视频工具', 'UI', '字体', '图标', '创意', '品牌', '模板', '摄影', 'design'],
      },
    ],
  },
  {
    field: 'category_6',
    categories: [
      {
        name: '项目协作',
        signals: ['协作', '项目', '办公', '文档', '任务', '远程', '团队', '会议', '笔记', '流程', 'collaboration'],
      },
      {
        name: '在线工具',
        signals: ['工具', 'Web', '在线', 'API', '文件', 'PDF', '浏览器', '插件', '平台', '转换', '生成器', 'tool'],
      },
      {
        name: '内容创作',
        signals: ['内容', '写作', '视频', '音频', '图片', '播客', '媒体', '创作者', '文章', '发布', '编辑', 'creator'],
      },
    ],
  },
  {
    field: 'category_7',
    categories: [
      {
        name: '数据洞察',
        signals: ['数据', '分析', '报表', '指标', '趋势', 'SEO', '统计', '排名', '可视化', '洞察', 'analytics'],
      },
      {
        name: '设计素材',
        signals: ['设计', '素材', '图片', '图标', '字体', 'UI', '模板', '视觉', '配色', '插画', 'design'],
      },
      {
        name: '技术服务',
        signals: ['开发', '云', '安全', 'API', '数据库', '测试', '监控', '技术', '运维', '服务器', 'DevOps'],
      },
    ],
  },
  {
    field: 'category_8',
    categories: [
      {
        name: '本地服务',
        signals: ['本地', '生活', '出行', '外卖', '房产', '医疗', '物流', '汽车', '餐饮', '城市', '服务'],
      },
      {
        name: '教育培训',
        signals: ['学习', '教育', '课程', '培训', '学术', '考试', '文档', '知识', '教程', '学生', 'teacher'],
      },
      {
        name: '电商服务',
        signals: ['电商', '购物', '店铺', '独立站', '营销', '支付', '跨境', '广告', '订单', '零售', 'commerce'],
      },
    ],
  },
];

const NEW_CATEGORIES = TAXONOMY_SLOTS.flatMap((slot) => slot.categories.map((category) => category.name));

/**
 * 将逗号分隔字段拆为去重数组。
 * @param {string} value 原始逗号分隔文本。
 * @returns {string[]} 去除空值后的有序数组。
 */
function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 合并逗号分隔字段，保留原顺序并追加新增分类关键词。
 * @param {string} value 原字段内容。
 * @param {string[]} additions 需要追加的条目。
 * @param {number} limit 最大保留数量。
 * @returns {string} 合并后的逗号分隔文本。
 */
function mergeList(value, additions, limit) {
  const seen = new Set();
  const merged = [];
  for (const item of [...splitList(value), ...additions]) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
    if (merged.length >= limit) break;
  }
  return merged.join(',');
}

/**
 * 汇总一行网站的可检索文本，用于判断更适合的扩展分类。
 * @param {object} row CSV 单行记录。
 * @returns {string} 小写后的检索文本。
 */
function buildSearchText(row) {
  return [
    row.name,
    row.short_summary,
    row.full_description,
    row.keywords,
    row.tags,
    row.target_audience,
    row.features,
    ...Array.from({ length: 8 }, (_, index) => row[`category_${index + 1}`]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * 计算某个分类与当前网站文本的匹配分。
 * @param {string} searchText 当前网站聚合文本。
 * @param {object} category 分类配置。
 * @returns {number} 命中信号越多分数越高。
 */
function scoreCategory(searchText, category) {
  let score = 0;
  for (const signal of category.signals) {
    if (searchText.includes(signal.toLowerCase())) {
      score += signal.length > 2 ? 2 : 1;
    }
  }
  return score;
}

/**
 * 按地区和槽位计算每个新增分类的目标配额。
 * @param {number} rowCount 当前地区的行数。
 * @param {number} categoryCount 当前槽位的分类数。
 * @returns {number[]} 每个分类应分配的记录数。
 */
function makeQuotas(rowCount, categoryCount) {
  const base = Math.floor(rowCount / categoryCount);
  const quotas = Array.from({ length: categoryCount }, (_, index) => base + (index < rowCount % categoryCount ? 1 : 0));
  return quotas;
}

/**
 * 在一个分类槽内给指定地区的记录做平衡分配。
 * @param {object[]} rows 当前地区记录。
 * @param {object} slot 分类槽配置。
 * @returns {Map<object, string>} 记录到分类名的映射。
 */
function assignSlot(rows, slot) {
  const quotas = makeQuotas(rows.length, slot.categories.length);
  const counts = Array(slot.categories.length).fill(0);
  const assignments = new Map();

  const rankedRows = rows.map((row, rowIndex) => {
    const searchText = buildSearchText(row);
    const scores = slot.categories.map((category, categoryIndex) => ({
      categoryIndex,
      score: scoreCategory(searchText, category),
    }));
    const bestScore = Math.max(...scores.map((item) => item.score));
    return { row, rowIndex, scores, bestScore };
  });

  rankedRows.sort((left, right) => {
    if (right.bestScore !== left.bestScore) return right.bestScore - left.bestScore;
    return left.rowIndex - right.rowIndex;
  });

  for (const item of rankedRows) {
    const preferred = item.scores
      .slice()
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.categoryIndex - right.categoryIndex;
      });

    const selected = preferred.find((candidate) => counts[candidate.categoryIndex] < quotas[candidate.categoryIndex])
      || preferred[0];
    counts[selected.categoryIndex] += 1;
    assignments.set(item.row, slot.categories[selected.categoryIndex].name);
  }

  return assignments;
}

/**
 * 扩展所有记录的分类字段，并同步把新增分类补入关键词和标签。
 * @param {object[]} records CSV 记录。
 * @returns {object[]} 原地更新后的记录数组。
 */
function expandRecords(records) {
  const chinaRows = records.filter((row) => row.region === CHINA_REGION);
  const overseasRows = records.filter((row) => row.region !== CHINA_REGION);
  const groups = [chinaRows, overseasRows];

  for (const slot of TAXONOMY_SLOTS) {
    for (const rows of groups) {
      const assignments = assignSlot(rows, slot);
      for (const row of rows) {
        row[slot.field] = assignments.get(row);
      }
    }
  }

  for (const row of records) {
    const expandedCategories = CATEGORY_FIELDS.map((field) => row[field]).filter(Boolean);
    row.keywords = mergeList(row.keywords, expandedCategories, MAX_KEYWORDS);
    row.tags = mergeList(row.tags, expandedCategories, MAX_TAGS);
  }

  return records;
}

/**
 * 统计新增分类在国内和海外的覆盖量。
 * @param {object[]} records CSV 记录。
 * @returns {Map<string, {china: number, overseas: number}>} 分类覆盖统计。
 */
function countNewCategories(records) {
  const stats = new Map(NEW_CATEGORIES.map((category) => [category, { china: 0, overseas: 0 }]));
  for (const row of records) {
    const regionKey = row.region === CHINA_REGION ? 'china' : 'overseas';
    for (const field of CATEGORY_FIELDS) {
      const category = row[field];
      if (stats.has(category)) {
        stats.get(category)[regionKey] += 1;
      }
    }
  }
  return stats;
}

/**
 * 校验新增分类是否满足每个地区的最低覆盖要求。
 * @param {Map<string, {china: number, overseas: number}>} stats 分类覆盖统计。
 */
function assertCoverage(stats) {
  const failures = [];
  for (const [category, count] of stats.entries()) {
    if (count.china < MIN_REGION_COUNT || count.overseas < MIN_REGION_COUNT) {
      failures.push(`${category}: china=${count.china}, overseas=${count.overseas}`);
    }
  }
  if (failures.length) {
    throw new Error(`新增分类覆盖不足：${failures.join('; ')}`);
  }
}

/**
 * 主流程：读取 CSV、扩展分类、校验覆盖量并写回 CSV。
 */
function main() {
  const records = readExistingCsv(CSV_PATH);
  const expanded = expandRecords(records);
  const stats = countNewCategories(expanded);
  assertCoverage(stats);
  fs.writeFileSync(CSV_PATH, toCsv(expanded), 'utf8');

  console.log(`已更新 ${expanded.length} 行 CSV 分类。`);
  for (const [category, count] of stats.entries()) {
    console.log(`${category}: 国内 ${count.china}, 海外 ${count.overseas}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  TAXONOMY_SLOTS,
  NEW_CATEGORIES,
  splitList,
  mergeList,
  buildSearchText,
  scoreCategory,
  makeQuotas,
  assignSlot,
  expandRecords,
  countNewCategories,
  assertCoverage,
};

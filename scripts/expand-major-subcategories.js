/**
 * 基于当前大分类继续扩展小类别。
 *
 * 业务意图：
 * 1. category_4/category_5 作为当前大分类来源，不改动已有大分类。
 * 2. category_6 承接 category_4 的新增小类别，category_7 承接 category_5 的新增小类别。
 * 3. 每个新增小类别精确覆盖 1000 条国内记录和 1000 条海外记录，未参与新增覆盖的记录保留原小类别。
 */

const fs = require('fs');
const {
  CSV_PATH,
  readExistingCsv,
  toCsv,
} = require('./expand-websites-import');

const CHINA_REGION = '中国';
const TARGET_PER_REGION = 1000;
const MAX_KEYWORDS = 15;
const MAX_TAGS = 10;

const SUBCATEGORY_PLANS = [
  {
    majorField: 'category_4',
    targetField: 'category_6',
    majorCategory: '企业服务',
    subcategories: [
      { name: '供应链管理', signals: ['供应链', '采购', '库存', '物流', '订单', '仓储', 'ERP', '企业'] },
      { name: '客户成功', signals: ['客户', '客服', 'CRM', '销售', '服务', '工单', '用户', '增长'] },
      { name: '人力资源软件', signals: ['人力', '招聘', '员工', '薪酬', '绩效', 'HR', '组织', '人才'] },
      { name: '财务报销', signals: ['财务', '发票', '报销', '会计', '预算', '收支', '税务', '支付'] },
      { name: '企业知识库', signals: ['知识库', '文档', '协作', '团队', '办公', '流程', 'Wiki', '资料'] },
    ],
  },
  {
    majorField: 'category_4',
    targetField: 'category_6',
    majorCategory: '消费生活',
    subcategories: [
      { name: '旅游出行', signals: ['旅游', '出行', '酒店', '机票', '地图', '交通', '路线', 'travel'] },
      { name: '美食餐饮', signals: ['美食', '餐饮', '外卖', '菜谱', '餐厅', '咖啡', '食品', '点评'] },
      { name: '健康管理', signals: ['健康', '医疗', '运动', '健身', '睡眠', '营养', '医生', '管理'] },
      { name: '房产家居', signals: ['房产', '家居', '装修', '租房', '买房', '设计', '物业', '社区'] },
      { name: '汽车服务', signals: ['汽车', '二手车', '车主', '充电', '维修', '导航', '出行', '驾驶'] },
    ],
  },
  {
    majorField: 'category_4',
    targetField: 'category_6',
    majorCategory: '内容媒体',
    subcategories: [
      { name: '播客音频', signals: ['播客', '音频', '音乐', '声音', '录音', '电台', 'Podcast', '听书'] },
      { name: '短视频工具', signals: ['短视频', '视频', '剪辑', '直播', '字幕', '素材', '创作者', '发布'] },
      { name: '新闻资讯', signals: ['新闻', '资讯', '媒体', '热点', '文章', '阅读', '订阅', '内容'] },
      { name: '社群运营', signals: ['社群', '社区', '粉丝', '会员', '互动', '论坛', '用户', '运营'] },
      { name: '数字出版', signals: ['出版', '电子书', '写作', '博客', 'CMS', '文档', '知识', '内容'] },
    ],
  },
  {
    majorField: 'category_5',
    targetField: 'category_7',
    majorCategory: '开发技术',
    subcategories: [
      { name: 'API 开发', signals: ['API', '接口', '开发', 'SDK', 'Postman', '文档', '集成', '调用'] },
      { name: '测试自动化', signals: ['测试', '自动化', 'QA', '监控', '质量', 'CI', '脚本', '检查'] },
      { name: '数据库管理', signals: ['数据库', 'SQL', 'PostgreSQL', 'MySQL', '数据', '存储', '查询', '备份'] },
      { name: '云原生运维', signals: ['云', '容器', 'Kubernetes', '运维', '部署', 'DevOps', '服务器', '监控'] },
      { name: '低代码开发', signals: ['低代码', '无代码', '表单', '流程', '自动化', '应用', '构建', '平台'] },
    ],
  },
  {
    majorField: 'category_5',
    targetField: 'category_7',
    majorCategory: '数据智能',
    subcategories: [
      { name: '商业智能', signals: ['BI', '商业智能', '报表', '指标', '经营', '分析', '洞察', '看板'] },
      { name: '数据可视化', signals: ['可视化', '图表', '地图', '仪表盘', '数据', '展示', '趋势', '报表'] },
      { name: '数据标注', signals: ['标注', '数据集', '训练', '图像', '文本', '语音', '模型', '机器学习'] },
      { name: '模型训练', signals: ['模型', '训练', 'AI', '机器学习', '深度学习', '算法', '推理', '平台'] },
      { name: '推荐搜索', signals: ['推荐', '搜索', '排序', '检索', '索引', '关键词', '发现', '匹配'] },
    ],
  },
  {
    majorField: 'category_5',
    targetField: 'category_7',
    majorCategory: '创意设计',
    subcategories: [
      { name: 'UI 组件库', signals: ['UI', '组件', '前端', '设计系统', '界面', 'React', 'Vue', '样式'] },
      { name: '图片编辑', signals: ['图片', '照片', '编辑', '滤镜', '修图', '素材', '图像', '设计'] },
      { name: '视频剪辑', signals: ['视频', '剪辑', '字幕', '转码', '录屏', '动画', '素材', '创作'] },
      { name: '字体图标', signals: ['字体', '图标', 'Icon', 'SVG', '视觉', '素材', '排版', '标识'] },
      { name: '设计协作', signals: ['设计', '协作', '原型', '白板', '评审', '团队', 'Figma', '流程'] },
    ],
  },
];

const NEW_SUBCATEGORIES = SUBCATEGORY_PLANS.flatMap((plan) => plan.subcategories.map((item) => item.name));

/**
 * 将逗号分隔字段拆成去重前的数组。
 * @param {string} value 原始字段值。
 * @returns {string[]} 去除空白后的条目列表。
 */
function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * 合并列表并确保新增小类别不会因为字段数量上限被截掉。
 * @param {string} value 原字段值。
 * @param {string[]} additions 需要确保存在的新增条目。
 * @param {number} limit 最大条目数。
 * @returns {string} 合并后的逗号分隔字段。
 */
function mergeListEnsuringAdditions(value, additions, limit) {
  const additionKeys = new Set(additions.map((item) => item.toLowerCase()));
  const base = [];
  const seen = new Set();

  for (const item of splitList(value)) {
    const key = item.toLowerCase();
    if (additionKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    base.push(item);
  }

  const capacity = Math.max(0, limit - additions.length);
  return [...base.slice(0, capacity), ...additions].join(',');
}

/**
 * 汇总记录文本，用于把更相关的网站优先分配到对应小类别。
 * @param {object} row CSV 单行记录。
 * @returns {string} 小写后的检索文本。
 */
function buildSearchText(row) {
  return [
    row.name,
    row.url,
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
 * 计算候选小类别和网站文本的匹配度。
 * @param {string} searchText 当前网站聚合文本。
 * @param {object} subcategory 小类别配置。
 * @returns {number} 命中信号越多分数越高。
 */
function scoreSubcategory(searchText, subcategory) {
  let score = 0;
  for (const signal of subcategory.signals) {
    if (searchText.includes(signal.toLowerCase())) {
      score += signal.length > 2 ? 2 : 1;
    }
  }
  return score;
}

/**
 * 在指定地区和大分类下，给每个新增小类别分配固定数量记录。
 * @param {object[]} rows 候选记录。
 * @param {object} plan 小类别扩展计划。
 * @param {number} targetCount 每个小类别目标记录数。
 * @returns {Map<object, string>} 记录到新增小类别的映射。
 */
function assignSubcategories(rows, plan, targetCount) {
  const quotas = new Map(plan.subcategories.map((item) => [item.name, targetCount]));
  const assignments = new Map();
  const ranked = rows.map((row, rowIndex) => {
    const searchText = buildSearchText(row);
    const scores = plan.subcategories.map((subcategory) => ({
      name: subcategory.name,
      score: scoreSubcategory(searchText, subcategory),
    }));
    const bestScore = Math.max(...scores.map((item) => item.score));
    return { row, rowIndex, scores, bestScore };
  });

  ranked.sort((left, right) => {
    if (right.bestScore !== left.bestScore) return right.bestScore - left.bestScore;
    return left.rowIndex - right.rowIndex;
  });

  for (const item of ranked) {
    const preferred = item.scores
      .slice()
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.name.localeCompare(right.name, 'zh-CN');
      });
    const selected = preferred.find((candidate) => quotas.get(candidate.name) > 0);
    if (!selected) continue;
    quotas.set(selected.name, quotas.get(selected.name) - 1);
    assignments.set(item.row, selected.name);
  }

  const unfilled = [...quotas.entries()].filter(([, count]) => count !== 0);
  if (unfilled.length) {
    throw new Error(`${plan.majorCategory} 小类别配额不足：${JSON.stringify(unfilled)}`);
  }

  return assignments;
}

/**
 * 按当前大分类扩展小类别，并同步补充关键词和标签。
 * @param {object[]} records CSV 记录。
 * @returns {object[]} 更新后的记录。
 */
function expandMajorSubcategories(records) {
  for (const plan of SUBCATEGORY_PLANS) {
    const chinaRows = records.filter((row) => row.region === CHINA_REGION && row[plan.majorField] === plan.majorCategory);
    const overseasRows = records.filter((row) => row.region !== CHINA_REGION && row[plan.majorField] === plan.majorCategory);
    const assignments = [
      assignSubcategories(chinaRows, plan, TARGET_PER_REGION),
      assignSubcategories(overseasRows, plan, TARGET_PER_REGION),
    ];

    for (const assignment of assignments) {
      for (const [row, subcategory] of assignment.entries()) {
        row[plan.targetField] = subcategory;
        row.keywords = mergeListEnsuringAdditions(row.keywords, [subcategory], MAX_KEYWORDS);
        row.tags = mergeListEnsuringAdditions(row.tags, [subcategory], MAX_TAGS);
      }
    }
  }

  return records;
}

/**
 * 统计新增小类别在国内和海外的覆盖量。
 * @param {object[]} records CSV 记录。
 * @returns {Map<string, {china: number, overseas: number}>} 小类别覆盖统计。
 */
function countNewSubcategories(records) {
  const stats = new Map(NEW_SUBCATEGORIES.map((subcategory) => [subcategory, { china: 0, overseas: 0 }]));
  for (const row of records) {
    const regionKey = row.region === CHINA_REGION ? 'china' : 'overseas';
    for (const field of ['category_6', 'category_7']) {
      const subcategory = row[field];
      if (stats.has(subcategory)) {
        stats.get(subcategory)[regionKey] += 1;
      }
    }
  }
  return stats;
}

/**
 * 校验每个新增小类别是否精确达到目标覆盖量。
 * @param {Map<string, {china: number, overseas: number}>} stats 小类别统计。
 */
function assertSubcategoryCoverage(stats) {
  const failures = [];
  for (const [subcategory, count] of stats.entries()) {
    if (count.china !== TARGET_PER_REGION || count.overseas !== TARGET_PER_REGION) {
      failures.push(`${subcategory}: china=${count.china}, overseas=${count.overseas}`);
    }
  }
  if (failures.length) {
    throw new Error(`新增小类别覆盖数量不符合要求：${failures.join('; ')}`);
  }
}

/**
 * 主流程：读取 CSV、扩展小类别、校验覆盖量并写回。
 */
function main() {
  const records = readExistingCsv(CSV_PATH);
  const expanded = expandMajorSubcategories(records);
  const stats = countNewSubcategories(expanded);
  assertSubcategoryCoverage(stats);
  fs.writeFileSync(CSV_PATH, toCsv(expanded), 'utf8');

  console.log(`已更新 ${expanded.length} 行 CSV 的新增小类别覆盖。`);
  for (const [subcategory, count] of stats.entries()) {
    console.log(`${subcategory}: 国内 ${count.china}, 海外 ${count.overseas}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  SUBCATEGORY_PLANS,
  NEW_SUBCATEGORIES,
  splitList,
  mergeListEnsuringAdditions,
  buildSearchText,
  scoreSubcategory,
  assignSubcategories,
  expandMajorSubcategories,
  countNewSubcategories,
  assertSubcategoryCoverage,
};

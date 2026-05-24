/**
 * 替换 CSV 中已命中合规扫描的高风险网站。
 *
 * 业务意图：
 * 1. 只按明确域名删除，不做模糊批量删除。
 * 2. 用同数量的合规海外/全球站点补位，保持 CSV 总量和地区配额稳定。
 * 3. 补位后重新扩展分类，确保新增分类仍满足国内/海外最低覆盖量。
 */

const fs = require('fs');
const {
  CSV_PATH,
  readExistingCsv,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');
const { expandRecords, countNewCategories, assertCoverage } = require('./expand-category-taxonomy');

const UPDATED_AT = '2026-05-12';
const BLOCKED_DOMAINS = new Set([
  'nordvpn.com',
  'expressvpn.com',
  'openvpn.net',
  'protonvpn.com',
  'adultswim.com',
  'cyberghostvpn.com',
  'bestvpn.org',
  'adultfriendfinder.com',
  'vpnmentor.com',
]);

const REPLACEMENTS = [
  makeReplacement({
    name: 'Mozilla',
    url: 'https://www.mozilla.org',
    shortSummary: '开放互联网非营利组织，提供 Firefox、隐私工具和开发者资源',
    description: 'Mozilla 是面向全球用户和开发者的开放互联网组织，长期维护 Firefox 浏览器、隐私保护工具、Web 标准教育内容和开放技术项目。它适合开发者、普通用户、教育机构和关注网络安全的团队了解现代 Web、隐私保护和开放生态资源。',
    categories: ['开源项目', '开发者工具', '浏览器工具'],
    keywords: ['Mozilla', 'Firefox', '开放互联网', '浏览器', '隐私保护', 'Web 标准', '开源项目', '开发者工具'],
    company: 'Mozilla Foundation',
    launchYear: '1998',
    tags: ['推荐', '海外网站', '开源项目', '合规替换'],
    rating: '5',
    audience: '开发者,普通用户,教育机构,开源贡献者,安全团队',
    features: '浏览器工具,隐私保护,Web 标准资料,开发者资源,开源项目',
    platforms: 'Web,Desktop,iOS,Android',
    popularityScore: '58',
  }),
  makeReplacement({
    name: 'Kubernetes',
    url: 'https://kubernetes.io',
    shortSummary: '云原生容器编排平台，帮助团队部署和管理容器化应用',
    description: 'Kubernetes 是 CNCF 维护的开源容器编排平台，提供容器部署、服务发现、弹性伸缩、配置管理和自动恢复等能力。它适合开发者、运维团队、平台工程团队和企业技术团队构建云原生基础设施。',
    categories: ['开发者工具', '云服务', '容器编排'],
    keywords: ['Kubernetes', '容器编排', '云原生', 'DevOps', '部署', '集群管理', '开源项目', '开发者工具'],
    company: 'Cloud Native Computing Foundation',
    launchYear: '2014',
    tags: ['推荐', '海外网站', '开源项目', '合规替换'],
    rating: '5',
    audience: '开发者,运维团队,平台工程团队,企业技术团队,云原生团队',
    features: '容器编排,服务发现,弹性伸缩,配置管理,自动恢复',
    platforms: 'Web,CLI,API,Cloud',
    popularityScore: '57',
  }),
  makeReplacement({
    name: 'OpenTelemetry',
    url: 'https://opentelemetry.io',
    shortSummary: '开源可观测性框架，统一采集指标、日志和链路追踪数据',
    description: 'OpenTelemetry 是 CNCF 旗下的可观测性项目，提供指标、日志、分布式追踪和遥测数据采集规范。它适合开发者、SRE 团队、运维人员和平台工程团队统一监控服务运行状态并排查系统问题。',
    categories: ['监控运维', '开发者工具', '开源项目'],
    keywords: ['OpenTelemetry', '可观测性', '监控', '日志', '链路追踪', '指标', 'DevOps', '开源项目'],
    company: 'Cloud Native Computing Foundation',
    launchYear: '2019',
    tags: ['推荐', '海外网站', '开源项目', '合规替换'],
    rating: '4',
    audience: '开发者,SRE 团队,运维人员,平台工程团队,企业技术团队',
    features: '指标采集,日志采集,链路追踪,遥测规范,系统监控',
    platforms: 'Web,CLI,API,Cloud',
    popularityScore: '45',
  }),
  makeReplacement({
    name: 'Bun',
    url: 'https://bun.sh',
    shortSummary: '面向 JavaScript 和 TypeScript 的运行时、打包器和测试工具',
    description: 'Bun 是面向 JavaScript 与 TypeScript 生态的开发工具，集运行时、包管理、打包和测试能力于一体。它适合前端工程师、全栈开发者和工具链维护者提升本地开发、构建和脚本执行效率。',
    categories: ['开发者工具', '软件开发', '测试工具'],
    keywords: ['Bun', 'JavaScript', 'TypeScript', '运行时', '打包器', '测试工具', '前端开发', '开发者工具'],
    company: 'Oven',
    launchYear: '2022',
    tags: ['推荐', '海外网站', '开发者工具', '合规替换'],
    rating: '4',
    audience: '前端工程师,全栈开发者,工具链维护者,开源贡献者,技术团队',
    features: 'JavaScript 运行时,包管理,代码打包,测试执行,脚本工具',
    platforms: 'Web,CLI,macOS,Linux,Windows',
    popularityScore: '44',
  }),
  makeReplacement({
    name: 'Vite',
    url: 'https://vitejs.dev',
    shortSummary: '现代前端构建工具，提供快速开发服务器和生产构建能力',
    description: 'Vite 是面向现代 Web 应用的前端构建工具，提供快速冷启动、模块热更新、插件扩展和生产构建能力。它适合前端团队、全栈开发者和开源项目搭建 React、Vue、Svelte 等应用。',
    categories: ['开发者工具', '软件开发', '前端开发'],
    keywords: ['Vite', '前端构建', '开发服务器', '热更新', 'React', 'Vue', 'Svelte', '开发者工具'],
    company: 'Vite Team',
    launchYear: '2020',
    tags: ['推荐', '海外网站', '开发者工具', '合规替换'],
    rating: '5',
    audience: '前端工程师,全栈开发者,开源项目维护者,技术团队,学生',
    features: '开发服务器,模块热更新,生产构建,插件系统,前端工程化',
    platforms: 'Web,CLI,Node.js',
    popularityScore: '52',
  }),
  makeReplacement({
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com',
    shortSummary: '实用优先的 CSS 框架，用于快速构建响应式界面',
    description: 'Tailwind CSS 是实用优先的 CSS 框架，提供原子化样式类、响应式规则、主题配置和组件生态。它适合前端工程师、设计工程师、独立开发者和产品团队快速构建一致的 Web 界面。',
    categories: ['设计资源', '开发者工具', 'UI 设计'],
    keywords: ['Tailwind CSS', 'CSS', '前端开发', '响应式设计', 'UI', '样式框架', '设计系统', '开发者工具'],
    company: 'Tailwind Labs',
    launchYear: '2017',
    tags: ['推荐', '海外网站', '设计资源', '合规替换'],
    rating: '5',
    audience: '前端工程师,设计工程师,独立开发者,产品团队,创业团队',
    features: '原子化 CSS,响应式设计,主题配置,组件生态,界面开发',
    platforms: 'Web,Node.js,CLI',
    popularityScore: '53',
  }),
  makeReplacement({
    name: 'Storybook',
    url: 'https://storybook.js.org',
    shortSummary: '前端组件开发与文档工具，支持独立构建和测试 UI 组件',
    description: 'Storybook 是面向前端团队的组件开发环境，支持在独立环境中构建、展示、测试和记录 UI 组件。它适合设计系统团队、前端工程师、产品团队和 QA 团队统一组件交付流程。',
    categories: ['开发者工具', 'UI 设计', '技术文档'],
    keywords: ['Storybook', '组件开发', '设计系统', 'UI 测试', '前端开发', '技术文档', 'React', 'Vue'],
    company: 'Storybook Team',
    launchYear: '2016',
    tags: ['推荐', '海外网站', '开发者工具', '合规替换'],
    rating: '4',
    audience: '前端工程师,设计系统团队,产品团队,QA 团队,开源项目维护者',
    features: '组件预览,交互测试,文档生成,设计系统协作,前端调试',
    platforms: 'Web,CLI,Node.js',
    popularityScore: '49',
  }),
  makeReplacement({
    name: 'Excalidraw',
    url: 'https://excalidraw.com',
    shortSummary: '在线白板和手绘风图表工具，支持协作绘制流程与草图',
    description: 'Excalidraw 是在线白板与手绘风图表工具，提供流程图、架构图、草图绘制和实时协作能力。它适合产品经理、设计师、开发者、教师和远程团队快速表达想法并共享视觉方案。',
    categories: ['设计资源', '效率办公', '协作工具'],
    keywords: ['Excalidraw', '在线白板', '流程图', '草图', '协作', '图表工具', '设计资源', '效率办公'],
    company: 'Excalidraw',
    launchYear: '2020',
    tags: ['推荐', '海外网站', '设计资源', '合规替换'],
    rating: '4',
    audience: '产品经理,设计师,开发者,教师,远程团队',
    features: '在线绘图,实时协作,流程图,架构图,草图表达',
    platforms: 'Web,Desktop',
    popularityScore: '48',
  }),
  makeReplacement({
    name: 'Pandas',
    url: 'https://pandas.pydata.org',
    shortSummary: 'Python 数据分析库，提供结构化数据处理和分析能力',
    description: 'Pandas 是 Python 生态中的开源数据分析库，提供表格数据读取、清洗、转换、聚合和时间序列分析能力。它适合数据分析师、研究人员、工程师和学生处理结构化数据与实验数据。',
    categories: ['数据分析', '开发者工具', '开源项目'],
    keywords: ['Pandas', 'Python', '数据分析', '数据清洗', '表格数据', '时间序列', '开源项目', '开发者工具'],
    company: 'Pandas Project',
    launchYear: '2008',
    tags: ['推荐', '海外网站', '数据分析', '合规替换'],
    rating: '5',
    audience: '数据分析师,研究人员,工程师,学生,数据团队',
    features: '数据读取,数据清洗,数据转换,聚合分析,时间序列处理',
    platforms: 'Web,Python,CLI',
    popularityScore: '55',
  }),
  makeReplacement({
    name: 'Internet Archive',
    url: 'https://internetarchive.org',
    shortSummary: '非营利数字图书馆，保存网页、书籍、音视频和公共数字资料',
    description: 'Internet Archive 是面向全球公众的非营利数字图书馆，长期保存网页快照、电子书、音视频、软件和公共领域资料。它适合研究人员、学生、教师、媒体工作者和普通用户检索历史网页与开放文化资源。',
    categories: ['学习教育', '科研学术', '内容媒体'],
    keywords: ['Internet Archive', '数字图书馆', '网页存档', '电子书', '开放资料', '历史网页', '学习教育', '科研学术'],
    company: 'Internet Archive',
    launchYear: '1996',
    tags: ['推荐', '海外网站', '学习教育', '合规替换'],
    rating: '5',
    audience: '研究人员,学生,教师,媒体工作者,普通用户',
    features: '网页存档,电子书检索,音视频资料,软件归档,公共资料保存',
    platforms: 'Web,API',
    popularityScore: '56',
  }),
  makeReplacement({
    name: 'Supabase',
    url: 'https://supabase.com',
    shortSummary: '开源后端即服务平台，提供数据库、认证、存储和实时能力',
    description: 'Supabase 是面向开发者和创业团队的开源后端平台，提供 PostgreSQL 数据库、用户认证、文件存储、实时订阅和边缘函数等能力。它适合独立开发者、产品团队和企业技术团队快速构建 Web 与移动应用。',
    categories: ['云服务', '开发者工具', '数据库工具'],
    keywords: ['Supabase', 'PostgreSQL', '后端服务', '认证', '文件存储', '实时订阅', '云服务', '开发者工具'],
    company: 'Supabase',
    launchYear: '2020',
    tags: ['推荐', '海外网站', '开发者工具', '合规替换'],
    rating: '4',
    audience: '开发者,独立开发者,产品团队,创业团队,企业技术团队',
    features: '数据库托管,用户认证,文件存储,实时订阅,边缘函数',
    platforms: 'Web,API,CLI,Cloud',
    popularityScore: '50',
  }),
  makeReplacement({
    name: 'PlanetScale',
    url: 'https://planetscale.com',
    shortSummary: '面向开发团队的云数据库平台，支持 MySQL 兼容工作流',
    description: 'PlanetScale 是面向开发团队的云数据库平台，提供 MySQL 兼容数据库、分支工作流、无停机变更和团队协作能力。它适合后端工程师、全栈开发者、平台团队和需要稳定数据库交付流程的企业项目。',
    categories: ['云服务', '数据库工具', '开发者工具'],
    keywords: ['PlanetScale', 'MySQL', '云数据库', '数据库分支', '后端开发', '数据管理', '云服务', '开发者工具'],
    company: 'PlanetScale',
    launchYear: '2018',
    tags: ['推荐', '海外网站', '开发者工具', '合规替换'],
    rating: '4',
    audience: '后端工程师,全栈开发者,平台团队,企业技术团队,创业团队',
    features: '云数据库,数据库分支,无停机变更,团队协作,MySQL 兼容',
    platforms: 'Web,API,CLI,Cloud',
    popularityScore: '46',
  }),
];

/**
 * 构造一条字段完整的合规替换记录。
 * @param {object} input 替换网站的基础资料。
 * @returns {object} 与 CSV 表头兼容的记录。
 */
function makeReplacement(input) {
  return {
    name: input.name,
    url: input.url,
    short_summary: input.shortSummary,
    full_description: input.description,
    category_1: input.categories[0],
    category_2: input.categories[1],
    category_3: input.categories[2],
    category_4: '',
    category_5: '',
    category_6: '',
    category_7: '',
    category_8: '',
    keywords: input.keywords.join(','),
    company: input.company,
    language: '多语言',
    is_free: '部分免费',
    region: '全球',
    launch_year: input.launchYear,
    tags: input.tags.join(','),
    star_rating: input.rating,
    monthly_visits: '0',
    screenshot_url: '',
    founder: '',
    headquarters: '',
    pricing_model: '基础功能免费，部分高级功能或企业服务可能收费',
    alternatives: '',
    target_audience: input.audience,
    features: input.features,
    platforms: input.platforms,
    social_links: '',
    popularity_score: input.popularityScore,
    popularity_level: 'manual',
    popularity_rank: '0',
    popularity_source: 'manual_safe_replacement',
    popularity_ref_subnets: '0',
    popularity_ref_ips: '0',
    popularity_updated_at: UPDATED_AT,
  };
}

/**
 * 建立域名、名称和 slug 索引，防止替换记录引入重复站点。
 * @param {object[]} records 当前 CSV 记录。
 * @returns {{domains: Set<string>, names: Set<string>, slugs: Set<string>}} 去重索引。
 */
function buildIndexes(records) {
  const indexes = {
    domains: new Set(),
    names: new Set(),
    slugs: new Set(),
  };
  for (const row of records) {
    indexes.domains.add(normalizeDomain(new URL(row.url).hostname));
    indexes.names.add(String(row.name || '').toLowerCase());
    indexes.slugs.add(generateSlug(row.name || ''));
  }
  return indexes;
}

/**
 * 判断候选替换记录是否会与现有记录重复。
 * @param {object} record 候选替换记录。
 * @param {{domains: Set<string>, names: Set<string>, slugs: Set<string>}} indexes 去重索引。
 * @returns {boolean} true 表示可以安全追加。
 */
function canAppend(record, indexes) {
  const domain = normalizeDomain(new URL(record.url).hostname);
  const name = String(record.name || '').toLowerCase();
  const slug = generateSlug(record.name || '');
  return !indexes.domains.has(domain) && !indexes.names.has(name) && !indexes.slugs.has(slug);
}

/**
 * 主流程：删除高风险域名、补入合规记录、重新平衡新增分类并写回 CSV。
 */
function main() {
  const records = readExistingCsv(CSV_PATH);
  const kept = [];
  const removed = [];

  for (const row of records) {
    const domain = normalizeDomain(new URL(row.url).hostname);
    if (BLOCKED_DOMAINS.has(domain)) {
      removed.push(row);
    } else {
      kept.push(row);
    }
  }

  if (removed.length !== BLOCKED_DOMAINS.size) {
    throw new Error(`高风险域名命中数量异常：expected=${BLOCKED_DOMAINS.size}, actual=${removed.length}`);
  }

  const indexes = buildIndexes(kept);
  const appended = [];
  for (const replacement of REPLACEMENTS) {
    if (appended.length >= removed.length) break;
    if (!canAppend(replacement, indexes)) continue;
    const domain = normalizeDomain(new URL(replacement.url).hostname);
    indexes.domains.add(domain);
    indexes.names.add(String(replacement.name || '').toLowerCase());
    indexes.slugs.add(generateSlug(replacement.name || ''));
    appended.push(replacement);
  }

  if (appended.length !== removed.length) {
    throw new Error(`合规替换记录不足：removed=${removed.length}, appended=${appended.length}`);
  }

  const finalRecords = expandRecords([...kept, ...appended]);
  assertCoverage(countNewCategories(finalRecords));
  fs.writeFileSync(CSV_PATH, toCsv(finalRecords), 'utf8');

  console.log(`已移除 ${removed.length} 条高风险记录，并补入 ${appended.length} 条合规记录。`);
  console.log(`CSV 当前总量：${finalRecords.length}`);
  console.log(`移除：${removed.map((row) => row.url).join(', ')}`);
  console.log(`补入：${appended.map((row) => row.url).join(', ')}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  BLOCKED_DOMAINS,
  REPLACEMENTS,
  makeReplacement,
  buildIndexes,
  canAppend,
};

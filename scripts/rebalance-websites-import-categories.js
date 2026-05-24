/**
 * 网站导入数据分类补强脚本
 *
 * 用途：
 * 1. 为当前薄弱分类补充一批人工确认的官网候选。
 * 2. 自动从过量分类中移除同等数量记录，保持总量 5000。
 * 3. 全程按域名、名称、slug 去重，避免重复收录。
 */

const fs = require('fs');
const { parse } = require('csv-parse/sync');
const {
  TARGET_TOTAL,
  CSV_PATH,
  SEED_FILES,
  extractSeedDomains,
  normalizeDomain,
  generateSlug,
  toCsv,
} = require('./expand-websites-import');

const PROTECTED_FIRST_ROWS = 90;
const MIN_ANY_CATEGORY_COUNT = 20;
const OVERFLOW_PRIMARY_CATEGORIES = new Set(['学习教育', '开发者工具', '设计资源', '效率办公', '影音娱乐', '生活服务']);
const CATEGORY_OVERRIDES = new Map([
  ['sourcehut.org', ['代码托管', '开发者工具', '开源项目']],
  ['gitea.com', ['代码托管', '开源项目', '开发者工具']],
  ['forgejo.org', ['代码托管', '开源项目', '开发者工具']],
  ['framagit.org', ['代码托管', '开源项目', '开发者工具']],
  ['beanstalkapp.com', ['代码托管', '开发者工具', '效率办公']],
  ['help.launchpad.net', ['代码托管', '开源项目', '开发者工具']],
  ['savannah.gnu.org', ['代码托管', '开源项目', '开发者工具']],
  ['savannah.nongnu.org', ['代码托管', '开源项目', '开发者工具']],
  ['tuleap.org', ['代码托管', '开源项目', '开发者工具']],
  ['rhodecode.com', ['代码托管', '开发者工具', '网络安全']],
  ['review.gerrithub.io', ['代码托管', '开发者工具', '开源项目']],
  ['sourceforge.net', ['代码托管', '开源项目', '开发者工具']],
  ['gogs.io', ['代码托管', '开源项目', '开发者工具']],
  ['pagure.io', ['代码托管', '开源项目', '开发者工具']],
  ['gitbucket.github.io', ['代码托管', '开源项目', '开发者工具']],
  ['gitblit.com', ['代码托管', '开源项目', '开发者工具']],
  ['radicle.xyz', ['代码托管', '开源项目', '开发者工具']],
  ['we.phorge.it', ['代码托管', '开源项目', '开发者工具']],
  ['reviewboard.org', ['代码托管', '开发者工具', '开源项目']],
  ['reviewable.io', ['代码托管', '开发者工具', '效率办公']],
  ['pullrequest.com', ['代码托管', '开发者工具', '效率办公']],
  ['fossil-scm.org', ['代码托管', '开源项目', '开发者工具']],
]);

// 构造一条补强记录，保持字段与导入模板一致。
function makeRecord(name, url, category1, category2, category3, summary, keywords, isFree = '部分免费', language = '多语言', region = '全球', company = '') {
  return {
    name,
    url,
    short_summary: summary,
    full_description: '',
    category_1: category1,
    category_2: category2,
    category_3: category3,
    keywords,
    is_free: isFree,
    language,
    region,
    company,
    launch_year: '',
  };
}

const MANUAL_RECORDS = [
  makeRecord('Codeberg', 'https://codeberg.org', '代码托管', '开源项目', '开发者工具', 'Codeberg 是面向自由与开源项目的代码托管平台，提供 Git 仓库、议题和协作开发能力。', '代码托管,Git,开源,协作,开发者', '是', '多语言', '全球', 'Codeberg'),
  makeRecord('Framagit', 'https://framagit.org', '代码托管', '开源项目', '开发者工具', 'Framagit 是 Framasoft 运营的 GitLab 托管实例，面向开源项目和协作开发场景。', '代码托管,GitLab,开源,协作,开发者', '是', '多语言', '欧洲', 'Framasoft'),
  makeRecord('NotABug', 'https://notabug.org', '代码托管', '开源项目', '开发者工具', 'NotABug 是面向自由软件项目的 Git 代码托管服务，支持仓库、议题和项目协作。', '代码托管,Git,自由软件,开源,协作', '是', '英文', '全球', 'NotABug'),
  makeRecord('repo.or.cz', 'https://repo.or.cz', '代码托管', '开源项目', '开发者工具', 'repo.or.cz 是老牌 Git 项目托管站点，适合小型开源项目发布和维护源码仓库。', '代码托管,Git,开源,源码,仓库', '是', '英文', '全球', 'repo.or.cz'),
  makeRecord('GitBucket', 'https://gitbucket.github.io', '代码托管', '开源项目', '开发者工具', 'GitBucket 是可自托管的 Git 平台，提供仓库、议题、拉取请求和团队协作功能。', '代码托管,Git,自托管,开源,协作', '是', '英文', '全球', 'GitBucket'),
  makeRecord('Gitblit', 'https://www.gitblit.com', '代码托管', '开源项目', '开发者工具', 'Gitblit 是轻量级 Git 仓库管理工具，适合团队自建源码托管和代码浏览服务。', '代码托管,Git,自托管,仓库,开发者', '是', '英文', '全球', 'Gitblit'),
  makeRecord('Radicle', 'https://radicle.xyz', '代码托管', '开源项目', '开发者工具', 'Radicle 是点对点代码协作网络，面向希望减少中心化依赖的开源开发者。', '代码托管,Git,开源,点对点,协作', '是', '英文', '全球', 'Radicle'),
  makeRecord('Phorge', 'https://we.phorge.it', '代码托管', '开源项目', '开发者工具', 'Phorge 是开源的软件协作套件，提供代码评审、仓库浏览、任务和项目协作能力。', '代码托管,代码评审,开源,协作,项目管理', '是', '英文', '全球', 'Phorge'),
  makeRecord('Review Board', 'https://www.reviewboard.org', '代码托管', '开发者工具', '开源项目', 'Review Board 是代码评审平台，可连接 Git、Mercurial、Subversion 等仓库进行审查流程管理。', '代码评审,代码托管,Git,SVN,协作', '是', '英文', '全球', 'Review Board'),
  makeRecord('Reviewable', 'https://reviewable.io', '代码托管', '开发者工具', '效率办公', 'Reviewable 是面向 GitHub 仓库的代码评审工具，帮助团队管理复杂变更和审查流程。', '代码评审,GitHub,协作,开发者,Pull Request', '部分免费', '英文', '全球', 'Reviewable'),
  makeRecord('PullRequest', 'https://www.pullrequest.com', '代码托管', '开发者工具', '效率办公', 'PullRequest 提供代码评审服务和工程审查流程，适合需要外部专家参与的开发团队。', '代码评审,开发者,协作,质量,工程团队', '否', '英文', '全球', 'PullRequest'),
  makeRecord('SmartBear Collaborator', 'https://smartbear.com/product/collaborator/', '代码托管', '开发者工具', '效率办公', 'SmartBear Collaborator 是企业代码和文档评审平台，支持团队在交付流程中进行审查协作。', '代码评审,企业,协作,质量,开发流程', '否', '英文', '全球', 'SmartBear'),
  makeRecord('Helix TeamHub', 'https://www.perforce.com/products/helix-teamhub', '代码托管', '开发者工具', '云服务', 'Helix TeamHub 是 Perforce 的代码托管和协作平台，支持 Git、Mercurial 与 SVN 仓库管理。', '代码托管,Git,SVN,企业,协作', '否', '英文', '全球', 'Perforce'),
  makeRecord('Unity Version Control', 'https://unity.com/products/unity-version-control', '代码托管', '开发者工具', '云服务', 'Unity Version Control 面向游戏和大型二进制资产团队，提供版本控制和协作开发能力。', '版本控制,代码托管,游戏开发,协作,资产管理', '部分免费', '英文', '全球', 'Unity'),
  makeRecord('Azure Repos', 'https://azure.microsoft.com/products/devops/repos/', '代码托管', '云服务', '开发者工具', 'Azure Repos 是 Azure DevOps 中的源码托管服务，提供 Git 仓库、拉取请求和代码协作流程。', '代码托管,Git,Azure,DevOps,协作', '部分免费', '多语言', '全球', 'Microsoft'),
  makeRecord('WalletHub', 'https://wallethub.com', '金融理财', '数据分析', '生活服务', 'WalletHub 提供信用卡、贷款、保险和个人财务工具对比，适合做日常理财决策参考。', '金融理财,信用卡,贷款,保险,对比', '是', '英文', '美国', 'WalletHub'),
  makeRecord('SourceHut', 'https://sourcehut.org', '代码托管', '开发者工具', '开源项目', 'SourceHut 是面向开发者的代码托管平台，提供 Git、Mercurial、构建和邮件协作工具。', '代码托管,Git,开源,开发者,协作', '部分免费', '英文', '全球', 'SourceHut'),
  makeRecord('Gitea', 'https://about.gitea.com', '代码托管', '开源项目', '开发者工具', 'Gitea 是轻量级开源代码托管平台，适合团队自托管 Git 仓库和协作开发。', 'Gitea,Git,代码托管,开源,自托管', '是', '多语言', '全球', 'Gitea'),
  makeRecord('Forgejo', 'https://forgejo.org', '代码托管', '开源项目', '开发者工具', 'Forgejo 是社区驱动的开源代码协作平台，提供 Git 仓库、议题和合并请求能力。', 'Forgejo,Git,代码托管,开源,协作', '是', '英文', '全球', 'Forgejo'),
  makeRecord('Gerrit Code Review', 'https://www.gerritcodereview.com', '代码托管', '开发者工具', '开源项目', 'Gerrit Code Review 是面向代码审查和 Git 协作流程的开源平台。', 'Gerrit,代码审查,Git,协作,开源', '是', '英文', '全球', 'Gerrit'),
  makeRecord('Launchpad', 'https://launchpad.net', '代码托管', '开源项目', '开发者工具', 'Launchpad 是开源项目协作平台，支持代码托管、问题跟踪、翻译和发布管理。', 'Launchpad,开源,代码托管,项目协作,问题跟踪', '是', '英文', '全球', 'Canonical'),
  makeRecord('SourceForge', 'https://sourceforge.net', '代码托管', '开源项目', '开发者工具', 'SourceForge 是历史悠久的开源软件发布和代码托管平台。', 'SourceForge,开源软件,代码托管,下载,项目', '是', '英文', '全球', 'SourceForge'),
  makeRecord('GNU Savannah', 'https://savannah.gnu.org', '代码托管', '开源项目', '开发者工具', 'GNU Savannah 是 GNU 项目相关自由软件的代码托管和项目协作平台。', 'GNU,自由软件,代码托管,开源,项目协作', '是', '英文', '全球', 'GNU'),
  makeRecord('RhodeCode', 'https://rhodecode.com', '代码托管', '开发者工具', '网络安全', 'RhodeCode 是面向企业的源代码管理平台，支持代码审查、权限控制和审计。', '代码托管,企业,代码审查,权限,审计', '否', '英文', '全球', 'RhodeCode'),
  makeRecord('Assembla', 'https://get.assembla.com', '代码托管', '开发者工具', '效率办公', 'Assembla 提供代码托管、项目管理和团队协作功能，适合软件团队使用。', '代码托管,项目管理,协作,Git,团队', '否', '英文', '全球', 'Assembla'),
  makeRecord('Beanstalk', 'https://beanstalkapp.com', '代码托管', '开发者工具', '效率办公', 'Beanstalk 是面向团队的 Git 和 SVN 代码托管服务，支持部署和代码审查。', '代码托管,Git,SVN,部署,代码审查', '否', '英文', '全球', 'Beanstalk'),
  makeRecord('Codebase', 'https://www.codebasehq.com', '代码托管', '开发者工具', '效率办公', 'Codebase 是代码托管和项目管理平台，支持仓库、问题跟踪和团队协作。', '代码托管,项目管理,协作,仓库,开发', '否', '英文', '全球', 'Codebase'),
  makeRecord('Tuleap', 'https://www.tuleap.org', '代码托管', '开源项目', '开发者工具', 'Tuleap 是开源软件开发协作平台，覆盖代码管理、敏捷项目和需求跟踪。', 'Tuleap,开源,代码管理,敏捷,协作', '是', '英文', '全球', 'Tuleap'),
  makeRecord('Apache Allura', 'https://allura.apache.org', '代码托管', '开源项目', '开发者工具', 'Apache Allura 是用于搭建软件项目协作与代码托管站点的开源平台。', 'Apache,Allura,代码托管,开源,项目协作', '是', '英文', '全球', 'Apache'),
  makeRecord('Gogs', 'https://gogs.io', '代码托管', '开源项目', '开发者工具', 'Gogs 是轻量级自托管 Git 服务，适合个人或小团队部署代码托管平台。', 'Gogs,Git,自托管,开源,代码托管', '是', '英文', '全球', 'Gogs'),
  makeRecord('Kallithea', 'https://kallithea-scm.org', '代码托管', '开源项目', '开发者工具', 'Kallithea 是支持 Mercurial 和 Git 的自由软件代码托管系统。', 'Kallithea,Git,Mercurial,代码托管,开源', '是', '英文', '全球', 'Kallithea'),
  makeRecord('Pagure', 'https://pagure.io/pagure', '代码托管', '开源项目', '开发者工具', 'Pagure 是开源代码协作平台，提供仓库、议题、拉取请求和项目托管功能。', 'Pagure,代码托管,开源,仓库,协作', '是', '英文', '全球', 'Pagure'),
  makeRecord('Pijul Nest', 'https://nest.pijul.com', '代码托管', '开发者工具', '开源项目', 'Pijul Nest 是 Pijul 版本控制系统的代码托管入口，适合探索分布式协作。', 'Pijul,代码托管,版本控制,协作,开发者', '部分免费', '英文', '全球', 'Pijul'),

  makeRecord('AppSheet', 'https://www.appsheet.com', '低代码平台', '效率办公', '开发者工具', 'AppSheet 是 Google 的无代码应用构建平台，可用表格数据快速创建业务应用。', '低代码,无代码,AppSheet,应用开发,表格', '部分免费', '多语言', '全球', 'Google'),
  makeRecord('Microsoft Power Apps', 'https://www.microsoft.com/power-platform/products/power-apps', '低代码平台', '效率办公', '云服务', 'Microsoft Power Apps 是企业低代码应用平台，适合构建内部流程和业务应用。', '低代码,Power Apps,企业应用,流程,微软', '否', '多语言', '全球', 'Microsoft'),
  makeRecord('Retool', 'https://retool.com', '低代码平台', '开发者工具', '效率办公', 'Retool 是面向团队的内部工具构建平台，可连接数据库和 API 快速搭建后台。', '低代码,内部工具,数据库,API,后台', '部分免费', '英文', '全球', 'Retool'),
  makeRecord('Glide', 'https://www.glideapps.com', '低代码平台', '效率办公', '创业工具', 'Glide 是无代码应用构建平台，可从表格和数据源快速生成移动与网页应用。', '无代码,应用开发,表格,移动应用,创业', '部分免费', '英文', '全球', 'Glide'),
  makeRecord('Softr', 'https://www.softr.io', '低代码平台', '创业工具', '效率办公', 'Softr 是无代码网站和应用构建平台，适合制作门户、目录和会员应用。', '无代码,建站,门户,应用,目录', '部分免费', '英文', '全球', 'Softr'),
  makeRecord('Adalo', 'https://www.adalo.com', '低代码平台', '创业工具', '效率办公', 'Adalo 是无代码应用开发平台，支持制作移动应用、数据库和用户界面。', '无代码,移动应用,数据库,界面,创业', '部分免费', '英文', '全球', 'Adalo'),
  makeRecord('Appsmith', 'https://www.appsmith.com', '低代码平台', '开源项目', '开发者工具', 'Appsmith 是开源低代码平台，适合构建内部工具、管理面板和数据应用。', '低代码,开源,内部工具,管理面板,数据应用', '部分免费', '英文', '全球', 'Appsmith'),
  makeRecord('Budibase', 'https://budibase.com', '低代码平台', '开源项目', '开发者工具', 'Budibase 是开源低代码平台，帮助团队构建工作流和内部业务应用。', '低代码,开源,工作流,内部应用,自动化', '部分免费', '英文', '全球', 'Budibase'),
  makeRecord('NocoDB', 'https://nocodb.com', '低代码平台', '开源项目', '数据分析', 'NocoDB 是开源无代码数据库平台，可把数据库转换成协作式表格界面。', '无代码,数据库,开源,表格,协作', '部分免费', '英文', '全球', 'NocoDB'),
  makeRecord('Xano', 'https://www.xano.com', '低代码平台', '云服务', '开发者工具', 'Xano 是无代码后端平台，支持 API、数据库和业务逻辑构建。', '无代码,后端,API,数据库,业务逻辑', '部分免费', '英文', '全球', 'Xano'),
  makeRecord('Make', 'https://www.make.com', '低代码平台', '效率办公', '营销推广', 'Make 是可视化自动化平台，帮助用户连接应用并构建跨系统工作流。', '自动化,工作流,无代码,集成,效率', '部分免费', '英文', '全球', 'Make'),
  makeRecord('IFTTT', 'https://ifttt.com', '低代码平台', '效率办公', '生活服务', 'IFTTT 是自动化连接平台，可把常用应用和设备组合成简单规则。', '自动化,无代码,应用连接,设备,规则', '部分免费', '英文', '全球', 'IFTTT'),
  makeRecord('n8n', 'https://n8n.io', '低代码平台', '开源项目', '效率办公', 'n8n 是可自托管的工作流自动化平台，支持连接 API 和应用服务。', 'n8n,自动化,开源,工作流,API', '部分免费', '英文', '全球', 'n8n'),
  makeRecord('Pipedream', 'https://pipedream.com', '低代码平台', '开发者工具', '效率办公', 'Pipedream 是面向开发者的自动化平台，可用代码和组件连接不同服务。', '自动化,开发者,工作流,API,集成', '部分免费', '英文', '全球', 'Pipedream'),
  makeRecord('Parabola', 'https://parabola.io', '低代码平台', '数据分析', '效率办公', 'Parabola 是无代码数据流程工具，适合处理表格、报表和运营数据。', '无代码,数据流程,表格,报表,自动化', '否', '英文', '全球', 'Parabola'),
  makeRecord('OutSystems', 'https://www.outsystems.com', '低代码平台', '开发者工具', '云服务', 'OutSystems 是企业低代码开发平台，支持构建和部署业务应用。', '低代码,企业应用,开发平台,部署,云服务', '否', '多语言', '全球', 'OutSystems'),
  makeRecord('Mendix', 'https://www.mendix.com', '低代码平台', '开发者工具', '云服务', 'Mendix 是企业级低代码应用开发平台，适合复杂业务流程和应用交付。', '低代码,企业应用,业务流程,开发,云服务', '否', '英文', '全球', 'Siemens'),
  makeRecord('Quickbase', 'https://www.quickbase.com', '低代码平台', '效率办公', '数据分析', 'Quickbase 是企业低代码平台，帮助团队构建流程应用和运营看板。', '低代码,流程应用,看板,企业,运营', '否', '英文', '全球', 'Quickbase'),
  makeRecord('Knack', 'https://www.knack.com', '低代码平台', '数据分析', '效率办公', 'Knack 是在线数据库和无代码应用平台，适合构建目录、门户和业务工具。', '无代码,数据库,门户,目录,业务工具', '部分免费', '英文', '全球', 'Knack'),
  makeRecord('Caspio', 'https://www.caspio.com', '低代码平台', '数据分析', '云服务', 'Caspio 是低代码在线数据库平台，支持构建表单、报表和业务应用。', '低代码,数据库,表单,报表,业务应用', '否', '英文', '全球', 'Caspio'),

  makeRecord('Walmart', 'https://www.walmart.com', '电商购物', '生活服务', '营销推广', 'Walmart 是大型零售和电商平台，提供日用品、电子产品和家庭商品。', '电商,购物,零售,商品,生活', '是', '英文', '美国', 'Walmart'),
  makeRecord('Target', 'https://www.target.com', '电商购物', '生活服务', '营销推广', 'Target 是美国零售电商平台，提供家居、服饰、电子和日用品购物服务。', '电商,购物,零售,家居,日用品', '是', '英文', '美国', 'Target'),
  makeRecord('Best Buy', 'https://www.bestbuy.com', '电商购物', '生活服务', '营销推广', 'Best Buy 是电子产品零售和电商平台，覆盖电脑、家电、手机和配件。', '电商,电子产品,购物,家电,零售', '是', '英文', '美国', 'Best Buy'),
  makeRecord('Newegg', 'https://www.newegg.com', '电商购物', '开发者工具', '生活服务', 'Newegg 是面向电脑硬件和电子产品的电商平台，适合选购配件和设备。', '电商,电脑硬件,电子产品,购物,配件', '是', '英文', '全球', 'Newegg'),
  makeRecord('Wayfair', 'https://www.wayfair.com', '电商购物', '生活服务', '设计资源', 'Wayfair 是家居家具电商平台，提供家具、装饰和家装相关商品。', '电商,家居,家具,装饰,购物', '是', '英文', '美国', 'Wayfair'),
  makeRecord('Costco', 'https://www.costco.com', '电商购物', '生活服务', '营销推广', 'Costco 是会员制零售平台，提供食品、家居、电子和日常消费品。', '电商,会员,零售,生活用品,购物', '是', '英文', '美国', 'Costco'),
  makeRecord('Rakuten', 'https://www.rakuten.com', '电商购物', '营销推广', '生活服务', 'Rakuten 是电商和返利平台，提供购物入口、优惠和现金返还服务。', '电商,返利,优惠,购物,消费', '是', '英文', '全球', 'Rakuten'),
  makeRecord('Mercado Libre', 'https://www.mercadolibre.com', '电商购物', '生活服务', '创业工具', 'Mercado Libre 是拉美地区大型电商平台，覆盖商品交易、支付和商家服务。', '电商,拉美,购物,商家,支付', '是', '多语言', '拉美', 'Mercado Libre'),
  makeRecord('Flipkart', 'https://www.flipkart.com', '电商购物', '生活服务', '营销推广', 'Flipkart 是印度大型电商平台，提供电子产品、服饰、家居和日用品。', '电商,印度,购物,零售,商品', '是', '英文', '印度', 'Flipkart'),
  makeRecord('Lazada', 'https://www.lazada.com', '电商购物', '营销推广', '生活服务', 'Lazada 是东南亚电商平台，服务多个国家的消费者和商家。', '电商,东南亚,购物,商家,跨境', '是', '多语言', '东南亚', 'Alibaba'),
  makeRecord('Shopee', 'https://shopee.com', '电商购物', '营销推广', '生活服务', 'Shopee 是东南亚和拉美市场常用电商平台，提供商品交易和卖家工具。', '电商,购物,卖家,东南亚,跨境', '是', '多语言', '全球', 'Sea'),
  makeRecord('Zalando', 'https://www.zalando.com', '电商购物', '生活服务', '设计资源', 'Zalando 是欧洲时尚电商平台，提供服饰、鞋履和生活方式商品。', '电商,时尚,服饰,欧洲,购物', '是', '多语言', '欧洲', 'Zalando'),
  makeRecord('ASOS', 'https://www.asos.com', '电商购物', '生活服务', '设计资源', 'ASOS 是在线时尚零售平台，提供服饰、鞋履、美妆和潮流商品。', '电商,时尚,服饰,购物,美妆', '是', '英文', '全球', 'ASOS'),

  makeRecord('NerdWallet', 'https://www.nerdwallet.com', '金融理财', '学习教育', '生活服务', 'NerdWallet 提供个人金融知识、信用卡、贷款和理财工具信息。', '金融,理财,信用卡,贷款,个人财务', '是', '英文', '美国', 'NerdWallet'),
  makeRecord('Bankrate', 'https://www.bankrate.com', '金融理财', '数据分析', '生活服务', 'Bankrate 提供贷款、利率、信用卡和个人理财相关工具与信息。', '金融,利率,贷款,信用卡,理财', '是', '英文', '美国', 'Bankrate'),
  makeRecord('The Balance Money', 'https://www.thebalancemoney.com', '金融理财', '学习教育', '新闻资讯', 'The Balance Money 提供个人理财、投资基础和财务规划教育内容。', '金融知识,理财,投资基础,教育,财务规划', '是', '英文', '美国', 'Dotdash Meredith'),
  makeRecord('Morningstar', 'https://www.morningstar.com', '金融理财', '数据分析', '新闻资讯', 'Morningstar 提供基金、股票和投资研究数据，适合做金融信息参考。', '金融,基金,股票,投资研究,数据', '部分免费', '英文', '全球', 'Morningstar'),
  makeRecord('Yahoo Finance', 'https://finance.yahoo.com', '金融理财', '新闻资讯', '数据分析', 'Yahoo Finance 提供市场行情、财经新闻、公司数据和投资组合工具。', '财经,行情,市场,公司数据,新闻', '是', '英文', '全球', 'Yahoo'),
  makeRecord('MarketWatch', 'https://www.marketwatch.com', '金融理财', '新闻资讯', '数据分析', 'MarketWatch 提供财经新闻、市场行情、公司信息和投资相关数据。', '财经新闻,市场,行情,公司,金融', '部分免费', '英文', '全球', 'Dow Jones'),
  makeRecord('FRED', 'https://fred.stlouisfed.org', '金融理财', '数据分析', '学习教育', 'FRED 是圣路易斯联储经济数据平台，提供宏观经济时间序列数据。', '经济数据,宏观,联储,金融,数据分析', '是', '英文', '全球', 'Federal Reserve Bank of St. Louis'),
  makeRecord('SEC EDGAR', 'https://www.sec.gov/edgar', '金融理财', '数据分析', '创业工具', 'SEC EDGAR 提供美国上市公司公开披露文件查询入口。', '金融,公司披露,SEC,财报,数据', '是', '英文', '美国', 'U.S. SEC'),
  makeRecord('FINVIZ', 'https://finviz.com', '金融理财', '数据分析', '新闻资讯', 'FINVIZ 提供股票筛选、市场地图、图表和财经数据浏览工具。', '股票筛选,市场地图,图表,财经,数据', '部分免费', '英文', '全球', 'FINVIZ'),
  makeRecord('Macrotrends', 'https://www.macrotrends.net', '金融理财', '数据分析', '学习教育', 'Macrotrends 提供长期宏观经济、市场和公司财务图表数据。', '宏观数据,市场,财务图表,长期趋势,金融', '是', '英文', '全球', 'Macrotrends'),
  makeRecord('OECD Data', 'https://data.oecd.org', '金融理财', '数据分析', '学习教育', 'OECD Data 提供经济、社会、就业和公共政策相关统计数据。', '经济数据,统计,OECD,公共政策,数据分析', '是', '英文', '全球', 'OECD'),
  makeRecord('World Bank Data', 'https://data.worldbank.org', '金融理财', '数据分析', '学习教育', 'World Bank Data 提供全球发展、经济、人口和行业统计数据。', '世界银行,发展数据,经济,统计,数据分析', '是', '多语言', '全球', 'World Bank'),

  makeRecord('NPR', 'https://www.npr.org', '新闻资讯', '影音娱乐', '学习教育', 'NPR 是美国公共媒体网站，提供新闻报道、播客、专题和文化内容。', '新闻,播客,公共媒体,专题,文化', '是', '英文', '美国', 'NPR'),
  makeRecord('CNN', 'https://www.cnn.com', '新闻资讯', '影音娱乐', '生活服务', 'CNN 提供国际新闻、视频报道、财经、科技和生活资讯。', '新闻,国际,视频,财经,科技', '是', '英文', '全球', 'CNN'),
  makeRecord('The Guardian', 'https://www.theguardian.com', '新闻资讯', '学习教育', '生活服务', 'The Guardian 提供国际新闻、评论、文化、环境和专题报道。', '新闻,国际,评论,文化,专题', '是', '英文', '全球', 'Guardian News & Media'),
  makeRecord('The New York Times', 'https://www.nytimes.com', '新闻资讯', '学习教育', '生活服务', 'The New York Times 提供新闻、评论、深度报道、文化和生活内容。', '新闻,深度报道,评论,文化,生活', '部分免费', '英文', '全球', 'The New York Times'),
  makeRecord('The Washington Post', 'https://www.washingtonpost.com', '新闻资讯', '学习教育', '生活服务', 'The Washington Post 提供新闻、分析、观点和多媒体报道。', '新闻,分析,观点,多媒体,报道', '部分免费', '英文', '全球', 'The Washington Post'),
  makeRecord('Bloomberg', 'https://www.bloomberg.com', '新闻资讯', '金融理财', '数据分析', 'Bloomberg 提供财经新闻、市场数据、商业分析和全球新闻报道。', '财经新闻,市场,商业,数据,全球', '部分免费', '英文', '全球', 'Bloomberg'),
  makeRecord('CNBC', 'https://www.cnbc.com', '新闻资讯', '金融理财', '数据分析', 'CNBC 提供财经新闻、商业报道、市场数据和视频节目。', '财经,商业新闻,市场,视频,数据', '是', '英文', '全球', 'CNBC'),
  makeRecord('TechCrunch', 'https://techcrunch.com', '新闻资讯', '创业工具', 'AI 工具', 'TechCrunch 报道科技创业公司、产品发布、融资和互联网行业动态。', '科技新闻,创业,融资,产品,AI', '是', '英文', '全球', 'Yahoo'),
  makeRecord('WIRED', 'https://www.wired.com', '新闻资讯', 'AI 工具', '影音娱乐', 'WIRED 报道科技、科学、商业、文化和数字生活趋势。', '科技,科学,文化,趋势,新闻', '部分免费', '英文', '全球', 'Condé Nast'),
  makeRecord('Ars Technica', 'https://arstechnica.com', '新闻资讯', '开发者工具', '学习教育', 'Ars Technica 提供科技新闻、软件、硬件、科学和政策相关报道。', '科技新闻,软件,硬件,科学,报道', '是', '英文', '全球', 'Condé Nast'),
  makeRecord('The Register', 'https://www.theregister.com', '新闻资讯', '开发者工具', '网络安全', 'The Register 报道企业技术、软件、硬件、云服务和安全新闻。', '科技新闻,企业技术,云服务,安全,软件', '是', '英文', '全球', 'The Register'),
  makeRecord('MIT Technology Review', 'https://www.technologyreview.com', '新闻资讯', 'AI 工具', '学习教育', 'MIT Technology Review 报道新兴科技、AI、能源、计算和社会影响。', '科技新闻,AI,能源,计算,研究', '部分免费', '英文', '全球', 'MIT'),
  makeRecord('Axios', 'https://www.axios.com', '新闻资讯', '创业工具', '生活服务', 'Axios 提供简明新闻报道，覆盖商业、科技、政策和国际资讯。', '新闻,商业,科技,政策,国际', '是', '英文', '美国', 'Axios'),

  makeRecord('Yahoo Mail', 'https://mail.yahoo.com', '邮件工具', '效率办公', '生活服务', 'Yahoo Mail 是面向个人用户的邮箱服务，支持网页收发、附件和基础邮件管理。', '邮箱,邮件,个人邮箱,附件,办公', '部分免费', '多语言', '全球', 'Yahoo'),
  makeRecord('AOL Mail', 'https://mail.aol.com', '邮件工具', '效率办公', '生活服务', 'AOL Mail 提供个人网页邮箱服务，支持邮件收发、联系人和基础管理功能。', '邮箱,邮件,个人邮箱,联系人,办公', '是', '英文', '全球', 'AOL'),
  makeRecord('GMX Mail', 'https://www.gmx.com', '邮件工具', '效率办公', '网络安全', 'GMX Mail 提供免费邮箱、附件管理、云存储和基础安全功能。', '邮箱,免费邮箱,附件,云存储,安全', '部分免费', '英文', '全球', 'GMX'),
  makeRecord('Mail.com', 'https://www.mail.com', '邮件工具', '效率办公', '生活服务', 'Mail.com 提供个人邮箱服务，支持多个邮箱域名选择和网页邮件管理。', '邮箱,个人邮箱,域名邮箱,邮件管理,办公', '部分免费', '英文', '全球', 'Mail.com'),
  makeRecord('Tuta', 'https://tuta.com', '邮件工具', '网络安全', '效率办公', 'Tuta 是重视隐私的加密邮箱服务，提供安全邮件、日历和联系人功能。', '加密邮箱,隐私,邮件,安全,日历', '部分免费', '多语言', '全球', 'Tuta'),
  makeRecord('Mailgun', 'https://www.mailgun.com', '邮件工具', '开发者工具', '营销推广', 'Mailgun 是开发者邮件发送平台，支持事务邮件、邮件 API 和投递分析。', '邮件API,事务邮件,开发者,投递,分析', '部分免费', '英文', '全球', 'Mailgun'),
  makeRecord('SendGrid', 'https://sendgrid.com', '邮件工具', '营销推广', '开发者工具', 'SendGrid 是邮件发送和邮件营销平台，提供 API、模板和投递分析。', '邮件发送,邮件营销,API,模板,投递', '部分免费', '英文', '全球', 'Twilio'),
  makeRecord('Postmark', 'https://postmarkapp.com', '邮件工具', '开发者工具', '营销推广', 'Postmark 是事务邮件发送服务，强调邮件投递速度、可靠性和开发者 API。', '事务邮件,邮件API,投递,开发者,通知', '否', '英文', '全球', 'ActiveCampaign'),
  makeRecord('Brevo', 'https://www.brevo.com', '邮件工具', '营销推广', '效率办公', 'Brevo 提供邮件营销、短信、CRM 和营销自动化工具。', '邮件营销,CRM,短信,自动化,营销', '部分免费', '多语言', '全球', 'Brevo'),
  makeRecord('MailerLite', 'https://www.mailerlite.com', '邮件工具', '营销推广', '低代码平台', 'MailerLite 是邮件营销平台，支持订阅表单、自动化、落地页和邮件活动。', '邮件营销,订阅,自动化,落地页,活动', '部分免费', '英文', '全球', 'MailerLite'),
  makeRecord('Kit', 'https://kit.com', '邮件工具', '营销推广', '创业工具', 'Kit 是面向创作者的邮件订阅和受众运营平台，支持自动化和付费内容。', '邮件订阅,创作者,受众,自动化,营销', '部分免费', '英文', '全球', 'Kit'),
  makeRecord('Campaign Monitor', 'https://www.campaignmonitor.com', '邮件工具', '营销推广', '数据分析', 'Campaign Monitor 提供邮件营销、客户旅程和活动分析工具。', '邮件营销,客户旅程,活动分析,营销,订阅', '否', '英文', '全球', 'Campaign Monitor'),
  makeRecord('Mailtrap', 'https://mailtrap.io', '邮件工具', '开发者工具', '网络安全', 'Mailtrap 是面向开发者的邮件测试和发送平台，适合测试通知与事务邮件。', '邮件测试,开发者,事务邮件,发送,测试', '部分免费', '英文', '全球', 'Mailtrap'),
  makeRecord('Spark Mail', 'https://sparkmailapp.com', '邮件工具', '效率办公', '远程办公', 'Spark Mail 是跨平台邮箱客户端，支持团队协作、智能收件箱和邮件管理。', '邮箱客户端,邮件管理,团队协作,收件箱,效率', '部分免费', '多语言', '全球', 'Readdle'),
  makeRecord('HEY', 'https://www.hey.com', '邮件工具', '效率办公', '网络安全', 'HEY 是付费邮箱服务，强调邮件筛选、隐私控制和更清晰的收件箱体验。', '邮箱,付费邮箱,隐私,收件箱,邮件管理', '否', '英文', '全球', '37signals'),
  makeRecord('Migadu', 'https://www.migadu.com', '邮件工具', '域名主机', '效率办公', 'Migadu 提供域名邮箱托管服务，适合个人、团队和小型组织使用。', '域名邮箱,邮箱托管,团队,邮件,办公', '否', '英文', '全球', 'Migadu'),
  makeRecord('Forward Email', 'https://forwardemail.net', '邮件工具', '网络安全', '域名主机', 'Forward Email 提供开源邮件转发和域名邮箱相关服务。', '邮件转发,开源,域名邮箱,隐私,邮箱', '部分免费', '英文', '全球', 'Forward Email'),
  makeRecord('SimpleLogin', 'https://simplelogin.io', '邮件工具', '网络安全', '效率办公', 'SimpleLogin 提供邮箱别名服务，帮助用户隐藏真实邮箱并减少垃圾邮件。', '邮箱别名,隐私,反垃圾邮件,安全,邮件', '部分免费', '英文', '全球', 'Proton'),
  makeRecord('ImprovMX', 'https://improvmx.com', '邮件工具', '域名主机', '效率办公', 'ImprovMX 提供域名邮件转发服务，适合快速配置自定义域名邮箱入口。', '邮件转发,域名邮箱,邮箱,转发,办公', '部分免费', '英文', '全球', 'ImprovMX'),

  makeRecord('Porkbun', 'https://porkbun.com', '域名主机', '云服务', '创业工具', 'Porkbun 是域名注册商，提供域名注册、DNS、SSL 和邮箱相关服务。', '域名,注册商,DNS,SSL,邮箱', '否', '英文', '全球', 'Porkbun'),
  makeRecord('Dynadot', 'https://www.dynadot.com', '域名主机', '云服务', '创业工具', 'Dynadot 提供域名注册、DNS、建站和域名交易相关服务。', '域名,注册商,DNS,建站,交易', '否', '多语言', '全球', 'Dynadot'),
  makeRecord('Gandi', 'https://www.gandi.net', '域名主机', '云服务', '邮件工具', 'Gandi 是域名注册和托管服务商，提供域名、DNS、SSL 和邮箱服务。', '域名,主机,DNS,SSL,邮箱', '否', '多语言', '全球', 'Gandi'),
  makeRecord('GoDaddy', 'https://www.godaddy.com', '域名主机', '云服务', '低代码平台', 'GoDaddy 提供域名注册、网站托管、建站工具和企业邮箱服务。', '域名,主机,建站,邮箱,DNS', '否', '多语言', '全球', 'GoDaddy'),
  makeRecord('Bluehost', 'https://www.bluehost.com', '域名主机', '云服务', '低代码平台', 'Bluehost 是网站托管服务商，提供虚拟主机、WordPress 主机和域名服务。', '主机,WordPress,域名,建站,托管', '否', '英文', '全球', 'Bluehost'),
  makeRecord('Hostinger', 'https://www.hostinger.com', '域名主机', '云服务', '低代码平台', 'Hostinger 提供虚拟主机、云主机、域名和网站构建服务。', '主机,云主机,域名,建站,托管', '否', '多语言', '全球', 'Hostinger'),
  makeRecord('SiteGround', 'https://www.siteground.com', '域名主机', '云服务', '低代码平台', 'SiteGround 提供网站托管、WordPress 主机、域名和企业邮箱服务。', '主机,WordPress,域名,邮箱,托管', '否', '英文', '全球', 'SiteGround'),
  makeRecord('DreamHost', 'https://www.dreamhost.com', '域名主机', '云服务', '低代码平台', 'DreamHost 提供网站托管、WordPress 主机、VPS、云服务和域名注册。', '主机,WordPress,VPS,云服务,域名', '否', '英文', '全球', 'DreamHost'),
  makeRecord('Kinsta', 'https://kinsta.com', '域名主机', '云服务', '开发者工具', 'Kinsta 提供托管式 WordPress、应用和数据库托管服务。', 'WordPress,应用托管,数据库,云服务,主机', '否', '多语言', '全球', 'Kinsta'),
  makeRecord('WP Engine', 'https://wpengine.com', '域名主机', '云服务', '开发者工具', 'WP Engine 是托管式 WordPress 平台，提供网站托管、安全和性能服务。', 'WordPress,托管,性能,安全,主机', '否', '英文', '全球', 'WP Engine'),
  makeRecord('Netlify', 'https://www.netlify.com', '域名主机', '云服务', '开发者工具', 'Netlify 是现代网站部署和托管平台，支持静态站、前端应用和边缘函数。', '部署,托管,静态站,前端,云服务', '部分免费', '英文', '全球', 'Netlify'),
  makeRecord('Fly.io', 'https://fly.io', '域名主机', '云服务', '开发者工具', 'Fly.io 是应用部署平台，帮助开发者把服务部署到全球边缘节点。', '应用部署,边缘计算,云服务,开发者,托管', '部分免费', '英文', '全球', 'Fly.io'),
  makeRecord('Render', 'https://render.com', '域名主机', '云服务', '开发者工具', 'Render 提供应用、静态站、数据库和后台服务的云托管平台。', '托管,应用部署,数据库,静态站,云服务', '部分免费', '英文', '全球', 'Render'),
  makeRecord('Railway', 'https://railway.com', '域名主机', '云服务', '开发者工具', 'Railway 是开发者云平台，支持快速部署应用、数据库和后台服务。', '云服务,应用部署,数据库,开发者,托管', '部分免费', '英文', '全球', 'Railway'),
  makeRecord('Heroku', 'https://www.heroku.com', '域名主机', '云服务', '开发者工具', 'Heroku 是应用平台即服务，支持快速部署和管理 Web 应用。', 'PaaS,应用部署,云服务,开发者,托管', '否', '英文', '全球', 'Salesforce'),
  makeRecord('Linode', 'https://www.linode.com', '域名主机', '云服务', '开发者工具', 'Linode 提供云服务器、对象存储、Kubernetes 和开发者基础设施服务。', '云服务器,VPS,Kubernetes,对象存储,托管', '否', '英文', '全球', 'Akamai'),
  makeRecord('Hetzner', 'https://www.hetzner.com', '域名主机', '云服务', '开发者工具', 'Hetzner 提供云服务器、独立服务器、托管和数据中心服务。', '云服务器,独立服务器,VPS,数据中心,托管', '否', '英文', '欧洲', 'Hetzner'),
  makeRecord('OVHcloud', 'https://www.ovhcloud.com', '域名主机', '云服务', '开发者工具', 'OVHcloud 提供云服务器、独立服务器、托管、域名和企业云服务。', '云服务,服务器,域名,托管,企业', '否', '多语言', '全球', 'OVHcloud'),
  makeRecord('Vultr', 'https://www.vultr.com', '域名主机', '云服务', '开发者工具', 'Vultr 提供云服务器、裸金属、对象存储和全球部署基础设施。', '云服务器,VPS,裸金属,对象存储,部署', '否', '英文', '全球', 'Vultr'),
  makeRecord('IONOS', 'https://www.ionos.com', '域名主机', '云服务', '低代码平台', 'IONOS 提供域名、网站托管、云服务器、邮箱和建站服务。', '域名,主机,云服务器,邮箱,建站', '否', '多语言', '全球', 'IONOS'),

  makeRecord('Startpage', 'https://www.startpage.com', '搜索引擎', '网络安全', '生活服务', 'Startpage 是重视隐私的搜索引擎，提供网页搜索并减少用户追踪。', '搜索,隐私,网页搜索,安全,检索', '是', '多语言', '全球', 'Startpage'),
  makeRecord('Ecosia', 'https://www.ecosia.org', '搜索引擎', '生活服务', '新闻资讯', 'Ecosia 是搜索引擎服务，强调通过搜索收入支持植树项目。', '搜索,环保,网页搜索,公益,检索', '是', '多语言', '全球', 'Ecosia'),
  makeRecord('Qwant', 'https://www.qwant.com', '搜索引擎', '网络安全', '生活服务', 'Qwant 是欧洲搜索引擎，强调隐私保护和非追踪搜索体验。', '搜索,隐私,欧洲,网页搜索,安全', '是', '多语言', '全球', 'Qwant'),
  makeRecord('Mojeek', 'https://www.mojeek.com', '搜索引擎', '网络安全', '生活服务', 'Mojeek 是独立搜索引擎，使用自有索引并强调隐私保护。', '搜索,独立索引,隐私,网页搜索,检索', '是', '英文', '全球', 'Mojeek'),
  makeRecord('Swisscows', 'https://swisscows.com', '搜索引擎', '网络安全', '生活服务', 'Swisscows 是隐私导向搜索引擎，强调家庭友好和数据保护。', '搜索,隐私,家庭友好,网页搜索,安全', '是', '多语言', '全球', 'Swisscows'),
  makeRecord('Kagi', 'https://kagi.com', '搜索引擎', '效率办公', '网络安全', 'Kagi 是付费搜索引擎，强调无广告、可定制和高质量搜索结果。', '搜索,付费搜索,无广告,隐私,检索', '否', '英文', '全球', 'Kagi'),
  makeRecord('WolframAlpha', 'https://www.wolframalpha.com', '搜索引擎', '学习教育', '数据分析', 'WolframAlpha 是计算知识引擎，适合查询数学、科学和结构化知识结果。', '搜索,计算,知识引擎,数学,数据', '部分免费', '英文', '全球', 'Wolfram'),
  makeRecord('Baidu', 'https://www.baidu.com', '搜索引擎', '生活服务', '新闻资讯', '百度是中文搜索引擎，提供网页、图片、新闻、地图和多类信息检索。', '搜索,中文,网页,新闻,地图', '是', '中文', '中国', 'Baidu'),
  makeRecord('Naver', 'https://www.naver.com', '搜索引擎', '新闻资讯', '生活服务', 'Naver 是韩国综合门户和搜索引擎，提供搜索、新闻、地图和社区服务。', '搜索,韩国,门户,新闻,地图', '是', '韩文', '韩国', 'Naver'),

  makeRecord('NHS', 'https://www.nhs.uk', '健康医疗', '学习教育', '生活服务', 'NHS 官网提供英国公共医疗服务信息、疾病说明、健康建议和就医指引。', '健康,医疗,疾病,公共服务,就医', '是', '英文', '英国', 'NHS'),
  makeRecord('CDC', 'https://www.cdc.gov', '健康医疗', '学习教育', '新闻资讯', 'CDC 官网提供疾病防控、公共卫生、疫苗和健康安全相关信息。', '公共卫生,疾病防控,健康,疫苗,安全', '是', '英文', '美国', 'CDC'),
  makeRecord('WHO', 'https://www.who.int', '健康医疗', '新闻资讯', '学习教育', 'WHO 官网提供全球公共卫生、疾病、政策和健康专题信息。', '健康,公共卫生,疾病,政策,全球', '是', '多语言', '全球', 'WHO'),
  makeRecord('Cleveland Clinic', 'https://my.clevelandclinic.org', '健康医疗', '学习教育', '生活服务', 'Cleveland Clinic 提供疾病、症状、治疗和健康生活相关科普信息。', '健康,疾病,症状,治疗,科普', '是', '英文', '全球', 'Cleveland Clinic'),
  makeRecord('Healthline', 'https://www.healthline.com', '健康医疗', '生活服务', '学习教育', 'Healthline 提供健康、营养、疾病和生活方式相关科普信息。', '健康,营养,疾病,生活方式,科普', '是', '英文', '全球', 'Healthline'),
  makeRecord('Verywell Health', 'https://www.verywellhealth.com', '健康医疗', '生活服务', '学习教育', 'Verywell Health 提供健康主题、疾病解释和日常健康管理文章。', '健康,疾病,生活,科普,管理', '是', '英文', '美国', 'Dotdash Meredith'),
  makeRecord('Drugs.com', 'https://www.drugs.com', '健康医疗', '学习教育', '生活服务', 'Drugs.com 提供药品信息、相互作用查询和用药资料参考。', '药品,用药,相互作用,健康,查询', '是', '英文', '全球', 'Drugs.com'),
  makeRecord('PubMed', 'https://pubmed.ncbi.nlm.nih.gov', '健康医疗', '学习教育', '数据分析', 'PubMed 是生物医学文献检索平台，适合查询医学论文和研究摘要。', '医学文献,论文,研究,PubMed,检索', '是', '英文', '全球', 'NLM'),
  makeRecord('FDA', 'https://www.fda.gov', '健康医疗', '新闻资讯', '学习教育', 'FDA 官网提供药品、食品、医疗器械和公共健康监管信息。', '药品,食品,医疗器械,监管,健康', '是', '英文', '美国', 'FDA'),
  makeRecord('Health.gov', 'https://health.gov', '健康医疗', '学习教育', '生活服务', 'Health.gov 提供美国官方健康指南、预防建议和健康政策信息。', '健康指南,预防,政策,官方,健康', '是', '英文', '美国', 'HHS'),
  makeRecord('Nutrition.gov', 'https://www.nutrition.gov', '健康医疗', '学习教育', '生活服务', 'Nutrition.gov 提供营养、饮食、食品安全和健康生活资料。', '营养,饮食,食品安全,健康,生活', '是', '英文', '美国', 'USDA'),
  makeRecord('KidsHealth', 'https://kidshealth.org', '健康医疗', '学习教育', '生活服务', 'KidsHealth 提供儿童、青少年和家长可读的健康教育内容。', '儿童健康,青少年,家长,健康教育,科普', '是', '英文', '全球', 'Nemours'),
];

// 读取当前 CSV 并转成对象数组。
function readRows() {
  return parse(fs.readFileSync(CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

// 对自动采集时被泛化分类的站点做定向纠偏，保证小型代码协作平台进入正确分类。
function applyCategoryOverrides(rows) {
  for (const row of rows) {
    let domain = '';
    try {
      domain = normalizeDomain(new URL(row.url).hostname);
    } catch {
      continue;
    }
    const override = CATEGORY_OVERRIDES.get(domain);
    if (!override) continue;
    [row.category_1, row.category_2, row.category_3] = override;
  }
}

// 将现有记录索引化，便于手动补充时去重。
function buildIndexes(rows) {
  const seedDomains = extractSeedDomains(SEED_FILES);
  const domains = new Set();
  const names = new Set();
  const slugs = new Set();

  for (const row of rows) {
    try {
      domains.add(normalizeDomain(new URL(row.url).hostname));
    } catch {
      // 非法 URL 会在后续导入脚本中暴露，这里只防止脚本中断。
    }
    names.add(row.name.toLowerCase());
    slugs.add(generateSlug(row.name));
  }

  return { seedDomains, domains, names, slugs };
}

// 判断手动候选是否可追加，避免与 seed、当前 CSV 或其他手动记录重复。
function canAppend(row, indexes) {
  if (!row.url.startsWith('https://')) return false;
  const domain = normalizeDomain(new URL(row.url).hostname);
  const name = row.name.toLowerCase();
  const slug = generateSlug(row.name);
  if (indexes.seedDomains.has(domain) || indexes.domains.has(domain) || indexes.names.has(name) || indexes.slugs.has(slug)) {
    return false;
  }
  indexes.domains.add(domain);
  indexes.names.add(name);
  indexes.slugs.add(slug);
  return true;
}

// 统计所有分类字段的关联数量，用于保证薄弱分类不被裁掉。
function countAnyCategories(rows) {
  const counts = {};
  for (const row of rows) {
    for (const field of ['category_1', 'category_2', 'category_3']) {
      if (!row[field]) continue;
      counts[row[field]] = (counts[row[field]] || 0) + 1;
    }
  }
  return counts;
}

// 判断删除某条记录后是否仍满足每个分类的最低关联数量。
function canRemove(row, counts) {
  for (const field of ['category_1', 'category_2', 'category_3']) {
    const category = row[field];
    if (!category) continue;
    if ((counts[category] || 0) <= MIN_ANY_CATEGORY_COUNT) return false;
  }
  return true;
}

// 移除记录并同步扣减分类计数。
function removeAt(rows, index, counts) {
  const [removed] = rows.splice(index, 1);
  for (const field of ['category_1', 'category_2', 'category_3']) {
    const category = removed[field];
    if (category) counts[category] -= 1;
  }
}

// 主流程：补强薄弱分类后，从过量分类中裁剪回目标数量。
function main() {
  const rows = readRows();
  applyCategoryOverrides(rows);
  const indexes = buildIndexes(rows);

  let appended = 0;
  for (const record of MANUAL_RECORDS) {
    if (canAppend(record, indexes)) {
      rows.push(record);
      appended += 1;
    }
  }

  const counts = countAnyCategories(rows);
  let index = PROTECTED_FIRST_ROWS;
  while (rows.length > TARGET_TOTAL && index < rows.length) {
    const row = rows[index];
    if (OVERFLOW_PRIMARY_CATEGORIES.has(row.category_1) && canRemove(row, counts)) {
      removeAt(rows, index, counts);
      continue;
    }
    index += 1;
  }

  index = PROTECTED_FIRST_ROWS;
  while (rows.length > TARGET_TOTAL && index < rows.length) {
    if (canRemove(rows[index], counts)) {
      removeAt(rows, index, counts);
      continue;
    }
    index += 1;
  }

  if (rows.length !== TARGET_TOTAL) {
    throw new Error(`分类补强后无法裁剪到 ${TARGET_TOTAL} 条，当前 ${rows.length} 条`);
  }

  fs.writeFileSync(CSV_PATH, toCsv(rows), 'utf8');
  console.log(`分类补强完成：追加 ${appended} 条候选，最终 ${rows.length} 条。`);
}

main();

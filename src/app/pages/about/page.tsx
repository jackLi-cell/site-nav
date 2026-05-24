import type { Metadata } from 'next';
import { SITE_NAME, getSitePageUrl, getSiteUrl } from '@/lib/site';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: '关于我们 - 网站收录导航平台介绍',
  description:
    '网站收录导航是一个面向中文用户的网站分类导航平台，前台和后台运行在同一个 Next.js 应用中，数据存放在自建 MySQL 中，支持分类浏览、关键词搜索和用户投稿审核。',
  alternates: {
    canonical: getSitePageUrl('/pages/about'),
  },
  openGraph: {
    title: '关于我们 - 网站收录导航平台介绍',
    description:
      '了解网站收录导航平台的定位、内容来源、审核机制和服务宗旨。',
    url: getSitePageUrl('/pages/about'),
    type: 'website',
  },
};

export default function AboutPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl,
    description:
      '面向中文用户的网站分类导航平台，收录全网优质网站资源，覆盖 30+ 大分类。',
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
      contactPoint: {
        '@type': 'ContactPoint',
        email: '1055567003@qq.com',
        contactType: 'customer service',
        availableLanguage: 'Chinese',
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">关于网站收录导航</h1>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">平台简介</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            网站收录导航是一个面向中文互联网用户的网站分类导航平台。我们致力于为用户提供一个高效、清晰、可信赖的网址发现入口，帮助用户快速找到各领域的优质网站资源。
          </p>
          <p className="text-gray-700 leading-relaxed">
            平台覆盖 AI 工具、开发者工具、设计资源、效率办公、社交媒体、影音娱乐、电商购物、教育学习、金融理财、生活服务等 30 余个大分类和 35 个子分类，持续更新和扩充收录内容。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">内容来源与审核</h2>
          <p className="text-gray-700 leading-relaxed mb-4">本站收录的网站来源包括：</p>
          <ul className="list-disc pl-5 text-gray-700 space-y-2 mb-4">
            <li>编辑团队主动发现和整理的优质网站</li>
            <li>注册用户通过投稿功能推荐的网站</li>
          </ul>
          <p className="text-gray-700 leading-relaxed">
            所有收录内容均经过人工审核，审核标准包括但不限于：网站可正常访问、内容合法合规、无恶意软件或欺诈行为、具有实际使用价值。审核通过后方可在目录中展示。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">核心功能</h2>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li><strong>分类浏览</strong> - 按两层分类体系（大分类 + 子分类）组织网站目录，结构清晰</li>
            <li><strong>关键词搜索</strong> - 支持按网站名称、描述、标签进行全文搜索</li>
            <li><strong>用户投稿</strong> - 注册用户可推荐优质网站，经审核后收录</li>
            <li><strong>热度排序</strong> - 基于出站点击统计，展示热门网站</li>
            <li><strong>出站跳转</strong> - 点击即可直达目标网站</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">技术架构</h2>
          <p className="text-gray-700 leading-relaxed">
            本站基于 Next.js 构建，前后台共用同一个应用。公开站点部署在 VPS 上，通过 Nginx 反向代理对外提供访问；网站、用户、投稿、审核和点击统计数据存储在自建 MySQL 中。这一架构便于我们直接维护数据库和后台逻辑，也方便后续在海内外服务器上分别部署。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">服务宗旨</h2>
          <p className="text-gray-700 leading-relaxed">
            我们的目标是打造一个干净、实用、无广告干扰的网站导航平台，让用户能够高效地发现和访问互联网上的优质资源。我们不参与任何收录网站的运营，不对收录网站的服务质量做担保，仅提供信息索引和导航服务。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">联系我们</h2>
          <p className="text-gray-700 leading-relaxed">
            如有合作咨询、内容反馈或其他问题，请通过邮箱联系：
            <a
              href="mailto:1055567003@qq.com"
              className="text-blue-600 hover:text-blue-800 underline ml-1"
            >
              1055567003@qq.com
            </a>
          </p>
        </section>
      </article>
    </>
  );
}

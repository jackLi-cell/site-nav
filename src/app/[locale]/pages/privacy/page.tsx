import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SITE_NAME, getSeoUrls, getSiteUrlFromHeaders } from '@/lib/site';
import type { Locale } from '@/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const headersList = await headers();
  const publicUrl = getSiteUrlFromHeaders(headersList);
  const seoUrls = getSeoUrls(`/${locale}/pages/privacy`, publicUrl);
  const isEn = locale === 'en';
  const title = isEn ? 'Privacy Policy - Data Collection and Protection' : '隐私政策 - 个人信息收集与保护说明';
  const description = isEn
    ? 'Site Directory privacy policy: how account email, session cookies, submissions, click statistics, and server logs are collected, used, stored, and protected.'
    : '网站收录导航隐私政策：说明本站如何收集、使用、存储和保护注册邮箱、会话 Cookie、投稿数据、点击去重信息和服务器日志。';

  return {
    title,
    description,
    alternates: {
      canonical: seoUrls.canonical,
      languages: seoUrls.languages,
    },
    openGraph: {
      title,
      description,
      url: seoUrls.canonical,
      type: 'website',
    },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const headersList = await headers();
  const publicUrl = getSiteUrlFromHeaders(headersList);
  const pageUrl = getSeoUrls(`/${locale}/pages/privacy`, publicUrl).canonical;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: '隐私政策 - 网站收录导航',
    url: pageUrl,
    description: '网站收录导航平台的隐私政策和个人信息保护说明。',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: publicUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">隐私政策</h1>
        <p className="text-sm text-gray-500 mb-8">最后更新：2026 年 5 月 22 日</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">概述</h2>
          <p className="text-gray-700 leading-relaxed">
            网站收录导航（以下简称“本站”）重视用户隐私保护。本隐私政策说明我们在你使用本站服务时如何收集、使用、存储和保护你的个人信息。本站公开页面和后台逻辑运行在 VPS 上，核心业务数据存放在自建 MySQL 中。使用本站即表示你已阅读并理解本政策内容。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">一、信息收集范围</h2>
          <p className="text-gray-700 leading-relaxed mb-3">本站在以下场景收集信息：</p>

          <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">1.1 账号注册</h3>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>电子邮箱地址（用于账号标识和登录验证）</li>
            <li>密码（经哈希算法处理后存储，不保存明文）</li>
            <li>用户名、角色和创建时间等基础账号信息</li>
          </ul>

          <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">1.2 登录与会话</h3>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>会话 ID Cookie，用于维持登录状态</li>
            <li>会话过期时间、刷新时间和登出记录</li>
          </ul>

          <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">1.3 用户投稿</h3>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>你主动填写的网站名称、网址、简介、分类等投稿信息</li>
            <li>投稿时间和关联的账号信息</li>
            <li>审核状态、拒绝原因和审核备注</li>
          </ul>

          <h3 className="text-base font-medium text-gray-800 mt-4 mb-2">1.4 站点使用与安全信息</h3>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>出站点击记录：当你点击收录网站外链时，系统记录点击事件并使用 IP 地址哈希和 UA 哈希进行去重统计，不在业务数据库中保存明文 IP</li>
            <li>服务器访问日志：VPS/Nginx 可能会记录访问时间、请求路径、状态码、来源地址和用户代理，用于安全和故障排查</li>
            <li>必要的人机验证数据：如果启用人机验证，验证 token 会发送给验证服务商进行校验</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">二、信息使用目的</h2>
          <p className="text-gray-700 leading-relaxed mb-3">我们收集的信息仅用于以下目的：</p>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li><strong>提供服务</strong>：处理账号注册和登录、管理用户投稿和审核流程</li>
            <li><strong>功能运营</strong>：基于匿名点击统计生成网站热度排序</li>
            <li><strong>平台改进</strong>：了解用户使用习惯，优化内容和功能</li>
            <li><strong>安全防护</strong>：识别和防范恶意行为、垃圾投稿和滥用</li>
            <li><strong>沟通联络</strong>：在必要时通过邮箱与你联系（如账号安全通知、内容修正或审核结果）</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">三、Cookie 使用说明</h2>
          <p className="text-gray-700 leading-relaxed mb-3">本站使用以下类型的 Cookie：</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-gray-700 border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left border-b">类型</th>
                  <th className="px-4 py-2 text-left border-b">用途</th>
                  <th className="px-4 py-2 text-left border-b">必要性</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-2">会话 Cookie</td>
                  <td className="px-4 py-2">维持用户登录状态</td>
                  <td className="px-4 py-2">功能必要</td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-2">安全 Cookie</td>
                  <td className="px-4 py-2">用于降低登录劫持和会话伪造风险</td>
                  <td className="px-4 py-2">安全必要</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-700 leading-relaxed mt-3">
            本站不使用广告追踪 Cookie 或第三方营销 Cookie。你可以在浏览器设置中管理或禁用 Cookie，但禁用会话 Cookie 将导致无法使用登录和投稿功能。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">四、信息存储与安全</h2>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li>用户密码使用单向哈希算法存储，任何人（包括管理员）无法还原明文密码</li>
            <li>数据存储于自建 MySQL 数据库，部署在 VPS 或同环境数据库服务中</li>
            <li>网站通过 HTTPS 加密传输所有数据</li>
            <li>不在业务数据库中存储用户明文 IP 地址，仅存储不可逆的 IP 哈希值用于点击去重</li>
            <li>定期审查数据访问权限，仅授权后台角色可访问管理数据</li>
            <li>数据库和文件数据应定期备份，并保留最近可用备份</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">五、信息共享与披露</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            我们不会出售、出租或交易你的个人信息。仅在以下情况下可能共享信息：
          </p>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li><strong>基础设施服务商</strong>：VPS、域名、DNS、对象存储或邮件服务商会在提供服务所需范围内处理必要数据，受其自身隐私政策约束</li>
            <li><strong>法律要求</strong>：在法律法规要求、司法程序或政府主管部门强制要求的情况下</li>
            <li><strong>安全保护</strong>：为防止欺诈、保护本站或用户安全而必须披露的情况</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">六、第三方服务</h2>
          <p className="text-gray-700 leading-relaxed mb-3">本站可能使用以下第三方服务：</p>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li><strong>人机验证服务</strong>：如果站点启用人机验证，token 会发送给验证服务商进行校验</li>
            <li><strong>邮件服务</strong>：如果站点后续启用邮件通知，相关邮箱地址会发送给邮件服务商处理</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            本站不使用 Google Analytics、百度统计或其他第三方追踪分析工具。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">七、外部链接</h2>
          <p className="text-gray-700 leading-relaxed">
            本站收录的网站链接指向第三方网站。当你点击外链离开本站后，你的浏览行为将受目标网站自身的隐私政策管辖。我们建议你在访问任何外部网站时查阅其隐私政策。本站不对第三方网站的隐私实践和数据处理承担责任。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">八、用户权利</h2>
          <p className="text-gray-700 leading-relaxed mb-3">你享有以下权利：</p>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li><strong>访问权</strong>：你可以登录账号查看自己的注册信息和投稿记录</li>
            <li><strong>更正权</strong>：你可以修改自己的账号信息</li>
            <li><strong>删除权</strong>：你可以通过邮件联系我们申请删除账号及关联数据</li>
            <li><strong>撤回同意</strong>：你可以随时停止使用本站服务并申请删除数据</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            如需行使上述权利，请发送邮件至 <a href="mailto:1055567003@qq.com" className="text-blue-600 hover:text-blue-800 underline">1055567003@qq.com</a>，我们将在 15 个工作日内处理你的请求。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">九、未成年人保护</h2>
          <p className="text-gray-700 leading-relaxed">
            本站不面向 14 周岁以下的未成年人提供注册服务。如果我们发现在未经监护人同意的情况下收集了 14 周岁以下未成年人的个人信息，将尽快删除相关数据。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">十、政策更新</h2>
          <p className="text-gray-700 leading-relaxed">
            我们可能不时更新本隐私政策。更新后的政策将在本页面发布，并更新顶部的“最后更新”日期。重大变更时，我们会在网站首页或通过邮件通知注册用户。继续使用本站服务即表示你接受更新后的隐私政策。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">十一、联系方式</h2>
          <p className="text-gray-700 leading-relaxed">
            如对本隐私政策有任何疑问或建议，请联系：
            <a href="mailto:1055567003@qq.com" className="text-blue-600 hover:text-blue-800 underline ml-1">1055567003@qq.com</a>
          </p>
        </section>
      </article>
    </>
  );
}

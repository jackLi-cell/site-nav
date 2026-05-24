import type { Metadata } from 'next';
import { SITE_NAME, getSitePageUrl, getSiteUrl } from '@/lib/site';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: '联系我们 - 反馈与合作咨询',
  description:
    '如需向网站收录导航反馈页面错误、申请收录修正、提交功能建议或商务合作咨询，请通过邮箱 1055567003@qq.com 联系我们，通常 1-3 个工作日内回复。',
  alternates: {
    canonical: getSitePageUrl('/pages/contact'),
  },
  openGraph: {
    title: '联系我们 - 网站收录导航',
    description: '通过邮箱联系网站收录导航团队，反馈问题或咨询合作。',
    url: getSitePageUrl('/pages/contact'),
    type: 'website',
  },
};

export default function ContactPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: `联系我们 - ${SITE_NAME}`,
    url: getSitePageUrl('/pages/contact'),
    mainEntity: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
      email: '1055567003@qq.com',
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">联系我们</h1>

        <section className="mb-8">
          <p className="text-gray-700 leading-relaxed mb-4">
            感谢你使用网站收录导航。如有以下需求，欢迎通过邮箱与我们取得联系：
          </p>

          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">可联系事项</h2>
            <ul className="space-y-3 text-gray-700">
              <li><strong>页面错误反馈</strong> - 发现页面无法访问、显示异常或功能故障</li>
              <li><strong>收录内容修正</strong> - 已收录网站信息有误、链接失效或需要更新</li>
              <li><strong>收录删除请求</strong> - 网站所有者要求移除本站对其网站的收录</li>
              <li><strong>违规内容举报</strong> - 发现收录网站存在违法违规或有害内容</li>
              <li><strong>功能建议</strong> - 对平台功能或体验的改进建议</li>
              <li><strong>合作咨询</strong> - 内容合作、链接修正等咨询</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">联系方式</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-5">
            <p className="text-gray-800 text-base">
              <strong>邮箱：</strong>
              <a
                href="mailto:1055567003@qq.com"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                1055567003@qq.com
              </a>
            </p>
            <p className="text-gray-600 text-sm mt-2">
              我们通常在 1-3 个工作日内回复。如遇节假日可能延迟，请耐心等待。
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">发送邮件建议</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            为了帮助我们更快地处理你的请求，建议在邮件中包含以下信息：
          </p>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li>明确的主题描述，如“收录修正”“功能建议”等</li>
            <li>相关页面的 URL 地址</li>
            <li>问题的具体描述或截图</li>
            <li>你期望的处理结果</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">安全提醒</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-gray-700 leading-relaxed">
              请勿通过邮件发送密码、API 密钥、身份证号、银行卡号、完整合同、财务凭证或其他敏感个人信息。我们不会主动索要此类信息。如收到以本站名义索要敏感信息的邮件，请忽略并向我们举报。
            </p>
          </div>
        </section>
      </article>
    </>
  );
}

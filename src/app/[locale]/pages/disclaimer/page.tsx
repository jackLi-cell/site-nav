import type { Metadata } from 'next';
import { SITE_NAME, getSitePageUrl, getSiteUrl } from '@/lib/site';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: '免责声明 - 内容责任边界与使用须知',
  description:
    '网站收录导航免责声明：说明本站作为网站导航平台的内容责任边界、外部链接风险提示、信息时效性说明和用户使用须知。',
  alternates: {
    canonical: getSitePageUrl('/pages/disclaimer'),
  },
  openGraph: {
    title: '免责声明 - 网站收录导航',
    description: '了解网站收录导航平台的内容责任边界和使用须知。',
    url: getSitePageUrl('/pages/disclaimer'),
    type: 'website',
  },
};

export default function DisclaimerPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `免责声明 - ${SITE_NAME}`,
    url: getSitePageUrl('/pages/disclaimer'),
    description: '网站收录导航平台的免责声明和使用须知。',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">免责声明</h1>
        <p className="text-sm text-gray-500 mb-8">最后更新：2026 年 5 月 22 日</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">一、服务性质</h2>
          <p className="text-gray-700 leading-relaxed">
            网站收录导航（以下简称“本站”）是一个网站分类导航和信息索引平台。本站仅提供网站链接的收录、分类和展示服务，不参与任何收录网站的运营、管理或内容生产。本站提供的所有信息（包括网站名称、简介、分类标签等）仅供参考，不构成任何形式的推荐、背书、担保或专业建议。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">二、外部链接责任</h2>
          <p className="text-gray-700 leading-relaxed mb-3">本站收录的所有网站链接均指向第三方网站。对于这些外部网站：</p>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li>其内容、产品、服务、隐私政策和安全措施由各网站运营方自行负责</li>
            <li>本站不对外部网站的内容准确性、合法性、安全性、可用性或服务质量承担任何责任</li>
            <li>本站不对用户因访问或使用外部网站而产生的任何直接或间接损失承担责任</li>
            <li>收录某网站不代表本站与该网站存在合作、关联或利益关系</li>
            <li>外部网站的内容可能随时变化，本站无法实时监控所有收录网站的内容变动</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">三、信息时效性</h2>
          <p className="text-gray-700 leading-relaxed">
            本站收录的网站信息（包括但不限于网站名称、功能描述、服务范围、价格信息等）基于收录或最后更新时的状态。网站的功能、价格、政策、服务范围和可用性可能随时发生变化，本站无法保证所有收录信息在任何时间点都完全准确和最新。请以各网站官方页面的最新信息为准。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">四、不构成专业建议</h2>
          <p className="text-gray-700 leading-relaxed">
            本站提供的网站收录信息、分类导航和简介描述仅供一般性参考，不构成法律、税务、财务、投资、医疗、技术采购或其他需要专业资质的建议。如需专业建议，请咨询相关领域的持证专业人士。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">五、用户投稿内容</h2>
          <p className="text-gray-700 leading-relaxed">
            用户通过投稿功能提交的网站信息经过人工审核，但本站无法保证投稿信息在审核通过后始终准确，也无法保证被收录网站在任何时间点都安全可靠。如发现收录网站存在问题，请通过联系页面向我们反馈，我们将及时处理。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">六、使用风险</h2>
          <ul className="list-disc pl-5 text-gray-700 space-y-2">
            <li>访问外部网站前应自行判断其安全性和适用性</li>
            <li>在外部网站注册账号、提交个人信息或进行交易前应仔细阅读该网站的服务条款和隐私政策</li>
            <li>对于通过本站链接访问外部网站后产生的任何损失，本站不承担赔偿责任</li>
            <li>本站不对因网络中断、服务器故障或其他不可抗力导致的服务中断承担责任</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">七、知识产权</h2>
          <p className="text-gray-700 leading-relaxed">
            本站的页面设计、代码和原创文字内容受著作权法保护。收录网站的名称、Logo 和商标归各网站所有者所有，本站仅在合理使用范围内展示用于导航识别目的。如有权利人认为本站的展示方式侵犯其合法权益，请联系我们处理。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">八、内容删除与投诉</h2>
          <p className="text-gray-700 leading-relaxed">
            如果你是某网站的所有者或授权代表，认为本站的收录侵犯了你的合法权益，或者你发现收录网站存在违法违规内容，请通过邮箱 <a href="mailto:1055567003@qq.com" className="text-blue-600 hover:text-blue-800 underline">1055567003@qq.com</a> 联系我们，并提供涉及的网站 URL、本站收录页面链接、具体投诉理由和诉求。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">九、免责声明的变更</h2>
          <p className="text-gray-700 leading-relaxed">
            本站保留随时修改本免责声明的权利。修改后的声明将在本页面发布并更新顶部日期。继续使用本站服务即表示你接受修改后的免责声明。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">十、联系方式</h2>
          <p className="text-gray-700 leading-relaxed">
            如对本免责声明有任何疑问，或需要举报违规内容，请联系：
            <a href="mailto:1055567003@qq.com" className="text-blue-600 hover:text-blue-800 underline ml-1">1055567003@qq.com</a>
          </p>
        </section>
      </article>
    </>
  );
}

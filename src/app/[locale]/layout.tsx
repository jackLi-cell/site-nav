import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ClientBody } from '@/components/client-body';
import { getSeoUrls, getSiteUrlFromHeaders } from '@/lib/site';
import { i18n, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';

export async function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = await getDictionary(locale);
  const headersList = await headers();
  const siteUrl = getSiteUrlFromHeaders(headersList);
  const pathname = headersList.get('x-pathname') || `/${locale}`;
  const seoUrls = getSeoUrls(pathname, siteUrl);

  return {
    title: {
      default: `${dict.site.name} - ${dict.site.tagline}`,
      template: `%s | ${dict.site.name}`,
    },
    description: dict.site.description,
    keywords:
      locale === 'zh-CN'
        ? ['网站导航', '网站收录', '网址大全', '网站推荐', '分类导航', 'AI工具', '开发者工具', '设计资源', '效率工具', '在线工具']
        : ['site directory', 'website navigation', 'web resources', 'AI tools', 'developer tools', 'design resources', 'productivity tools', 'online tools'],
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: 'website',
      locale: locale === 'zh-CN' ? 'zh_CN' : 'en_US',
      siteName: dict.site.name,
      title: `${dict.site.name} - ${dict.site.tagline}`,
      description: dict.site.ogDescription,
      url: seoUrls.canonical,
    },
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: seoUrls.canonical,
      types: { 'application/rss+xml': '/feed.xml' },
      languages: seoUrls.languages,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  return (
    <html lang={locale}>
      <body className="bg-gray-50 text-gray-900 text-sm leading-relaxed">
        <ClientBody locale={locale}>{children}</ClientBody>
      </body>
    </html>
  );
}

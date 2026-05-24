import type { Metadata } from 'next';
import './globals.css';
import { ClientBody } from '@/components/client-body';
import { SITE_NAME, getSiteUrl } from '@/lib/site';

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} - 发现优质网站资源`,
    template: `%s | ${SITE_NAME}`,
  },
  description: '精选网站收录与分类导航平台，收录全网优质网站，覆盖 AI 工具、开发者工具、设计资源、效率办公、社交媒体、影音娱乐、电商购物等 30+ 分类。按分类浏览、关键词搜索，快速找到你需要的网站。',
  keywords: ['网站导航', '网站收录', '网址大全', '网站推荐', '分类导航', 'AI工具', '开发者工具', '设计资源', '效率工具', '在线工具'],
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: SITE_NAME,
    title: `${SITE_NAME} - 发现优质网站资源`,
    description: '收录全网优质网站，覆盖 30+ 分类，支持搜索和用户投稿。',
    url: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    types: { 'application/rss+xml': '/feed.xml' },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 text-gray-900 text-sm leading-relaxed">
        <ClientBody>{children}</ClientBody>
      </body>
    </html>
  );
}

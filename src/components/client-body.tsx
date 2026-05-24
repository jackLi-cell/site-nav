'use client';

import Link from 'next/link';
import { RegionProvider, RegionSwitcher } from '@/components/region-switcher';

export function ClientBody({ children }: { children: React.ReactNode }) {
  return (
    <RegionProvider>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <nav className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-900 hover:no-underline">
            网站收录导航
          </Link>
          <div className="flex gap-5 text-sm items-center">
            <Link href="/sites" className="text-gray-600 hover:text-blue-600">全部网站</Link>
            <Link href="/categories" className="text-gray-600 hover:text-blue-600">分类</Link>
            <Link href="/tags" className="text-gray-600 hover:text-blue-600">标签</Link>
            <Link href="/favorites" className="text-gray-600 hover:text-blue-600">收藏</Link>
            <Link href="/submit" className="text-gray-600 hover:text-blue-600">投稿</Link>
            <RegionSwitcher />
          </div>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-5 py-8 min-h-[calc(100vh-180px)]">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 mt-12 py-6 px-5">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center gap-5 mb-3">
            <Link href="/pages/about" className="text-gray-500 text-xs hover:text-blue-600">关于</Link>
            <Link href="/pages/contact" className="text-gray-500 text-xs hover:text-blue-600">联系</Link>
            <Link href="/pages/privacy" className="text-gray-500 text-xs hover:text-blue-600">隐私政策</Link>
            <Link href="/pages/disclaimer" className="text-gray-500 text-xs hover:text-blue-600">免责声明</Link>
            <Link href="/feed.xml" className="text-gray-500 text-xs hover:text-blue-600">RSS</Link>
          </div>
          <p className="text-gray-400 text-xs">联系邮箱：1055567003@qq.com</p>
        </div>
      </footer>
    </RegionProvider>
  );
}

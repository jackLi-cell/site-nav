'use client';

import Link from 'next/link';
import { useDictionary } from '@/i18n/dictionary-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useDictionary();
  const prefix = `/${locale}`;

  return (
    <div className="flex gap-6">
      <aside className="w-48 shrink-0">
        <nav className="sticky top-20 space-y-1">
          <Link href={`${prefix}/admin`} className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">概览</Link>
          <Link href={`${prefix}/admin/sites`} className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">网站管理</Link>
          <Link href={`${prefix}/admin/submissions`} className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">投稿审核</Link>
          <Link href={`${prefix}/admin/categories`} className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">分类管理</Link>
          <Link href={`${prefix}/admin/keywords`} className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">关键词管理</Link>
          <Link href={`${prefix}/admin/audit`} className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">审核日志</Link>
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

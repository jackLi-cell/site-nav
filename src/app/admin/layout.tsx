import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <aside className="w-48 shrink-0">
        <nav className="sticky top-20 space-y-1">
          <Link href="/admin" className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">概览</Link>
          <Link href="/admin/sites" className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">网站管理</Link>
          <Link href="/admin/submissions" className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">投稿审核</Link>
          <Link href="/admin/categories" className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">分类管理</Link>
          <Link href="/admin/keywords" className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">关键词管理</Link>
          <Link href="/admin/audit" className="block px-3 py-2 text-sm text-gray-700 rounded hover:bg-gray-100">审核日志</Link>
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

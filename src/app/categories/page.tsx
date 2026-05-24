'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export default function CategoriesIndexPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(json => {
        setCats(json.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">分类浏览</h1>
      <p className="text-gray-600 mb-6">选择一个分类，浏览该类别下的网站。</p>
      {loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : cats.length === 0 ? (
        <p className="text-gray-500">暂无分类</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {cats.map(cat => (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className="block p-4 bg-white border border-gray-200 rounded-md hover:border-blue-300 hover:no-underline"
            >
              <span className="font-medium text-gray-900">{cat.name}</span>
              {cat.description && <p className="text-xs text-gray-500 mt-1">{cat.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

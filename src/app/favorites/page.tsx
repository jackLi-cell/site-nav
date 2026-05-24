'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Fav {
  slug: string;
  name: string;
  addedAt: number;
}

export default function FavoritesPage() {
  const [favs, setFavs] = useState<Fav[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('site-nav-favorites') || '[]');
    setFavs(stored);
    setLoaded(true);
  }, []);

  const remove = (slug: string) => {
    const updated = favs.filter(f => f.slug !== slug);
    setFavs(updated);
    localStorage.setItem('site-nav-favorites', JSON.stringify(updated));
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">我的收藏</h1>
      <p className="text-gray-600 mb-6">收藏保存在浏览器本地，清除浏览器数据后将丢失。</p>
      {!loaded ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : favs.length === 0 ? (
        <p className="text-gray-500">
          暂无收藏。浏览网站时点击 ♡ 即可收藏。
        </p>
      ) : (
        <div className="space-y-3">
          {favs.map(fav => (
            <div key={fav.slug} className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between">
              <Link href={`/sites/${fav.slug}`} className="font-medium text-gray-900 hover:text-blue-600">{fav.name}</Link>
              <div className="flex items-center gap-3">
                <a href={`/out/${fav.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600">访问 →</a>
                <button onClick={() => remove(fav.slug)} className="text-xs text-red-500 hover:text-red-700">移除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

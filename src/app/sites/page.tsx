'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRegion } from '@/components/region-switcher';

interface Site {
  id: string;
  name: string;
  slug: string;
  url: string;
  shortSummary?: string;
  viewCount: number;
}

export default function SitesPage() {
  const { region } = useRegion();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sites?region=${region}&limit=50`)
      .then(r => r.json())
      .then(json => {
        setSites(json.data || []);
        setTotal(json.pagination?.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [region]);

  const toggleFav = (slug: string, name: string) => {
    const key = 'site-nav-favorites';
    const favs = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = favs.findIndex((f: any) => f.slug === slug);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push({ slug, name, addedAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(favs));
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">全部网站</h1>
      <p className="text-gray-600 mb-6">
        {region === 'china' ? '中国' : '海外'}：共收录 {total} 个网站，按热度排序。
      </p>
      {loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : sites.length === 0 ? (
        <p className="text-gray-500">该区域暂无收录网站</p>
      ) : (
        <div className="space-y-3">
          {sites.map(site => (
            <div key={site.slug} className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <Link href={`/sites/${site.slug}`} className="font-medium text-gray-900 hover:text-blue-600">
                  {site.name}
                </Link>
                <p className="text-gray-500 text-xs mt-1 truncate">{site.shortSummary}</p>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                <span className="text-xs text-gray-400">{site.viewCount} 点击</span>
                <button onClick={() => toggleFav(site.slug, site.name)} className="text-xs text-gray-400 hover:text-red-500" title="收藏">♡</button>
                <a href={`/out/${site.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600">访问 →</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

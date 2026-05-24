'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRegion } from '@/components/region-switcher';

interface Site {
  id: string;
  name: string;
  slug: string;
  shortSummary?: string;
  viewCount: number;
}

function SearchContent() {
  const params = useSearchParams();
  const { region } = useRegion();
  const q = params.get('q') || '';
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [inputQ, setInputQ] = useState(q);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}&region=${region}`)
      .then(r => r.json())
      .then(json => {
        setSites(json.data || []);
        setTotal(json.pagination?.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [q, region]);

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">搜索结果</h1>
      <form action="/search" method="get" className="flex gap-2 max-w-md mb-6">
        <input
          type="text"
          name="q"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          placeholder="搜索网站名称或关键词..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
        />
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">搜索</button>
      </form>

      {!q ? (
        <p className="text-gray-400 text-sm">输入关键词开始搜索</p>
      ) : loading ? (
        <p className="text-gray-400 text-sm">搜索中...</p>
      ) : sites.length === 0 ? (
        <p className="text-gray-500">在 {region === 'china' ? '中国' : '海外'} 区域未找到匹配的网站，试试切换区域或其他关键词。</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">{region === 'china' ? '中国' : '海外'} · 找到 {total} 个结果</p>
          <div className="space-y-3">
            {sites.map(site => (
              <div key={site.slug} className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <Link href={`/sites/${site.slug}`} className="font-medium text-gray-900 hover:text-blue-600">{site.name}</Link>
                  <p className="text-gray-500 text-xs mt-1 truncate">{site.shortSummary}</p>
                </div>
                <div className="flex items-center gap-4 ml-4 shrink-0">
                  <span className="text-xs text-gray-400">{site.viewCount} 点击</span>
                  <a href={`/out/${site.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600">访问 →</a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm">加载中...</p>}>
      <SearchContent />
    </Suspense>
  );
}

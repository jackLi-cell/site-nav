'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRegion } from '@/components/region-switcher';

interface Site {
  id: string;
  name: string;
  slug: string;
  shortSummary?: string;
  viewCount: number;
}

interface Category {
  name?: string;
  slug?: string;
  description?: string;
}

export default function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { region } = useRegion();
  const [tab, setTab] = useState<'default' | 'latest' | 'weekly'>('default');
  const [cat, setCat] = useState<Category>({});
  const [sites, setSites] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/categories/${slug}/sites?region=${region}&tab=${tab}&limit=50`)
      .then(r => r.json())
      .then(json => {
        setCat(json.category || {});
        setSites(json.data || []);
        setTotal(json.pagination?.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, tab, region]);

  const tabBtn = (val: 'default' | 'latest' | 'weekly', label: string) => (
    <button
      onClick={() => setTab(val)}
      className={`px-3 py-1 rounded text-sm ${tab === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="hover:text-blue-600">首页</Link>
        <span className="mx-1">/</span>
        <Link href="/categories" className="hover:text-blue-600">分类</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">{cat.name || slug}</span>
      </nav>
      <h1 className="text-2xl font-bold mb-2">{cat.name || slug} 网站推荐</h1>
      <p className="text-gray-600 mb-4">
        {region === 'china' ? '中国' : '海外'} · 共 {total} 个{cat.description ? ` · ${cat.description}` : ''}
      </p>

      <div className="flex gap-2 mb-6">
        {tabBtn('default', '默认排序')}
        {tabBtn('latest', '最新收录')}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">加载中...</p>
      ) : sites.length === 0 ? (
        <p className="text-gray-500">该分类暂无网站</p>
      ) : (
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
      )}
    </>
  );
}

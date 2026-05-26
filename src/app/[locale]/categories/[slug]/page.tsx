'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRegion } from '@/components/region-switcher';
import { useDictionary } from '@/i18n/dictionary-context';

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
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
  const [tab, setTab] = useState<'default' | 'latest' | 'weekly'>('default');
  const [cat, setCat] = useState<Category>({});
  const [sites, setSites] = useState<Site[]>([]);
  const [total, setTotal] = useState(0);
  const [regionFallback, setRegionFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/categories/${slug}/sites?region=${region}&tab=${tab}&limit=50`)
      .then(r => r.json())
      .then(json => {
        setCat(json.category || {});
        setSites(json.data || []);
        setTotal(json.pagination?.total || 0);
        setRegionFallback(Boolean(json.regionFallback));
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
        <Link href={prefix} className="hover:text-blue-600">{dict.nav.home}</Link>
        <span className="mx-1">/</span>
        <Link href={`${prefix}/categories`} className="hover:text-blue-600">{dict.nav.categories}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">{cat.name || slug}</span>
      </nav>
      <h1 className="text-2xl font-bold mb-2">{cat.name || slug}</h1>
      <p className="text-gray-600 mb-4">
        {region === 'china' ? dict.region.china : dict.region.overseas} · {total} {dict.home.sites}{cat.description ? ` · ${cat.description}` : ''}
      </p>
      {regionFallback && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
          {dict.home.regionFallback}
        </p>
      )}

      <div className="flex gap-2 mb-6">
        {tabBtn('default', dict.home.sortDefault)}
        {tabBtn('latest', dict.home.sortLatest)}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">{dict.home.loading}</p>
      ) : sites.length === 0 ? (
        <p className="text-gray-500">{dict.home.noSites}</p>
      ) : (
        <div className="space-y-3">
          {sites.map(site => (
            <div key={site.slug} className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <Link href={`${prefix}/sites/${site.slug}`} className="font-medium text-gray-900 hover:text-blue-600">{site.name}</Link>
                <p className="text-gray-500 text-xs mt-1 truncate">{site.shortSummary}</p>
              </div>
              <div className="flex items-center gap-4 ml-4 shrink-0">
                <span className="text-xs text-gray-400">{site.viewCount} {dict.home.visits}</span>
                <a href={`/out/${site.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600">{dict.home.visit} →</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

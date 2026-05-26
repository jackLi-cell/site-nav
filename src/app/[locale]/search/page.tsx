'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRegion } from '@/components/region-switcher';
import { useDictionary } from '@/i18n/dictionary-context';

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
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
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
      <h1 className="text-2xl font-bold mb-2">{dict.search.title}</h1>
      <form action={`${prefix}/search`} method="get" className="flex gap-2 max-w-md mb-6">
        <input
          type="text"
          name="q"
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          placeholder={dict.search.placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
        />
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">{dict.home.search}</button>
      </form>

      {!q ? (
        <p className="text-gray-400 text-sm">{dict.search.placeholder}</p>
      ) : loading ? (
        <p className="text-gray-400 text-sm">{dict.home.loading}</p>
      ) : sites.length === 0 ? (
        <p className="text-gray-500">{dict.search.noResults}</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {region === 'china' ? dict.region.china : dict.region.overseas} · {dict.search.results.replace('{count}', String(total))}
          </p>
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
        </>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-gray-400 text-sm">...</p>}>
      <SearchContent />
    </Suspense>
  );
}

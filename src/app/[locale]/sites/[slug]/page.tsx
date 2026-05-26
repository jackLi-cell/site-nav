'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/i18n/dictionary-context';

interface Site {
  id: string;
  name: string;
  slug: string;
  url: string;
  shortSummary?: string;
  fullDescription?: string;
  viewCount: number;
  normalizedDomain?: string;
  createdAt?: string;
  status?: string;
  categories?: any[];
  keywords?: any[];
}

export default function SiteDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
  const [site, setSite] = useState<Site | null>(null);
  const [similar, setSimilar] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/sites/${slug}`).then(r => r.json()),
      fetch(`/api/sites/${slug}/similar`).then(r => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([detail, sim]) => {
        if (!detail.data) {
          setNotFound(true);
        } else {
          setSite(detail.data);
          setSimilar(sim.data || []);
        }
        setLoading(false);
      })
      .catch(() => { setLoading(false); setNotFound(true); });
  }, [slug]);

  const toggleFav = () => {
    if (!site) return;
    const key = 'site-nav-favorites';
    const favs = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = favs.findIndex((f: any) => f.slug === site.slug);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push({ slug: site.slug, name: site.name, addedAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(favs));
  };

  if (loading) return <p className="text-gray-400 text-sm">{dict.home.loading}</p>;
  if (notFound || !site) return <p className="text-red-500">Not found</p>;

  return (
    <div className="max-w-3xl">
      <nav className="text-xs text-gray-500 mb-4">
        <Link href={prefix} className="hover:text-blue-600">{dict.nav.home}</Link>
        <span className="mx-1">/</span>
        <Link href={`${prefix}/sites`} className="hover:text-blue-600">{dict.nav.allSites}</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">{site.name}</span>
      </nav>
      <h1 className="text-2xl font-bold mb-2">{site.name}</h1>
      <p className="text-gray-600 mb-4">{site.shortSummary}</p>

      {site.categories && site.categories.length > 0 && (
        <div className="mb-2">
          {site.categories.map((c: any) => (
            <Link key={c.slug} href={`${prefix}/categories/${c.slug}`} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs mr-1 mb-1">{c.name}</Link>
          ))}
        </div>
      )}

      {site.keywords && site.keywords.length > 0 && (
        <div className="mb-4">
          {site.keywords.map((k: any) => (
            <Link key={k.name} href={`${prefix}/search?q=${encodeURIComponent(k.name)}`} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs mr-1 mb-1">{k.name}</Link>
          ))}
        </div>
      )}

      {site.fullDescription && (
        <div className="text-sm text-gray-700 mb-6 leading-relaxed">{site.fullDescription}</div>
      )}

      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <a href={`/out/${site.slug}`} target="_blank" rel="noopener noreferrer" className="px-5 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 no-underline">{dict.home.visit} →</a>
        <span className="text-sm text-gray-500">{site.viewCount} {dict.home.visits}</span>
        <button onClick={toggleFav} className="text-sm text-gray-400 hover:text-red-500">♡ {dict.home.favorite}</button>
      </div>

      <div className="mb-8 p-4 bg-gray-50 rounded-md">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          {locale === 'zh-CN' ? '网站信息' : 'Site Info'}
        </h2>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-gray-500">{locale === 'zh-CN' ? '域名' : 'Domain'}</dt>
          <dd className="text-gray-900">{site.normalizedDomain}</dd>
          <dt className="text-gray-500">{locale === 'zh-CN' ? '收录时间' : 'Listed'}</dt>
          <dd className="text-gray-900">{site.createdAt && new Date(site.createdAt).toLocaleDateString(locale)}</dd>
          <dt className="text-gray-500">{locale === 'zh-CN' ? '状态' : 'Status'}</dt>
          <dd className="text-gray-900">{site.status === 'active' ? (locale === 'zh-CN' ? '正常收录' : 'Active') : site.status}</dd>
        </dl>
      </div>

      {similar.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">
            {locale === 'zh-CN' ? '相似网站推荐' : 'Similar Sites'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {similar.map((s: any) => (
              <Link key={s.slug} href={`${prefix}/sites/${s.slug}`} className="block p-3 bg-white border border-gray-200 rounded hover:border-blue-300 hover:no-underline">
                <span className="font-medium text-sm text-gray-900">{s.name}</span>
                <p className="text-xs text-gray-500 mt-1 truncate">{s.shortSummary}</p>
                <span className="text-xs text-gray-400">{s.viewCount || 0} {dict.home.visits}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

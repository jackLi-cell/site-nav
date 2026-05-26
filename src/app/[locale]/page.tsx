'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRegion } from '@/components/region-switcher';
import { useDictionary } from '@/i18n/dictionary-context';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: string | null;
  level?: number;
  website_count?: number;
}

interface Site {
  id: string;
  name: string;
  slug: string;
  url: string;
  shortSummary?: string;
  short_summary?: string;
  viewCount?: number;
  view_count?: number;
  createdAt?: string;
  created_at?: string;
  company?: string;
  language?: string;
  is_free?: string;
  normalized_domain?: string;
  star_rating?: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  'ai-tools': '🤖', 'developer-tools': '💻', 'design-resources': '🎨',
  'productivity': '📋', 'cloud-services': '☁️', 'data-analytics': '📊',
  'marketing': '📢', 'learning': '📚', 'open-source': '🔓',
  'search-engines': '🔍', 'code-hosting': '📦', 'startup-tools': '🚀',
  'social-media': '💬', 'entertainment': '🎬', 'ecommerce': '🛒',
  'news': '📰', 'finance': '💰', 'jobs': '💼',
  'lifestyle': '🏠', 'writing-tools': '✍️', 'images-stock': '🖼️',
  'video-tools': '📹', 'security': '🔒', 'remote-work': '🏡',
  'email-tools': '📧', 'hosting': '🌐', 'low-code': '⚡',
  'translation': '🌍', 'file-tools': '📁', 'health': '🏥',
};

function StarRating({ rating }: { rating: number }) {
  const stars = Math.min(Math.max(rating, 1), 5);
  return (
    <span className="inline-flex gap-px">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= stars ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export default function HomePage() {
  const { region } = useRegion();
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedCatName, setSelectedCatName] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('default');
  const [searchQ, setSearchQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const initialCategoryApplied = useRef(false);
  const limit = 20;

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(json => {
        const cats = json.data || [];
        setCategories(cats);
        const level1 = cats.filter((c: Category) => c.level === 1 || !c.parent_id);
        if (!initialCategoryApplied.current && level1.length > 0) {
          initialCategoryApplied.current = true;
          setSelectedCat(level1[0].slug);
          setSelectedCatName(level1[0].name);
          setExpandedCats(new Set([level1[0].id]));
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedCat) return;
    setLoading(true);
    const url = searchQ
      ? `/api/search?q=${encodeURIComponent(searchQ)}&region=${region}&limit=${limit}&page=${page}`
      : `/api/categories/${selectedCat}/sites?region=${region}&tab=${tab}&page=${page}&limit=${limit}`;
    fetch(url)
      .then(r => r.json())
      .then(json => {
        setSites(json.data || []);
        setTotal(json.pagination?.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedCat, region, page, tab, searchQ]);

  const selectCategory = (slug: string, name: string) => {
    setSelectedCat(slug);
    setSelectedCatName(name);
    setPage(1);
    setSearchQ('');
    setSearchInput('');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQ(searchInput);
    setPage(1);
  };

  const clearSearch = () => {
    setSearchQ('');
    setSearchInput('');
    setPage(1);
  };

  const toggleFav = (slug: string, name: string) => {
    const key = 'site-nav-favorites';
    const favs = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = favs.findIndex((f: any) => f.slug === slug);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push({ slug, name, addedAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(favs));
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex -mx-5 -mt-8 min-h-[calc(100vh-56px)]">
      {/* 左侧分类导航 */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-100 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto scrollbar-thin">
        <div className="py-4 px-2">
          <div className="px-3 mb-3">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{dict.home.categoryNav}</span>
          </div>
          <nav className="space-y-0.5">
            {categories.filter(c => c.level === 1 || !c.parent_id).map(cat => {
              const isActive = selectedCat === cat.slug;
              const children = categories.filter(c => c.parent_id === cat.id);
              const isExpanded = expandedCats.has(cat.id);
              const hasChildren = children.length > 0;
              return (
                <div key={cat.slug}>
                  <div className="flex items-center">
                    {hasChildren && (
                      <button
                        onClick={() => {
                          const next = new Set(expandedCats);
                          if (isExpanded) next.delete(cat.id); else next.add(cat.id);
                          setExpandedCats(next);
                        }}
                        className="w-5 h-5 flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-600 shrink-0"
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    )}
                    {!hasChildren && <span className="w-5 shrink-0"></span>}
                    <button
                      onClick={() => selectCategory(cat.slug, cat.name)}
                      className={`flex-1 text-left px-2 py-1.5 rounded-lg text-[13px] flex items-center gap-2 transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-[14px] w-5 text-center">{CATEGORY_ICONS[cat.slug] || '📂'}</span>
                      <span className="flex-1 truncate">{cat.name}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>}
                    </button>
                  </div>
                  {hasChildren && isExpanded && (
                    <div className="ml-5 mt-0.5 space-y-0.5">
                      {children.map(child => {
                        const childActive = selectedCat === child.slug;
                        return (
                          <button
                            key={child.slug}
                            onClick={() => selectCategory(child.slug, child.name)}
                            className={`w-full text-left pl-5 pr-2 py-1 rounded text-[12px] transition-colors ${
                              childActive
                                ? 'text-blue-700 font-medium bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-gray-300 mr-1.5">·</span>
                            {child.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* 右侧主内容 */}
      <main className="flex-1 min-w-0 bg-gray-50/50">
        {/* 顶部筛选区 */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-14 z-10">
          {/* 面包屑 + 统计 */}
          <div className="flex items-center justify-between mb-3">
            <nav className="text-xs text-gray-500 flex items-center gap-1">
              <Link href={prefix} className="hover:text-blue-600">{dict.nav.home}</Link>
              <span className="text-gray-300">/</span>
              <span className="text-gray-800 font-medium">{selectedCatName}</span>
              {searchQ && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="text-blue-600">{dict.home.searchLabel}: {searchQ}</span>
                  <button onClick={clearSearch} className="ml-1 text-gray-400 hover:text-red-500">✕</button>
                </>
              )}
            </nav>
            <div className="text-xs text-gray-400">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${region === 'china' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {region === 'china' ? `🇨🇳 ${dict.region.china}` : `🌍 ${dict.region.overseas}`}
              </span>
              <span className="ml-2">{total.toLocaleString()} {dict.home.sites}</span>
            </div>
          </div>

          {/* 搜索 + 排序 */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={dict.home.searchPlaceholder.replace('{category}', selectedCatName)}
                  className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-gray-50/50"
                />
                <svg className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
                {dict.home.search}
              </button>
            </form>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {[
                { key: 'default', label: dict.home.sortDefault },
                { key: 'latest', label: dict.home.sortLatest },
                { key: 'hot', label: dict.home.sortHot },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setPage(1); }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    tab === t.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 网站列表 */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-gray-400">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span className="text-sm">{dict.home.loading}</span>
              </div>
            </div>
          ) : sites.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-gray-500 text-sm">{dict.home.noSites}</p>
              <p className="text-gray-400 text-xs mt-1">{dict.home.noSitesTip}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sites.map(site => {
                const summary = site.shortSummary || site.short_summary || '';
                const views = site.viewCount || site.view_count || 0;
                const domain = site.normalized_domain || '';
                const star = site.star_rating || 1;
                const initial = site.name.charAt(0).toUpperCase();
                return (
                  <div key={site.slug} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-sm transition-all duration-200 group">
                    <div className="flex gap-4">
                      {/* 缩略图 */}
                      <div className="w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center shrink-0 border border-gray-100 group-hover:border-gray-200 transition-colors">
                        <span className="text-xl font-bold text-gray-300 group-hover:text-gray-400 transition-colors">{initial}</span>
                      </div>
                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        {/* 第一行：名称 + 星级 + 访客 */}
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`${prefix}/sites/${site.slug}`} className="font-semibold text-gray-900 hover:text-blue-600 truncate text-[15px] transition-colors">
                            {site.name}
                          </Link>
                          <StarRating rating={star} />
                          <span className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                            {formatNumber(views)} {dict.home.visits}
                          </span>
                        </div>
                        {/* 第二行：简介 */}
                        <p className="text-[13px] text-gray-500 line-clamp-1 mb-2">{summary}</p>
                        {/* 第三行：元信息 + 操作 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                            {site.company && (
                              <span className="inline-flex items-center gap-0.5 bg-gray-50 px-1.5 py-0.5 rounded">
                                <span className="text-[10px]">🏢</span> {site.company}
                              </span>
                            )}
                            {site.language && (
                              <span className="inline-flex items-center gap-0.5 bg-gray-50 px-1.5 py-0.5 rounded">
                                <span className="text-[10px]">🌐</span> {site.language}
                              </span>
                            )}
                            {site.is_free && (
                              <span className="inline-flex items-center gap-0.5 bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                                {site.is_free}
                              </span>
                            )}
                            {domain && (
                              <span className="text-gray-300 hidden sm:inline">{domain}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => toggleFav(site.slug, site.name)}
                              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              title={dict.home.favorite}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </button>
                            <a
                              href={`/out/${site.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200/50"
                            >
                              {dict.home.visit}
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8 mb-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >
                ← {dict.home.prevPage}
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-lg transition-all ${
                      page === p
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                        : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && page < totalPages - 3 && (
                <span className="text-gray-300 px-1">...</span>
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >
                {dict.home.nextPage} →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

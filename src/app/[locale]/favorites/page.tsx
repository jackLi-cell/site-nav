'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/i18n/dictionary-context';

interface Fav {
  slug: string;
  name: string;
  addedAt: number;
}

export default function FavoritesPage() {
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
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
      <h1 className="text-2xl font-bold mb-2">{dict.favorites.title}</h1>
      <p className="text-gray-600 mb-6">{dict.favorites.description}</p>
      {!loaded ? (
        <p className="text-gray-400 text-sm">{dict.home.loading}</p>
      ) : favs.length === 0 ? (
        <p className="text-gray-500">
          {dict.favorites.empty} {dict.favorites.emptyTip}
        </p>
      ) : (
        <div className="space-y-3">
          {favs.map(fav => (
            <div key={fav.slug} className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between">
              <Link href={`${prefix}/sites/${fav.slug}`} className="font-medium text-gray-900 hover:text-blue-600">{fav.name}</Link>
              <div className="flex items-center gap-3">
                <a href={`/out/${fav.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600">{dict.home.visit} →</a>
                <button onClick={() => remove(fav.slug)} className="text-xs text-red-500 hover:text-red-700">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDictionary } from '@/i18n/dictionary-context';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export default function CategoriesIndexPage() {
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;
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
      <h1 className="text-2xl font-bold mb-2">{dict.categories.title}</h1>
      <p className="text-gray-600 mb-6">{dict.categories.description}</p>
      {loading ? (
        <p className="text-gray-400 text-sm">{dict.home.loading}</p>
      ) : cats.length === 0 ? (
        <p className="text-gray-500">{dict.home.noSites}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {cats.map(cat => (
            <Link
              key={cat.slug}
              href={`${prefix}/categories/${cat.slug}`}
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

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { i18n, type Locale } from '@/i18n/config';
import { useDictionary } from '@/i18n/dictionary-context';

const LOCALE_LABELS: Record<Locale, string> = {
  'zh-CN': '中文',
  en: 'EN',
};

export function LanguageSwitcher() {
  const { locale } = useDictionary();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return;
    // Replace current locale prefix with new one
    const pathWithoutLocale = pathname.replace(`/${locale}`, '') || '/';
    const newPath = `/${newLocale}${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`;
    // Set cookie
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.push(newPath);
  };

  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs">
      {i18n.locales.map((l) => (
        <button
          key={l}
          onClick={() => switchLocale(l)}
          className={`px-3 py-1 ${
            locale === l
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

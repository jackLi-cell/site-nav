'use client';

import Link from 'next/link';
import { RegionProvider, RegionSwitcher } from '@/components/region-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { DictionaryProvider, useDictionary } from '@/i18n/dictionary-context';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/get-dictionary';
import { useEffect, useState } from 'react';

function HeaderNav() {
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <nav className="max-w-[1680px] mx-auto px-5 py-3 flex items-center justify-between">
        <Link href={prefix} className="text-lg font-semibold text-gray-900 hover:no-underline">
          {dict.site.name}
        </Link>
        <div className="flex gap-5 text-sm items-center">
          <Link href={`${prefix}/sites`} className="text-gray-600 hover:text-blue-600">{dict.nav.allSites}</Link>
          <Link href={`${prefix}/categories`} className="text-gray-600 hover:text-blue-600">{dict.nav.categories}</Link>
          <Link href={`${prefix}/tags`} className="text-gray-600 hover:text-blue-600">{dict.nav.tags}</Link>
          <Link href={`${prefix}/favorites`} className="text-gray-600 hover:text-blue-600">{dict.nav.favorites}</Link>
          <Link href={`${prefix}/submit`} className="text-gray-600 hover:text-blue-600">{dict.nav.submit}</Link>
          <RegionSwitcher />
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}

function FooterNav() {
  const { dict, locale } = useDictionary();
  const prefix = `/${locale}`;

  return (
    <footer className="bg-white border-t border-gray-200 mt-12 py-6 px-5">
      <div className="max-w-[1680px] mx-auto text-center">
        <div className="flex justify-center gap-5 mb-3">
          <Link href={`${prefix}/pages/about`} className="text-gray-500 text-xs hover:text-blue-600">{dict.footer.about}</Link>
          <Link href={`${prefix}/pages/contact`} className="text-gray-500 text-xs hover:text-blue-600">{dict.footer.contact}</Link>
          <Link href={`${prefix}/pages/privacy`} className="text-gray-500 text-xs hover:text-blue-600">{dict.footer.privacy}</Link>
          <Link href={`${prefix}/pages/disclaimer`} className="text-gray-500 text-xs hover:text-blue-600">{dict.footer.disclaimer}</Link>
          <Link href="/feed.xml" className="text-gray-500 text-xs hover:text-blue-600">RSS</Link>
        </div>
        <p className="text-gray-400 text-xs">{dict.footer.email}：1055567003@qq.com</p>
      </div>
    </footer>
  );
}

export function ClientBody({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const [dict, setDict] = useState<Dictionary | null>(null);

  useEffect(() => {
    import(`@/i18n/dictionaries/${locale}.json`).then((m) => setDict(m.default));
  }, [locale]);

  if (!dict) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <DictionaryProvider dict={dict} locale={locale}>
      <RegionProvider>
        <HeaderNav />
        <main className="max-w-[1680px] mx-auto px-5 py-8 min-h-[calc(100vh-180px)]">
          {children}
        </main>
        <FooterNav />
      </RegionProvider>
    </DictionaryProvider>
  );
}

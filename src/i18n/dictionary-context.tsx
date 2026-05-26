'use client';

import { createContext, useContext } from 'react';
import type { Dictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';

type DictionaryContextType = {
  dict: Dictionary;
  locale: Locale;
};

const DictionaryContext = createContext<DictionaryContextType | null>(null);

export function DictionaryProvider({
  children,
  dict,
  locale,
}: {
  children: React.ReactNode;
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <DictionaryContext.Provider value={{ dict, locale }}>
      {children}
    </DictionaryContext.Provider>
  );
}

export function useDictionary() {
  const ctx = useContext(DictionaryContext);
  if (!ctx) {
    throw new Error('useDictionary must be used within a DictionaryProvider');
  }
  return ctx;
}

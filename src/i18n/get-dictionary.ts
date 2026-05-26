import type { Locale } from './config';

const dictionaries = {
  'zh-CN': () => import('./dictionaries/zh-CN.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};

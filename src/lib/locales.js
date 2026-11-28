import { LOCALE_LIST } from "./seed";

// Every list of languages (tables, dropdowns, dialogs) starts with the default one.
export function orderLocales(defaultLocale) {
  if (!LOCALE_LIST.includes(defaultLocale)) return LOCALE_LIST;
  return [defaultLocale, ...LOCALE_LIST.filter((l) => l !== defaultLocale)];
}

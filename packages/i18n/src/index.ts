export const translations = {
  en: {
    welcome: 'Welcome',
    goodbye: 'Goodbye',
  },
  es: {
    welcome: 'Bienvenido',
    goodbye: 'Adiós',
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof (typeof translations)['en'];

export function translate(lang: Language, key: TranslationKey): string {
  return translations[lang][key];
}

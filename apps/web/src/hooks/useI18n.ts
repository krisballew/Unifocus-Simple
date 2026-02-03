// React hooks for i18n support
import type { LocaleConfig, MessageKey, SupportedLocale, WeekStartDay } from '@unifocus/i18n';
import {
  DEFAULT_LOCALE_CONFIG,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  formatTime,
  getMessage,
  getWeekDays,
  getWeekStartDay,
} from '@unifocus/i18n';
import { useCallback, useMemo } from 'react';

// Create a global i18n context state (in a real app, use Context API or state management)
let globalLocaleConfig: LocaleConfig = DEFAULT_LOCALE_CONFIG['en-US'];

export function setGlobalLocaleConfig(config: LocaleConfig) {
  globalLocaleConfig = config;
}

export function getGlobalLocaleConfig(): LocaleConfig {
  return globalLocaleConfig;
}

/**
 * Hook to get the current locale configuration
 */
export function useLocaleConfig(): LocaleConfig {
  return getGlobalLocaleConfig();
}

/**
 * Hook to translate a message key with optional parameters
 */
export function useTranslate() {
  const config = useLocaleConfig();

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number | boolean | Date>) => {
      return getMessage(config.locale, key, params);
    },
    [config.locale]
  );

  return t;
}

/**
 * Hook to format dates according to locale
 */
export function useDateFormatter() {
  const config = useLocaleConfig();

  const format = useCallback(
    (date: Date | number | string, style: 'short' | 'medium' | 'long' = 'medium') => {
      return formatDate(date, config, style);
    },
    [config]
  );

  return format;
}

/**
 * Hook to format times according to locale
 */
export function useTimeFormatter() {
  const config = useLocaleConfig();

  const format = useCallback(
    (date: Date | number | string, includeSeconds = false) => {
      return formatTime(date, config, includeSeconds);
    },
    [config]
  );

  return format;
}

/**
 * Hook to format date and time together
 */
export function useDateTimeFormatter() {
  const config = useLocaleConfig();

  const format = useCallback(
    (date: Date | number | string, dateStyle: 'short' | 'medium' | 'long' = 'medium') => {
      return formatDateTime(date, config, dateStyle);
    },
    [config]
  );

  return format;
}

/**
 * Hook to format currency according to locale
 */
export function useCurrencyFormatter() {
  const config = useLocaleConfig();

  const format = useCallback(
    (amount: number) => {
      return formatCurrency(amount, config);
    },
    [config]
  );

  return format;
}

/**
 * Hook to format numbers according to locale
 */
export function useNumberFormatter() {
  const config = useLocaleConfig();

  const format = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return formatNumber(value, config, options);
    },
    [config]
  );

  return format;
}

/**
 * Hook to format relative time (e.g., "2 hours ago")
 */
export function useRelativeTimeFormatter() {
  const config = useLocaleConfig();

  const format = useCallback(
    (date: Date | number | string, baseDate?: Date) => {
      return formatRelativeTime(date, baseDate, config.locale);
    },
    [config.locale]
  );

  return format;
}

/**
 * Hook to get week start day for the current locale
 */
export function useWeekStartDay(): WeekStartDay {
  const config = useLocaleConfig();
  return useMemo(() => getWeekStartDay(config), [config]);
}

/**
 * Hook to get all days in the current week
 */
export function useWeekDays(date: Date) {
  const config = useLocaleConfig();

  return useMemo(() => {
    return getWeekDays(date, config);
  }, [date, config]);
}

/**
 * Hook to get locale display name
 */
export function useLocaleName() {
  const config = useLocaleConfig();

  const getDisplayName = useCallback(
    (locale: SupportedLocale) => {
      const displayNames = new Intl.DisplayNames(config.locale, { type: 'language' });
      return displayNames.of(locale.split('-')[0]) || locale;
    },
    [config.locale]
  );

  return getDisplayName;
}

/**
 * Hook to get all supported locales with their display names
 */
export function useSupportedLocales() {
  const config = useLocaleConfig();

  const locales: Array<{ code: SupportedLocale; name: string }> = useMemo(() => {
    const displayNames = new Intl.DisplayNames(config.locale, { type: 'language' });
    const codes: SupportedLocale[] = ['en-US', 'es-ES'];

    return codes.map((code) => ({
      code,
      name: displayNames.of(code.split('-')[0]) || code,
    }));
  }, [config.locale]);

  return locales;
}

/**
 * Hook to get all supported timezones
 */
export function useSupportedTimezones() {
  return useMemo(() => {
    // Common timezones
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Madrid',
      'America/Mexico_City',
      'America/Toronto',
      'America/Vancouver',
      'America/Sao_Paulo',
      'America/Buenos_Aires',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Asia/Dubai',
      'Asia/Bangkok',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland',
    ];
  }, []);
}

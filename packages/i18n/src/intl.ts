// Intl API utilities for locale-aware formatting

import type { SupportedLocale } from './index';

export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.

export interface LocaleConfig {
  locale: SupportedLocale;
  timezone?: string;
  weekStartDay?: WeekStartDay;
  currency?: string;
  dateFormat?: 'short' | 'medium' | 'long';
}

export interface TenantSettings {
  weekStartDay: WeekStartDay;
  defaultLocale: SupportedLocale;
  defaultTimezone: string;
  defaultCurrency: string;
}

export interface UserLocalePreference {
  locale?: SupportedLocale;
  timezone?: string;
}

// Default locale configurations
export const DEFAULT_LOCALE_CONFIG: Record<SupportedLocale, LocaleConfig> = {
  'en-US': {
    locale: 'en-US',
    timezone: 'America/New_York',
    weekStartDay: 0, // Sunday
    currency: 'USD',
    dateFormat: 'short',
  },
  'es-ES': {
    locale: 'es-ES',
    timezone: 'Europe/Madrid',
    weekStartDay: 1, // Monday
    currency: 'EUR',
    dateFormat: 'short',
  },
};

/**
 * Merge user preferences with tenant settings to create effective locale config
 */
export function buildLocaleConfig(
  userPreference: UserLocalePreference | null,
  tenantSettings: TenantSettings
): LocaleConfig {
  const effectiveLocale = (userPreference?.locale ||
    tenantSettings.defaultLocale) as SupportedLocale;
  const baseConfig = DEFAULT_LOCALE_CONFIG[effectiveLocale] || DEFAULT_LOCALE_CONFIG['en-US'];

  return {
    locale: effectiveLocale,
    timezone: userPreference?.timezone || tenantSettings.defaultTimezone,
    weekStartDay: tenantSettings.weekStartDay as WeekStartDay,
    currency: tenantSettings.defaultCurrency,
    dateFormat: baseConfig.dateFormat,
  };
}

/**
 * Format date according to locale preferences
 */
export function formatDate(
  date: Date | number | string,
  config: LocaleConfig,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  const dateObj = new Date(date);
  const formatter = new Intl.DateTimeFormat(config.locale, {
    year: 'numeric',
    month: style === 'long' ? 'long' : style === 'medium' ? 'short' : '2-digit',
    day: '2-digit',
    timeZone: config.timezone,
  });
  return formatter.format(dateObj);
}

/**
 * Format time according to locale preferences
 */
export function formatTime(
  date: Date | number | string,
  config: LocaleConfig,
  includeSeconds = false
): string {
  const dateObj = new Date(date);
  const formatter = new Intl.DateTimeFormat(config.locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' }),
    timeZone: config.timezone,
  });
  return formatter.format(dateObj);
}

/**
 * Format date and time together
 */
export function formatDateTime(
  date: Date | number | string,
  config: LocaleConfig,
  dateStyle: 'short' | 'medium' | 'long' = 'medium'
): string {
  const dateObj = new Date(date);
  const formatter = new Intl.DateTimeFormat(config.locale, {
    year: 'numeric',
    month: dateStyle === 'long' ? 'long' : dateStyle === 'medium' ? 'short' : '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: config.timezone,
  });
  return formatter.format(dateObj);
}

/**
 * Format currency according to locale preferences
 */
export function formatCurrency(amount: number, config: LocaleConfig): string {
  const formatter = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

/**
 * Format number according to locale preferences
 */
export function formatNumber(
  value: number,
  config: LocaleConfig,
  options?: Intl.NumberFormatOptions
): string {
  const formatter = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });
  return formatter.format(value);
}

/**
 * Get week start day for the locale
 * Returns 0-6 where 0 is Sunday
 */
export function getWeekStartDay(config: LocaleConfig): WeekStartDay {
  return config.weekStartDay ?? DEFAULT_LOCALE_CONFIG[config.locale].weekStartDay ?? 0;
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | number | string,
  baseDate: Date = new Date(),
  locale: SupportedLocale = 'en-US'
): string {
  const dateObj = new Date(date);
  const baseDateObj = new Date(baseDate);
  const diffMs = baseDateObj.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSeconds < 60) {
    return rtf.format(-diffSeconds, 'second');
  }
  if (diffMinutes < 60) {
    return rtf.format(-diffMinutes, 'minute');
  }
  if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour');
  }
  if (diffDays < 30) {
    return rtf.format(-diffDays, 'day');
  }

  return formatDate(dateObj, { locale });
}

/**
 * Get list formatter for locale
 * e.g., "one, two, and three"
 */
export function formatList(items: string[], locale: SupportedLocale): string {
  const formatter = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  return formatter.format(items);
}

/**
 * Get display name for a locale
 */
export function getLocaleName(locale: SupportedLocale, inLocale?: SupportedLocale): string {
  const displayNames = new Intl.DisplayNames(inLocale || locale, { type: 'language' });
  const languageCode = locale.split('-')[0] ?? locale;
  return displayNames.of(languageCode) || locale;
}

/**
 * Calculate start of week for a given date
 */
export function getStartOfWeek(date: Date, weekStartDay: WeekStartDay): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day - weekStartDay;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate end of week for a given date
 */
export function getEndOfWeek(date: Date, weekStartDay: WeekStartDay): Date {
  const startOfWeek = getStartOfWeek(date, weekStartDay);
  const endDate = new Date(startOfWeek);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);
  return endDate;
}

/**
 * Get all days in week starting from the configured week start day
 */
export function getWeekDays(
  date: Date,
  config: LocaleConfig
): Array<{ date: Date; dayOfWeek: number }> {
  const weekStartDay = getWeekStartDay(config);
  const startOfWeek = getStartOfWeek(date, weekStartDay);
  const days: Array<{ date: Date; dayOfWeek: number }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    days.push({ date: d, dayOfWeek: (weekStartDay + i) % 7 });
  }

  return days;
}

/**
 * Locale-aware formatting utilities for use throughout the UI
 * These use the Intl APIs with the current locale configuration
 */

import {
  formatCurrency as intlFormatCurrency,
  formatDate as intlFormatDate,
  formatDateTime as intlFormatDateTime,
  formatNumber as intlFormatNumber,
  formatTime as intlFormatTime,
  getEndOfWeek,
  getStartOfWeek,
  getWeekDays,
  getWeekStartDay,
  getMessage,
  type MessageKey,
  type SupportedLocale,
  type LocaleConfig,
  type WeekStartDay,
} from '@unifocus/i18n';

/**
 * Get a translated message with the current locale
 */
export function t(
  locale: SupportedLocale,
  key: MessageKey,
  params?: Record<string, unknown>
): string {
  return getMessage(locale, key, params as Record<string, string | number | boolean>);
}

/**
 * Format a date with the current locale and timezone
 */
export function formatDate(
  date: Date | number | string,
  config: LocaleConfig,
  style?: 'short' | 'medium' | 'long'
): string {
  return intlFormatDate(date, config, style || 'medium');
}

/**
 * Format a date in short format (e.g., 1/15/2024)
 */
export function formatDateShort(date: Date | number | string, config: LocaleConfig): string {
  return intlFormatDate(date, config, 'short');
}

/**
 * Format a time with the current locale
 */
export function formatTime(date: Date | number | string, config: LocaleConfig): string {
  return intlFormatTime(date, config, false);
}

/**
 * Format a time with seconds
 */
export function formatTimeWithSeconds(date: Date | number | string, config: LocaleConfig): string {
  return intlFormatTime(date, config, true);
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | number | string, config: LocaleConfig): string {
  return intlFormatDateTime(date, config, 'medium');
}

/**
 * Format date and time in short format
 */
export function formatDateTimeShort(date: Date | number | string, config: LocaleConfig): string {
  return intlFormatDateTime(date, config, 'short');
}

/**
 * Format a currency amount
 */
export function formatCurrency(amount: number, config: LocaleConfig): string {
  return intlFormatCurrency(amount, config);
}

/**
 * Format a number with locale-specific formatting
 */
export function formatNumber(value: number, config: LocaleConfig): string {
  return intlFormatNumber(value, config);
}

/**
 * Get the week start day for scheduling views
 */
export function getScheduleWeekStartDay(config: LocaleConfig): WeekStartDay {
  return getWeekStartDay(config);
}

/**
 * Get all days in a week for calendar/schedule rendering
 */
export function getScheduleWeekDays(date: Date, config: LocaleConfig) {
  return getWeekDays(date, config);
}

/**
 * Get the start of the week for the given date
 */
export function getScheduleWeekStart(date: Date, config: LocaleConfig): Date {
  return getStartOfWeek(date, getWeekStartDay(config));
}

/**
 * Get the end of the week for the given date
 */
export function getScheduleWeekEnd(date: Date, config: LocaleConfig): Date {
  return getEndOfWeek(date, getWeekStartDay(config));
}

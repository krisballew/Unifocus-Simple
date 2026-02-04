import type { LocaleConfig, SupportedLocale } from '@unifocus/i18n';
import { useState } from 'react';

import { useI18nContext } from '../context/I18nContext';
import { useTranslate, useSupportedLocales, useSupportedTimezones } from '../hooks/useI18n';

export function LocalePreferencePanel() {
  const { config, setLocale, loading } = useI18nContext();
  const t = useTranslate();
  const supportedLocales = useSupportedLocales();
  const supportedTimezones = useSupportedTimezones();

  const [locale, setSelectedLocale] = useState<SupportedLocale>(config.locale);
  const [timezone, setSelectedTimezone] = useState(config.timezone || 'UTC');

  const handleSave = async () => {
    const newConfig: LocaleConfig = {
      ...config,
      locale,
      timezone,
    };
    await setLocale(newConfig);
  };

  const handleReset = () => {
    setSelectedLocale(config.locale);
    setSelectedTimezone(config.timezone || 'UTC');
  };

  const isDirty = locale !== config.locale || timezone !== config.timezone;

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
      <h3>{t('preferences.profile' as never)}</h3>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="locale-select" style={{ display: 'block', marginBottom: '0.5rem' }}>
          {t('preferences.language' as never)}
        </label>
        <select
          id="locale-select"
          value={locale}
          onChange={(e) => setSelectedLocale(e.target.value as SupportedLocale)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
          disabled={loading}
        >
          {supportedLocales.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="timezone-select" style={{ display: 'block', marginBottom: '0.5rem' }}>
          {t('preferences.timezone' as never)}
        </label>
        <select
          id="timezone-select"
          value={timezone}
          onChange={(e) => setSelectedTimezone(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
          disabled={loading}
        >
          {supportedTimezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={handleSave}
          disabled={!isDirty || loading}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: isDirty ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isDirty ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? t('common.loading' as never) : t('common.save' as never)}
        </button>
        {isDirty && (
          <button
            onClick={handleReset}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {t('common.cancel' as never)}
          </button>
        )}
      </div>
    </div>
  );
}

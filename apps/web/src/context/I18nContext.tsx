import { DEFAULT_LOCALE_CONFIG } from '@unifocus/i18n';
import type { LocaleConfig } from '@unifocus/i18n';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { setGlobalLocaleConfig } from '../hooks/useI18n';
import { getApiClient } from '../services/api-client';

interface LocaleResponse {
  locale: string;
  timezone: string;
  weekStartDay: number;
  currency: string;
  defaultLocale: string;
}

interface I18nContextType {
  config: LocaleConfig;
  setLocale: (locale: LocaleConfig) => void;
  loading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  initialConfig?: LocaleConfig;
}

export function I18nProvider({ children, initialConfig }: I18nProviderProps) {
  const [config, setConfig] = useState<LocaleConfig>(
    initialConfig || DEFAULT_LOCALE_CONFIG['en-US']
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Update global config when it changes
    setGlobalLocaleConfig(config);
  }, [config]);

  const handleSetLocale = async (newConfig: LocaleConfig) => {
    setLoading(true);
    try {
      // Persist to server
      try {
        const apiClient = getApiClient();
        await apiClient.patch('/users/me/locale', {
          locale: newConfig.locale,
          timezone: newConfig.timezone,
        });
      } catch (error) {
        console.warn('Failed to save locale preferences to server:', error);
      }

      setConfig(newConfig);

      // Also persist to localStorage as fallback
      if (typeof window !== 'undefined') {
        localStorage.setItem('localeConfig', JSON.stringify(newConfig));
      }
    } finally {
      setLoading(false);
    }
  };

  // Load saved locale preference from server on mount
  useEffect(() => {
    if (!initialConfig) {
      const loadUserLocalePreference = async () => {
        try {
          setLoading(true);
          const apiClient = getApiClient();
          const response = (await apiClient.get('/users/me/locale')) as LocaleResponse;

          if (response && response.locale) {
            const locale = response.locale as 'en-US' | 'es-ES';
            const timezone = response.timezone;
            const weekStartDay = response.weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6;
            const currency = response.currency;

            const newConfig: LocaleConfig = {
              locale,
              timezone,
              weekStartDay,
              currency,
              dateFormat: 'short',
            };

            setConfig(newConfig);
            if (typeof window !== 'undefined') {
              localStorage.setItem('localeConfig', JSON.stringify(newConfig));
            }
          }
        } catch (error) {
          console.warn('Failed to load locale config from server:', error);

          // Fallback to localStorage
          if (typeof window !== 'undefined') {
            try {
              const saved = localStorage.getItem('localeConfig');
              if (saved) {
                const parsed = JSON.parse(saved) as LocaleConfig;
                setConfig(parsed);
              }
            } catch (localStorageError) {
              console.error('Failed to load locale config from localStorage:', localStorageError);
            }
          }
        } finally {
          setLoading(false);
        }
      };

      loadUserLocalePreference();
    }
  }, [initialConfig]);

  return (
    <I18nContext.Provider value={{ config, setLocale: handleSetLocale, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18nContext(): I18nContextType {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18nContext must be used within I18nProvider');
  }
  return context;
}

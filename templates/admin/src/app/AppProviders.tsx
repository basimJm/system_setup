import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { LANGUAGES, type Language } from '@/constants/i18n';
import { ThemeProvider } from '@/design/theme/ThemeProvider';
import { createI18n, directionOf } from '@/infrastructure/i18n/i18n';
import { readLanguage, writeLanguage } from '@/infrastructure/i18n/language';
import { registerGlobalErrorHandlers } from '@/infrastructure/observability/globalErrors';
import { ErrorBoundary } from '@/presentation/components/feedback/ErrorBoundary';
import { ToastProvider } from '@/presentation/components/overlay/Toast';
import { LanguageContext, type LanguageContextValue } from '@/presentation/hooks/useLanguage';
import type { Container } from './container';
import { ContainerContext } from './ContainerContext';

export function AppProviders({
  container,
  children,
}: {
  container: Container;
  children: ReactNode;
}) {
  const { config, logger, queryClient } = container;
  const [language, setLanguageState] = useState<Language>(() =>
    readLanguage(config.defaultLanguage),
  );
  const i18n = useMemo(() => createI18n(language), []); // eslint-disable-line react-hooks/exhaustive-deps
  const direction = directionOf(language);

  useEffect(() => registerGlobalErrorHandlers(window, logger), [logger]);
  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [i18n, language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    writeLanguage(next);
  }, []);
  const languageValue = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction,
      setLanguage,
      toggle: () => setLanguage(LANGUAGES.find((l) => l !== language) ?? language),
    }),
    [language, direction, setLanguage],
  );

  return (
    <ContainerContext.Provider value={container}>
      <LanguageContext.Provider value={languageValue}>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider direction={direction}>
              <ToastProvider>
                <ErrorBoundary
                  onError={(e) => logger.error('render.failed', { message: e.message })}
                >
                  {children}
                </ErrorBoundary>
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </LanguageContext.Provider>
    </ContainerContext.Provider>
  );
}

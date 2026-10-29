import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
// Playfair Display (OFL-1.1, self-hosted): Latin subset only, the serif headings fall back to IBM Plex Sans Arabic in Arabic.
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-700.css';
import './design/styles/index.css';
import { applyThemeToDocument } from './design/theme/applyTheme';
import { readStoredMode, resolveTheme, systemIsDark } from './design/theme/themeMode';
import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import { createContainer } from './app/container';
import { directionOf } from './infrastructure/i18n/i18n';
import { readLanguage } from './infrastructure/i18n/language';
import { STARTUP_ERROR_FALLBACK } from './constants/ui';
import { loadAppConfig } from './infrastructure/config/appConfig';

/** Paint tokens before React mounts so the first frame already has the right theme + direction. */
function boot(): void {
  const config = loadAppConfig();
  const language = readLanguage(config.defaultLanguage);
  applyThemeToDocument(resolveTheme(readStoredMode(), systemIsDark()), directionOf(language));
  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Root element missing');
  const root = createRoot(rootElement);
  createContainer(config, () => readLanguage(config.defaultLanguage))
    .then((container) =>
      root.render(
        <StrictMode>
          <AppProviders container={container}>
            <App />
          </AppProviders>
        </StrictMode>,
      ),
    )
    .catch((error: unknown) => {
      // Startup failure (bad config) must be visible, never a blank page.
      root.render(
        <pre role="alert">{error instanceof Error ? error.name : STARTUP_ERROR_FALLBACK}</pre>,
      );
    });
}

boot();

import { useState, useEffect } from 'react';

interface ThemeAssets {
  logo: string;
  icon: string;
  isDark: boolean;
}

/**
 * Hook para retornar assets (logo/icon) baseados no tema atual
 *
 * Observa mudanças na classe 'dark' do documento e retorna
 * os caminhos corretos para as versões light/dark dos assets
 */
export function useThemeAssets(): ThemeAssets {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const icon = isDark ? '/icon-dark.png' : '/icon-light.png';

  // Atualiza o favicon dinamicamente
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = icon;
    }
  }, [icon]);

  return {
    logo: isDark ? '/logo-dark.png' : '/logo-light.png',
    icon,
    isDark,
  };
}

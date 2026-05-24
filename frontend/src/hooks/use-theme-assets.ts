import { useState, useEffect, useLayoutEffect } from 'react';

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

  // useLayoutEffect runs before any useEffect in the entire tree.
  // useTheme (inside ThemeToggle, a child) applies the initial class in a
  // useEffect — so this observer must be registered in the layout phase to
  // catch that change without a synchronous setState call in the effect body.
  useLayoutEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const icon = isDark ? '/icon-dark.png' : '/icon-light.png';
  const favicon = isDark ? '/favicon-dark.ico' : '/favicon-light.ico';

  // Atualiza todos os links de favicon para refletir o tema atual.
  // index.html declara dois links: type="image/x-icon" (.ico) e
  // type="image/png" (.png). Browsers preferem o .png, por isso ambos
  // precisam ser atualizados — atualizar só o primeiro não tem efeito visível.
  useEffect(() => {
    const faviconIco = document.querySelector<HTMLLinkElement>(
      'link[rel="icon"][type="image/x-icon"]'
    );
    if (faviconIco) faviconIco.href = favicon;

    const faviconPng = document.querySelector<HTMLLinkElement>(
      'link[rel="icon"][type="image/png"]'
    );
    if (faviconPng) faviconPng.href = icon;
  }, [favicon, icon]);

  return {
    logo: isDark ? '/logo-dark.png' : '/logo-light.png',
    icon,
    isDark,
  };
}

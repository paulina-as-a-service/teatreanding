import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'teatranding-theme';

const readTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

/** Applies the theme to <html> synchronously. The pre-render script in index.html uses the same mechanism. */
export const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: theme still applies for this visit */
  }
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  // Follow system changes only while the visitor has not chosen a theme explicitly.
  // This path never animates (rule: only clicks on the toggle animate).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch {
        /* ignore */
      }
      if (saved) return;
      const next: Theme = e.matches ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.style.colorScheme = next;
      setThemeState(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  return { theme, setTheme };
}

import { useSyncExternalStore } from 'react';

/** Live result of a CSS media query (e.g. '(min-width: 1024px)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Desktop layout (Tailwind `lg`). Scroll-driven parallax only runs here. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

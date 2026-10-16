import type { MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, type Theme } from '../hooks/useTheme';
import { flushSync } from 'react-dom';

type Props = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

export default function ThemeToggle({ theme, setTheme }: Props) {
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'dark' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || reduced) {
      setTheme(next);
      return;
    }

    // Circle origin: center of the toggle button
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const transition = document.startViewTransition(() => {
      // Apply to <html> synchronously so the "after" snapshot is correct, then sync React.
      applyTheme(next);
      flushSync(() => setTheme(next));
    });

    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          {
            duration: 500,
            easing: 'cubic-bezier(0.3, 0, 0.1, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      })
      .catch(() => {
        /* transition skipped or interrupted: theme is already applied */
      });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line/15 bg-surface/70 text-ink backdrop-blur transition-colors hover:border-accent/50 hover:text-accent"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="grid place-items-center"
        >
          {theme === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

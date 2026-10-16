import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { HatMark, Wordmark } from './Logo';
import ThemeToggle from './ThemeToggle';
import type { Theme } from '../hooks/useTheme';

const LINKS = [
  { id: 'curso', label: 'El curso' },
  { id: 'temario', label: 'Temario' },
  { id: 'fechas', label: 'Fechas' },
  { id: 'docente', label: 'Docente' },
  { id: 'testimonios', label: 'Testimonios' },
];

export default function Header({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>('');
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Highlight the section currently in view
  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={`transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
          scrolled ? 'bg-bg/75 shadow-[0_1px_0_rgb(var(--line)/0.08)] backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <nav className="page flex h-16 items-center justify-between gap-4 sm:h-[4.5rem]" aria-label="Principal">
          <a href="#inicio" className="group flex items-center gap-2.5" aria-label="Teatranding!, ir al inicio">
            <HatMark className="h-8 w-8 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
            <Wordmark className="hidden text-sm sm:inline" />
          </a>

          <ul className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <li key={l.id} className="relative">
                <a
                  href={`#${l.id}`}
                  className={`relative z-10 block rounded-full px-4 py-2 font-display text-[0.95rem] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    active === l.id ? 'text-ink' : 'text-text/70 hover:text-ink'
                  }`}
                >
                  {l.label}
                </a>
                {active === l.id && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-ink/[0.07]"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <a href="#inscripcion" className="btn-primary hidden !px-5 !py-2.5 !text-sm sm:inline-flex">
              Inscríbete
            </a>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-full border border-line/15 text-ink lg:hidden"
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={open}
              aria-controls="menu-movil"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
        <motion.div
          className="h-[2px] origin-left bg-gradient-to-r from-brand-violet via-brand-orchid to-brand-magenta"
          style={{ scaleX: progress }}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-movil"
            className="fixed inset-x-0 bottom-0 top-16 bg-bg/95 backdrop-blur-xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.ul
              className="page flex flex-col gap-1 pt-6"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            >
              {[...LINKS, { id: 'inscripcion', label: 'Inscríbete' }].map((l) => (
                <motion.li
                  key={l.id}
                  variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } }}
                >
                  <a
                    href={`#${l.id}`}
                    onClick={() => setOpen(false)}
                    className="block border-b border-line/10 py-4 font-display text-3xl font-semibold uppercase tracking-wide text-ink"
                  >
                    {l.label}
                  </a>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

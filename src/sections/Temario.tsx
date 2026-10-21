import { useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import type { MouseEvent } from 'react';
import { Calculator, ChartGantt, ClipboardList, Compass, Headset, MapPinned, Plus, type LucideIcon } from 'lucide-react';
import { APRENDIZAJES, MODULOS } from '../content/curso';
import { Copy, SectionHeading } from '../components/ui';
import { fadeUp, stagger } from '../components/motion';

/** Un ícono por tarjeta de "Lo que vas a aprender", en el mismo orden que APRENDIZAJES. */
const ICONOS_APRENDIZAJE: LucideIcon[] = [Compass, ChartGantt, Calculator, ClipboardList, MapPinned, Headset];

/** Guarda la posición del cursor en la tarjeta para el brillo radial. */
function seguirCursor(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export default function Temario() {
  const [open, setOpen] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section id="temario" ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      <div className="bg-stage-grid absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]" />
      <div className="page">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          {/* Sticky intro with the section image */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              eyebrow="Contenido del curso"
              title="5 módulos, 20 horas, un proyecto propio."
              intro="Recorres las cuatro etapas de una producción y cierras con un taller donde aplicas todo a tu proyecto."
            />
            <motion.img
              src="/img/laptop-temario.webp"
              alt=""
              aria-hidden
              style={{ y }}
              className="relative mt-12 hidden w-80 drop-shadow-[0_30px_40px_rgba(46,37,162,0.35)] lg:block"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          {/* Module accordion */}
          <motion.ol
            className="flex flex-col gap-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            variants={stagger(0.08)}
          >
            {MODULOS.map((m, i) => {
              const isOpen = open === i;
              return (
                <motion.li key={m.numero} variants={fadeUp}>
                  <div
                    className={`overflow-hidden rounded-3xl border transition-[background-color,border-color,box-shadow] duration-500 ${
                      isOpen
                        ? 'border-accent/40 bg-surface shadow-[0_30px_60px_-30px_rgba(46,37,162,0.45)]'
                        : 'border-line/10 bg-surface/50 hover:border-line/25'
                    }`}
                  >
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? -1 : i)}
                        aria-expanded={isOpen}
                        aria-controls={`modulo-${m.numero}`}
                        className="flex w-full items-center gap-4 p-5 text-left sm:gap-6 sm:p-6"
                      >
                        <span
                          className={`font-display text-4xl font-bold tabular-nums transition-colors duration-500 sm:text-5xl ${
                            isOpen ? 'text-accent' : 'text-ink/25'
                          }`}
                        >
                          {m.numero}
                        </span>
                        <span className="flex-1">
                          <span className="block font-display text-xs font-semibold uppercase tracking-[0.2em] text-text/60">
                            Módulo {i + 1}
                          </span>
                          <span className="mt-0.5 block text-xl font-bold leading-tight text-ink sm:text-2xl">{m.titulo}</span>
                        </span>
                        <motion.span
                          animate={{ rotate: isOpen ? 45 : 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors ${
                            isOpen ? 'border-accent bg-accent text-white' : 'border-line/20 text-ink'
                          }`}
                        >
                          <Plus size={18} aria-hidden />
                        </motion.span>
                      </button>
                    </h3>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`modulo-${m.numero}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="px-5 pb-6 sm:pl-[6.5rem] sm:pr-8">
                            <p className="text-text/90">
                              <Copy text={m.resumen} />
                            </p>
                            <ul className="mt-4 flex flex-wrap gap-2">
                              {m.temas.map((t, k) => (
                                <motion.li
                                  key={t}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.1 + k * 0.05 }}
                                  className="rounded-full border border-accent/25 bg-accent/[0.07] px-3 py-1 text-sm font-medium text-ink"
                                >
                                  {t}
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
          </motion.ol>
        </div>

        {/* What you'll learn */}
        <div id="aprendizajes" className="mt-28">
          <SectionHeading eyebrow="Lo que vas a aprender" title="Lo que te llevas al terminar." />
          <motion.ul
            className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            variants={stagger(0.07)}
          >
            {APRENDIZAJES.map((a, i) => {
              const Icono = ICONOS_APRENDIZAJE[i] ?? Compass;
              return (
                <motion.li
                  key={a.titulo}
                  variants={fadeUp}
                  onMouseMove={seguirCursor}
                  className="card group relative isolate overflow-hidden p-6 transition-[transform,box-shadow] duration-500 hover:-translate-y-1 hover:shadow-[0_30px_60px_-25px_rgba(92,75,216,0.6)]"
                >
                  {/* Degradado de marca que aparece al pasar el cursor */}
                  <span
                    className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-indigo via-brand-violet to-brand-plum opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
                    aria-hidden
                  />
                  {/* Brillo que sigue al cursor */}
                  <span
                    className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        'radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), rgba(191,119,210,0.55), rgba(170,50,119,0.25) 45%, transparent 70%)',
                    }}
                    aria-hidden
                  />
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-violet to-brand-plum text-white shadow-lg shadow-brand-violet/30 ring-1 ring-white/0 transition-all duration-500 group-hover:bg-none group-hover:bg-white/15 group-hover:shadow-none group-hover:ring-white/30">
                    <Icono size={20} strokeWidth={2} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-bold leading-snug text-ink transition-colors duration-500 group-hover:text-white">
                    {a.titulo}
                  </h3>
                  <p className="mt-2 text-sm text-text/85 transition-colors duration-500 group-hover:text-white/90">
                    <Copy text={a.texto} />
                  </p>
                </motion.li>
              );
            })}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}

import { useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { APRENDIZAJES, MODULOS } from '../content/curso';
import { Copy, SectionHeading } from '../components/ui';
import { fadeUp, stagger } from '../components/motion';

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
            {APRENDIZAJES.map((a) => (
              <motion.li
                key={a.titulo}
                variants={fadeUp}
                className="card group relative overflow-hidden p-6 transition-transform duration-500 hover:-translate-y-1"
              >
                <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-brand-violet via-brand-orchid to-brand-magenta transition-transform duration-500 group-hover:scale-x-100" />
                <Sparkles size={20} className="text-highlight" aria-hidden />
                <h3 className="mt-4 text-lg font-bold leading-snug text-ink">{a.titulo}</h3>
                <p className="mt-2 text-sm text-text/85">
                  <Copy text={a.texto} />
                </p>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}

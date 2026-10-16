import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { CURSO, MARQUESINA } from '../content/curso';
import { Reveal, SectionHeading } from '../components/ui';
import { fadeUp, stagger } from '../components/motion';

export function Marquee() {
  const words = [...MARQUESINA, ...MARQUESINA];
  return (
    <div className="relative overflow-hidden border-y border-line/10 bg-brand-indigo py-5 text-white dark:bg-surface" aria-hidden>
      <div className="marquee-track flex w-max items-center gap-10 whitespace-nowrap">
        {words.map((w, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-2xl font-semibold uppercase tracking-[0.14em] sm:text-3xl">
            {w}
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-brand-orchid">
              <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ParaQuien() {
  return (
    <section id="curso" className="relative py-24 sm:py-32">
      <div className="page grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="El curso"
            title={
              <>
                De la idea <span className="gradient-text">al escenario</span>, de principio a fin.
              </>
            }
            intro="Producir no es solo conseguir recursos: es convertir un proyecto en realidad con tiempos, equipo, presupuesto y ejecución. Este curso te da el mapa completo."
          />
          <Reveal delay={0.2} className="mt-10 flex items-center gap-5 rounded-3xl border border-line/10 bg-surface/50 p-5 backdrop-blur">
            <span className="font-display text-5xl font-bold text-accent sm:text-6xl">+120</span>
            <p className="text-sm text-text/85">{CURSO.historia}</p>
          </Reveal>
        </div>

        <motion.ul
          className="grid gap-4 sm:grid-cols-2"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          variants={stagger(0.1)}
        >
          <motion.li variants={fadeUp} className="sm:col-span-2">
            <p className="font-display text-xl font-semibold uppercase tracking-[0.14em] text-ink">Es para ti si…</p>
          </motion.li>
          {CURSO.publico.map((p, i) => (
            <motion.li
              key={p}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="card group relative overflow-hidden p-6"
            >
              <span className="pointer-events-none absolute -bottom-6 right-3 font-display text-8xl font-bold text-ink/[0.05] transition-colors duration-500 group-hover:text-accent/10">
                0{i + 1}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-plum text-white shadow-lg shadow-brand-violet/30">
                <Check size={18} aria-hidden />
              </span>
              <p className="relative mt-4 text-lg font-medium leading-snug text-ink">{p}</p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

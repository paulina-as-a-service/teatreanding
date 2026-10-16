import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { DOCENTE } from '../content/curso';
import { Copy, SectionHeading } from '../components/ui';
import { fadeUp, stagger } from '../components/motion';

export default function Docente() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const photoY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const objY = useTransform(scrollYProgress, [0, 1], [120, -120]);
  const objRotate = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  return (
    <section id="docente" ref={ref} className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute left-1/2 top-1/3 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-brand-lilac/50 blur-3xl dark:bg-brand-indigo/30" />
      <div className="page grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Portrait */}
        <motion.div
          className="relative mx-auto w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '0px 0px -15% 0px' }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-br from-brand-violet via-brand-orchid to-brand-magenta opacity-70 blur-xl" />
          <motion.div style={{ y: photoY }} className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-brand-charcoal">
            <motion.img
              src={DOCENTE.foto}
              alt={`Retrato de ${DOCENTE.nombre}`}
              className="aspect-[4/5] w-full object-cover object-top"
              initial={{ scale: 1.15 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              loading="lazy"
            />
            {/* Stage light sweep */}
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.18)_50%,transparent_65%)]"
              initial={{ x: '-100%' }}
              whileInView={{ x: '100%' }}
              viewport={{ once: true }}
              transition={{ duration: 1.6, delay: 0.4, ease: 'easeInOut' }}
            />
          </motion.div>
          <motion.img
            src="/img/spiral.webp"
            alt=""
            aria-hidden
            style={{ y: objY, rotate: objRotate }}
            className="absolute -right-10 -top-10 w-28 drop-shadow-[0_20px_30px_rgba(46,37,162,0.4)] sm:-right-16 sm:w-36"
          />
          <motion.img
            src="/img/icosphere.webp"
            alt=""
            aria-hidden
            style={{ y: photoY }}
            className="absolute -bottom-8 -left-8 w-24 drop-shadow-[0_20px_30px_rgba(46,37,162,0.4)] sm:-left-14 sm:w-32"
          />
        </motion.div>

        {/* Bio */}
        <div>
          <SectionHeading eyebrow="Quién imparte" title={DOCENTE.nombre} />
          <motion.ul
            className="mt-5 flex flex-wrap gap-2"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            variants={stagger(0.08, 0.2)}
          >
            {DOCENTE.cargos.map((c) => (
              <motion.li
                key={c}
                variants={fadeUp}
                className="rounded-full border border-accent/25 bg-accent/[0.07] px-4 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.12em] text-ink"
              >
                {c}
              </motion.li>
            ))}
          </motion.ul>
          <motion.p
            className="mt-6 text-lg text-text/90"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.7 }}
          >
            <Copy text={DOCENTE.semblanza} />
          </motion.p>

          <h3 className="mt-12 font-display text-xl font-semibold uppercase tracking-[0.16em] text-ink">Trayectoria</h3>
          <motion.ol
            className="relative mt-6 space-y-6 border-l border-line/15 pl-8"
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            variants={stagger(0.12)}
          >
            {DOCENTE.trayectoria.map((t, i) => (
              <motion.li key={i} variants={fadeUp} className="relative">
                <span className="absolute -left-[2.45rem] top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-accent bg-bg">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                </span>
                <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-accent">{t.anio}</p>
                <p className="text-lg font-bold text-ink">{t.titulo}</p>
                <p className="text-sm text-text/80">
                  <Copy text={t.detalle} />
                </p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </div>
    </section>
  );
}

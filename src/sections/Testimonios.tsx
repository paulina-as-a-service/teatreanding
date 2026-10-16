import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { TESTIMONIOS } from '../content/curso';
import { SectionHeading } from '../components/ui';
import { fadeUp, stagger } from '../components/motion';

export default function Testimonios() {
  return (
    <section id="testimonios" className="relative overflow-hidden py-24 sm:py-32">
      <div className="bg-stage-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <div className="page">
        <SectionHeading
          align="center"
          eyebrow="Testimonios"
          title="Lo que dice nuestra comunidad"
          intro="Quienes ya pasaron por los seminarios de Teatranding!"
        />
        <motion.ul
          className="mt-14 grid gap-5 md:grid-cols-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          variants={stagger(0.12)}
        >
          {TESTIMONIOS.map((t, i) => (
            <motion.li
              key={i}
              variants={fadeUp}
              whileHover={{ y: -8, rotate: i % 2 === 0 ? -0.6 : 0.6 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className={`card relative flex flex-col p-7 ${t.pendiente ? '!border-dashed !border-highlight/40' : ''} ${
                i === 1 ? 'md:translate-y-8' : ''
              }`}
            >
              <Quote size={34} className="text-accent/40" aria-hidden />
              <blockquote className={`mt-4 flex-1 text-lg leading-relaxed ${t.pendiente ? 'italic text-text/60' : 'text-ink'}`}>
                {t.texto}
              </blockquote>
              <footer className="mt-6 flex items-center gap-3 border-t border-line/10 pt-5">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-plum font-display text-lg font-bold text-white">
                  {t.pendiente ? '?' : t.nombre.charAt(0)}
                </span>
                <span>
                  <span className="block font-bold text-ink">{t.nombre}</span>
                  <span className="block text-sm text-text/70">{t.rol}</span>
                </span>
              </footer>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}

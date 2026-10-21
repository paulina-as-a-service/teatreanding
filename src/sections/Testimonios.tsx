import { GraduationCap, Quote } from 'lucide-react';
import { TESTIMONIOS } from '../content/curso';
import { Reveal, SectionHeading } from '../components/ui';

/** Ticker de reseñas: la lista se duplica para que el loop de derecha a izquierda no tenga cortes. */
export default function Testimonios() {
  const vuelta = [...TESTIMONIOS, ...TESTIMONIOS];

  return (
    <section id="testimonios" className="relative overflow-hidden py-24 sm:py-32">
      <div className="bg-stage-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <div className="page">
        <SectionHeading
          align="center"
          eyebrow="Testimonios"
          title="Lo que dice nuestra comunidad"
          intro="Quienes ya pasaron por los cursos, seminarios y workshops de Teatranding!"
        />
      </div>

      <Reveal className="resenas-ticker relative mt-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <ul className="resenas-track flex w-max py-6">
          {vuelta.map((t, i) => {
            const copia = i >= TESTIMONIOS.length;
            return (
              <li key={i} aria-hidden={copia || undefined} className="w-[20rem] shrink-0 pr-5 sm:w-[26rem]">
                <figure className="card flex h-full flex-col p-7">
                  <Quote size={34} className="text-accent/40" aria-hidden />
                  <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-ink">“{t.texto}”</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-line/10 pt-5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-plum text-white">
                      <GraduationCap size={18} aria-hidden />
                    </span>
                    <span className="text-sm font-medium text-text/80">{t.programa}</span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}

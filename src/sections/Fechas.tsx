import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Award, Check, CreditCard, Globe2, MonitorPlay, Timer } from 'lucide-react';
import { CURSO, HORARIO_CDMX, SESIONES, ZONA_CURSO } from '../content/curso';
import { SectionHeading } from '../components/ui';
import { fadeUp, stagger } from '../components/motion';
import { formatDay, formatHour, userTimeZone, zoneLabel } from '../lib/time';

const START = new Date(SESIONES[0].inicioUTC).getTime();
const END = new Date(SESIONES[SESIONES.length - 1].finUTC).getTime();

function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const diff = Math.max(0, START - now);
  return {
    status: now < START ? 'antes' : now < END ? 'en-curso' : 'terminado',
    dias: Math.floor(diff / 86_400_000),
    horas: Math.floor((diff / 3_600_000) % 24),
    minutos: Math.floor((diff / 60_000) % 60),
    segundos: Math.floor((diff / 1000) % 60),
  } as const;
}

function Digit({ value, label }: { value: number; label: string }) {
  const v = String(value).padStart(2, '0');
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-14 w-full overflow-hidden rounded-2xl bg-white/10 sm:h-16">
        <AnimatePresence initial={false}>
          <motion.span
            key={v}
            initial={{ y: '-100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 grid place-items-center font-display text-3xl font-bold tabular-nums sm:text-4xl"
          >
            {v}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="mt-2 font-display text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white/70">{label}</span>
    </div>
  );
}

export default function Fechas() {
  const c = useCountdown();
  const tz = useMemo(userTimeZone, []);
  const localStart = formatHour(SESIONES[0].inicioUTC, tz);
  const localEnd = formatHour(SESIONES[0].finUTC, tz);
  const differentZone = localStart !== HORARIO_CDMX.inicio;
  const precio = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(
    CURSO.precio.monto
  );

  return (
    <section id="fechas" className="relative py-24 sm:py-32">
      <div className="page">
        <SectionHeading
          eyebrow="Costo, fechas y horario"
          title={
            <>
              Cinco sábados. <span className="gradient-text">Una producción completa.</span>
            </>
          }
        />

        <motion.div
          className="mt-12 grid gap-4 lg:grid-cols-6"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          variants={stagger(0.1)}
        >
          {/* Price */}
          <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-indigo via-brand-violet to-brand-plum p-7 text-white shadow-[0_30px_80px_-30px_rgba(46,37,162,0.8)] sm:p-8 lg:col-span-2"
          >
            <img src="/img/cube.webp" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 w-44 opacity-60 mix-blend-screen" />
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-white/75">Inversión</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-6xl font-bold leading-none sm:text-7xl">{precio}</span>
              <span className="font-display text-xl font-semibold">{CURSO.precio.moneda}</span>
            </p>
            <p className="mt-2 text-white/85">{CURSO.precio.nota}</p>
            <ul className="mt-6 space-y-2 text-sm text-white/85">
              <li className="flex items-start gap-2">
                <Award size={16} className="mt-0.5 shrink-0" aria-hidden /> Reconocimiento por {CURSO.duracionHoras} horas (con 100% de asistencia)
              </li>
              <li className="flex items-center gap-2">
                <CreditCard size={16} aria-hidden /> Tarjeta de crédito o débito, a través de Clip
              </li>
            </ul>
            <a href="#inscripcion" className="btn relative mt-8 bg-white text-brand-indigo hover:-translate-y-0.5">
              Inscribirme <ArrowRight size={18} aria-hidden />
            </a>
          </motion.div>

          {/* Sessions */}
          <motion.div variants={fadeUp} className="card p-7 sm:p-8 lg:col-span-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">Sesiones</p>
                <p className="mt-2 text-2xl font-bold text-ink">
                  Sábados, de {HORARIO_CDMX.inicio} a {HORARIO_CDMX.fin} h
                </p>
                <p className="text-sm text-text/80">Hora de la Ciudad de México (CDMX, UTC-6)</p>
              </div>
              <p className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-medium text-ink">
                <Timer size={15} aria-hidden /> 5 sesiones de 4 horas
              </p>
            </div>
            <ol className="mt-7 grid grid-cols-5 gap-2 sm:gap-3">
              {SESIONES.map((s, i) => {
                const d = formatDay(s.inicioUTC, ZONA_CURSO);
                return (
                  <motion.li
                    key={s.inicioUTC}
                    initial={{ opacity: 0, y: 20, rotateX: -60 }}
                    whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25 + i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -4 }}
                    className="group flex flex-col items-center rounded-2xl border border-line/10 bg-bg/60 px-1 py-3 text-center [perspective:600px] sm:py-4"
                  >
                    <span className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-text/60 sm:text-xs">
                      {d.weekday}
                    </span>
                    <span className="font-display text-3xl font-bold leading-tight text-ink transition-colors group-hover:text-accent sm:text-4xl">
                      {d.day}
                    </span>
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-accent">{d.month}</span>
                  </motion.li>
                );
              })}
            </ol>
            {differentZone && (
              <p className="mt-5 flex items-start gap-2 rounded-2xl bg-highlight/10 px-4 py-3 text-sm text-ink">
                <Globe2 size={16} className="mt-0.5 shrink-0 text-highlight" aria-hidden />
                <span>
                  En tu zona horaria ({zoneLabel(tz)}): de <strong>{localStart}</strong> a <strong>{localEnd}</strong> h.
                </span>
              </p>
            )}
          </motion.div>

          {/* Modality */}
          <motion.div variants={fadeUp} className="card flex items-center gap-5 p-7 sm:p-8 lg:col-span-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-violet to-brand-plum text-white">
              <MonitorPlay size={24} aria-hidden />
            </span>
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">Modalidad</p>
              <p className="mt-1 text-xl font-bold text-ink">En línea por Zoom</p>
              <p className="text-sm text-text/80">{CURSO.duracionHoras} horas en vivo, desde donde estés.</p>
            </div>
          </motion.div>

          {/* Countdown */}
          <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-3xl bg-brand-charcoal p-7 text-white dark:bg-[#231d55] sm:p-8 lg:col-span-3"
          >
            {c.status === 'antes' ? (
              <>
                <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-orchid">
                  Se levanta el telón en
                </p>
                <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-live="off">
                  <Digit value={c.dias} label="Días" />
                  <Digit value={c.horas} label="Horas" />
                  <Digit value={c.minutos} label="Min" />
                  <Digit value={c.segundos} label="Seg" />
                </div>
              </>
            ) : (
              <p className="font-display text-2xl font-semibold uppercase tracking-[0.12em]">
                {c.status === 'en-curso' ? 'El curso está en marcha' : 'Esta edición ya terminó'}
              </p>
            )}
          </motion.div>

          {/* Certificate */}
          <motion.div variants={fadeUp} className="card group relative overflow-hidden p-7 sm:p-8 lg:col-span-6">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-orchid/20 blur-3xl" aria-hidden />
            <div className="relative grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
              <div>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-violet to-brand-plum text-white">
                  <Award size={24} aria-hidden />
                </span>
                <p className="mt-5 font-display text-sm font-semibold uppercase tracking-[0.2em] text-accent">Al terminar</p>
                <p className="mt-1 text-2xl font-bold leading-tight text-ink sm:text-3xl">{CURSO.reconocimiento.titulo}</p>
                <p className="mt-3 text-text/85">{CURSO.reconocimiento.texto}</p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-sm font-medium text-ink">
                  <Check size={15} className="text-accent" aria-hidden /> {CURSO.reconocimiento.condicion}
                </p>
              </div>
              <motion.div
                className="relative mx-auto w-full max-w-md [perspective:1200px]"
                initial={{ opacity: 0, rotateX: 25, rotateZ: -6, y: 30 }}
                whileInView={{ opacity: 1, rotateX: 0, rotateZ: -3, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <img
                  src={CURSO.reconocimiento.imagen}
                  alt="Diseño del reconocimiento de participación del curso"
                  loading="lazy"
                  className="w-full rounded-xl border border-white/40 shadow-[0_30px_60px_-20px_rgba(46,37,162,0.55)] transition-transform duration-700 group-hover:rotate-3 group-hover:scale-[1.03]"
                />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

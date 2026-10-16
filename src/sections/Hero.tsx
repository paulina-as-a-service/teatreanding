import { useEffect, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowDown, ArrowRight, CalendarDays, Clock, MonitorPlay, Timer } from 'lucide-react';
import { CURSO } from '../content/curso';
import { fadeUp, stagger } from '../components/motion';

type Obj = {
  src: string;
  className: string;
  depth: number;
  float: number;
  spin: number;
  delay: number;
  mobileHidden?: boolean;
};

// Glass objects from the course key visual
const OBJECTS: Obj[] = [
  { src: '/img/tablet.webp', className: 'left-[18%] top-[22%] w-[52%]', depth: 0.6, float: 7, spin: 4, delay: 0.1 },
  { src: '/img/palette.webp', className: 'left-[2%] bottom-[2%] w-[40%]', depth: 1, float: 8, spin: -5, delay: 0.25 },
  { src: '/img/usb.webp', className: 'right-[4%] top-[0%] w-[22%]', depth: 1.3, float: 6, spin: 8, delay: 0.35 },
  { src: '/img/x.webp', className: 'left-[2%] top-[4%] w-[22%]', depth: 1.6, float: 9, spin: 12, delay: 0.45 },
  { src: '/img/gem.webp', className: 'right-[0%] top-[38%] w-[18%]', depth: 1.8, float: 6.5, spin: -10, delay: 0.55, mobileHidden: true },
  { src: '/img/torus.webp', className: 'right-[6%] bottom-[0%] w-[30%]', depth: 1.2, float: 7.5, spin: 6, delay: 0.65 },
  { src: '/img/triangle.webp', className: 'left-[40%] bottom-[-4%] w-[18%]', depth: 2, float: 5.5, spin: -14, delay: 0.75, mobileHidden: true },
];

function FloatingObject({
  obj,
  mx,
  my,
  scroll,
}: {
  obj: Obj;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  scroll: MotionValue<number>;
}) {
  const x = useTransform(mx, (v) => v * obj.depth * 36);
  const yMouse = useTransform(my, (v) => v * obj.depth * 28);
  const yScroll = useTransform(scroll, [0, 1], [0, -160 * obj.depth]);
  const y = useTransform([yMouse, yScroll], ([a, b]) => (a as number) + (b as number));

  return (
    <motion.div
      className={`absolute ${obj.className} ${obj.mobileHidden ? 'hidden sm:block' : ''}`}
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.6, rotate: obj.spin * 3 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 1.1, delay: 0.3 + obj.delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.img
        src={obj.src}
        alt=""
        draggable={false}
        className="w-full select-none drop-shadow-[0_30px_40px_rgba(46,37,162,0.35)]"
        animate={{ y: [0, -14, 0], rotate: [0, obj.spin, 0] }}
        transition={{ duration: obj.float, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

const FACTS = [
  { icon: CalendarDays, label: 'Inicia', value: 'Sáb 14 de noviembre' },
  { icon: Clock, label: 'Horario', value: '10:00 a 14:00 h (CDMX)' },
  { icon: Timer, label: 'Duración', value: '20 horas, 5 sesiones' },
  { icon: MonitorPlay, label: 'Modalidad', value: 'En línea por Zoom' },
];

const maskLine = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const mxRaw = useMotionValue(0);
  const myRaw = useMotionValue(0);
  const mx = useSpring(mxRaw, { stiffness: 60, damping: 18 });
  const my = useSpring(myRaw, { stiffness: 60, damping: 18 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // Pointer-driven spotlight + parallax (no React re-render per move)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
      el.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
      mxRaw.set((e.clientX - r.left) / r.width - 0.5);
      myRaw.set((e.clientY - r.top) / r.height - 0.5);
    };
    el.addEventListener('pointermove', onMove);
    return () => el.removeEventListener('pointermove', onMove);
  }, [mxRaw, myRaw]);

  return (
    <section
      id="inicio"
      ref={ref}
      className="relative isolate overflow-hidden pb-16 pt-28 sm:pt-32 lg:flex lg:min-h-[100svh] lg:items-center lg:pb-20"
      style={{ ['--spot-x' as string]: '70%', ['--spot-y' as string]: '30%' }}
    >
      {/* Background layers */}
      <div className="bg-stage-grid absolute inset-0 -z-20 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
      <div className="absolute -right-40 -top-40 -z-20 h-[38rem] w-[38rem] rounded-full bg-brand-lilac/60 blur-3xl dark:bg-brand-indigo/40" />
      <div className="absolute -bottom-40 -left-32 -z-20 h-[30rem] w-[30rem] rounded-full bg-brand-orchid/25 blur-3xl dark:bg-brand-plum/25" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 hidden transition-opacity duration-500 sm:block"
        style={{
          background:
            'radial-gradient(520px circle at var(--spot-x) var(--spot-y), rgb(var(--accent) / 0.13), transparent 60%)',
        }}
      />

      <div className="page grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <motion.div style={{ y: contentY, opacity: contentOpacity }}>
          <motion.div initial="hidden" animate="show" variants={stagger(0.09, 0.1)}>
            <motion.p
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-line/15 bg-surface/60 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent backdrop-blur sm:text-sm sm:tracking-[0.18em]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-orchid opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-plum dark:bg-brand-orchid" />
              </span>
              Curso en línea <span aria-hidden>·</span> Inscripciones abiertas
            </motion.p>

            <h1 className="mt-6 text-ink">
              <span className="block overflow-hidden">
                <motion.span variants={maskLine} className="block font-display text-2xl font-medium sm:text-3xl">
                  Curso {CURSO.titulo.antes}
                </motion.span>
              </span>
              <span className="block overflow-hidden pb-1">
                <motion.span
                  variants={maskLine}
                  className="block font-display text-[3.4rem] font-bold uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-[5.6rem]"
                >
                  Producción
                </motion.span>
              </span>
              <span className="block overflow-hidden pb-2">
                <motion.span
                  variants={maskLine}
                  className="gradient-text block font-display text-[3.4rem] font-bold uppercase leading-[0.92] tracking-tight sm:text-7xl lg:text-[5.6rem]"
                >
                  Creativa
                </motion.span>
              </span>
              <span className="block overflow-hidden">
                <motion.span variants={maskLine} className="block font-display text-2xl font-medium sm:text-3xl">
                  {CURSO.titulo.despues}.
                </motion.span>
              </span>
            </h1>

            <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg text-text/90">
              {CURSO.descripcion}
            </motion.p>

            <motion.p variants={fadeUp} className="mt-4 font-medium text-ink">
              Imparte: <span className="underline decoration-brand-orchid decoration-2 underline-offset-4">{CURSO.docente}</span>
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#inscripcion" className="btn-primary">
                Aparta tu lugar <ArrowRight size={18} aria-hidden />
              </a>
              <a href="#temario" className="btn-ghost">
                Ver temario
              </a>
            </motion.div>

            <motion.dl variants={stagger(0.06)} className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FACTS.map(({ icon: Icon, label, value }) => (
                <motion.div key={label} variants={fadeUp} className="rounded-2xl border border-line/10 bg-surface/50 p-3 backdrop-blur">
                  <dt className="flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                    <Icon size={14} aria-hidden /> {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium leading-snug text-ink">{value}</dd>
                </motion.div>
              ))}
            </motion.dl>
          </motion.div>
        </motion.div>

        <div className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-md lg:max-w-none" aria-hidden>
          {OBJECTS.map((o) => (
            <FloatingObject key={o.src} obj={o} mx={mx} my={my} scroll={scrollYProgress} />
          ))}
        </div>
      </div>

      <motion.a
        href="#curso"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 font-display text-xs font-semibold uppercase tracking-[0.2em] text-text/60 lg:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        aria-label="Bajar a la descripción del curso"
      >
        Desliza
        <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
          <ArrowDown size={16} />
        </motion.span>
      </motion.a>
    </section>
  );
}

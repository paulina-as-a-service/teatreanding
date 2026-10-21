import { MotionConfig } from 'framer-motion';
import Header from './components/Header';
import { useTheme } from './hooks/useTheme';
import Hero from './sections/Hero';
import ParaQuien, { Marquee } from './sections/ParaQuien';
import Temario from './sections/Temario';
import Fechas from './sections/Fechas';
import Docente from './sections/Docente';
import Testimonios from './sections/Testimonios';
import Inscripcion from './sections/Inscripcion';
import AvisoPrivacidad from './sections/AvisoPrivacidad';
import Footer from './sections/Footer';
import PagoRetorno from './components/PagoRetorno';
import PagarDirecto from './components/PagarDirecto';
import RevisionEstudiante from './components/RevisionEstudiante';

/** Student-discount review page for Mauricio (link from his notification email). */
const esRevision = () => new URLSearchParams(window.location.search).has('revision');

export default function App() {
  const { theme, setTheme } = useTheme();

  if (esRevision()) return <RevisionEstudiante />;

  return (
    // Respect the visitor's reduced-motion setting across all Framer Motion animations
    <MotionConfig reducedMotion="user">
      <a
        href="#inscripcion"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        Saltar a la inscripción
      </a>
      <Header theme={theme} setTheme={setTheme} />
      <main>
        <Hero />
        <Marquee />
        <ParaQuien />
        <Temario />
        <Fechas />
        <Docente />
        <Testimonios />
        <Inscripcion />
        <AvisoPrivacidad />
      </main>
      <Footer />
      <PagoRetorno />
      <PagarDirecto />
    </MotionConfig>
  );
}

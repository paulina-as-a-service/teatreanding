import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Loader2, Mail, X } from 'lucide-react';
import { CURSO } from '../content/curso';
import { obtenerLinkPago } from '../lib/inscripcion';
import { montos, type Opciones } from '../lib/precios';
import OpcionesPago from './OpcionesPago';

type Vista = 'cargando' | 'elegir' | 'pagado' | 'en-revision' | 'cerrado' | 'error' | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Link sent by email (student-discount decision, pago 2, pago 3): /?pagar=<registration id>.
 * Asks `inscripcion` for a fresh Clip link for the next payment and goes straight to it, so the link in the
 * email never expires. Before the first payment, it shows the choice "apartar con $500" / "pagar completo".
 */
function leerId() {
  if (typeof window === 'undefined') return null; // build-time prerender
  const id = new URLSearchParams(window.location.search).get('pagar') ?? '';
  return UUID_RE.test(id) ? id : null;
}

export default function PagarDirecto() {
  const [id] = useState(leerId);
  const [vista, setVista] = useState<Vista>(id ? 'cargando' : null);
  const [opciones, setOpciones] = useState<Opciones | null>(null);

  useEffect(() => {
    if (!id) return;
    let activo = true;
    (async () => {
      try {
        const r = await obtenerLinkPago(id);
        if (!activo) return;
        if (r.ya_pagado) return setVista('pagado');
        if (r.en_revision) return setVista('en-revision');
        if (r.cerrado) return setVista('cerrado');
        if (r.requiere_plan) {
          setOpciones(r.opciones ?? montos(r.total ?? CURSO.precio.monto));
          return setVista('elegir');
        }
        if (r.payment_url) {
          window.location.replace(r.payment_url);
          return;
        }
        setVista('error');
      } catch {
        if (activo) setVista('error');
      }
    })();
    return () => {
      activo = false;
    };
  }, [id]);

  const cerrar = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    setVista(null);
  };

  return (
    <AnimatePresence>
      {vista && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-[#0e0b26]/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pagar-titulo"
            className={`card relative w-full ${vista === 'elegir' ? 'max-w-2xl' : 'max-w-md'} max-h-[calc(100dvh-2rem)] overflow-y-auto !bg-surface p-6 text-center sm:p-8`}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
          >
            {vista !== 'cargando' && (
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-text/60 hover:bg-ink/5 hover:text-ink"
              >
                <X size={18} />
              </button>
            )}
            <span
              className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-white shadow-lg ${
                vista === 'error' || vista === 'cerrado' ? 'bg-[#c0266d]' : 'bg-gradient-to-br from-brand-violet to-brand-plum'
              }`}
            >
              {vista === 'cargando' && <Loader2 size={28} className="animate-spin" aria-hidden />}
              {(vista === 'pagado' || vista === 'en-revision' || vista === 'elegir') && <Check size={28} aria-hidden />}
              {(vista === 'error' || vista === 'cerrado') && <AlertCircle size={28} aria-hidden />}
            </span>
            <h2 id="pagar-titulo" className="mt-6 text-2xl font-bold text-ink">
              {vista === 'cargando' && 'Preparando tu pago'}
              {vista === 'elegir' && 'Elige cómo pagar'}
              {vista === 'cerrado' && 'Las inscripciones ya cerraron'}
              {vista === 'pagado' && 'Tu pago ya está registrado'}
              {vista === 'en-revision' && 'Tu solicitud sigue en revisión'}
              {vista === 'error' && 'No pudimos abrir tu pago'}
            </h2>
            <p className="mt-3 text-text/85" aria-live="polite">
              {vista === 'cargando' && 'Te llevamos a la página segura de Clip.'}
              {vista === 'elegir' && 'Paga el curso completo o aparta tu lugar hoy y liquida el resto en 2 pagos.'}
              {vista === 'cerrado' &&
                'El curso arrancó el 14 de noviembre y ya no recibimos nuevas inscripciones. Escríbenos si tienes dudas.'}
              {vista === 'pagado' && 'No necesitas pagar de nuevo. Los detalles del curso llegaron a tu correo.'}
              {vista === 'en-revision' &&
                'Todavía estamos revisando tu credencial de estudiante. Te escribimos por correo en cuanto tengamos el resultado.'}
              {vista === 'error' && 'Intenta de nuevo en unos minutos o escríbenos y te ayudamos.'}
            </p>
            {vista === 'elegir' && opciones && id && (
              <OpcionesPago id={id} opciones={opciones} onCerrado={() => setVista('cerrado')} />
            )}
            {vista !== 'cargando' && (
              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-text/70">
                <Mail size={15} aria-hidden /> ¿Dudas?{' '}
                <a className="font-semibold text-accent underline" href={`mailto:${CURSO.contacto.email}`}>
                  {CURSO.contacto.email}
                </a>
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

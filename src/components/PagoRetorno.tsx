import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Loader2, Mail, RefreshCw, X } from 'lucide-react';
import { CURSO } from '../content/curso';
import { consultarPago, obtenerLinkPago } from '../lib/inscripcion';

type Vista = 'confirmando' | 'confirmado' | 'en-proceso' | 'error' | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads Clip's redirect (?pago=exito|error&ref=<id>) and shows the outcome. */
function leerRetorno() {
  const p = new URLSearchParams(window.location.search);
  const pago = p.get('pago');
  const ref = p.get('ref') ?? '';
  if ((pago !== 'exito' && pago !== 'error') || !UUID_RE.test(ref)) return null;
  return { pago, ref } as const;
}

export default function PagoRetorno() {
  const [retorno] = useState(leerRetorno);
  const [vista, setVista] = useState<Vista>(() =>
    retorno ? (retorno.pago === 'exito' ? 'confirmando' : 'error') : null
  );
  const [cargando, setCargando] = useState(false);

  // Remove the query string so a reload doesn't show this again.
  useEffect(() => {
    if (retorno) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  }, [retorno]);

  // After a successful redirect, wait for Clip's notification to mark the payment (up to ~45 s).
  useEffect(() => {
    if (!retorno || retorno.pago !== 'exito') return;
    let activo = true;
    let intentos = 0;
    const revisar = async () => {
      intentos += 1;
      try {
        const r = await consultarPago(retorno.ref);
        if (!activo) return;
        if (r.pagado) return setVista('confirmado');
      } catch {
        /* keep waiting */
      }
      if (!activo) return;
      if (intentos >= 15) setVista('en-proceso');
      else window.setTimeout(revisar, 3000);
    };
    revisar();
    return () => {
      activo = false;
    };
  }, [retorno]);

  const reintentar = async () => {
    if (!retorno) return;
    setCargando(true);
    try {
      const r = await obtenerLinkPago(retorno.ref);
      if (r.ya_pagado) setVista('confirmado');
      else if (r.payment_url) window.location.href = r.payment_url;
    } catch {
      /* stays on the error view */
    } finally {
      setCargando(false);
    }
  };

  const cerrar = () => setVista(null);

  return (
    <AnimatePresence>
      {vista && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-[#0e0b26]/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={vista === 'confirmando' ? undefined : cerrar}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pago-titulo"
            className="card relative w-full max-w-md !bg-surface p-8 text-center"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {vista !== 'confirmando' && (
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
                vista === 'error' ? 'bg-[#c0266d]' : 'bg-gradient-to-br from-brand-violet to-brand-plum'
              }`}
            >
              {vista === 'confirmando' && <Loader2 size={28} className="animate-spin" aria-hidden />}
              {(vista === 'confirmado' || vista === 'en-proceso') && <Check size={30} aria-hidden />}
              {vista === 'error' && <AlertCircle size={30} aria-hidden />}
            </span>

            <h2 id="pago-titulo" className="mt-6 text-2xl font-bold text-ink">
              {vista === 'confirmando' && 'Confirmando tu pago…'}
              {vista === 'confirmado' && '¡Tu lugar está apartado!'}
              {vista === 'en-proceso' && 'Gracias, recibimos tu pago'}
              {vista === 'error' && 'El pago no se completó'}
            </h2>

            <p className="mt-3 text-text/85" aria-live="polite">
              {vista === 'confirmando' && 'Estamos verificando la operación con Clip. Esto toma unos segundos.'}
              {vista === 'confirmado' &&
                'Tu pago quedó registrado. Nos vemos el sábado 14 de noviembre en el curso.'}
              {vista === 'en-proceso' &&
                'Clip aún está confirmando la operación. No necesitas pagar de nuevo; si en unas horas no recibes noticias nuestras, escríbenos.'}
              {vista === 'error' &&
                'Clip no pudo procesar el pago. Puedes intentarlo de nuevo, por ejemplo con otra tarjeta.'}
            </p>

            {vista === 'error' && (
              <button type="button" onClick={reintentar} disabled={cargando} className="btn-primary mt-7">
                {cargando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <RefreshCw size={18} aria-hidden />}{' '}
                Intentar de nuevo
              </button>
            )}

            {vista !== 'confirmando' && (
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

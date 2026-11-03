import { useState } from 'react';
import { AlertCircle, CalendarClock, CreditCard, Loader2 } from 'lucide-react';
import { pesos, type Opciones } from '../lib/precios';
import { obtenerLinkPago, type Plan } from '../lib/inscripcion';

/**
 * First payment of a registration: "Apartar con $500" (then pago 2 on 14 Nov and pago 3 on 30 Nov) or
 * "Pagar completo". Asks `inscripcion` for the Clip link of the chosen option and goes to it.
 */
export default function OpcionesPago({
  id,
  opciones,
  onCerrado,
}: {
  id: string;
  opciones: Opciones;
  /** Sign-ups closed while the page was open. */
  onCerrado?: () => void;
}) {
  const [cargando, setCargando] = useState<Plan | null>(null);
  const [error, setError] = useState(false);

  const elegir = async (plan: Plan) => {
    setCargando(plan);
    setError(false);
    try {
      const r = await obtenerLinkPago(id, plan);
      if (r.payment_url) {
        window.location.href = r.payment_url;
        return;
      }
      if (r.cerrado && onCerrado) {
        onCerrado();
        return;
      }
      setError(true);
    } catch {
      setError(true);
    }
    setCargando(null);
  };

  return (
    <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
      <div className="flex flex-col rounded-2xl border-2 border-accent bg-accent/5 p-5">
        <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <CalendarClock size={15} aria-hidden /> Inscripción flexible
        </p>
        <p className="mt-2 text-xl font-bold text-ink">Aparta con {pesos(opciones.apartado)}</p>
        <p className="mt-2 flex-1 text-sm text-text/85">
          Después pagas <strong className="text-ink">{pesos(opciones.pago2)}</strong> el 14 de noviembre y{' '}
          <strong className="text-ink">{pesos(opciones.pago3)}</strong> el 30 de noviembre. Te mandamos cada enlace por
          correo. El enlace de Zoom llega con tu pago 2.
        </p>
        <button
          type="button"
          onClick={() => elegir('parcialidades')}
          disabled={cargando !== null}
          className="btn-primary mt-5 w-full !px-4"
        >
          {cargando === 'parcialidades' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <CreditCard size={18} aria-hidden />}{' '}
          Apartar mi lugar
        </button>
      </div>

      <div className="flex flex-col rounded-2xl border-2 border-line/15 p-5">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-text/70">Un solo pago</p>
        <p className="mt-2 text-xl font-bold text-ink">Paga {pesos(opciones.completo)}</p>
        <p className="mt-2 flex-1 text-sm text-text/85">
          Liquidas hoy el curso completo y el enlace de Zoom te llega en cuanto se confirme el pago.
        </p>
        <button
          type="button"
          onClick={() => elegir('completo')}
          disabled={cargando !== null}
          className="btn-ghost mt-5 w-full !px-4"
        >
          {cargando === 'completo' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <CreditCard size={18} aria-hidden />}{' '}
          Pagar completo
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-2xl bg-[#c0266d]/10 px-4 py-3 text-sm text-ink sm:col-span-2" role="alert">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#c0266d] dark:text-[#ff8fc4]" aria-hidden />
          No pudimos abrir la página de pago. Intenta de nuevo en unos minutos.
        </p>
      )}
      <p className="text-center text-xs text-text/60 sm:col-span-2">
        Pagas con tarjeta de crédito o débito en la página segura de Clip.
      </p>
    </div>
  );
}

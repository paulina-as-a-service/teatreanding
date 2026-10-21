import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ExternalLink, FileText, Loader2, RefreshCw, X } from 'lucide-react';
import { CURSO } from '../content/curso';
import { decidirRevision, verRevision, type Revision } from '../lib/inscripcion';

/**
 * Review page for Mauricio: /?revision=<signed key>&decision=aprobar|rechazar
 * Reached from the buttons in his notification email. Opening it only reads; nothing changes until
 * "Confirmar" (so email link scanners cannot approve or reject anything).
 */
function leerParams() {
  const p = new URLSearchParams(window.location.search);
  const clave = p.get('revision');
  if (!clave) return null;
  const d = p.get('decision');
  return { clave, decision: d === 'aprobar' || d === 'rechazar' ? d : null } as const;
}

const fmt = (n: number) => `$${n.toLocaleString('es-MX')} ${CURSO.precio.moneda}`;
const fecha = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(
        new Date(iso)
      )
    : '';

type Estado = 'cargando' | 'listo' | 'enviando' | 'hecho' | 'error';

export default function RevisionEstudiante() {
  const [params] = useState(leerParams);
  const [estado, setEstado] = useState<Estado>('cargando');
  const [datos, setDatos] = useState<Revision | null>(null);
  const [decision, setDecision] = useState<'aprobar' | 'rechazar' | null>(params?.decision ?? null);
  const [motivo, setMotivo] = useState('');
  const [resultado, setResultado] = useState<Revision | null>(null);
  const [errorTexto, setErrorTexto] = useState('');

  const cargar = useCallback(async () => {
    if (!params) return;
    setEstado('cargando');
    try {
      const r = await verRevision(params.clave);
      if (!r.ok) {
        setErrorTexto(
          r.error === 'clave'
            ? 'Este enlace no es válido o ya venció. Usa los botones del correo más reciente de esta solicitud.'
            : 'No encontramos esta solicitud.'
        );
        setEstado('error');
        return;
      }
      setDatos(r);
      setEstado('listo');
    } catch {
      setErrorTexto('No pudimos cargar la solicitud. Revisa tu conexión e intenta de nuevo.');
      setEstado('error');
    }
  }, [params]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!params) return null;

  const pendiente = datos?.estado === 'pendiente_documento' || datos?.estado === 'en_revision';
  const puedeConfirmar = !!decision && (decision === 'aprobar' || !!motivo) && estado === 'listo';

  const confirmar = async () => {
    if (!decision || !puedeConfirmar) return;
    setEstado('enviando');
    try {
      const r = await decidirRevision(params.clave, decision, decision === 'rechazar' ? motivo : undefined);
      if (!r.ok) {
        setErrorTexto(
          r.error === 'ya_pagado'
            ? 'Esta persona ya pagó, así que no hay nada que decidir.'
            : 'No se pudo guardar la decisión. Intenta de nuevo.'
        );
        setEstado('error');
        return;
      }
      setResultado(r);
      setEstado('hecho');
    } catch {
      setErrorTexto('No se pudo guardar la decisión. Revisa tu conexión e intenta de nuevo.');
      setEstado('error');
    }
  };

  const nombre = datos ? `${datos.nombre ?? ''} ${datos.apellidos ?? ''}`.trim() : '';
  const esPdf = datos?.documento?.tipo === 'application/pdf' || /\.pdf(\?|$)/i.test(datos?.documento?.url ?? '');

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-accent">Teatranding!</p>
        <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">Descuento para estudiantes</h1>

        {estado === 'cargando' && (
          <p className="mt-10 flex items-center gap-3 text-text/80">
            <Loader2 size={20} className="animate-spin" aria-hidden /> Cargando solicitud…
          </p>
        )}

        {estado === 'error' && (
          <div className="card mt-8 p-6" role="alert">
            <p className="flex items-start gap-3 text-ink">
              <AlertCircle size={20} className="mt-0.5 shrink-0 text-[#c0266d]" aria-hidden />
              <span>{errorTexto}</span>
            </p>
            <button type="button" onClick={cargar} className="btn-primary mt-6">
              <RefreshCw size={18} aria-hidden /> Volver a cargar
            </button>
          </div>
        )}

        {estado === 'hecho' && resultado && (
          <div className="card mt-8 p-6 sm:p-8" role="status">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-plum text-white">
              <Check size={26} aria-hidden />
            </span>
            {resultado.ya_decidido ? (
              <p className="mt-5 text-lg text-ink">
                Esta solicitud ya se había decidido ({resultado.estado === 'validado' ? 'aprobada' : 'rechazada'}). No se
                envió nada nuevo.
              </p>
            ) : (
              <>
                <p className="mt-5 text-lg font-semibold text-ink">
                  {resultado.estado === 'validado' ? 'Descuento aprobado.' : 'Solicitud rechazada.'}
                </p>
                {resultado.correo_enviado ? (
                  <p className="mt-2 text-text/85">
                    Le enviamos a {datos?.email} {resultado.estado === 'validado' ? `su link de pago por ${fmt(CURSO.precio.estudiante)}` : `el motivo y el link de pago por ${fmt(CURSO.precio.monto)}`}.
                    La Google Sheet se actualiza sola.
                  </p>
                ) : (
                  <p className="mt-2 text-text/85">
                    La decisión quedó guardada, pero el correo al alumno no salió. Avisa a quien administra el sitio para
                    reenviarlo.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {(estado === 'listo' || estado === 'enviando') && datos && (
          <>
            <dl className="card mt-8 grid gap-3 p-6 text-sm sm:grid-cols-[auto,1fr] sm:gap-x-6">
              <dt className="font-semibold text-text/70">Nombre</dt>
              <dd className="text-ink">{nombre}</dd>
              <dt className="font-semibold text-text/70">Correo</dt>
              <dd className="break-all text-ink">{datos.email}</dd>
              <dt className="font-semibold text-text/70">Solicitud</dt>
              <dd className="text-ink">{fecha(datos.solicitud_at)}</dd>
            </dl>

            {!pendiente && (
              <div className="card mt-6 p-6 text-ink" role="status">
                {datos.estado === 'validado'
                  ? `Ya aprobaste esta solicitud${datos.decidido_at ? ` el ${fecha(datos.decidido_at)}` : ''}.`
                  : `Ya rechazaste esta solicitud${datos.decidido_at ? ` el ${fecha(datos.decidido_at)}` : ''}${datos.motivo ? ` (${datos.motivo})` : ''}.`}{' '}
                {datos.pagado ? 'Ya pagó.' : 'Todavía no paga.'}
              </div>
            )}

            {pendiente && (
              <>
                <section className="card mt-6 overflow-hidden">
                  <h2 className="flex items-center gap-2 px-6 pt-6 text-lg font-bold text-ink">
                    <FileText size={20} className="text-accent" aria-hidden /> Credencial
                  </h2>
                  {datos.documento ? (
                    <div className="p-6 pt-4">
                      {esPdf ? (
                        <iframe
                          src={datos.documento.url}
                          title="Credencial de estudiante"
                          className="h-[28rem] w-full rounded-xl border border-line/10 bg-white"
                        />
                      ) : (
                        <img
                          src={datos.documento.url}
                          alt="Credencial de estudiante"
                          className="max-h-[32rem] w-full rounded-xl border border-line/10 bg-white object-contain"
                        />
                      )}
                      <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <a
                          href={datos.documento.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 font-semibold text-accent underline"
                        >
                          <ExternalLink size={15} aria-hidden /> Abrir en otra pestaña
                        </a>
                        <button type="button" onClick={cargar} className="inline-flex items-center gap-1.5 font-semibold text-accent underline">
                          <RefreshCw size={15} aria-hidden /> ¿No carga? Recargar
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-text/60">
                        Revisa que se lean el nombre, la institución y la vigencia. La credencial se borra al confirmar tu
                        decisión.
                      </p>
                    </div>
                  ) : (
                    <p className="p-6 pt-3 text-sm text-text/85">
                      No la subió en el formulario. Le pedimos que la mande respondiendo el correo: búscala en{' '}
                      {CURSO.contacto.email} (asunto «Envíanos tu credencial de estudiante»). Al terminar, borra ese correo
                      de la bandeja.
                    </p>
                  )}
                </section>

                <section className="card mt-6 p-6">
                  <h2 className="text-lg font-bold text-ink">Tu decisión</h2>
                  <div className="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-label="Decisión">
                    {(['aprobar', 'rechazar'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={decision === d}
                        onClick={() => setDecision(d)}
                        className={`inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-colors ${
                          decision === d
                            ? d === 'aprobar'
                              ? 'border-accent bg-accent text-white'
                              : 'border-[#c0266d] bg-[#c0266d] text-white'
                            : 'border-line/20 text-ink hover:border-accent/60'
                        }`}
                      >
                        {d === 'aprobar' ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
                        {d === 'aprobar' ? 'Aprobar descuento' : 'Rechazar'}
                      </button>
                    ))}
                  </div>

                  {decision === 'rechazar' && (
                    <div className="mt-5">
                      <label htmlFor="rev-motivo" className="text-sm font-semibold text-ink">
                        Motivo (lo verá el alumno)
                      </label>
                      <select
                        id="rev-motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="field mt-2 !py-3"
                      >
                        <option value="">Elige un motivo…</option>
                        {(datos.motivos ?? []).map((m) => (
                          <option key={m.codigo} value={m.codigo}>
                            {m.etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {decision && (
                    <p className="mt-5 text-sm text-text/85">
                      {decision === 'aprobar'
                        ? `Al confirmar, ${datos.email} recibe su link de pago por ${fmt(CURSO.precio.estudiante)}.`
                        : `Al confirmar, ${datos.email} recibe el motivo y el link de pago por ${fmt(CURSO.precio.monto)}.`}{' '}
                      La decisión no se puede cambiar después.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={confirmar}
                    disabled={!puedeConfirmar}
                    className="btn-primary mt-6 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {estado === 'enviando' ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Check size={18} aria-hidden />}{' '}
                    Confirmar
                  </button>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

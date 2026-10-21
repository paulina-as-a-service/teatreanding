import { useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { AlertCircle, ArrowRight, Check, CreditCard, GraduationCap, Loader2, Mail, Paperclip, RefreshCw, X } from 'lucide-react';
import { AVISO_VERSION, CURSO } from '../content/curso';
import { SectionHeading } from '../components/ui';
import { supabase } from '../lib/supabase';
import {
  MAX_CREDENCIAL_BYTES,
  TIPOS_CREDENCIAL,
  marcarEstudianteListo,
  obtenerLinkPago,
  registrarInscripcion,
  subirCredencial,
} from '../lib/inscripcion';

type Fields = {
  nombre: string;
  apellidos: string;
  motivo: string;
  email: string;
  aceptaPrivacidad: boolean;
  aceptaComunicaciones: boolean;
  estudiante: '' | 'si' | 'no';
  archivo: File | null; // student ID, optional
  empresa: string; // honeypot, must stay empty
};

type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = {
  nombre: '',
  apellidos: '',
  motivo: '',
  email: '',
  aceptaPrivacidad: false,
  aceptaComunicaciones: false,
  estudiante: '',
  archivo: null,
  empresa: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.nombre.trim()) e.nombre = 'Escribe tu nombre.';
  if (!f.apellidos.trim()) e.apellidos = 'Escribe tus apellidos.';
  if (f.motivo.trim().length < 10) e.motivo = 'Cuéntanos un poco más (mínimo 10 caracteres).';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Escribe un correo electrónico válido.';
  if (!f.estudiante) e.estudiante = 'Indica si eres estudiante.';
  if (f.estudiante === 'si' && f.archivo) {
    const tipoOk = TIPOS_CREDENCIAL.includes(f.archivo.type) || /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(f.archivo.name);
    if (!tipoOk) e.archivo = 'Sube una foto (JPG, PNG, HEIC) o un PDF.';
    else if (f.archivo.size > MAX_CREDENCIAL_BYTES) e.archivo = 'El archivo pesa más de 5 MB. Sube una foto más ligera o déjalo vacío.';
  }
  if (!f.aceptaPrivacidad) e.aceptaPrivacidad = 'Necesitamos tu consentimiento para registrar tu inscripción.';
  return e;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="relative">
        {children}
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-4 origin-left text-base text-text/60 transition-all duration-200 peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-semibold"
        >
          {label}
        </label>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-error`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 pl-1 text-sm font-medium text-[#c0266d] dark:text-[#ff8fc4]"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const fmt = (n: number) => `$${n.toLocaleString('es-MX')} ${CURSO.precio.moneda}`;

const Step = ({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) => (
  <li className="flex items-center gap-3">
    <span
      className={`grid h-9 w-9 place-items-center rounded-full font-display text-base font-bold transition-colors duration-500 ${
        done ? 'bg-accent text-white' : active ? 'border-2 border-accent text-accent' : 'border-2 border-line/20 text-text/50'
      }`}
    >
      {done ? <Check size={16} aria-hidden /> : n}
    </span>
    <span className={`font-display text-sm font-semibold uppercase tracking-[0.16em] ${active || done ? 'text-ink' : 'text-text/50'}`}>
      {label}
    </span>
  </li>
);

export default function Inscripcion() {
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [pagoUrl, setPagoUrl] = useState<string | null>(null);
  const [yaPagado, setYaPagado] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const [monto, setMonto] = useState<number>(CURSO.precio.monto);
  // Student-discount request: whether the ID made it to the server (null = not a student request).
  const [solicitud, setSolicitud] = useState<null | { conCredencial: boolean; subidaFallida: boolean }>(null);
  const shake = useAnimationControls();

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(f);
    setErrors(errs);
    if (Object.keys(errs).length) {
      shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
      const first = Object.keys(errs)[0];
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    // Bots fill hidden fields; pretend success without storing anything.
    if (f.empresa) {
      setStatus('done');
      return;
    }
    if (!supabase) {
      setStatus('error');
      setServerError('El registro aún no está conectado a la base de datos.');
      return;
    }
    setStatus('sending');
    setServerError('');
    try {
      const r = await registrarInscripcion({
        nombre: f.nombre.trim(),
        apellidos: f.apellidos.trim(),
        email: f.email.trim().toLowerCase(),
        motivo: f.motivo.trim(),
        aceptaPrivacidad: f.aceptaPrivacidad,
        aceptaComunicaciones: f.aceptaComunicaciones,
        avisoVersion: AVISO_VERSION,
        esEstudiante: f.estudiante === 'si',
      });
      if (!r.ok || !r.id) throw new Error(r.error ?? 'sin-id');
      setRegistroId(r.id);
      if (r.estudiante && r.en_revision !== false && !r.payment_url && !r.ya_pagado) {
        let conCredencial = false;
        if (f.archivo && r.subida) {
          try {
            await subirCredencial(r.subida, f.archivo);
            conCredencial = true;
          } catch {
            /* the email asks them to reply with the ID instead */
          }
        }
        try {
          await marcarEstudianteListo(r.id);
        } catch {
          /* the hourly task closes requests the page could not */
        }
        setSolicitud({ conCredencial, subidaFallida: !!f.archivo && !conCredencial });
        setStatus('done');
        return;
      }
      setSolicitud(null);
      if (typeof r.monto === 'number') setMonto(r.monto);
      setPagoUrl(r.payment_url ?? null);
      setYaPagado(!!r.ya_pagado);
      setStatus('done');
    } catch {
      setStatus('error');
      setServerError('No pudimos guardar tu registro.');
    }
  };

  const reintentarLink = async () => {
    if (!registroId) return;
    setReintentando(true);
    try {
      const r = await obtenerLinkPago(registroId);
      setPagoUrl(r.payment_url ?? null);
      setYaPagado(!!r.ya_pagado);
      if (typeof r.monto === 'number') setMonto(r.monto);
    } catch {
      setPagoUrl(null);
    } finally {
      setReintentando(false);
    }
  };

  const done = status === 'done';

  return (
    <section id="inscripcion" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-transparent via-brand-lilac/40 to-transparent dark:via-brand-indigo/25" />
      <img src="/img/plane.webp" alt="" aria-hidden className="pointer-events-none absolute -left-16 top-24 -z-10 hidden w-56 opacity-80 lg:block" />
      <img src="/img/cylinder.webp" alt="" aria-hidden className="pointer-events-none absolute -right-10 bottom-16 -z-10 hidden w-48 opacity-80 lg:block" />

      <div className="page">
        <SectionHeading
          align="center"
          eyebrow="Inscripción"
          title={
            <>
              Aparta tu lugar en <span className="gradient-text">dos pasos</span>
            </>
          }
          intro="Primero déjanos tus datos y después realiza tu pago en línea."
        />

        <motion.div
          animate={shake}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="card mx-auto mt-12 max-w-2xl p-6 sm:p-10"
        >
          <ol className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-3" aria-label="Pasos de inscripción">
            <Step n={1} label="Tus datos" active={!done} done={done} />
            <li aria-hidden className="hidden h-px flex-1 bg-line/15 sm:block">
              <motion.span
                className="block h-px origin-left bg-accent"
                initial={false}
                animate={{ scaleX: done ? 1 : 0 }}
                transition={{ duration: 0.6 }}
              />
            </li>
            <Step n={2} label="Pago" active={done} done={false} />
          </ol>

          <AnimatePresence mode="wait">
            {!done ? (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                noValidate
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35 }}
                className="grid gap-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="f-nombre" label="Nombre(s)" error={errors.nombre}>
                    <input
                      id="f-nombre"
                      className="field peer"
                      placeholder="Nombre(s)"
                      autoComplete="given-name"
                      maxLength={120}
                      value={f.nombre}
                      onChange={(e) => set('nombre', e.target.value)}
                      aria-invalid={!!errors.nombre}
                      aria-describedby={errors.nombre ? 'f-nombre-error' : undefined}
                    />
                  </Field>
                  <Field id="f-apellidos" label="Apellidos" error={errors.apellidos}>
                    <input
                      id="f-apellidos"
                      className="field peer"
                      placeholder="Apellidos"
                      autoComplete="family-name"
                      maxLength={120}
                      value={f.apellidos}
                      onChange={(e) => set('apellidos', e.target.value)}
                      aria-invalid={!!errors.apellidos}
                      aria-describedby={errors.apellidos ? 'f-apellidos-error' : undefined}
                    />
                  </Field>
                </div>

                <Field id="f-email" label="Correo electrónico" error={errors.email}>
                  <input
                    id="f-email"
                    type="email"
                    inputMode="email"
                    className="field peer"
                    placeholder="Correo electrónico"
                    autoComplete="email"
                    maxLength={254}
                    value={f.email}
                    onChange={(e) => set('email', e.target.value)}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'f-email-error' : undefined}
                  />
                </Field>

                <Field id="f-motivo" label="¿Por qué te interesa el curso?" error={errors.motivo}>
                  <textarea
                    id="f-motivo"
                    rows={4}
                    className="field peer resize-y"
                    placeholder="¿Por qué te interesa el curso?"
                    maxLength={2000}
                    value={f.motivo}
                    onChange={(e) => set('motivo', e.target.value)}
                    aria-invalid={!!errors.motivo}
                    aria-describedby={errors.motivo ? 'f-motivo-error' : 'f-motivo-hint'}
                  />
                </Field>
                <p id="f-motivo-hint" className="-mt-2 pl-1 text-xs text-text/60">
                  Por favor no incluyas datos sensibles (salud, creencias, etc.).
                </p>

                <fieldset className="mt-2 rounded-2xl border border-line/10 bg-bg/50 p-4">
                  <legend className="sr-only">Descuento para estudiantes</legend>
                  <p id="f-estudiante-pregunta" className="flex items-start gap-2 text-sm font-semibold text-ink">
                    <GraduationCap size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    <span>
                      ¿Eres estudiante activo de alguna institución académica? <span className="text-highlight">*</span>
                    </span>
                  </p>
                  <div
                    className="mt-3 flex gap-3"
                    role="radiogroup"
                    aria-labelledby="f-estudiante-pregunta"
                    aria-describedby={errors.estudiante ? 'f-estudiante-error' : undefined}
                  >
                    {(['si', 'no'] as const).map((v) => (
                      <label
                        key={v}
                        className={`flex cursor-pointer items-center gap-2 rounded-full border-2 px-5 py-2 text-sm font-semibold transition-colors ${
                          f.estudiante === v ? 'border-accent bg-accent/10 text-ink' : 'border-line/15 text-text/80 hover:border-accent/50'
                        }`}
                      >
                        <input
                          id={v === 'si' ? 'f-estudiante' : undefined}
                          type="radio"
                          name="estudiante"
                          value={v}
                          className="h-4 w-4 accent-[rgb(var(--accent))]"
                          checked={f.estudiante === v}
                          onChange={() => set('estudiante', v)}
                        />
                        {v === 'si' ? 'Sí' : 'No'}
                      </label>
                    ))}
                  </div>
                  <AnimatePresence>
                    {errors.estudiante && (
                      <motion.p
                        id="f-estudiante-error"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 text-sm font-medium text-[#c0266d] dark:text-[#ff8fc4]"
                      >
                        {errors.estudiante}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <AnimatePresence initial={false}>
                    {f.estudiante === 'si' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="mt-4 text-sm text-text/85">
                          Con credencial de estudiante vigente pagas{' '}
                          <strong className="text-ink">{fmt(CURSO.precio.estudiante)}</strong> en lugar de{' '}
                          {fmt(CURSO.precio.monto)}. Primero validamos tu credencial y después te enviamos tu link de pago
                          por correo.
                        </p>
                        <div className="mt-3">
                          <label
                            htmlFor="f-archivo"
                            className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-line/20 px-4 py-3 text-sm text-text hover:border-accent/60"
                          >
                            <Paperclip size={18} className="shrink-0 text-accent" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">
                              {f.archivo ? f.archivo.name : 'Sube tu credencial vigente (foto o PDF, máximo 5 MB)'}
                            </span>
                            {f.archivo && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  set('archivo', null);
                                  const input = document.getElementById('f-archivo') as HTMLInputElement | null;
                                  if (input) input.value = '';
                                }}
                                aria-label="Quitar archivo"
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-text/60 hover:bg-ink/5 hover:text-ink"
                              >
                                <X size={16} aria-hidden />
                              </button>
                            )}
                          </label>
                          <input
                            id="f-archivo"
                            type="file"
                            accept="image/*,application/pdf"
                            className="sr-only"
                            onChange={(e) => set('archivo', e.target.files?.[0] ?? null)}
                            aria-invalid={!!errors.archivo}
                            aria-describedby={errors.archivo ? 'f-archivo-error' : 'f-archivo-hint'}
                          />
                          <AnimatePresence>
                            {errors.archivo && (
                              <motion.p
                                id="f-archivo-error"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-1.5 pl-1 text-sm font-medium text-[#c0266d] dark:text-[#ff8fc4]"
                              >
                                {errors.archivo}
                              </motion.p>
                            )}
                          </AnimatePresence>
                          <p id="f-archivo-hint" className="mt-1.5 pl-1 text-xs text-text/60">
                            Opcional. Si no la tienes a la mano, déjalo vacío: te enviaremos un correo para que nos la mandes
                            respondiéndolo. Que se lean tu nombre, la institución y la vigencia.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </fieldset>

                {/* Honeypot: hidden from people, visible to bots */}
                <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
                  <label htmlFor="f-empresa">Empresa</label>
                  <input
                    id="f-empresa"
                    tabIndex={-1}
                    autoComplete="off"
                    value={f.empresa}
                    onChange={(e) => set('empresa', e.target.value)}
                  />
                </div>

                <div className="mt-2 space-y-3 rounded-2xl border border-line/10 bg-bg/50 p-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-text">
                    <input
                      id="f-aceptaPrivacidad"
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[rgb(var(--accent))]"
                      checked={f.aceptaPrivacidad}
                      onChange={(e) => set('aceptaPrivacidad', e.target.checked)}
                      aria-invalid={!!errors.aceptaPrivacidad}
                      aria-describedby={errors.aceptaPrivacidad ? 'f-aceptaPrivacidad-error' : undefined}
                    />
                    <span>
                      He leído el{' '}
                      <a href="#aviso-de-privacidad" className="font-semibold text-accent underline underline-offset-2">
                        Aviso de privacidad
                      </a>{' '}
                      y doy mi consentimiento para el tratamiento de mis datos personales para las finalidades primarias ahí
                      descritas. <span className="text-highlight">*</span>
                    </span>
                  </label>
                  <AnimatePresence>
                    {errors.aceptaPrivacidad && (
                      <motion.p
                        id="f-aceptaPrivacidad-error"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pl-8 text-sm font-medium text-[#c0266d] dark:text-[#ff8fc4]"
                      >
                        {errors.aceptaPrivacidad}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <label className="flex cursor-pointer items-start gap-3 text-sm text-text">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[rgb(var(--accent))]"
                      checked={f.aceptaComunicaciones}
                      onChange={(e) => set('aceptaComunicaciones', e.target.checked)}
                    />
                    <span>Quiero recibir información sobre futuros cursos y actividades de Teatranding! (opcional).</span>
                  </label>
                </div>

                {status === 'error' && (
                  <p className="flex items-start gap-2 rounded-2xl bg-[#c0266d]/10 px-4 py-3 text-sm text-ink" role="alert">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#c0266d] dark:text-[#ff8fc4]" aria-hidden />
                    <span>
                      {serverError} Intenta de nuevo o escríbenos a{' '}
                      <a className="font-semibold underline" href={`mailto:${CURSO.contacto.email}`}>
                        {CURSO.contacto.email}
                      </a>
                      .
                    </span>
                  </p>
                )}

                <button type="submit" className="btn-primary mt-2 w-full sm:w-auto sm:justify-self-end" disabled={status === 'sending'}>
                  {status === 'sending' ? (
                    <>
                      <Loader2 size={18} className="animate-spin" aria-hidden /> Enviando…
                    </>
                  ) : (
                    <>
                      {f.estudiante === 'si' ? 'Solicitar descuento de estudiante' : 'Continuar al pago'}{' '}
                      <ArrowRight size={18} aria-hidden />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="pago"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
                role="status"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-plum text-white shadow-lg shadow-brand-violet/40"
                >
                  <Check size={30} aria-hidden />
                </motion.span>
                <h3 className="mt-6 text-2xl font-bold text-ink">¡Gracias, {f.nombre.trim().split(' ')[0] || 'ya casi'}!</h3>
                {solicitud ? (
                  <div className="mx-auto mt-2 max-w-md space-y-3 text-text/85">
                    {solicitud.conCredencial ? (
                      <p>
                        Recibimos tu credencial. La vamos a revisar y te escribimos a{' '}
                        <strong className="text-ink">{f.email.trim()}</strong> con el resultado.
                      </p>
                    ) : (
                      <p>
                        {solicitud.subidaFallida ? 'No pudimos subir tu credencial, pero tu solicitud quedó registrada. ' : ''}
                        Te enviamos un correo a <strong className="text-ink">{f.email.trim()}</strong>. Respóndelo con una
                        foto o PDF de tu credencial de estudiante vigente en las próximas 72 horas.
                      </p>
                    )}
                    <p>
                      Si queda validada, te mandamos tu link de pago por{' '}
                      <strong className="text-ink">{fmt(CURSO.precio.estudiante)}</strong>. Tu lugar queda apartado cuando
                      se confirma el pago.
                    </p>
                    <p className="text-sm text-text/70">Si no ves el correo, revisa tu carpeta de spam o promociones.</p>
                  </div>
                ) : yaPagado ? (
                  <p className="mx-auto mt-2 max-w-md text-text/85">
                    Ya tenemos registrado un pago con este correo, así que no necesitas pagar de nuevo. Si quieres
                    inscribir a otra persona, usa su propio correo.
                  </p>
                ) : pagoUrl ? (
                  <>
                    <p className="mx-auto mt-2 max-w-md text-text/85">
                      Recibimos tus datos. Para completar tu inscripción, realiza el pago de{' '}
                      <strong className="text-ink">{fmt(monto)}</strong>{' '}
                      en la página segura de Clip. Al terminar volverás a esta página.
                    </p>
                    <a href={pagoUrl} className="btn-primary mt-8 !px-8 !py-4 !text-lg">
                      <CreditCard size={20} aria-hidden /> Ir al pago
                    </a>
                  </>
                ) : (
                  <>
                    <p className="mx-auto mt-2 max-w-md text-text/85">
                      Guardamos tus datos, pero no pudimos generar tu link de pago en este momento.
                    </p>
                    <button
                      type="button"
                      onClick={reintentarLink}
                      disabled={reintentando}
                      className="btn-primary mt-8 !px-8 !py-4 !text-lg"
                    >
                      {reintentando ? (
                        <Loader2 size={20} className="animate-spin" aria-hidden />
                      ) : (
                        <RefreshCw size={20} aria-hidden />
                      )}{' '}
                      Intentar de nuevo
                    </button>
                  </>
                )}
                <p className="mt-6 flex items-center justify-center gap-2 text-sm text-text/70">
                  <Mail size={15} aria-hidden /> ¿Dudas? Escríbenos a{' '}
                  <a className="font-semibold text-accent underline" href={`mailto:${CURSO.contacto.email}`}>
                    {CURSO.contacto.email}
                  </a>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

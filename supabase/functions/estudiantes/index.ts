/**
 * Edge Function: estudiantes
 *
 * Student discount ($1,499 instead of $1,999) for people currently enrolled in an academic institution.
 * Mauricio reviews each request from a page on the site, reached through the buttons in his notification
 * email. He never needs to open Supabase, Clip or the Google Sheet.
 *
 * Internal actions (called by the database with ?token=ESTUDIANTES_TOKEN, via pg_net):
 *   { accion: 'notificar', id }
 *     Trigger `inscripciones_solicitud_estudiante`, each time the page marks a request as ready.
 *     - Looks for the uploaded ID in the private bucket and, if there is a new one, moves the request
 *       to 'en_revision'.
 *     - First time only: emails the student (request received, or "reply with your ID").
 *     - First time, and whenever a new ID arrives: emails Mauricio with the Aprobar / Rechazar buttons.
 *   { accion: 'tick' }
 *     pg_cron, every hour:
 *     - requests the page never closed (30 min) are marked ready, so they get their emails,
 *     - students without an uploaded ID get one reminder at 48 h,
 *     - at 72 h without an uploaded ID, Mauricio gets a deadline notice with the same buttons,
 *     - after the last session (FIN_CURSO), IDs of requests that were never decided are deleted.
 *
 * Public actions (called by the review page on the site; authorized by the signed `clave` in the link):
 *   { accion: 'revision_ver', clave }
 *     Registration data, decision status, and a 10-minute link to view the ID.
 *   { accion: 'revision_decidir', clave, decision: 'aprobar' | 'rechazar', motivo? }
 *     Saves the decision once (a second click shows the decision already made), deletes the ID from
 *     Storage, and emails the student:
 *       aprobar:  monto = 1499 and a link to pay it,
 *       rechazar: monto = 1999, the reason (from MOTIVOS) and a link to pay the regular price.
 *     The payment link is SITE_URL/?pagar=<id>: the site asks `inscripcion` for a fresh Clip link
 *     with the registration's `monto`, so it never expires and Clip's webhook recognizes the payment.
 *
 * Opening the review page only reads. Nothing changes until Mauricio presses "Confirmar", so email
 * scanners that open links cannot approve or reject anything.
 *
 * Secrets (Supabase > Edge Functions > Secrets):
 *   RESEND_API_KEY        same key as `confirmacion-email`
 *   ESTUDIANTES_TOKEN     random string; the same value goes in the Vault URL (?token=...)
 *   ESTUDIANTES_FIRMA     random string (32+ characters) used to sign the review links
 *   SITE_URL              https://teatranding.com
 *   REVISION_EMAIL        optional, default teatranding@gmail.com (who receives the notifications)
 *   RESEND_FROM           optional, default "Teatranding! <inscripciones@teatranding.com>"
 *   RESEND_REPLY_TO       optional, default teatranding@gmail.com
 *   LOGO_URL              optional, default SITE_URL/img/logo-correo.png
 * Provided automatically: SUPABASE_URL and the service key (legacy or new format).
 *
 * Deploy with JWT verification OFF.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Env = { get(key: string): string | undefined };
export type Deps = { db: SupabaseClient; env: Env; fetch: typeof fetch; now: () => Date };

type Fila = {
  id: string;
  created_at: string;
  nombre: string;
  apellidos: string;
  email: string;
  pago_estado: string;
  es_estudiante: boolean;
  estudiante_estado: string | null;
  estudiante_solicitud_at: string | null;
  estudiante_listo_at: string | null;
  estudiante_documento_path: string | null;
  estudiante_correo_alumno_at: string | null;
  estudiante_recordatorio_at: string | null;
  estudiante_plazo_aviso_at: string | null;
  estudiante_decidido_at: string | null;
  estudiante_motivo_rechazo: string | null;
};

const COLUMNAS =
  'id,created_at,nombre,apellidos,email,pago_estado,es_estudiante,estudiante_estado,estudiante_solicitud_at,' +
  'estudiante_listo_at,estudiante_documento_path,estudiante_correo_alumno_at,estudiante_recordatorio_at,' +
  'estudiante_plazo_aviso_at,estudiante_decidido_at,estudiante_motivo_rechazo';

const BUCKET = 'documentos-estudiantes';
const PENDIENTES = ['pendiente_documento', 'en_revision'];
const MONTO_ESTUDIANTE = 1499;
const MONTO_REGULAR = 1999;
const HORA = 3600 * 1000;
const SIN_CERRAR_MS = 30 * 60 * 1000;
const RECORDATORIO_MS = 48 * HORA;
const PLAZO_MS = 72 * HORA;
const CLAVE_VIGENCIA_S = 30 * 24 * 3600;
// After the last session, any ID still stored (undecided requests) is deleted (Aviso de privacidad, sección 6).
const FIN_CURSO = '2026-12-12T20:00:00Z';
const RESEND_API = 'https://api.resend.com/emails';
const FROM_DEFAULT = 'Teatranding! <inscripciones@teatranding.com>';
const CONTACTO = 'teatranding@gmail.com';
const ZONA = 'America/Mexico_City';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------------------------------
 * MOTIVOS DE RECHAZO
 * `etiqueta` es lo que ve Mauricio en la página de revisión; `texto` es lo que recibe el alumno.
 * ---------------------------------------------------------------------------------------- */
export const MOTIVOS: Record<string, { etiqueta: string; texto: string }> = {
  vencido: {
    etiqueta: 'La credencial no está vigente',
    texto: 'La credencial que nos enviaste no está vigente.',
  },
  ilegible: {
    etiqueta: 'No se lee con claridad',
    texto: 'No pudimos leer con claridad tu nombre, la institución o la vigencia en el documento.',
  },
  no_academico: {
    etiqueta: 'No es de una institución académica',
    texto: 'El documento no corresponde a una credencial de estudiante de una institución académica.',
  },
  nombre_distinto: {
    etiqueta: 'El nombre no coincide con el registro',
    texto: 'El nombre de la credencial no coincide con el de tu registro.',
  },
  sin_documento: {
    etiqueta: 'No envió su credencial a tiempo',
    texto: 'No recibimos tu credencial dentro del plazo de 72 horas.',
  },
};

/* ------------------------------------------------------------------------------------------
 * Correos
 * ---------------------------------------------------------------------------------------- */
type Correo = { asunto: string; html: string; texto: string };
type Boton = { texto: string; url: string; secundario?: boolean };

const pesos = (n: number) => `$${n.toLocaleString('es-MX')} MXN`;

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(d) + ' hrs (hora CDMX)';
}

/** Paragraphs are plain strings; **x** marks bold. Buttons go after the paragraphs. */
function armar(asunto: string, logoUrl: string | null, parrafos: string[], botones: Boton[] = [], pie: string[] = []): Correo {
  const conNegritas = (p: string) => escapar(p).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const sinMarcas = (p: string) => p.replace(/\*\*/g, '');
  const img = logoUrl
    ? `<img src="${escapar(logoUrl)}" width="56" height="59" alt="Teatranding!" style="display:block;margin:0 auto 10px;border:0;">`
    : '';
  const btns = botones
    .map(
      (b) =>
        `<a href="${escapar(b.url)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 22px;border-radius:999px;font-weight:bold;text-decoration:none;${
          b.secundario ? 'background:#ffffff;color:#3b2fc9;border:2px solid #3b2fc9;' : 'background:#3b2fc9;color:#ffffff;border:2px solid #3b2fc9;'
        }">${escapar(b.texto)}</a>`
    )
    .join('');
  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f4f2fb;font-family:Arial,Helvetica,sans-serif;color:#1d1a3a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;line-height:1.55;font-size:15px;">
    <div style="text-align:center;padding-bottom:20px;margin-bottom:24px;border-bottom:1px solid #ece8f6;">
      ${img}<div style="font-size:18px;letter-spacing:6px;font-weight:bold;"><span style="color:#aa3277;">Teatran</span><span style="color:#454546;">ding</span><span style="color:#aa3277;">!</span></div>
    </div>
    ${parrafos.map((p, i) => `<p style="${i === 0 ? 'margin-top:0;' : ''}">${conNegritas(p)}</p>`).join('\n    ')}
    ${btns ? `<div style="margin:24px 0 8px;">${btns}</div>` : ''}
    ${pie.map((p) => `<p style="color:#5b5480;font-size:14px;">${conNegritas(p)}</p>`).join('\n    ')}
  </div>
</body>
</html>`;
  const texto = [
    ...parrafos.map(sinMarcas),
    ...botones.map((b) => `${b.texto}: ${b.url}`),
    ...pie.map(sinMarcas),
  ].join('\n\n');
  return { asunto, html, texto };
}

const primerNombre = (f: Fila) => (f.nombre ?? '').trim().split(/\s+/)[0] || '';

export const correos = {
  alumnoConDocumento: (f: Fila, logo: string | null) =>
    armar('Recibimos tu credencial de estudiante', logo, [
      `Hola, ${primerNombre(f)}:`,
      'Recibimos tu solicitud de descuento para estudiantes y tu credencial. La vamos a revisar y te escribimos a este correo con el resultado.',
      `Si queda validada, te mandamos tu link de pago por **${pesos(MONTO_ESTUDIANTE)}** (precio regular ${pesos(MONTO_REGULAR)}). Tu lugar queda apartado cuando se confirma el pago.`,
      'Si tienes alguna duda, responde este correo.',
    ]),

  alumnoSinDocumento: (f: Fila, limite: Date, logo: string | null) =>
    armar('Envíanos tu credencial de estudiante', logo, [
      `Hola, ${primerNombre(f)}:`,
      'Recibimos tu solicitud de descuento para estudiantes. Para validarla, **responde este correo con una foto o PDF de tu credencial de estudiante vigente**, donde se lean tu nombre, la institución y la vigencia.',
      `Tienes hasta el **${fechaLarga(limite)}** para enviarla.`,
      `Cuando la validemos, te mandamos tu link de pago por **${pesos(MONTO_ESTUDIANTE)}** (precio regular ${pesos(MONTO_REGULAR)}).`,
    ]),

  alumnoRecordatorio: (f: Fila, limite: Date, logo: string | null) =>
    armar('Recordatorio: falta tu credencial de estudiante', logo, [
      `Hola, ${primerNombre(f)}:`,
      `Todavía no tenemos tu credencial de estudiante vigente. Para aplicar el descuento, responde este correo con una foto o PDF antes del **${fechaLarga(limite)}**.`,
      `Después de esa fecha puedes inscribirte al precio regular de ${pesos(MONTO_REGULAR)}.`,
    ], [], ['Si ya nos la enviaste, ignora este mensaje.']),

  alumnoAprobado: (f: Fila, pagoUrl: string, logo: string | null) =>
    armar('Tu descuento de estudiante está aprobado', logo, [
      `Hola, ${primerNombre(f)}:`,
      `Validamos tu credencial. Tu precio para el curso es de **${pesos(MONTO_ESTUDIANTE)}**.`,
      'Para apartar tu lugar, completa el pago en el siguiente enlace. En cuanto se confirme, te llega un correo con el enlace de Zoom y los detalles de las sesiones.',
    ], [{ texto: `Pagar ${pesos(MONTO_ESTUDIANTE)}`, url: pagoUrl }]),

  alumnoRechazado: (f: Fila, motivo: string, pagoUrl: string, logo: string | null) =>
    armar('Sobre tu solicitud de descuento para estudiantes', logo, [
      `Hola, ${primerNombre(f)}:`,
      'Revisamos tu solicitud y no pudimos aplicar el descuento para estudiantes.',
      `**Motivo:** ${motivo}`,
      'Si tienes una credencial vigente, puedes volver a solicitar el descuento desde el formulario en teatranding.com con este mismo correo.',
      `También puedes inscribirte al precio regular de ${pesos(MONTO_REGULAR)}:`,
    ], [{ texto: `Pagar ${pesos(MONTO_REGULAR)}`, url: pagoUrl }], ['Si tienes alguna duda, responde este correo.']),

  revision: (f: Fila, conDocumento: boolean, nuevoDocumento: boolean, aprobar: string, rechazar: string, logo: string | null) =>
    armar(
      nuevoDocumento
        ? `Descuento estudiante: ${f.nombre} ${f.apellidos} subió su credencial`
        : `Descuento estudiante: revisar a ${f.nombre} ${f.apellidos}`,
      logo,
      [
        'Nueva solicitud de descuento para estudiantes.',
        `**Nombre:** ${f.nombre} ${f.apellidos}`,
        `**Correo:** ${f.email}`,
        conDocumento
          ? '**Credencial:** la subió en el formulario. La ves al abrir cualquiera de los botones.'
          : '**Credencial:** no la subió. Le pedimos que responda con ella a teatranding@gmail.com. Cuando llegue, revísala y usa los botones de este correo.',
      ],
      [
        { texto: 'Aprobar descuento', url: aprobar },
        { texto: 'Rechazar', url: rechazar, secundario: true },
      ],
      ['Los botones abren una página de revisión. No se aprueba ni se rechaza nada hasta que presionas "Confirmar".']
    ),

  plazoVencido: (f: Fila, aprobar: string, rechazar: string, logo: string | null) =>
    armar(`Descuento estudiante: venció el plazo de ${f.nombre} ${f.apellidos}`, logo, [
      `Pasaron 72 horas y **${f.nombre} ${f.apellidos}** (${f.email}) no subió su credencial en el formulario.`,
      'Si la mandó respondiendo el correo, revísala y decide. Si no llegó nada, rechaza con el motivo "No envió su credencial a tiempo": le llega el link para pagar el precio regular.',
    ], [
      { texto: 'Aprobar descuento', url: aprobar },
      { texto: 'Rechazar', url: rechazar, secundario: true },
    ]),
};

/* ------------------------------------------------------------------------------------------
 * Signed review links: <id>.<expires (unix s)>.<HMAC-SHA256 base64url>
 * ---------------------------------------------------------------------------------------- */
const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(secreto: string, datos: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(datos)));
}

const iguales = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export async function crearClave(secreto: string, id: string, ahora: Date): Promise<string> {
  const exp = Math.floor(ahora.getTime() / 1000) + CLAVE_VIGENCIA_S;
  return `${id}.${exp}.${await hmac(secreto, `${id}.${exp}`)}`;
}

/** Registration ID if the link is authentic and not expired, otherwise null. */
export async function verificarClave(secreto: string, clave: string, ahora: Date): Promise<string | null> {
  const partes = clave.split('.');
  if (partes.length !== 3) return null;
  const [id, exp, firma] = partes;
  if (!UUID_RE.test(id) || !/^\d{9,11}$/.test(exp)) return null;
  if (Number(exp) * 1000 < ahora.getTime()) return null;
  return iguales(firma, await hmac(secreto, `${id}.${exp}`)) ? id : null;
}

/* ------------------------------------------------------------------------------------------ */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function crearHandler(deps: Deps) {
  const { db, env } = deps;
  const ahora = () => deps.now();
  const site = () => (env.get('SITE_URL') ?? '').trim().replace(/\/+$/, '');
  const logo = () => env.get('LOGO_URL')?.trim() || (site() ? `${site()}/img/logo-correo.png` : null);
  const revisor = () => env.get('REVISION_EMAIL')?.trim() || CONTACTO;
  const pagoUrl = (id: string) => `${site()}/?pagar=${id}`;

  async function enviar(para: string, c: Correo, idem: string, tipo: string): Promise<string | null> {
    const apiKey = env.get('RESEND_API_KEY');
    if (!apiKey) return 'Falta RESEND_API_KEY';
    try {
      const res = await deps.fetch(env.get('RESEND_API_URL') ?? RESEND_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idem },
        body: JSON.stringify({
          from: env.get('RESEND_FROM') || FROM_DEFAULT,
          to: [para],
          reply_to: env.get('RESEND_REPLY_TO') || CONTACTO,
          subject: c.asunto,
          html: c.html,
          text: c.texto,
          tags: [{ name: 'tipo', value: tipo }],
        }),
      });
      if (res.ok) return null;
      return `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`;
    } catch (e) {
      return `red: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  async function leer(id: string): Promise<Fila | null> {
    const { data, error } = await db.from('inscripciones').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as unknown as Fila | null) ?? null;
  }

  async function guardarError(id: string, msg: string) {
    console.error('estudiantes', id, msg);
    await db.from('inscripciones').update({ estudiante_error: msg.slice(0, 500) }).eq('id', id);
  }

  /** Most recent uploaded file for this registration, if any. */
  async function documentoActual(id: string): Promise<{ path: string; tipo: string } | null> {
    const { data, error } = await db.storage
      .from(BUCKET)
      .list(id, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) {
      console.error('storage list failed', id, error.message);
      return null;
    }
    const archivo = (data ?? []).find((o) => o.name && !o.name.startsWith('.') && o.id);
    if (!archivo) return null;
    const meta = (archivo.metadata ?? {}) as Record<string, unknown>;
    return { path: `${id}/${archivo.name}`, tipo: typeof meta.mimetype === 'string' ? meta.mimetype : '' };
  }

  async function borrarDocumentos(id: string) {
    const { data } = await db.storage.from(BUCKET).list(id, { limit: 100 });
    const paths = (data ?? []).filter((o) => o.name && o.id).map((o) => `${id}/${o.name}`);
    if (paths.length) {
      const { error } = await db.storage.from(BUCKET).remove(paths);
      if (error) console.error('storage remove failed', id, error.message);
    }
  }

  async function botones(id: string) {
    const secreto = env.get('ESTUDIANTES_FIRMA') ?? '';
    const clave = encodeURIComponent(await crearClave(secreto, id, ahora()));
    return {
      aprobar: `${site()}/?revision=${clave}&decision=aprobar`,
      rechazar: `${site()}/?revision=${clave}&decision=rechazar`,
    };
  }

  /* ---------------------------------------- notificar ---------------------------------------- */
  async function notificar(id: string) {
    const f = await leer(id);
    if (!f || !f.es_estudiante || !PENDIENTES.includes(f.estudiante_estado ?? '')) return { ok: true, omitido: true };

    const doc = await documentoActual(id);
    const nuevoDocumento = !!doc && doc.path !== f.estudiante_documento_path;
    if (nuevoDocumento) {
      await db
        .from('inscripciones')
        .update({ estudiante_documento_path: doc!.path, estudiante_estado: 'en_revision' })
        .eq('id', id)
        .in('estudiante_estado', PENDIENTES);
    }

    // First notification: claim it so two calls at the same time cannot both send.
    let primera = false;
    if (!f.estudiante_correo_alumno_at) {
      const { data } = await db
        .from('inscripciones')
        .update({ estudiante_correo_alumno_at: ahora().toISOString() })
        .eq('id', id)
        .is('estudiante_correo_alumno_at', null)
        .select('id');
      primera = !!data?.length;
    }

    const errores: string[] = [];
    if (primera) {
      const c = doc
        ? correos.alumnoConDocumento(f, logo())
        : correos.alumnoSinDocumento(f, new Date(ahora().getTime() + PLAZO_MS), logo());
      const err = await enviar(f.email, c, `estudiante-solicitud-${id}-${f.estudiante_solicitud_at}`, 'estudiante_solicitud');
      if (err) {
        errores.push(`alumno: ${err}`);
        // Release the claim so the hourly task retries.
        await db.from('inscripciones').update({ estudiante_correo_alumno_at: null }).eq('id', id);
      }
    }

    if (primera || nuevoDocumento) {
      const b = await botones(id);
      const c = correos.revision(f, !!doc, nuevoDocumento && !primera, b.aprobar, b.rechazar, logo());
      const err = await enviar(revisor(), c, `estudiante-revision-${id}-${doc?.path ?? 'sin-documento'}`, 'estudiante_revision');
      if (err) errores.push(`revision: ${err}`);
    }

    if (errores.length) await guardarError(id, errores.join(' | '));
    else if (primera || nuevoDocumento) await db.from('inscripciones').update({ estudiante_error: null }).eq('id', id);
    return { ok: !errores.length, primera, nuevoDocumento };
  }

  /* ------------------------------------------ tick ------------------------------------------ */
  async function tick() {
    const t = ahora().getTime();
    const hace = (ms: number) => new Date(t - ms).toISOString();
    const resumen = { cerradas: 0, recordatorios: 0, plazos: 0, borradas: 0 };

    // a) Requests the page never closed, or whose first email failed: mark ready again (trigger -> notificar).
    const { data: sinCerrar } = await db
      .from('inscripciones')
      .select('id')
      .eq('es_estudiante', true)
      .in('estudiante_estado', PENDIENTES)
      .or(
        `and(estudiante_listo_at.is.null,estudiante_solicitud_at.lt."${hace(SIN_CERRAR_MS)}"),` +
          `and(estudiante_correo_alumno_at.is.null,estudiante_listo_at.lt."${hace(SIN_CERRAR_MS)}")`
      )
      .limit(50);
    for (const r of (sinCerrar ?? []) as { id: string }[]) {
      await db.from('inscripciones').update({ estudiante_listo_at: ahora().toISOString() }).eq('id', r.id);
      resumen.cerradas++;
    }

    // b) One reminder at 48 h to students who have not uploaded their ID.
    const { data: porRecordar } = await db
      .from('inscripciones')
      .select(COLUMNAS)
      .eq('es_estudiante', true)
      .eq('estudiante_estado', 'pendiente_documento')
      .is('estudiante_recordatorio_at', null)
      .lt('estudiante_correo_alumno_at', hace(RECORDATORIO_MS))
      .limit(50);
    for (const f of (porRecordar ?? []) as unknown as Fila[]) {
      if (Date.parse(f.estudiante_correo_alumno_at!) < t - PLAZO_MS) {
        // Too late for a reminder; the deadline notice handles it.
        await db.from('inscripciones').update({ estudiante_recordatorio_at: ahora().toISOString() }).eq('id', f.id);
        continue;
      }
      const { data: reclamo } = await db
        .from('inscripciones')
        .update({ estudiante_recordatorio_at: ahora().toISOString() })
        .eq('id', f.id)
        .is('estudiante_recordatorio_at', null)
        .select('id');
      if (!reclamo?.length) continue;
      const limite = new Date(Date.parse(f.estudiante_correo_alumno_at!) + PLAZO_MS);
      const err = await enviar(f.email, correos.alumnoRecordatorio(f, limite, logo()), `estudiante-recordatorio-${f.id}`, 'estudiante_recordatorio');
      if (err) await guardarError(f.id, `recordatorio: ${err}`);
      else resumen.recordatorios++;
    }

    // c) Deadline (72 h) without an uploaded ID: tell Mauricio, with the same buttons.
    const { data: vencidas } = await db
      .from('inscripciones')
      .select(COLUMNAS)
      .eq('es_estudiante', true)
      .eq('estudiante_estado', 'pendiente_documento')
      .is('estudiante_plazo_aviso_at', null)
      .lt('estudiante_correo_alumno_at', hace(PLAZO_MS))
      .limit(50);
    for (const f of (vencidas ?? []) as unknown as Fila[]) {
      const { data: reclamo } = await db
        .from('inscripciones')
        .update({ estudiante_plazo_aviso_at: ahora().toISOString() })
        .eq('id', f.id)
        .is('estudiante_plazo_aviso_at', null)
        .select('id');
      if (!reclamo?.length) continue;
      const b = await botones(f.id);
      const err = await enviar(revisor(), correos.plazoVencido(f, b.aprobar, b.rechazar, logo()), `estudiante-plazo-${f.id}`, 'estudiante_plazo');
      if (err) await guardarError(f.id, `plazo: ${err}`);
      else resumen.plazos++;
    }

    // d) Course over: no ID is kept for requests nobody decided.
    if (t > Date.parse(FIN_CURSO)) {
      const { data: restantes } = await db
        .from('inscripciones')
        .select('id')
        .eq('es_estudiante', true)
        .not('estudiante_documento_path', 'is', null)
        .limit(50);
      for (const r of (restantes ?? []) as { id: string }[]) {
        await borrarDocumentos(r.id);
        await db.from('inscripciones').update({ estudiante_documento_path: null }).eq('id', r.id);
        resumen.borradas++;
      }
    }

    return { ok: true, ...resumen };
  }

  /* --------------------------------------- revision ----------------------------------------- */
  function idDeClave(b: Record<string, unknown>): Promise<string | null> {
    const secreto = env.get('ESTUDIANTES_FIRMA') ?? '';
    if (!secreto) return Promise.resolve(null);
    return verificarClave(secreto, texto(b.clave, 300), ahora());
  }

  const motivosLista = () => Object.entries(MOTIVOS).map(([codigo, m]) => ({ codigo, etiqueta: m.etiqueta }));

  async function revisionVer(b: Record<string, unknown>) {
    const id = await idDeClave(b);
    if (!id) return json({ ok: false, error: 'clave' }, 401);
    const f = await leer(id);
    if (!f || !f.es_estudiante) return json({ ok: false, error: 'no_encontrada' }, 404);

    let documento: { url: string; tipo: string } | null = null;
    if (PENDIENTES.includes(f.estudiante_estado ?? '')) {
      const doc = await documentoActual(id);
      if (doc) {
        const { data } = await db.storage.from(BUCKET).createSignedUrl(doc.path, 600);
        if (data?.signedUrl) documento = { url: data.signedUrl, tipo: doc.tipo };
      }
    }
    return json({
      ok: true,
      nombre: f.nombre,
      apellidos: f.apellidos,
      email: f.email,
      estado: f.estudiante_estado,
      pagado: f.pago_estado === 'pagado',
      solicitud_at: f.estudiante_solicitud_at,
      decidido_at: f.estudiante_decidido_at,
      motivo: f.estudiante_motivo_rechazo ? MOTIVOS[f.estudiante_motivo_rechazo]?.etiqueta ?? f.estudiante_motivo_rechazo : null,
      documento,
      motivos: motivosLista(),
    });
  }

  async function revisionDecidir(b: Record<string, unknown>) {
    const id = await idDeClave(b);
    if (!id) return json({ ok: false, error: 'clave' }, 401);
    const decision = texto(b.decision, 20);
    const motivo = texto(b.motivo, 40);
    if (decision !== 'aprobar' && decision !== 'rechazar') return json({ ok: false, error: 'decision' }, 400);
    if (decision === 'rechazar' && !MOTIVOS[motivo]) return json({ ok: false, error: 'motivo' }, 400);

    const f = await leer(id);
    if (!f || !f.es_estudiante) return json({ ok: false, error: 'no_encontrada' }, 404);
    if (f.pago_estado === 'pagado') return json({ ok: false, error: 'ya_pagado' }, 409);
    if (!PENDIENTES.includes(f.estudiante_estado ?? '')) {
      return json({ ok: true, ya_decidido: true, estado: f.estudiante_estado });
    }

    const aprobado = decision === 'aprobar';
    const { data: guardado, error } = await db
      .from('inscripciones')
      .update({
        estudiante_estado: aprobado ? 'validado' : 'rechazado',
        estudiante_motivo_rechazo: aprobado ? null : motivo,
        estudiante_decidido_at: ahora().toISOString(),
        estudiante_documento_path: null,
        monto: aprobado ? MONTO_ESTUDIANTE : MONTO_REGULAR,
        // Any earlier link was for a different amount; the next one is created with the new `monto`.
        clip_payment_url: null,
        clip_link_expires_at: null,
      })
      .eq('id', id)
      .in('estudiante_estado', PENDIENTES)
      .select('id');
    if (error) throw error;
    if (!guardado?.length) {
      const actual = await leer(id);
      return json({ ok: true, ya_decidido: true, estado: actual?.estudiante_estado ?? null });
    }

    // The ID is no longer needed once the decision is made (see Aviso de privacidad).
    await borrarDocumentos(id);

    const c = aprobado
      ? correos.alumnoAprobado(f, pagoUrl(id), logo())
      : correos.alumnoRechazado(f, MOTIVOS[motivo].texto, pagoUrl(id), logo());
    const err = await enviar(f.email, c, `estudiante-decision-${id}`, aprobado ? 'estudiante_aprobado' : 'estudiante_rechazado');
    if (err) await guardarError(id, `decision: ${err}`);
    else await db.from('inscripciones').update({ estudiante_error: null }).eq('id', id);

    return json({ ok: true, estado: aprobado ? 'validado' : 'rechazado', correo_enviado: !err });
  }

  /* ----------------------------------------------------------------------------------------- */
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: 'json' }, 400);
    }

    try {
      if (body.accion === 'revision_ver') return await revisionVer(body);
      if (body.accion === 'revision_decidir') return await revisionDecidir(body);

      // Everything else is internal: the database calls with ?token=.
      const esperado = env.get('ESTUDIANTES_TOKEN') ?? '';
      const recibido = new URL(req.url).searchParams.get('token') ?? '';
      if (!esperado || !iguales(recibido, esperado)) return json({ ok: false }, 401);
      if (!env.get('ESTUDIANTES_FIRMA') || !site()) return json({ ok: false, error: 'config' }, 500);

      if (body.accion === 'notificar') {
        const id = texto(body.id, 36);
        if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
        return json(await notificar(id));
      }
      if (body.accion === 'tick') return json(await tick());
      return json({ ok: false, error: 'accion' }, 400);
    } catch (e) {
      console.error('estudiantes error', e instanceof Error ? e.message : e);
      return json({ ok: false, error: 'interno' }, 500);
    }
  };
}

/** Service key: legacy SUPABASE_SERVICE_ROLE_KEY, or the new secret key (SUPABASE_SECRET_KEYS is a JSON object of named keys). */
function claveServicio(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>;
    const k = keys.default ?? Object.values(keys)[0];
    if (k) return k;
  } catch {
    /* fall through */
  }
  throw new Error('No Supabase service/secret key available to this function');
}

const db = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), {
  auth: { persistSession: false },
});
Deno.serve(crearHandler({ db, env: Deno.env, fetch, now: () => new Date() }));

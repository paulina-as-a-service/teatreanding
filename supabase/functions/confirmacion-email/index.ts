/**
 * Edge Function: confirmacion-email
 *
 * Sends the "tu lugar está apartado" confirmation email through Resend once a registration is paid.
 * Called by the database (trigger `inscripciones_confirmacion_email`, via pg_net) with { "id": <uuid> }:
 *   - when pago_estado changes to 'pagado' (Clip webhook or the success page's backup check), or
 *   - when someone sets confirmacion_estado = 'reintentar' in the Table Editor (manual resend).
 *
 * Each registration gets one confirmation. Before sending, the function claims the row
 * (confirmacion_estado = 'enviando') with a conditional update, so two calls at the same time
 * cannot both send. A claim older than 10 minutes counts as abandoned and can be retried.
 *
 * Secrets (Supabase > Edge Functions > Secrets):
 *   RESEND_API_KEY          Resend API key ("Sending access" is enough)
 *   CONFIRMACION_TOKEN      random string; the same value goes in the Vault URL (?token=...)
 *   RESEND_FROM             optional, default "Teatranding! <inscripciones@teatranding.com>"
 *   RESEND_REPLY_TO         optional, default "teatranding@gmail.com"
 *   ZOOM_URL                required; Zoom link with passcode (if missing, the row is marked 'error')
 * Provided automatically: SUPABASE_URL and the service key (legacy or new format).
 *
 * Deploy with JWT verification OFF (the database call uses ?token= instead).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Env = { get(key: string): string | undefined };
export type Deps = { db: SupabaseClient; env: Env; fetch: typeof fetch; now: () => Date };

type Fila = {
  id: string;
  nombre: string;
  email: string;
  pago_estado: string;
  confirmacion_estado: string | null;
  confirmacion_intentos: number;
  confirmacion_actualizado_at: string | null;
};

const RESEND_API = 'https://api.resend.com/emails';
const FROM_DEFAULT = 'Teatranding! <inscripciones@teatranding.com>';
const REPLY_TO_DEFAULT = 'teatranding@gmail.com';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECLAMO_VENCIDO_MS = 10 * 60 * 1000;
const COLUMNAS =
  'id,nombre,email,pago_estado,confirmacion_estado,confirmacion_intentos,confirmacion_actualizado_at';

/* ------------------------------------------------------------------------------------------
 * PLANTILLA DEL CORREO (texto final, 20 oct 2026)
 * Variables: nombre (de la inscripción) y zoomUrl (secreto ZOOM_URL).
 * Si cambia la reunión de Zoom, actualiza ZOOM_URL y también ZOOM_ID / ZOOM_CODIGO aquí abajo.
 * ---------------------------------------------------------------------------------------- */
export const ASUNTO = 'Teatranding: ¡Tu lugar ha sido apartado!';

const CURSO_NOMBRE = 'Introducción a la producción creativa para eventos y entretenimiento';
const ZOOM_ID = '879 9365 9845';
const ZOOM_CODIGO = '3UUxQi';
const CONTACTO_EMAIL = 'teatranding@gmail.com';
const INSTAGRAM = 'teatranding.mx';

const DETALLES: [string, string][] = [
  ['Curso', CURSO_NOMBRE],
  ['Imparte', 'Mauricio Baylón'],
  ['Fecha de inicio', 'Sábado 14 de noviembre'],
  ['Periodo', 'Sábados del 14 de noviembre al 12 de diciembre'],
  ['Horario', '10:00 a 14:00 hrs (Hora de la Ciudad de México / CDMX)'],
  ['Modalidad', 'Online en vivo vía Zoom'],
];

export function cuerpoTexto(nombre: string, zoomUrl: string): string {
  return [
    `¡Muchas gracias por tu compra, ${nombre}! Tu pago ha sido recibido con éxito 🎉`,
    `¡Te damos la más cordial bienvenida a ${CURSO_NOMBRE}! Tu lugar ya está completamente asegurado.`,
    '',
    '📌 Detalles del curso',
    ...DETALLES.map(([k, v]) => `${k}: ${v}`),
    '',
    'Podrás unirte a todas las sesiones a través del siguiente enlace:',
    `🔗 ${zoomUrl}`,
    `ID de reunión: ${ZOOM_ID}`,
    `Código de acceso: ${ZOOM_CODIGO}`,
    '(Te sugerimos guardar este enlace en tu calendario y conectarte 5 minutos antes del inicio).',
    '',
    '¿Tienes alguna duda?',
    `Si necesitas ayuda o tienes preguntas antes de comenzar, escríbenos a ${CONTACTO_EMAIL} o por Instagram en @${INSTAGRAM}.`,
    '',
    '¡Nos vemos el 14 de noviembre para comenzar a crear!',
  ].join('\n');
}

export function cuerpoHtml(nombre: string, zoomUrl: string): string {
  const n = escapar(nombre);
  const z = escapar(zoomUrl);
  const filas = DETALLES.map(
    ([k, v]) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#5b5480;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:4px 0;">${escapar(v)}</td></tr>`
  ).join('');
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f4f2fb;font-family:Arial,Helvetica,sans-serif;color:#1d1a3a;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;line-height:1.55;font-size:15px;">
    <p style="margin-top:0;"><strong>¡Muchas gracias por tu compra, ${n}!</strong> Tu pago ha sido recibido con éxito 🎉</p>
    <p>¡Te damos la más cordial bienvenida a <strong>${CURSO_NOMBRE}</strong>! Tu lugar ya está completamente asegurado.</p>
    <h2 style="font-size:17px;margin:28px 0 8px;">📌 Detalles del curso</h2>
    <table role="presentation" style="border-collapse:collapse;font-size:15px;">${filas}</table>
    <p style="margin-top:24px;">Podrás unirte a todas las sesiones a través del siguiente enlace:</p>
    <p style="margin:0 0 8px;">🔗 <a href="${z}" style="color:#3b2fc9;font-weight:bold;">${z}</a></p>
    <p style="margin:0;">ID de reunión: <strong>${ZOOM_ID}</strong><br>Código de acceso: <strong>${ZOOM_CODIGO}</strong></p>
    <p style="color:#5b5480;font-size:14px;">(Te sugerimos guardar este enlace en tu calendario y conectarte 5 minutos antes del inicio).</p>
    <h2 style="font-size:17px;margin:28px 0 8px;">¿Tienes alguna duda?</h2>
    <p style="margin-top:0;">Si necesitas ayuda o tienes preguntas antes de comenzar, escríbenos a <a href="mailto:${CONTACTO_EMAIL}" style="color:#3b2fc9;">${CONTACTO_EMAIL}</a> o por Instagram en <a href="https://www.instagram.com/${INSTAGRAM}/" style="color:#3b2fc9;">@${INSTAGRAM}</a>.</p>
    <p style="margin-top:28px;font-weight:bold;">¡Nos vemos el 14 de noviembre para comenzar a crear!</p>
  </div>
</body>
</html>`;
}
/* ---------------------------------------------------------------------------------------- */

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const iguales = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export function crearHandler(deps: Deps) {
  const { db, env } = deps;

  /** Whether this registration may be (re)sent right now. */
  const puedeEnviar = (f: Fila) => {
    if (f.pago_estado !== 'pagado') return false;
    if (f.confirmacion_estado === null || f.confirmacion_estado === 'error' || f.confirmacion_estado === 'reintentar') {
      return true;
    }
    if (f.confirmacion_estado === 'enviando') {
      const t = Date.parse(f.confirmacion_actualizado_at ?? '');
      return !Number.isFinite(t) || deps.now().getTime() - t > RECLAMO_VENCIDO_MS;
    }
    return false; // 'enviada'
  };

  async function marcar(id: string, cambios: Record<string, unknown>) {
    const { error } = await db
      .from('inscripciones')
      .update({ ...cambios, confirmacion_actualizado_at: deps.now().toISOString() })
      .eq('id', id);
    if (error) console.error('confirmacion update failed', id, error.message);
  }

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    const esperado = env.get('CONFIRMACION_TOKEN') ?? '';
    const recibido = new URL(req.url).searchParams.get('token') ?? '';
    if (!esperado || !iguales(recibido, esperado)) return json({ ok: false }, 401);

    let id = '';
    try {
      const b = await req.json();
      id = typeof b?.id === 'string' ? b.id : '';
    } catch {
      return json({ ok: false, error: 'json' }, 400);
    }
    if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);

    const apiKey = env.get('RESEND_API_KEY');
    if (!apiKey) return json({ ok: false, error: 'config' }, 500);

    const { data, error } = await db.from('inscripciones').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) return json({ ok: false, error: 'db' }, 500);
    if (!data) return json({ ok: false, error: 'no_encontrada' }, 404);
    const fila = data as Fila;
    if (!puedeEnviar(fila)) return json({ ok: true, omitido: true, estado: fila.confirmacion_estado });

    // Claim the row: succeeds only if nobody changed it since we read it.
    const intento = fila.confirmacion_intentos + 1;
    let reclamo = db
      .from('inscripciones')
      .update({
        confirmacion_estado: 'enviando',
        confirmacion_intentos: intento,
        confirmacion_error: null,
        confirmacion_actualizado_at: deps.now().toISOString(),
      })
      .eq('id', id)
      .eq('pago_estado', 'pagado')
      .eq('confirmacion_intentos', fila.confirmacion_intentos);
    reclamo =
      fila.confirmacion_estado === null
        ? reclamo.is('confirmacion_estado', null)
        : reclamo.eq('confirmacion_estado', fila.confirmacion_estado);
    const { data: reclamada, error: errReclamo } = await reclamo.select('id');
    if (errReclamo) return json({ ok: false, error: 'db' }, 500);
    if (!reclamada?.length) return json({ ok: true, omitido: true, motivo: 'en_curso' });

    const nombre = (fila.nombre ?? '').trim();
    const zoomUrl = env.get('ZOOM_URL')?.trim() ?? '';
    if (!zoomUrl) {
      // Never send the confirmation without the Zoom link. Set ZOOM_URL, then mark 'reintentar'.
      await marcar(id, { confirmacion_estado: 'error', confirmacion_error: 'Falta el secreto ZOOM_URL' });
      return json({ ok: false, error: 'config_zoom' }, 500);
    }

    let res: Response;
    try {
      res = await deps.fetch(env.get('RESEND_API_URL') ?? RESEND_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // Same attempt never produces two emails, even if this request is repeated.
          'Idempotency-Key': `confirmacion-${id}-${intento}`,
        },
        body: JSON.stringify({
          from: env.get('RESEND_FROM') || FROM_DEFAULT,
          to: [fila.email],
          reply_to: env.get('RESEND_REPLY_TO') || REPLY_TO_DEFAULT,
          subject: ASUNTO,
          html: cuerpoHtml(nombre, zoomUrl),
          text: cuerpoTexto(nombre, zoomUrl),
          tags: [{ name: 'tipo', value: 'confirmacion_pago' }],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Resend request failed', id, msg);
      await marcar(id, { confirmacion_estado: 'error', confirmacion_error: `red: ${msg}`.slice(0, 500) });
      return json({ ok: false, error: 'resend' }, 502);
    }

    const r = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || typeof r.id !== 'string') {
      const msg = `HTTP ${res.status}: ${JSON.stringify(r)}`.slice(0, 500);
      console.error('Resend rejected email', id, msg);
      await marcar(id, { confirmacion_estado: 'error', confirmacion_error: msg });
      return json({ ok: false, error: 'resend', status: res.status }, 502);
    }

    await marcar(id, {
      confirmacion_estado: 'enviada',
      confirmacion_enviada_at: deps.now().toISOString(),
      confirmacion_resend_id: r.id,
      confirmacion_error: null,
    });
    return json({ ok: true, enviado: true, resend_id: r.id });
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

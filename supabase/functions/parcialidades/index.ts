/**
 * Edge Function: parcialidades
 *
 * Emails for the installment plan ($500 to reserve the spot, then pago 2 and pago 3):
 *   - apartado:  "Apartaste tu lugar" right after the $500 is confirmed (amounts and dates of the next payments).
 *   - pago2:     link to pay pago 2 on FECHA_PAGO2 (day the course starts). The Zoom email goes out when it is paid
 *                (function `confirmacion-email`).
 *   - pago3:     link to pay pago 3 on FECHA_PAGO3, to whoever already paid pago 2.
 *   - liquidado: "Liquidaste tu curso" once the balance reaches zero.
 * Each email goes out once per registration (claimed with a timestamp column before sending; if Resend fails, the
 * column is cleared again and the next hourly run retries).
 *
 * Calls (POST with ?token=):
 *   { accion: 'pago', id }  from the database, after a payment row is inserted (trigger on `pagos`)
 *   { accion: 'tick' }      from pg_cron, every hour at minute 7: sends whatever is due (dates above) and retries
 *
 * Payment links are SITE_URL/?pagar=<id>: the site asks `inscripcion` for a fresh Clip link for the next payment,
 * so the link in the email never expires.
 *
 * Secrets (Supabase > Edge Functions > Secrets):
 *   RESEND_API_KEY          the same key as `confirmacion-email`
 *   PARCIALIDADES_TOKEN     random string (letters and numbers, 32+); the same value goes in the Vault URL
 *   SITE_URL                shared with `inscripcion`
 *   RESEND_FROM, RESEND_REPLY_TO, LOGO_URL   optional, same defaults as the other functions
 * Provided automatically: SUPABASE_URL and the service key (legacy or new format).
 *
 * Deploy with JWT verification OFF (the database call uses ?token= instead).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Env = { get(key: string): string | undefined };
export type Deps = { db: SupabaseClient; env: Env; fetch: typeof fetch; now: () => Date };

export type Fila = {
  id: string;
  nombre: string;
  email: string;
  pago_estado: string;
  plan_pago: string | null;
  monto: number | string;
  monto_pagado: number | string;
  apartado_correo_at: string | null;
  pago2_correo_at: string | null;
  pago3_correo_at: string | null;
  liquidado_correo_at: string | null;
};

const COLUMNAS =
  'id,nombre,email,pago_estado,plan_pago,monto,monto_pagado,' +
  'apartado_correo_at,pago2_correo_at,pago3_correo_at,liquidado_correo_at';

/* ------------------------------------------------------------------------------------------
 * FECHAS DE ENVÍO (hora CDMX = UTC-6)
 * Pago 2: sábado 14 de noviembre, 07:00 (antes de la primera sesión, 10:00).
 * Pago 3: lunes 30 de noviembre, 09:00.
 * La tarea programada corre cada hora en el minuto 7, así que los correos salen a las 07:07 y 09:07.
 * ---------------------------------------------------------------------------------------- */
export const FECHA_PAGO2 = '2026-11-14T13:00:00Z';
export const FECHA_PAGO3 = '2026-11-30T15:00:00Z';
const DIA_INICIO_CDMX = '2026-11-14';

const APARTADO = 500;
const RESEND_API = 'https://api.resend.com/emails';
const FROM_DEFAULT = 'Teatranding! <inscripciones@teatranding.com>';
const CONTACTO = 'teatranding@gmail.com';
const INSTAGRAM = 'teatranding.mx';
const CURSO_NOMBRE = 'Introducción a la producción creativa para eventos y entretenimiento';
const ZONA = 'America/Mexico_City';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const redondear = (n: number) => Math.round(n * 100) / 100;
/** Same split as `inscripcion`: pago 2 and pago 3 divide the rest in two. */
export function montos(total: number) {
  const pago2 = redondear((total - APARTADO) / 2);
  return { total, apartado: APARTADO, pago2, pago3: redondear(total - APARTADO - pago2) };
}

export const pesos = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} MXN`;

/* ------------------------------------------------------------------------------------------
 * Correos
 * ---------------------------------------------------------------------------------------- */
type Correo = { asunto: string; html: string; texto: string };
type Boton = { texto: string; url: string };

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
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
        `<a href="${escapar(b.url)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 22px;border-radius:999px;font-weight:bold;text-decoration:none;background:#3b2fc9;color:#ffffff;border:2px solid #3b2fc9;">${escapar(b.texto)}</a>`
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
  const texto = [...parrafos.map(sinMarcas), ...botones.map((b) => `${b.texto}: ${b.url}`), ...pie.map(sinMarcas)].join('\n\n');
  return { asunto, html, texto };
}

const primerNombre = (f: Fila) => (f.nombre ?? '').trim().split(/\s+/)[0] || '';
const dudas = `¿Dudas? Responde este correo o escríbenos por Instagram a @${INSTAGRAM}.`;

export const correos = {
  apartado: (f: Fila, logo: string | null) => {
    const m = montos(Number(f.monto));
    return armar('Teatranding: apartaste tu lugar en el curso', logo, [
      `Hola, ${primerNombre(f)}:`,
      `Recibimos tus **${pesos(m.apartado)}**. Tu lugar en ${CURSO_NOMBRE} ya está apartado.`,
      `Así quedan tus siguientes pagos (total del curso: ${pesos(m.total)}):`,
      `**Pago 2: ${pesos(m.pago2)}**, sábado 14 de noviembre (día de inicio).`,
      `**Pago 3: ${pesos(m.pago3)}**, lunes 30 de noviembre (pago final).`,
      'En cada fecha te mandamos a este correo el enlace seguro de Clip para pagar. Sin intereses ni trámites extra.',
      'El enlace de Zoom te llega en cuanto se confirme tu pago 2.',
    ], [], [dudas]);
  },

  pago2: (f: Fila, pagoUrl: string, hoyEsInicio: boolean, logo: string | null) => {
    const m = montos(Number(f.monto));
    return armar(
      hoyEsInicio ? 'Teatranding: hoy arranca el curso, realiza tu pago 2' : 'Teatranding: realiza tu pago 2',
      logo,
      [
        `Hola, ${primerNombre(f)}:`,
        hoyEsInicio
          ? `Hoy arranca el curso, de 10:00 a 14:00 hrs (hora CDMX). Para recibir el enlace de Zoom, realiza tu **pago 2 de ${pesos(m.pago2)}** antes de la sesión.`
          : `Para recibir el enlace de Zoom del curso, realiza tu **pago 2 de ${pesos(m.pago2)}**.`,
        'En cuanto Clip confirme el pago te llega un correo con el enlace de Zoom y los datos de las sesiones.',
      ],
      [{ texto: `Pagar ${pesos(m.pago2)}`, url: pagoUrl }],
      [`Tu pago 3 y final, de ${pesos(m.pago3)}, es el lunes 30 de noviembre. Ese día te mandamos su enlace.`, dudas]
    );
  },

  pago3: (f: Fila, pagoUrl: string, logo: string | null) => {
    const m = montos(Number(f.monto));
    return armar('Teatranding: tu pago final del curso', logo, [
      `Hola, ${primerNombre(f)}:`,
      `Hoy toca tu **pago 3 y final, de ${pesos(m.pago3)}**. Con este pago liquidas el curso.`,
    ], [{ texto: `Pagar ${pesos(m.pago3)}`, url: pagoUrl }], [dudas]);
  },

  liquidado: (f: Fila, logo: string | null) =>
    armar('Teatranding: liquidaste tu curso', logo, [
      `Hola, ${primerNombre(f)}:`,
      `Recibimos tu pago final. Cubriste el total del curso, **${pesos(Number(f.monto))}**, y no tienes pagos pendientes.`,
      'Nos vemos en la siguiente sesión.',
    ], [], [dudas]),
};

/* ---------------------------------------------------------------------------------------- */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const iguales = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

/** YYYY-MM-DD in Mexico City. */
const diaCDMX = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

type Columna = 'apartado_correo_at' | 'pago2_correo_at' | 'pago3_correo_at' | 'liquidado_correo_at';

export function crearHandler(deps: Deps) {
  const { db, env } = deps;
  const site = () => (env.get('SITE_URL') ?? '').trim().replace(/\/+$/, '');
  const logo = () => env.get('LOGO_URL')?.trim() || (site() ? `${site()}/img/logo-correo.png` : null);
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

  /** Claims the column (only if still empty), sends, and releases the claim if sending failed. */
  async function enviarUnaVez(f: Fila, columna: Columna, correo: () => Correo, tipo: string): Promise<boolean> {
    const { data: reclamo, error } = await db
      .from('inscripciones')
      .update({ [columna]: deps.now().toISOString() })
      .eq('id', f.id)
      .is(columna, null)
      .select('id');
    if (error) throw error;
    if (!reclamo?.length) return false;
    const err = await enviar(f.email, correo(), `parcialidades-${tipo}-${f.id}`, `parcialidades_${tipo}`);
    if (err) {
      console.error('parcialidades email failed', f.id, tipo, err);
      await db.from('inscripciones').update({ [columna]: null, parcialidades_error: `${tipo}: ${err}`.slice(0, 500) }).eq('id', f.id);
      return false;
    }
    await db.from('inscripciones').update({ parcialidades_error: null }).eq('id', f.id);
    return true;
  }

  /** Sends every installment email that is due for one registration. */
  async function procesar(f: Fila): Promise<string[]> {
    if (f.plan_pago !== 'parcialidades' || f.pago_estado === 'cancelado') return [];
    const { data, error } = await db.from('pagos').select('concepto').eq('inscripcion_id', f.id);
    if (error) throw error;
    const pagados = new Set(((data ?? []) as { concepto: string }[]).map((p) => p.concepto));
    if (!pagados.has('apartado')) return [];

    const t = deps.now();
    const enviados: string[] = [];
    if (!f.apartado_correo_at && (await enviarUnaVez(f, 'apartado_correo_at', () => correos.apartado(f, logo()), 'apartado'))) {
      enviados.push('apartado');
    }
    if (
      !pagados.has('pago2') &&
      !f.pago2_correo_at &&
      t.getTime() >= Date.parse(FECHA_PAGO2) &&
      (await enviarUnaVez(f, 'pago2_correo_at', () => correos.pago2(f, pagoUrl(f.id), diaCDMX(t) === DIA_INICIO_CDMX, logo()), 'pago2'))
    ) {
      enviados.push('pago2');
    }
    if (
      pagados.has('pago2') &&
      !pagados.has('pago3') &&
      f.pago_estado !== 'pagado' &&
      !f.pago3_correo_at &&
      t.getTime() >= Date.parse(FECHA_PAGO3) &&
      (await enviarUnaVez(f, 'pago3_correo_at', () => correos.pago3(f, pagoUrl(f.id), logo()), 'pago3'))
    ) {
      enviados.push('pago3');
    }
    if (
      f.pago_estado === 'pagado' &&
      !f.liquidado_correo_at &&
      (await enviarUnaVez(f, 'liquidado_correo_at', () => correos.liquidado(f, logo()), 'liquidado'))
    ) {
      enviados.push('liquidado');
    }
    return enviados;
  }

  async function pago(id: string) {
    const { data, error } = await db.from('inscripciones').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return json({ ok: false, error: 'no_encontrada' }, 404);
    return json({ ok: true, enviados: await procesar(data as unknown as Fila) });
  }

  async function tick() {
    const { data, error } = await db
      .from('inscripciones')
      .select(COLUMNAS)
      .eq('plan_pago', 'parcialidades')
      .or('apartado_correo_at.is.null,pago2_correo_at.is.null,pago3_correo_at.is.null,liquidado_correo_at.is.null')
      .limit(500);
    if (error) throw error;
    const resumen: Record<string, number> = { apartado: 0, pago2: 0, pago3: 0, liquidado: 0 };
    for (const f of (data ?? []) as unknown as Fila[]) {
      try {
        for (const tipo of await procesar(f)) resumen[tipo]++;
      } catch (e) {
        console.error('parcialidades tick failed', f.id, e instanceof Error ? e.message : e);
      }
    }
    return json({ ok: true, ...resumen });
  }

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
    const esperado = env.get('PARCIALIDADES_TOKEN') ?? '';
    const recibido = new URL(req.url).searchParams.get('token') ?? '';
    if (!esperado || !iguales(recibido, esperado)) return json({ ok: false }, 401);

    let b: Record<string, unknown>;
    try {
      b = await req.json();
    } catch {
      return json({ ok: false, error: 'json' }, 400);
    }
    try {
      if (b.accion === 'tick') return await tick();
      if (b.accion === 'pago') {
        const id = typeof b.id === 'string' ? b.id : '';
        if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
        return await pago(id);
      }
      return json({ ok: false, error: 'accion' }, 400);
    } catch (e) {
      console.error('parcialidades error', e instanceof Error ? e.message : e);
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

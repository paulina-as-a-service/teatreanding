/**
 * Edge Function: inscripcion
 *
 * Called by the landing page form (supabase.functions.invoke('inscripcion')).
 *   { accion: 'registrar', nombre, apellidos, email, motivo, aceptaPrivacidad, aceptaComunicaciones, avisoVersion }
 *     -> saves (or refreshes) the registration. With no payment yet it answers `requiere_plan` and the
 *        amounts of both options; the page then asks for the link with the option chosen.
 *   { accion: 'link', id, plan?: 'completo' | 'parcialidades' }
 *     -> returns a valid Clip payment link for the next payment of that registration (creates a new one if
 *        expired). First payment: `plan` decides between the full amount and the $500 apartado; without it,
 *        the answer is `requiere_plan`. After the apartado: pago 2, then pago 3 (no `plan` needed).
 *   { accion: 'registrar', ..., esEstudiante: true }
 *     -> saves the registration as a student-discount request (no payment link yet) and returns a
 *        signed upload URL for the student ID in the private bucket `documentos-estudiantes`.
 *   { accion: 'estudiante_listo', id }
 *     -> called after the optional upload. Marks the request as ready; a database trigger then calls
 *        the `estudiantes` function, which sends the emails to the student and to Mauricio.
 *   { accion: 'estado', id, concepto? }
 *     -> returns whether that payment (or, without `concepto`, the whole course) is recorded. Used after Clip
 *        redirects back. If not, it asks Clip directly about the registration's unrecorded links, so a
 *        payment is confirmed even if Clip's webhook is late or missing.
 *
 * Payments: 'completo' (the registration's `monto`) or 'apartado' ($500) + 'pago2' + 'pago3' (the rest in two
 * equal parts: 749.50 each for 1999, 499.50 each for 1499). Each confirmed payment is a row in `pagos`
 * (database function registrar_pago_clip); the database recalculates pago_estado and sends the emails.
 * New registrations and first payments close at CIERRE (start of the course). Pago 2 and pago 3 stay open.
 *
 * Secrets (Supabase > Edge Functions > Secrets):
 *   CLIP_API_KEY, CLIP_SECRET_KEY   Clip credential ("Tienda online")
 *   CLIP_WEBHOOK_TOKEN              random string, must match the clip-webhook function
 *   SITE_URL                        https://teatranding.com (antes https://teatranding.bolt.host)
 *
 * The course price is the registration's `monto` column (1999 by default, 1499 once a student discount is
 * approved by the `estudiantes` function). Each link charges montoDe(monto, concepto). CLIP_MONTO is not used.
 * Provided automatically by Supabase: SUPABASE_URL and the service key (legacy or new format).
 *
 * Deploy with JWT verification OFF (the function validates its own input).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Env = { get(key: string): string | undefined };
export type Deps = { db: SupabaseClient; env: Env; fetch: typeof fetch; now: () => Date };

type Fila = {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  pago_estado: string;
  clip_payment_url: string | null;
  clip_link_expires_at: string | null;
  monto: number | string;
  es_estudiante: boolean;
  estudiante_estado: string | null;
  plan_pago: string | null;
  clip_link_concepto: string | null;
  monto_pagado: number | string | null;
};

export type Concepto = 'completo' | 'apartado' | 'pago2' | 'pago3';
type Plan = 'completo' | 'parcialidades';

const COLUMNAS =
  'id,nombre,apellidos,email,pago_estado,clip_payment_url,clip_link_expires_at,monto,es_estudiante,estudiante_estado,plan_pago,clip_link_concepto,monto_pagado';
const CONCEPTOS = new Set<string>(['completo', 'apartado', 'pago2', 'pago3']);
export const APARTADO = 500;
/** Sign-ups and first payments close when the course starts: Saturday 14 Nov 2026, 10:00 CDMX. */
export const CIERRE = '2026-11-14T16:00:00Z';

const redondear = (n: number) => Math.round(n * 100) / 100;
/** Amount of each payment for a course price (pago2 and pago3 split the rest in two). */
export function montoDe(total: number, concepto: Concepto): number {
  const cuota = redondear((total - APARTADO) / 2);
  if (concepto === 'apartado') return APARTADO;
  if (concepto === 'pago2') return cuota;
  if (concepto === 'pago3') return redondear(total - APARTADO - cuota);
  return total;
}
const opcionesDe = (total: number) => ({
  completo: total,
  apartado: APARTADO,
  pago2: montoDe(total, 'pago2'),
  pago3: montoDe(total, 'pago3'),
});
const ETIQUETA: Record<Concepto, string> = {
  completo: '',
  apartado: ' · Apartado',
  pago2: ' · Pago 2 de 3',
  pago3: ' · Pago 3 de 3',
};
const BUCKET = 'documentos-estudiantes';
const PENDIENTES = new Set(['pendiente_documento', 'en_revision']);
/** Student request still waiting for Mauricio's decision: no payment link until then. */
const enRevision = (f: Fila) => f.es_estudiante && PENDIENTES.has(f.estudiante_estado ?? '');
const CLIP_API = 'https://api.payclip.com/v2/checkout';
const DESCRIPCION = 'Curso Introducción a la Producción Creativa para eventos y entretenimiento (Teatranding!)';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Reuse an existing link only if it stays valid at least this long.
const MARGEN_MS = 30 * 60 * 1000;
const COMPLETADO = new Set(['CHECKOUT_COMPLETED', 'COMPLETED']);

const estadoDe = (clip: Record<string, unknown>) =>
  String(clip.status ?? clip.resource_status ?? clip.payment_status ?? '').toUpperCase();
const textoClip = (v: unknown) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null);
const fechaValida = (...vals: unknown[]) => {
  for (const v of vals) {
    if (typeof v === 'string' && Number.isFinite(Date.parse(v))) return new Date(v).toISOString();
  }
  return null;
};

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

  const cerrado = () => deps.now().getTime() >= Date.parse(CIERRE);
  const totalDe = (f: Fila) => Number(f.monto ?? 1999);

  const linkVigente = (f: Fila, concepto: Concepto) =>
    f.clip_link_concepto === concepto &&
    !!f.clip_payment_url &&
    !!f.clip_link_expires_at &&
    new Date(f.clip_link_expires_at).getTime() - deps.now().getTime() > MARGEN_MS;

  async function crearLinkClip(f: Fila, concepto: Concepto): Promise<string> {
    const key = env.get('CLIP_API_KEY');
    const secret = env.get('CLIP_SECRET_KEY');
    const site = (env.get('SITE_URL') ?? '').replace(/\/+$/, '');
    const supabaseUrl = (env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    const token = env.get('CLIP_WEBHOOK_TOKEN');
    if (!key || !secret || !site || !supabaseUrl || !token) throw new Error('Faltan secretos de Clip o SITE_URL');

    const total = totalDe(f);
    const monto = montoDe(total, concepto);
    if (!Number.isFinite(monto) || monto < 1) throw new Error(`Monto inválido para ${f.id}: ${f.monto} (${concepto})`);

    const res = await deps.fetch(env.get('CLIP_API_URL') ?? CLIP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${key}:${secret}`) },
      body: JSON.stringify({
        amount: redondear(monto),
        currency: 'MXN',
        purchase_description: `${DESCRIPCION}${total < 1999 ? ' · Precio estudiante' : ''}${ETIQUETA[concepto]}`,
        redirection_url: {
          success: `${site}/?pago=exito&ref=${f.id}&c=${concepto}`,
          error: `${site}/?pago=error&ref=${f.id}&c=${concepto}`,
          default: `${site}/`,
        },
        metadata: {
          external_reference: f.id,
          customer_info: { name: `${f.nombre} ${f.apellidos}`.trim(), email: f.email },
        },
        webhook_url: `${supabaseUrl}/functions/v1/clip-webhook?token=${encodeURIComponent(token)}`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.payment_request_url || !data.payment_request_id) {
      throw new Error(`Clip respondió ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }

    // Clip's default expiry is 72 h; its docs spell the field two ways.
    const expiraClip = Date.parse(data.expired_at ?? data.expirea_at ?? data.expires_at ?? '');
    const expira = Number.isFinite(expiraClip)
      ? new Date(expiraClip)
      : new Date(deps.now().getTime() + 72 * 3600 * 1000);

    const { error } = await db
      .from('inscripciones')
      .update({
        clip_payment_request_id: data.payment_request_id,
        clip_payment_url: data.payment_request_url,
        clip_link_expires_at: expira.toISOString(),
        clip_link_concepto: concepto,
        clip_ultimo_estado: data.status ?? 'CHECKOUT_CREATED',
        clip_actualizado_at: deps.now().toISOString(),
      })
      .eq('id', f.id);
    if (error) throw new Error('No se pudo guardar el link: ' + error.message);

    const { error: errLink } = await db.from('clip_links').insert({
      payment_request_id: data.payment_request_id,
      inscripcion_id: f.id,
      payment_url: data.payment_request_url,
      expires_at: expira.toISOString(),
      concepto,
      monto,
    });
    if (errLink) console.error('clip_links insert failed', f.id, errLink.message);
    return data.payment_request_url as string;
  }

  /** Payments already recorded for a registration. */
  async function conceptosPagados(id: string): Promise<Set<string>> {
    const { data, error } = await db.from('pagos').select('concepto').eq('inscripcion_id', id);
    if (error) throw error;
    return new Set(((data ?? []) as { concepto: string }[]).map((p) => p.concepto));
  }

  /** Next payment due: a concept, 'elegir' (first payment, no plan chosen yet) or null (nothing left). */
  async function siguiente(f: Fila, plan: Plan | null): Promise<Concepto | 'elegir' | null> {
    if (f.pago_estado === 'pagado') return null;
    const pagados = await conceptosPagados(f.id);
    if (pagados.has('completo')) return null;
    if (pagados.has('apartado')) return !pagados.has('pago2') ? 'pago2' : !pagados.has('pago3') ? 'pago3' : null;
    if (pagados.size) return null; // only manual corrections can get here; the team handles them
    if (plan === 'completo') return 'completo';
    if (plan === 'parcialidades') return 'apartado';
    return 'elegir';
  }

  /** Returns the response body for a registration that needs a payment link. */
  async function respuestaConLink(f: Fila, plan: Plan | null) {
    if (f.pago_estado === 'pagado') return { ok: true, id: f.id, ya_pagado: true };
    if (enRevision(f)) return { ok: true, id: f.id, estudiante: true, en_revision: true, payment_url: null };
    const total = totalDe(f);
    const base = { ok: true, id: f.id, total, opciones: opcionesDe(total), monto_pagado: Number(f.monto_pagado ?? 0) };
    const concepto = await siguiente(f, plan);
    if (concepto === null) return { ...base, ya_pagado: true };
    if ((concepto === 'elegir' || concepto === 'completo' || concepto === 'apartado') && cerrado()) {
      return { ...base, cerrado: true, payment_url: null };
    }
    if (concepto === 'elegir') return { ...base, requiere_plan: true, payment_url: null };
    const monto = montoDe(total, concepto);
    if (linkVigente(f, concepto)) return { ...base, concepto, monto, payment_url: f.clip_payment_url };
    try {
      return { ...base, concepto, monto, payment_url: await crearLinkClip(f, concepto) };
    } catch (e) {
      console.error('Clip link error', f.id, concepto, e instanceof Error ? e.message : e);
      return { ...base, concepto, monto, payment_url: null, error_pago: true };
    }
  }

  async function registrar(b: Record<string, unknown>) {
    if (texto(b.empresa, 200)) return json({ ok: true, id: null, payment_url: null }); // honeypot

    const datos = {
      nombre: texto(b.nombre, 120),
      apellidos: texto(b.apellidos, 120),
      email: texto(b.email, 254).toLowerCase(),
      motivo: texto(b.motivo, 2000),
      acepta_privacidad: b.aceptaPrivacidad === true,
      acepta_comunicaciones: b.aceptaComunicaciones === true,
      aviso_version: texto(b.avisoVersion, 20),
    };
    const campos: string[] = [];
    if (!datos.nombre) campos.push('nombre');
    if (!datos.apellidos) campos.push('apellidos');
    if (!EMAIL_RE.test(datos.email)) campos.push('email');
    if (datos.motivo.length < 10) campos.push('motivo');
    if (!datos.acepta_privacidad) campos.push('aceptaPrivacidad');
    if (!datos.aviso_version) campos.push('avisoVersion');
    if (campos.length) return json({ ok: false, error: 'validacion', campos }, 400);

    const esEstudiante = b.esEstudiante === true;

    // One registration per email: reuse the latest one and refresh its details.
    const { data: previas, error: errSel } = await db
      .from('inscripciones')
      .select(COLUMNAS)
      .eq('email', datos.email)
      .order('created_at', { ascending: false })
      .limit(1);
    if (errSel) throw errSel;
    const previa = (previas?.[0] ?? null) as Fila | null;
    if (previa?.pago_estado === 'pagado') return json({ ok: true, id: previa.id, ya_pagado: true });
    // Already paid the apartado: nothing on the row changes; the next links arrive by email.
    if (previa && Number(previa.monto_pagado ?? 0) > 0) return json({ ok: true, id: previa.id, ya_apartado: true });
    if (cerrado()) return json({ ok: true, id: null, cerrado: true });

    // What changes on the row depending on the "¿Eres estudiante?" answer.
    let extra: Record<string, unknown>;
    if (!esEstudiante) {
      extra = { es_estudiante: false, estudiante_estado: null, monto: 1999 };
    } else if (previa?.es_estudiante && previa.estudiante_estado === 'validado') {
      extra = {}; // already approved: keep the discount and go straight to payment
    } else if (previa && enRevision(previa)) {
      extra = {}; // request in progress: allow a new upload, keep its dates
    } else {
      // New request (also after a rejection). The old full-price link is dropped.
      extra = {
        es_estudiante: true,
        estudiante_estado: 'pendiente_documento',
        estudiante_solicitud_at: deps.now().toISOString(),
        estudiante_listo_at: null,
        estudiante_correo_alumno_at: null,
        estudiante_recordatorio_at: null,
        estudiante_plazo_aviso_at: null,
        estudiante_decidido_at: null,
        estudiante_motivo_rechazo: null,
        estudiante_documento_path: null,
        estudiante_error: null,
        monto: 1999,
        clip_payment_url: null,
        clip_link_expires_at: null,
        clip_link_concepto: null,
      };
    }

    let fila: Fila;
    if (previa) {
      const { data, error } = await db
        .from('inscripciones')
        .update({ ...datos, ...extra })
        .eq('id', previa.id)
        .select(COLUMNAS)
        .single();
      if (error) throw error;
      fila = data as Fila;
    } else {
      const { data, error } = await db
        .from('inscripciones')
        .insert({ ...datos, ...extra })
        .select(COLUMNAS)
        .single();
      if (error) throw error;
      fila = data as Fila;
    }

    if (enRevision(fila)) return json(await respuestaEstudiante(fila));
    return json(await respuestaConLink(fila, null));
  }

  /** Student request: signed URL so the browser can upload the ID straight to the private bucket. */
  async function respuestaEstudiante(f: Fila) {
    const path = `${f.id}/${crypto.randomUUID()}`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error('Signed upload URL failed', f.id, error?.message);
      return { ok: true, id: f.id, estudiante: true, subida: null };
    }
    return { ok: true, id: f.id, estudiante: true, subida: { path: data.path, token: data.token } };
  }

  /** After the optional upload: mark the request ready (the database then calls `estudiantes`). */
  async function estudianteListo(b: Record<string, unknown>) {
    const id = texto(b.id, 36);
    if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
    const { data, error } = await db
      .from('inscripciones')
      .update({ estudiante_listo_at: deps.now().toISOString() })
      .eq('id', id)
      .eq('es_estudiante', true)
      .in('estudiante_estado', [...PENDIENTES])
      .select('id');
    if (error) throw error;
    if (!data?.length) return json({ ok: false, error: 'no_encontrada' }, 404);
    return json({ ok: true, id });
  }

  async function obtenerLink(b: Record<string, unknown>) {
    const id = texto(b.id, 36);
    if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
    const { data, error } = await db.from('inscripciones').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return json({ ok: false, error: 'no_encontrada' }, 404);
    const plan = b.plan === 'completo' || b.plan === 'parcialidades' ? b.plan : null;
    return json(await respuestaConLink(data as Fila, plan));
  }

  /**
   * Asks Clip about every link of the registration that has no recorded payment yet, and records the completed
   * ones (database function registrar_pago_clip; the database then recalculates the row and sends the emails).
   */
  async function verificarConClip(id: string): Promise<void> {
    const key = env.get('CLIP_API_KEY');
    const secret = env.get('CLIP_SECRET_KEY');
    if (!key || !secret) return;
    const { data: fila } = await db
      .from('inscripciones')
      .select('monto,clip_payment_request_id,clip_link_concepto')
      .eq('id', id)
      .maybeSingle();
    if (!fila) return;
    const { data: links } = await db.from('clip_links').select('payment_request_id,concepto,monto').eq('inscripcion_id', id);
    const { data: pagos } = await db.from('pagos').select('clip_payment_request_id').eq('inscripcion_id', id);
    const registrados = new Set(((pagos ?? []) as { clip_payment_request_id: string | null }[]).map((p) => p.clip_payment_request_id));

    type Link = { payment_request_id: string; concepto: string | null; monto: number | string | null };
    const lista = (links ?? []) as Link[];
    const actual = fila.clip_payment_request_id as string | null;
    if (actual && !lista.some((l) => l.payment_request_id === actual)) {
      lista.push({ payment_request_id: actual, concepto: fila.clip_link_concepto ?? 'completo', monto: null });
    }

    for (const l of lista) {
      if (registrados.has(l.payment_request_id)) continue;
      try {
        const res = await deps.fetch(`${env.get('CLIP_API_URL') ?? CLIP_API}/${encodeURIComponent(l.payment_request_id)}`, {
          headers: { Authorization: 'Basic ' + btoa(`${key}:${secret}`) },
        });
        if (!res.ok) continue;
        const clip = (await res.json()) as Record<string, unknown>;
        const st = estadoDe(clip);
        if (!COMPLETADO.has(st)) {
          // Leave a visible trace of what Clip answered (or which fields it sent, if no status).
          const traza = (st || `SIN_ESTADO(${Object.keys(clip).join(',')})`).slice(0, 200);
          if (l.payment_request_id === actual) {
            await db
              .from('inscripciones')
              .update({ clip_ultimo_estado: traza, clip_actualizado_at: deps.now().toISOString() })
              .eq('id', id);
          }
          continue;
        }
        const concepto = (CONCEPTOS.has(l.concepto ?? '') ? l.concepto : 'completo') as Concepto;
        const monto = l.monto != null ? Number(l.monto) : montoDe(Number(fila.monto ?? 1999), concepto);
        const ahora = deps.now().toISOString();
        const { error } = await db.rpc('registrar_pago_clip', {
          p_inscripcion: id,
          p_concepto: concepto,
          p_monto: monto,
          p_payment_request_id: l.payment_request_id,
          p_pagado_at: fechaValida(clip.payment_date, clip.completed_at, clip.modified_at) ?? ahora,
          p_transaction_id: textoClip(clip.transaction_id),
          p_receipt_no: textoClip(clip.receipt_no),
          p_payment_type: textoClip(clip.payment_type),
        });
        if (error) throw error;
        await db
          .from('inscripciones')
          .update({
            clip_ultimo_estado: st,
            clip_transaction_id: textoClip(clip.transaction_id),
            clip_receipt_no: textoClip(clip.receipt_no),
            clip_payment_type: textoClip(clip.payment_type),
            clip_actualizado_at: ahora,
          })
          .eq('id', id);
      } catch (e) {
        console.error('Clip status check failed', l.payment_request_id, e instanceof Error ? e.message : e);
      }
    }
  }

  async function estado(b: Record<string, unknown>) {
    const id = texto(b.id, 36);
    if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
    const concepto = CONCEPTOS.has(texto(b.concepto, 20)) ? (texto(b.concepto, 20) as Concepto) : null;
    const consultar = async () => {
      const { data, error } = await db.from('inscripciones').select('pago_estado').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const pagados = await conceptosPagados(id);
      return {
        pago_estado: data.pago_estado as string,
        // With `concepto`: was that payment recorded. Without it (links created before installments): full payment.
        pagado: data.pago_estado === 'pagado' || (concepto !== null && pagados.has(concepto)),
      };
    };
    let r = await consultar();
    if (!r) return json({ ok: false, error: 'no_encontrada' }, 404);
    if (!r.pagado && r.pago_estado !== 'cancelado') {
      await verificarConClip(id);
      r = (await consultar()) ?? r;
    }
    return json({ ok: true, pagado: r.pagado, pago_estado: r.pago_estado });
  }

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
      if (body.accion === 'link') return await obtenerLink(body);
      if (body.accion === 'estado') return await estado(body);
      if (body.accion === 'estudiante_listo') return await estudianteListo(body);
      return await registrar(body);
    } catch (e) {
      console.error('inscripcion error', e instanceof Error ? e.message : e);
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

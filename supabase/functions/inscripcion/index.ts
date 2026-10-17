/**
 * Edge Function: inscripcion
 *
 * Called by the landing page form (supabase.functions.invoke('inscripcion')).
 *   { accion: 'registrar', nombre, apellidos, email, motivo, aceptaPrivacidad, aceptaComunicaciones, avisoVersion }
 *     -> saves (or refreshes) the registration and returns its Clip payment link.
 *   { accion: 'link', id }
 *     -> returns a valid Clip payment link for an existing registration (creates a new one if expired).
 *   { accion: 'estado', id }
 *     -> returns only whether that registration is paid (used after Clip redirects back).
 *        If it is still pending, it asks Clip directly about every link created for it, so a
 *        payment is confirmed even if Clip's webhook is late or missing.
 *
 * Secrets (Supabase > Edge Functions > Secrets):
 *   CLIP_API_KEY, CLIP_SECRET_KEY   Clip credential ("Tienda online")
 *   CLIP_WEBHOOK_TOKEN              random string, must match the clip-webhook function
 *   SITE_URL                        https://teatranding.bolt.host
 *   CLIP_MONTO                      optional, defaults to 1999 (use a small amount only for a test payment)
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
};

const COLUMNAS = 'id,nombre,apellidos,email,pago_estado,clip_payment_url,clip_link_expires_at';
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

  const linkVigente = (f: Fila) =>
    !!f.clip_payment_url &&
    !!f.clip_link_expires_at &&
    new Date(f.clip_link_expires_at).getTime() - deps.now().getTime() > MARGEN_MS;

  async function crearLinkClip(f: Fila): Promise<string> {
    const key = env.get('CLIP_API_KEY');
    const secret = env.get('CLIP_SECRET_KEY');
    const site = (env.get('SITE_URL') ?? '').replace(/\/+$/, '');
    const supabaseUrl = (env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    const token = env.get('CLIP_WEBHOOK_TOKEN');
    if (!key || !secret || !site || !supabaseUrl || !token) throw new Error('Faltan secretos de Clip o SITE_URL');

    const monto = Number(env.get('CLIP_MONTO') ?? '1999');
    if (!Number.isFinite(monto) || monto < 1) throw new Error('CLIP_MONTO inválido');

    const res = await deps.fetch(env.get('CLIP_API_URL') ?? CLIP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + btoa(`${key}:${secret}`) },
      body: JSON.stringify({
        amount: Math.round(monto * 100) / 100,
        currency: 'MXN',
        purchase_description: DESCRIPCION,
        redirection_url: {
          success: `${site}/?pago=exito&ref=${f.id}`,
          error: `${site}/?pago=error&ref=${f.id}`,
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
    });
    if (errLink) console.error('clip_links insert failed', f.id, errLink.message);
    return data.payment_request_url as string;
  }

  /** Returns the response body for a registration that needs a payment link. */
  async function respuestaConLink(f: Fila) {
    if (f.pago_estado === 'pagado') return { ok: true, id: f.id, ya_pagado: true };
    if (linkVigente(f)) return { ok: true, id: f.id, payment_url: f.clip_payment_url };
    try {
      return { ok: true, id: f.id, payment_url: await crearLinkClip(f) };
    } catch (e) {
      console.error('Clip link error', f.id, e instanceof Error ? e.message : e);
      return { ok: true, id: f.id, payment_url: null, error_pago: true };
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

    // One registration per email: reuse the latest one and refresh its details.
    const { data: previas, error: errSel } = await db
      .from('inscripciones')
      .select(COLUMNAS)
      .eq('email', datos.email)
      .order('created_at', { ascending: false })
      .limit(1);
    if (errSel) throw errSel;
    const previa = (previas?.[0] ?? null) as Fila | null;

    let fila: Fila;
    if (previa) {
      if (previa.pago_estado === 'pagado') return json({ ok: true, id: previa.id, ya_pagado: true });
      const { error } = await db.from('inscripciones').update(datos).eq('id', previa.id);
      if (error) throw error;
      fila = { ...previa, nombre: datos.nombre, apellidos: datos.apellidos };
    } else {
      const { data, error } = await db.from('inscripciones').insert(datos).select(COLUMNAS).single();
      if (error) throw error;
      fila = data as Fila;
    }
    return json(await respuestaConLink(fila));
  }

  async function obtenerLink(b: Record<string, unknown>) {
    const id = texto(b.id, 36);
    if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
    const { data, error } = await db.from('inscripciones').select(COLUMNAS).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return json({ ok: false, error: 'no_encontrada' }, 404);
    return json(await respuestaConLink(data as Fila));
  }

  /** Asks Clip about every link of a pending registration; marks it paid if one is completed. */
  async function verificarConClip(id: string, actual: string | null): Promise<boolean> {
    const key = env.get('CLIP_API_KEY');
    const secret = env.get('CLIP_SECRET_KEY');
    if (!key || !secret) return false;
    const { data: links } = await db.from('clip_links').select('payment_request_id').eq('inscripcion_id', id);
    const ids = new Set<string>(((links ?? []) as { payment_request_id: string }[]).map((l) => l.payment_request_id));
    if (actual) ids.add(actual);
    for (const prid of ids) {
      const l = { payment_request_id: prid };
      try {
        const res = await deps.fetch(`${env.get('CLIP_API_URL') ?? CLIP_API}/${encodeURIComponent(l.payment_request_id)}`, {
          headers: { Authorization: 'Basic ' + btoa(`${key}:${secret}`) },
        });
        if (!res.ok) continue;
        const clip = (await res.json()) as Record<string, unknown>;
        const st = estadoDe(clip);
        if (!COMPLETADO.has(st)) continue;
        const ahora = deps.now().toISOString();
        const { error } = await db
          .from('inscripciones')
          .update({
            pago_estado: 'pagado',
            pagado_at: fechaValida(clip.payment_date, clip.completed_at, clip.modified_at) ?? ahora,
            clip_payment_request_id: l.payment_request_id,
            clip_ultimo_estado: st,
            clip_transaction_id: textoClip(clip.transaction_id),
            clip_receipt_no: textoClip(clip.receipt_no),
            clip_payment_type: textoClip(clip.payment_type),
            clip_actualizado_at: ahora,
          })
          .eq('id', id)
          .eq('pago_estado', 'pendiente');
        if (error) throw error;
        return true;
      } catch (e) {
        console.error('Clip status check failed', l.payment_request_id, e instanceof Error ? e.message : e);
      }
    }
    return false;
  }

  async function estado(b: Record<string, unknown>) {
    const id = texto(b.id, 36);
    if (!UUID_RE.test(id)) return json({ ok: false, error: 'id' }, 400);
    const { data, error } = await db
      .from('inscripciones')
      .select('pago_estado,clip_payment_request_id')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ ok: false, error: 'no_encontrada' }, 404);
    if (data.pago_estado === 'pagado') return json({ ok: true, pagado: true });
    const pagado = data.pago_estado === 'pendiente' ? await verificarConClip(id, data.clip_payment_request_id) : false;
    return json({ ok: true, pagado });
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

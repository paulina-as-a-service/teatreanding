/**
 * Edge Function: clip-webhook
 *
 * Receives Clip Checkout notifications (the `webhook_url` set on each payment link).
 * Clip does not document a signature for these notifications, so this function:
 *   1. checks the secret ?token= in the URL,
 *   2. logs the raw notification in `clip_eventos`,
 *   3. asks Clip's API for the link's real status (GET /v2/checkout/{id}),
 *   4. marks the registration as paid only if Clip itself reports it completed.
 * Marking it paid updates the Google Sheet automatically (database trigger).
 *
 * Secrets: CLIP_API_KEY, CLIP_SECRET_KEY, CLIP_WEBHOOK_TOKEN.
 * Provided automatically: SUPABASE_URL and the service key (legacy or new format).
 *
 * Deploy with JWT verification OFF (Clip cannot send a Supabase token).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Env = { get(key: string): string | undefined };
export type Deps = { db: SupabaseClient; env: Env; fetch: typeof fetch; now: () => Date };

const CLIP_API = 'https://api.payclip.com/v2/checkout';
const COMPLETADO = new Set(['CHECKOUT_COMPLETED', 'COMPLETED']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const iguales = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

const fechaValida = (...vals: unknown[]) => {
  for (const v of vals) {
    if (typeof v === 'string' && Number.isFinite(Date.parse(v))) return new Date(v).toISOString();
  }
  return null;
};

export function crearHandler(deps: Deps) {
  const { db, env } = deps;

  return async (req: Request): Promise<Response> => {
    const esperado = env.get('CLIP_WEBHOOK_TOKEN') ?? '';
    const recibido = new URL(req.url).searchParams.get('token') ?? '';
    if (!esperado || !iguales(recibido, esperado)) return json({ ok: false }, 401);

    let n: Record<string, unknown>;
    try {
      n = await req.json();
    } catch {
      return json({ ok: false, error: 'json' }, 400);
    }

    const prid = typeof n.payment_request_id === 'string' ? n.payment_request_id : null;
    const { data: evento } = await db
      .from('clip_eventos')
      .insert({
        payment_request_id: prid,
        estado_notificado: typeof n.resource_status === 'string' ? n.resource_status : null,
        payload: n,
      })
      .select('id')
      .single();

    // Refund notifications and anything without a link ID are only logged.
    if (!prid || (typeof n.resource === 'string' && n.resource.toUpperCase() !== 'CHECKOUT')) {
      return json({ ok: true, ignorado: true });
    }

    // Source of truth: Clip's own record of the payment link.
    const key = env.get('CLIP_API_KEY');
    const secret = env.get('CLIP_SECRET_KEY');
    if (!key || !secret) return json({ ok: false, error: 'config' }, 500);
    let clip: Record<string, unknown>;
    try {
      const res = await deps.fetch(`${env.get('CLIP_API_URL') ?? CLIP_API}/${encodeURIComponent(prid)}`, {
        headers: { Authorization: 'Basic ' + btoa(`${key}:${secret}`) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      clip = await res.json();
    } catch (e) {
      console.error('Clip status check failed', prid, e instanceof Error ? e.message : e);
      return json({ ok: false, error: 'verificacion' }, 502); // non-2xx so Clip retries
    }
    const estado = String(clip.status ?? clip.resource_status ?? '').toUpperCase();

    // Find the registration: by any link ever created for it, then by our own reference.
    const { data: link } = await db
      .from('clip_links')
      .select('inscripcion_id')
      .eq('payment_request_id', prid)
      .maybeSingle();
    const ref =
      link?.inscripcion_id ??
      (typeof n.me_reference_id === 'string' && UUID_RE.test(n.me_reference_id) ? n.me_reference_id : null);
    let fila: { id: string; pago_estado: string; pagado_at: string | null } | null = null;
    if (ref) {
      ({ data: fila } = await db.from('inscripciones').select('id,pago_estado,pagado_at').eq('id', ref).maybeSingle());
    }
    if (!fila) {
      ({ data: fila } = await db
        .from('inscripciones')
        .select('id,pago_estado,pagado_at')
        .eq('clip_payment_request_id', prid)
        .maybeSingle());
    }

    if (evento?.id) {
      await db
        .from('clip_eventos')
        .update({ estado_verificado: estado || null, inscripcion_id: fila?.id ?? null })
        .eq('id', evento.id);
    }
    if (!fila) {
      console.warn('Clip notification for unknown link', prid, estado);
      return json({ ok: true, sin_inscripcion: true });
    }

    const cambios: Record<string, unknown> = {
      clip_ultimo_estado: estado || null,
      clip_actualizado_at: deps.now().toISOString(),
    };
    if (COMPLETADO.has(estado) && fila.pago_estado !== 'pagado') {
      Object.assign(cambios, {
        pago_estado: 'pagado',
        pagado_at: fila.pagado_at ?? fechaValida(n.payment_date, n.completed_at) ?? deps.now().toISOString(),
        clip_payment_request_id: prid,
        clip_transaction_id: typeof n.transaction_id === 'string' ? n.transaction_id : null,
        clip_receipt_no: typeof n.receipt_no === 'string' ? n.receipt_no : null,
        clip_payment_type: typeof n.payment_type === 'string' ? n.payment_type : null,
      });
    }
    const { error } = await db.from('inscripciones').update(cambios).eq('id', fila.id);
    if (error) {
      console.error('Update failed', fila.id, error.message);
      return json({ ok: false, error: 'db' }, 500);
    }
    return json({ ok: true, estado, pagado: cambios.pago_estado === 'pagado' || fila.pago_estado === 'pagado' });
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

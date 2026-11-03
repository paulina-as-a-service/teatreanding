import { supabase } from './supabase';
import type { Opciones } from './precios';

export type Plan = 'completo' | 'parcialidades';
export type Concepto = 'completo' | 'apartado' | 'pago2' | 'pago3';

export type RespuestaInscripcion = {
  ok: boolean;
  id?: string | null;
  payment_url?: string | null;
  ya_pagado?: boolean;
  error_pago?: boolean;
  error?: string;
  campos?: string[];
  pagado?: boolean;
  /** Amount of the payment this link charges. */
  monto?: number;
  /** Course price for this registration (1499 once a student discount is approved). */
  total?: number;
  /** Amounts of both options (full payment, or $500 + pago 2 + pago 3). */
  opciones?: Opciones;
  /** Which payment the link charges. */
  concepto?: Concepto;
  /** First payment: the page must ask "pagar completo" or "apartar con $500" before asking for a link. */
  requiere_plan?: boolean;
  /** Sign-ups closed (course started) and this registration has no payment yet. */
  cerrado?: boolean;
  /** Already paid the $500 apartado: the next links arrive by email. */
  ya_apartado?: boolean;
  pago_estado?: string;
  /** Student-discount request: no payment link until Mauricio approves it. */
  estudiante?: boolean;
  en_revision?: boolean;
  /** Signed upload for the student ID (private bucket). */
  subida?: { path: string; token: string } | null;
};

export type DatosInscripcion = {
  nombre: string;
  apellidos: string;
  email: string;
  motivo: string;
  aceptaPrivacidad: boolean;
  aceptaComunicaciones: boolean;
  avisoVersion: string;
  esEstudiante: boolean;
};

async function invocar(body: Record<string, unknown>): Promise<RespuestaInscripcion> {
  if (!supabase) throw new Error('sin-config');
  const { data, error } = await supabase.functions.invoke<RespuestaInscripcion>('inscripcion', { body });
  if (error) {
    // Non-2xx responses carry a JSON body (e.g. validation errors).
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const parsed = (await ctx.json().catch(() => null)) as RespuestaInscripcion | null;
      if (parsed) return parsed;
    }
    throw error;
  }
  return data ?? { ok: false };
}

/** Saves the registration and returns its personal Clip payment link. */
export const registrarInscripcion = (d: DatosInscripcion) => invocar({ accion: 'registrar', ...d });

/**
 * Returns a valid link for the next payment of a registration (renews it if expired).
 * First payment: pass the plan; without it the answer is `requiere_plan`.
 */
export const obtenerLinkPago = (id: string, plan?: Plan) => invocar({ accion: 'link', id, plan });

/** Whether a payment (or, without `concepto`, the whole course) is recorded. */
export const consultarPago = (id: string, concepto?: Concepto | null) =>
  invocar({ accion: 'estado', id, concepto: concepto ?? undefined });

export const planDeConcepto = (c: Concepto | null): Plan | undefined =>
  c === 'completo' ? 'completo' : c === 'apartado' ? 'parcialidades' : undefined;

/** Marks a student-discount request as ready, after the optional upload. Triggers the emails. */
export const marcarEstudianteListo = (id: string) => invocar({ accion: 'estudiante_listo', id });

export const BUCKET_CREDENCIALES = 'documentos-estudiantes';
export const TIPOS_CREDENCIAL = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
export const MAX_CREDENCIAL_BYTES = 5 * 1024 * 1024;

/** Uploads the student ID with the signed URL returned by `registrarInscripcion`. */
export async function subirCredencial(subida: { path: string; token: string }, archivo: File): Promise<void> {
  if (!supabase) throw new Error('sin-config');
  const { error } = await supabase.storage
    .from(BUCKET_CREDENCIALES)
    .uploadToSignedUrl(subida.path, subida.token, archivo, { contentType: archivo.type || undefined });
  if (error) throw error;
}

/* ---------------- Review page for Mauricio (function `estudiantes`) ---------------- */

export type Revision = {
  ok: boolean;
  error?: string;
  nombre?: string;
  apellidos?: string;
  email?: string;
  estado?: 'pendiente_documento' | 'en_revision' | 'validado' | 'rechazado' | null;
  pagado?: boolean;
  solicitud_at?: string | null;
  decidido_at?: string | null;
  motivo?: string | null;
  documento?: { url: string; tipo: string } | null;
  motivos?: { codigo: string; etiqueta: string }[];
  ya_decidido?: boolean;
  correo_enviado?: boolean;
};

async function invocarEstudiantes(body: Record<string, unknown>): Promise<Revision> {
  if (!supabase) throw new Error('sin-config');
  const { data, error } = await supabase.functions.invoke<Revision>('estudiantes', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      const parsed = (await ctx.json().catch(() => null)) as Revision | null;
      if (parsed) return parsed;
    }
    throw error;
  }
  return data ?? { ok: false };
}

export const verRevision = (clave: string) => invocarEstudiantes({ accion: 'revision_ver', clave });

export const decidirRevision = (clave: string, decision: 'aprobar' | 'rechazar', motivo?: string) =>
  invocarEstudiantes({ accion: 'revision_decidir', clave, decision, motivo });

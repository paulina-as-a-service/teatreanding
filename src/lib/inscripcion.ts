import { supabase } from './supabase';

export type RespuestaInscripcion = {
  ok: boolean;
  id?: string | null;
  payment_url?: string | null;
  ya_pagado?: boolean;
  error_pago?: boolean;
  error?: string;
  campos?: string[];
  pagado?: boolean;
};

export type DatosInscripcion = {
  nombre: string;
  apellidos: string;
  email: string;
  motivo: string;
  aceptaPrivacidad: boolean;
  aceptaComunicaciones: boolean;
  avisoVersion: string;
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

/** Returns a valid payment link for an existing registration (renews it if expired). */
export const obtenerLinkPago = (id: string) => invocar({ accion: 'link', id });

/** Whether a registration is already marked as paid. */
export const consultarPago = (id: string) => invocar({ accion: 'estado', id });

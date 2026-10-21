/*
  # Correo de confirmación después del pago (Resend)

  1. New columns on `inscripciones`
    - `confirmacion_estado` (text): null | 'enviando' | 'enviada' | 'error' | 'reintentar'
    - `confirmacion_enviada_at` (timestamptz): when Resend accepted the email
    - `confirmacion_resend_id` (text): Resend's email ID (to look it up in the Resend dashboard)
    - `confirmacion_error` (text): last error, if any
    - `confirmacion_intentos` (int): how many times sending was attempted
    - `confirmacion_actualizado_at` (timestamptz): last change to any of the above

  2. Trigger
    - When a registration changes to pago_estado = 'pagado' (from the Clip webhook or from the
      backup check on the success page), the database calls the `confirmacion-email` Edge Function.
    - Setting confirmacion_estado = 'reintentar' by hand (Table Editor) calls it again. Use this to
      resend a failed or lost confirmation.
    - The function URL, including its secret ?token=, is read from Supabase Vault under the name
      'confirmacion_email_url'. It is never stored in this repo.
    - If the secret is missing or the request cannot be queued, the payment update still succeeds.

  Run this AFTER deploying the `confirmacion-email` Edge Function and saving the Vault secret.
*/

alter table public.inscripciones
  add column if not exists confirmacion_estado text,
  add column if not exists confirmacion_enviada_at timestamptz,
  add column if not exists confirmacion_resend_id text,
  add column if not exists confirmacion_error text,
  add column if not exists confirmacion_intentos integer not null default 0,
  add column if not exists confirmacion_actualizado_at timestamptz;

alter table public.inscripciones drop constraint if exists inscripciones_confirmacion_estado_check;
alter table public.inscripciones
  add constraint inscripciones_confirmacion_estado_check
  check (confirmacion_estado is null or confirmacion_estado in ('enviando', 'enviada', 'error', 'reintentar'));

create extension if not exists pg_net with schema extensions;

create or replace function public.enviar_confirmacion_inscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  funcion_url text;
begin
  -- Only on the change to 'pagado', or when someone asks for a resend.
  if not (
    (new.pago_estado = 'pagado' and old.pago_estado is distinct from 'pagado')
    or (new.confirmacion_estado = 'reintentar' and old.confirmacion_estado is distinct from 'reintentar')
  ) then
    return new;
  end if;

  begin
    select ds.decrypted_secret
      into funcion_url
      from vault.decrypted_secrets ds
     where ds.name = 'confirmacion_email_url'
     limit 1;

    if funcion_url is null or funcion_url = '' then
      raise warning 'confirmacion_email_url is not set; no confirmation email for %', new.id;
      return new;
    end if;

    perform net.http_post(
      url := funcion_url,
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 15000
    );
  exception when others then
    -- Never block the payment update because the email could not be queued.
    raise warning 'Confirmation email not queued for inscripcion %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.enviar_confirmacion_inscripcion() from public, anon, authenticated;

drop trigger if exists inscripciones_confirmacion_email on public.inscripciones;
create trigger inscripciones_confirmacion_email
  after update of pago_estado, confirmacion_estado
  on public.inscripciones
  for each row
  execute function public.enviar_confirmacion_inscripcion();

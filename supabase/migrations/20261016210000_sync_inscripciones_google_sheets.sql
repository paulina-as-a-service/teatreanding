/*
  # Sincronizar inscripciones con Google Sheets

  1. Payment status
    - `pago_estado` (text): 'pendiente' | 'pagado' | 'cancelado', default 'pendiente'
    - `pagado_at` (timestamptz): when the payment was confirmed
    These are updated by the team (Table Editor) or, later, by the payment integration.

  2. Security
    - The public insert policy now also requires pago_estado = 'pendiente' and pagado_at is null,
      so nobody can register themselves as already paid.

  3. Sync
    - After INSERT, or UPDATE of name/email/payment columns, a trigger POSTs the row
      (without the free-text "motivo") to a Google Apps Script web app attached to the Sheet.
    - The web app URL (including its secret token) is read from Supabase Vault under the name
      'sheets_webhook_url'. It is never stored in this repo.
    - If the secret is missing or the request cannot be queued, the sign-up still succeeds:
      the sync never blocks a registration.
*/

-- 1. Payment status columns
alter table public.inscripciones
  add column if not exists pago_estado text not null default 'pendiente',
  add column if not exists pagado_at timestamptz;

alter table public.inscripciones drop constraint if exists inscripciones_pago_estado_check;
alter table public.inscripciones
  add constraint inscripciones_pago_estado_check
  check (pago_estado in ('pendiente', 'pagado', 'cancelado'));

-- 2. Public sign-ups can only create pending, unpaid rows
drop policy if exists "Visitantes pueden registrarse" on public.inscripciones;
create policy "Visitantes pueden registrarse"
  on public.inscripciones
  for insert
  to anon, authenticated
  with check (acepta_privacidad = true and pago_estado = 'pendiente' and pagado_at is null);

-- 3. HTTP requests from the database (asynchronous; sent after the transaction commits)
create extension if not exists pg_net with schema extensions;

-- 4. Trigger function
create or replace function public.notificar_hoja_inscripciones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook_url text;
begin
  begin
    select ds.decrypted_secret
      into webhook_url
      from vault.decrypted_secrets ds
     where ds.name = 'sheets_webhook_url'
     limit 1;

    if webhook_url is null or webhook_url = '' then
      return new;
    end if;

    perform net.http_post(
      url := webhook_url,
      body := jsonb_build_object(
        'type', tg_op,
        'record', jsonb_build_object(
          'id', new.id,
          'created_at', new.created_at,
          'nombre', new.nombre,
          'apellidos', new.apellidos,
          'email', new.email,
          'pago_estado', new.pago_estado,
          'pagado_at', new.pagado_at
        )
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  exception when others then
    -- Never block a sign-up because the Sheet sync failed.
    raise warning 'Google Sheets sync skipped for inscripcion %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.notificar_hoja_inscripciones() from public, anon, authenticated;

drop trigger if exists inscripciones_a_hoja on public.inscripciones;
create trigger inscripciones_a_hoja
  after insert or update of nombre, apellidos, email, pago_estado, pagado_at
  on public.inscripciones
  for each row
  execute function public.notificar_hoja_inscripciones();

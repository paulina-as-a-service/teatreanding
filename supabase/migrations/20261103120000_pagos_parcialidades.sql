/*
  # Inscripción flexible: apartar con $500 y liquidar en 2 pagos (14 y 30 de noviembre)

  Quien se inscribe elige al pagar:
    - Pagar completo: un pago por el `monto` de la inscripción (1999, o 1499 con descuento de estudiante).
    - Apartar con $500: un apartado de 500 y dos pagos iguales por el resto
      (1999 -> 749.50 + 749.50; 1499 -> 499.50 + 499.50).
  El enlace de Zoom se envía al confirmarse el pago completo o, en parcialidades, el pago 2.

  1. New table `pagos`
    - One row per confirmed payment (Clip, or a manual payment entered by hand).
    - `concepto`: 'completo' | 'apartado' | 'pago2' | 'pago3'.
    - Inserting a row recalculates the registration (trigger) and asks the `parcialidades`
      function to send the matching email.
    - Manual payment (transfer, cash): insert a row here with clip_payment_request_id empty.
      Do not change pago_estado by hand anymore; it is calculated from this table.

  2. New columns on `inscripciones`
    - `plan_pago` (text): null | 'completo' | 'parcialidades' (set by the first payment)
    - `monto_pagado` (numeric): sum of `pagos`
    - `ultimo_pago_at` (timestamptz): date of the most recent payment
    - `acceso_zoom` (boolean): true once the Zoom email is due (full payment, or apartado + pago 2)
    - `clip_link_concepto` (text): which payment the current Clip link (`clip_payment_url`) charges
    - `apartado_correo_at`, `pago2_correo_at`, `pago3_correo_at`, `liquidado_correo_at` (timestamptz):
      when each installment email went out (each one is sent once)
    - `parcialidades_error` (text): last email error, if any
    `pago_estado` gains the value 'parcial' (some payment received, balance pending).

  3. `clip_links` gains `concepto` and `monto`, so the webhook knows what each link charged.

  4. The Zoom email (`confirmacion-email`) now fires when `acceso_zoom` turns true, instead of
     when pago_estado turns 'pagado'.

  5. Hourly task (pg_cron `parcialidades-correos`, minute 7) calls `parcialidades` to send the payment
     links on 14 and 30 November and to retry any email that failed.

  6. Google Sheet: the payload adds plan_pago, monto_pagado and ultimo_pago_at.

  Vault secret required: 'parcialidades_url' =
    https://<PROJECT-REF>.supabase.co/functions/v1/parcialidades?token=<PARCIALIDADES_TOKEN>

  Run this AFTER deploying the updated `inscripcion`, `clip-webhook` and `confirmacion-email`, deploying
  `parcialidades`, and saving the Vault secret.
*/

-- 1. Columns on inscripciones --------------------------------------------------------------------
alter table public.inscripciones
  add column if not exists plan_pago text,
  add column if not exists monto_pagado numeric(10, 2) not null default 0,
  add column if not exists ultimo_pago_at timestamptz,
  add column if not exists acceso_zoom boolean not null default false,
  add column if not exists clip_link_concepto text,
  add column if not exists apartado_correo_at timestamptz,
  add column if not exists pago2_correo_at timestamptz,
  add column if not exists pago3_correo_at timestamptz,
  add column if not exists liquidado_correo_at timestamptz,
  add column if not exists parcialidades_error text;

alter table public.inscripciones drop constraint if exists inscripciones_plan_pago_check;
alter table public.inscripciones
  add constraint inscripciones_plan_pago_check
  check (plan_pago is null or plan_pago in ('completo', 'parcialidades'));

alter table public.inscripciones drop constraint if exists inscripciones_clip_link_concepto_check;
alter table public.inscripciones
  add constraint inscripciones_clip_link_concepto_check
  check (clip_link_concepto is null or clip_link_concepto in ('completo', 'apartado', 'pago2', 'pago3'));

alter table public.inscripciones drop constraint if exists inscripciones_pago_estado_check;
alter table public.inscripciones
  add constraint inscripciones_pago_estado_check
  check (pago_estado in ('pendiente', 'parcial', 'pagado', 'cancelado'));

-- Links created before this change charged the full amount.
update public.inscripciones
   set clip_link_concepto = 'completo'
 where clip_payment_url is not null and clip_link_concepto is null;

-- 2. clip_links: what each link charges ---------------------------------------------------------
alter table public.clip_links
  add column if not exists concepto text,
  add column if not exists monto numeric(10, 2);

update public.clip_links l
   set concepto = 'completo', monto = i.monto
  from public.inscripciones i
 where i.id = l.inscripcion_id and l.concepto is null;

alter table public.clip_links drop constraint if exists clip_links_concepto_check;
alter table public.clip_links
  add constraint clip_links_concepto_check
  check (concepto is null or concepto in ('completo', 'apartado', 'pago2', 'pago3'));

-- 3. Payments ledger ----------------------------------------------------------------------------
create table if not exists public.pagos (
  id bigint generated always as identity primary key,
  inscripcion_id uuid not null references public.inscripciones (id) on delete cascade,
  concepto text not null check (concepto in ('completo', 'apartado', 'pago2', 'pago3')),
  monto numeric(10, 2) not null check (monto > 0),
  clip_payment_request_id text unique,
  clip_transaction_id text,
  clip_receipt_no text,
  clip_payment_type text,
  pagado_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.pagos enable row level security;

create index if not exists pagos_inscripcion_id_idx on public.pagos (inscripcion_id);

-- Existing full payments become ledger rows (before the triggers exist, so no emails go out).
insert into public.pagos (
  inscripcion_id, concepto, monto, clip_payment_request_id,
  clip_transaction_id, clip_receipt_no, clip_payment_type, pagado_at
)
select id, 'completo', monto, clip_payment_request_id,
       clip_transaction_id, clip_receipt_no, clip_payment_type, coalesce(pagado_at, now())
  from public.inscripciones
 where pago_estado = 'pagado'
   and not exists (select 1 from public.pagos p where p.inscripcion_id = inscripciones.id)
on conflict (clip_payment_request_id) do nothing;

update public.inscripciones
   set plan_pago = 'completo',
       monto_pagado = monto,
       ultimo_pago_at = pagado_at,
       acceso_zoom = true
 where pago_estado = 'pagado';

-- 4. Recalculate a registration from its payments ----------------------------------------------
create or replace function public.recalcular_pagos(p_inscripcion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric(10, 2);
  v_ultimo timestamptz;
  v_conceptos text[];
  v_monto numeric(10, 2);
  v_plan text;
  v_completo boolean;
begin
  select coalesce(sum(p.monto), 0), max(p.pagado_at), coalesce(array_agg(distinct p.concepto), '{}')
    into v_total, v_ultimo, v_conceptos
    from public.pagos p
   where p.inscripcion_id = p_inscripcion;

  select i.monto, i.plan_pago
    into v_monto, v_plan
    from public.inscripciones i
   where i.id = p_inscripcion
     for update;
  if not found then
    return;
  end if;

  if v_plan is null and cardinality(v_conceptos) > 0 then
    v_plan := case when 'completo' = any (v_conceptos) then 'completo' else 'parcialidades' end;
  end if;
  v_completo := v_total > 0 and v_total >= v_monto - 0.005;

  update public.inscripciones i
     set plan_pago = v_plan,
         monto_pagado = v_total,
         ultimo_pago_at = v_ultimo,
         pago_estado = case
           when v_completo then 'pagado'
           when v_total > 0 then 'parcial'
           when i.pago_estado in ('parcial', 'pagado') then 'pendiente' -- every payment row was removed
           else i.pago_estado
         end,
         -- pagado_at = when the balance reached zero (empty while something is still owed).
         pagado_at = case when v_completo then coalesce(i.pagado_at, v_ultimo) else null end,
         -- Once sent, access is never taken back automatically.
         acceso_zoom = i.acceso_zoom
           or v_completo
           or ('apartado' = any (v_conceptos) and 'pago2' = any (v_conceptos))
   where i.id = p_inscripcion;
end;
$$;

revoke execute on function public.recalcular_pagos(uuid) from public, anon, authenticated;

-- 5. Record a Clip payment (called by `clip-webhook` and `inscripcion`). True if it is new.
create or replace function public.registrar_pago_clip(
  p_inscripcion uuid,
  p_concepto text,
  p_monto numeric,
  p_payment_request_id text,
  p_pagado_at timestamptz,
  p_transaction_id text,
  p_receipt_no text,
  p_payment_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.pagos (
    inscripcion_id, concepto, monto, clip_payment_request_id,
    clip_transaction_id, clip_receipt_no, clip_payment_type, pagado_at
  )
  values (
    p_inscripcion, p_concepto, p_monto, p_payment_request_id,
    p_transaction_id, p_receipt_no, p_payment_type, coalesce(p_pagado_at, now())
  )
  on conflict (clip_payment_request_id) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke execute on function public.registrar_pago_clip(uuid, text, numeric, text, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.registrar_pago_clip(uuid, text, numeric, text, timestamptz, text, text, text)
  to service_role;

-- 6. Call the `parcialidades` function (URL with its token comes from Vault) --------------------
create extension if not exists pg_net with schema extensions;

create or replace function public.llamar_parcialidades(cuerpo jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  funcion_url text;
begin
  select ds.decrypted_secret
    into funcion_url
    from vault.decrypted_secrets ds
   where ds.name = 'parcialidades_url'
   limit 1;

  if funcion_url is null or funcion_url = '' then
    raise warning 'parcialidades_url is not set; skipped %', cuerpo;
    return;
  end if;

  perform net.http_post(
    url := funcion_url,
    body := cuerpo,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  raise warning 'parcialidades call not queued (%): %', cuerpo, sqlerrm;
end;
$$;

revoke execute on function public.llamar_parcialidades(jsonb) from public, anon, authenticated;

-- 7. Triggers on pagos ---------------------------------------------------------------------------
create or replace function public.al_registrar_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalcular_pagos(new.inscripcion_id);
  perform public.llamar_parcialidades(
    jsonb_build_object('accion', 'pago', 'id', new.inscripcion_id, 'concepto', new.concepto)
  );
  return new;
end;
$$;

revoke execute on function public.al_registrar_pago() from public, anon, authenticated;

drop trigger if exists pagos_registrado on public.pagos;
create trigger pagos_registrado
  after insert on public.pagos
  for each row
  execute function public.al_registrar_pago();

-- Corrections by hand (edit or delete a payment row) recalculate, without emails.
create or replace function public.al_corregir_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_pagos(old.inscripcion_id);
  else
    perform public.recalcular_pagos(new.inscripcion_id);
    if new.inscripcion_id is distinct from old.inscripcion_id then
      perform public.recalcular_pagos(old.inscripcion_id);
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function public.al_corregir_pago() from public, anon, authenticated;

drop trigger if exists pagos_corregido on public.pagos;
create trigger pagos_corregido
  after update or delete on public.pagos
  for each row
  execute function public.al_corregir_pago();

-- 8. Zoom email: on access, not on full payment --------------------------------------------------
create or replace function public.enviar_confirmacion_inscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  funcion_url text;
begin
  -- coalesce: with a NULL confirmacion_estado the whole test would be NULL and the call would go out anyway.
  if not (
    (new.acceso_zoom and not coalesce(old.acceso_zoom, false))
    or (coalesce(new.confirmacion_estado, '') = 'reintentar' and old.confirmacion_estado is distinct from 'reintentar')
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
    raise warning 'Confirmation email not queued for inscripcion %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.enviar_confirmacion_inscripcion() from public, anon, authenticated;

drop trigger if exists inscripciones_confirmacion_email on public.inscripciones;
create trigger inscripciones_confirmacion_email
  after update of acceso_zoom, confirmacion_estado
  on public.inscripciones
  for each row
  execute function public.enviar_confirmacion_inscripcion();

-- 9. Hourly task: payment links on 14 and 30 Nov, retries ---------------------------------------
create extension if not exists pg_cron;

create or replace function public.parcialidades_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.llamar_parcialidades(jsonb_build_object('accion', 'tick'));
end;
$$;

revoke execute on function public.parcialidades_tick() from public, anon, authenticated;

select cron.schedule('parcialidades-correos', '7 * * * *', $$select public.parcialidades_tick()$$);

-- 10. Google Sheet sync: plan and amount paid -------------------------------------------------------
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
          'pagado_at', new.pagado_at,
          'es_estudiante', new.es_estudiante,
          'estudiante_estado', new.estudiante_estado,
          'monto', new.monto,
          'plan_pago', new.plan_pago,
          'monto_pagado', new.monto_pagado,
          'ultimo_pago_at', new.ultimo_pago_at
        )
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'Google Sheets sync skipped for inscripcion %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.notificar_hoja_inscripciones() from public, anon, authenticated;

drop trigger if exists inscripciones_a_hoja on public.inscripciones;
create trigger inscripciones_a_hoja
  after insert or update of nombre, apellidos, email, pago_estado, pagado_at, es_estudiante, estudiante_estado,
    monto, plan_pago, monto_pagado, ultimo_pago_at
  on public.inscripciones
  for each row
  execute function public.notificar_hoja_inscripciones();

/*
  # Descuento para estudiantes (25%: $1,499 en lugar de $1,999)

  Flujo:
    1. En el formulario la persona responde "¿Eres estudiante activo?". Si dice que sí, puede subir
       su credencial vigente (opcional). No se crea link de pago todavía.
    2. La página llama a `inscripcion` con accion 'estudiante_listo', que marca `estudiante_listo_at`.
       Ese cambio dispara la Edge Function `estudiantes` (pg_net), que:
         - revisa si hay credencial en Storage,
         - envía al alumno el correo de solicitud recibida (o le pide responder con su credencial),
         - envía a teatranding@gmail.com la notificación con los botones Aprobar / Rechazar.
    3. Los botones abren una página de revisión en el sitio. La decisión la guarda `estudiantes`:
         - Aprobar: monto = 1499, la credencial se borra de Storage y el alumno recibe su link de pago.
         - Rechazar (con motivo de una lista): monto = 1999, se borra la credencial y el alumno recibe
           el motivo y el link de pago a precio normal.
    4. Una tarea programada (pg_cron, cada hora) llama a `estudiantes` para:
         - completar solicitudes que la página no alcanzó a cerrar (30 min),
         - enviar el recordatorio al alumno sin credencial (48 h),
         - avisar a Mauricio cuando vence el plazo de 72 h sin credencial subida.

  1. New columns on `inscripciones`
    - `monto` (numeric): amount Clip charges for this registration. Default 1999.
    - `es_estudiante` (boolean)
    - `estudiante_estado` (text): null | 'pendiente_documento' | 'en_revision' | 'validado' | 'rechazado'
    - `estudiante_solicitud_at`, `estudiante_listo_at`, `estudiante_correo_alumno_at`,
      `estudiante_recordatorio_at`, `estudiante_plazo_aviso_at`, `estudiante_decidido_at` (timestamptz)
    - `estudiante_documento_path` (text): file in the private bucket `documentos-estudiantes`
    - `estudiante_motivo_rechazo` (text): reason code chosen by Mauricio
    - `estudiante_error` (text): last email error, if any

  2. Storage
    - Private bucket `documentos-estudiantes` (5 MB, images and PDF). No policies: files are uploaded
      with a signed upload URL issued by `inscripcion` and read only through `estudiantes`.

  3. Google Sheet
    - The sync payload now also sends `es_estudiante`, `estudiante_estado` and `monto`.

  4. Vault secret required: 'estudiantes_url' =
     https://<PROJECT-REF>.supabase.co/functions/v1/estudiantes?token=<ESTUDIANTES_TOKEN>

  Run this AFTER deploying the `estudiantes` Edge Function and saving the Vault secret.
*/

-- 1. Columns
alter table public.inscripciones
  add column if not exists monto numeric(10, 2) not null default 1999,
  add column if not exists es_estudiante boolean not null default false,
  add column if not exists estudiante_estado text,
  add column if not exists estudiante_solicitud_at timestamptz,
  add column if not exists estudiante_listo_at timestamptz,
  add column if not exists estudiante_documento_path text,
  add column if not exists estudiante_correo_alumno_at timestamptz,
  add column if not exists estudiante_recordatorio_at timestamptz,
  add column if not exists estudiante_plazo_aviso_at timestamptz,
  add column if not exists estudiante_decidido_at timestamptz,
  add column if not exists estudiante_motivo_rechazo text,
  add column if not exists estudiante_error text;

alter table public.inscripciones drop constraint if exists inscripciones_monto_check;
alter table public.inscripciones add constraint inscripciones_monto_check check (monto > 0);

alter table public.inscripciones drop constraint if exists inscripciones_estudiante_estado_check;
alter table public.inscripciones
  add constraint inscripciones_estudiante_estado_check
  check (
    estudiante_estado is null
    or estudiante_estado in ('pendiente_documento', 'en_revision', 'validado', 'rechazado')
  );

create index if not exists inscripciones_estudiante_estado_idx
  on public.inscripciones (estudiante_estado)
  where estudiante_estado is not null;

-- 2. Private bucket for student IDs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-estudiantes',
  'documentos-estudiantes',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Helper: POST to the `estudiantes` function (URL with its token comes from Vault)
create extension if not exists pg_net with schema extensions;

create or replace function public.llamar_estudiantes(cuerpo jsonb)
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
   where ds.name = 'estudiantes_url'
   limit 1;

  if funcion_url is null or funcion_url = '' then
    raise warning 'estudiantes_url is not set; skipped %', cuerpo;
    return;
  end if;

  perform net.http_post(
    url := funcion_url,
    body := cuerpo,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 20000
  );
exception when others then
  raise warning 'estudiantes call not queued (%): %', cuerpo, sqlerrm;
end;
$$;

revoke execute on function public.llamar_estudiantes(jsonb) from public, anon, authenticated;

-- 4. Trigger: every time the page (or the hourly task) marks a request as ready
create or replace function public.notificar_solicitud_estudiante()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.es_estudiante
     and new.estudiante_estado in ('pendiente_documento', 'en_revision')
     and new.estudiante_listo_at is not null
     and new.estudiante_listo_at is distinct from old.estudiante_listo_at then
    perform public.llamar_estudiantes(jsonb_build_object('accion', 'notificar', 'id', new.id));
  end if;
  return new;
end;
$$;

revoke execute on function public.notificar_solicitud_estudiante() from public, anon, authenticated;

drop trigger if exists inscripciones_solicitud_estudiante on public.inscripciones;
create trigger inscripciones_solicitud_estudiante
  after update of estudiante_listo_at
  on public.inscripciones
  for each row
  execute function public.notificar_solicitud_estudiante();

-- 5. Hourly task: reminders, deadline notice, requests the page never closed
create extension if not exists pg_cron;

create or replace function public.estudiantes_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.llamar_estudiantes(jsonb_build_object('accion', 'tick'));
end;
$$;

revoke execute on function public.estudiantes_tick() from public, anon, authenticated;

select cron.schedule('estudiantes-revision', '17 * * * *', $$select public.estudiantes_tick()$$);

-- 6. Google Sheet sync: add student columns and amount
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
          'monto', new.monto
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
  after insert or update of nombre, apellidos, email, pago_estado, pagado_at, es_estudiante, estudiante_estado, monto
  on public.inscripciones
  for each row
  execute function public.notificar_hoja_inscripciones();

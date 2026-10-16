/*
  # Inscripciones al curso de Producción Creativa

  1. New table
    - `inscripciones`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz)
      - `curso` (text): course identifier, defaults to this edition
      - `nombre`, `apellidos`, `email`, `motivo` (text): form fields
      - `acepta_privacidad` (boolean): must be true (consent to primary purposes)
      - `acepta_comunicaciones` (boolean): optional consent to marketing (secondary purpose)
      - `aviso_version` (text): version of the privacy notice the person accepted

  2. Security
    - RLS enabled.
    - Anonymous visitors can INSERT only (with consent = true). No SELECT, UPDATE or DELETE policies,
      so registrations are readable only from the Supabase dashboard or with the service role key.
*/

create table if not exists public.inscripciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  curso text not null default 'produccion-creativa-2026',
  nombre text not null check (char_length(nombre) between 1 and 120),
  apellidos text not null check (char_length(apellidos) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  motivo text not null check (char_length(motivo) between 10 and 2000),
  acepta_privacidad boolean not null check (acepta_privacidad = true),
  acepta_comunicaciones boolean not null default false,
  aviso_version text not null check (char_length(aviso_version) <= 20)
);

alter table public.inscripciones enable row level security;

drop policy if exists "Visitantes pueden registrarse" on public.inscripciones;
create policy "Visitantes pueden registrarse"
  on public.inscripciones
  for insert
  to anon, authenticated
  with check (acepta_privacidad = true);

create index if not exists inscripciones_created_at_idx on public.inscripciones (created_at desc);

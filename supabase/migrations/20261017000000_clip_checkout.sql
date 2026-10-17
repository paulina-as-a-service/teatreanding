/*
  # Clip Checkout: un link de pago por inscripción

  1. New columns on `inscripciones`
    - `clip_payment_request_id` (text, unique): Clip payment link ID
    - `clip_payment_url` (text): hosted payment page for this registration
    - `clip_link_expires_at` (timestamptz): when Clip expires the link (default 72 h)
    - `clip_ultimo_estado` (text): last status reported/verified with Clip
    - `clip_transaction_id`, `clip_receipt_no`, `clip_payment_type` (text): payment details
    - `clip_actualizado_at` (timestamptz): last time Clip data changed

  2. New table `clip_links`
    - Every payment link ever created for a registration (a new one is created when the
      previous one expires), so a late payment on an older link still maps to its person.

  3. New table `clip_eventos`
    - Raw log of every webhook notification received from Clip, plus the status
      verified directly against Clip's API. For debugging and reconciliation.

  4. Security
    - `clip_links` and `clip_eventos` have RLS enabled and no policies (service role / dashboard only).
    - The old public insert policy is removed in a separate migration
      (20261017000100_remove_public_insert.sql), to run once the new form is live.

  Run this BEFORE deploying the Edge Functions (they use these columns and tables).
*/

alter table public.inscripciones
  add column if not exists clip_payment_request_id text,
  add column if not exists clip_payment_url text,
  add column if not exists clip_link_expires_at timestamptz,
  add column if not exists clip_ultimo_estado text,
  add column if not exists clip_transaction_id text,
  add column if not exists clip_receipt_no text,
  add column if not exists clip_payment_type text,
  add column if not exists clip_actualizado_at timestamptz;

create unique index if not exists inscripciones_clip_payment_request_id_key
  on public.inscripciones (clip_payment_request_id)
  where clip_payment_request_id is not null;

create index if not exists inscripciones_email_idx on public.inscripciones (email);

create table if not exists public.clip_links (
  payment_request_id text primary key,
  inscripcion_id uuid not null references public.inscripciones (id) on delete cascade,
  payment_url text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.clip_links enable row level security;

create index if not exists clip_links_inscripcion_id_idx on public.clip_links (inscripcion_id);

create table if not exists public.clip_eventos (
  id bigint generated always as identity primary key,
  recibido_at timestamptz not null default now(),
  payment_request_id text,
  estado_notificado text,
  estado_verificado text,
  inscripcion_id uuid references public.inscripciones (id) on delete set null,
  payload jsonb not null
);

alter table public.clip_eventos enable row level security;

create index if not exists clip_eventos_payment_request_id_idx on public.clip_eventos (payment_request_id);

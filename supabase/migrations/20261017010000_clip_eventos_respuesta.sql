/*
  # Save Clip's status response with each notification

  Clip's real webhook payload is { id, origin, event_type }, which differs from its docs.
  Storing the full response of GET /v2/checkout/{id} next to each notification makes any
  further format differences visible in `clip_eventos`.
*/

alter table public.clip_eventos add column if not exists respuesta_clip jsonb;

/*
  # Remove direct public inserts

  Sign-ups now go through the `inscripcion` Edge Function (service role), which also creates
  the Clip payment link. With this policy gone, the browser can no longer write to
  `inscripciones` directly.

  Run this LAST: after the Edge Functions are deployed and the new frontend is published.
*/

drop policy if exists "Visitantes pueden registrarse" on public.inscripciones;

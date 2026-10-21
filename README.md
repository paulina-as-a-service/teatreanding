# Teatranding! · Landing del curso "Introducción a la Producción Creativa"

Landing page en español para el curso en línea de Teatranding! impartido por Mauricio Baylón.

Stack: React 18 + Vite 5 + TypeScript + Tailwind CSS 3 + Framer Motion + Supabase.

## Desarrollo

```bash
npm install
cp .env.example .env   # agrega las credenciales de Supabase
npm run dev
```

Scripts: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run preview`.

## Dónde editar el contenido

Todo el copy está en `src/content/curso.ts`. Lo que está marcado como `BORRADOR` o `PENDIENTE`
se muestra en la página con una etiqueta visible para que no se publique por accidente:

- Resúmenes del temario y "Lo que vas a aprender"
- Semblanza y trayectoria de Mauricio Baylón
- Testimonios (usar solo testimonios reales, con permiso)
- Público objetivo (pendiente de validar)

El Aviso de privacidad está en `src/sections/AvisoPrivacidad.tsx`.

## Formulario de inscripción (Supabase)

1. Conecta Supabase al proyecto (en Bolt: botón "Connect to Supabase").
2. Ejecuta la migración `supabase/migrations/20261016190000_create_inscripciones.sql`.
3. Define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

Los visitantes solo pueden insertar registros. Para consultarlos, usa el Table Editor de Supabase.
Al enviar el formulario, la Edge Function `inscripcion` guarda el registro y crea un link de pago
de Clip personal (ver abajo).

## Tema claro / oscuro

- La clase `dark` en `<html>` controla el tema. La preferencia se guarda en `localStorage`
  (`teatranding-theme`) y un script en `index.html` la aplica antes del primer render.
- El cambio con clic en el botón se anima con la View Transitions API (círculo que crece desde el botón).
  Sin soporte del navegador o con "reducir movimiento" activado, el cambio es instantáneo.

## Tipografías

La marca usa Akzidenz-Grotesk (licencia comercial) y Saira Condensed. Saira Condensed se incluye
vía `@fontsource`. Mientras no haya archivos web licenciados de Akzidenz-Grotesk, se usa Archivo como
sustituto. Para usar la fuente original, agrega los `.woff2` en `public/fonts/` y declara el
`@font-face` con el nombre `Akzidenz-Grotesk` en `src/index.css`.

## Google Sheet de inscripciones

Cada registro (y cada cambio de nombre, correo o estado de pago) se copia a una Google Sheet.
La hoja recibe ID, fecha, nombre, apellidos, correo, estado de pago y fecha de pago. El campo
"motivo" no se envía. Supabase es la fuente de verdad: los cambios hechos a mano en la hoja se
sobrescriben con la siguiente actualización desde Supabase.

Piezas:

- `supabase/migrations/20261016210000_sync_inscripciones_google_sheets.sql`: columnas
  `pago_estado` / `pagado_at`, política de inserción (solo registros pendientes) y trigger que
  envía el registro con `pg_net`.
- `integrations/google-sheets/Code.gs`: Apps Script que recibe el registro y lo agrega o actualiza.
- La URL del web app (con su token) se guarda en Supabase Vault con el nombre `sheets_webhook_url`.
  Nunca va en el repo.

Para marcar un pago (por ahora, manual): en el Table Editor de Supabase cambia `pago_estado` a
`pagado` y llena `pagado_at`. La hoja se actualiza sola.

Diagnóstico: `select id, status_code, created from net._http_response order by created desc limit 10;`
Un 302 o 200 indica que Google recibió el registro.

## Pagos con Clip (un link por inscripción)

Flujo:

1. El formulario llama a la Edge Function `inscripcion`. Guarda (o actualiza, si el correo ya
   existía) el registro y crea un link de Clip con `metadata.external_reference` = ID del registro.
2. La persona paga en Clip y vuelve a `SITE_URL/?pago=exito&ref=<id>` (o `?pago=error`).
   La página muestra el resultado y consulta si el pago ya quedó confirmado.
3. Clip notifica a la Edge Function `clip-webhook`. Esta verifica el estado directamente con la API
   de Clip y, solo si está completado, marca `pago_estado = pagado`. La Google Sheet se actualiza sola.

Piezas:

- `supabase/migrations/20261017000000_clip_checkout.sql`: columnas `clip_*`, tablas `clip_links` y
  `clip_eventos` (bitácora de notificaciones).
- `supabase/migrations/20261017000100_remove_public_insert.sql`: quita la inserción directa desde el
  navegador. Correr al final, con todo lo demás funcionando.
- `supabase/functions/inscripcion/index.ts` y `supabase/functions/clip-webhook/index.ts`.
  Ambas se despliegan con verificación de JWT desactivada.

Secretos de las Edge Functions:

| Nombre | Valor |
|---|---|
| `CLIP_API_KEY` | API key de la credencial de Clip |
| `CLIP_SECRET_KEY` | Clave secreta de la credencial de Clip |
| `CLIP_WEBHOOK_TOKEN` | Texto aleatorio (solo letras y números, 32+ caracteres) |
| `SITE_URL` | `https://teatranding.com` (cuando el dominio ya cargue el sitio; antes `https://teatranding.bolt.host`) |

El monto que cobra Clip es la columna `monto` de cada inscripción (1999 por defecto; 1499 cuando se
aprueba un descuento de estudiante). El secreto `CLIP_MONTO` ya no se usa y se puede borrar.

Diagnóstico:

```sql
select recibido_at, payment_request_id, estado_notificado, estado_verificado, inscripcion_id
from clip_eventos order by recibido_at desc limit 20;
```

Clip no tiene modo de pruebas para links de pago: la prueba es un pago real que después se reembolsa
desde el panel de Clip. Para probar con un monto bajo, en el Table Editor cambia `monto` de tu
inscripción de prueba (y vacía `clip_payment_url`) antes de pedir el link.

## Correo de confirmación (Resend)

Cuando una inscripción pasa a `pago_estado = pagado` (por el webhook de Clip o por la verificación de
respaldo de la página de éxito), la base de datos llama a la Edge Function `confirmacion-email`, que
envía el correo con Resend desde `inscripciones@teatranding.com`. Las respuestas de los alumnos llegan
a `teatranding@gmail.com` (`reply_to`). Cada inscripción recibe un solo correo.

Piezas:

- `supabase/migrations/20261021000000_confirmacion_email.sql`: columnas `confirmacion_*` y trigger.
- `supabase/functions/confirmacion-email/index.ts`: envío. El texto del correo está al inicio del
  archivo (`ASUNTO`, `cuerpoTexto`, `cuerpoHtml`).
- La URL de la función (con su token) se guarda en Supabase Vault como `confirmacion_email_url`.

Secretos de la Edge Function:

| Nombre | Valor |
|---|---|
| `RESEND_API_KEY` | API key de Resend con permiso "Sending access", limitada al dominio teatranding.com |
| `CONFIRMACION_TOKEN` | Texto aleatorio (solo letras y números, 32+ caracteres) |
| `RESEND_FROM` | Opcional. Por defecto `Teatranding! <inscripciones@teatranding.com>` |
| `RESEND_REPLY_TO` | Opcional. Por defecto `teatranding@gmail.com` |
| `SITE_URL` | El mismo de `inscripcion`. El logo del correo se carga de `SITE_URL/img/logo-correo.png` (el sitio publicado debe incluir ese archivo) |
| `LOGO_URL` | Opcional. URL completa del logo, si se quiere servir desde otro lugar |
| `ZOOM_URL` | Obligatorio. Liga de Zoom (con `?pwd=`). Sin ella, no se envía y la fila queda en `error` |

Orden de instalación:

1. En Resend, agrega el dominio `teatranding.com` y crea sus registros DNS en GoDaddy
   (MX y TXT en `send`, TXT en `resend._domainkey`). Espera a que Resend lo marque como verificado.
2. Despliega `confirmacion-email` con verificación de JWT desactivada y define sus secretos.
3. Guarda la URL en Vault (SQL Editor):
   ```sql
   select vault.create_secret(
     'https://<PROJECT-REF>.supabase.co/functions/v1/confirmacion-email?token=<CONFIRMACION_TOKEN>',
     'confirmacion_email_url'
   );
   ```
4. Ejecuta la migración `20261021000000_confirmacion_email.sql`.

Reenviar un correo: en el Table Editor, cambia `confirmacion_estado` de esa inscripción a `reintentar`.

Diagnóstico:

```sql
select email, pago_estado, confirmacion_estado, confirmacion_intentos, confirmacion_error, confirmacion_enviada_at
from inscripciones where pago_estado = 'pagado' order by pagado_at desc;
```

`confirmacion_resend_id` es el ID del correo en el panel de Resend (Emails), donde se ve si fue
entregado, rebotó o cayó en spam.

## Descuento para estudiantes (25%: $1,499)

Quien responde "Sí" a "¿Eres estudiante activo?" no recibe link de pago de inmediato. Mauricio valida su
credencial vigente desde una página del sitio, sin entrar a Supabase, Clip ni la Google Sheet.

Flujo:

1. Formulario: la persona puede subir su credencial (opcional, foto o PDF de hasta 5 MB). Se guarda en el
   bucket privado `documentos-estudiantes` con un link de subida firmado.
2. La página marca la solicitud como lista (`estudiante_listo_at`) y la base de datos llama a la Edge Function
   `estudiantes`, que envía:
   - al alumno: "Recibimos tu credencial", o "Envíanos tu credencial" (responder el correo, 72 h de plazo);
   - a `teatranding@gmail.com`: la notificación con los botones **Aprobar descuento** y **Rechazar**.
3. Los botones abren `SITE_URL/?revision=<clave firmada>`, que muestra los datos y la credencial (link de
   10 minutos). Abrir la página no cambia nada; la decisión se guarda solo al presionar "Confirmar".
   - Aprobar: `monto = 1499` y el alumno recibe el link `SITE_URL/?pagar=<id>`.
   - Rechazar: Mauricio elige un motivo de la lista (`MOTIVOS` en `supabase/functions/estudiantes/index.ts`),
     `monto = 1999` y el alumno recibe el motivo y el mismo tipo de link.
   - En ambos casos la credencial se borra de Storage.
4. `?pagar=<id>` pide a `inscripcion` un link de Clip nuevo con el `monto` de esa inscripción y redirige a
   Clip. Así el link del correo no vence y el webhook de Clip reconoce el pago.
5. Tarea programada (pg_cron `estudiantes-revision`, cada hora en el minuto 17):
   - completa solicitudes que la página no cerró (30 min) o cuyo primer correo falló,
   - un recordatorio al alumno sin credencial a las 48 h,
   - a las 72 h sin credencial subida, aviso a Mauricio con los mismos botones (si la mandó por correo,
     decide; si no, rechaza con "No envió su credencial a tiempo"),
   - después de la última sesión, borra cualquier credencial de solicitudes que nadie decidió.

Los textos de los correos están en `supabase/functions/estudiantes/index.ts` (`correos`).
La Google Sheet muestra tres columnas nuevas: Estudiante, Descuento estudiante y Monto.

Secretos de la Edge Function `estudiantes`:

| Nombre | Valor |
|---|---|
| `RESEND_API_KEY` | La misma de `confirmacion-email` |
| `ESTUDIANTES_TOKEN` | Texto aleatorio (solo letras y números, 32+ caracteres) |
| `ESTUDIANTES_FIRMA` | Otro texto aleatorio (32+ caracteres). Firma los links de revisión; si cambia, los links ya enviados dejan de funcionar |
| `SITE_URL` | El mismo de `inscripcion` |
| `REVISION_EMAIL` | Opcional. Por defecto `teatranding@gmail.com` |

Orden de instalación:

1. Despliega `inscripcion` (actualizada) y `estudiantes` con verificación de JWT desactivada, y define los
   secretos de `estudiantes`.
2. Guarda la URL en Vault (SQL Editor):
   ```sql
   select vault.create_secret(
     'https://<PROJECT-REF>.supabase.co/functions/v1/estudiantes?token=<ESTUDIANTES_TOKEN>',
     'estudiantes_url'
   );
   ```
3. Ejecuta la migración `20261021120000_descuento_estudiantes.sql` (crea el bucket, las columnas, los triggers
   y la tarea programada; requiere la extensión `pg_cron`, disponible en Supabase).
4. Actualiza el Apps Script de la Google Sheet con `integrations/google-sheets/Code.gs`, corre `configurar`
   (reescribe los encabezados) y publica una versión nueva del deployment existente
   (Implementar > Administrar implementaciones > editar > Versión nueva) para conservar la misma URL.
5. Publica el sitio.

Diagnóstico:

```sql
select email, estudiante_estado, monto, estudiante_listo_at, estudiante_correo_alumno_at,
       estudiante_recordatorio_at, estudiante_plazo_aviso_at, estudiante_decidido_at, estudiante_error
from inscripciones where es_estudiante order by estudiante_solicitud_at desc;

select * from cron.job_run_details where command like '%estudiantes_tick%' order by start_time desc limit 5;
```

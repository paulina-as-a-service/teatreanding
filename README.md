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
| `CLIP_MONTO` | `1999` (bajarlo solo para un pago de prueba) |

`CLIP_MONTO` debe coincidir con `CURSO.precio.monto` en `src/content/curso.ts`.

Diagnóstico:

```sql
select recibido_at, payment_request_id, estado_notificado, estado_verificado, inscripcion_id
from clip_eventos order by recibido_at desc limit 20;
```

Clip no tiene modo de pruebas para links de pago: la prueba es un pago real (con `CLIP_MONTO`
bajo) que después se reembolsa desde el panel de Clip.

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
| `ZOOM_URL` | Opcional. Si existe, el correo incluye la liga de Zoom |

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

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
Al enviar el formulario, la persona pasa al paso 2 con el botón al link de pago de Clip
(definido en `CURSO.pagoUrl`).

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

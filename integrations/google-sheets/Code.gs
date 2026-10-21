/**
 * Teatranding! · Inscripciones -> Google Sheets
 *
 * Google Apps Script attached to the registrations Sheet (Extensiones > Apps Script).
 * Supabase POSTs each new or updated registration to this web app; the script adds a row,
 * or updates the existing row with the same ID.
 *
 * Setup (once):
 *   1. Paste this file into the Apps Script editor and save.
 *   2. Run `configurar` and authorize. It writes the header row and logs the secret token.
 *      After updating this script, run `configurar` again (it rewrites the headers) and publish a new
 *      version of the existing deployment (Deploy > Manage deployments > edit > New version) so the URL
 *      saved in Supabase keeps working.
 *   3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *   4. Final URL for Supabase = <Web app URL> + "?token=" + <token from step 2>.
 *
 * The Sheet is a view of the database: edit data in Supabase, not here, or the next
 * update from Supabase will overwrite the row.
 */

const NOMBRE_HOJA = 'Inscripciones';
const ZONA = 'America/Mexico_City';
const ENCABEZADOS = [
  'ID', 'Fecha de registro', 'Nombre', 'Apellidos', 'Correo', 'Estado de pago', 'Fecha de pago',
  'Estudiante', 'Descuento estudiante', 'Monto',
];
const ESTADOS = { pendiente: 'Pendiente', pagado: 'Pagado', cancelado: 'Cancelado' };
const ESTADOS_ESTUDIANTE = {
  pendiente_documento: 'Esperando credencial',
  en_revision: 'En revisión',
  validado: 'Aprobado',
  rechazado: 'Rechazado',
};

/** Run once from the editor: creates the sheet/headers and the secret token. */
function configurar() {
  const hoja = obtenerHoja_();
  escribirEncabezados_(hoja);
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('WEBHOOK_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('WEBHOOK_TOKEN', token);
  }
  Logger.log('Hoja lista: ' + hoja.getName());
  Logger.log('TOKEN (agrégalo al final de la URL como ?token=...): ' + token);
}

function doPost(e) {
  const token = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN');
  if (!token || !e || !e.parameter || e.parameter.token !== token) {
    return respuesta_({ ok: false, error: 'unauthorized' });
  }

  let datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return respuesta_({ ok: false, error: 'invalid json' });
  }
  const r = datos && datos.record;
  if (!r || !r.id) return respuesta_({ ok: false, error: 'missing record' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hoja = obtenerHoja_();
    const fila = [
      r.id,
      fecha_(r.created_at),
      texto_(r.nombre),
      texto_(r.apellidos),
      texto_(r.email),
      ESTADOS[r.pago_estado] || texto_(r.pago_estado),
      fecha_(r.pagado_at),
      r.es_estudiante ? 'Sí' : 'No',
      ESTADOS_ESTUDIANTE[r.estudiante_estado] || texto_(r.estudiante_estado),
      r.monto == null ? '' : Number(r.monto),
    ];
    const ultima = hoja.getLastRow();
    let indice = -1;
    if (ultima > 1) {
      const ids = hoja.getRange(2, 1, ultima - 1, 1).getValues().map(function (v) { return v[0]; });
      indice = ids.indexOf(r.id);
    }
    if (indice >= 0) {
      hoja.getRange(indice + 2, 1, 1, fila.length).setValues([fila]);
    } else {
      hoja.appendRow(fila);
    }
  } finally {
    lock.releaseLock();
  }
  return respuesta_({ ok: true });
}

function obtenerHoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(NOMBRE_HOJA);
  if (!hoja) hoja = libro.insertSheet(NOMBRE_HOJA);
  if (hoja.getLastRow() === 0) escribirEncabezados_(hoja);
  return hoja;
}

function escribirEncabezados_(hoja) {
  hoja.getRange(1, 1, 1, ENCABEZADOS.length).setValues([ENCABEZADOS]).setFontWeight('bold');
  hoja.setFrozenRows(1);
}

/** ISO timestamp from Postgres -> "2026-11-14 10:00" in CDMX time. Empty if missing. */
function fecha_(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(/(\.\d{3})\d+/, '$1'));
  if (isNaN(d.getTime())) return String(iso);
  return Utilities.formatDate(d, ZONA, 'yyyy-MM-dd HH:mm');
}

/** Plain text only: values starting with = + - @ would otherwise run as formulas. */
function texto_(v) {
  const s = v == null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function respuesta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

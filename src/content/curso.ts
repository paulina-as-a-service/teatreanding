/**
 * Todo el contenido editable de la landing vive aquí.
 * Las entradas marcadas con BORRADOR o PENDIENTE deben revisarse antes de publicar.
 */

export const CURSO = {
  nombreCorto: 'Producción Creativa',
  titulo: {
    antes: 'Introducción a la',
    principal: 'Producción Creativa',
    despues: 'para eventos y entretenimiento',
  },
  // Fuente: copy del reel de lanzamiento (Calendario IG, 15 oct)
  descripcion:
    'Un curso para quienes quieren llevar una idea al escenario de principio a fin. En 20 horas en línea recorres el proceso creativo, administrativo, técnico y operativo de una producción, y lo aplicas a un proyecto propio.',
  // Sección "El curso". Copy final aprobado por la usuaria (20 oct 2026).
  seccion: {
    tituloLinea1: 'Obra, concierto o evento:',
    tituloLinea2: 'de la idea a la ejecución.',
    intro:
      'Una obra, un festival, un concierto o una activación de marca siguen la misma lógica de producción: fechas, equipo, presupuesto y montaje. En 20 horas recorres el proceso completo, del concepto a la liquidación, con los formatos y herramientas que usamos en campo.',
  },
  publico: [
    'Estudias artes escénicas, producción o carreras afines y nadie te ha enseñado a presupuestar.',
    'Quieres montar tu propio proyecto y no sabes por dónde empezar.',
    'Trabajas en eventos y tu proceso vive en llamadas de último minuto.',
    'Eres artista y te toca producirte, cobrar y facturar.',
  ],
  docente: 'Mauricio Baylón',
  modalidad: 'En línea por Zoom',
  duracionHoras: 20,
  precio: {
    // Debe coincidir con el secreto CLIP_MONTO de la Edge Function (el monto que Clip cobra).
    monto: 1999,
    moneda: 'MXN',
    nota: 'Pago único',
  },
  // Confirmado por la usuaria (16 oct 2026): reconocimiento por 20 horas, solo con 100% de asistencia (la registra Mauricio Baylón).
  reconocimiento: {
    titulo: 'Reconocimiento de participación',
    texto: 'Al concluir el curso recibes un reconocimiento de participación de Teatranding! por 20 horas de formación.',
    condicion: 'Se entrega a quienes asistan al 100% de las sesiones.',
    imagen: '/img/reconocimiento.webp',
  },
  contacto: {
    email: 'teatranding@gmail.com',
    instagram: 'teatranding.mx',
    instagramUrl: 'https://www.instagram.com/teatranding.mx/',
  },
  // Fuente: Calendario IG (dato histórico del deck)
  historia: 'Entre 2020 y 2021 formamos a más de 120 hacedores de teatro en seminarios de vestuario, escenografía, stage management y más.',
} as const;

/**
 * Sesiones: sábados de 10:00 a 14:00, hora de la Ciudad de México (UTC-6, sin horario de verano).
 * Fuente: cartel del curso.
 */
export const ZONA_CURSO = 'America/Mexico_City';
export const HORARIO_CDMX = { inicio: '10:00', fin: '14:00' };
export const SESIONES: { inicioUTC: string; finUTC: string }[] = [
  { inicioUTC: '2026-11-14T16:00:00Z', finUTC: '2026-11-14T20:00:00Z' },
  { inicioUTC: '2026-11-21T16:00:00Z', finUTC: '2026-11-21T20:00:00Z' },
  { inicioUTC: '2026-11-28T16:00:00Z', finUTC: '2026-11-28T20:00:00Z' },
  { inicioUTC: '2026-12-05T16:00:00Z', finUTC: '2026-12-05T20:00:00Z' },
  { inicioUTC: '2026-12-12T16:00:00Z', finUTC: '2026-12-12T20:00:00Z' },
];

export type Modulo = {
  numero: string;
  titulo: string;
  resumen: string;
  temas: string[];
};

/** Temario. Copy final aprobado por la usuaria (20 oct 2026), basado en el Temario PDF. */
export const MODULOS: Modulo[] = [
  {
    numero: '01',
    titulo: 'El proceso creativo',
    resumen: 'Cómo nace un proyecto, qué etapas sigue y cómo la dirección creativa ordena cada decisión de producción.',
    temas: ['Proceso creativo', 'Dirección creativa', 'Áreas aliadas'],
  },
  {
    numero: '02',
    titulo: 'El proceso administrativo',
    resumen:
      'Planea y cuantifica tu proyecto: objetivos, recursos, cronograma, ruta crítica y un presupuesto con inversión, gastos fijos y escenarios.',
    temas: ['FODA', 'Cronograma', 'Ruta crítica', 'Presupuesto'],
  },
  {
    numero: '03',
    titulo: 'El proceso técnico',
    resumen:
      'La documentación que te pide cualquier venue o proveedor: rider, planos, diagramas de conexión, manual de operación y calling show. Más scouting de espacios.',
    temas: ['Rider', 'Planos', 'Calling show', 'Scouting'],
  },
  {
    numero: '04',
    titulo: 'Operación',
    resumen:
      'Del montaje a la liquidación: protocolos de operación y cancelación, trámites, difusión, control de taquilla y cierre de cuentas.',
    temas: ['Montaje', 'Tramitología', 'Taquilla', 'Liquidaciones'],
  },
  {
    numero: '05',
    titulo: 'Taller de proyectos',
    resumen: 'Aterrizas todo lo visto en un proyecto propio: concepto, plan, presupuesto y documentación técnica.',
    temas: ['Proyecto propio', 'Revisión grupal'],
  },
];

/** "Lo que vas a aprender". BORRADOR derivado del temario; la usuaria agregará el copy final. */
export const APRENDIZAJES: { titulo: string; texto: string }[] = [
  { titulo: 'Definir una dirección creativa', texto: 'BORRADOR: Traducir una idea en un concepto claro que oriente al equipo.' },
  { titulo: 'Planear con cronograma y ruta crítica', texto: 'BORRADOR: Saber qué pasa, cuándo, y qué tareas no pueden retrasarse.' },
  { titulo: 'Armar un presupuesto desde cero', texto: 'BORRADOR: Inversión original, gastos fijos y escenarios posibles.' },
  { titulo: 'Leer y escribir un rider', texto: 'BORRADOR: Requerimientos técnicos y de hospitalidad sin ambigüedades.' },
  { titulo: 'Elegir y evaluar un venue', texto: 'BORRADOR: Reporte de scouting y registro fotográfico.' },
  { titulo: 'Operar el día de la función', texto: 'BORRADOR: Montaje, calling show, taquilla y liquidaciones.' },
];

/** Palabras para la marquesina. Todas salen del temario. */
export const MARQUESINA = [
  'Dirección creativa',
  'FODA',
  'Cronograma',
  'Ruta crítica',
  'Presupuesto',
  'Rider',
  'Planos',
  'Calling show',
  'Scouting',
  'Montaje',
  'Taquilla',
  'Liquidaciones',
];

/**
 * Docente. Cargos tomados del reconocimiento del curso y del Calendario IG.
 * PENDIENTE: semblanza y trayectoria (la usuaria agregará el copy).
 */
export const DOCENTE = {
  nombre: 'Mauricio Baylón',
  cargos: ['Cofundador de Teatranding!', 'Coordinador de Actividades Académicas'],
  foto: '/img/mauricio-baylon.webp',
  semblanza: 'PENDIENTE: Semblanza de Mauricio Baylón. Quién es, cómo llegó a la producción y por qué creó este curso.',
  trayectoria: [
    { anio: '[Año]', titulo: '[Proyecto o cargo 1]', detalle: 'PENDIENTE: descripción breve.' },
    { anio: '[Año]', titulo: '[Proyecto o cargo 2]', detalle: 'PENDIENTE: descripción breve.' },
    { anio: '[Año]', titulo: '[Proyecto o cargo 3]', detalle: 'PENDIENTE: descripción breve.' },
  ],
};

/**
 * Testimonios. PENDIENTE: reemplazar con testimonios reales (con permiso de cada persona).
 * Mientras `pendiente` sea true, la tarjeta se muestra como espacio reservado.
 */
export const TESTIMONIOS: { nombre: string; rol: string; texto: string; pendiente?: boolean }[] = [
  { nombre: '[Nombre]', rol: '[Seminario y año]', texto: '[Testimonio real pendiente]', pendiente: true },
  { nombre: '[Nombre]', rol: '[Seminario y año]', texto: '[Testimonio real pendiente]', pendiente: true },
  { nombre: '[Nombre]', rol: '[Seminario y año]', texto: '[Testimonio real pendiente]', pendiente: true },
];

/** Versión del aviso de privacidad vigente; se guarda con cada registro. */
export const AVISO_VERSION = '2026-10-16';

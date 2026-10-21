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
    // Precio regular. Clip cobra el `monto` de cada inscripción (1999 por defecto en la base de datos).
    monto: 1999,
    moneda: 'MXN',
    nota: 'Pago único',
    // 25% de descuento para estudiantes con credencial vigente (lo valida Mauricio Baylón).
    // Debe coincidir con MONTO_ESTUDIANTE en supabase/functions/estudiantes/index.ts.
    estudiante: 1499,
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

/** "Lo que vas a aprender". Copy final aprobado por la usuaria (20 oct 2026). */
export const APRENDIZAJES: { titulo: string; texto: string }[] = [
  { titulo: 'Definir una dirección creativa', texto: 'Conviertes tu idea en un concepto que guía a todo tu equipo.' },
  { titulo: 'Planear con cronograma y ruta crítica', texto: 'Sabes qué pasa, cuándo pasa y qué tareas no puedes dejar que se retrasen.' },
  { titulo: 'Armar un presupuesto desde cero', texto: 'Calculas inversión, gastos fijos y escenarios antes de mover un peso.' },
  { titulo: 'Leer y escribir un rider', texto: 'Pides lo que tu proyecto necesita y entiendes lo que te piden a ti.' },
  { titulo: 'Elegir y evaluar un venue', texto: 'Haces scouting, reporte y registro fotográfico antes de comprometerte.' },
  { titulo: 'Operar el día del evento', texto: 'Coordinas montaje, calling show, taquilla y liquidación al cierre.' },
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
 */
export const DOCENTE = {
  nombre: 'Mauricio Baylón',
  cargos: ['Cofundador de Teatranding!', 'Coordinador de Actividades Académicas'],
  foto: '/img/mauricio-baylon.webp',
  // Copy final aprobado por la usuaria (20 oct 2026). Cada elemento es un párrafo.
  semblanza: [
    'Mauricio Baylón es productor y project manager con más de diez años en teatro, eventos y experiencias inmersivas. Estudió Literatura Dramática y Teatro en la UNAM, y desde entonces su trabajo cruza la creación escénica, la producción y la escenotecnia.',
    'Fue gerente de producción en Mejor Teatro y ha trabajado como jefe de utilería y stage manager en giras de musicales como Beetlejuice, Tina y Pretty Woman con GOU Producciones. Hoy coordina proyectos de museografía multimedia en Cocolab International para clientes como Clase Azul, Omnilife y CFE.',
    'En 2020 cofundó Teatranding! para cubrir lo que las escuelas no enseñan: presupuestos, riders, trámites y liquidaciones. Este curso reúne los procesos y formatos que usa en su trabajo diario.',
  ],
  trayectoria: [
    {
      anio: '2022-2026',
      titulo: 'Cocolab International',
      detalle: 'Coordinación de museografía multimedia y experiencias inmersivas para WMF, CFE, Omnilife y Clase Azul.',
    },
    {
      anio: '2022-2025',
      titulo: 'GOU Producciones',
      detalle: 'Utilería y stage management en giras de Beetlejuice, Tina, Pretty Woman y Bluey.',
    },
    { anio: '2016-2019', titulo: 'Mejor Teatro', detalle: 'Gerente de producción.' },
  ],
};

/**
 * Testimonios reales de asistentes. Sin nombres por decisión de la usuaria (20 oct 2026);
 * solo se muestra la etiqueta del programa que tomaron.
 */
export const TESTIMONIOS: { texto: string; programa: string }[] = [
  {
    texto: 'Me gustó mucho lo dinámico de las clases, las tareas, lo personalizado que se volvió a pesar de que éramos bastantes.',
    programa: 'Asistente, seminario en línea de Teatranding!',
  },
  {
    texto:
      'Agradezco mucho la oportunidad que me brindaron al permitirme asistir al curso, conocerles y orientarme de una manera profesional y clara sobre lo que implica producir un proyecto escénico.',
    programa: 'Asistente, curso en línea de Teatranding!',
  },
  {
    texto: 'Que fue totalmente práctico y creo que los ejercicios fueron muy buenos y puntuales, cada uno cumplió un objetivo específico.',
    programa: 'Asistente, workshop en línea de Teatranding!',
  },
  {
    texto: 'Disfruté mucho las clases, espero poder dedicarme a esto pronto.',
    programa: 'Asistente, seminario en línea de Teatranding!',
  },
];

/** Versión del aviso de privacidad vigente; se guarda con cada registro. */
export const AVISO_VERSION = '2026-10-21';

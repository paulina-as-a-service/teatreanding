/**
 * SEO / AEO: datos estructurados (schema.org JSON-LD) que se inyectan en el HTML al hacer el build
 * (scripts/prerender.mjs). Se generan a partir de curso.ts para que precios y fechas no se desfasen.
 */
import { CIERRE_INSCRIPCIONES, CURSO, DOCENTE, MODULOS, SESIONES } from './curso';

export const SITE_URL = 'https://teatranding.com';
const abs = (path: string) => `${SITE_URL}${path}`;

// Fuente: brochure y brief de Teatranding! (fundada en junio de 2020).
const FUNDACION = '2020-06';

const ORG_ID = `${SITE_URL}/#organizacion`;
const DOCENTE_ID = `${SITE_URL}/#mauricio-baylon`;
const CURSO_ID = `${SITE_URL}/#curso-produccion-creativa`;

/** "2026-11-14T16:00:00Z" -> "2026-11-14T10:00:00-06:00" (CDMX, UTC-6 sin horario de verano). */
const cdmx = (isoUtc: string) => {
  const d = new Date(new Date(isoUtc).getTime() - 6 * 3_600_000);
  return `${d.toISOString().slice(0, 19)}-06:00`;
};
const fecha = (isoUtc: string) => cdmx(isoUtc).slice(0, 10);

export function jsonLd() {
  const inicio = SESIONES[0];
  const fin = SESIONES[SESIONES.length - 1];
  const nombreCurso = `${CURSO.titulo.antes} ${CURSO.titulo.principal} ${CURSO.titulo.despues}`;

  const oferta = (precio: number, nombre: string, categoria?: string) => ({
    '@type': 'Offer',
    name: nombre,
    price: precio,
    priceCurrency: CURSO.precio.moneda,
    category: categoria ?? 'Paid',
    availability: 'https://schema.org/InStock',
    validThrough: cdmx(CIERRE_INSCRIPCIONES),
    url: abs('/#inscripcion'),
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': ORG_ID,
        name: 'Teatranding!',
        alternateName: 'Teatranding',
        url: abs('/'),
        logo: abs('/img/logo-correo.png'),
        email: CURSO.contacto.email,
        foundingDate: FUNDACION,
        founder: { '@id': DOCENTE_ID },
        description:
          'Plataforma de formación práctica para artes escénicas y entretenimiento: producción, presupuestos, riders técnicos, escenografía y gestión.',
        areaServed: 'MX',
        sameAs: [CURSO.contacto.instagramUrl],
      },
      {
        '@type': 'Person',
        '@id': DOCENTE_ID,
        name: DOCENTE.nombre,
        jobTitle: 'Productor y project manager',
        description: DOCENTE.semblanza[0],
        image: abs(DOCENTE.foto),
        alumniOf: { '@type': 'CollegeOrUniversity', name: 'Universidad Nacional Autónoma de México (UNAM)' },
        worksFor: { '@id': ORG_ID },
        url: abs('/#docente'),
      },
      {
        '@type': 'Course',
        '@id': CURSO_ID,
        name: nombreCurso,
        description: CURSO.descripcion,
        url: abs('/'),
        image: abs('/img/cartel.jpg'),
        inLanguage: 'es-MX',
        provider: { '@id': ORG_ID },
        instructor: { '@id': DOCENTE_ID },
        timeRequired: `PT${CURSO.duracionHoras}H`,
        educationalLevel: 'Beginner',
        teaches: MODULOS.map((m) => m.titulo),
        syllabusSections: MODULOS.map((m) => ({
          '@type': 'Syllabus',
          name: `Módulo ${m.numero}: ${m.titulo}`,
          description: m.resumen,
        })),
        offers: [
          oferta(CURSO.precio.monto, 'Inscripción general'),
          oferta(CURSO.precio.estudiante, 'Inscripción estudiante (credencial vigente)'),
        ],
        hasCourseInstance: {
          '@type': 'CourseInstance',
          courseMode: 'Online',
          location: { '@type': 'VirtualLocation', name: 'Zoom' },
          startDate: cdmx(inicio.inicioUTC),
          endDate: cdmx(fin.finUTC),
          courseWorkload: `PT${CURSO.duracionHoras}H`,
          instructor: { '@id': DOCENTE_ID },
          courseSchedule: {
            '@type': 'Schedule',
            repeatFrequency: 'P1W',
            repeatCount: SESIONES.length,
            byDay: 'https://schema.org/Saturday',
            startDate: fecha(inicio.inicioUTC),
            endDate: fecha(fin.inicioUTC),
            startTime: '10:00',
            endTime: '14:00',
            scheduleTimezone: 'America/Mexico_City',
          },
        },
      },
    ],
  };
}

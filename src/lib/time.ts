import { ZONA_CURSO } from '../content/curso';

const fmt = (opts: Intl.DateTimeFormatOptions, timeZone: string) =>
  new Intl.DateTimeFormat('es-MX', { ...opts, timeZone });

export const userTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ZONA_CURSO;
  } catch {
    return ZONA_CURSO;
  }
};

export const formatHour = (iso: string, timeZone: string) =>
  fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, timeZone).format(new Date(iso));

export const formatDay = (iso: string, timeZone = ZONA_CURSO) => {
  const d = new Date(iso);
  return {
    weekday: fmt({ weekday: 'short' }, timeZone).format(d).replace('.', ''),
    day: fmt({ day: 'numeric' }, timeZone).format(d),
    month: fmt({ month: 'short' }, timeZone).format(d).replace('.', ''),
  };
};

/** Short, readable name for a time zone, e.g. "America/Bogota" -> "Bogota". */
export const zoneLabel = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;

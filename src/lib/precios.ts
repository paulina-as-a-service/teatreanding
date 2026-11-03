import { CURSO } from '../content/curso';

/** "$1,999 MXN", "$749.50 MXN": centavos only when there are any. */
export const pesos = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} ${CURSO.precio.moneda}`;

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Amounts for a course price: $500 to reserve the spot, the rest in two equal payments.
 * Same split as the Edge Functions (montoDe in `inscripcion`): 1999 -> 749.50 + 749.50, 1499 -> 499.50 + 499.50.
 */
export function montos(total: number) {
  const apartado = CURSO.precio.apartado;
  const pago2 = redondear((total - apartado) / 2);
  return { completo: total, apartado, pago2, pago3: redondear(total - apartado - pago2) };
}

export type Opciones = ReturnType<typeof montos>;

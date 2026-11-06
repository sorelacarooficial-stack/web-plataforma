import 'server-only';

/**
 * Las cuentas para pagar por transferencia. NO van en el código: el
 * repositorio es público y son datos personales de Sorela (cuenta y cédula).
 * Se leen de Vercel:
 *
 *   TRANSFERENCIA_COLOMBIA = Bancolombia · Cuenta de ahorros | # 000 | Titular | CC 000
 *   TRANSFERENCIA_VENEZUELA = …
 *
 * Cada línea separada por «|» o por saltos de línea. Vacía = no se enseña.
 */
export type Transferencia = { pais: string; lineas: string[] };

const partir = (v: string | undefined) =>
  (v ?? '')
    .split(/\r?\n|\|/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((x) => x.slice(0, 120));

export function transferencias(): Transferencia[] {
  return [
    { pais: 'Colombia', lineas: partir(process.env.TRANSFERENCIA_COLOMBIA) },
    { pais: 'Venezuela', lineas: partir(process.env.TRANSFERENCIA_VENEZUELA) },
  ].filter((t) => t.lineas.length > 0);
}

/**
 * Los prefijos telefónicos que se ofrecen al firmar el acuerdo.
 *
 * Sorela da formación en España, Latinoamérica, Estados Unidos y Europa: un
 * teléfono sin prefijo de país no sirve para escribir a nadie por WhatsApp, y
 * dar por hecho el +34 dejaba mal apuntado a todo el que no fuera de España.
 *
 * Arriba van los países donde más forma; el resto, por orden alfabético. Quien
 * no encuentre el suyo puede escribir el número entero empezando por «+» y se
 * respeta tal cual.
 */

export type Prefijo = { pais: string; region: string; prefijo: string; bandera: string };

export const PREFIJOS: Prefijo[] = [
  { pais: 'España', region: 'ES', prefijo: '+34', bandera: '🇪🇸' },
  { pais: 'Colombia', region: 'CO', prefijo: '+57', bandera: '🇨🇴' },
  { pais: 'México', region: 'MX', prefijo: '+52', bandera: '🇲🇽' },
  { pais: 'Estados Unidos', region: 'US', prefijo: '+1', bandera: '🇺🇸' },
  { pais: 'Venezuela', region: 'VE', prefijo: '+58', bandera: '🇻🇪' },
  { pais: 'Argentina', region: 'AR', prefijo: '+54', bandera: '🇦🇷' },
  { pais: 'Alemania', region: 'DE', prefijo: '+49', bandera: '🇩🇪' },
  { pais: 'Bolivia', region: 'BO', prefijo: '+591', bandera: '🇧🇴' },
  { pais: 'Brasil', region: 'BR', prefijo: '+55', bandera: '🇧🇷' },
  { pais: 'Canadá', region: 'CA', prefijo: '+1', bandera: '🇨🇦' },
  { pais: 'Chile', region: 'CL', prefijo: '+56', bandera: '🇨🇱' },
  { pais: 'Costa Rica', region: 'CR', prefijo: '+506', bandera: '🇨🇷' },
  { pais: 'Cuba', region: 'CU', prefijo: '+53', bandera: '🇨🇺' },
  { pais: 'Ecuador', region: 'EC', prefijo: '+593', bandera: '🇪🇨' },
  { pais: 'El Salvador', region: 'SV', prefijo: '+503', bandera: '🇸🇻' },
  { pais: 'Francia', region: 'FR', prefijo: '+33', bandera: '🇫🇷' },
  { pais: 'Guatemala', region: 'GT', prefijo: '+502', bandera: '🇬🇹' },
  { pais: 'Honduras', region: 'HN', prefijo: '+504', bandera: '🇭🇳' },
  { pais: 'Italia', region: 'IT', prefijo: '+39', bandera: '🇮🇹' },
  { pais: 'Nicaragua', region: 'NI', prefijo: '+505', bandera: '🇳🇮' },
  { pais: 'Panamá', region: 'PA', prefijo: '+507', bandera: '🇵🇦' },
  { pais: 'Paraguay', region: 'PY', prefijo: '+595', bandera: '🇵🇾' },
  { pais: 'Perú', region: 'PE', prefijo: '+51', bandera: '🇵🇪' },
  { pais: 'Portugal', region: 'PT', prefijo: '+351', bandera: '🇵🇹' },
  { pais: 'Puerto Rico', region: 'PR', prefijo: '+1', bandera: '🇵🇷' },
  { pais: 'Reino Unido', region: 'GB', prefijo: '+44', bandera: '🇬🇧' },
  { pais: 'República Dominicana', region: 'DO', prefijo: '+1', bandera: '🇩🇴' },
  { pais: 'Suiza', region: 'CH', prefijo: '+41', bandera: '🇨🇭' },
  { pais: 'Uruguay', region: 'UY', prefijo: '+598', bandera: '🇺🇾' },
];

/**
 * El país que se propone de entrada, sacado del idioma del navegador.
 *
 * Un móvil configurado en «español (Colombia)» dice `es-CO`: se propone
 * Colombia. Es solo el valor de partida —se cambia con un toque—, pero acierta
 * en la inmensa mayoría y ahorra buscar el país en una lista de treinta.
 */
export function regionProbable(): string {
  try {
    const idiomas = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const idioma of idiomas) {
      const region = idioma.split('-')[1]?.toUpperCase();
      if (region && PREFIJOS.some((p) => p.region === region)) return region;
    }
  } catch {
    /* Sin navegador, España. */
  }
  return 'ES';
}

/**
 * El teléfono completo, con su prefijo.
 *
 * Si quien firma ya ha escrito el número empezando por «+», manda lo que ha
 * escrito: es justo quien tiene un país que no está en la lista, o quien
 * copia su número de la agenda con el prefijo puesto.
 */
export function telefonoCompleto(region: string, numero: string): string {
  const limpio = (numero || '').trim();
  if (!limpio) return '';
  if (limpio.startsWith('+')) return limpio;
  const p = PREFIJOS.find((x) => x.region === region)?.prefijo ?? '+34';
  return `${p} ${limpio.replace(/^0+/, '')}`;
}

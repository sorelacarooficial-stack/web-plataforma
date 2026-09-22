/**
 * Captación de contactos: validación compartida.
 *
 * Vive fuera de la ruta y del componente a propósito, para que el navegador y
 * el servidor apliquen exactamente las mismas reglas. El navegador valida para
 * avisar rápido; el servidor valida porque cualquiera puede saltarse el
 * navegador. Si algún día se separan, empiezan a entrar datos que el
 * formulario cree haber rechazado.
 */

export type Contacto = {
  nombre: string;
  correo: string;
  whatsapp: string;
  /** Opcional: solo lo pregunta el formulario largo, no la ventana emergente. */
  perfil?: string;
  consentimiento: boolean;
  origen?: string;
  /** Señuelo antirrobots: si viene con algo, no lo ha rellenado una persona. */
  empresa?: string;
};

export type Fallo = 'datos' | 'ritmo' | 'sin-destino' | 'destino';

/** En qué punto está quien deja el dato. Ordena la lista para Sorela. */
export const PERFILES = [
  'Esteticista con cabina propia',
  'Trabajo en un centro de otra persona',
  'Masajista o terapeuta corporal',
  'Estoy formándome todavía',
  'Otra cosa',
] as const;

/**
 * Correo: no se usa la típica expresión kilométrica. Comprueba lo que de
 * verdad importa (algo, arroba, algo, punto, algo, sin espacios) y deja pasar
 * el resto, porque un correo válido raro rechazado es un contacto perdido y un
 * correo falso lo descubre igualmente el primer envío.
 */
const CORREO = /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i;

/**
 * Teléfono: se queda solo con los dígitos y acepta el móvil español (9 cifras
 * empezando por 6 o 7, con o sin 34 delante) o cualquier internacional de 8 a
 * 15 cifras, que es lo que permite el estándar. En la exposición puede haber
 * gente de fuera y no se les va a echar por el prefijo.
 */
export function normalizarTelefono(valor: string): string | null {
  const limpio = (valor || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const digitos = limpio.replace(/\D/g, '');
  if (/^(34)?[67]\d{8}$/.test(digitos)) return '+34' + digitos.slice(-9);
  if (limpio.startsWith('+') && digitos.length >= 8 && digitos.length <= 15) return '+' + digitos;
  if (digitos.length >= 8 && digitos.length <= 15) return '+' + digitos;
  return null;
}

const recortar = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

export type Revision =
  | { ok: true; datos: Omit<Contacto, 'empresa'> & { origen: string } }
  | { ok: false; errores: Partial<Record<keyof Contacto, string>> };

export function revisar(entrada: Partial<Contacto>): Revision {
  const errores: Partial<Record<keyof Contacto, string>> = {};

  const nombre = recortar(entrada.nombre, 80);
  const correo = recortar(entrada.correo, 160).toLowerCase();
  const whatsapp = normalizarTelefono(recortar(entrada.whatsapp, 32));
  const perfil = recortar(entrada.perfil, 60);

  if (nombre.length < 2) errores.nombre = 'Escribe tu nombre.';
  if (!CORREO.test(correo)) errores.correo = 'Ese correo no parece correcto.';
  if (!whatsapp) errores.whatsapp = 'Escribe tu móvil, con prefijo si es de fuera de España.';
  if (!entrada.consentimiento) errores.consentimiento = 'Necesito que lo aceptes para guardarlo.';

  if (Object.keys(errores).length) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      nombre,
      correo,
      whatsapp: whatsapp!,
      // El perfil no se exige: la ventana emergente solo pide tres campos,
      // porque cada campo de más cuesta contactos. Si llega uno que no está en
      // la lista se guarda como «Otra cosa» en vez de rechazar el envío: el
      // dato de contacto vale mucho más que la etiqueta.
      ...(perfil
        ? { perfil: (PERFILES as readonly string[]).includes(perfil) ? perfil : 'Otra cosa' }
        : {}),
      consentimiento: true,
      origen: recortar(entrada.origen, 40) || 'web',
    },
  };
}

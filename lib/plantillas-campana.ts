import { botonCorreo, envoltorio, escapar } from './plantillas-correo';
import type { ImagenCorreo } from './marca-correo';

/**
 * Los avisos y correos programados que escribe Sorela (ver lib/campanas.ts).
 *
 * Ella escribe texto normal, sin HTML, con cuatro reglas que se explican en la
 * propia pantalla:
 *   · una línea en blanco separa párrafos
 *   · **así** va en negrita
 *   · una línea que empieza por «- » es un punto de una lista
 *   · {nombre} se cambia por el nombre de cada persona
 *
 * Esto lo usan el servidor (para enviar) y la pantalla (para la vista previa
 * mientras escribe), así que no puede tocar nada de servidor.
 */

export const AUDIENCIAS = {
  espera: 'Lista de espera de la Comunidad',
  alumnas: 'Alumnas de la formación',
  comunidad: 'Miembros de la Comunidad Divine',
  contactos: 'Todos los contactos del CRM',
  todos: 'Todo el mundo (contactos y cuentas)',
} as const;

export type Audiencia = keyof typeof AUDIENCIAS;

export type EstadoCampana = 'borrador' | 'programada' | 'enviada' | 'pausada' | 'caducada';

export type Campana = {
  id: string;
  /** Línea pequeña encima del saludo («Quedan 3 días»). Opcional. */
  etiqueta: string;
  asunto: string;
  cuerpo: string;
  boton: { texto: string; enlace: string } | null;
  /** La foto de cabecera del correo. */
  imagen?: ImagenCorreo;
  audiencia: Audiencia;
  /** Día de envío, `2026-10-30`, en hora de España. */
  fecha: string;
  estado: EstadoCampana;
  /** Si es de una serie (la cuenta atrás), para agruparla en pantalla. */
  serie: string | null;
  resultado: { enviados: number; fallidos: number; omitidos: number; cuando: string | null } | null;
};

/** Un botón con texto y sin enlace es un correo a medias (el de Zoom antes de tenerlo): no sale. */
export const faltaEnlace = (c: Pick<Campana, 'boton'>) => !!c.boton && !/^https?:\/\/\S+$/.test(c.boton.enlace);

const pila = (n: string | null | undefined) => (n || '').trim().split(/\s+/)[0] || '';

/** El texto de Sorela, con el nombre puesto. */
export function conNombre(t: string, nombre: string | null) {
  const n = pila(nombre);
  // Sin nombre, «Hola {nombre}, ¿qué tal?» no puede quedar en «Hola , ¿qué tal?».
  if (n) return t.replace(/\{nombre\}/g, n);
  return t
    .replace(/,?[ \t]*\{nombre\}/g, '')
    .replace(/[ \t]+([,.!?])/g, '$1');
}

const negritas = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** Texto con las cuatro reglas → HTML de correo. */
export function cuerpoHtml(cuerpo: string) {
  const bloques = cuerpo.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return bloques
    .map((b) => {
      const lineas = b.split('\n');
      if (lineas.every((l) => /^\s*-\s+/.test(l))) {
        return `<ul style="margin:0 0 18px;padding-left:20px">${lineas
          .map((l) => `<li style="margin:0 0 8px">${negritas(escapar(l.replace(/^\s*-\s+/, '')))}</li>`)
          .join('')}</ul>`;
      }
      return `<p style="margin:0 0 18px">${lineas.map((l) => negritas(escapar(l))).join('<br>')}</p>`;
    })
    .join('\n');
}

export function cuerpoTexto(cuerpo: string) {
  return cuerpo.replace(/\r/g, '').replace(/\*\*(.+?)\*\*/g, '$1').trim();
}

/** El correo entero de una campaña para una persona. */
export function plantillaCampana(
  c: Pick<Campana, 'etiqueta' | 'asunto' | 'cuerpo' | 'boton' | 'imagen'>,
  nombre: string | null,
  baja: string
) {
  const hola = pila(nombre) ? `Hola ${pila(nombre)},` : 'Hola,';
  const cuerpo = conNombre(c.cuerpo, nombre);
  const asunto = conNombre(c.asunto, nombre);
  const boton = c.boton && c.boton.texto && /^https?:\/\//.test(c.boton.enlace) ? botonCorreo(c.boton.enlace, c.boton.texto) : '';
  const html = envoltorio(escapar(hola), cuerpoHtml(cuerpo) + boton, baja, '', {
    titulo: asunto,
    etiqueta: c.etiqueta || undefined,
    imagen: c.imagen ?? 'equipo',
    previa: cuerpoTexto(cuerpo).split('\n')[0].slice(0, 140),
  });
  const texto = [
    c.etiqueta ? c.etiqueta.toUpperCase() : '',
    hola,
    '',
    cuerpoTexto(cuerpo),
    c.boton?.texto && c.boton.enlace ? `\n${c.boton.texto}: ${c.boton.enlace}` : '',
    '',
    'Sorela Caro',
    'Creadora de la Técnica Divine',
    '',
    `Si no quieres recibir más correos así: ${baja}`,
  ]
    .filter((l, i) => i > 0 || l)
    .join('\n');
  return { asunto, texto, html };
}

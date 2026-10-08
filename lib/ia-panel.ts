import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { APERTURA_LARGA } from './apertura';
import { COMUNIDAD } from './contenido';
import { COMO_LLEGO, ETIQUETA_TIPO, QUE_QUIERE, type Tipo } from './origenes';

/**
 * La inteligencia artificial del panel de Sorela.
 *
 * Hace dos cosas, y solo para ella:
 *
 *   1. El resumen del día: mira los contactos y dice a quién escribir primero
 *      y por qué.
 *   2. El borrador de un mensaje para una persona concreta, por WhatsApp o
 *      por correo, con la voz de Sorela. Nunca se envía solo: Sorela lo lee,
 *      lo cambia si quiere y lo manda ella.
 *
 * QUÉ DATOS SALEN HACIA EL MODELO, y es deliberado: el nombre de pila, de
 * dónde llegó, qué busca, la ciudad, lo que la persona escribió en el
 * formulario, el estado y los días que lleva esperando. NUNCA el correo, el
 * teléfono ni los apellidos: para redactar un mensaje no hacen falta, y lo
 * que no se manda no se puede filtrar. Anthropic figura como encargado del
 * tratamiento en la política de privacidad.
 *
 * Si no hay clave (ANTHROPIC_API_KEY en Vercel), todo esto está apagado y el
 * panel lo dice. No rompe nada.
 */

export const MODELO = 'claude-opus-5-5';

export const hayIA = () => Boolean(process.env.ANTHROPIC_API_KEY);

let cliente: Anthropic | null = null;
const anthropic = () => (cliente ??= new Anthropic());

/** Lo que el modelo sabe de un contacto. Sin datos de contacto. */
export type ContactoIA = {
  id: string;
  nombre: string;
  tipo: Tipo;
  origen: string;
  ciudad: string;
  perfil: string;
  nota: string;
  estado: string;
  dias: number;
  seguimiento: string[];
};

export const nombreDePila = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? '';

const SISTEMA = [
  'Eres la asistente del panel privado de Sorela Caro, creadora de la Técnica Divine: drenaje linfático manual avanzado. Sorela forma a esteticistas y terapeutas y trata a clientas.',
  'Trabajas solo para Sorela. Le ayudas a decidir a quién escribir primero y le preparas borradores de mensajes que ella revisa y envía.',
  '',
  'Lo que es cierto y puedes usar:',
  `- La Comunidad Divine es para terapeutas ya formadas en la Técnica Divine. Abre el ${APERTURA_LARGA}. Cuesta ${COMUNIDAD.precio} € ${COMUNIDAD.periodo}, precio de lanzamiento que conserva quien entra ese día mientras siga dentro. Incluye una clase en vivo al mes con grabación, acompañamiento de casos uno a uno y un canal privado en Telegram. La agenda para reservas y la ficha en el mapa llegan más adelante.`,
  '- Las formaciones son presenciales. Las próximas fechas NO están confirmadas: nunca des fechas ni precios de formaciones; ofrece guardarle el sitio y avisarla.',
  '- Quien busca una sesión (posible clienta) quiere que la traten, no aprender.',
  '',
  'Reglas para los mensajes:',
  '- Escribe como Sorela: primera persona, de tú, cercana y directa, español de España. Sin emojis salvo uno como mucho en WhatsApp. Sin frases hechas de marketing.',
  '- WhatsApp: corto, 2 a 4 frases, que se lea en el móvil. Termina con una pregunta fácil de contestar.',
  '- Correo: asunto breve y un cuerpo de 4 a 8 frases. Firma «Sorela».',
  '- Nunca prometas resultados de salud ni de pérdida de peso, ni digas que cura o trata enfermedades.',
  '- No inventes nada que no esté en los datos: si no sabes algo de la persona, no lo supongas.',
  '- Usa solo el nombre de pila.',
].join('\n');

function describir(c: ContactoIA) {
  return [
    `id: ${c.id}`,
    `nombre: ${c.nombre}`,
    `qué busca: ${ETIQUETA_TIPO[c.tipo]} — ${QUE_QUIERE[c.tipo]}`,
    `cómo llegó: ${COMO_LLEGO[c.origen] ?? c.origen}`,
    c.ciudad && `ciudad: ${c.ciudad}`,
    c.perfil && `perfil: ${c.perfil}`,
    c.nota && `lo que escribió: «${c.nota}»`,
    `estado: ${c.estado}`,
    `lleva: ${c.dias === 0 ? 'desde hoy' : `${c.dias} día${c.dias === 1 ? '' : 's'}`}`,
    c.seguimiento.length > 0 && `notas de Sorela: ${c.seguimiento.slice(0, 3).join(' | ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const Resumen = z.object({
  saludo: z.string().describe('Una frase para Sorela que resume cómo va el día, con cifras si ayudan.'),
  prioridades: z
    .array(
      z.object({
        id: z.string().describe('El id exacto del contacto.'),
        porque: z.string().describe('Por qué va primero, en una frase corta.'),
        accion: z.string().describe('Qué hacer, empezando por un verbo: «Escríbele por WhatsApp…».'),
      })
    )
    .describe('Como mucho 5, la más urgente primero.'),
  consejo: z.string().describe('Un consejo práctico para hoy, en una frase. Puede estar vacío.'),
});

export type ResultadoResumen = z.infer<typeof Resumen>;

const Mensaje = z.object({
  asunto: z.string().describe('Solo para correo; vacío en WhatsApp.'),
  texto: z.string(),
});

export type ResultadoMensaje = z.infer<typeof Mensaje>;

/* Opus 5.5 puede declinar una petición por sus filtros de seguridad. Con
   `fallbacks: 'default'` la API la reintenta sola con otro modelo dentro de la
   misma llamada, y aquí no hay que hacer nada más. */
const RESPALDO: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: 'default' } = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
};

export async function resumirDia(contactos: ContactoIA[], hoy: string): Promise<ResultadoResumen> {
  const respuesta = await anthropic().beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    ...RESPALDO,
    output_config: { effort: 'low', format: betaZodOutputFormat(Resumen) },
    system: SISTEMA,
    messages: [
      {
        role: 'user',
        content: [
          `Hoy es ${hoy}. Estos son los contactos que aún no están cerrados ni descartados, el más reciente primero:`,
          '',
          contactos.map(describir).join('\n\n') || '(ninguno)',
          '',
          'Dime a quién escribir primero. Prioriza: quien lleva más días sin respuesta, quien escribió algo concreto, y quien está más cerca de comprar (lista de la Comunidad antes de la apertura, alumnas que preguntan por fechas). Usa los id exactos.',
        ].join('\n'),
      },
    ],
  });
  if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) {
    throw new Error('sin-respuesta');
  }
  const ids = new Set(contactos.map((c) => c.id));
  const salida = respuesta.parsed_output;
  return { ...salida, prioridades: salida.prioridades.filter((p) => ids.has(p.id)).slice(0, 5) };
}

export async function redactarMensaje(
  c: ContactoIA,
  canal: 'whatsapp' | 'correo',
  hoy: string
): Promise<ResultadoMensaje> {
  const respuesta = await anthropic().beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    ...RESPALDO,
    output_config: { effort: 'low', format: betaZodOutputFormat(Mensaje) },
    system: SISTEMA,
    messages: [
      {
        role: 'user',
        content: [
          `Hoy es ${hoy}. Prepárame un ${canal === 'whatsapp' ? 'WhatsApp' : 'correo'} para esta persona:`,
          '',
          describir(c),
          '',
          canal === 'whatsapp' ? 'Deja el asunto vacío.' : 'Pon un asunto.',
        ].join('\n'),
      },
    ],
  });
  if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) {
    throw new Error('sin-respuesta');
  }
  return respuesta.parsed_output;
}

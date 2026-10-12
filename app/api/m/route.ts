import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { baseDeDatos, hayFirebase } from '@/lib/firebase-servidor';
import {
  COLECCION_DIAS,
  COLECCION_VIDEOS,
  claveLimpia,
  diaDe,
  dispositivoDe,
  esRobot,
  horaDe,
  origenDe,
  rutaLimpia,
} from '@/lib/metricas';

/**
 * Donde llegan las métricas de la web (ver lib/metricas.ts y components/Medidor.tsx).
 *
 *   POST { t: 'vista', ruta, ref, utm, nueva }
 *   POST { t: 'video', id, nombre, ruta, evento: 'play' | 25 | 50 | 75 | 100, segundos }
 *
 * Contesta siempre 204 y no dice nada más: es un buzón, no una API. Si algo
 * no cuadra, se ignora en silencio.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROPIO = 'sorelacarodivine.com';
const SAL = process.env.METRICAS_SAL || process.env.FIREBASE_PROYECTO_ID || 'divine';
const nada = () => new NextResponse(null, { status: 204 });

/* Freno por IP: nadie navega a más de 120 páginas por minuto. */
const HUELLAS = new Map<string, number[]>();
function demasiado(ip: string) {
  const ahora = Date.now();
  const p = (HUELLAS.get(ip) ?? []).filter((t) => ahora - t < 60_000);
  p.push(ahora);
  HUELLAS.set(ip, p);
  if (HUELLAS.size > 2000) HUELLAS.clear();
  return p.length > 120;
}

export async function POST(peticion: Request) {
  if (!hayFirebase()) return nada();
  const ua = peticion.headers.get('user-agent') ?? '';
  if (esRobot(ua)) return nada();
  const ip = peticion.headers.get('x-forwarded-for')?.split(',')[0].trim() || peticion.headers.get('x-real-ip') || '';
  if (demasiado(ip || 'sin-ip')) return nada();

  let c: Record<string, unknown>;
  try {
    c = JSON.parse(await peticion.text());
  } catch {
    return nada();
  }

  const dia = diaDe();
  const db = baseDeDatos();
  const refDia = db.collection(COLECCION_DIAS).doc(dia);

  try {
    if (c.t === 'vista') {
      const ruta = rutaLimpia(String(c.ruta ?? '/'));
      if (ruta.startsWith('/plataforma') || ruta.startsWith('/api')) return nada();
      const origen = origenDe(String(c.ref ?? ''), String(c.utm ?? ''), PROPIO);
      const pais = (peticion.headers.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 2);
      let ciudad = '';
      try {
        ciudad = decodeURIComponent(peticion.headers.get('x-vercel-ip-city') || '');
      } catch {
        /* sin ciudad */
      }
      const nueva = c.nueva === true;

      /* Personas distintas del día: un resumen de IP + navegador + día que
         no se puede deshacer. Si ya existía, no se cuenta otra vez. */
      let persona = false;
      if (nueva && ip) {
        const h = createHash('sha256').update(`${SAL}|${dia}|${ip}|${ua}`).digest('hex').slice(0, 24);
        persona = await refDia
          .collection('personas')
          .doc(h)
          .create({ en: FieldValue.serverTimestamp() })
          .then(() => true)
          .catch(() => false);
      }

      const uno = FieldValue.increment(1);
      await refDia.set(
        {
          dia,
          vistas: uno,
          ...(nueva ? { visitas: uno } : {}),
          ...(persona ? { personas: uno } : {}),
          rutas: { [claveLimpia(ruta)]: uno },
          horas: { [horaDe()]: uno },
          ...(nueva
            ? {
                dispositivos: { [dispositivoDe(ua)]: uno },
                ...(origen ? { origenes: { [claveLimpia(origen)]: uno } } : {}),
                ...(pais ? { paises: { [claveLimpia(pais)]: uno } } : {}),
                ...(ciudad ? { ciudades: { [claveLimpia(`${ciudad}${pais ? `, ${pais}` : ''}`)]: uno } } : {}),
                entradas: { [claveLimpia(ruta)]: uno },
              }
            : {}),
        },
        { merge: true }
      );
      return nada();
    }

    if (c.t === 'video') {
      const id = claveLimpia(String(c.id ?? ''), 80);
      if (!id || id === '—') return nada();
      const evento = String(c.evento ?? '');
      const segundos = Math.max(0, Math.min(3600, Math.round(Number(c.segundos) || 0)));
      const uno = FieldValue.increment(1);
      const datos: Record<string, unknown> = {
        nombre: claveLimpia(String(c.nombre ?? id), 80),
        ruta: rutaLimpia(String(c.ruta ?? '/')),
        actualizado: FieldValue.serverTimestamp(),
      };
      if (evento === 'play') datos.reproducciones = uno;
      else if (['25', '50', '75', '100'].includes(evento)) datos.cuartiles = { [evento]: uno };
      if (segundos) datos.segundos = FieldValue.increment(segundos);
      if (Number(c.duracion) > 0) datos.duracion = Math.round(Number(c.duracion));
      await db.collection(COLECCION_VIDEOS).doc(id).set(datos, { merge: true });
      if (evento === 'play' || segundos) {
        await refDia.set(
          {
            dia,
            ...(evento === 'play' ? { reproducciones: uno } : {}),
            ...(segundos ? { segundosVideo: FieldValue.increment(segundos) } : {}),
          },
          { merge: true }
        );
      }
      return nada();
    }
  } catch (e) {
    console.error('[metricas] no se ha podido apuntar', e);
  }
  return nada();
}

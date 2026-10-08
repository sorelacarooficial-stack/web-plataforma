import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { baseDeDatos, hayFirebase, COLECCIONES } from '@/lib/firebase-servidor';
import { sesionActual } from '@/lib/sesion-servidor';
import { tipoDeOrigen, TIPOS, type Tipo } from '@/lib/origenes';
import {
  hayIA,
  nombreDePila,
  redactarMensaje,
  resumirDia,
  type ContactoIA,
} from '@/lib/ia-panel';

/**
 * La IA del panel de Sorela. Ver lib/ia-panel.ts.
 *
 *   GET                                   → si está encendida
 *   POST { tipo: 'resumen' }              → a quién escribir hoy
 *   POST { tipo: 'mensaje', id, canal }   → un borrador para esa persona
 *
 * Los contactos se leen aquí, en el servidor, y no se fían de lo que mande el
 * navegador: así nadie puede colar texto en el resumen ni pedir un mensaje
 * sobre alguien que no está en la base de datos.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function soloSorela() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ ok: false, motivo: 'sin-sesion' }, { status: 401 });
  if (sesion.rol !== 'sorela') return NextResponse.json({ ok: false, motivo: 'sin-permiso' }, { status: 403 });
  return null;
}

const hoyEnEspana = () =>
  new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

function aContactoIA(id: string, v: FirebaseFirestore.DocumentData): ContactoIA {
  const creado: Date | undefined = v.creado?.toDate?.();
  return {
    id,
    nombre: nombreDePila(String(v.nombre ?? '')),
    tipo: TIPOS.includes(v.tipoManual) ? (v.tipoManual as Tipo) : tipoDeOrigen(v.origen),
    origen: String(v.origen ?? 'web'),
    ciudad: String(v.ciudad ?? ''),
    perfil: String(v.perfil ?? ''),
    nota: String(v.nota ?? '').slice(0, 500),
    estado: String(v.estado ?? 'Nuevo'),
    dias: creado ? Math.max(0, Math.floor((Date.now() - creado.getTime()) / 86400000)) : 0,
    seguimiento: Array.isArray(v.seguimiento)
      ? v.seguimiento.map((n: { texto?: string }) => String(n?.texto ?? '').slice(0, 200)).filter(Boolean)
      : [],
  };
}

export async function GET() {
  const fuera = await soloSorela();
  if (fuera) return fuera;
  return NextResponse.json({ ok: true, activa: hayIA() });
}

export async function POST(peticion: Request) {
  const fuera = await soloSorela();
  if (fuera) return fuera;
  if (!hayIA()) return NextResponse.json({ ok: false, motivo: 'sin-clave' }, { status: 503 });
  if (!hayFirebase()) return NextResponse.json({ ok: false, motivo: 'sin-base' }, { status: 503 });

  let cuerpo: { tipo?: string; id?: string; canal?: string };
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
  }

  const contactos = baseDeDatos().collection(COLECCIONES.contactos);

  try {
    if (cuerpo.tipo === 'resumen') {
      const lista = await contactos.orderBy('creado', 'desc').limit(60).get();
      const abiertos = lista.docs
        .map((d) => aContactoIA(d.id, d.data()))
        .filter((c) => c.estado !== 'Cerrado' && c.estado !== 'Descartado');
      const resumen = await resumirDia(abiertos, hoyEnEspana());
      return NextResponse.json({ ok: true, ...resumen });
    }

    if (cuerpo.tipo === 'mensaje') {
      const id = String(cuerpo.id ?? '').slice(0, 300);
      const canal = cuerpo.canal === 'correo' ? 'correo' : 'whatsapp';
      if (!id) return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
      const doc = await contactos.doc(id).get();
      if (!doc.exists) return NextResponse.json({ ok: false, motivo: 'no-existe' }, { status: 404 });
      const mensaje = await redactarMensaje(aContactoIA(doc.id, doc.data() ?? {}), canal, hoyEnEspana());
      return NextResponse.json({ ok: true, canal, ...mensaje });
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ ok: false, motivo: 'ocupada' }, { status: 429 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[ia-panel] la clave de Anthropic no es válida');
      return NextResponse.json({ ok: false, motivo: 'clave' }, { status: 502 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error('[ia-panel] Anthropic ha respondido', error.status, error.message);
      return NextResponse.json({ ok: false, motivo: 'ia' }, { status: 502 });
    }
    console.error('[ia-panel]', error);
    return NextResponse.json({ ok: false, motivo: 'ia' }, { status: 502 });
  }

  return NextResponse.json({ ok: false, motivo: 'datos' }, { status: 400 });
}

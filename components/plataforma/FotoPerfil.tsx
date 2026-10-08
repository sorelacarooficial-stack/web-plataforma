'use client';

import { useEffect, useRef, useState } from 'react';
import css from './plataforma.module.css';
import f from './foto.module.css';

/**
 * El avatar de arriba a la derecha, con foto.
 *
 * Al tocarlo se abre un menú pequeño para subir una foto o quitarla. La foto se
 * recorta en cuadrado por el centro y se reduce a 256 px en el propio móvil
 * antes de subirla: una foto de cámara pesa varios megas y aquí se ve del
 * tamaño de un botón.
 */

const LADO = 256;

async function prepararFoto(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('imagen'));
      i.src = url;
    });
    const corte = Math.min(img.naturalWidth, img.naturalHeight);
    // Un poco por encima del centro: en un retrato la cara suele estar arriba.
    const x = (img.naturalWidth - corte) / 2;
    const y = Math.max(0, (img.naturalHeight - corte) * 0.3);
    const lienzo = document.createElement('canvas');
    lienzo.width = LADO;
    lienzo.height = LADO;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('lienzo');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, corte, corte, 0, 0, LADO, LADO);
    const webp = lienzo.toDataURL('image/webp', 0.85);
    // Safari antiguo no sabe hacer webp y devuelve png: entonces, jpeg.
    return webp.startsWith('data:image/webp') ? webp : lienzo.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FotoPerfil({
  foto: inicial,
  iniciales,
  nombre,
}: {
  foto: string | null;
  iniciales: string;
  nombre: string;
}) {
  const [foto, setFoto] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const avisar = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso(''), 3500);
  };

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) return avisar('Elige una imagen.');
    setSubiendo(true);
    setAbierto(false);
    try {
      const imagen = await prepararFoto(archivo);
      const r = await fetch('/api/perfil/foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen }),
      });
      if (!r.ok) throw new Error('subida');
      setFoto(imagen);
    } catch {
      avisar('No se ha podido guardar la foto. Prueba con otra.');
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const quitar = async () => {
    setAbierto(false);
    const r = await fetch('/api/perfil/foto', { method: 'DELETE' }).catch(() => null);
    if (r?.ok) setFoto(null);
    else avisar('No se ha podido quitar la foto.');
  };

  return (
    <div className={f.caja} ref={caja}>
      <button
        type="button"
        className={`${css.usuario} ${f.boton}`}
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Tu foto de perfil"
      >
        <span className={`${css.avatar} ${css.avatarSm} ${f.avatar}`}>
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className={f.img} />
          ) : (
            iniciales
          )}
          {subiendo && <span className={f.cargando} aria-hidden="true" />}
          <span className={f.camara} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </span>
        </span>
        <span className={css.usuarioNombre}>{nombre}</span>
      </button>

      {abierto && (
        <div className={f.menu} role="menu">
          <button type="button" role="menuitem" className={f.opcion} onClick={() => entrada.current?.click()}>
            {foto ? 'Cambiar foto' : 'Poner foto'}
          </button>
          {foto && (
            <button type="button" role="menuitem" className={f.opcion} onClick={quitar}>
              Quitar foto
            </button>
          )}
        </div>
      )}

      <input
        ref={entrada}
        id="foto-perfil"
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => elegir(e.target.files?.[0])}
      />

      {aviso && (
        <p className={f.aviso} role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}

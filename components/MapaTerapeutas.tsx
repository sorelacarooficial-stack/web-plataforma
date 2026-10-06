'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terapeuta } from '@/lib/terapeutas';
import css from './MapaTerapeutas.module.css';

/**
 * El mapa de las terapeutas, como un globo en 3D.
 *
 * POR QUÉ UN GLOBO Y NO UN MAPA DE ESPAÑA. Sorela forma en España,
 * Latinoamérica, Estados Unidos y Europa, y sus terapeutas van a estar en
 * todos esos sitios. Un mapa de la península dejaba fuera a media red; un
 * globo la enseña entera y, al buscar una ciudad, vuela hasta ella.
 *
 * CÓMO SE DIBUJA. En un lienzo, a mano, sin librerías de 3D. La tierra es una
 * nube de puntos de luz —ver `scripts/preparar-globo.mjs`— proyectados con la
 * proyección ortográfica, que es la de una esfera vista desde lejos. Cada
 * punto se ilumina según lo de frente que esté: los del centro brillan, los
 * del borde se apagan, y eso es lo que da la sensación de volumen. Una
 * librería de 3D pesaría diez veces más para hacer lo mismo.
 *
 * LAS PARTÍCULAS. Tres capas: estrellas que titilan detrás, polvo dorado que
 * orbita alrededor del globo —con profundidad: el que pasa por detrás se
 * esconde— y un pulso en cada consulta. Con «reducir movimiento» activado en
 * el sistema, todo se queda quieto: ni giro solo, ni polvo, ni pulsos.
 *
 * SE MANEJA con el dedo o el ratón: arrastrar gira, la rueda o el pellizco
 * acercan, y los botones + y − también. Si nadie lo toca, gira despacio solo.
 * Fuera de la pantalla no se dibuja nada.
 *
 * Los puntos de las terapeutas son botones de verdad, colocados encima del
 * lienzo: se llega a ellos con el tabulador y un lector de pantalla los lee.
 */

type Props = {
  terapeutas: Terapeuta[];
  /** Slugs que pasan el filtro; el resto se apagan sin desaparecer. */
  visibles: Set<string>;
  onVerPerfil: (slug: string) => void;
};

const RAD = Math.PI / 180;

/** Dónde mira el globo al empezar: la península, que es donde está Sorela. */
const INICIO = { lng: -3.7, lat: 38 };

/**
 * Lo más que se acerca. Más allá, la trama de puntos de la tierra se queda
 * tan abierta que deja de leerse como un mapa: se ven puntos sueltos.
 */
const ZOOM_MAX = 4.2;

/** La caja de España y Portugal: sus puntos se pintan en dorado. */
function enPeninsula(lng: number, lat: number) {
  return lng > -9.6 && lng < 4.4 && lat > 35.9 && lat < 43.9;
}

type Vista = { lng: number; lat: number; k: number };

export default function MapaTerapeutas({ terapeutas, visibles, onVerPerfil }: Props) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const pinesRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  /* La vista se guarda en un ref y no en estado: cambia sesenta veces por
     segundo mientras gira, y pasarla por React repintaría todo el componente
     en cada fotograma. Solo lo que React de verdad pinta va en estado. */
  const vista = useRef<Vista>({ lng: INICIO.lng - 70, lat: 20, k: 1 });
  const destino = useRef<Vista | null>({ ...INICIO, k: 1.15 });
  const inercia = useRef({ lng: 0, lat: 0 });
  const tocado = useRef(0);
  const quieto = useRef(false);
  const visiblesRef = useRef(visibles);
  visiblesRef.current = visibles;

  const [tierra, setTierra] = useState<Float32Array | null>(null);
  const [error, setError] = useState(false);
  const [activo, setActivo] = useState<Terapeuta | null>(null);
  const [fichaPos, setFichaPos] = useState<{ x: number; y: number } | null>(null);
  const activoRef = useRef<Terapeuta | null>(null);
  activoRef.current = activo;

  /* ---------- La tierra ---------- */
  useEffect(() => {
    let vivo = true;
    fetch('/geo/tierra-puntos.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: number[]) => vivo && setTierra(Float32Array.from(d)))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    quieto.current = m.matches;
    if (m.matches) {
      vista.current = { ...INICIO, k: 1.15 };
      destino.current = null;
    }
  }, []);

  /* ---------- El dibujo ---------- */
  useEffect(() => {
    const lienzo = lienzoRef.current;
    const caja = cajaRef.current;
    if (!lienzo || !caja || !tierra) return;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return;

    /* Lo que no cambia de un fotograma a otro se calcula una sola vez: senos
       y cosenos de cada punto de tierra. En el bucle solo quedan sumas y
       productos, y así gira suave también en un móvil. */
    const n = tierra.length / 2;
    const sinLat = new Float32Array(n);
    const cosLat = new Float32Array(n);
    const sinLng = new Float32Array(n);
    const cosLng = new Float32Array(n);
    const dorado = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const lng = tierra[i * 2] * RAD;
      const lat = tierra[i * 2 + 1] * RAD;
      sinLat[i] = Math.sin(lat);
      cosLat[i] = Math.cos(lat);
      sinLng[i] = Math.sin(lng);
      cosLng[i] = Math.cos(lng);
      dorado[i] = enPeninsula(tierra[i * 2], tierra[i * 2 + 1]) ? 1 : 0;
    }

    /* Las estrellas del fondo: posición, tamaño y su propio ritmo de titilar. */
    const estrellas = Array.from({ length: 150 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.1 + 0.25,
      fase: Math.random() * Math.PI * 2,
      ritmo: 0.6 + Math.random() * 1.6,
    }));

    /* El polvo dorado: partículas en una cáscara un poco mayor que el globo,
       cada una con su órbita. Se proyectan igual que la tierra, así que al
       girar el globo giran con él y las de detrás quedan tapadas. */
    const polvo = Array.from({ length: 90 }, () => ({
      lng: Math.random() * 360,
      lat: (Math.random() - 0.5) * 140,
      alto: 1.08 + Math.random() * 0.32,
      vel: (0.6 + Math.random() * 2.4) * (Math.random() < 0.5 ? -1 : 1),
      r: Math.random() * 1.4 + 0.5,
    }));

    /* La tipografía de la web, tal como la ha resuelto el navegador: un lienzo
       no entiende variables de CSS, así que hay que darle el nombre real. */
    const tipografia = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

    let ancho = 0;
    let alto = 0;
    const medir = () => {
      const r = caja.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = r.width;
      alto = r.height;
      lienzo.width = Math.round(ancho * dpr);
      lienzo.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(caja);

    let enPantalla = true;
    const vigia = new IntersectionObserver(([e]) => (enPantalla = e.isIntersecting), { threshold: 0 });
    vigia.observe(caja);

    let cuadro = 0;
    let antes = performance.now();

    const pintar = (ahora: number) => {
      cuadro = requestAnimationFrame(pintar);
      if (!enPantalla) return;
      const dt = Math.min(0.05, (ahora - antes) / 1000);
      antes = ahora;
      const t = ahora / 1000;
      const v = vista.current;

      /* --- El movimiento: vuelo a un destino, inercia, o giro lento. --- */
      if (destino.current) {
        const d = destino.current;
        let dl = d.lng - v.lng;
        dl = ((dl + 540) % 360) - 180;
        const f = 1 - Math.pow(0.0025, dt);
        v.lng += dl * f;
        v.lat += (d.lat - v.lat) * f;
        v.k += (d.k - v.k) * f;
        if (Math.abs(dl) < 0.05 && Math.abs(d.lat - v.lat) < 0.05 && Math.abs(d.k - v.k) < 0.002) destino.current = null;
      } else if (Math.abs(inercia.current.lng) > 0.01 || Math.abs(inercia.current.lat) > 0.01) {
        v.lng += inercia.current.lng;
        v.lat = Math.max(-70, Math.min(80, v.lat + inercia.current.lat));
        inercia.current.lng *= 0.92;
        inercia.current.lat *= 0.92;
      } else if (!quieto.current && !activoRef.current && ahora - tocado.current > 3500) {
        v.lng += 4 * dt;
      }

      const R = Math.min(ancho, alto) * 0.42 * v.k;
      const cx = ancho / 2;
      const cy = alto / 2;
      const lat0 = v.lat * RAD;
      const sinL0 = Math.sin(lat0);
      const cosL0 = Math.cos(lat0);
      const lng0 = v.lng * RAD;
      const sin0 = Math.sin(lng0);
      const cos0 = Math.cos(lng0);

      /** Proyecta un punto: devuelve [x, y, z]; z > 0 es la cara de delante. */
      const proyectar = (lng: number, lat: number, altura = 1): [number, number, number] => {
        const la = lat * RAD;
        const dl = (lng - v.lng) * RAD;
        const cl = Math.cos(la);
        const x = cl * Math.sin(dl);
        const y = cosL0 * Math.sin(la) - sinL0 * cl * Math.cos(dl);
        const z = sinL0 * Math.sin(la) + cosL0 * cl * Math.cos(dl);
        return [cx + R * altura * x, cy - R * altura * y, z];
      };

      ctx.clearRect(0, 0, ancho, alto);

      /* --- Estrellas --- */
      ctx.fillStyle = '#f3e3c3';
      for (const s of estrellas) {
        const a = quieto.current ? 0.5 : 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.ritmo + s.fase));
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x * ancho, s.y * alto, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* --- La atmósfera: un halo dorado que se apaga hacia fuera. --- */
      const halo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
      halo.addColorStop(0, 'rgba(217, 180, 124, 0.32)');
      halo.addColorStop(0.35, 'rgba(217, 180, 124, 0.1)');
      halo.addColorStop(1, 'rgba(217, 180, 124, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.28, 0, Math.PI * 2);
      ctx.fill();

      /* --- El cuerpo del globo, con la luz viniendo de arriba a la izquierda. --- */
      const cuerpo = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      cuerpo.addColorStop(0, '#2a2319');
      cuerpo.addColorStop(0.6, '#15120e');
      cuerpo.addColorStop(1, '#0b0a08');
      ctx.fillStyle = cuerpo;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      /* --- El polvo de detrás del globo, antes de la tierra para que quede tapado. --- */
      const dibujarPolvo = (delante: boolean) => {
        for (const p of polvo) {
          if (!quieto.current) p.lng += p.vel * dt;
          const [x, y, z] = proyectar(p.lng, p.lat, p.alto);
          const detras = z < 0;
          if (detras === delante) continue;
          /* Por detrás solo se ve lo que asoma fuera del disco. */
          if (detras && Math.hypot(x - cx, y - cy) < R) continue;
          ctx.globalAlpha = detras ? 0.25 : 0.55 + 0.4 * z;
          ctx.fillStyle = '#e3c696';
          ctx.beginPath();
          ctx.arc(x, y, p.r * (detras ? 0.7 : 1), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
      dibujarPolvo(false);

      /* --- La tierra en puntos --- */
      /* El tamaño de cada punto crece con el globo, pero con techo: los puntos
         están a unos 0,9° unos de otros, y si crecieran sin límite al acercar
         se convertirían en cuadrados que se tocan. Pequeños y separados se
         siguen leyendo como una trama de luz. */
      const lado = Math.min(2.6, Math.max(1.1, R * 0.0105));
      for (let i = 0; i < n; i++) {
        const sdl = sinLng[i] * cos0 - cosLng[i] * sin0;
        const cdl = cosLng[i] * cos0 + sinLng[i] * sin0;
        const cl = cosLat[i];
        const z = sinL0 * sinLat[i] + cosL0 * cl * cdl;
        if (z <= 0.02) continue;
        const x = cx + R * cl * sdl;
        const y = cy - R * (cosL0 * sinLat[i] - sinL0 * cl * cdl);
        if (x < -4 || x > ancho + 4 || y < -4 || y > alto + 4) continue;
        if (dorado[i]) {
          ctx.fillStyle = '#e8c88f';
          ctx.globalAlpha = 0.45 + 0.55 * z;
        } else {
          ctx.fillStyle = '#d9cbb3';
          ctx.globalAlpha = 0.12 + 0.5 * z * z;
        }
        ctx.fillRect(x - lado / 2, y - lado / 2, lado, lado);
      }
      ctx.globalAlpha = 1;

      /* --- El borde del globo: una línea de luz finísima. --- */
      ctx.strokeStyle = 'rgba(227, 198, 150, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      dibujarPolvo(true);

      /* --- Las consultas: un punto que brilla y un pulso que se abre. --- */
      ctx.font = `500 12px ${tipografia}`;
      ctx.textBaseline = 'middle';
      for (const tp of terapeutas) {
        const [x, y, z] = proyectar(tp.lng, tp.lat);
        const boton = pinesRef.current.get(tp.slug);
        if (z <= 0.05) {
          if (boton) boton.style.visibility = 'hidden';
          continue;
        }
        const on = visiblesRef.current.has(tp.slug);
        if (boton) {
          boton.style.visibility = 'visible';
          boton.style.transform = `translate(${x - 18}px, ${y - 18}px)`;
        }
        if (on && !quieto.current) {
          /* El resto se normaliza a [0, 1): con longitudes negativas —todo lo
             que está al oeste de Greenwich, América entera— el % de JavaScript
             da negativo, y un radio negativo hace fallar el dibujo. */
          const fase = (((t * 0.7 + tp.lng * 0.01) % 1) + 1) % 1;
          ctx.strokeStyle = `rgba(217, 180, 124, ${0.6 * (1 - fase)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 6 + fase * 22, 0, Math.PI * 2);
          ctx.stroke();
        }
        const brillo = ctx.createRadialGradient(x, y, 0, x, y, 14);
        brillo.addColorStop(0, on ? 'rgba(255, 236, 200, 0.95)' : 'rgba(200, 190, 175, 0.4)');
        brillo.addColorStop(1, 'rgba(217, 180, 124, 0)');
        ctx.fillStyle = brillo;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = on ? '#fff6e6' : '#9d958a';
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fill();
        if (z > 0.35 && v.k > 1.6) {
          ctx.globalAlpha = on ? 0.95 : 0.45;
          ctx.fillStyle = '#f3e3c3';
          ctx.fillText(tp.ciudad, x + 12, y);
          ctx.globalAlpha = 1;
        }
      }

      /* La ficha sigue a su punto mientras el globo se acomoda. */
      const a = activoRef.current;
      if (a) {
        const [x, y, z] = proyectar(a.lng, a.lat);
        if (z > 0.05) setFichaPos((prev) => (prev && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5 ? prev : { x, y }));
      }
    };
    cuadro = requestAnimationFrame(pintar);

    return () => {
      cancelAnimationFrame(cuadro);
      ro.disconnect();
      vigia.disconnect();
    };
  }, [tierra, terapeutas]);

  /* ---------- Arrastrar, acercar ---------- */
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const pellizco = useRef<number | null>(null);

  const alBajar = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    destino.current = null;
    inercia.current = { lng: 0, lat: 0 };
    tocado.current = performance.now();
    if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()];
      pellizco.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const alMover = (e: React.PointerEvent) => {
    const previo = punteros.current.get(e.pointerId);
    if (!previo) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tocado.current = performance.now();
    const v = vista.current;

    if (punteros.current.size === 2 && pellizco.current) {
      const [a, b] = [...punteros.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      v.k = Math.max(0.8, Math.min(ZOOM_MAX, v.k * (d / pellizco.current)));
      pellizco.current = d;
      return;
    }

    const caja = cajaRef.current;
    if (!caja) return;
    const R = Math.min(caja.clientWidth, caja.clientHeight) * 0.42 * v.k;
    const grados = 57.3 / R;
    const dl = -(e.clientX - previo.x) * grados;
    const dla = (e.clientY - previo.y) * grados;
    v.lng += dl;
    v.lat = Math.max(-70, Math.min(80, v.lat + dla));
    inercia.current = { lng: dl, lat: dla };
    if (activoRef.current) setActivo(null);
  };

  const alSubir = (e: React.PointerEvent) => {
    punteros.current.delete(e.pointerId);
    if (punteros.current.size < 2) pellizco.current = null;
  };

  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return;
    /* La rueda acerca y aleja el globo, no la página: va con `passive: false`
       para poder decirle al navegador que no haga scroll. */
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      destino.current = null;
      tocado.current = performance.now();
      const v = vista.current;
      v.k = Math.max(0.8, Math.min(ZOOM_MAX, v.k * Math.exp(-e.deltaY * 0.0015)));
    };
    caja.addEventListener('wheel', rueda, { passive: false });
    return () => caja.removeEventListener('wheel', rueda);
  }, []);

  const escalar = (f: number) => {
    const v = vista.current;
    destino.current = { lng: v.lng, lat: v.lat, k: Math.max(0.8, Math.min(ZOOM_MAX, v.k * f)) };
    tocado.current = performance.now();
  };

  const volver = () => {
    setActivo(null);
    destino.current = { ...INICIO, k: 1.15 };
    tocado.current = performance.now();
  };

  /* ---------- Al filtrar, volar hasta las que quedan ---------- */
  const firma = [...visibles].sort().join(',');
  const firmaPrev = useRef(firma);
  useEffect(() => {
    if (firma === firmaPrev.current) return;
    firmaPrev.current = firma;
    setActivo(null);
    const dentro = terapeutas.filter((t) => visibles.has(t.slug));
    if (!dentro.length) {
      destino.current = { ...INICIO, k: 1.15 };
      return;
    }
    const lng = dentro.reduce((s, t) => s + t.lng, 0) / dentro.length;
    const lat = dentro.reduce((s, t) => s + t.lat, 0) / dentro.length;
    const dispersion = Math.max(...dentro.map((t) => Math.hypot(t.lng - lng, t.lat - lat)), 0.5);
    const k = Math.max(1.1, Math.min(3.6, 38 / (dispersion + 4)));
    destino.current = { lng, lat, k };
    tocado.current = performance.now();
  }, [firma, visibles, terapeutas]);

  const abrir = useCallback((t: Terapeuta) => {
    setActivo(t);
    destino.current = { lng: t.lng, lat: t.lat, k: Math.max(vista.current.k, 2.8) };
    tocado.current = performance.now();
  }, []);

  /* ---------- Leyenda ---------- */
  const dentro = visibles.size;
  const leyenda =
    terapeutas.length === 0
      ? 'Las primeras terapeutas certificadas llegan pronto'
      : dentro === terapeutas.length
        ? `${terapeutas.length} ${terapeutas.length === 1 ? 'consulta certificada' : 'consultas certificadas'}`
        : dentro === 0
          ? 'Sin consultas con ese filtro'
          : `${dentro} ${dentro === 1 ? 'consulta' : 'consultas'} con ese filtro`;

  if (error) {
    return (
      <div ref={cajaRef} className={css.caja}>
        <p className={css.cargando}>No se ha podido cargar el mapa</p>
      </div>
    );
  }

  return (
    <div
      ref={cajaRef}
      className={css.caja}
      onPointerDown={alBajar}
      onPointerMove={alMover}
      onPointerUp={alSubir}
      onPointerCancel={alSubir}
    >
      <canvas
        ref={lienzoRef}
        className={css.lienzo}
        role="img"
        aria-label={
          terapeutas.length === 0
            ? 'Globo terráqueo, todavía sin consultas'
            : 'Globo terráqueo con las consultas de las terapeutas Divine certificadas'
        }
      />

      {/* Los puntos, como botones de verdad encima del lienzo. Los coloca el
          bucle de dibujo en cada fotograma, sin pasar por React. */}
      {terapeutas.map((t) => (
        <button
          key={t.slug}
          type="button"
          ref={(b) => {
            if (b) pinesRef.current.set(t.slug, b);
            else pinesRef.current.delete(t.slug);
          }}
          className={css.pin}
          style={{ visibility: 'hidden' }}
          aria-label={`${t.nombre}, ${t.ciudad}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => abrir(t)}
        />
      ))}

      <div className={css.mandos}>
        <button type="button" onClick={() => escalar(1.5)} aria-label="Acercar">
          +
        </button>
        <button type="button" onClick={() => escalar(1 / 1.5)} aria-label="Alejar">
          −
        </button>
        <button type="button" onClick={volver} aria-label="Volver a España" title="Volver a España">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      <div className={css.leyenda}>
        <span className={css.leyendaPunto} aria-hidden="true" />
        {leyenda}
      </div>
      <div className={css.ayuda} aria-hidden="true">
        Arrastra para girar · rueda o pellizco para acercar
      </div>

      {!tierra && <div className={css.cargando}>Cargando el globo…</div>}

      {activo && fichaPos && (
        <div
          className={css.ficha}
          /* Con el punto pegado arriba, la ficha va debajo: encima se saldría
             por el borde y taparía justo el punto que se ha tocado. */
          data-abajo={fichaPos.y < 250 ? '' : undefined}
          style={{
            /* Acotada a la caja: centrada sobre su punto, pero sin salirse por
               los lados ni por arriba, donde el borde la cortaría. */
            left: Math.min(Math.max(fichaPos.x, 136), (cajaRef.current?.clientWidth ?? 400) - 136),
            top: fichaPos.y,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button type="button" className={css.fichaCerrar} aria-label="Cerrar" onClick={() => setActivo(null)}>
            ×
          </button>
          <h3>{activo.nombre}</h3>
          <p className={css.fichaCiudad}>{activo.ciudad} · certificada por Sorela</p>
          <p className={css.fichaDir}>{activo.direccion}</p>
          <p className={css.fichaTrat}>{activo.tratamientos.join(' · ')}</p>
          <button type="button" className={css.fichaVer} onClick={() => onVerPerfil(activo.slug)}>
            Ver perfil y reservar
          </button>
        </div>
      )}
    </div>
  );
}

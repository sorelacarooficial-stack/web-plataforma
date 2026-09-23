'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CambiarTema from '@/components/CambiarTema';
import Motas from '@/components/Motas';
import logo from '@/fotos/logo-sorela.png';
import type { Sesion } from '@/lib/sesion-servidor';
import { ETIQUETA_ROL } from '@/lib/roles';
import {
  ROLES,
  navDe,
  seccionDe,
  tituloDe,
  type Rol,
  type Vista,
} from '@/lib/plataforma';
/*
 * Solo se importa lo que se enruta. Las vistas de alumna y miembro —aula,
 * clases, clientas, agenda, ficha pública, facturación, pagos— siguen escritas
 * en `Vistas.tsx` y se volverán a enchufar aquí cuando haya algo real que
 * enseñar dentro. Hasta entonces, esos roles ven `Proximamente`.
 */
import { Comunidad, Contenido, FormacionesAdmin, PanelSorela } from './Vistas';
import Contactos from './Contactos';
import Proximamente from './Proximamente';
import AgendaSorela from './AgendaSorela';
import Cuentas from './Cuentas';
import FacturacionSorela from './FacturacionSorela';
import css from './plataforma.module.css';

/**
 * Plataforma privada.
 *
 * El rol llega ya resuelto desde el servidor, sacado de la cookie de sesión:
 * aquí no se decide nada sobre permisos, solo se pinta lo que toca. Si alguien
 * manipulase este estado desde el navegador vería otro menú, pero los datos
 * los sirve el servidor, que vuelve a mirar el rol de la cookie.
 *
 * El selector «ver como» solo lo ve Sorela, y es para que pueda recorrer las
 * tres vistas sin necesidad de tener tres cuentas.
 *
 * Dentro no hay datos inventados. Lo de Sorela es lo que existe de verdad
 * —los contactos salen de Firestore—, y alumnas y miembros ven una pantalla
 * que dice con claridad que su espacio está en preparación.
 */
export default function Plataforma({ sesion }: { sesion: Sesion }) {
  const router = useRouter();
  // Dos cosas distintas que conviene no confundir: `puedeVerComo` es el rol
  // REAL de quien ha entrado, y decide permisos; `esAdmin`, más abajo, es el
  // rol que se está MIRANDO, y solo decide qué se pinta.
  const puedeVerComo = sesion.rol === 'sorela';
  const [rol, setRol] = useState<Rol>(sesion.rol);
  const [vista, setVista] = useState<Vista>('inicio');
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Con el cajón abierto, la página de detrás no se desplaza.
  useEffect(() => {
    if (!menuAbierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', alPulsar);
    };
  }, [menuAbierto]);

  const menu = navDe(rol);
  // Si el rol cambia y la vista actual no existe en su menú, vuelve a Inicio.
  const actual = menu.some((n) => n.id === vista) ? vista : 'inicio';

  const esAdmin = rol === 'sorela';
  const esAlumna = rol === 'alumna';
  // El nombre sale de la cuenta con la que se ha entrado, no de la maqueta.
  // Si alguien entró con Google sin nombre configurado, se usa la parte del
  // correo anterior a la arroba antes que dejarlo en blanco.
  const usuario = sesion.nombre || sesion.correo?.split('@')[0] || 'Tu espacio';
  const iniciales =
    usuario
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] || '')
      .join('')
      .toUpperCase() || 'D';

  function ir(v: Vista) {
    setVista(v);
    setMenuAbierto(false);
    try {
      window.scrollTo(0, 0);
    } catch {
      /* da igual si el navegador no deja */
    }
  }

  const [saliendo, setSaliendo] = useState(false);

  async function salir() {
    setSaliendo(true);
    try {
      await fetch('/api/sesion', { method: 'DELETE' });
    } catch {
      // Sin red no se puede borrar la cookie del servidor, pero se sale
      // igualmente: es peor quedarse atrapada dentro.
    }
    // refresh() además de push(): sin él, Next puede servir la plataforma
    // desde su caché de cliente y parecería que la sesión sigue abierta.
    router.push('/');
    router.refresh();
  }

  function cambiarRol(nuevo: Rol) {
    // Solo Sorela puede mirar la plataforma con otros ojos. Para el resto, el
    // selector ni siquiera se pinta; esta comprobación es el segundo cierre.
    if (!puedeVerComo) return;
    setRol(nuevo);
    setVista('inicio');
    setMenuAbierto(false);
  }

  return (
    <div className={css.pantalla}>
      <Motas className={css.motas} />

      {/* Solo en móvil: logo y hamburguesa. En escritorio manda la lateral. */}
      <div className={css.barraMovil}>
        <span className={css.logo}>
          <Image src={logo} alt="Sorela Caro · Técnica Divine" sizes="160px" priority />
        </span>
        <button
          type="button"
          onClick={() => setMenuAbierto((a) => !a)}
          aria-expanded={menuAbierto}
          aria-controls="menu-plataforma"
          aria-label={menuAbierto ? 'Cerrar el menú' : 'Abrir el menú'}
          className={css.hamburguesa}
        >
          <span className={`${css.rayaMenu} ${menuAbierto ? css.rayaArribaX : ''}`} />
          <span className={`${css.rayaMenu} ${menuAbierto ? css.rayaMediaX : ''}`} />
          <span className={`${css.rayaMenu} ${menuAbierto ? css.rayaAbajoX : ''}`} />
        </button>
      </div>

      <div className={css.cuerpo}>
        {/* El velo va dentro de .cuerpo a propósito: .cuerpo crea contexto de
            apilamiento (z-index 1), así que un velo hermano taparía también al
            cajón por mucho z-index que este llevara. */}
        {menuAbierto && (
          <button
            type="button"
            className={css.velo}
            aria-label="Cerrar el menú"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        <aside
          id="menu-plataforma"
          className={`${css.lateral} ${menuAbierto ? css.lateralAbierta : ''}`}
        >
          <span className={css.logo}>
            <Image src={logo} alt="Sorela Caro · Técnica Divine" sizes="200px" priority />
          </span>

          {/* Con un único apartado, el menú sería un botón que dice dónde ya
              estás. Se calla y deja el aire para lo demás. */}
          <nav
            className={css.nav}
            aria-label="Secciones de la plataforma"
            hidden={menu.length < 2}
          >
            <p className={css.navTitulo}>General</p>
            {menu.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => ir(n.id)}
                aria-current={actual === n.id ? 'page' : undefined}
                className={`${css.navBoton} ${actual === n.id ? css.navActivo : ''}`}
              >
                <span className={css.navPunto} />
                <span className={css.navTexto}>{n.label}</span>
              </button>
            ))}
          </nav>

          <div className={css.pieLateral}>
            {puedeVerComo && (
              <>
                <p className={css.pieTitulo}>Ver como</p>
                <div className={css.roles}>
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => cambiarRol(r.id)}
                      aria-pressed={rol === r.id}
                      className={`${css.rol} ${rol === r.id ? css.rolActivo : ''}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <p className={css.quienEres}>
              {sesion.nombre || sesion.correo}
              <span>{ETIQUETA_ROL[sesion.rol]}</span>
            </p>
            <CambiarTema />
            <button type="button" className={css.salir} onClick={salir} disabled={saliendo}>
              {saliendo ? 'Saliendo…' : 'Salir'}
            </button>
          </div>
        </aside>

        <main className={css.principal}>
          <header className={css.cabecera}>
            {/* Alumnas y miembros no tienen título aquí: su pantalla trae el
                suyo, con su nombre. Se deja el hueco en blanco antes que
                pintar una línea vacía. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seccionDe(actual, rol) && (
                <p className={css.seccion}>{seccionDe(actual, rol)}</p>
              )}
              {tituloDe(actual, rol) && <h1 className={css.titulo}>{tituloDe(actual, rol)}</h1>}
            </div>
            <span className={css.usuario}>
              <span className={`${css.avatar} ${css.avatarSm}`}>{iniciales}</span>
              <span className={css.usuarioNombre}>{usuario}</span>
            </span>
          </header>

          {!esAdmin && <Proximamente rol={esAlumna ? 'alumna' : 'miembro'} nombre={usuario} />}

          {esAdmin && actual === 'inicio' && <PanelSorela ir={ir} />}
          {/* Contactos de verdad, leídos de Firestore. Antes aquí había una lista
              de leads inventados con nombres y notas de mentira. */}
          {esAdmin && actual === 'leads' && <Contactos />}
          {esAdmin && actual === 'formaciones' && <FormacionesAdmin />}
          {esAdmin && actual === 'contenido' && <Contenido />}
          {esAdmin && actual === 'agenda' && <AgendaSorela />}
          {esAdmin && actual === 'facturacion' && <FacturacionSorela />}
          {esAdmin && actual === 'cuentas' && <Cuentas />}
          {esAdmin && actual === 'comunidad' && <Comunidad rol={rol} ir={ir} iniciales={iniciales} />}
        </main>
      </div>
    </div>
  );
}

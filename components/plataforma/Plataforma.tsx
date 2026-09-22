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
import {
  Agenda,
  Aula,
  Clases,
  Clientas,
  Comunidad,
  Contenido,
  Facturacion,
  FacturacionAdmin,
  FormacionesAdmin,
  InicioAlumna,
  InicioMiembro,
  Leads,
  Pagos,
  PanelSorela,
  Perfil,
  Suscripcion,
} from './Vistas';
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
 * Las vistas siguen enseñando datos de maqueta: clientas, facturas y cursos
 * inventados. Lo que ya es real es quién entra y con qué rol.
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

          <nav className={css.nav} aria-label="Secciones de la plataforma">
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className={css.seccion}>{seccionDe(actual, rol)}</p>
              <h1 className={css.titulo}>{tituloDe(actual, rol)}</h1>
            </div>
            <span className={css.usuario}>
              <span className={`${css.avatar} ${css.avatarSm}`}>{iniciales}</span>
              <span className={css.usuarioNombre}>{usuario}</span>
            </span>
          </header>

          {actual === 'inicio' && esAlumna && <InicioAlumna rol={rol} ir={ir} />}
          {actual === 'inicio' && !esAlumna && !esAdmin && <InicioMiembro rol={rol} ir={ir} />}
          {actual === 'inicio' && esAdmin && <PanelSorela />}

          {actual === 'aula' && <Aula />}
          {actual === 'comunidad' && <Comunidad rol={rol} ir={ir} />}
          {actual === 'clases' && <Clases />}
          {actual === 'clientas' && <Clientas />}
          {actual === 'agenda' && <Agenda rol={rol} ir={ir} />}
          {actual === 'perfil' && <Perfil />}
          {actual === 'facturacion' && (esAdmin ? <FacturacionAdmin /> : <Facturacion />)}
          {actual === 'suscripcion' && <Suscripcion />}
          {actual === 'pagos' && <Pagos />}
          {actual === 'leads' && <Leads />}
          {actual === 'formaciones' && <FormacionesAdmin />}
          {actual === 'contenido' && <Contenido />}
        </main>
      </div>
    </div>
  );
}

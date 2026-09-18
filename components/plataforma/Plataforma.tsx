'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CambiarTema from '@/components/CambiarTema';
import Motas from '@/components/Motas';
import logo from '@/fotos/logo-sorela.png';
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
 * Plataforma privada, en modo maqueta.
 *
 * El selector "ver como" de la barra lateral cambia entre alumna, miembro
 * certificada y Sorela: cada rol tiene su propio menú y sus propias vistas.
 * Está a la vista a propósito, para que Sorela pueda recorrer las tres sin
 * tener tres cuentas. Cuando haya autenticación de verdad, el rol saldrá de
 * la sesión y este selector desaparece.
 */
export default function Plataforma() {
  const router = useRouter();
  const [rol, setRol] = useState<Rol>('miembro');
  const [vista, setVista] = useState<Vista>('inicio');

  const menu = navDe(rol);
  // Si el rol cambia y la vista actual no existe en su menú, vuelve a Inicio.
  const actual = menu.some((n) => n.id === vista) ? vista : 'inicio';

  const esAdmin = rol === 'sorela';
  const esAlumna = rol === 'alumna';
  const usuario = esAdmin ? 'Sorela Caro' : 'Marta Ibáñez';
  const iniciales = esAdmin ? 'SC' : 'MI';

  function ir(v: Vista) {
    setVista(v);
    try {
      window.scrollTo(0, 0);
    } catch {
      /* da igual si el navegador no deja */
    }
  }

  function cambiarRol(nuevo: Rol) {
    setRol(nuevo);
    setVista('inicio');
  }

  return (
    <div className={css.pantalla}>
      <Motas className={css.motas} />

      <div className={css.cuerpo}>
        <aside className={css.lateral}>
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
            <p className={css.pieTitulo}>Maqueta · ver como</p>
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
            <CambiarTema />
            <button type="button" className={css.salir} onClick={() => router.push('/')}>
              Salir
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

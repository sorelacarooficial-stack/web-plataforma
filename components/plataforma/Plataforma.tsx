'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Motas from '@/components/Motas';
import logo from '@/fotos/logo-sorela.png';
import type { Sesion } from '@/lib/sesion-servidor';
import { ETIQUETA_ROL } from '@/lib/roles';
import { CURSO_DIVINE, tieneMembresia, type Acceso } from '@/lib/accesos';

import {
  ROLES,
  grupoDe,
  gruposDe,
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
import { FormacionesAdmin, PanelSorela } from './Vistas';
import Comunidad from './Comunidad';
import FotoPerfil from './FotoPerfil';
import Avisos from './Avisos';
import Metricas from './Metricas';
import Correos from './Correos';
import Buzon from './Buzon';
import IconoNav from './IconoNav';
import Perfil from './Perfil';
import Celebracion from './Celebracion';
import Onboarding from './Onboarding';
import FichasMapa from './FichasMapa';
import { MarcadorPuntos } from './Puntos';
import PanelAlumna from './PanelAlumna';
import BlogAdmin from './BlogAdmin';
import Contactos from './Contactos';
import Acuerdos from './Acuerdos';
import Proximamente from './Proximamente';
import Aula from './Aula';
import SubirClases from './SubirClases';
import Agenda from './Agenda';
import Cuentas from './Cuentas';
import FacturacionSorela from './FacturacionSorela';
import css from './plataforma.module.css';

/* Lo que tiene la alumna que se simula con «Ver como». El nombre es el del
   curso de las clases subidas: así el aula enseña lo mismo que verá ella. */
const ACCESOS_DE_MUESTRA: Acceso[] = [{ tipo: 'curso', nombre: CURSO_DIVINE }];

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
export default function Plataforma({
  sesion,
  accesos,
  bienvenidaPendiente = false,
  vistaInicial = null,
}: {
  sesion: Sesion;
  /** Qué tiene contratado: lo lee el servidor y llega ya resuelto. */
  accesos: Acceso[];
  /** Si la bienvenida (perfil y ficha del mapa) tiene que abrirse sola al entrar. */
  bienvenidaPendiente?: boolean;
  /** La pantalla que pedía la dirección (?v=…). Se comprueba contra el menú. */
  vistaInicial?: string | null;
}) {
  const router = useRouter();
  // Dos cosas distintas que conviene no confundir: `puedeVerComo` es el rol
  // REAL de quien ha entrado, y decide permisos; `esAdmin`, más abajo, es el
  // rol que se está MIRANDO, y solo decide qué se pinta.
  const puedeVerComo = sesion.rol === 'sorela';
  const [rol, setRol] = useState<Rol>(sesion.rol);
  const [vista, setVista] = useState<Vista>((vistaInicial as Vista) || 'inicio');
  /* Dentro de cada grupo, la última pestaña que se abrió: volver a «Personas»
     te deja en Cuentas si estabas en Cuentas, no otra vez en Clientes. */
  const [ultimaDe, setUltimaDe] = useState<Record<string, Vista>>({});
  const [menuAbierto, setMenuAbierto] = useState(false);
  /* Su avatar vive aquí y no en el de la cabecera: la cabecera se vuelve a
     montar con cada pantalla y, si lo guardara ella, al cambiar de pantalla
     volvería la foto que leyó el servidor al entrar. */
  const [foto, setFoto] = useState(sesion.foto);

  // La bienvenida también sube el avatar y avisa con `divine:foto`.
  useEffect(() => {
    const alCambiarFoto = (e: Event) => {
      const d = (e as CustomEvent<unknown>).detail;
      setFoto(typeof d === 'string' && d.startsWith('data:image/') ? d : null);
    };
    window.addEventListener('divine:foto', alCambiarFoto);
    return () => window.removeEventListener('divine:foto', alCambiarFoto);
  }, []);

  /* En el móvil el menú es un cajón. Cerrado, solo se aparta con un
     transform: sin `inert`, sus botones seguían en el orden del tabulador y en
     lo que lee el lector de pantalla, invisibles. Mismo corte que el CSS. */
  const [esMovil, setEsMovil] = useState(false);
  const hamburguesa = useRef<HTMLButtonElement>(null);
  const cajon = useRef<HTMLElement>(null);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 880px)');
    const ver = () => setEsMovil(m.matches);
    ver();
    m.addEventListener('change', ver);
    return () => m.removeEventListener('change', ver);
  }, []);

  // Con el cajón abierto, la página de detrás no se desplaza.
  useEffect(() => {
    if (!menuAbierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // El foco entra en el cajón (su primer botón)…
    cajon.current?.querySelector<HTMLElement>('button:not([disabled]), a[href]')?.focus({ preventScroll: true });
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener('keydown', alPulsar);
      // …y al cerrarse vuelve a la hamburguesa, si se había quedado dentro (o perdido).
      const a = document.activeElement;
      if (!a || a === document.body || cajon.current?.contains(a)) hamburguesa.current?.focus({ preventScroll: true });
    };
  }, [menuAbierto]);

  /* El menú depende de lo que tenga contratado, no solo del rol: sin nada
     contratado no hay aula que enseñar. Al mirar «Ver como» desde el panel de
     Sorela se simula una alumna que ha comprado la formación, que es lo que
     Sorela quiere revisar: sus clases tal y como las verá quien pague. */
  const accesosVistos: Acceso[] = puedeVerComo ? ACCESOS_DE_MUESTRA : accesos;
  const menu = navDe(rol, accesosVistos.length > 0);
  const grupos = gruposDe(rol, accesosVistos.length > 0);
  // Si el rol cambia y la vista actual no existe en su menú, vuelve a Inicio.
  const actual = menu.some((n) => n.id === vista) ? vista : 'inicio';

  const esAdmin = rol === 'sorela';
  const grupoActual = grupoDe(grupos, actual);
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

  /* La pantalla va en la dirección (`/plataforma?v=leads`). Así funcionan el
     botón «atrás» del navegador y del móvil, recargar deja donde estabas y se
     puede guardar o compartir el enlace a una pantalla concreta. Se usa el
     history del navegador y no el router de Next: cambiar de pantalla no tiene
     que volver a pedir nada al servidor. */
  useEffect(() => {
    const leer = () => {
      const v = new URLSearchParams(window.location.search).get('v') as Vista | null;
      setVista(v || 'inicio');
    };
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, []);

  function irGrupo(id: string) {
    const g = grupos.find((x) => x.id === id);
    if (!g) return;
    ir(ultimaDe[id] && g.vistas.some((v) => v.id === ultimaDe[id]) ? ultimaDe[id] : g.vistas[0].id);
  }

  function ir(v: Vista) {
    const g = grupoDe(grupos, v);
    if (g) setUltimaDe((u) => ({ ...u, [g.id]: v }));
    if (v !== actual) {
      const url = v === 'inicio' ? window.location.pathname : `${window.location.pathname}?v=${v}`;
      window.history.pushState(null, '', url);
    }
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
    if (vista !== 'inicio') window.history.pushState(null, '', window.location.pathname);
    setVista('inicio');
    setMenuAbierto(false);
  }

  return (
    <div className={css.pantalla}>
      <Motas className={css.motas} />
      {/* Los logros que se van ganando, con confeti. Solo para quien aprende. */}
      {!puedeVerComo && <Celebracion />}
      {/* La bienvenida: foto, perfil y, si es miembro, su ficha del mapa. Se
          abre sola la primera vez y, después, con «Completa tu perfil». Nunca
          para Sorela, tampoco cuando mira «Ver como»: no es su perfil. */}
      {!puedeVerComo && (
        <Onboarding inicial={bienvenidaPendiente} nombre={sesion.nombre ?? ''} esMiembro={tieneMembresia(accesos)} />
      )}
      {/* Los avisos flotantes, solo para Sorela. Pulsar uno la devuelve a su
          vista de administradora aunque esté mirando «Ver como». */}
      {puedeVerComo && (
        <Avisos
          ir={(v) => {
            setRol('sorela');
            ir(v);
          }}
        />
      )}

      {/* Solo en móvil: logo y hamburguesa. En escritorio manda la lateral. */}
      <div className={css.barraMovil}>
        <span className={css.logo}>
          <Image src={logo} alt="Sorela Caro · Técnica Divine" sizes="160px" priority />
        </span>
        {/* Sus puntos, siempre a la vista: en el móvil van aquí, junto al menú. */}
        {!puedeVerComo && (
          <span className={css.marcadorMovil}>
            <MarcadorPuntos compacto puedePublicar={tieneMembresia(accesos)} />
          </span>
        )}
        <button
          ref={hamburguesa}
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
          ref={cajon}
          id="menu-plataforma"
          className={`${css.lateral} ${menuAbierto ? css.lateralAbierta : ''}`}
          inert={esMovil && !menuAbierto}
        >
          <span className={css.logo}>
            <Image src={logo} alt="Sorela Caro · Técnica Divine" sizes="200px" priority />
          </span>

          {/* Con un único apartado, el menú sería un botón que dice dónde ya
              estás. Se calla y deja el aire para lo demás. */}
          <nav
            className={css.nav}
            aria-label="Secciones de la plataforma"
            hidden={grupos.length < 2}
          >
            {grupos.map((g) => {
              const activo = grupoActual?.id === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => irGrupo(g.id)}
                  aria-current={activo ? 'page' : undefined}
                  className={`${css.navBoton} ${activo ? css.navActivo : ''}`}
                >
                  {/* La píldora del grupo activo se desliza de uno a otro. */}
                  {activo && (
                    <motion.span
                      layoutId="nav-pildora"
                      className={`${css.navActivo} ${css.navPildora}`}
                      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                    />
                  )}
                  <span className={css.navIcono}>
                    <IconoNav icono={g.icono} size={19} />
                  </span>
                  <span className={css.navTexto}>{g.label}</span>
                </button>
              );
            })}
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
            {/* En escritorio, sus puntos bajo su nombre (en el móvil van arriba). */}
            {!puedeVerComo && (
              <div className={css.marcadorLateral}>
                <MarcadorPuntos puedePublicar={tieneMembresia(accesos)} />
              </div>
            )}
            <button type="button" className={css.salir} onClick={salir} disabled={saliendo}>
              {saliendo ? 'Saliendo…' : 'Salir'}
            </button>
          </div>
        </aside>

        <main className={css.principal}>
          {/* Cada pantalla entra con un fundido corto. La clave cambia con la
              pantalla y con el «Ver como», así se nota el cambio sin parpadeo. */}
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${rol}-${actual}`}
            className={css.transicion}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
          <header className={css.cabecera}>
            {/* Alumnas y miembros no tienen título aquí: su pantalla trae el
                suyo, con su nombre. Se deja el hueco en blanco antes que
                pintar una línea vacía. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(esAdmin && grupoActual && grupoActual.vistas.length > 1 ? grupoActual.label : seccionDe(actual, rol)) && (
                <p className={css.seccion}>
                  {esAdmin && grupoActual && grupoActual.vistas.length > 1 ? grupoActual.label : seccionDe(actual, rol)}
                </p>
              )}
              {tituloDe(actual, rol) && <h1 className={css.titulo}>{tituloDe(actual, rol)}</h1>}
            </div>
            <FotoPerfil foto={foto} iniciales={iniciales} nombre={usuario} verPerfil={() => ir('perfil')} alCambiar={setFoto} />
          </header>

          {/* Las pestañas del grupo: lo que antes eran apartados sueltos del menú. */}
          {grupoActual && grupoActual.vistas.length > 1 && (
            <nav className={css.pestanas} aria-label={grupoActual.label}>
              {grupoActual.vistas.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-current={actual === v.id ? 'page' : undefined}
                  onClick={() => ir(v.id)}
                >
                  {actual === v.id && (
                    <motion.span layoutId={`pestana-${grupoActual.id}`} className={css.pestanaFondo} transition={{ type: 'spring', stiffness: 480, damping: 38 }} />
                  )}
                  <span>{v.label}</span>
                </button>
              ))}
            </nav>
          )}

          {/* Qué ve quien no es Sorela ya no depende de «ser alumna» o «ser
              miembro» —eso ya no existe— sino de lo que tenga contratado. Al
              mirar «Ver como» desde el panel de Sorela se usa la alumna de
              muestra, la misma que decide el menú de arriba. */}
          {/* Con algo contratado, su panel; sin nada, la pantalla de «a punto». */}
          {!esAdmin && actual === 'inicio' &&
            (accesosVistos.length > 0 ? (
              <PanelAlumna nombre={usuario} foto={foto} accesos={accesosVistos} ir={ir} muestra={puedeVerComo} />
            ) : (
              <Proximamente accesos={accesosVistos} nombre={usuario} />
            ))}
          {!esAdmin && actual === 'aula' && <Aula correo={sesion.correo} />}
          {/* La misma pantalla que la de Sorela, y a propósito: la agenda de
              una terapeuta y la de Sorela son la misma cosa. Cada una ve solo
              la suya porque el servidor cuelga cada agenda de su persona, no
              porque aquí se pinte distinto. */}
          {!esAdmin && actual === 'agenda' && <Agenda />}

          {esAdmin && actual === 'inicio' && <PanelSorela ir={ir} />}
          {/* Contactos de verdad, leídos de Firestore. Antes aquí había una lista
              de leads inventados con nombres y notas de mentira. */}
          {esAdmin && actual === 'leads' && <Contactos />}
          {esAdmin && actual === 'acuerdos' && <Acuerdos />}
          {esAdmin && actual === 'fichas' && <FichasMapa />}
          {esAdmin && actual === 'formaciones' && <FormacionesAdmin />}
          {esAdmin && actual === 'contenido' && <SubirClases />}
          {esAdmin && actual === 'agenda' && <Agenda esSorela />}
          {esAdmin && actual === 'facturacion' && <FacturacionSorela />}
          {esAdmin && actual === 'cuentas' && <Cuentas />}
          {esAdmin && actual === 'metricas' && <Metricas />}
          {esAdmin && actual === 'correos' && <Correos />}
          {esAdmin && actual === 'buzon' && <Buzon />}
          {esAdmin && actual === 'blog' && <BlogAdmin />}
          {/* La misma para todas: el servidor decide quién lee, quién escribe y quién modera. */}
          {actual === 'comunidad' && <Comunidad />}
          {actual === 'perfil' && <Perfil />}
          </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* En el móvil, los grupos van abajo, al alcance del pulgar, como en Instagram. */}
      {grupos.length > 1 && (
        <nav className={css.barraInferior} aria-label="Secciones">
          {grupos.map((g) => {
            const activo = grupoActual?.id === g.id;
            return (
              <button key={g.id} type="button" onClick={() => irGrupo(g.id)} aria-current={activo ? 'page' : undefined}>
                {activo && <motion.span layoutId="barra-activa" className={css.barraActiva} transition={{ type: 'spring', stiffness: 480, damping: 36 }} />}
                <IconoNav icono={g.icono} size={22} />
                <span>{g.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

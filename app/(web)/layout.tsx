import Cabecera from '@/components/Cabecera';
import PieDePagina from '@/components/PieDePagina';
import Asistente from '@/components/Asistente';
import CaptacionGlobal from '@/components/CaptacionGlobal';
import EfectosScroll from '@/components/EfectosScroll';

/**
 * Cromo de la web pública: cabecera, pie y asistente.
 * La plataforma (`/entrar`) queda fuera de este grupo a propósito — es una
 * pantalla completa, sin navegación de la web ni chatbot encima.
 */
export default function LayoutWeb({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <Cabecera />
      <div id="contenido">{children}</div>
      <PieDePagina />
      <Asistente />
      {/* Una sola ventana de contacto para toda la web: el asistente y
          cualquier sección pueden abrirla sin montar la suya. */}
      <CaptacionGlobal />
      <EfectosScroll />
    </>
  );
}

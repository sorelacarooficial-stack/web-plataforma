import type { Icono } from '@/lib/plataforma';

/** Los iconos del menú: trazo fino, del mismo grosor, para que se lean como una familia. */
export default function IconoNav({ icono, size = 20 }: { icono: Icono; size?: number }) {
  const p = {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (icono) {
    case 'inicio':
      return <svg {...p}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></svg>;
    case 'personas':
      return <svg {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.2c2.3.2 3.8 1.8 4.5 4.3" /></svg>;
    case 'mensajes':
      return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7.5 8 5.5 8-5.5" /></svg>;
    case 'contenido':
      return <svg {...p}><rect x="3.5" y="4" width="17" height="16" rx="3" /><path d="m10 9 5 3-5 3z" /></svg>;
    case 'negocio':
      return <svg {...p}><path d="M4 19V5" /><path d="M4 19h16" /><path d="m7.5 14 3.5-4 3 2.5 4.5-5.5" /></svg>;
    case 'clases':
      return <svg {...p}><path d="M3 7.5 12 4l9 3.5-9 3.5z" /><path d="M7 9.5V15c1.5 1.3 3 2 5 2s3.5-.7 5-2V9.5" /></svg>;
    case 'comunidad':
      return <svg {...p}><path d="M4 5.5h16v10H9.5L5 19.5v-4H4z" /></svg>;
    case 'agenda':
      return <svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></svg>;
    case 'perfil':
      return <svg {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.2-3.8 4-5.8 7.5-5.8s6.3 2 7.5 5.8" /></svg>;
  }
}

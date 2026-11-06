'use client';

import { useEffect, useState } from 'react';
import { CLAVE_RESERVA, GRUPO_COMUNIDAD } from '@/lib/reserva';
import css from './reserva.module.css';

/**
 * Lo único que hace la página de gracias: confirmar el pago de la reserva que
 * empezó este navegador (la guardó /reserva antes de mandarla a Stripe) y
 * enseñar el botón del grupo de la Comunidad Divine.
 */
export default function GraciasComunidad({ sesion, whatsapp }: { sesion: string; whatsapp: string }) {
  const [nombre, setNombre] = useState('');
  useEffect(() => {
    let guardada: { id?: string; nombre?: string } | null = null;
    try {
      guardada = JSON.parse(localStorage.getItem(CLAVE_RESERVA) || 'null');
    } catch {
      /* sin almacenamiento: no pasa nada, el equipo lo ve en Stripe */
    }
    if (!guardada?.id) return;
    setNombre((guardada.nombre || '').split(/\s+/)[0]);
    fetch('/api/reserva/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: guardada.id, s: sesion }),
    })
      .then((r) => {
        // Hecho (o ya no sirve): se olvida para no volver a mandarla.
        if (r.ok || r.status === 404 || r.status === 410) localStorage.removeItem(CLAVE_RESERVA);
      })
      .catch(() => {});
  }, [sesion]);

  const grupo = GRUPO_COMUNIDAD || `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hola, acabo de pagar mi reserva. ¿Me añadís a la Comunidad Divine?')}`;

  return (
    <section className={css.bloque} style={{ maxWidth: 520, margin: '0 auto', paddingTop: 34, textAlign: 'center' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 300, letterSpacing: '-0.035em' }}>
        {nombre ? `${nombre}, entra` : 'Entra'} en la <strong>Comunidad Divine</strong>
      </h2>
      <p className={css.suave}>Ahí subimos todo: eventos, cursos, los avisos de tu formación y los tutoriales de la plataforma.</p>
      <a className={css.boton} href={grupo} target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, padding: '18px 16px', marginTop: 20 }}>
        Entrar en la Comunidad
        {!GRUPO_COMUNIDAD && <small>por WhatsApp</small>}
      </a>
      <p className={css.suave} style={{ marginTop: 22, fontSize: 14 }}>
        Te llega el recibo al correo. Nuestro equipo te escribe por WhatsApp con los siguientes pasos.
      </p>
    </section>
  );
}

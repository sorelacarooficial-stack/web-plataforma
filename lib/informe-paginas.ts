/**
 * Cómo se llama cada página de la web, en palabras.
 *
 * El medidor guarda las rutas con `·` en lugar de `/` (Firestore no admite la
 * barra en una clave): `·formaciones` es /formaciones. Lo leen la pantalla de
 * Métricas y el informe en PDF, y por eso vive aquí y no dentro de uno de los
 * dos: si mañana se añade una página, las dos la llaman igual.
 */

const PAGINAS: Record<string, string> = {
  '·': 'Portada',
  '/': 'Portada',
  '·formaciones': 'Formaciones',
  '·metodo': 'El método',
  '·comunidad': 'Comunidad',
  '·terapeutas': 'Terapeutas',
  '·sobre': 'Sobre Sorela',
  '·contacto': 'Contacto',
  '·presentacion': 'Presentación',
  '·registro': 'Crear cuenta',
  '·entrar': 'Entrar',
  '·alumnas': 'Landing de alumnas',
  '·blog': 'Blog',
};

export const nombreDePagina = (k: string) => PAGINAS[k] ?? k.replace(/·/g, '/');

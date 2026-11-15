/**
 * Letra karaoke de una canción: línea a línea y con el segundo en que entra
 * cada palabra. `t`/`fin`: cuándo empieza y acaba la línea; `p`: [palabra,
 * segundo].
 *
 * 2026-11-15: fuera las dos canciones con derechos de autor («Poder en la
 * oración» y «Proceso con Dios») y su letra. Estaban publicadas en la web
 * (public/clase/musica) y en un repositorio público: eso es redistribuirlas.
 * Si se vuelve a usar una canción con letra, que sea propia o con licencia.
 */
export type LineaLetra = { t: number; fin: number; p: [string, number][] };

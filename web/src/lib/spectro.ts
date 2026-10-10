/**
 * Ciencia compartida del tablero. Todo lo que convierte frecuencias,
 * velocidades o canales vive aquí, con pruebas en spectro.test.ts.
 *
 * Convención radio (LSRK):  v = c · (1 − ν_LSRK / ν_reposo)
 *                  inversa:  ν_LSRK = ν_reposo · (1 − v / c)
 * La corrección Doppler se aplica UNA sola vez. W1 y W2 nunca se unen.
 */

export const C_KMS = 299792.458;

/** Velocidad radio (km/s) de una frecuencia observada LSRK (GHz) respecto a una línea en reposo (MHz). */
export function dopplerVelocity(nuObsGHz: number, nuRestMHz: number, c = C_KMS): number {
  return c * (1 - (nuObsGHz * 1000) / nuRestMHz);
}

/** Frecuencia observada LSRK (GHz) de una línea en reposo (MHz) emitida a velocidad v (km/s). */
export function observedFreqGHz(nuRestMHz: number, vKms: number, c = C_KMS): number {
  return (nuRestMHz / 1000) * (1 - vKms / c);
}

/** Lleva una frecuencia observada (GHz) al marco de reposo para una velocidad v (km/s). */
export function toRestFrameGHz(nuObsGHz: number, vKms: number, c = C_KMS): number {
  return nuObsGHz / (1 - vKms / c);
}

/**
 * Índice del canal más cercano a `f` en un eje de frecuencias monótono
 * (ascendente o descendente). Devuelve -1 si el eje está vacío.
 * Fuera del rango devuelve el extremo más cercano.
 */
export function nearestChannel(axis: ArrayLike<number>, f: number): number {
  const n = axis.length;
  if (n === 0) return -1;
  if (n === 1) return 0;
  const asc = axis[n - 1] >= axis[0];
  let lo = 0;
  let hi = n - 1;
  // búsqueda binaria del primer índice con axis[i] >= f (asc) o <= f (desc)
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const before = asc ? axis[mid] < f : axis[mid] > f;
    if (before) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return 0;
  const a = lo - 1;
  return Math.abs(axis[a] - f) <= Math.abs(axis[lo] - f) ? a : lo;
}

/** ¿Está f dentro del eje (incluye medio canal en los bordes)? */
export function inAxis(axis: ArrayLike<number>, f: number): boolean {
  const n = axis.length;
  if (n < 2) return false;
  const lo = Math.min(axis[0], axis[n - 1]);
  const hi = Math.max(axis[0], axis[n - 1]);
  const half = Math.abs(axis[1] - axis[0]) / 2;
  return f >= lo - half && f <= hi + half;
}

export interface Slice {
  /** índices de canal originales */
  idx: number[];
  /** abscisa del corte (GHz o km/s según la función) */
  x: number[];
  /** intensidad Jy/beam */
  y: number[];
}

/** Recorta canales con f0 <= ν <= f1 (GHz). Mantiene el orden del eje. */
export function sliceFreq(freqGHz: ArrayLike<number>, y: ArrayLike<number | null>, f0: number, f1: number): Slice {
  const lo = Math.min(f0, f1);
  const hi = Math.max(f0, f1);
  const out: Slice = { idx: [], x: [], y: [] };
  for (let i = 0; i < freqGHz.length; i++) {
    const f = freqGHz[i];
    const yi = y[i];
    if (f >= lo && f <= hi && yi !== null && Number.isFinite(yi)) {
      out.idx.push(i);
      out.x.push(f);
      out.y.push(yi as number);
    }
  }
  return out;
}

/**
 * Corte en espacio de velocidades alrededor de una línea en reposo (MHz):
 * cada canal se convierte a v = c(1 − ν/ν_reposo) y se conservan los que caen
 * en [vMin, vMax]. El resultado se ordena por v ascendente.
 */
export function sliceVelocity(
  freqGHz: ArrayLike<number>,
  y: ArrayLike<number | null>,
  nuRestMHz: number,
  vMin: number,
  vMax: number,
  c = C_KMS,
): Slice {
  // ν decrece cuando v crece: v ∈ [vMin, vMax] ⇔ ν ∈ [ν(vMax), ν(vMin)]
  const fHi = observedFreqGHz(nuRestMHz, vMin, c);
  const fLo = observedFreqGHz(nuRestMHz, vMax, c);
  const s = sliceFreq(freqGHz, y, fLo, fHi);
  const rows = s.idx.map((i, k) => ({ i, v: dopplerVelocity(s.x[k], nuRestMHz, c), y: s.y[k] }));
  rows.sort((a, b) => a.v - b.v);
  return { idx: rows.map((r) => r.i), x: rows.map((r) => r.v), y: rows.map((r) => r.y) };
}

/** Área integrada ∑ I·Δv (Jy/beam·km/s) de un corte en velocidad con canales equiespaciados. */
export function integratedArea(slice: Slice, stepKms: number): number {
  let s = 0;
  for (const yi of slice.y) s += yi;
  return s * Math.abs(stepKms);
}

/** Máximo de un corte: índice dentro del corte, x y y. */
export function sliceMax(slice: Slice): { k: number; x: number; y: number } | null {
  if (slice.y.length === 0) return null;
  let k = 0;
  for (let i = 1; i < slice.y.length; i++) if (slice.y[i] > slice.y[k]) k = i;
  return { k, x: slice.x[k], y: slice.y[k] };
}

/** Ventana (W1/W2) cuyo eje contiene la frecuencia observada f (GHz), o null. */
export function windowForFreq<K extends string>(axes: Record<K, ArrayLike<number>>, f: number): K | null {
  for (const k of Object.keys(axes) as K[]) if (inAxis(axes[k], f)) return k;
  return null;
}

/** Estiramiento asinh normalizado a [0,1] para imágenes (valores <0 → 0). */
export function asinhStretch(x: number, beta: number, xMax: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  const v = Math.asinh(x / beta) / Math.asinh(xMax / beta);
  return v > 1 ? 1 : v;
}

/** Inversa del estiramiento: valor físico que cae en la fracción t∈[0,1]. */
export function asinhInverse(t: number, beta: number, xMax: number): number {
  return beta * Math.sinh(t * Math.asinh(xMax / beta));
}

/**
 * Rango [min, max] de una serie con margen relativo `pad`; ignora nulos.
 * Devuelve null si no hay valores finitos.
 */
export function paddedRange(values: Iterable<number | null | undefined>, pad = 0.08): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo)) return null;
  const span = hi - lo || Math.abs(hi) || 1;
  return [lo - span * pad, hi + span * pad];
}

/**
 * Líneas “fuertes” de una especie: las que quedan a menos de `dex` de la más
 * intensa (logI_300K). Mismo criterio que pipeline.py (strong_dex).
 */
export function strongLines<T extends { logI_300K: number }>(lines: T[], dex: number): T[] {
  if (lines.length === 0) return [];
  const top = Math.max(...lines.map((l) => l.logI_300K));
  return lines.filter((l) => l.logI_300K >= top - dex);
}

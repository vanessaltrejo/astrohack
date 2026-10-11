/**
 * Cargadores tipados de web/public/data/*.json (los escriben analysis/exportar_base_web.py y analysis/probabilidad.py).
 * JSON estricto: un archivo inválido o ausente falla de forma visible.
 */

export const POSITION_KEYS = ["B_offset", "B_pico", "A"] as const;
export type PosKey = (typeof POSITION_KEYS)[number];
export const WINDOW_KEYS = ["W1", "W2"] as const;
export type WinKey = (typeof WINDOW_KEYS)[number];

export interface PositionMeta {
  label: string;
  ra_deg: number;
  dec_deg: number;
  pixel: [number, number];
  v_start_kms: number;
}

export interface WindowMeta {
  range_GHz: [number, number];
  channels: number;
  step_MHz: number;
  step_kms: number;
  beam_arcsec: [number, number];
  beam_pa_deg: number;
}

export interface Meta {
  project: string;
  mous: string;
  source: string;
  credit: string;
  c_kms: number;
  positions: Record<PosKey, PositionMeta>;
  windows: Record<WinKey, WindowMeta>;
}

export interface NoiseInfo {
  sigma_Jy: number;
  baseline_Jy?: number;
  method?: string;
  segments_GHz?: [number, number][];
}

export type WindowSpectra = {
  freq_GHz: number[];
  noise: Record<PosKey, NoiseInfo>;
} & Record<PosKey, (number | null)[]>;

export type Spectra = Record<WinKey, WindowSpectra>;

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function dataUrl(file: string): string {
  return `${BASE}/data/${file}`;
}

export interface CoreLoad {
  meta: Meta;
  spectra: Spectra;
}

export async function loadCore(): Promise<CoreLoad> {
  const [meta, spectra] = await Promise.all([loadJson<Meta>("meta.json"), loadJson<Spectra>("spectra.json")]);
  return { meta, spectra };
}

/** Carga obligatoria de un JSON de public/data: falla de forma visible si falta o es inválido. */
export async function loadJson<T>(file: string): Promise<T> {
  try {
    const res = await fetch(dataUrl(file));
    if (!res.ok) throw new Error(res.status === 404 ? "no existe" : `HTTP ${res.status}`);
    // El motor escribe JSON estricto (sin NaN): un archivo inválido debe fallar aquí, no corregirse en silencio.
    return (await res.json()) as T;
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

/** Ruta a un archivo estático respetando NEXT_PUBLIC_BASE_PATH (p. ej. figuras). */
export function assetUrl(path: string): string {
  return `${BASE}${path}`;
}

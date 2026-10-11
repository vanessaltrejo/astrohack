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

export interface CatalogLine {
  id: number;
  species: string;
  catalog: string;
  entry: string;
  rest_MHz: number;
  unc_MHz: number;
  logI_300K: number;
  Eu_K: number;
  El_cm1: number;
  gu: number;
  qn_up: string;
  qn_lo: string;
  window: WinKey | null;
}

export type PeakFlag = "blend" | "absorption" | "edge" | "weak" | "asymmetric" | string;

export interface PeakCandidate {
  catalog_id: number;
  species: string;
  rest_MHz: number;
  v_kms: number;
  delta_MHz: number;
  Eu_K: number;
  logI_300K: number;
  unc_MHz: number;
}

export interface PeakFit {
  ok: boolean;
  center_GHz?: number;
  fwhm_kms?: number;
  amp_Jy?: number;
  area_Jy_kms?: number;
  baseline_Jy?: number;
  center_err_MHz?: number;
}

export interface Peak {
  id: string;
  freq_GHz: number;
  peak_Jy: number;
  snr: number;
  fit?: PeakFit | null;
  flags?: PeakFlag[];
  candidates?: PeakCandidate[];
}

export type Peaks = Partial<Record<WinKey, Partial<Record<PosKey, Peak[]>>>>;

export type LoadState<T> = { status: "ok"; value: T } | { status: "missing" } | { status: "error"; message: string };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function dataUrl(file: string): string {
  return `${BASE}/data/${file}`;
}

async function fetchJson<T>(file: string, opts: { optional?: boolean; fresh?: boolean } = {}): Promise<LoadState<T>> {
  try {
    const url = opts.fresh ? `${dataUrl(file)}?t=${Date.now()}` : dataUrl(file);
    const res = await fetch(url, { cache: opts.fresh ? "no-store" : "default" });
    if (res.status === 404) return { status: "missing" };
    if (!res.ok) return { status: "error", message: `${file}: HTTP ${res.status}` };
    // El motor escribe JSON estricto (sin NaN): un archivo inválido debe fallar aquí, no corregirse en silencio.
    const value = (await res.json()) as T;
    return { status: "ok", value };
  } catch (e) {
    if (opts.optional) return { status: "missing" };
    return { status: "error", message: `${file}: ${(e as Error).message}` };
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Validación ligera de peaks.json: descarta lo que no cumple el contrato en vez de romper la vista. */
export function sanitizePeaks(raw: unknown): Peaks | null {
  if (!isObject(raw)) return null;
  const out: Peaks = {};
  for (const w of WINDOW_KEYS) {
    const win = raw[w];
    if (!isObject(win)) continue;
    out[w] = {};
    for (const p of POSITION_KEYS) {
      const list = win[p];
      if (!Array.isArray(list)) continue;
      out[w]![p] = list.filter(
        (pk): pk is Peak =>
          isObject(pk) && typeof pk.id === "string" && typeof pk.freq_GHz === "number" && typeof pk.snr === "number",
      );
    }
  }
  return out;
}

export interface CoreLoad {
  meta: Meta;
  spectra: Spectra;
  catalog: CatalogLine[];
}

export async function loadCore(): Promise<CoreLoad> {
  const [meta, spectra, catalog] = await Promise.all([
    loadJson<Meta>("meta.json"),
    loadJson<Spectra>("spectra.json"),
    loadJson<CatalogLine[]>("catalog.json"),
  ]);
  return { meta, spectra, catalog };
}

/** peaks.json: líneas detectadas por el motor v3 (analysis/probabilidad.py). Si falta, devuelve null. */
export async function loadPeaks(): Promise<Peaks | null> {
  const pk = await fetchJson<unknown>("peaks.json", { optional: true });
  return pk.status === "ok" ? sanitizePeaks(pk.value) : null;
}

/** Carga obligatoria de un JSON de public/data (lanza si falta o es inválido). */
export async function loadJson<T>(file: string): Promise<T> {
  const r = await fetchJson<T>(file);
  if (r.status !== "ok") throw new Error(r.status === "error" ? r.message : `${file}: no existe`);
  return r.value;
}

/** Ruta a un archivo estático respetando NEXT_PUBLIC_BASE_PATH (p. ej. figuras). */
export function assetUrl(path: string): string {
  return `${BASE}${path}`;
}

export function findPeak(peaks: Peaks | null, id: string): { win: WinKey; pos: PosKey; peak: Peak } | null {
  if (!peaks) return null;
  for (const w of WINDOW_KEYS)
    for (const p of POSITION_KEYS) {
      const pk = peaks[w]?.[p]?.find((x) => x.id === id);
      if (pk) return { win: w, pos: p, peak: pk };
    }
  return null;
}

import type { PosKey } from "./data";

/** Salida del motor v3 (analysis/v3/probabilidad.py → public/data/probabilidad.json). */
export type V3Feature = { nu_reposo_MHz: number; S: number; pico: string | null };
export type V3Species = { n_fuertes: number; n_presentes: number; fuertes: V3Feature[] };
export type V3Cand = {
  pico: string;
  ventana: "W1" | "W2";
  especie: string;
  P: number;
  rango: number;
};
export type V3Pos = { candidatas: V3Cand[]; especies: Record<string, V3Species> };
export type V3Data = { parametros: { v_kms: Record<PosKey, number> }; posiciones: Record<PosKey, V3Pos> };

let cache: Promise<V3Data | null> | null = null;
export function loadV3(): Promise<V3Data | null> {
  if (!cache) {
    cache = fetch("/data/probabilidad.json")
      .then((r) => (r.ok ? (r.json() as Promise<V3Data>) : null))
      .catch(() => null);
  }
  return cache;
}

export type SpeciesRow = {
  especie: string;
  /** picos donde es la candidata con mayor probabilidad */
  gana: number;
  /** picos donde figura entre las 5 primeras */
  aparece: number;
  /** líneas fuertes esperadas en W1+W2 y cuántas aparecen (factor "se repite") */
  fuertes: number;
  presentes: number;
  pMedia: number | null;
};

/** Una fila por especie, ordenada por líneas que explica y después por las que se repiten. */
export function speciesRows(pos: V3Pos | null | undefined, keys: string[]): SpeciesRow[] {
  const rows = new Map<string, SpeciesRow>();
  for (const k of keys) {
    const e = pos?.especies?.[k];
    rows.set(k, { especie: k, gana: 0, aparece: 0, fuertes: e?.n_fuertes ?? 0, presentes: e?.n_presentes ?? 0, pMedia: null });
  }
  const suma = new Map<string, number>();
  for (const c of pos?.candidatas ?? []) {
    const r = rows.get(c.especie);
    if (!r) continue;
    r.aparece += 1;
    if (c.rango === 1) {
      r.gana += 1;
      suma.set(c.especie, (suma.get(c.especie) ?? 0) + c.P);
    }
  }
  for (const [k, s] of suma) {
    const r = rows.get(k)!;
    r.pMedia = r.gana ? s / r.gana : null;
  }
  return [...rows.values()].sort((a, b) => b.gana - a.gana || b.presentes - a.presentes || a.especie.localeCompare(b.especie));
}

export function groupOfRow(r: SpeciesRow | undefined): "explica líneas" | "candidata sin ganar" | "sin candidatas" {
  if (!r || r.aparece === 0) return "sin candidatas";
  return r.gana > 0 ? "explica líneas" : "candidata sin ganar";
}

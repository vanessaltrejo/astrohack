/**
 * Recalcula la probabilidad por línea en el navegador con pesos por factor (0 = apagado, 1 = normal, 2 = doble).
 * Con todos los pesos en 1 reproduce exactamente analysis/v3/probabilidad.py:
 *   P(s | línea) ∝ L_ν^w · L_A^w · L_rep^w · π_átomos^w · π_espacio^w · f_entorno^w   (+ «fuera del catálogo»)
 */
import type { PosKey, WinKey } from "./data";

export const FUERA = "(fuera del catálogo)";

export type Cand = {
  pico: string;
  ventana: WinKey;
  nu_obs_MHz: number;
  nu_reposo_MHz: number;
  Jy: number;
  snr: number;
  especie: string;
  molecula: string;
  nombre_quimico?: string | null;
  P: number;
  rango: number;
  delta_MHz?: number | null;
  L_frecuencia?: number | null;
  L_Einstein?: number | null;
  L_poblacion?: number | null;
  L_repeticion?: number | null;
  lineas_presentes?: number | null;
  lineas_fuertes?: number | null;
  n_atomos?: string | null;
  prior_complejidad?: number | null;
  visto_en_espacio?: string | null;
  prior_espacio?: number | null;
  factor_entorno?: number | null;
  log10_Aij?: number | null;
  Eu_K?: number | null;
  QN?: string | null;
  origen?: string | null;
  lista?: string | null;
  tag?: number | null;
  catalog_id: number;
  unc_MHz?: number | null;
  nu_cat_MHz?: number | null;
  isotopologo?: boolean | null;
};
export type Pico = {
  id: string;
  ventana: WinKey;
  tipo: string;
  nu_obs_MHz: number;
  nu_reposo_MHz: number;
  Jy: number;
  snr: number;
  sigma_Jy?: number;
  fwhm_kms?: number | null;
  blend?: boolean;
};
export type Feature = { nu_reposo_MHz: number; S: number; pico: string | null };
export type PosData = {
  picos: Pico[];
  candidatas: Cand[];
  especies: Record<string, { n_fuertes: number; n_presentes: number; fuertes: Feature[] }>;
};
export type Backstage = {
  catalogo_oficial: number;
  especies_oficiales: number;
  con_aij_oficial: number;
  splatalogue_filas: number;
  ampliado_filas: number;
  utilizables: number;
  especies_total: number;
  censo: number;
  censo_por_atomos: { atomos: string; n: number }[];
  censo_estado: Record<string, number>;
  utilizables_por_estado: Record<string, number>;
};
export type V3 = {
  parametros: { v_kms: Record<PosKey, number>; eps_fuera: number };
  posiciones: Record<PosKey, PosData>;
  backstage: Backstage;
};

export const FACTORES = [
  { key: "frecuencia", campo: "L_frecuencia", label: "Frecuencia", ref: Math.exp(-2), ayuda: "qué tan cerca cae la línea de la transición del catálogo" },
  { key: "einstein", campo: "L_Einstein", label: "Coef. de Einstein", ref: 0.5, ayuda: "si la intensidad esperada (Aij, energía del nivel) es compatible" },
  { key: "repite", campo: "L_repeticion", label: "Se repite", ref: 0.5, ayuda: "cuántas de sus líneas fuertes aparecen en W1 y W2" },
  { key: "complejidad", campo: "prior_complejidad", label: "Complejidad", ref: 0.1, ayuda: "cuántas de las 348 moléculas conocidas tienen ese número de átomos" },
  { key: "espacio", campo: "prior_espacio", label: "Visto en el espacio", ref: 1, ayuda: "si está en el censo CDMS de moléculas detectadas" },
  { key: "entorno", campo: "factor_entorno", label: "Entorno", ref: 1, ayuda: "si su entorno típico se parece a un núcleo caliente" },
] as const;
export type FactorKey = (typeof FACTORES)[number]["key"];
export type Pesos = Record<FactorKey, number>;
export const PESOS_BASE: Pesos = { frecuencia: 1, einstein: 1, repite: 1, complejidad: 1, espacio: 1, entorno: 1 };

export function esBase(w: Pesos) {
  return FACTORES.every((f) => w[f.key] === 1);
}

/** Candidatas de un pico recalculadas y ordenadas (con todos los pesos en 1 reproduce el P de Python). */
export function recalcular(cs: Cand[], w: Pesos): Cand[] {
  const pts = cs.map((c) => {
    let s = 1;
    for (const f of FACTORES) {
      const val = c.especie === FUERA ? f.ref : ((c[f.campo] as number | null | undefined) ?? 1);
      s *= Math.pow(Math.max(val, 0), w[f.key]);
    }
    return s;
  });
  const tot = pts.reduce((a, b) => a + b, 0) || 1;
  return cs
    .map((c, i) => ({ ...c, P: pts[i] / tot }))
    .sort((a, b) => b.P - a.P)
    .map((c, i) => ({ ...c, rango: i + 1 }));
}

// confianza orientativa a partir del % de la candidata principal
export type Nivel = "alta" | "media" | "baja" | "sin identificar";
export const NIVEL: Record<Nivel, { color: string; bg: string; texto: string; corto: string }> = {
  alta: { color: "#15803d", bg: "#dcfce7", texto: "Alta (≥ 70 %)", corto: "Alta" },
  media: { color: "#a16207", bg: "#fef3c7", texto: "Media (40–70 %)", corto: "Media" },
  baja: { color: "#475569", bg: "#e2e8f0", texto: "Baja (< 40 %)", corto: "Baja" },
  "sin identificar": { color: "#b91c1c", bg: "#fee2e2", texto: "Sin identificar: gana «fuera del catálogo»", corto: "Sin identificar" },
};
export function nivel(top: Cand | undefined): Nivel {
  if (!top || top.especie === FUERA) return "sin identificar";
  return top.P >= 0.7 ? "alta" : top.P >= 0.4 ? "media" : "baja";
}
export const pct = (p: number) => `${Math.round(p * 100)} %`;

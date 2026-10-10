/** Nombre del tablero: cámbialo aquí y se actualiza en título, cabecera y pie. */
export const APP_NAME = "Huellas";
export const APP_TAGLINE = "Moléculas prebióticas en IRAS 16293-2422, línea por línea";
export const TEAM_NAME_DEFAULT = "";

/** Declaración de uso de IA (texto pendiente de redactar por el equipo). */
export const AI_DECLARATION =
  "Declaración de IA: [pendiente — el equipo describirá aquí qué herramientas de IA usó y para qué].";

/** Rango y paso del control de velocidad (km/s). */
export const V_MIN = 0;
export const V_MAX = 6;
export const V_STEP = 0.05;

/** Ventana de velocidad para las huellas (km/s). */
export const FP_VMIN = -8;
export const FP_VMAX = 12;

/** Semiancho del zoom al hacer clic en un pico (GHz) = ±5 MHz. */
export const PEAK_ZOOM_HALF_GHZ = 0.005;

/** Nombres cortos de las posiciones para la interfaz. */
export const POSITION_LABELS: Record<string, string> = {
  B_offset: "B offset",
  B_pico: "B pico",
  A: "A",
};

/**
 * PA del haz del continuo (grados, de N hacia E). continuum.json no lo exporta todavía;
 * valor tomado de BPA en data/cubos/continuo_IRAS16293.fits. Si el JSON trae
 * beam_pa_deg, ese valor manda.
 */
export const CONTINUUM_BEAM_PA_FALLBACK_DEG = 89.06;

/** logI mínimo por defecto en el filtro del espectro. */
export const LOGI_DEFAULT = -6;

/** Máximo de paneles en las huellas moleculares. */
export const FP_MAX_PANELS = 24;

/** Umbral de “línea fuerte” sin species_scores.json: dex por debajo de la más intensa (igual que pipeline.py). */
export const STRONG_DEX = 1.5;

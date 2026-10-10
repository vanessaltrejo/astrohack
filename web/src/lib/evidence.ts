/** Registro de evidencia: columnas idénticas a data/evidencia_plantilla.csv. */
export const EVIDENCE_COLUMNS = [
  "equipo",
  "hipotesis",
  "especie",
  "catalogo",
  "entrada",
  "frecuencia_reposo_MHz",
  "ventana",
  "posicion",
  "frecuencia_pico_LSRK_MHz",
  "v_radio_kms",
  "FWHM_kms",
  "baseline_Jy_beam",
  "sigma_Jy_beam",
  "SNR",
  "area_Jy_beam_kms",
  "metodo_incertidumbre",
  "grupo_rasgo",
  "mezcla",
  "alternativas",
  "decision",
  "archivo_figura",
] as const;

export type EvidenceColumn = (typeof EVIDENCE_COLUMNS)[number];
export type EvidenceRow = { _id: string } & Record<EvidenceColumn, string>;

export const COLUMN_LABELS: Record<EvidenceColumn, string> = {
  equipo: "Equipo",
  hipotesis: "Hipótesis",
  especie: "Especie",
  catalogo: "Catálogo",
  entrada: "Entrada",
  frecuencia_reposo_MHz: "ν reposo (MHz)",
  ventana: "Ventana",
  posicion: "Posición",
  frecuencia_pico_LSRK_MHz: "ν pico LSRK (MHz)",
  v_radio_kms: "v radio (km/s)",
  FWHM_kms: "FWHM (km/s)",
  baseline_Jy_beam: "Línea base (Jy/beam)",
  sigma_Jy_beam: "σ (Jy/beam)",
  SNR: "SNR",
  area_Jy_beam_kms: "Área (Jy/beam·km/s)",
  metodo_incertidumbre: "Método de incertidumbre",
  grupo_rasgo: "Grupo de rasgo",
  mezcla: "Mezcla",
  alternativas: "Alternativas",
  decision: "Decisión",
  archivo_figura: "Archivo de figura",
};

export function emptyRow(team = ""): EvidenceRow {
  const r = { _id: newId() } as EvidenceRow;
  for (const c of EVIDENCE_COLUMNS) r[c] = "";
  r.equipo = team;
  return r;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: EvidenceRow[]): string {
  const lines = [EVIDENCE_COLUMNS.join(",")];
  for (const r of rows) lines.push(EVIDENCE_COLUMNS.map((c) => csvCell(r[c] ?? "")).join(","));
  return lines.join("\n") + "\n";
}

const KEY = "huellas.evidencia.v1";
const TEAM_KEY = "huellas.equipo.v1";

export function loadRows(): EvidenceRow[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => {
      const r = emptyRow();
      if (p && typeof p === "object") {
        for (const c of EVIDENCE_COLUMNS) {
          const v = (p as Record<string, unknown>)[c];
          if (v !== undefined && v !== null) r[c] = String(v);
        }
        const id = (p as Record<string, unknown>)._id;
        if (typeof id === "string") r._id = id;
      }
      return r;
    });
  } catch {
    return [];
  }
}

export function saveRows(rows: EvidenceRow[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* almacenamiento no disponible (modo privado, cuota): la sesión sigue funcionando en memoria */
  }
}

export function loadTeam(): string {
  try {
    return window.localStorage.getItem(TEAM_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveTeam(t: string): void {
  try {
    window.localStorage.setItem(TEAM_KEY, t);
  } catch {
    /* ignorar */
  }
}

/** Formatea un número para el CSV (vacío si no es finito). */
export function fmt(x: number | null | undefined, digits: number): string {
  return x === null || x === undefined || !Number.isFinite(x) ? "" : x.toFixed(digits);
}

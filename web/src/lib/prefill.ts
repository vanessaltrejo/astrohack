/**
 * Prellenado de filas de evidencia a partir de una línea del catálogo y,
 * si existe, del pico detectado que la explica. Solo copia datos publicados
 * (catalog.json, peaks.json, spectra.json): nunca inventa valores.
 */
import type { CatalogLine, NoiseInfo, Peak, PosKey, WinKey } from "./data";
import { emptyRow, fmt, type EvidenceRow } from "./evidence";
import { C_KMS, dopplerVelocity } from "./spectro";

export interface PrefillInput {
  team: string;
  line: CatalogLine;
  win: WinKey | null;
  pos: PosKey;
  peak?: Peak | null;
  noise?: NoiseInfo | null;
  hipotesis?: string;
  decision?: string;
}

export function prefillRow(i: PrefillInput): EvidenceRow {
  const r = emptyRow(i.team);
  const { line, peak } = i;
  r.hipotesis = i.hipotesis ?? `${line.species} en ${i.pos}`;
  r.especie = line.species;
  r.catalogo = line.catalog;
  r.entrada = line.entry;
  r.frecuencia_reposo_MHz = line.rest_MHz.toFixed(4);
  r.ventana = i.win ?? "";
  r.posicion = i.pos;
  if (i.noise) r.sigma_Jy_beam = fmt(i.noise.sigma_Jy, 5);

  if (peak) {
    const fit = peak.fit && peak.fit.ok ? peak.fit : null;
    const centerGHz = fit?.center_GHz ?? peak.freq_GHz;
    r.frecuencia_pico_LSRK_MHz = (centerGHz * 1000).toFixed(4);
    r.v_radio_kms = fmt(dopplerVelocity(centerGHz, line.rest_MHz), 3);
    r.FWHM_kms = fmt(fit?.fwhm_kms, 3);
    r.baseline_Jy_beam = fmt(fit?.baseline_Jy, 5);
    r.SNR = fmt(peak.snr, 2);
    r.area_Jy_beam_kms = fmt(fit?.area_Jy_kms, 4);
    const parts: string[] = [];
    if (fit?.center_err_MHz !== undefined) {
      const errKms = (C_KMS * fit.center_err_MHz) / line.rest_MHz;
      parts.push(`ajuste gaussiano: error del centro ${fit.center_err_MHz.toFixed(3)} MHz (${errKms.toFixed(3)} km/s)`);
    } else if (!fit) {
      parts.push("sin ajuste: frecuencia del canal máximo");
    }
    parts.push(`incertidumbre de catálogo ${line.unc_MHz} MHz`);
    if (i.noise?.method) parts.push(`σ: ${i.noise.method}`);
    r.metodo_incertidumbre = parts.join("; ");
    r.grupo_rasgo = peak.id;
    // excluye la propia línea (y sus duplicados exactos del catálogo)
    const others = (peak.candidates ?? []).filter(
      (c) => c.catalog_id !== line.id && !(c.species === line.species && Math.abs(c.rest_MHz - line.rest_MHz) < 0.001),
    );
    const blend = (peak.flags ?? []).includes("blend");
    const otherSpecies = [...new Set(others.filter((c) => c.species !== line.species).map((c) => c.species))];
    r.mezcla = blend ? `sí${otherSpecies.length ? ` (${otherSpecies.join(", ")})` : ""}` : "no";
    r.alternativas = others
      .slice(0, 5)
      .map((c) => `${c.species} ${c.rest_MHz.toFixed(3)} MHz @ ${c.v_kms.toFixed(2)} km/s`)
      .join(" | ");
  } else {
    r.metodo_incertidumbre = `incertidumbre de catálogo ${line.unc_MHz} MHz`;
  }
  r.decision = i.decision ?? "pendiente";
  return r;
}

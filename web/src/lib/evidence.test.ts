import { describe, expect, it } from "vitest";
import { EVIDENCE_COLUMNS, emptyRow, toCsv } from "./evidence";
import { prefillRow } from "./prefill";
import type { CatalogLine, Peak } from "./data";
import { dopplerVelocity } from "./spectro";

const line: CatalogLine = {
  id: 7, species: "CH3OCHO", catalog: "CDMS", entry: "060003", rest_MHz: 349050.12, unc_MHz: 0.01,
  logI_300K: -3.9, Eu_K: 110.2, El_cm1: 70, gu: 25, qn_up: "a", qn_lo: "b", window: "W1",
};
const peak: Peak = {
  id: "W1-Boff-001", freq_GHz: 349.0466, peak_Jy: 0.75, snr: 17.6,
  fit: { ok: true, center_GHz: 349.04661, fwhm_kms: 1.1, amp_Jy: 0.74, area_Jy_kms: 0.87, baseline_Jy: 0.004, center_err_MHz: 0.02 },
  flags: ["blend"],
  candidates: [
    { catalog_id: 7, species: "CH3OCHO", rest_MHz: 349050.12, v_kms: 3.01, delta_MHz: 0, Eu_K: 110.2, logI_300K: -3.9, unc_MHz: 0.01 },
    { catalog_id: 9, species: "C2H5OH", rest_MHz: 349051.0, v_kms: 3.77, delta_MHz: 0.9, Eu_K: 80, logI_300K: -4.2, unc_MHz: 0.01 },
  ],
};

describe("CSV de evidencia", () => {
  it("cabecera idéntica a data/evidencia_plantilla.csv", () => {
    expect(toCsv([]).trim()).toBe(
      "equipo,hipotesis,especie,catalogo,entrada,frecuencia_reposo_MHz,ventana,posicion,frecuencia_pico_LSRK_MHz,v_radio_kms,FWHM_kms,baseline_Jy_beam,sigma_Jy_beam,SNR,area_Jy_beam_kms,metodo_incertidumbre,grupo_rasgo,mezcla,alternativas,decision,archivo_figura",
    );
  });
  it("escapa comas, comillas y saltos de línea", () => {
    const r = emptyRow("eq");
    r.hipotesis = 'a, "b"\nc';
    const out = toCsv([r]).split("\n")[1];
    expect(out.startsWith('eq,"a, ""b""')).toBe(true);
  });
});

describe("prefillRow", () => {
  it("copia catálogo y ajuste, y calcula v con la convención radio", () => {
    const r = prefillRow({ team: "T", line, win: "W1", pos: "B_offset", peak, noise: { sigma_Jy: 0.02415 } });
    expect(Object.keys(r).filter((k) => k !== "_id")).toEqual([...EVIDENCE_COLUMNS]);
    expect(r.entrada).toBe("060003");
    expect(r.frecuencia_pico_LSRK_MHz).toBe("349046.6100");
    expect(Number(r.v_radio_kms)).toBeCloseTo(dopplerVelocity(349.04661, 349050.12), 3);
    expect(r.SNR).toBe("17.60");
    expect(r.sigma_Jy_beam).toBe("0.02415");
    expect(r.mezcla).toBe("sí (C2H5OH)");
    expect(r.alternativas).toContain("C2H5OH");
    expect(r.alternativas).not.toContain("CH3OCHO");
  });
  it("sin pico deja vacías las medidas", () => {
    const r = prefillRow({ team: "", line, win: null, pos: "A" });
    expect(r.frecuencia_pico_LSRK_MHz).toBe("");
    expect(r.SNR).toBe("");
    expect(r.ventana).toBe("");
  });
});

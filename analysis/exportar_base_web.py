"""Datos base del tablero: meta.json, catalog.json y spectra.json (frecuencias e intensidades, sin tocar).

Uso (desde la raíz del repositorio):  .venv/bin/python analysis/exportar_base_web.py
Después, `analysis/probabilidad.py` añade a spectra.json el bloque `noise` y escribe peaks.json y probabilidad.json.
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "web" / "public" / "data"
C = 299792.458
V_DADA = {"B_offset": 2.7, "B_pico": 2.7, "A": 3.2}   # km/s, dadas por los organizadores

prov = json.loads((DATA / "procedencia.json").read_text())
ventanas = {w["nombre"]: w for w in prov["ventanas"]}

# ---- meta: proyecto, posiciones (con su velocidad dada) y ventanas
meta = {
    "project": prov["proyecto"], "mous": prov["MOUS"], "source": "IRAS 16293-2422",
    "credit": "ADS/JAO.ALMA#2013.1.00278.S", "c_kms": C,
    "positions": {p: {"label": p.replace("_", " "), "v_start_kms": v} for p, v in V_DADA.items()},
    "windows": {},
}
for nombre, w in ventanas.items():
    for p, q in w["posiciones_extraidas"].items():
        meta["positions"][p].update({"ra_deg": q["ra_deg_real"], "dec_deg": q["dec_deg_real"],
                                     "pixel": [q["pixel_x_0"], q["pixel_y_0"]]})
    meta["windows"][nombre] = {"range_GHz": w["rango_GHz"], "channels": w["canales"], "step_MHz": w["paso_MHz"],
                               "step_kms": w["paso_kms_aprox"], "beam_arcsec": w["beam_arcsec"],
                               "beam_pa_deg": w["PA_deg"]}
(OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1, allow_nan=False))

# ---- espectros tal como vienen (el ruido lo calcula probabilidad.py)
spectra = {}
for nombre in ("W1", "W2"):
    d = pd.read_csv(DATA / "espectros" / f"{nombre}_espectros.csv")
    s = {"freq_GHz": [round(float(x), 7) for x in d.frecuencia_LSRK_GHz], "noise": {}}
    for p in V_DADA:
        s[p] = [round(float(x), 5) for x in d[f"{p}_Jy_beam"]]
    spectra[nombre] = s
(OUT / "spectra.json").write_text(json.dumps(spectra, separators=(",", ":"), allow_nan=False))

# ---- catálogo oficial (ventana en la que cae cada línea con la velocidad dada para B)
cat = pd.read_csv(DATA / "catalogos" / "catalogo_local.csv")
filas = []
for i, r in cat.iterrows():
    nu_obs = r.frecuencia_reposo_MHz / 1000 * (1 - V_DADA["B_offset"] / C)
    ventana = next((n for n, w in ventanas.items() if w["rango_GHz"][0] <= nu_obs <= w["rango_GHz"][1]), None)
    filas.append({
        "id": int(i), "species": r.especie, "catalog": r.catalogo, "entry": str(r.entrada).zfill(6),
        "rest_MHz": float(r.frecuencia_reposo_MHz), "unc_MHz": float(r.incertidumbre_MHz),
        "logI_300K": float(r.log10_I_300K_nm2_MHz), "Eu_K": round(float(r.E_superior_K), 2),
        "El_cm1": float(r.E_inferior_cm_1), "gu": int(r.g_superior),
        "qn_up": str(r.QN_superior).strip(), "qn_lo": str(r.QN_inferior).strip(), "window": ventana,
    })
(OUT / "catalog.json").write_text(json.dumps(filas, separators=(",", ":"), allow_nan=False))
print("escritos: meta.json, spectra.json (sin ruido), catalog.json")

"""Export base data (meta, spectra, catalog, continuum) to web/public/data/.
Run from repo root:  python analysis/export_web.py
"""
from pathlib import Path
import json, math
import numpy as np, pandas as pd
from astropy.io import fits

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = ROOT / "web" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)
C = 299792.458

prov = json.load(open(DATA / "procedencia.json"))
wins = {w["nombre"]: w for w in prov["ventanas"]}

def robust_sigma(y):
    med = np.median(y); mad = 1.4826 * np.median(np.abs(y - med))
    m = np.abs(y - med) < 3 * mad
    return float(np.std(y[m]))

# ---- meta
meta = {
    "project": prov["proyecto"], "mous": prov["MOUS"], "source": "IRAS 16293-2422",
    "credit": "ADS/JAO.ALMA#2013.1.00278.S", "c_kms": C,
    "positions": {
        "B_offset": {"label": "B · offset", "v_start_kms": 2.7},
        "B_pico": {"label": "B · pico", "v_start_kms": 2.7},
        "A": {"label": "A", "v_start_kms": 3.2},
    },
    "windows": {},
}
for name, w in wins.items():
    for p, q in w["posiciones_extraidas"].items():
        meta["positions"][p].update({"ra_deg": q["ra_deg_real"], "dec_deg": q["dec_deg_real"], "pixel": [q["pixel_x_0"], q["pixel_y_0"]]})
    meta["windows"][name] = {
        "range_GHz": w["rango_GHz"], "channels": w["canales"], "step_MHz": w["paso_MHz"],
        "step_kms": w["paso_kms_aprox"], "beam_arcsec": w["beam_arcsec"], "beam_pa_deg": w["PA_deg"],
    }
json.dump(meta, open(OUT / "meta.json", "w"), indent=1)

# ---- spectra
spectra = {}
for name in ("W1", "W2"):
    d = pd.read_csv(DATA / "espectros" / f"{name}_espectros.csv")
    s = {"freq_GHz": [round(float(x), 7) for x in d.frecuencia_LSRK_GHz]}
    s["noise"] = {}
    for p in ("B_offset", "B_pico", "A"):
        y = d[f"{p}_Jy_beam"].to_numpy()
        s[p] = [round(float(x), 5) for x in y]
        s["noise"][p] = {"sigma_Jy": round(robust_sigma(y), 5), "method": "MAD-clipped std, provisional"}
    spectra[name] = s
json.dump(spectra, open(OUT / "spectra.json", "w"), separators=(",", ":"))

# ---- catalog
cat = pd.read_csv(DATA / "catalogos" / "catalogo_local.csv")
rows = []
for i, r in cat.iterrows():
    window = None
    for name, w in wins.items():
        lo, hi = w["rango_GHz"]
        # observed freq at v in [0, 5] km/s
        obs_hi = r.frecuencia_reposo_MHz / 1000 * (1 - 0 / C)
        obs_lo = r.frecuencia_reposo_MHz / 1000 * (1 - 5 / C)
        if obs_hi >= lo and obs_lo <= hi:
            window = name
    rows.append({
        "id": int(i), "species": r.especie, "catalog": r.catalogo, "entry": str(r.entrada).zfill(6),
        "rest_MHz": float(r.frecuencia_reposo_MHz), "unc_MHz": float(r.incertidumbre_MHz),
        "logI_300K": float(r.log10_I_300K_nm2_MHz), "Eu_K": round(float(r.E_superior_K), 2),
        "El_cm1": float(r.E_inferior_cm_1), "gu": int(r.g_superior),
        "qn_up": str(r.QN_superior).strip(), "qn_lo": str(r.QN_inferior).strip(), "window": window,
    })
json.dump(rows, open(OUT / "catalog.json", "w"), separators=(",", ":"))

# ---- continuum
with fits.open(DATA / "cubos" / "continuo_IRAS16293.fits") as h:
    img = np.squeeze(h[0].data).astype(float)
    hdr = h[0].header
from astropy.wcs import WCS
wcs = WCS(hdr).celestial
pos = {}
for p in ("B_offset", "B_pico", "A"):
    x, y = wcs.world_to_pixel_values(meta["positions"][p]["ra_deg"], meta["positions"][p]["dec_deg"])
    pos[p] = {"x": float(x), "y": float(y)}
data = [[None if (math.isnan(v)) else round(v, 5) for v in row] for row in img]
cont = {"nx": int(img.shape[1]), "ny": int(img.shape[0]), "pixel_arcsec": abs(float(hdr["CDELT1"])) * 3600,
        "unit": hdr.get("BUNIT", "Jy/beam"), "data": data, "positions": pos,
        "beam_arcsec": [float(hdr.get("BMAJ", 0)) * 3600, float(hdr.get("BMIN", 0)) * 3600]}
json.dump(cont, open(OUT / "continuum.json", "w"), separators=(",", ":"))
print("exported:", sorted(p.name for p in OUT.iterdir()))
print("continuum positions (px):", pos)

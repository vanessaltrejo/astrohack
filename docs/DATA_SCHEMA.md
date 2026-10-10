# Shared data contract: `analysis/` → `web/public/data/`

All JSON files live in `web/public/data/` and are produced by `analysis/export_web.py`
(spectra, catalog, continuum) and `analysis/pipeline.py` (peaks, species scores).
The web app must treat these as read-only inputs. Frequencies in **GHz (LSRK, observed)**
unless the key says `rest_MHz`. Intensities in **Jy/beam**. Velocities in **km/s**, radio convention:
`v = c * (1 - nu_LSRK / nu_rest)`, `c = 299792.458`.

## `meta.json`
```json
{
  "project": "2013.1.00278.S", "mous": "uid://A001/X120/X13a", "source": "IRAS 16293-2422",
  "credit": "ADS/JAO.ALMA#2013.1.00278.S", "c_kms": 299792.458,
  "positions": {
    "B_offset": {"label": "B · offset", "ra_deg": 248.0940936, "dec_deg": -24.4757700, "pixel": [54,46], "v_start_kms": 2.7},
    "B_pico":   {"label": "B · pico",   "ra_deg": 248.0942279, "dec_deg": -24.4757089, "pixel": [50,48], "v_start_kms": 2.7},
    "A":        {"label": "A",          "ra_deg": 248.0953023, "dec_deg": -24.4768395, "pixel": [18,11], "v_start_kms": 3.2}
  },
  "windows": {
    "W1": {"range_GHz": [348.834448, 349.302446], "channels": 1918, "step_MHz": 0.24413, "step_kms": 0.2097, "beam_arcsec": [0.751, 0.611], "beam_pa_deg": -79.88},
    "W2": {"range_GHz": [349.303181, 349.771179], "channels": 1918, "step_MHz": 0.24413, "step_kms": 0.2094, "beam_arcsec": [0.826, 0.576], "beam_pa_deg": 88.36}
  }
}
```

## `spectra.json`
```json
{
  "W1": {
    "freq_GHz": [348.8344483, ...],            // 1918 values
    "B_offset": [..], "B_pico": [..], "A": [..], // 1918 values each, Jy/beam
    "noise": {"B_offset": {"sigma_Jy": 0.0427, "segments_GHz": [[348.90,348.92], ...]}, "B_pico": {...}, "A": {...}}
  },
  "W2": { ...same shape... }
}
```

## `catalog.json`
Array of rows (348), one per catalog transition (rest frame):
```json
{"id": 0, "species": "CH3OH", "catalog": "CDMS", "entry": "032504", "rest_MHz": 348823.577,
 "unc_MHz": 0.012, "logI_300K": -7.0865, "Eu_K": 223.8, "El_cm1": 143.93, "gu": 108,
 "qn_up": "13 013 1", "qn_lo": "12 210 2", "window": "W1"}   // window = which window covers it at v≈0..5 km/s (or null)
```
Species display names/colors are decided in the web app (one color per species, max 13).

## `continuum.json`
```json
{"nx": 256, "ny": 256, "pixel_arcsec": 0.11, "unit": "Jy/beam",
 "crop": {"x0": 42, "y0": 38, "nx": 64, "ny": 64},         // cube crop inside the continuum image
 "data": [[...256 floats...], ...256 rows],                  // NaN → null
 "positions": {"B_offset": {"x": 96, "y": 84}, "B_pico": {"x": 92, "y": 86}, "A": {"x": 60, "y": 49}}  // pixel coords in THIS image (0-based)
}
```

## `peaks.json`  (from `pipeline.py`)
```json
{
  "W1": {
    "B_offset": [
      {"id": "W1-Boff-001", "freq_GHz": 349.0466, "peak_Jy": 0.75, "snr": 17.6,
       "fit": {"ok": true, "center_GHz": 349.04661, "fwhm_kms": 1.1, "amp_Jy": 0.74, "area_Jy_kms": 0.87, "baseline_Jy": 0.004, "center_err_MHz": 0.02},
       "flags": ["blend"],                                   // any of: blend, absorption, edge, weak, asymmetric
       "candidates": [
         {"catalog_id": 123, "species": "CH3OCHO", "rest_MHz": 349050.12, "v_kms": 2.68, "delta_MHz": -0.05, "Eu_K": 110.2, "logI_300K": -3.9, "unc_MHz": 0.01}
       ]}
    ],
    "B_pico": [...], "A": [...]
  },
  "W2": {...}
}
```

## `species_scores.json` (from `pipeline.py`)
Per species × position, the velocity-consistency evidence:
```json
{
  "B_offset": {
    "CH3OCHO": {
      "n_predicted": 25,          // catalog lines inside W1+W2 with logI_300K above the species' strong-line threshold
      "n_matched": 18,            // of those, matched to a detected peak within tolerance at the common velocity
      "n_missing_strong": 1,      // strong predicted lines with NO emission (veto evidence)
      "v_mean_kms": 2.71, "v_std_kms": 0.18,
      "score": 0.82,              // 0–1, documented in analysis/README.md
      "verdict": "fuerte" | "tentativa" | "insuficiente" | "descartada",
      "lines": [{"catalog_id": 123, "rest_MHz": 349050.12, "Eu_K": 110.2, "logI_300K": -3.9,
                 "peak_id": "W1-Boff-001" | null, "v_kms": 2.68, "snr": 17.6, "blend": false}]
    }
  },
  "B_pico": {...}, "A": {...}
}
```

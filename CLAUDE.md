# AstroHack SATEM 2026 — equipo "Sparks" (tablero antes llamado "Huellas")

Team project for an astro-hackathon: identify prebiotic molecules in real ALMA Band 7 spectra of the
protostar **IRAS 16293‑2422** (ALMA 2013.1.00278.S, PILS; ARI‑L products). 4 people, ~12 active hours.
Deliverables: 2–3 page PDF report + ≤10 slides + reproducible ZIP + filled `evidencia` table + AI‑use declaration.
Rubric: ID 25 · astrobiology 20 · **creativity/tools 25** · presentation 20 · clarity/authorship 10.

## Layout
- `data/` — organizer package (CSV spectra, local catalog, provenance). Cubes are gitignored (symlinks). Never edit.
- `analysis/` — Python pipeline (`pipeline.py` → peaks, Gaussian fits, Doppler candidate matching,
  velocity‑consistency score per species). `figures.py`, `sensibilidad.py`, `validate_outputs.py`. Outputs in `analysis/outputs/`.
  README (Spanish) documents every formula/threshold. Run: `pip install -r analysis/requirements.txt && python analysis/pipeline.py && python analysis/figures.py`.
- `web/` — Next.js 15 + TS + Tailwind v4 static dashboard (Plotly for spectrum, SVG/D3 for small multiples/map).
  `npm run dev` / `npm run build` / `npm test` (vitest). Data contract: `docs/DATA_SCHEMA.md` → `web/public/data/*.json`.
- `docs/` — schema, interpretation guide (GUIA_INTERPRETACION), candidate verification, pipeline explainer, design notes.
- Root `README.md` / `PLAN_Y_TRACKER.md` belong to the team (vanessaltrejo/astrohack); keep them in sync when structure changes.
- `analysis/verificar_candidatas.py` — Boltzmann-pattern + PILS-literature check (refs in `analysis/referencias_pils.csv`).

## Science rules (from organizers — do not violate)
- Radio Doppler, applied ONCE: ν_rest = ν_LSRK / (1 − v/c), c = 299792.458 km/s. Adopted v: B_offset 2.62±0.03, B_pico 2.61±0.03, A 3.71±0.61 km/s.
- Never stitch W1 (348.834–349.302 GHz) and W2 (349.303–349.771 GHz). Units Jy/beam ≠ abundance. log10_I_300K ≠ Aij.
- Unresolved catalog rows = one feature. Noise from line‑free segments only. Flag absorption/blends, never delete.
- Credit line is mandatory: ADS/JAO.ALMA#2013.1.00278.S; cite ARI‑L, Jørgensen et al. 2016 (PILS), CDMS/JPL entries.

## Current results (pipeline v1)
Strong at B: CH3CN (10/10), CH2DOH (15/16), CH3CHO (7/7); C2H5CN (7/12) borderline; CH3OCHO tentative; **Glycine rejected**
(matches at 1.69 km/s, ~6σ off source velocity; strong line at 349249.6 MHz absent). Brightest line in band
(349627.8 MHz obs ≈ 349630.9 rest, SNR 73) is NOT in the local catalog → check full CDMS/JPL/Splatalogue. See `analysis/outputs/sin_identificar.csv`.
Red‑shifted absorption ~1 km/s from most B lines = infall signature (Pineda et al. 2012).

## Conventions
- UI and documents in Spanish; code/comments English OK. Commit messages in English.
- Don't fabricate data; every number in the report must trace to `analysis/outputs/`.

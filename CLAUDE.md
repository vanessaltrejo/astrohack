# Sparks · AstroHack SATEM 2026

Decision-support tool: for each line of the ALMA Band 7 spectrum of IRAS 16293-2422 (2013.1.00278.S), rank candidate
molecules and explain why. Full documentation (Spanish, team voice): `docs/DOCUMENTACION_COMPLETA.md`.

## Priority of sources
The team's criteria together with the judges' feedback > the competition documents (`Datos de ALMA/`, `Instrucciones/`,
`Presentacion de inicio/`, `Resultados y Evidencias de los Participantes/`) > existing code.

## Science rules (do not violate)
- Only transformation of the data: observed → rest, ν_rest = ν_LSRK / (1 − v/c), c = 299792.458 km/s, applied once.
  v is GIVEN (B 2.7, A 3.2 km/s); never estimate or fit it. Do not clean, smooth or question the data.
- Model: P(s|line) ∝ L_freq · L_Einstein · L_repeat · π_atoms · π_space · f_environment, plus "outside the catalogue".
  Einstein includes level population and the judges' range (A ≥ 1e-6 probable; ÷10 per decade below).
  π_atoms uses the CDMS census of 348 molecules; isotopologues outside the official catalogue count as unconfirmed.
- Never stitch W1/W2. Jy/beam ≠ abundance. Unresolved catalogue rows = one feature. Flag absorption, never delete.
- No p-values/FAP, no velocity fitting. Write strict JSON (no NaN); never patch symptoms — fix at the source.
- Credit: ADS/JAO.ALMA#2013.1.00278.S; ARI-L; Jørgensen et al. 2016 (PILS); CDMS/JPL.

## Layout
- `analysis/` engine (run order in README.md); outputs in `analysis/outputs/`.
- `web/` Next.js static site; data in `web/public/data/`; `npm test`, `npm run build` (stop the dev server first).
- UI and documents in Spanish, team voice ("nosotros"), no personal names or session dates. Commit messages in English.

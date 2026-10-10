# AstroHack SATEM 2026 · Sparks

Identificación de moléculas prebióticas en espectros ALMA Banda 7 de la protoestrella
**IRAS 16293-2422** (proyecto 2013.1.00278.S, productos ARI-L; ventanas W1 348.834–349.302 GHz y
W2 349.303–349.771 GHz; posiciones B_offset, B_pico y A).

Plan, reglas del concurso y tracker: [PLAN_Y_TRACKER.md](PLAN_Y_TRACKER.md).
Qué hay que hacer ahora en la parte de interpretación: [docs/GUIA_INTERPRETACION.md](docs/GUIA_INTERPRETACION.md).

## Estructura

| Carpeta | Qué contiene |
|---|---|
| `data/` | copia del paquete de los organizadores (CSV, catálogo local, plantilla de evidencia, procedencia). **No se edita.** Los cubos FITS no van al repo. |
| `analysis/` | pipeline científico en Python: ruido, picos, ajustes, Doppler, coherencia en velocidad por especie, FAP y veredictos. `README.md` documenta cada fórmula y umbral. Salidas en `analysis/outputs/`. |
| `web/` | tablero **Sparks** (Next.js, exportación estática): espectro interactivo, huellas por especie, mapa del continuo, candidatas y registro de evidencia exportable. |
| `docs/` | contrato de datos, guía de interpretación, verificación de candidatas, explicación del pipeline, notas de diseño. Aquí irán el informe y las diapositivas. |
| `notebooks/` | exploración y figuras adicionales del equipo. |

## Reproducir

```bash
pip install -r analysis/requirements.txt
python analysis/pipeline.py             # ~1 min: picos, ajustes, veredictos, figuras
python analysis/verificar_candidatas.py # patrón de Boltzmann + contraste con PILS
python analysis/validate_outputs.py     # contrato docs/DATA_SCHEMA.md (salida 0 = OK)
cd web && npm install && npm run dev    # tablero en http://localhost:3000
```

`npm run build` genera `web/out/` para publicar en Vercel (Root Directory = `web`).

## Resultados actuales (B_offset)

| Especie | Veredicto | Líneas | v (km/s) |
|---|---|---|---|
| CH₃CN, CH₂DOH, CH₃CHO | fuerte | 10/10, 15/16, 7/7 | 2.5–2.7 |
| C₂H₅CN | probable (fuerte en el límite) | 5 limpias | 2.57 |
| CH₃OCHO | tentativa (físicamente sólida) | 7/22 | 2.60 |
| Glicina‑I | descartada (control negativo) | 9 "coincidencias" a 1.69 km/s, 1 ausente | — |

Velocidad adoptada 2.62 ± 0.03 km/s (B_offset), 3.71 ± 0.61 km/s (A). Detalle y referencias en
[docs/VERIFICACION_CANDIDATAS.md](docs/VERIFICACION_CANDIDATAS.md).

## Créditos

This paper makes use of the following ALMA data: ADS/JAO.ALMA#2013.1.00278.S. ALMA is a
partnership of ESO (representing its member states), NSF (USA) and NINS (Japan), together with
NRC (Canada), NSTC and ASIAA (Taiwan), and KASI (Republic of Korea), in cooperation with the
Republic of Chile. The Joint ALMA Observatory is operated by ESO, AUI/NRAO and NAOJ.
Productos ARI-L · PILS (Jørgensen et al. 2016, A&A 595, A117) · catálogos CDMS y JPL.

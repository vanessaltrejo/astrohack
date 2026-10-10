# AstroHack SATEM 2026 · Asistente de identificación de líneas

Herramienta de apoyo a la decisión para proponer qué molécula explica cada línea
del espectro de IRAS 16293-2422 B (ALMA, banda 7, 348.83-349.77 GHz).

Estado y pasos: ver [PLAN_Y_TRACKER.md](PLAN_Y_TRACKER.md).

## Estructura
- `data/`: copia ligera de los datos oficiales (sin modificar)
- `src/lineid/`: núcleo de análisis
- `app/`: interfaz
- `notebooks/`: exploración y figuras del informe
- `results/`: tablas de evidencia y figuras
- `docs/`: informe, diapositivas y bitácora de uso de IA

## Reproducir
```bash
pip install -r requirements.txt
```
(Se irá completando conforme avance el análisis.)

## Créditos
ADS/JAO.ALMA#2013.1.00278.S · ARI-L · PILS (Jørgensen et al. 2016) · catálogos CDMS y JPL.

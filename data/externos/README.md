# data/externos/

Datos **añadidos por el equipo** (no forman parte del paquete oficial). El paquete oficial en `data/` no se modifica.

| Archivo | Qué es | Cómo se obtuvo |
|---|---|---|
| `splatalogue_CDMS_JPL_348.80-349.80GHz.csv` | 8977 transiciones (424 entradas) de CDMS y JPL entre 348.80 y 349.80 GHz, con log10 Aij, E_sup, g_sup | `astroquery.splatalogue.Splatalogue.query_lines`, listas CDMS+JPL, tramos de 0.05 GHz, consultado 2026-10-11 |
| `catalogo_local_con_aij.csv` | `catalogo_local.csv` + Aij de la **misma transición** (|tag|, g_sup, E_sup ±0.05 K, Δν < 1 MHz) | `analysis/v3/t2_aij_catalogo_local.py` |

Notas:
- 340/348 filas con Aij. Las 8 restantes (CH2(OH)CHO, E_sup 800–1340 K) quedan vacías: Splatalogue muestra g_sup truncada (p. ej. 11 en vez de 111) y su Aij hereda ese error.
- CH2(OH)CHO: el catálogo oficial usa la versión CDMS 2026 (`procedencia_catalogos.json`); Splatalogue, una anterior. Mismas transiciones (E_sup y g_sup idénticas), frecuencias distintas hasta 0.69 MHz. Se conserva la frecuencia oficial.
- Aij es el que publican CDMS/JPL; no se recalcula.

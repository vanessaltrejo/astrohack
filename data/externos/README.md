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
| `cdms_molecules_2026-09.html` | Copia de la página del censo CDMS (misma tabla que la diapositiva 5 de apertura) | descargada de https://cdms.astro.uni-koeln.de/classic/molecules, 2026-10-11 |
| `censo_cdms_2026-09.csv` | Censo estructurado: fórmula, nº de átomos (columna de la tabla), estado detectada/tentativa/cuestionada, solo_IR (`*`), año, URL | `analysis/v3/t1_censo_cdms.py` |
| `catalogo_ampliado.csv` | 6166 transiciones en la banda: 348 oficiales + 5818 CDMS/JPL, cada una con `visto_en_espacio`, `n_atomos`, `log10_Aij`, `isotopologo` | `analysis/v3/t2b_catalogo_ampliado.py` |

Notas del censo y del catálogo ampliado:
- La tabla CDMS tiene 349 filas; H2C(CH)3CN ? (E-1-ciano-1,3-butadieno) está cuestionada y CDMS no la cuenta → **348**, como la diapositiva.
- CDMS considera la glicina y la dihidroxiacetona "not yet detected" (detecciones cuestionadas): se etiquetan como no detectadas.
- La correspondencia nombre químico → molécula del censo es una tabla **revisada a mano** (`CENSO` en el script). No se usa sólo la composición, que confunde isómeros (p. ej. glicina ↔ carbamato de metilo).
- Isotopólogos (D, 13C, 18O, …) y estados vibracionales heredan la molécula madre del censo.
- Las especies del catálogo oficial usan sus filas oficiales; no se duplican con las de Splatalogue.

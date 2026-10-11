# data/

Copia **sin modificar** de los archivos del paquete oficial `AstroHack_datos_v1`
(ALMA 2013.1.00278.S, MOUS uid://A001/X120/X13a; IRAS 16293-2422) que usa el análisis.

| Archivo | Uso |
|---|---|
| `espectros/W{1,2}_espectros.csv` | Frecuencia LSRK (GHz) e intensidad (Jy/beam) en B_offset, B_pico y A |
| `catalogos/catalogo_local.csv` | 348 transiciones de 13 especies (CDMS/JPL), frecuencia de reposo (MHz) |
| `catalogos/LEEME_catalogos.txt`, `procedencia_catalogos.json` | Límites y procedencia del catálogo |
| `cubos/continuo_IRAS16293.fits` | Mapa de continuo (figura 6 del cuaderno de referencia) |
| `evidencia_plantilla.csv` | Columnas de la tabla de evidencia |
| `procedencia.json`, `SHA256SUMS.txt`, `LEEME_PRIMERO.txt`, `README_original_ARI_L.txt` | Ventanas, posiciones, huellas de integridad y créditos |

Los cubos W1/W2 (63 MB) no se incluyen; el cuaderno de referencia los lee del paquete original.
Lo que añadimos nosotros está en `externos/`.

This package makes use of the following ALMA data: ADS/JAO.ALMA#2013.1.00278.S.
Ver `LEEME_PRIMERO.txt` para el crédito completo.

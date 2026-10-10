# Huellas — tablero web

Tablero de una sola página para el AstroHack SATEM 2026: espectros ALMA reales de la
protoestrella IRAS 16293-2422 (proyecto 2013.1.00278.S, ventanas W1 y W2 a 349 GHz) y la
evidencia, línea por línea, de qué moléculas prebióticas aparecen en ellos.

El nombre del tablero está en `src/lib/config.ts` (`APP_NAME`); cámbialo ahí y se actualiza en
el título, la cabecera y el pie. En el mismo archivo están la declaración de IA (`AI_DECLARATION`)
y los rangos de los controles.

## Ejecutar en local

Requiere Node 22 y npm 10.

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

## Pruebas y build

```bash
npm test             # vitest: Doppler, cortes, canal más cercano, CSV de evidencia
npm run build        # exportación estática en web/out/ (sin backend)
npx serve out        # o: python3 -m http.server -d out 8000
```

`npm run build` comprueba tipos y lint; debe terminar sin errores.

## Desplegar

**Vercel.** Importa el repositorio y pon *Root Directory* = `web`. Vercel detecta Next.js;
con `output: "export"` publica la carpeta `out/` como sitio estático. No hace falta ninguna
variable de entorno.

**GitHub Pages.** El sitio vive en un subdirectorio (`/nombre-del-repo`), así que hay que
construir con la ruta base:

```bash
NEXT_PUBLIC_BASE_PATH=/nombre-del-repo npm run build
touch out/.nojekyll  # para que Pages sirva la carpeta _next/
```

y publicar `web/out/` (por ejemplo con la acción `actions/deploy-pages`).

## De dónde salen los datos

Todo se carga en el navegador con `fetch` desde `public/data/*.json`. El contrato está en
`docs/DATA_SCHEMA.md`; la web solo lee esos archivos, nunca los modifica.

| Archivo | Lo genera | Uso en el tablero |
|---|---|---|
| `meta.json` | `analysis/export_web.py` | posiciones, ventanas, haces, v inicial |
| `spectra.json` | `analysis/export_web.py` | espectros en Jy/beam y σ por posición |
| `catalog.json` | `analysis/export_web.py` | 348 transiciones CDMS/JPL de 13 especies |
| `continuum.json` | `analysis/export_web.py` | imagen de continuo 256×256 |
| `peaks.json` | `analysis/pipeline.py` | picos detectados y candidatas |
| `species_scores.json` | `analysis/pipeline.py` | marcador y estado de cada línea predicha |
| `pipeline_meta.json` | `analysis/pipeline.py` | opcional: v adoptada y línea base por posición |

Si `peaks.json` o `species_scores.json` todavía no existen, las vistas que los usan muestran
“Análisis en curso” y el resto del tablero funciona. Cuando el pipeline los publique, el botón
“Recargar análisis” los vuelve a pedir sin reconstruir el sitio (en `npm run dev`; en un sitio
ya desplegado hay que volver a construir y publicar).

Para regenerar los datos: `python analysis/export_web.py` y `python analysis/pipeline.py`
desde la raíz del repositorio.

## Ciencia compartida

`src/lib/spectro.ts` concentra las conversiones, con pruebas en `spectro.test.ts`:

- convención radio, marco LSRK: `v = c (1 − ν_LSRK / ν_reposo)`, `c = 299 792.458 km/s`;
  la corrección se aplica una sola vez;
- W1 y W2 nunca se unen: cada corte se hace dentro de su propia ventana;
- intensidades en Jy/beam; el eje de frecuencia es “Frecuencia LSRK (GHz)”.

## Estructura

```
src/app/            layout, página y estilos (Tailwind v4)
src/components/     Dashboard (estado), SpectrumView (Plotly, carga diferida),
                    PeaksTable, Fingerprints, FieldMap, EvidenceLog
src/lib/            data.ts (cargadores tipados), spectro.ts, species.ts (colores),
                    evidence.ts + prefill.ts (registro y CSV), config.ts
```

El registro de evidencia se guarda en el `localStorage` del navegador; exporta el CSV
(mismas columnas que `data/evidencia_plantilla.csv`) para entregarlo.

## Créditos

This paper makes use of the following ALMA data: ADS/JAO.ALMA#2013.1.00278.S. Cubos de
ARI-L; contexto de PILS (Jørgensen et al. 2016, A&A 595, A117); catálogos CDMS y JPL.

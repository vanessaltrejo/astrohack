# Sparks — tablero web

Tablero de una sola página para el AstroHack SATEM 2026: espectros ALMA reales de la
protoestrella IRAS 16293-2422 (proyecto 2013.1.00278.S, ventanas W1 y W2 a 349 GHz) y la
evidencia, línea por línea, de qué moléculas prebióticas aparecen en ellos.

El nombre del tablero (y del equipo) está en `src/lib/config.ts` (`APP_NAME`); cámbialo ahí y se
actualiza en el título, la cabecera y el pie. En el mismo archivo están la declaración de IA
(`AI_DECLARATION`), las etiquetas de fuente/proyecto/banda y los rangos de los controles.

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

`npm run build` comprueba tipos y lint; debe terminar sin errores. **Para antes el `npm run dev`**:
build y dev comparten la carpeta `.next`, y construir con el servidor de desarrollo abierto lo deja
sirviendo 404; reinícialo después de construir.

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

## Estructura de la página

| Zona | Qué hay |
|---|---|
| Cabecera fija | nombre, fuente · proyecto · banda, navegación 01–03, botón **Evidencia** (abre el cajón) y **Recargar** |
| Tira de estado | posición activa, v_LSR adoptada, σ W1/W2, haz, canal, picos, especies (todo en mono) |
| 01 Espectro | izquierda: espectro Plotly con controles (ventana, posición, v_LSR, especies, log I); derecha: veredicto de la posición y mapa del continuo con selector de posición |
| 02 Huellas | marcador de especies (tabla) y paneles de huella de la especie elegida; clic en un panel → ventana ampliada con los datos de la transición |
| 03 Candidatas | tabla de picos con candidatas; clic en fila → zoom en el espectro |
| Cajón Evidencia | registro editable (localStorage) y exportación CSV con las columnas de `data/evidencia_plantilla.csv` |
| Método | ventana con las convenciones (Doppler radio, LSRK, W1/W2 separadas, Jy/beam) |

## Diseño

Tres colores de interfaz: navy casi negro (`--color-night`), ámbar (`--color-accent`, interacción
y posición A) y azul frío (`--color-data`, posición B pico). Los colores de especie sólo aparecen
dentro de los gráficos y sus leyendas (`src/lib/species.ts`, paleta validada para visión del color
y atenuada para el fondo navy). Profundidad por hairlines, sin sombras ni desenfoques.

Tipografía: **Newsreader** (variable, eje óptico) para títulos, subtítulos en cursiva y la única
cifra grande de la página; **IBM Plex Sans** para todo lo demás, con cifras tabulares; **IBM Plex
Mono** únicamente para identificadores (`W2-Boff-050`, entradas de catálogo). Nada de etiquetas
en mono mayúscula ni secciones numeradas: cada número vive en un solo sitio.

Símbolos físicos con **KaTeX** (`src/components/Tex.tsx`): v_LSR, σ, ν, E_u, log I, Δv y las
fórmulas del diálogo *Método*. Iconos de **Lucide** en todos los controles; veredictos con icono
y palabra en minúscula.

Movimiento (`src/lib/motion.ts` + `globals.css`, sin librerías de animación): cabecera que se
compacta al hacer scroll; revelado único al entrar en pantalla con escalonado de ≤ 8 paneles;
trazado único de las huellas; fundido del espectro y `transition` de Plotly (250 ms) al cambiar
de posición o ventana; anillo que se expande una vez al activar una posición en el mapa; al
pasar el cursor por una especie (chips, marcador o resumen) sus guías se realzan en el espectro
y el resto se atenúa; filas de la tabla de picos que se reordenan con `@formkit/auto-animate`;
diálogos nativos `<dialog>` con `@starting-style`; esqueleto de carga inicial; hairline de
progreso bajo el espectro mientras se redibuja. Todo ≤ 500 ms y desactivado con
`prefers-reduced-motion`. Atajos de teclado: `1 2 3`, `e`, `m`, `w`, `b p a`, `?`.

Referencias y la crítica de "aspecto generado" que motivó estas decisiones:
`docs/DISENO_TABLERO_NOTAS.md`.

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
| `pipeline_meta.json` | `analysis/pipeline.py` | v adoptada, ruido y línea base por posición |

Si `peaks.json` o `species_scores.json` todavía no existen, las vistas que los usan muestran
“Análisis en curso” y el resto del tablero funciona. El botón “Recargar” los vuelve a pedir sin
reconstruir el sitio (en `npm run dev`; en un sitio ya desplegado hay que volver a construir).

## Ciencia compartida

`src/lib/spectro.ts` concentra las conversiones, con pruebas en `spectro.test.ts`:

- convención radio, marco LSRK: `v = c (1 − ν_LSRK / ν_reposo)`, `c = 299 792.458 km/s`;
  la corrección se aplica una sola vez;
- W1 y W2 nunca se unen: cada corte se hace dentro de su propia ventana;
- intensidades en Jy/beam; el eje de frecuencia es “Frecuencia LSRK (GHz)”.

## Código

```
src/app/            layout, página y estilos (Tailwind v4; tokens en globals.css)
src/components/     Dashboard (estado y disposición), SpectrumSection + SpectrumView (Plotly),
                    Fingerprints (marcador, paneles, ventana de detalle), FieldMap (mapa y
                    posiciones), PeaksTable, EvidenceLog, ui (SectionHead, Stat, Dialog, badges)
src/lib/            data.ts (cargadores tipados), spectro.ts, species.ts (colores),
                    evidence.ts + prefill.ts (registro y CSV), motion.ts (hooks de movimiento), config.ts
```

## Créditos

This paper makes use of the following ALMA data: ADS/JAO.ALMA#2013.1.00278.S. Cubos de
ARI-L; contexto de PILS (Jørgensen et al. 2016, A&A 595, A117); catálogos CDMS y JPL.

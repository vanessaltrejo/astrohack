# AstroHack SATEM 2026 · Plan y tracker del equipo

Entrega: **sábado 11 oct 2026, 11:00 am**. Objeto: IRAS 16293–2422 B, ALMA banda 7 (348.83–349.77 GHz).
Idea: app que ayude a decidir **qué molécula es más probable para cada línea** del espectro.

## 0. Reglas que no se negocian (de "Documento participantes.pdf")

| Qué | Detalle |
|---|---|
| Informe | PDF, 2–3 págs + referencias: pregunta, procedimiento, espectros comentados, interpretación astrobiológica, tabla de candidatas (líneas, catálogo, confianza), declaración de IA |
| Presentación | ≤10 diapositivas, 5 min + 3 de preguntas (ver duda #1), demo breve si hay herramienta, declarar IA |
| Carpeta de análisis | código/cuaderno + instrucciones + capturas, aportes por integrante, ZIP con nombre del equipo, **sin duplicar datos originales** |
| Evaluación (100) | Identificación molecular 25 · Astrobiología 20 · Creatividad/herramientas 25 · Presentación/defensa 20 · Claridad/autoría 10 |
| Desempate | Identificación molecular + astrobiología |
| Clave | Un resultado **tentativo bien sustentado** puede ser excelente. No inventar certeza. |

## 1. Mapa de datos (carpeta `Datos de ALMA/AstroHack_datos_v1/`)

**Núcleo (con esto basta para ganar):**
- `espectros/W1_espectros.csv`, `W2_espectros.csv` → columnas `frecuencia_LSRK_GHz`, `B_offset_Jy_beam`, `B_pico_Jy_beam`, `A_Jy_beam` (1918 canales c/u)
- `catalogos/catalogo_local.csv` → 348 transiciones, 13 especies distintas, reposo 348820–349790 MHz
- `evidencia_plantilla.csv` → esquema de salida de la tabla de evidencia (nuestra app debe poder exportarlo)
- `LEEME_PRIMERO.txt`, `procedencia.json`, `catalogos/LEEME_catalogos.txt` → unidades, límites, referencias

**Útil:** `herramientas/Inicio_AstroHack.ipynb` (funciones `candidatos`, `ruido_empirico`, `ajustar`; si las reutilizamos, declararlo).
**Extensión opcional:** `cubos/*.fits` (mapas espaciales; requiere `astropy`), columnas B_pico y A.
**Ignorar:** `SHA256SUMS`, `README_original_ARI_L`, `descargar_origen.py`, FITS/ASCII individuales (duplican los CSV).

**Documentos:** `Instrucciones/Documento participantes.pdf` (reglas) · `Instrucciones/Guia_de_datos_calibrados.pdf` (técnica) · `Presentacion de inicio/...pdf` (contexto).

## 2. Hechos técnicos a respetar
- Frecuencias del espectro = **LSRK observada**; catálogo = **reposo**. Doppler **una sola vez**: `ν_reposo = ν_LSRK / (1 − v/c)`, c = 299 792.458 km/s.
- v inicial para B ≈ **2.7 km/s** (A ≈ 3.2; no mezclar). Hay que verificarlo con varias líneas.
- Ruido: medir en segmentos **sin líneas**, nunca con toda la ventana. Valores negativos = revisar, no borrar.
- W1 y W2 **no se unen** (hay hueco de 0.736 MHz). Se analizan por separado.
- Jy/beam ≠ abundancia. Varias filas del catálogo pueden ser **un mismo rasgo** (no son evidencias independientes).
- `log10_I_300K` no es Aij ni brillo esperado.
- Una línea aislada = candidata, no identificación.

## 3. Sondeo previo (hecho en esta sesión, aproximado)
- Picos > 5σ en B_offset: **34 en W1, 33 en W2** (σ por MAD, sobreestimado por la densidad de líneas → rehacer con segmentos limpios).
- Barrido de velocidad sobre todos los picos: el máximo de coincidencias con el catálogo cae en **v = 2.7 km/s** (47/67 picos a <0.5 MHz, contra 14/67 con v = 0). La velocidad inicial se sostiene.
- OJO: con ±0.5 MHz y 348 líneas en ~940 MHz, **~1/3 de los picos coincidirían por azar**. Esto es justo lo que la app debe cuantificar.
- Especies con más picos casados: CH2DOH (17), CH3CHO (11), CH3CN (10), CH3OCHO (7), C2H5OH (4), C2H5CN (3), Glycine-I (2), CH3OH (1). Glicolaldehído (21 líneas en catálogo) no casó con ningún pico > 5σ. **Son pistas, no identificaciones.**

## 4. Diseño de la app ("Asistente de identificación de líneas")
Para cada línea (clic en pico o autodetectada) devuelve un **ranking de moléculas** con estos componentes:
1. **Coincidencia en frecuencia**: Δν entre pico y catálogo (tras Doppler) en unidades de σ_cat ⊕ ancho de línea ⊕ canal.
2. **Prueba de líneas hermanas**: las otras transiciones de esa especie que deberían verse (según Eu, intensidad relativa, Tex supuesta) ¿están presentes en W1/W2? ¿Hay las que *deberían* estar y faltan? (penaliza)
3. **Mezcla**: otras especies a menos de ~1 ancho de línea (marca "blend").
4. **Probabilidad de coincidencia fortuita**: desplazar el catálogo en offsets aleatorios (Monte Carlo) y contar cuántos aciertos da el azar.
5. **Veredicto**: Sólida / Tentativa / Insuficiente / Sin asignar, con razones legibles.
6. **Salida**: fila lista para `evidencia_plantilla.csv` + figura exportable.
Extra (si hay tiempo): comparar B_offset vs B_pico vs A; ajuste gaussiano con residuos; velocidad por consenso.

Stack propuesto: núcleo Python (numpy/pandas/scipy ya instalados) + UI con Streamlit/Plotly (hay que `pip install`). Plan B si falla la instalación: cuaderno con matplotlib + un HTML estático.

## 5. Plan por fases (marcar al avanzar)

> Congelar funcionalidades **3 h antes de las 11:00**. Después solo informe, diapositivas, ensayo y ZIP.

Estado: ⬜ pendiente · 🟦 en curso · ✅ hecho. Cada paso tiene un ID (S#) para citarlo en la bitácora.

### Fase 0 · Arranque (~30 min)
| ID | Paso | Resultado esperado | Estado |
|---|---|---|---|
| S0.1 | Repo: `git init`, remoto `github.com/vanessaltrejo/astrohack`, `.gitignore` (excluir `cubos/*.fits` y `.DS_Store`), estructura de carpetas (sec. 5.1) | Primer commit con tracker + plan | ✅ |
| S0.2 | Entorno: `pip install streamlit plotly astropy` (si falla → Plan B) | `python -c "import streamlit, plotly, astropy"` sin error | ⬜ |
| S0.3 | Roles + bitácora de IA abierta (sec. 7) | Nombres en la tabla | ⬜ |
| S0.4 | Dudas de la sec. 6 enviadas a organizadores | Respuesta sobre 5+3 vs 8+10 | ⬜ |

### Fase 1 · Datos → reposo → líneas (~1.5–2 h)
| ID | Paso | Resultado esperado | Estado |
|---|---|---|---|
| S1.1 | Cargar CSV W1/W2 y catálogo; comprobar unidades (GHz vs MHz) y nº de canales (1918) | `load_data()` + gráfica B_offset W1/W2 | ⬜ |
| S1.2 | **Módulo Doppler** `to_rest(ν_LSRK, v)` y `to_obs(ν_rest, v)` con v radio; prueba: 2.7 km/s a 349 GHz ≈ 3.14 MHz | Test pasa; **una sola** dirección usada en todo el proyecto | ⬜ |
| S1.3 | Ruido σ por ventana en ≥3 segmentos sin líneas (anotar intervalos) | σ_W1, σ_W2 documentadas | ⬜ |
| S1.4 | Detección de picos (umbral 3–5σ, mín. ancho) → tabla de rasgos (f_obs, altura, FWHM aprox.) | `rasgos.csv` | ⬜ |
| S1.5 | Primer cruce con catálogo a v = 2.7 km/s (tolerancia = σ_cat ⊕ canal ⊕ ancho) | `candidatas_v0.csv` | ⬜ |
| S1.6 | **Refinar v por consenso**: v de cada línea fuerte y aislada → mediana ± dispersión | v_B ± σ_v, figura v vs frecuencia | ⬜ |

### Fase 2 · Motor de identificación (~2–3 h)
| ID | Paso | Resultado esperado | Estado |
|---|---|---|---|
| S2.1 | Agrupar transiciones no resueltas en un solo rasgo (`grupo_rasgo`) | Sin doble conteo de evidencias | ⬜ |
| S2.2 | Coincidencia en z-score (Δν / σ_total) por candidata | Columna `z_freq` | ⬜ |
| S2.3 | Líneas hermanas: ¿están las otras transiciones esperadas de la especie (Eu, intensidad relativa)? ¿falta alguna que debería verse? | `n_presentes / n_esperadas` | ⬜ |
| S2.4 | Banderas de mezcla (otra especie dentro de ~1 ancho de línea) | Columna `mezcla` | ⬜ |
| S2.5 | Monte Carlo de coincidencia fortuita (catálogo desplazado a offsets aleatorios) | p-azar por especie | ⬜ |
| S2.6 | **Validación**: con v = 0 o catálogo desplazado el rendimiento debe colapsar | Figura para el informe | ⬜ |
| S2.7 | Veredicto (Sólida / Tentativa / Insuficiente / Sin asignar) con razones | Función `score()` | ⬜ |

### 5.1 Estructura propuesta del repo
```
astrohack/
├── README.md              # cómo reproducir (se pide en la entrega)
├── PLAN_Y_TRACKER.md
├── src/lineid/            # núcleo: io.py, doppler.py, noise.py, peaks.py, match.py, score.py
├── app/                   # interfaz (Streamlit)
├── notebooks/             # exploración y figuras del informe
├── results/               # rasgos.csv, evidencia.csv, figuras
├── docs/                  # informe, diapositivas, bitácora de IA
└── data/                  # copia de CSV + catálogo (los .fits de cubos/ NO se suben: 63 MB)
```

### Fase 3 · App (~3 h)
- [ ] Espectro interactivo con catálogo superpuesto
- [ ] Panel de candidatas por línea + veredicto + razones
- [ ] Exportar fila de evidencia y figura
- [ ] Probar con datos reales de principio a fin (la demo debe correr sin red)

### Fase 4 · Casos de estudio (~1 h)
La app analiza **todas** las líneas; para informe/demo se profundizan **5–6 casos** que muestren distintos comportamientos:
- [ ] 1–2 identificaciones sólidas (varias líneas hermanas)
- [ ] 1 mezcla (dos especies compiten)
- [ ] 1 ambigua/tentativa
- [ ] 1 candidata prebiótica (p. ej. glicina o glicolaldehído) → resultado honesto, aunque sea "insuficiente"
- [ ] 1 pico sin asignar (límite del catálogo local)

### Fase 5 · Astrobiología (~1 h)
- [ ] Por candidata: relevancia prebiótica + **1 fuente real** verificada (no confiar en la IA para citas)
- [ ] Qué NO permiten concluir los datos

### Fase 6 · Entregables (~3 h)
- [ ] Informe PDF 2–3 págs + referencias + declaración IA
- [ ] ≤10 diapositivas + guion de 5 min
- [ ] README reproducible + aportes por integrante
- [ ] ZIP `NOMBRE_EQUIPO.zip` (sin duplicar datos)
- [ ] Ensayo con cronómetro y preguntas del jurado ("¿cómo trataron unidades, Doppler, ruido, mezclas?")

## 6. Dudas / inconsistencias detectadas
1. **Tiempos de exposición**: el Documento de participantes dice *5 min + 3 de preguntas*; la diapositiva 26 de la presentación dice *8 min + 10 de preguntas*. Preparar para 5+3 y confirmar.
2. `verificar.py` reporta **1 error**: `LEEME_PRIMERO.txt` no coincide con su hash (la guía dice 0 errores). El contenido se ve normal; probablemente se editó después de calcular hashes. Mencionarlo a organizadores, no modificar nada.
3. El README del catálogo habla de "15 entradas"; el CSV contiene **13 especies distintas**.
4. Atribución obligatoria: `ADS/JAO.ALMA#2013.1.00278.S`, ARI-L, PILS (Jørgensen+2016), entradas CDMS/JPL usadas.

## 7. Bitácora de uso de IA (obligatoria en informe y slides)
| Fecha/hora | Herramienta | Para qué | Qué conservamos | Cómo lo verificamos | Quién |
|---|---|---|---|---|---|
| 10-oct | Claude Code | Lectura de PDFs/datos, sondeo de picos vs catálogo, borrador de plan | Plan y tracker | Revisión del equipo, contraste con PDFs | |

## 8. Bitácora de decisiones y hallazgos
(Anoten aquí cada decisión: qué, por qué, quién.)
-

## 9. Estado al 10‑oct (noche) — lo que ya está hecho en este repo

La estructura prevista en 5.1 (`src/lineid`, `app/` Streamlit) se sustituyó por lo que ya existe y
funciona: **`analysis/`** (pipeline Python, fases 1–2 completas) y **`web/`** (tablero Sparks,
fase 3 completa). Las carpetas vacías `app/`, `src/`, `results/` se retiraron para no confundir.

| Fase | Estado | Dónde |
|---|---|---|
| 1 · Datos → reposo → líneas | ✅ | `analysis/pipeline.py`, `analysis/README.md` (ruido, picos, Doppler una vez, v por consenso) |
| 2 · Motor de identificación | ✅ | mismo pipeline: rasgos agrupados, tolerancia, coherencia en v, FAP, veredictos; `sensibilidad.py`; `verificar_candidatas.py` (Boltzmann + literatura) |
| 3 · App | ✅ | `web/` (Next.js). Exporta `evidencia.csv` con las columnas de la plantilla |
| 4 · Casos de estudio | ⬜ | ver `docs/GUIA_INTERPRETACION.md` T1–T5 |
| 5 · Astrobiología | ⬜ | `docs/GUIA_INTERPRETACION.md` T6 (referencias ya verificadas en `docs/VERIFICACION_CANDIDATAS.md`) |
| 6 · Entregables | ⬜ | informe, ≤10 diapositivas, ZIP, declaración de IA (`web/src/lib/config.ts` aún dice "pendiente") |

Decisiones tomadas: C₂H₅CN se presenta como **probable**; A y B_pico van en el entregable; Vercel
para el tablero; se hará contraste LTE en CASSIS; la línea más brillante de la banda (S/N 73,
349 627.8 MHz LSRK) **no es formamida** y sigue sin identificar (Splatalogue pendiente, T3).

### Bitácora de IA (añadir a la tabla del punto 7)
| Fecha/hora | Herramienta | Para qué | Qué conservamos | Cómo lo verificamos | Quién |
|---|---|---|---|---|---|
| 10-oct | Claude Code | Pipeline de identificación v1, verificación automatizada (Boltzmann, PILS), docs de interpretación | `analysis/`, `docs/` | `validate_outputs.py`, reproducción en otra máquina, contraste con Calcutt+18 / Jørgensen+18 / Drozdovskaya+19 | JP |
| 10-oct | Claude Code | Tablero web Sparks (diseño, KaTeX, animaciones) con investigación de referencias | `web/` | `npm test`, `npm run build`, revisión visual del equipo | JP |

## 10. Plan v2 (11‑oct, 06:00) · ~~reemplazado por la sección 11~~

**Pitch (validado por un juez):** herramienta de **apoyo a la decisión**, no un modelo que "lo haga solo".
Para cada línea muestra qué moléculas la podrían explicar, **con qué probabilidad y por qué**; la decisión final es de la persona.

### 10.1 Los 4 parámetros que piden los jueces vs. lo que ya hay en `analysis/`

| Parámetro | ¿Está en el pipeline actual? | Qué falta |
|---|---|---|
| **Repetición** (que la molécula muestre varias líneas coherentes) | ✅ Es el corazón del pipeline: coherencia en velocidad, completitud, líneas ausentes, FAP | Nada; sólo explicarlo simple |
| **Coeficiente de Einstein (Aij)** | 🟡 No. Usa `log10_I_300K` como sustituto de intensidad relativa y evita Aij a propósito | Obtener Aij por fila (CDMS/JPL/Splatalogue) y usarlo en la intensidad esperada `∝ g_u·Aij·e^(−Eu/Tex)` |
| **Complejidad** (nº de átomos → probabilidad previa) | ❌ No existe | Prior a partir del censo CDMS (diapositiva 5 de apertura: 348 moléculas por nº de átomos) |
| **¿Detectada en el espacio?** | 🟡 Sólo como verificación posterior (`referencias_pils.csv`), no entra al cálculo | Prior: detectada en ISM / en IRAS 16293 / no detectada (glicina no está en el censo) |
| **Probabilidad por línea** | 🟡 Hay FAP por especie y veredictos por reglas (~30 umbrales); la web elige la candidata "más cercana en velocidad" | Ranking por línea con probabilidad que combine los 4 factores |

Conclusión: **se conserva** la capa de medición (ruido, picos, ajustes, Doppler, velocidad, agrupación de rasgos, repetición).
**Se agrega** una capa de probabilidad por línea con los 4 factores. Además, figuras al estilo del cuaderno oficial.

### 10.2 Modelo propuesto (simple y defendible)
Para un pico observado y cada molécula candidata *s* (más la opción "no está en el catálogo"):

`P(s | línea) ∝ L_frecuencia × L_Einstein × L_repetición × Prior_complejidad × Prior_espacio`

- **L_frecuencia** = `exp(−½·(Δν/tol)²)`: qué tan cerca cae la línea del catálogo tras el Doppler.
- **L_Einstein**: ¿la altura observada es compatible con `g_u·Aij·e^(−Eu/Tex)` escalado con las otras líneas de la especie? Una transición con Aij diminuto no explica un pico brillante.
- **L_repetición**: fracción de líneas fuertes de *s* que sí aparecen a la misma velocidad (sale del pipeline).
- **Prior_complejidad**: fracción del censo con ese nº de átomos (3 át. 48/348 · 6 át. 39/348 · 7 át. 26/348 · 8 át. 25/348 · 9 át. 19/348 · 10 át. 18/348).
- **Prior_espacio**: detectada en ISM = 1 · tentativa = 0.5 · no detectada = 0.1 (valores declarados y con prueba de sensibilidad).
- "**No está en el catálogo**": siempre es una opción (13 especies no cubren todo; la línea más brillante, SNR 73, no tiene candidata).

| Especie | Átomos | ¿En censo ISM (CDMS)? |
|---|---|---|
| SO2 | 3 | sí |
| CH3OH, ¹³CH3OH, CH2DOH, CH3CN, NH2CHO | 6 | sí (isotopólogos: la molécula madre) |
| CH3CHO | 7 | sí |
| CH3OCHO, CH2(OH)CHO | 8 | sí |
| C2H5OH, CH3OCH3, C2H5CN | 9 | sí |
| Glicina (NH2CH2COOH) | 10 | **no** |

### 10.3 Plan por bloques (hoy, entrega 11:00)

> **09:15 se congela el código.** Después sólo informe, diapositivas, ensayo y ZIP.

| ID | Hora | Paso | Resultado | Quién | Estado |
|---|---|---|---|---|---|
| P1 | 06:15–06:45 | Tabla de propiedades por especie: átomos, censo ISM, detección en IRAS 16293 (con cita) | `data/especies_props.csv` (nuestro, no del paquete) | | ⬜ |
| P2 | 06:30–07:30 | **Aij**: calcular desde `log10_I_300K` con Q(300 K) de cada entrada (fórmula JPL) y **validar 2 líneas/especie contra Splatalogue/CDMS** | `analysis/aij.py`, `outputs/catalogo_con_aij.csv` | | ⬜ |
| P3 | 07:30–08:30 | Probabilidad por línea con los 4 factores + opción "fuera del catálogo" | `analysis/probabilidad.py`, `outputs/probabilidad_lineas.csv` | | ⬜ |
| P4 | 08:15–08:45 | Validación: glicina baja; línea SNR 73 → "fuera del catálogo"; cambiar priors ×2 no voltea las fuertes | tabla de sensibilidad | | ⬜ |
| P5 | 08:00–09:15 | Cuaderno con **las gráficas de referencia** del cuaderno oficial: espectro W1/W2, `candidatos()`, `ruido_empirico()`, `ajustar()` (gauss + residuos en velocidad) para 5–6 líneas demo + barras de probabilidad | `notebooks/01_referencia_y_probabilidad.ipynb` | | ⬜ |
| P6 | 08:30–09:15 | Web: mostrar barras de probabilidad por línea en la tabla de picos (si no da tiempo: captura del cuaderno) | `web/` | JP | ⬜ |
| P7 | 09:15–10:15 | Informe 2–3 págs + tabla de candidatas + declaración IA | `docs/informe.pdf` | | ⬜ |
| P8 | 09:15–10:15 | ≤10 diapositivas (pitch: apoyo a la decisión) + demo | `docs/presentacion.pdf` | | ⬜ |
| P9 | 10:15–10:45 | README reproducible, aportes por integrante, ZIP con nombre del equipo, ensayo con cronómetro | `NOMBRE.zip` | | ⬜ |

### 10.4 Riesgos
- **Defensa**: el pipeline tiene ~1300 líneas y ~30 umbrales generados con IA. Todos deben poder explicar los **5 factores** y el flujo; no hace falta defender cada umbral.
- **Aij**: el paquete advierte no convertir sin verificar Q(T) y degeneraciones → por eso P2 incluye validación contra Splatalogue.
- **Priors**: son supuestos; se declaran y se muestra que las conclusiones fuertes no dependen de ellos.

## 11. Plan v3 (11‑oct, 06:20) · VIGENTE

### 11.0 Reglas de autoridad
1. **La palabra de Vanessa (y lo que transmite de los jueces) va por encima de todo.**
2. Después, los documentos base: `Datos de ALMA/`, `Instrucciones/`, `Presentacion de inicio/`, `Resultados y Evidencias de los Participantes/`.
3. Al final, el código existente (`analysis/`, `web/`), que se adapta a lo anterior.

Indicaciones de los jueces:
- Los datos **no se limpian ni se cuestionan**.
- La **velocidad es la dada**: B ≈ 2.7 km/s (Guía p. 8 y cuaderno oficial), A ≈ 3.2 km/s (diapositiva 22). **No se estima.**
- Se usa el **universo de 348 moléculas** del censo (diapositiva 5), no sólo las del catálogo local. El modelo debe dar el mismo resultado con 15 que con 30 candidatas.
- La herramienta combina matemática **y** factores externos de cada molécula (condiciones bióticas y abióticas).

### 11.1 Qué se rescata del pipeline de JP y qué se elimina

| Paso de JP | ¿Se queda? | Por qué |
|---|---|---|
| 1. Desviación estándar (ruido) | ✅ **simplificada** al método del cuaderno oficial (`ruido_empirico`: segmentos sin líneas, mediana restada) | Está en los documentos base. Se quitan la máscara iterativa, ρ/κ y el suavizado de A |
| 2. Identificar candidata | ✅ = `candidatos()` del cuaderno oficial, con v **fija** | Base documental |
| — Agrupar filas no resueltas en un rasgo | ✅ | Guía p. 7: no contarlas como evidencias independientes |
| — Ajuste gaussiano | ✅ sólo descriptivo (FWHM, figuras) = `ajustar()` oficial | Base documental |
| — Absorciones marcadas, no borradas | ✅ | Guía p. 8 |
| — Lista de picos sin identificar | ✅ | Útil para la opción "fuera del catálogo" |
| — Líneas hermanas presentes / ausentes | ✅ **es el factor "se repite"** de los jueces, ahora a velocidad fija | Lo piden los jueces |
| 3. Error de velocidad por pico | ❌ | No se estima la velocidad. La cercanía en frecuencia ya entra en L_frecuencia |
| 4. Coherencia contra ese error | ❌ | Depende del paso 3 |
| 5. p‑value / FAP | ❌ | No lo pidieron. Lo sustituye la probabilidad por línea |
| Velocidad adoptada, rejilla de v, correlación cruzada, ajuste de Boltzmann, ~30 umbrales de veredicto, `sensibilidad.py` | ❌ | Fuera del alcance pedido |
| Infraestructura (carga de datos, exportar JSON a la web, validador) | ✅ | Se reutiliza |

### 11.2 Modelo por línea (v3)
Para cada pico, y cada molécula candidata *s* del catálogo ampliado, más la opción "fuera del catálogo":

`P(s | línea) ∝ L_frecuencia · L_Einstein · L_repetición · Prior_complejidad · Prior_espacio · Factor_entorno`

| Factor | Qué mide | Fuente |
|---|---|---|
| L_frecuencia | `exp(−½(Δν/tol)²)` con v dada, tol = canal ⊕ incertidumbre del catálogo | espectro + catálogo |
| L_Einstein | intensidad esperada `∝ g_u·Aij·e^(−Eu/T)`. Una transición débil no explica un pico brillante | Aij de CDMS/JPL |
| L_repetición | fracción de las líneas esperables de *s* en W1/W2 que sí aparecen a la v dada | espectro |
| Prior_complejidad | nº de moléculas del censo con ese nº de átomos / 348 | diapositiva 5 |
| Prior_espacio | detectada en ISM = 1 · tentativa (?) = 0.5 · no detectada = 0.1 | censo CDMS |
| Factor_entorno | compatibilidad de sus condiciones abióticas favorables con un núcleo caliente protoestelar (IRAS 16293 B) | ficha de la molécula |

Interés prebiótico/biótico: **pendiente de decisión de Vanessa** (ver 11.4 #2).

### 11.3 Pasos (sólo la herramienta; pitch y ensayo quedan para después)

| ID | Hora | Paso | Resultado | Estado |
|---|---|---|---|---|
| T1 | 06:30–07:30 | **Base de datos de las 348 moléculas** (lista limpia del censo CDMS citado en la diapositiva 5): fórmula, nombre, nº de átomos, detectada/tentativa, descripción, condiciones abióticas favorables, relevancia biótica/prebiótica. Fichas redactadas con IA marcadas como borrador; las ~15 relevantes, verificadas con cita | `data/externos/censo_cdms_2026-09.csv`, `fichas_moleculas.json` | ✅ (fichas: borrador IA, verificación pendiente) |
| T2 | 06:30–07:30 | **Catálogo ampliado con Aij**: transiciones de moléculas del censo en 348.8–349.8 GHz desde CDMS/JPL (vía Splatalogue), con Aij, Eu, g_u e incertidumbre. El catálogo local queda intacto | `data/externos/catalogo_local_con_aij.csv`, `catalogo_ampliado.csv` | ✅ |
| T3 | 07:30–08:30 | **Motor v3**: datos crudos, v fija, ruido oficial, picos, factores 11.2, opción "fuera del catálogo" | `analysis/v3/probabilidad.py`, `analysis/v3/outputs/` | ✅ |
| T4 | 08:30–09:00 | **Pruebas**: (a) mismo ranking con el catálogo local (13–15), con ~30 y con el ampliado; (b) glicina baja; (c) línea SNR 73 → "fuera del catálogo" o candidata nueva; (d) detecciones PILS conocidas arriba | `analysis/v3/t4_pruebas.py`, `outputs/pruebas_T4.json` | ✅ |
| T5 | 08:00–09:00 | **Gráficas de referencia** reproducidas del cuaderno oficial: espectro W1/W2 B_offset, ruido, `candidatos`, `ajustar` (gauss + residuos), verificación del cubo | `notebooks/01_graficas_referencia.ipynb` + PNG en `web/public/figs/` | ✅ (falta mostrarlas en el sidebar, T6) |
| T6 | 09:00–10:00 | **Dashboard**: (1) quitar los botones y la navegación de arriba; (2) **sidebar delgado a la derecha** con las secciones existentes + "Moléculas (348)" con buscador y ficha + "Gráficas de referencia (Python)"; (3) barras de probabilidad por línea; (4) quitar el control de velocidad (v fija) | `web/` | ⬜ |
| T7 | 10:00–10:15 | Congelar código, `npm run build`, revisión final | | ⬜ |
| T8 | 10:15–11:00 | Mínimo entregable (informe, ZIP); secundario | | ⬜ |

### 11.4 Puntos a resolver
1. **Aij no viene en el paquete.** `catalogos/LEEME_catalogos.txt`: "No se entrega Aij…"; Guía p. 7: "El paquete no incluye ese coeficiente". Propuesta alineada con "escoger el adecuado": **tomar Aij tal cual de CDMS/JPL** (las bases oficiales que cita la guía), sin convertir nada nosotros.
2. **Interés biótico en la probabilidad.** Recomendación: que las condiciones **abióticas** (entorno) sí entren como factor, y que la relevancia **biótica/prebiótica** se muestre al lado sin multiplicar. Si multiplica, la herramienta favorecería lo que "queremos encontrar" (p. ej. glicina). Decide Vanessa.
3. **Dos "348" distintos.** El censo tiene 348 **moléculas**; el catálogo local, 348 **transiciones** de 13 especies (su LEEME dice 15 entradas). Usamos el censo como universo.

### 11.5 Bitácora v3
| Hora | Paso | Resultado |
|---|---|---|
| 06:25 | T5 | 6 gráficas oficiales reproducidas. Única transformación: observado → reposo (v = 2.7 B, 3.2 A). Comprobado: hashes idénticos al paquete, 2.7 km/s = 3.14 MHz a 349 GHz, extracción del cubo exacta. Ajuste CH3CN 19₀–18₀: centro 2.37 km/s, FWHM 1.41 km/s, con caída al rojo en los residuos (descriptivo) |
| 06:30 | T2 | Aij de CDMS/JPL (Splatalogue) pegado a la MISMA transición: 340/348 filas oficiales. 8 de glicolaldehído sin Aij (Splatalogue trunca g_u). Glicolaldehído oficial = versión CDMS 2026 (frecuencias distintas hasta 0.69 MHz) |
| 06:33 | T1 | Censo CDMS 09/2026: 349 filas, 348 cuentan (H2C(CH)3CN cuestionada). Glicina y dihidroxiacetona: 'not yet detected' según CDMS |
| 06:34 | T2b | Catálogo ampliado: todas las especies CDMS/JPL en banda, etiquetadas con el censo mediante tabla revisada a mano (la composición confunde isómeros: glicina ↔ carbamato de metilo) |
| 06:36 | T1 | 436 fichas (32 manuales). Entorno → factor (hot corino/ubicua 1, nube fría 0.5, circunestelar/atmósfera 0.1). Corregidos: NO/HO2 y ArH+/HeH+ mal clasificados |
| 06:40 | T3 | Motor v3. Errores encontrados y corregidos al revisar: (1) 18OD con Eu = 16 597 K ganaba un pico → término de población de Boltzmann en el factor Einstein; (2) filas con incertidumbre de cientos de MHz → se excluyen > 1 MHz y L_frecuencia normalizada; (3) misma transición en CDMS y JPL contada 2 veces (D2CO) → deduplicación por E_sup y Δν < 1 MHz |
| 06:45 | T4 | Robustez: 13→30 especies, mismo ganador 98 %; 13→todas, 89 %. Glicina: P máx 0.023, nunca gana. Línea más brillante (349631.0 MHz reposo, SNR 73) → D2CO 6(2,5)–5(2,4), P 0.86, 1 sola línea (tentativa). Sensibilidad a supuestos: 85–100 % igual |

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

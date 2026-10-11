> **AVISO (11-oct-2026): este pipeline es la primera iteración (v1) y ya NO lo usa el tablero.**
> Estima la velocidad, calcula p-value/FAP y emite veredictos; los jueces pidieron otra cosa (velocidad dada, datos sin
> cuestionar, probabilidad por línea con 4 factores). El motor vigente está en [`analysis/v3/`](v3/) y se documenta en
> [`docs/DOCUMENTACION_COMPLETA.md`](../docs/DOCUMENTACION_COMPLETA.md). Se conserva como referencia histórica.

# Pipeline científico · AstroHack SATEM 2026

IRAS 16293-2422 · ALMA 2013.1.00278.S (ARI-L, 12 m) · ventanas W1 (348.834–349.302 GHz) y
W2 (349.303–349.771 GHz) · posiciones B_offset (principal), B_pico y A.

Objetivo: decidir, con evidencia reproducible, qué especies del catálogo local están presentes
en cada posición. El método es **coherencia en velocidad**: una especie real produce
*varias* líneas, todas a la *misma* velocidad, con intensidades relativas plausibles, y sin que
falten líneas que deberían verse.

## Cómo ejecutar

```bash
pip install -r analysis/requirements.txt
python analysis/pipeline.py            # ~40-50 s con figuras; --no-figures: ~6 s
python analysis/validate_outputs.py    # comprueba el contrato docs/DATA_SCHEMA.md (salida 0 = OK)
python analysis/sensibilidad.py        # opcional, ~40 s: veredictos con umbrales alternativos
python analysis/verificar_candidatas.py  # ~5 s: patrón de Boltzmann + contraste con PILS + picos compartidos
```

`export_web.py` (meta, catalog, continuum, spectra base) no necesita volver a ejecutarse;
`pipeline.py` sólo reescribe el bloque `noise` de `spectra.json`.

Todos los umbrales están en la clase `Config` de `pipeline.py` (se copian a
`web/public/data/pipeline_meta.json`). Los números de este README salen de esa ejecución.

## Convenciones

- Frecuencias observadas LSRK; velocidad **radio**: `v = c (1 − ν_obs/ν_rest)`,
  `ν_rest = ν_obs / (1 − v/c)`, `c = 299792.458 km/s`. El Doppler se aplica **una sola vez**:
  siempre se compara `ν_obs` medida con `ν_rest(1 − v/c)` predicha.
- Canal: 0.24413 MHz ≈ 0.21 km/s. W1 y W2 **no se unen** (hueco de 0.736 MHz).
- Intensidades en Jy/beam (píxel único, sin suma de apertura).

## Método

### a. Ruido (por ventana × posición)

1. Estimador inicial de **envolvente inferior**: rms local en ventanas de 25 canales (paso 5,
   tendencia lineal restada); `σ0` = percentil 25 de esos rms. No usa la mediana de todo el
   espectro, por lo que funciona aunque la mayoría de los canales tenga emisión.
2. Máscara iterativa de líneas: `|y − b| > 3σ`, dilatada ±6 canales en B y **±30 canales
   (~6 km/s) en A**, porque las alas de las líneas anchas de A quedan por debajo de 3σ y
   contaminan cualquier estimador tipo MAD. Durante la iteración `σ ≤ 1.5 σ0` (sin este tope,
   en A/W1 la máscara divergía al absorber alas como "ruido").
3. Segmentos = tramos libres contiguos de ≥15 canales (B) o ≥20 (A) cuya mediana dista < σ
   de la línea base. Se eligen hasta 6, los más largos, separados ≥20 MHz.
4. `σ` = desviación estándar de la concatenación de los segmentos, restando a cada uno su
   mediana. Los segmentos usados se publican en `spectra.json → noise.segments_GHz` y en
   `outputs/ruido.csv`.

**Canales correlacionados.** Autocorrelación medida en los segmentos: ρ₁ ≈ 0.57–0.76. Factor
de inflación de varianza `κ = 1 + 2 Σ_{k=1..3} ρ_k` (3.2–5.0). Todos los errores formales de
los ajustes (centro, área) se multiplican por `√κ`: **no** se asume `√N` independiente.

| Ventana | Posición | σ (mJy/beam) | σ0 envolvente | ρ₁ | κ | nº segmentos |
|---|---|---|---|---|---|---|
| W1 | B_offset | 24.1 | 25.8 | 0.63 | 3.5 | 6 |
| W1 | B_pico | 38.3 | 39.3 | 0.76 | 4.2 | 6 |
| W1 | A | 20.6 | 19.4 | 0.65 | 4.1 | 6 |
| W2 | B_offset | 24.4 | 28.2 | 0.57 | 3.2 | 6 |
| W2 | B_pico | 35.2 | 40.3 | 0.69 | 3.9 | 6 |
| W2 | A | 27.5 | 21.5 | 0.75 | 5.0 | 3 |

En W2/A sólo hay 3 tramos libres de ≥20 canales: es el mínimo exigido y se declara.

### b. Detección de picos

`scipy.signal.find_peaks` sobre `y` (B) o sobre `y` suavizado con gaussiana σ = 2 canales (A,
líneas de ~6 km/s), y lo mismo sobre `−y` para **absorciones**:
altura ≥ 4σ, prominencia ≥ 3σ, distancia mínima 3 canales (B) / 10 (A), anchura ≥ 2 / 5
canales. `snr = |pico − b|/σ`. Picos con 4 ≤ SNR < 5 → bandera `weak`. Las absorciones se
conservan con bandera `absorption`: no se borran ni se usan como evidencia de identificación.

### c. Ajuste gaussiano local (descriptivo)

Modelo: base lineal + gaussiana objetivo + hasta 5 picos vecinos detectados dentro de ±12
canales (B) / ±45 (A), ajustados a la vez (`curve_fit`, `absolute_sigma`, σ del ruido).
FWHM permitido 0.25–5 km/s (B), 1–20 km/s (A). Se reporta centro, FWHM (km/s), amplitud,
área = `A·σ_v·√(2π)` (Jy/beam·km/s) con su error por covarianza, base en el centro y error
formal del centro (MHz), todo ×√κ. Banderas a partir de los residuos:

- `blend`: residuo en el núcleo (±1 FWHM) > max(4σ, 10 % de |A|), o un vecino **del mismo
  signo** solapado (|Δμ| < 0.6 (FWHM₁ + FWHM₂)). El umbral relativo evita llamar mezcla a la
  mera no-gaussianidad de líneas de SNR ~40.
- `asymmetric`: asimetría de residuos (Σ derecha − Σ izquierda) > 3σ (con κ), **o** una
  componente de signo opuesto solapada (emisión + absorción: campo extra
  `adjacent_absorption = true`). En ese caso la amplitud y el área de la componente de emisión
  son dependientes del modelo (degeneradas con la absorción); el centro sigue siendo útil.
- `edge`: a < 10 (B) / 25 (A) canales del borde, o ajuste que se sale de la ventana.

### d. Candidatos por pico

Todas las transiciones con velocidad implícita `v = c(1 − ν_pico/ν_rest)` en [−2, 8] km/s. Para
cada una se guarda `v_kms`, `delta_MHz = ν_cat − ν_pico/(1 − v_pos/c)` (a la velocidad
adoptada de la posición), `Eu_K`, `logI_300K`, `unc_MHz`.

### e. Puntuación de coherencia en velocidad (especie × posición)

**Rasgos (agrupación).** Filas de una misma especie a menos de
`max(2 canales, 0.5·FWHM_típico)` en frecuencia de reposo (encadenadas) forman **un único
rasgo** no resuelto (p. ej. CH₃CN K=3 A1/A2, cuartetos de glicina): nunca cuentan como
evidencias independientes. `logI` del rasgo = log₁₀ Σ 10^logI; frecuencia ponderada por
intensidad; `unc` = máxima. Filas con `unc > 1 MHz` se excluyen por no identificables
(CH₃CHO: 24 filas; glicina: 11; C₂H₅OH: 8; CH₂DOH: 6; se reportan como `n_excluded_unc`).
FWHM típico (mediana de picos aislados SNR ≥ 8): **1.01 km/s (B_offset), 1.16 (B_pico),
5.91 (A)**.

**Rasgos fuertes.** `logI_rasgo ≥ max(logI de la especie en cobertura) − 1.5 dex`
(factor ~30). `logI_300K` se usa **sólo** como ranking relativo dentro de la especie.

**Tolerancia de coincidencia** (por línea):
`tol = max(2 canales, 0.5·FWHM_pico, 3·unc_cat)`, con `FWHM_pico ≤ FWHM_típico` (un ajuste
ancho por mezcla no abre la tolerancia). Para la glicina (unc 0.2–0.8 MHz) la tolerancia
llega a 2 km/s: el método se lo permite, y aun así la descarta (ver resultados).

**Búsqueda de velocidad.** Rejilla 0–6 km/s, paso 0.05 km/s (paso 1, libre). Para cada `v`,
asignación uno-a-uno rasgo↔pico de emisión (por menor (Δ/tol)²); se elige el máximo nº de
coincidencias (desempate: menor Σ(Δ/tol)²; se toma el centro de la meseta).
**Paso 2:** con la velocidad de la posición `v_pos` (abajo) cada especie se re-evalúa en
`v_pos ± 1 km/s` (B) o `± 2 km/s` (A): las moléculas de un mismo núcleo caliente comparten
velocidad sistémica. El veredicto publicado es el del paso 2; el paso 1 queda como
diagnóstico (`v_best_free_kms`, `n_matched_free`).

**Escala de intensidad (relativa, dentro de la especie).** Dos escenarios Tex = 100 y 300 K:
`logI_T = logI_300 − Eu·(1/T − 1/300)/ln 10` (la función de partición es común a la especie y
se cancela en cocientes). Escala = amplitud observada / 10^logI_T sobre las coincidencias:
- *mediana* → para detectar coincidencias **demasiado brillantes** (> 10× lo esperado en el
  Tex más favorable: la emisión existe pero la domina otro portador; no cuentan) y para los
  confusores;
- *mínima* (conservadora: cada pico es una **cota superior** de la contribución de la
  especie, porque otros portadores sólo suman flujo) → para el veto.

**Estado de cada rasgo fuerte** (`lines[].detail`; `status` usa el contrato web
matched/unmatched/missing):

| detail | criterio | status |
|---|---|---|
| matched | pico de emisión asignado dentro de la tolerancia | matched |
| overbright | pico asignado pero > 10× el esperado | unmatched |
| ambiguous | sin pico asignado, pero hay señal (emisión o absorción) > 3σ en ±tol | unmatched |
| missing | esperado (escala mínima, Tex menos favorable) ≥ 6σ y **ninguna** señal > 3σ en ±tol | missing |
| below_limit | ni señal ni expectativa ≥ 6σ | unmatched |

**Confusión.** Una coincidencia no es *limpia* (`blend = true`) si el pico tiene `blend`, si
sus residuos son asimétricos sin absorción adyacente que lo explique, o si un rasgo fuerte de
**otra especie plausible** (fuerte/tentativa en el paso 1) cae en la tolerancia del mismo pico
con intensidad esperada ≥ max(3σ, 20 % del pico observado).

**Probabilidad de falsa alarma (FAP).** Bajo la hipótesis nula, una coincidencia es un pico
cualquiera que cae por azar en la tolerancia:
`p_i = 1 − exp(−λ · 2 tol_i)`, `λ` = picos de emisión detectados por MHz en la ventana.
`P(X ≥ n_matched)` con X Poisson-binomial sobre los rasgos que *podrían* producir una
coincidencia contable (se excluyen los esperados < 4σ/10, que serían siempre "overbright"),
multiplicada por el nº de ensayos en velocidad `N_v = Δv_búsqueda / (2·tol_mediana)`.

**Velocidad de la especie.** `v_mean_kms`, `v_std_kms` de las coincidencias **limpias** si
hay ≥ 2 (los centroides mezclados están sesgados); si no, de todas.

**Coherencia con la fuente (paso 2).**
`|v_mean − v_pos| ≤ max(0.5·FWHM_típico, 3·σ_Δ)`, `σ_Δ² = v_std²/n + err(v_pos)²`.

**Score (0–1)**, resumen continuo:

```
score = completitud × calidad × S × 0.5^n_missing × (0.5 si incoherente)
completitud = n_matched / (n_matched + n_missing + 0.5·n_ambiguous_detectables)
calidad     = (n_limpias + 0.5·(n_matched − n_limpias)) / n_matched
S           = min(1, −log10(FAP)/6)      # FAP 1e-6 → 1; 1e-3 → 0.5; 0.05 → 0.22; 0.25 → 0.10
```

**Veredicto** (reglas, en este orden):

1. **descartada**: ≥ 2 coincidencias (si no, no hay hipótesis que refutar) y
   [≥ 2 rasgos ausentes, o ≥ 1 ausente con (FAP > 0.05 o velocidad incoherente)].
2. **fuerte**: ≥ 3 coincidencias limpias, FAP < 10⁻³, 0 ausentes, completitud ≥ 0.5,
   `v_std ≤ max(0.35 km/s, 0.5·tol_mediana)` y coherente.
3. **tentativa**: ≥ 2 coincidencias, FAP < 0.05, ≤ 1 ausente, coherente y
   `v_std ≤ 1.5 × (límite de fuerte)`.
4. **insuficiente**: el resto (incluye toda especie con 1 solo rasgo fuerte en cobertura:
   una línea nunca identifica una molécula).

**Velocidad adoptada por posición.** Mediana ponderada de `v` de las coincidencias limpias
de especies *fuerte* (si hay < 3, se añaden las *tentativa*); peso
`1/(σ_ajuste² + σ_catálogo² + 0.10²)` en km/s (0.10 km/s ≈ ½ canal como suelo sistemático).
Error = `1.2533·MAD/√n`.

### Comprobación independiente: patrón de Boltzmann y literatura (`verificar_candidatas.py`)

Dos pruebas que el pipeline no hace, automatizadas en `analysis/verificar_candidatas.py`
(lee los JSON publicados; no toca `pipeline.py`):

1. **Patrón de una sola temperatura.** Para cada especie × posición con ≥ 3 coincidencias
   limpias se ajusta `log10(amp) = cte + logI₃₀₀ − Eu·(1/T − 1/300)/ln 10` en una rejilla
   30–800 K. Se publica `T_rot`, la dispersión (dex) y `patron_ok` (dispersión ≤ 0.35 dex y
   T no pegada al borde). Una especie real da un patrón coherente; una alineación casual, no
   (glicina en B_offset: 0.53 dex, T → borde). `T_rot` es una comprobación, **no** una Tex:
   la opacidad aplana las líneas brillantes y la sube (CH₃CN: ~380 K frente a 110 K en PILS).
2. **Literatura.** `analysis/referencias_pils.csv` (curada a mano, con cita por fila:
   Calcutt+2018, Jørgensen+2018, Drozdovskaya+2019) da Tex, N, FWHM y v hacia B. El script
   marca `coherente_v` (±0.3 km/s), `coherente_fwhm` (factor 1.6) y `coherente_T` (factor
   2.5). Las FWHM de B salen anchas cuando hay absorción adyacente: se anota.

Salidas: `outputs/verificacion_boltzmann.csv`, `outputs/picos_compartidos.csv` (picos
reclamados por más de una especie, con propuesta de dueño por velocidad) y
`figuras/boltzmann_<pos>.png`. Resumen en `docs/VERIFICACION_CANDIDATAS.md`.

### Comprobación independiente: correlación cruzada

Sin identificar ninguna línea: se correlaciona cada posición con B_offset (plantilla suavizada
al FWHM típico de la posición objetivo), en las 4 medias ventanas (W1a, W1b, W2a, W2b);
`Δv = −c·k·Δν/ν`, media ± std/√4.

## Resultados

### Velocidades adoptadas

| Posición | v (km/s) | error | dispersión | n líneas (especies) | v por correlación cruzada |
|---|---|---|---|---|---|
| B_offset | **2.62** | 0.03 | 0.13 | 32 (CH₃CN, CH₂DOH, CH₃CHO, C₂H₅CN) | (plantilla) |
| B_pico | **2.61** | 0.03 | 0.14 | 33 (las mismas) | 2.54 ± 0.03 |
| A | **3.71** | 0.61 | 0.84 | 3 (CH₃CN) | 3.35 ± 0.41 |

B_offset y B_pico coinciden con el valor inicial de los organizadores (≈ 2.7) dentro de
0.1 km/s; A coincide con ≈ 3.2 dentro de 1σ. En A la velocidad es poco precisa: líneas de
~6 km/s y muy mezcladas; las dos estimaciones independientes (líneas / correlación) concuerdan.

### Especies × posición (n_matched / n_predicted, en rasgos agrupados)

| Especie | B_offset | B_pico | A |
|---|---|---|---|
| CH₃CN | **fuerte** 10/10 · v 2.73 ± 0.17 · FAP 3e-9 | **fuerte** 10/10 · 2.68 ± 0.21 | **fuerte** 9/10 · 3.86 ± 0.80 · FAP 6e-6 |
| CH₂DOH | **fuerte** 15/16 · 2.74 ± 0.13 · FAP 2e-12 | **fuerte** 15/16 · 2.67 ± 0.20 | tentativa 13/16 · 3.77 ± 0.80 |
| CH₃CHO | **fuerte** 7/7 · 2.54 ± 0.06 · FAP 1e-6 | **fuerte** 6/7 · 2.54 ± 0.05 | insuficiente 0/6 |
| C₂H₅CN | **fuerte** 7/12 · 2.57 ± 0.09 · FAP 6e-4 | **fuerte** 7/12 · 2.73 ± 0.29 | insuficiente 4/12 |
| CH₃OCHO | tentativa 7/22 · 2.60 ± 0.06 · FAP 0.03 | tentativa 10/22 · 2.84 ± 0.39 | insuficiente 5/22 |
| CH₃OCH₃ | insuficiente 1/4 | insuficiente 2/4 | insuficiente 3/4 |
| CH₂(OH)CHO | insuficiente 2/12 | insuficiente 3/11 | insuficiente 2/10 |
| C₂H₅OH | insuficiente 1/5 | insuficiente 1/5 | insuficiente 2/4 |
| CH₃OH, ¹³CH₃OH, NH₂CHO, SO₂ | insuficiente (1 rasgo fuerte) | insuficiente | insuficiente |
| **Glicina-I** | **descartada** 9/19 · v 1.69 ± 0.36 (−0.93 km/s de v_pos), 1 ausente | **descartada** 8/19 · 1.66 ± 0.43, 2 ausentes | insuficiente 4/15 |

Tabla completa (FAP, score, completitud, calidad, etc.): `outputs/species_scores.csv`.

**Glicina, el control negativo.** El pipeline no la trata de forma especial. Con tolerancias de
hasta 2 km/s (por su incertidumbre de catálogo) encuentra 9 coincidencias en B_offset, pero:
(i) todas a v ≈ 1.7 km/s, 0.93 km/s por debajo de la velocidad sistémica (≈ 6σ con n = 6
limpias), mientras que todas las especies fuertes están a ≤ 0.12 km/s; (ii) el rasgo de
349249.6 MHz (cuarteto agrupado, el segundo más intenso de la especie) debería verse a
0.21 Jy/beam ≈ 8.6σ incluso con la escala conservadora y sólo hay 1.7σ; en B_pico faltan
además el más intenso (349563.0 MHz, ambiguo en B_offset); (iii) varias "coincidencias" caen sobre
líneas de CH₃CHO, CH₂DOH y CH₃OCHO. Ver `figuras/huella_B_offset_Glycine-I.png`.

### Diagnósticos destacables

- **Absorción desplazada al rojo (P-Cygni inverso) hacia B.** De las absorciones con una línea
  de emisión a ≤ 3 km/s, 21/22 (B_offset) y 29/32 (B_pico) están al **rojo**, con mediana
  +1.0 y +1.2 km/s (p binomial 5e-6 y 1e-6); en A no hay absorciones. Es la firma de material
  cayendo sobre la fuente B delante de su continuo brillante (cf. Pineda et al. 2012, A&A 544,
  L7), más profunda en el pico de continuo (B_pico). Consecuencia práctica: muchas líneas
  fuertes de B tienen `asymmetric`/`adjacent_absorption`; su centro es fiable, su área no.
- **El catálogo local no está completo.** `outputs/sin_identificar.csv`: 10 picos con SNR > 10
  en B_offset sin ninguna transición dentro de la tolerancia. Entre ellos está **la línea más
  brillante de la banda** (349627.8 MHz LSRK → 349630.9 MHz en reposo a 2.62 km/s, 1.6 Jy/beam,
  SNR 73; NH₂CHO está a 3.2 MHz). Debe consultarse en CDMS/JPL completos (Splatalogue).
- **Perfiles en A**: anchos (FWHM ~6–10 km/s), varios aplanados o con doble pico
  (p. ej. CH₃CN K=2,3), compatible con opacidad o varias componentes de velocidad (A es a su vez
  binaria). Las identificaciones en A son por ello menos firmes que en B.

### Sensibilidad a los umbrales (`outputs/sensibilidad.csv`)

Variando un umbral cada vez (strong_dex 1.0/2.0, snr_detect 5, overbright 5/20,
tol_fwhm 0.75, veto 4σ, unc_max 2 MHz):

- **Robustas** (mismo veredicto en las 9 variantes): CH₃CN, CH₂DOH y glicina en B_offset y
  B_pico; CH₃CHO en B_offset; CH₃CN (fuerte) y CH₂DOH (tentativa) en A. `v_pos` no cambia.
- **Frontera**: C₂H₅CN (fuerte ↔ tentativa con SNR ≥ 5 u overbright 5; su FAP 6e-4 está cerca
  del corte 1e-3); CH₃OCHO (tentativa; pasa a fuerte con strong_dex 1.0 y a insuficiente con
  strong_dex 2.0 o tolerancia 0.75 FWHM: tiene muchas líneas débiles predichas);
  CH₃CHO en B_pico (tentativa con strong_dex 2.0); CH₂(OH)CHO y C₂H₅OH (descartada con un
  umbral, insuficiente con el resto); NH₂CHO en A (tentativa sólo con strong_dex 2.0). Estas no deben presentarse como conclusiones firmes.

## Supuestos y límites

- `logI_300K` no es Aij ni brillo predicho; la escala de intensidades es sólo **relativa dentro
  de una especie**, con dos Tex extremos (100 y 300 K) y sin opacidad. Las líneas ópticamente
  gruesas (p. ej. CH₃CN de K bajo) salen más débiles de lo "esperado"; por eso el veto usa la
  escala mínima y exige ≥ 6σ.
- La FAP supone picos distribuidos uniformemente en la ventana. En un espectro tan poblado es
  una aproximación; se usa para ordenar y con umbrales conservadores (fuerte < 10⁻³).
- Sin modelo LTE ni abundancias: no se convierte intensidad en abundancia.
- Errores formales del ajuste ×√κ; no incluyen calibración (~10 %), elección de base, opacidad
  ni la degeneración emisión/absorción.
- Espectro de un solo píxel; los haces de W1 y W2 difieren (0.75″×0.61″ vs 0.83″×0.58″).
- Una especie con un único rasgo fuerte en cobertura (CH₃OH, ¹³CH₃OH, NH₂CHO, SO₂) es
  siempre *insuficiente*: para decidirla harían falta otras ventanas espectrales.
- "descartada" significa que **las coincidencias encontradas no son de esa especie** (se
  refutan); no excluye la especie a niveles por debajo de la sensibilidad.

## Productos

| Archivo | Contenido |
|---|---|
| `web/public/data/peaks.json` | picos por ventana × posición (contrato DATA_SCHEMA) |
| `web/public/data/species_scores.json` | puntuación por posición × especie |
| `web/public/data/spectra.json` | sólo se reescribe `noise` (σ, segmentos, método) |
| `web/public/data/pipeline_meta.json` | velocidades, ruido detallado (ρ, κ), correlación cruzada, absorciones, `Config` |
| `outputs/peaks_<W>_<pos>.csv` | picos con ajuste, banderas, residuos y candidatos principales |
| `outputs/species_scores.csv` | tabla completa de puntuaciones |
| `outputs/evidencia_borrador.csv` | columnas de `data/evidencia_plantilla.csv`; una fila por rasgo coincidente de especies fuerte/tentativa (`equipo` vacío) |
| `outputs/ruido.csv`, `velocidades_adoptadas.csv`, `sin_identificar.csv`, `sensibilidad.csv` | diagnósticos |
| `outputs/figuras/panorama_<pos>.png` | ventanas completas con picos marcados (300 dpi) |
| `outputs/figuras/huella_<pos>_<especie>.png` | huella de identificación por especie (fuerte/tentativa en cada posición, top-4 de B_offset y glicina) |

### Extensiones del esquema (compatibles; la web ignora claves extra)

- `peaks.json`: `kind` (emission/absorption), `adjacent_absorption`, `fit.area_err_Jy_kms`.
  Absorciones: `peak_Jy`, `amp_Jy` y área negativos, `snr` positivo (profundidad/σ). Ajuste
  fallido: `fit.ok = false` y resto de campos `null`.
- `species_scores.json`: `n_predicted` cuenta **rasgos agrupados**, no filas del catálogo (regla
  de los organizadores). Cada línea representa un rasgo (`catalog_id` = su fila más intensa,
  `grouped_ids` = todas). Claves extra: `detail`, `unc_MHz`, `v_err_kms`, `window`,
  `expected_peak_Jy`, `expected_peak_max_Jy`, `confused_with`, `adjacent_absorption`,
  `nearest_peak_id`; y por especie `n_detectable`, `n_ambiguous`, `n_clean`, `n_overbright`,
  `completeness`, `quality`, `v_offset_kms`, `coherent`, `n_excluded_unc`, `v_best_kms`, `fap`,
  `v_search_kms`, `v_best_free_kms`, `n_matched_free`. En líneas no coincidentes `v_kms = null`
  y `snr` = máximo |señal|/σ dentro de la tolerancia.

## Declaración

Pipeline desarrollado con asistencia de IA (Claude, Anthropic); el equipo debe revisar y
poder defender cada umbral. Catálogos: CDMS y JPL vía `data/catalogos/catalogo_local.csv`
(entradas en `procedencia_catalogos.json`). Datos: ADS/JAO.ALMA#2013.1.00278.S, productos
ARI-L. Contexto: Jørgensen et al. 2016, A&A 595, A117 (PILS); Pineda et al. 2012, A&A 544, L7.

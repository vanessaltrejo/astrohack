# Documentación completa del proyecto · AstroHack SATEM 2026

Herramienta de **apoyo a la decisión** para proponer qué molécula explica cada línea del espectro de
IRAS 16293-2422 (ALMA, banda 7, 348.83–349.77 GHz).

> Este documento reúne **todo lo que se hizo y por qué**: la historia de las decisiones, las fuentes,
> el modelo, los datos añadidos, las pruebas, los errores que se encontraron y lo que sigue pendiente.
> Es la fuente para el informe (2–3 págs.), las diapositivas y el README de la carpeta de análisis.
> El plan con estados está en [`PLAN_Y_TRACKER.md`](../PLAN_Y_TRACKER.md).

Última actualización: 11-oct-2026.

---

## 0. En una página

| Pregunta | Respuesta |
|---|---|
| ¿Qué hace? | Para cada pico del espectro da, **por molécula candidata, un puntaje relativo (en %)** y muestra **por qué**: frecuencia, coeficiente de Einstein, si se repite, complejidad, si se ha visto en el espacio y entorno. Siempre compite la opción "fuera del catálogo". |
| ¿Por qué no un modelo de aprendizaje automático? | No hay respuestas correctas con las que entrenar, y la identificación de líneas es un problema de criterio (mezclas, especies no incluidas, coincidencias por azar). Una herramienta transparente es más defendible y lo avaló un juez. |
| ¿Qué se le hace a los datos? | **Un solo paso**: de frecuencia observada (LSRK) a frecuencia en reposo, con la velocidad **dada** por los organizadores. Nada de limpiar, suavizar ni cuestionar los datos. |
| ¿Qué universo de moléculas? | Las **348 del censo CDMS** (la misma tabla de la diapositiva 5), no sólo las 13 especies del catálogo local. El resultado casi no cambia con 13, 30 o todas (§7). |
| ¿Quién decide? | Quien usa la herramienta. Los puntajes **no son probabilidades calibradas**. |

---

## 1. Jerarquía de autoridad (regla de trabajo)

1. **La palabra de Vanessa**, incluidas las observaciones de los jueces que ella transmite.
2. **Los documentos base**: carpetas `Datos de ALMA`, `Instrucciones` (Documento de participantes,
   Guía de datos calibrados), `Presentacion de inicio`, `Resultados y Evidencias de los Participantes`.
3. **El código existente** (`analysis/`, `web/` de la primera iteración, hecho con IA por un compañero):
   sólo se conserva lo que sirve y no contradice 1 y 2.

Esta regla es la razón de varias correcciones de la sección 3.

---

## 2. Qué dicen los documentos base (lo que obliga)

| Documento | Obligaciones relevantes |
|---|---|
| Documento de participantes | Informe PDF de 2–3 págs. + referencias; ≤10 diapositivas (5 min + 3 de preguntas); carpeta de análisis reproducible con aportes por integrante; **declarar el uso de IA** en informe y presentación. Rúbrica: identificación molecular 25, astrobiología 20, creatividad/herramientas 25, presentación 20, claridad/autoría 10. Un resultado **tentativo bien sustentado** puede ser excelente. |
| Guía de datos calibrados (p. 7) | Varias filas del catálogo pueden ser un mismo rasgo no resuelto: **no contarlas como evidencias independientes**. `log10_I` **no** es Aij. |
| Guía (p. 8) | `ν_reposo = ν_LSRK / (1 − v/c)`, **aplicar la corrección una sola vez**. Estimar ruido en segmentos sin rasgos, no en toda la ventana. Valores negativos: examinarlos, no borrarlos. |
| Guía (p. 4) | **W1 y W2 no se unen** (hueco de 0.736 MHz). |
| Presentación de apertura (diap. 22) | v ≈ 2.7 km/s para B; ≈ 3.2 km/s para A. |
| Presentación de apertura (diap. 5) | Censo de **348 moléculas** en el espacio, por número de átomos (CDMS, sept. 2026). |
| Cuaderno `Inicio_AstroHack.ipynb` | Funciones `candidatos()`, `ruido_empirico()`, `ajustar()` y la gráfica de referencia. |

### Inconsistencias detectadas en los documentos (para avisar a los organizadores)
1. Tiempo de exposición: Documento de participantes dice **5 + 3 min**; la diapositiva 26 dice **8 + 10 min**.
2. `verificar.py` reporta 1 error: `LEEME_PRIMERO.txt` no coincide con su hash (la guía dice 0 errores).
3. `LEEME_catalogos.txt` habla de "15 entradas"; el CSV tiene **13 especies distintas**.
4. La tabla del censo CDMS tiene **349 filas**; la entrada H₂C(CH)₃CN (?) está cuestionada y CDMS no la cuenta → 348.

---

## 3. Historia de decisiones (de esta conversación) y por qué

### 3.1 Primera sesión (10-oct)
- Se leyeron los tres PDFs y el paquete de datos; se verificó con una prueba rápida que el máximo de coincidencias
  pico–catálogo cae en v = 2.7 km/s (47/67 picos frente a 14/67 con v = 0) y que ~1/3 de los picos coincidirían
  por azar con ±0.5 MHz y 348 líneas en ~940 MHz (**por eso hace falta cuantificar el azar**).
- Se creó el repositorio `vanessaltrejo/astrohack`, el plan por fases y el tracker.
- Un compañero (Juan Pablo, "JP") construyó con IA un pipeline (`analysis/`) y un tablero web ("Sparks"), sin usar las
  gráficas de referencia del cuaderno.

### 3.2 Información de los jueces (11-oct) y lo que cambió
Vanessa obtuvo estas indicaciones directas de los jueces:

| Indicación del juez | Qué se hizo | Por qué |
|---|---|---|
| Hay **4 factores** para decidir si una molécula coincide: coeficiente de Einstein; complejidad (nº de átomos, con un estándar); si se ha visto en el espacio; si se repite. | Esos 4 son los factores del modelo (§6). | Es lo que el jurado espera ver. |
| La complejidad se implementa como **estándar de cantidad de átomos por molécula**; es la forma adecuada de meter probabilidad matemática sin complicarse. | `π_átomos` = fracción de las 348 moléculas del censo con ese nº de átomos. | Usa el censo de la diapositiva 5. |
| **No limpiar ni cuestionar los datos**; el coeficiente de Einstein y la velocidad **ya vienen**; sólo hay que escoger el adecuado. | Velocidad **dada** (2.7 / 3.2 km/s), no estimada. Einstein tomado **tal cual** de CDMS/JPL. Única transformación: observado → reposo. | Instrucción directa. |
| Usar las **348 moléculas**; si el modelo está bien, el resultado debe ser igual con 15 o 30. | Catálogo ampliado y prueba de robustez 13 → 30 → todas (§7). | Instrucción directa. |
| Combinar matemática **y factores externos biológicos** (condiciones bióticas y abióticas). | Fichas por molécula + factor de entorno (§6.6). | Instrucción directa. |
| Diferenciador: **herramienta de apoyo a la decisión, no un modelo que lo haga solo** (un juez le dio el visto bueno). | Todo el diseño: puntajes con razones visibles, decisión final humana, opción "fuera del catálogo". | Pitch. |

### 3.3 Qué se rescató y qué se retiró del pipeline de JP
JP había usado: (1) desviación estándar, (2) identificar candidata, (3) error de velocidad en cada pico de la misma molécula,
(4) ver si coinciden con ese error, (5) p-value. Vanessa indicó que (3)–(5) **no son lo que piden los jueces**.

| Elemento del pipeline v1 | Decisión | Por qué |
|---|---|---|
| Ruido por desviación estándar en tramos sin líneas | **Se conserva** (reimplementado propio, §5) | Está en la Guía y el cuaderno oficial. |
| Identificar candidata por frecuencia | **Se conserva** (`candidatos()` oficial → factor de frecuencia) | Documento base. |
| Agrupar filas no resueltas en un rasgo | **Se conserva** | Guía p. 7. |
| Líneas "hermanas" presentes/ausentes | **Se conserva** como factor "**se repite**" | Es el 4.º factor de los jueces. |
| Absorciones marcadas, no borradas | **Se conserva** | Guía p. 8. |
| Ajuste gaussiano | **Se conserva** como descriptivo (forma de `ajustar()` oficial) | Documento base. |
| Estimación de la velocidad (consenso, rejilla, correlación cruzada) | **Se retira** | Los jueces: la velocidad ya viene. |
| Error de velocidad por pico, coherencia, p-value / FAP, ~30 umbrales de veredicto, Boltzmann por especie | **Se retiran de la interfaz** | No lo piden los jueces; añadían complejidad difícil de defender. |

El código de JP **no se borró**: sigue en `analysis/` (con un aviso) como referencia histórica, pero **la web ya no lo usa**.

### 3.4 Correcciones que hizo Vanessa durante el trabajo
| Corrección | Efecto |
|---|---|
| "Lo único que hay que hacer con la data es pasarla de observación a reposo." | Cuaderno de gráficas oficiales (`notebooks/01_graficas_referencia.ipynb`) con ese único paso. |
| "Que sea lo tuyo y lo mío": una sola lista de picos. | `peaks.json` ahora sale del motor v3 (no del pipeline de JP); ruido, picos y ajustes propios (§5). |
| "¿Quitaste el p-value de JP?" | Faltaba en la interfaz: se retiró de chips, marcador de Huellas, mapa del campo y diálogo Método. |
| Sidebar delgado, primero a la derecha, luego **a la izquierda**. | `LeftRail.tsx`. |
| Dar de alta las gráficas Python como sección aparte. | Panel "Gráficas Python". |
| "Boltzmann: ok va" (§6.3). | Se conserva el término de población del nivel. |

### 3.5 Errores que se encontraron y corrigieron (para ser transparentes)
| Error | Cómo se vio | Corrección |
|---|---|---|
| Una línea de ¹⁸OD con **Eu = 16 597 K** ganaba un pico | Revisión de ganadores | Término de población de Boltzmann en el factor Einstein. |
| Filas de catálogo con incertidumbre de **cientos de MHz** | Revisión de CH₂DOH | Se excluyen filas con incertidumbre > 1 MHz; la probabilidad de frecuencia se normaliza por σ. |
| La **misma transición** de CDMS y de JPL contada dos veces (D₂CO) | Revisión de la línea más brillante | Deduplicación por E_sup (±0.5 K) y Δν < 1 MHz; se conserva CDMS. |
| **Conteos de átomos absurdos** en isotopólogos (`O79BrO` se leía como 79 oxígenos) | Revisión de la tabla de complejidad | Reglas de masa isotópica en el analizador de fórmulas. |
| Glicolaldehído oficial con frecuencias distintas hasta 0.69 MHz de Splatalogue | Validación del catálogo | Versión CDMS 2026 (oficial) vs. anterior (Splatalogue): se conserva la oficial. |
| `NaN` en un JSON de fichas → panel vacío en el navegador | Prueba en el navegador | JSON estricto (`allow_nan=False`). |
| Estilos rotos por correr `npm run build` con el servidor de desarrollo encendido | Captura de pantalla de Vanessa | Se apagó el servidor, se borró `.next`. Ahora se compila con el servidor apagado. |
| Primer método de ruido para A diverge (σ ≈ 180 mJy) | Comparación con el pipeline v1 | A usa estimador de envolvente inferior (§5). |

---

## 4. Datos y fuentes

### 4.1 Datos oficiales (no se modifican)
`data/` es copia **idéntica** (verificada por SHA256) de los archivos ligeros del paquete `AstroHack_datos_v1`
(ALMA 2013.1.00278.S, MOUS uid://A001/X120/X13a; ARI-L; PILS).

### 4.2 Datos añadidos por el equipo (`data/externos/`)
| Archivo | Qué es | Cómo se obtuvo |
|---|---|---|
| `splatalogue_CDMS_JPL_348.80-349.80GHz.csv` | 8 977 transiciones (424 entradas) de CDMS y JPL en la banda, con log Aij, E_sup, g_sup | `astroquery` → Splatalogue, 2026-10-11 |
| `catalogo_local_con_aij.csv` | El catálogo oficial + Aij de la **misma** transición (|tag|, g_sup, E_sup ±0.05 K, Δν < 1 MHz) | `analysis/v3/t2_aij_catalogo_local.py` |
| `censo_cdms_2026-09.csv` | Censo CDMS estructurado: fórmula, nº de átomos (por columna), estado, año | `analysis/v3/t1_censo_cdms.py` sobre `cdms_molecules_2026-09.html` |
| `catalogo_ampliado.csv` | 7 105 transiciones: 348 oficiales + 6 757 de CDMS/JPL en la banda, con "visto en el espacio", nº de átomos, Aij (7 043 utilizables: con Aij e incertidumbre ≤ 1 MHz; 380 especies) | `analysis/v3/t2b_catalogo_ampliado.py` |
| `fichas_moleculas.json` | 436 fichas (descripción, entorno, relevancia biótica). **Borrador de IA, pendiente de verificar** | `analysis/v3/fichas.py` |

Detalles y límites:
- **Aij**: 340 de 348 filas oficiales lo tienen. Las 8 de glicolaldehído (E_sup 800–1340 K) quedan vacías porque
  Splatalogue muestra g_sup truncada y su Aij heredaría ese error. No se calcula nada: se copia lo publicado.
- **Mapa nombre químico → molécula del censo**: tabla **revisada a mano** (`CENSO` en `t2b_catalogo_ampliado.py`).
  No se usa sólo la composición porque confunde isómeros (p. ej. glicina ↔ carbamato de metilo).
- **Glicina y dihidroxiacetona**: CDMS las considera "not yet detected" (detecciones cuestionadas) → etiquetadas como no detectadas.
- **Isotopólogos** (D, ¹³C, ¹⁸O…) y estados vibracionales heredan la molécula madre del censo (ver §8, pendiente).

---

## 5. Del espectro a los picos

Código: `analysis/v3/probabilidad.py`.

1. **Observado → reposo** (el único paso sobre los datos): `ν_reposo = ν_LSRK / (1 − v/c)`, c = 299 792.458 km/s,
   v = 2.7 (B_offset, B_pico) y 3.2 km/s (A). Se aplica una sola vez; el catálogo no se toca.
   Comprobación: 2.7 km/s ↔ 3.14 MHz a 349 GHz (número de la presentación).
2. **Ruido** (por ventana y posición):
   - **B**: desviación estándar de los **6 tramos sin líneas más largos** (≥ 15 canales), con la línea base lineal de
     cada tramo restada. Los tramos salen de enmascarar |y − base| > 3σ₀ con dilatación de ±6 canales, donde σ₀ es el
     percentil 25 del rms local (ventanas de 25 canales). Los intervalos se publican en `analysis/v3/outputs/ruido_v3.csv`.
   - **A**: casi no tiene tramos libres (líneas de ~6 km/s) → se usa σ₀ de envolvente inferior, y se declara.
   - Resultado: σ(B_offset) = 24.7 / 25.5 mJy/beam (W1 / W2); B_pico 37.2 / 37.5; A 19.4 / 21.5.
   - El método coincide con el del pipeline v1 en B dentro de ±4 %, lo que da confianza en ambos.
3. **Picos**: emisión con altura ≥ 4σ, prominencia ≥ 3σ, separación ≥ 3 canales. Las absorciones se detectan, se
   marcan y **no se usan como evidencia** (no se borran).
   Totales: B_offset 104 emisiones + 23 absorciones; B_pico 95 + 35; A 67 + 5.
4. **Ajuste gaussiano descriptivo** por pico (gaussiana + constante, en velocidad, misma forma que `ajustar()` del cuaderno):
   FWHM, amplitud, área, línea base y error formal del centro. **No identifica la molécula.** Los errores formales no
   incluyen la correlación entre canales vecinos ni calibración (~10 %). Bandera `blend` si el residuo en el núcleo
   supera max(4σ, 10 % de la amplitud).

---

## 6. El modelo: probabilidad por línea

```
P(s | línea)  ∝  L_ν · L_A · L_rep · π_átomos · π_espacio · f_entorno
```
normalizado a 100 % por pico, **incluyendo** la opción "fuera del catálogo". Cada término es público en la tabla
expandible de la sección *Probabilidad* del tablero.

### 6.1 Frecuencia, `L_ν`
`L_ν = exp(−½ (Δν/σ_ν)²) · (σ_canal/σ_ν)`, con `σ_ν² = (canal/2)² + u_cat² + (ν·0.5 km/s / c)²`, donde `u_cat` es la
incertidumbre del catálogo (0.1 MHz si la fuente no la da). El último factor evita que una incertidumbre grande
"gane" por ser permisiva. **Por qué**: la Guía pide tener en cuenta la incertidumbre del catálogo, el canal, el ancho
del perfil y las mezclas. Candidatas hasta 3σ_ν.

### 6.2 Coeficiente de Einstein, `L_A`
Intensidad relativa esperada de cada rasgo: `S = g_u · A_ij · exp(−E_u / T)`, T = 150 K (sólo para comparar líneas de
una **misma** especie). El valor de **A_ij** es el publicado por CDMS/JPL (no se calcula).
- Si la especie tiene otras líneas fuertes presentes, se escala con la **mediana** de (altura observada / S) de esas líneas
  y se compara con la altura del pico: `L_A = exp(−½ (log₁₀(obs/pred) / 0.5)²)` (0.5 dex de tolerancia).
- Si no hay otras líneas con que escalar, `L_A` es la fuerza relativa de la línea dentro de su especie.
- **Por qué**: A_ij por sí solo dice qué tan rápido emite la transición; una transición con poca intensidad esperada no
  puede explicar un pico brillante.

### 6.3 Población del nivel (parte del factor Einstein)
`L_pob = min(1, exp(−(E_u − 500 K)/300 K))`. **Se mantiene (decisión de Vanessa, 11-oct).**
- **Qué usa de los datos**: sólo `E_u`, que viene en el catálogo. Los **500 K y 300 K son supuestos nuestros**.
- **Por qué existe**: A_ij solo no sabe si el nivel está poblado. Sin este término, aparecen ganadores con E_u de
  16 597 K (B_offset) y 7 901 K (B_pico), imposibles en un núcleo de ~100–300 K.
- **Qué pasa sin él** (medido, lista de picos anterior): mismo ganador en 86 % (B_offset), 89 % (B_pico), 75 % (A).
- Sensibilidad: T_pob = 150 K → 98 % igual; 500 K → 96 % igual (§7).

### 6.4 Se repite, `L_rep`
Para cada especie se toman sus **rasgos fuertes** en W1 y W2 (rasgos agrupados; fuertes = S dentro de 1.5 dex del
más fuerte). Un rasgo "aparece" si hay un pico a ≤ 2σ_ν. `L_rep = (presentes + 1) / (fuertes + 2)`; si la especie
tiene una sola línea fuerte, `L_rep = 0.5` (una línea nunca identifica una molécula). **Por qué**: Guía y jueces —
una coincidencia aislada es una candidata; varias huellas coherentes son evidencia, y las que faltan pesan en contra.

### 6.5 Complejidad y visto en el espacio, `π_átomos`, `π_espacio`
- `π_átomos` = (moléculas del censo con ese número de átomos) / 348. Ejemplos: 5 át. 38/348; 6 át. 39/348; 8 át. 25/348;
  10 át. 18/348. **El "estándar" del juez**: la naturaleza muestra más moléculas pequeñas que grandes.
- `π_espacio`: detectada 1.0 · tentativa 0.5 · no detectada/cuestionada 0.1 (según CDMS 09/2026).
- Son supuestos declarados; su efecto se mide en §7.

### 6.6 Entorno, `f_entorno`
Cada molécula tiene una ficha con su entorno típico. Factor: núcleo caliente / ubicua = 1.0; nube fría = 0.5;
envoltura circunestelar o química atmosférica/laboratorio = 0.1. **Por qué**: IRAS 16293 B es un núcleo caliente; una molécula
típica de nubes frías o de envolturas de estrellas evolucionadas es menos plausible aquí.
La **relevancia biótica/prebiótica** se muestra en la ficha pero **no multiplica** el puntaje: si multiplicara, la
herramienta favorecería lo que "queremos" encontrar (p. ej. glicina).

### 6.7 "Fuera del catálogo"
Candidata hipotética con puntaje fijo `e⁻² · 0.5 · 0.5 · 0.1 ≈ 0.0034`. **Por qué**: ninguna base cubre todo; la línea
más brillante de la banda no estaba en el catálogo local.

### 6.8 Lo que el modelo **no** hace
No convierte intensidad en abundancia; no estima la velocidad; no modela LTE; no calibra probabilidades; no usa
información de otras ventanas espectrales (una línea fuera de W1/W2 no se puede comprobar con este paquete).

---

## 7. Pruebas realizadas (B_offset, lista de picos v3)

Resultados completos: `analysis/v3/outputs/pruebas_T4.txt`.

| Prueba | Resultado |
|---|---|
| **Robustez al tamaño de la base** (juez: "igual con 15 o 30") | 13 → 30 especies: **mismo ganador en 51/51 picos (100 %)**. 13 → 380 (todas): **47/51 (92 %)**; los 4 que cambian pasan a especies raras (¹³CCCCH, HS₂, ¹³CH₂OHCHO, CCH v₂=1). |
| **Glicina** | Aparece como candidata en 13 picos; P máxima = **2.3 %**; **no gana ningún pico**. |
| **Línea más brillante** (349 627.9 MHz LSRK, 349 631.0 MHz reposo, 1.76 Jy/beam, S/N ≈ 73; no estaba en el catálogo local) | D₂CO 6(2,5)–5(2,4): **P = 86 %**, pero con **una sola línea** → tentativa. **La cita de la detección de D₂CO en esta fuente (Persson et al. 2018) está sin verificar.** |
| **Sensibilidad a supuestos** (fracción de picos con el mismo ganador) | complejidad al cuadrado 93 %; raíz 87 %; sin complejidad 83 %; "no detectada" = 0.2 → 100 %; = 0.05 → 100 %; sin entorno 92 %; T_pob 150 K 98 %; 500 K 96 %. |
| **Especies oficiales ganadoras** (universo de 13) | CH₂DOH 15, CH₃CN 10, CH₃CHO 9, CH₃OCHO 7, C₂H₅CN 7, C₂H₅OH 1, CH₃OH 1, CH₃OCH₃ 1. Coinciden con las especies que reporta PILS para esta fuente. |

---

## 8. Pendientes y límites conocidos (honestidad)

| Tema | Estado |
|---|---|
| **Isotopólogos** | Casi la mitad de los picos asignados (47 de 94 en B_offset; 15 son oficiales: CH₂DOH, ¹³CH₃OH) van a un isotopólogo, porque heredan "visto en el espacio" de su molécula madre. Opciones: **A)** dejarlo y etiquetarlos (ya se etiquetan en la tabla); **B)** tratar como "no confirmados" los que no están en el catálogo oficial (prior 0.1). Con B, los ganadores oficiales **no cambian**, "fuera del catálogo" sube de 10 a 16 y el mismo ganador se mantiene en ~82 %. **Decisión pendiente de Vanessa.** |
| **Fichas de moléculas** | Borrador de IA. **Todas pendientes de verificación**: las ~30 manuales primero. |
| **Cita D₂CO** | Sin verificar (ver §7). |
| **Ruido en A** | Estimador de envolvente; no hay tramos libres. Las identificaciones en A son menos firmes (perfiles anchos y mezclados). |
| **Errores formales** | No incluyen correlación entre canales ni calibración. |
| **Haces distintos W1/W2** | No se compara espacialmente. |
| **Frecuencias de glicolaldehído** | Versión CDMS 2026 (oficial) vs. Splatalogue (anterior): hasta 0.69 MHz. |
| **Tiempo de exposición** | 5+3 vs. 8+10: confirmar con organizadores. |
| **Informe, diapositivas, ZIP** | Pendientes; ver tracker. |

---

## 9. El tablero (carpeta `web/`)

Sidebar delgado a la **izquierda** con: Espectro · Probabilidad · Huellas · Moléculas (348) · Gráficas Python · Evidencia · Método · Recargar · Atajos.

| Sección | Qué muestra | Fuente de datos |
|---|---|---|
| Espectro | W1/W2, 3 posiciones, catálogo local en reposo, picos, anotaciones "sin identificar" | `spectra.json`, `peaks.json` (v3) |
| Probabilidad | Por pico: barras por molécula; al expandir, **cada factor** y botón "Añadir a Evidencia" | `probabilidad.json` (v3) |
| Huellas | Por especie: sus líneas fuertes en velocidad, cuáles aparecen/faltan ("se repite"), cuántos picos explica | `probabilidad.json` + catálogo |
| Moléculas (348) | Censo CDMS + especies de laboratorio con líneas en la banda: ficha, familia, entorno, relevancia biótica | `fichas_moleculas.json` |
| Gráficas Python | Las 6 gráficas de referencia reproducidas | `web/public/figs/` |
| Evidencia | Tabla con las columnas de `evidencia_plantilla.csv`, exportable | local |
| Método | Resumen del método (versión corta de este documento) | — |

La velocidad se muestra como dato fijo; no hay control para cambiarla.

---

## 10. Cómo reproducir

```bash
python3 -m venv .venv && .venv/bin/pip install numpy pandas scipy matplotlib astropy astroquery nbformat nbclient ipykernel

# datos añadidos (requiere internet sólo la primera vez; los CSV ya están en el repo)
.venv/bin/python analysis/v3/t2_aij_catalogo_local.py
.venv/bin/python analysis/v3/t1_censo_cdms.py
.venv/bin/python analysis/v3/t2b_catalogo_ampliado.py
.venv/bin/python analysis/v3/fichas.py

# motor v3 → web/public/data/{probabilidad,peaks,spectra}.json
.venv/bin/python analysis/v3/probabilidad.py
.venv/bin/python analysis/v3/t4_pruebas.py          # pruebas de robustez

# gráficas de referencia
.venv/bin/python notebooks/build_01_graficas_referencia.py

# tablero (con el servidor de desarrollo APAGADO al compilar)
cd web && npm ci && npm run dev      # o: npm run build && npm test
```

---

## 11. Declaración de uso de inteligencia artificial (borrador)

| Herramienta | Tareas | Qué se conservó | Cómo se verificó |
|---|---|---|---|
| Claude (Anthropic) vía Claude Code | Lectura de los documentos, plan, extracción de catálogos (Splatalogue/CDMS), código del motor v3 y del tablero, fichas de moléculas (borrador), esta documentación | Código en `analysis/v3/`, `web/`, `notebooks/`; fichas marcadas como pendientes | Comparación con los documentos base; pruebas T4; revisión de ganadores uno a uno; verificación de que los archivos usados son idénticos al paquete (SHA256); `npm run build` y 25 pruebas del tablero |
| Claude (Anthropic) vía Claude Code (primera iteración, compañero JP) | Pipeline v1 y primer tablero | Infraestructura (carga de datos, gráficas); **los veredictos con p-value ya no se usan** | Reproducción de resultados; contraste con la literatura |

Aportes de cada integrante: **pendiente de completar por el equipo** (la evaluación pide identificarlos).

---

## 12. Referencias

- ALMA 2013.1.00278.S · `ADS/JAO.ALMA#2013.1.00278.S` · productos ARI-L.
- Jørgensen et al. 2016, A&A 595, A117 (PILS).
- CDMS (Colonia) y JPL; Splatalogue. Censo CDMS de moléculas interestelares, sept. 2026.
- Documentos de la competencia: Documento de participantes, Guía de datos calibrados, Presentación de apertura.
- Pendientes de verificar antes de citar: Persson et al. 2018 (D₂CO); Jørgensen et al. 2012 (glicolaldehído);
  Kahane et al. 2013 y Coutens et al. 2016 (formamida); Ligterink et al. 2017 (isocianato de metilo).

## 13. Glosario mínimo
- **LSRK**: marco de movimiento en el que están las frecuencias observadas.
- **Reposo**: frecuencia de laboratorio (la del catálogo).
- **Coeficiente de Einstein A_ij**: probabilidad por segundo de que la molécula emita esa transición.
- **E_u**: energía del nivel superior (en kelvin).
- **Isotopólogo**: misma molécula con un átomo más pesado (¹³C en vez de ¹²C, D en vez de H).
- **Rasgo**: una línea observada; varias filas del catálogo no resueltas cuentan como un solo rasgo.
- **Jy/beam**: unidad de intensidad por elemento de resolución; **no** es abundancia.

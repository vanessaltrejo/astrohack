# Documentación completa del proyecto · AstroHack SATEM 2026

Herramienta de **apoyo a la decisión** para proponer qué molécula explica cada línea del espectro de
IRAS 16293-2422 (ALMA, banda 7, 348.83–349.77 GHz).

> Este documento reúne **todo lo que hicimos y por qué**: cómo evolucionó nuestro enfoque, las fuentes, el modelo,
> los datos que añadimos, las pruebas, los errores que encontramos y lo que sigue pendiente. Es nuestra fuente para el
> informe (2–3 págs.), las diapositivas y el README de la carpeta de análisis. El plan con estados está en
> [`PLAN_Y_TRACKER.md`](../PLAN_Y_TRACKER.md).

---

## 0. En una página

| Pregunta | Respuesta |
|---|---|
| ¿Qué hace? | Para cada pico del espectro da, **por molécula candidata, un puntaje relativo (en %)** y muestra **por qué**: frecuencia, coeficiente de Einstein, si se repite, complejidad, si se ha visto en el espacio y entorno. Siempre compite la opción "fuera del catálogo". |
| ¿Por qué no un modelo de aprendizaje automático? | No hay respuestas correctas con las que entrenar, y la identificación de líneas es un problema de criterio (mezclas, especies no incluidas, coincidencias por azar). Una herramienta transparente es más defendible; los jueces respaldaron este enfoque. |
| ¿Qué le hacemos a los datos? | **Un solo paso**: de frecuencia observada (LSRK) a frecuencia en reposo, con la velocidad **dada** por los organizadores. No limpiamos, suavizamos ni cuestionamos los datos. |
| ¿Qué universo de moléculas? | Las **348 del censo CDMS** (la tabla de la diapositiva 5), no sólo las 13 especies del catálogo local. El resultado casi no cambia con 13, 30 o todas (§7). |
| ¿Quién decide? | Quien usa la herramienta. Los puntajes **no son probabilidades calibradas**. |

---

## 1. Criterios que guiaron el trabajo

Tomamos las decisiones con tres fuentes, en este orden:

1. **El criterio del equipo junto con la retroalimentación de los jueces.**
2. **Los documentos de la competencia**: `Datos de ALMA`, `Instrucciones` (Documento de participantes, Guía de datos
   calibrados), `Presentacion de inicio`, `Resultados y Evidencias de los Participantes`.
3. **Nuestro propio código anterior**: sólo conservamos lo que sirve y no contradice 1 y 2.

---

## 2. Qué dicen los documentos de la competencia (lo que obliga)

| Documento | Obligaciones relevantes |
|---|---|
| Documento de participantes | Informe PDF de 2–3 págs. + referencias; ≤10 diapositivas; carpeta reproducible con aportes por integrante; **declarar el uso de IA**. Rúbrica: identificación molecular 25, astrobiología 20, creatividad/herramientas 25, presentación 20, claridad/autoría 10. Un resultado **tentativo bien sustentado** puede ser excelente. |
| Guía de datos calibrados (p. 7) | Varias filas del catálogo pueden ser un mismo rasgo no resuelto: **no contarlas como evidencias independientes**. `log10_I` **no** es Aij. |
| Guía (p. 8) | `ν_reposo = ν_LSRK / (1 − v/c)`, **aplicar la corrección una sola vez**. Ruido en segmentos sin rasgos. Valores negativos: examinarlos, no borrarlos. |
| Guía (p. 4) | **W1 y W2 no se unen** (hueco de 0.736 MHz). |
| Presentación de apertura (diap. 22) | v ≈ 2.7 km/s para B; ≈ 3.2 km/s para A. |
| Presentación de apertura (diap. 5) | Censo de **348 moléculas** en el espacio, por número de átomos (CDMS). |
| Cuaderno `Inicio_AstroHack.ipynb` | Funciones `candidatos()`, `ruido_empirico()`, `ajustar()` y la gráfica de referencia. |

### Inconsistencias que encontramos (para consultar a los organizadores)
1. Tiempo de exposición: el Documento de participantes dice **5 + 3 min**; la diapositiva 26 dice **8 + 10 min**.
2. `verificar.py` reporta 1 error: `LEEME_PRIMERO.txt` no coincide con su hash (la guía dice 0 errores).
3. `LEEME_catalogos.txt` habla de "15 entradas"; el CSV tiene **13 especies distintas**.
4. La tabla del censo CDMS tiene **349 filas**; H₂C(CH)₃CN (?) está cuestionada y CDMS no la cuenta → 348.

---

## 3. Cómo evolucionó nuestro enfoque

### 3.1 Punto de partida
Leímos los documentos y comprobamos con una prueba rápida que el máximo de coincidencias pico–catálogo cae en
v = 2.7 km/s (47/67 picos, frente a 14/67 con v = 0), y que cerca de 1/3 de los picos coincidirían **por azar** con
±0.5 MHz y 348 líneas en ~940 MHz. Por eso la herramienta tiene que mostrar evidencia más allá de la frecuencia.

### 3.2 Versión anterior (v1)
Nuestra primera versión (`analysis/pipeline.py` y el primer tablero) seguía un flujo clásico:
(1) desviación estándar del ruido, (2) candidata por frecuencia, (3) error de velocidad en cada pico de una misma molécula,
(4) coherencia entre esas velocidades y (5) un p-value (probabilidad de falsa alarma) con ~30 umbrales de veredicto
("fuerte / tentativa / descartada / insuficiente"). Sus resultados eran coherentes con la literatura, pero:
- **estimaba la velocidad**, cuando los datos ya la traen;
- respondía "¿está esta molécula?" y no "**¿de qué molécula es esta línea?**", que es la pregunta de quien analiza;
- sus umbrales eran difíciles de explicar en una defensa de 5 minutos;
- no reproducía las gráficas de referencia de las instrucciones.

### 3.3 Retroalimentación de los jueces y qué cambiamos

| Indicación de los jueces | Qué hicimos | Por qué |
|---|---|---|
| Hay **4 factores** para decidir si una molécula coincide: coeficiente de Einstein; complejidad (nº de átomos); si se ha visto en el espacio; si se repite. | Son los factores del modelo (§6). | Es lo que el jurado espera ver. |
| El coeficiente de Einstein es probable **entre 10⁻² y 10⁻⁶ s⁻¹**; de 10⁻⁷ hacia abajo es muy improbable. | Término `L_rangoA` dentro del factor Einstein (§6.2). | Criterio experto de los jueces. |
| La complejidad se implementa como **estándar de átomos por molécula**; es la forma adecuada de meter probabilidad sin complicarse. | `π_átomos` = fracción de las 348 moléculas del censo con ese nº de átomos. | Usa el censo de la diapositiva 5. |
| **No limpiar ni cuestionar los datos**; el coeficiente de Einstein y la velocidad ya vienen; sólo hay que escoger el adecuado. | Velocidad **dada**; Einstein tomado **tal cual** de CDMS/JPL; única transformación observado → reposo. | Indicación directa. |
| Usar las **348 moléculas**; si el modelo está bien, el resultado debe ser igual con 15 o 30. | Catálogo ampliado y prueba de robustez 13 → 30 → todas (§7). | Indicación directa. |
| Combinar matemática con **factores externos** (condiciones bióticas y abióticas de cada molécula). | Fichas por molécula + factor de entorno (§6.6). | Indicación directa. |
| El enfoque de **apoyo a la decisión** (no un modelo que decida solo) es el adecuado. | Puntajes con razones visibles, decisión final humana, opción "fuera del catálogo". | Diferenciador del proyecto. |

### 3.4 Qué conservamos y qué retiramos de la versión anterior

| Elemento de v1 | En la versión actual | Por qué |
|---|---|---|
| Ruido por desviación estándar en tramos sin líneas | **Se conserva**, reimplementado (§5) | Está en la Guía y el cuaderno oficial. |
| Candidata por frecuencia | **Se conserva** (factor de frecuencia) | Documento base. |
| Agrupar filas no resueltas en un rasgo | **Se conserva** | Guía p. 7. |
| Líneas "hermanas" presentes/ausentes | **Se conserva** como factor "**se repite**" | Es uno de los 4 factores de los jueces. |
| Absorciones marcadas, no borradas | **Se conserva** | Guía p. 8. |
| Ajuste gaussiano | **Se conserva** como descriptivo (forma de `ajustar()` oficial) | Documento base. |
| Estimación de la velocidad | **Se retira** | La velocidad viene dada. |
| Error de velocidad por pico, coherencia, p-value/FAP, veredictos por umbrales | **Se retiran** | No es lo que piden los jueces; difícil de defender. |

Retiramos el código de v1 del repositorio para que no se confunda con el actual; queda disponible en el historial de git.

### 3.5 Otros cambios de diseño
| Cambio | Resultado |
|---|---|
| Reproducir las gráficas de las instrucciones con un único paso sobre los datos (observado → reposo) | `notebooks/01_graficas_referencia.ipynb` y las gráficas de «Cómo lo calculamos» en el tablero. |
| Una sola fuente de picos para todo el tablero | `peaks.json` sale del motor, con ruido, picos y ajustes propios (§5). |
| Sidebar delgado a la izquierda; cada sección (Analizar, Cómo lo calculamos, Moléculas, Evidencia) es una pantalla completa; las gráficas del cuaderno viven dentro de «Cómo lo calculamos» | Tablero actual (§9). |
| Tema claro de alto contraste, tipografías Inter (texto) y Space Grotesk (títulos), ancho completo | Lectura más clara en pantallas grandes y proyector. |
| Controles de peso por factor, comparación de candidatas y huellas | Interactividad para ver qué tan robusta es cada respuesta (§9). |
| Rango de Einstein de los jueces dentro del factor Einstein | §6.2. |
| Población del nivel dentro del factor Einstein | Se conserva (§6.3). |
| Isotopólogos fuera del catálogo oficial = no confirmados | Opción adoptada (§6.5). |

### 3.6 Errores que encontramos y corregimos
| Error | Cómo lo vimos | Corrección |
|---|---|---|
| Una línea de ¹⁸OD con **Eu = 16 597 K** ganaba un pico | Revisión de ganadores | Término de población de Boltzmann en el factor Einstein. |
| Filas de catálogo con incertidumbre de **cientos de MHz** | Revisión de CH₂DOH | Excluimos filas con incertidumbre > 1 MHz; la probabilidad de frecuencia se normaliza por σ. |
| La **misma transición** de CDMS y de JPL contada dos veces (D₂CO) | Revisión de la línea más brillante | Deduplicación por E_sup (±0.5 K) y Δν < 1 MHz; se conserva CDMS. |
| Conteos de átomos absurdos en isotopólogos (`O79BrO` leído como 79 oxígenos) | Revisión de la tabla de complejidad | Reglas de masa isotópica en el analizador de fórmulas. |
| Isotopólogos raros heredaban "visto en el espacio" de su molécula madre | Casi la mitad de los picos iban a isotopólogos | Isotopólogos fuera del catálogo oficial = no confirmados (§6.5). |
| Glicolaldehído oficial con frecuencias distintas hasta 0.69 MHz de Splatalogue | Validación del catálogo | Versión CDMS 2026 (oficial) frente a una anterior: conservamos la oficial. |
| `NaN` en un JSON → panel vacío | Prueba en el navegador | JSON estricto. |
| 46 transiciones sin degeneración g_u (CH₂Cl₂, fenol) producían `NaN` en la intensidad esperada y un JSON inválido | Prueba automática que compara el cálculo del navegador con el de Python | "Utilizable" exige Aij **y** g_u; el JSON se escribe en modo estricto para que un `NaN` detenga el proceso. |
| Estilos rotos al compilar con el servidor de desarrollo encendido | Revisión visual | Compilamos con el servidor apagado. |
| Primer método de ruido para A no convergía (σ ≈ 180 mJy) | Comparación con v1 | A usa estimador de envolvente inferior (§5). |
| El cargador de la web reemplazaba en silencio los `NaN` por `null`, lo que ocultaba archivos inválidos | Revisión de código | Eliminado: un archivo inválido ahora falla de forma visible. |
| Código sin uso heredado de v1 (veredictos, mapa, controles de velocidad, utilidades) | Revisión de código | Eliminado; las conversiones Doppler viven en una sola función con pruebas. |
| El ruido del cuaderno (26.2 mJy) y el del motor (25.5 mJy) no coincidían: el motor restaba una recta por tramo y el cuaderno la mediana; además los límites de los tramos se guardaban redondeados a 10 kHz | Revisión del panel «Cómo lo calculamos» | Un solo método, el oficial (`ruido_empirico`), y límites con precisión completa: cuaderno, motor y tablero dan el mismo σ. |

---

## 4. Datos y fuentes

### 4.1 Datos oficiales (no se modifican)
`data/` es copia **idéntica** (verificada por SHA256) de los archivos ligeros del paquete `AstroHack_datos_v1`
(ALMA 2013.1.00278.S, MOUS uid://A001/X120/X13a; ARI-L; PILS).

### 4.2 Datos que añadimos (`data/externos/`)
| Archivo | Qué es | Cómo lo obtuvimos |
|---|---|---|
| `splatalogue_CDMS_JPL_348.80-349.80GHz.csv` | 8 977 transiciones (424 entradas) de CDMS y JPL en la banda, con log Aij, E_sup, g_sup | `astroquery` → Splatalogue |
| `catalogo_local_con_aij.csv` | El catálogo oficial + Aij de la **misma** transición (|tag|, g_sup, E_sup ±0.05 K, Δν < 1 MHz) | `analysis/t2_aij_catalogo_local.py` |
| `censo_cdms_2026-09.csv` | Censo CDMS estructurado: fórmula, nº de átomos (por columna), estado, año | `analysis/t1_censo_cdms.py` |
| `catalogo_ampliado.csv` | 7 105 transiciones: 348 oficiales + 6 757 de CDMS/JPL; 6 997 utilizables (con Aij y g_u publicados e incertidumbre ≤ 1 MHz) | `analysis/t2b_catalogo_ampliado.py` |
| `fichas_moleculas.json` | 436 fichas (descripción, entorno, análisis prebiótico). Elementos y estado: datos; rutas y textos: **borrador de IA, pendiente de verificar** | `analysis/fichas.py` + `analysis/prebiotico.py` |

Detalles y límites:
- **Aij**: 340 de 348 filas oficiales lo tienen. Las 8 restantes (glicolaldehído, E_sup 800–1340 K) quedan vacías porque
  Splatalogue muestra g_sup truncada. No calculamos nada: copiamos lo publicado.
- **Nombre químico → molécula del censo**: tabla **revisada a mano** (`CENSO` en `t2b_catalogo_ampliado.py`); la
  composición sola confunde isómeros (p. ej. glicina ↔ carbamato de metilo).
- **Glicina y dihidroxiacetona**: CDMS las considera "not yet detected" → etiquetadas como no detectadas.

---

## 5. Del espectro a los picos

Código: `analysis/probabilidad.py`.

1. **Observado → reposo** (el único paso sobre los datos): `ν_reposo = ν_LSRK / (1 − v/c)`, c = 299 792.458 km/s,
   v = 2.7 km/s (B_offset, B_pico) y 3.2 km/s (A). Una sola vez; el catálogo no se toca.
   Comprobación: 2.7 km/s ↔ 3.14 MHz a 349 GHz (número de la presentación).
2. **Ruido**:
   - **B**: `ruido_empirico()` del cuaderno oficial (desviación estándar con la mediana de cada tramo restada) sobre los
     **6 tramos sin líneas más largos** (≥ 15 canales). Los tramos salen de enmascarar |y − base| > 3σ₀ (σ₀ = percentil 25
     del rms local en ventanas de 25 canales) con dilatación de ±6 canales. Intervalos publicados, con precisión completa,
     en `analysis/outputs/ruido.csv`. El cuaderno de gráficas usa exactamente los mismos tramos y obtiene el mismo σ.
   - **A**: casi no tiene tramos libres (líneas de ~6 km/s) → usamos σ₀ de envolvente inferior, y lo declaramos.
   - Resultado: σ(B_offset) = 26.1 / 26.2 mJy/beam (W1 / W2); B_pico 38.2 / 39.1; A 19.4 / 21.5.
     En B queda dentro de ~8 % del valor de la versión anterior (que usaba otros tramos).
3. **Picos**: emisión con altura ≥ 4σ, prominencia ≥ 3σ, separación ≥ 3 canales. Las absorciones se detectan y marcan,
   pero no se usan como evidencia. Totales: B_offset 104 emisiones + 23 absorciones; B_pico 94 + 35; A 67 + 5.
4. **Ajuste gaussiano descriptivo** por pico (gaussiana + constante, en velocidad, como `ajustar()`): FWHM, amplitud,
   área, línea base y error formal del centro. **No identifica la molécula.** Los errores formales no incluyen la
   correlación entre canales ni la calibración (~10 %). Bandera `blend` si el residuo del núcleo supera max(4σ, 10 % de la amplitud).

---

## 6. El modelo: probabilidad por línea

```
P(s | línea)  ∝  L_ν · L_A · L_rep · π_átomos · π_espacio · f_entorno
```
normalizado a 100 % por pico, **incluyendo** la opción "fuera del catálogo". Cada término es visible en el tablero.

### 6.1 Frecuencia, `L_ν`
`L_ν = exp(−½ (Δν/σ_ν)²) · (σ_canal/σ_ν)`, con `σ_ν² = (canal/2)² + u_cat² + (ν·0.5 km/s / c)²`; `u_cat` es la
incertidumbre del catálogo (0.1 MHz si la fuente no la da). El último factor evita que una incertidumbre grande "gane"
por ser permisiva. Candidatas hasta 3σ_ν. **Por qué**: la Guía pide considerar incertidumbre del catálogo, canal y ancho.

### 6.2 Coeficiente de Einstein, `L_A`
Intensidad relativa esperada: `S = g_u · A_ij · exp(−E_u / 150 K)` (sólo para comparar líneas de una **misma** especie).
`A_ij` es el publicado por CDMS/JPL.
- Si la especie tiene otras líneas fuertes presentes, escalamos con la mediana de (altura observada / S) y comparamos:
  `L_A = exp(−½ (log₁₀(obs/pred) / 0.5)²)` (0.5 dex de tolerancia).
- Si no hay otras líneas para escalar, `L_A` es la fuerza relativa de la línea dentro de su especie.
- **Por qué**: una transición con poca intensidad esperada no puede explicar un pico brillante.
- **Rango de A_ij (criterio de los jueces)**: un A_ij entre 10⁻² y 10⁻⁶ s⁻¹ es probable; por debajo de 10⁻⁶ es muy
  improbable. Lo aplicamos como `L_rangoA = min(1, 10^(log₁₀A_ij + 6))`: sin castigo desde 10⁻⁶, y ÷10 por cada década
  por debajo (10⁻⁷ → 0.1; 10⁻⁸ → 0.01). De 6 997 transiciones utilizables, 1 223 tienen A_ij < 10⁻⁶. Con la regla,
  ninguna línea queda asignada a una transición de ese rango (antes había una en B offset, cis-CH₂OHCHO con A ≈ 2 × 10⁻⁸).

### 6.3 Población del nivel (dentro del factor Einstein)
`L_pob = min(1, exp(−(E_u − 500 K)/300 K))`.
- Usa sólo `E_u`, que viene en el catálogo; **500 K y 300 K son supuestos nuestros**.
- **Por qué**: A_ij no sabe si el nivel está poblado. Sin este término aparecen ganadores con E_u de 16 597 K y 7 901 K,
  imposibles en un núcleo de ~100–300 K. Sin él, el mismo ganador se mantiene en 86 % (B_offset), 89 % (B_pico), 75 % (A).

### 6.4 Se repite, `L_rep`
Para cada especie tomamos sus **rasgos fuertes** en W1 y W2 (S dentro de 1.5 dex del más fuerte). Un rasgo "aparece" si
hay un pico a ≤ 2σ_ν. `L_rep = (presentes + 1) / (fuertes + 2)`; con una sola línea fuerte, `L_rep = 0.5` (una línea nunca
identifica una molécula). **Por qué**: una coincidencia aislada es una candidata; varias huellas coherentes son evidencia,
y las que faltan pesan en contra.

### 6.5 Complejidad y visto en el espacio
- `π_átomos` = (moléculas del censo con ese número de átomos) / 348. Ejemplos: 5 át. 38/348; 6 át. 39/348; 8 át. 25/348;
  10 át. 18/348. Es el "estándar de átomos por molécula": se conocen más moléculas pequeñas que grandes.
- `π_espacio`: detectada 1.0 · tentativa 0.5 · no detectada/cuestionada 0.1.
- **Isotopólogos** (la misma molécula con un átomo más pesado: ¹³C, D, ¹⁸O…): los que están en el catálogo oficial
  (CH₂DOH, ¹³CH₃OH) heredan el estado de su molécula; los demás cuentan como **no confirmados** (0.1), porque que la
  molécula madre se haya visto no implica que esa variante rara se haya visto.

### 6.6 Entorno, `f_entorno`
Cada molécula tiene una ficha con su entorno típico: núcleo caliente / ubicua = 1.0; nube fría = 0.5; envoltura
circunestelar o química atmosférica/laboratorio = 0.1. **Por qué**: IRAS 16293 B es un núcleo caliente.
El **análisis prebiótico** (§9, «Moléculas») se muestra en la ficha pero **no multiplica** el puntaje; si lo hiciera, la
herramienta favorecería lo que queremos encontrar (p. ej. glicina).

### 6.7 "Fuera del catálogo"
Candidata hipotética con puntaje fijo `e⁻² · 0.5 · 0.5 · 0.1 ≈ 0.0034` (una candidata mediocre a 2σ). Ninguna base cubre todo.

### 6.8 Lo que el modelo no hace
No convierte intensidad en abundancia, no estima la velocidad, no modela LTE, no calibra probabilidades y no usa otras
ventanas espectrales (una línea fuera de W1/W2 no se puede comprobar con este paquete).

---

## 7. Pruebas (B_offset)

Resultados completos: `analysis/outputs/pruebas_T4.txt`.

| Prueba | Resultado |
|---|---|
| **Robustez al tamaño de la base** ("igual con 15 o 30") | 13 → 30 especies: **mismo ganador en 51/51 picos (100 %)**. 13 → 380: **48/51 (94 %)**; los 3 que cambian pasan a especies raras (Z-HNCHCN, HS₂, CCH v₂=1). |
| **Glicina** | Candidata en 13 picos; P máxima **2.3 %**; **no gana ningún pico**. |
| **Línea más brillante** (349 627.9 MHz LSRK, 349 631.0 MHz reposo, 1.76 Jy/beam, S/N ≈ 73; no está en el catálogo local) | **Ambigua**: D₂CO 6(2,5)–5(2,4) 38 % (isotopólogo no confirmado, una sola línea), n-C₃H₇CN v₃₀=2 31 % (E_u 862 K), fuera del catálogo 30 %. La reportamos como **sin identificación firme**. |
| **Sensibilidad a supuestos** (mismo ganador) | complejidad al cuadrado 89 %; raíz 86 %; sin complejidad 81 %; "no detectada" 0.2 → 86 %, 0.05 → 85 %; sin entorno 96 %; T de población 150 K 96 %, 500 K 94 %. |
| **Especies oficiales ganadoras** | CH₂DOH 15, CH₃CN 9, CH₃CHO 7, CH₃OCHO 7, C₂H₅CN 7, C₂H₅OH 1, CH₃OH 1, CH₃OCH₃ 1. Coinciden con las especies que PILS reporta para esta fuente. |
| **Picos asignados** | B_offset 88 de 104 (16 fuera del catálogo); B_pico 84 de 94; A 45 de 67. |

---

## 8. Pendientes y límites conocidos

| Tema | Estado |
|---|---|
| Fichas de moléculas | Borrador de IA; **todas pendientes de verificación** (primero las ~30 manuales). |
| Citas de literatura | Pendientes de verificar antes de usarlas (ver §12). |
| Ruido en A | Estimador de envolvente; las identificaciones en A son menos firmes (perfiles anchos y mezclados). |
| Errores formales | No incluyen correlación entre canales ni calibración. |
| Haces distintos W1/W2 | No comparamos espacialmente. |
| Frecuencias de glicolaldehído | Versión CDMS 2026 (oficial) frente a Splatalogue (anterior): hasta 0.69 MHz. |
| Tiempo de exposición | 5+3 vs. 8+10: por confirmar con los organizadores. |
| Informe, diapositivas, ZIP, aportes por integrante | Ver tracker. |

---

## 9. El tablero (`web/`)

Diseño: fondo blanco, texto casi negro (alto contraste), Inter para texto y Space Grotesk para títulos, ancho completo y
sidebar azul marino a la izquierda con el logo de Sparks. Cada sección es una **pantalla completa**:
**Analizar · Cómo lo calculamos · Moléculas (348) · Evidencia.**

### Pantalla «Analizar»
Responde una sola pregunta: *¿qué molécula produce esta línea?*
1. **Datos** (botones azules): posición (B offset recomendada, B pico, A) y ventana (W1, W2). La velocidad es un dato fijo.
2. **Peso de cada factor** (interactivo): cada factor tiene un **ícono y un color propios** (frecuencia, coeficiente de
   Einstein, se repite, complejidad, visto en el espacio, entorno), los mismos que aparecen en la matriz de comparación y en
   el «¿Por qué?». Cada uno se pone en *apagado* (gris), *normal* (azul marino) o *doble* (ámbar); los % se recalculan al
   instante con la misma fórmula del motor (una prueba automática comprueba que con pesos normales el navegador reproduce
   exactamente el cálculo de Python). Se indica cuántas líneas cambian de molécula.
3. **Resumen**: líneas con confianza alta (≥ 70 %), media (40–70 %), baja (< 40 %) o sin identificar.
4. **Espectro** en reposo con las líneas coloreadas por confianza; «Acercar y ver candidatas» muestra las 5 candidatas.
5. **Tabla de líneas**, que ocupa la altura del panel derecho.
6. **Panel de la línea**: molécula más probable, alternativas, **comparar candidatas** (matriz factor × candidata),
   «¿Por qué?» en palabras (punto verde/ámbar/rojo = a favor / a medias / en contra), ficha breve y **Añadir a Evidencia**.
7. **Huellas**: las líneas fuertes de la candidata elegida en velocidad, ✓ si aparecen y ✗ si faltan.

La etiqueta de confianza es **orientativa** (se deriva del %); no es un veredicto.

### «Cómo lo calculamos»
Recorrido en 7 pasos con datos reales (datos, observado → reposo, ruido, líneas, catálogos y censo, factores, pruebas) y,
al final, **recursos adicionales**: el resto de las gráficas de las instrucciones reproducidas con el cuaderno
(fragmento con el catálogo, ajuste gaussiano y mapa de continuo).

### «Moléculas (348)»
Pensada para entenderse sin tener que abrir cada ficha:
- **Cuatro resúmenes que también filtran la lista**: número de átomos (censo CDMS), ¿vista en el espacio? (censo CDMS),
  entorno típico y relevancia prebiótica (fichas).
- **«En nuestro espectro»**: las moléculas que son la candidata más probable de alguna línea y en cuántas (motor).
- **Lista** (con su propio scroll, ordenada por líneas explicadas) y **ficha** (con su propio scroll): estado, átomos,
  entorno, **análisis prebiótico**, líneas por posición, complejidad relativa al censo, descripción y condiciones.

#### Análisis prebiótico de cada molécula (`analysis/prebiotico.py` → `AnalisisPrebiotico.tsx`)

Responde dos preguntas: **¿es prebiótica?** y **¿en qué condiciones?**, separando el espacio de la Tierra (una molécula
puede ser prebiótica en un planeta y no estar confirmada en el espacio, como la glicina). No es una etiqueta «porque sí»:
la clase sale de criterios explícitos.

| Clase | Criterio | Cuántas (de 436 fichas) |
|---|---|---|
| **Prebiótica** | Hay una ruta química conocida hacia una familia de biomoléculas (tabla `RUTAS`, 12 moléculas). | 12 |
| **Solvente** | El agua: el solvente de la vida. | 1 |
| **Ingrediente potencial** | Contiene carbono y al menos uno de N, O, P o S, sin ruta directa conocida. | 244 |
| **Sin papel conocido** | El resto (p. ej. NaCl, SiO). | 179 |

El titular combina la clase con el censo: «Prebiótica · observada en el espacio» (detectada o tentativa en CDMS) o
«Prebiótica en la Tierra · no confirmada en el espacio».

Qué muestra la ficha:
- **Ingredientes (C, H, N, O, P, S)**: cuáles contiene y el papel de cada uno.
- **Factores bióticos**: el **solvente** (agua) y las cuatro familias de biomoléculas (**proteínas, ADN/ARN, lípidos,
  azúcares**), resaltando aquellas a las que lleva su ruta y cómo.
- **Factores abióticos**: **temperatura, presión, aire/atmósfera, gravedad y radiación**, en dos columnas: dónde se forma
  en el espacio y qué necesitaría en un planeta para participar en la química de la vida.

**De dónde sale cada parte:**

| Parte | Fuente | Tipo |
|---|---|---|
| Elementos CHNOPS | Fórmula de la molécula | Dato |
| Papel de cada elemento | Presentación de apertura, diap. 3 | Documento de la competencia |
| Observada o no en el espacio | Censo CDMS (`censo_cdms_2026-09.csv`) | Dato |
| Temperatura en el espacio | Entorno de la ficha + secuencia nube fría → calentamiento → disco (diap. 8) | Ficha (borrador de IA) + documento |
| Factores a considerar (agua/solvente; proteínas, ADN, lípidos, azúcares; temperatura, aire, presión, gravedad) | Retroalimentación de los jueces | Indicación directa |
| Relacionar con una ruta química y las condiciones que necesitaría; «también es válido concluir que el vínculo todavía es incierto» | Diap. 25 y Documento de participantes | Documento de la competencia |
| Rutas hacia biomoléculas (`RUTAS`) y textos de condiciones | Conocimiento general de química prebiótica | **Borrador de IA, pendiente de verificar con bibliografía** |
| Condiciones en la Tierra (agua líquida 0–100 °C a 1 atm; presión > 0.006 atm, el punto triple del agua) | Física general del agua | General |

Límites: la tabla de rutas es corta y está hecha a mano; una molécula marcada como «ingrediente» puede tener rutas que
no incluimos. El análisis **no** entra en la probabilidad (§6.6).

**De dónde sale cada dato:** número de átomos y estado → censo CDMS (`data/externos/censo_cdms_2026-09.csv`); líneas que
explica → nuestro motor (`web/public/data/probabilidad.json`); familia, entorno, rutas prebióticas y textos → fichas
(`data/externos/fichas_moleculas.json`), **borrador de IA pendiente de verificación**, y así se indica en cada ficha.

### «Evidencia»
Tabla con las columnas de `evidencia_plantilla.csv`, exportable a CSV. Se guarda en el navegador de quien la usa.

---

## 10. Cómo reproducir

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

.venv/bin/python analysis/exportar_base_web.py        # meta, catálogo y espectros del tablero
.venv/bin/python analysis/t2_aij_catalogo_local.py    # coeficiente de Einstein del catálogo oficial
.venv/bin/python analysis/t1_censo_cdms.py            # censo CDMS de 348 moléculas
.venv/bin/python analysis/t2b_catalogo_ampliado.py    # catálogo ampliado etiquetado con el censo
.venv/bin/python analysis/fichas.py                   # fichas de moléculas y análisis prebiótico
.venv/bin/python analysis/probabilidad.py             # ruido, líneas y probabilidad por línea
.venv/bin/python analysis/t4_pruebas.py               # robustez y sensibilidad
.venv/bin/python notebooks/build_01_graficas_referencia.py && cp notebooks/figs/*.png web/public/figs/

cd web && npm ci && npm run dev                       # tablero en http://localhost:3000
npm test && npm run build                             # con el servidor de desarrollo apagado
```

Comprobamos que este orden regenera todos los resultados desde cero y da los mismos números de este documento.
Publicación: Vercel con **Root Directory = `web`**.

---

## 11. Declaración de uso de inteligencia artificial (borrador)

| Herramienta | Tareas | Qué conservamos | Cómo lo verificamos |
|---|---|---|---|
| Claude (Anthropic) vía Claude Code | Lectura de documentos, planificación, extracción de catálogos (Splatalogue/CDMS), código del motor y del tablero, borrador de fichas y de rutas prebióticas, documentación; también la versión anterior (v1) | Código en `analysis/`, `web/`, `notebooks/`; fichas marcadas como pendientes | Contraste con los documentos de la competencia; pruebas de robustez y sensibilidad; revisión de ganadores uno a uno; archivos idénticos al paquete (SHA256); compilación y pruebas automáticas del tablero (incluida la que comprueba que el navegador reproduce exactamente el cálculo de Python) |

Aportes de cada integrante: **por completar por el equipo**.

---

## 12. Referencias

- ALMA 2013.1.00278.S · `ADS/JAO.ALMA#2013.1.00278.S` · productos ARI-L.
- Jørgensen et al. 2016, A&A 595, A117 (PILS).
- CDMS (Colonia) y JPL; Splatalogue. Censo CDMS de moléculas interestelares.
- Documentos de la competencia: Documento de participantes, Guía de datos calibrados, Presentación de apertura.
- Por verificar antes de citar: Persson et al. 2018 (D₂CO); Jørgensen et al. 2012 (glicolaldehído);
  Kahane et al. 2013 y Coutens et al. 2016 (formamida); Ligterink et al. 2017 (isocianato de metilo).

## 13. Glosario
- **LSRK**: marco de movimiento de las frecuencias observadas.
- **Reposo**: frecuencia de laboratorio (la del catálogo).
- **Coeficiente de Einstein A_ij**: probabilidad por segundo de que la molécula emita esa transición.
- **E_u**: energía del nivel superior (en kelvin).
- **Isotopólogo**: la misma molécula con un átomo más pesado (¹³C en vez de ¹²C, D en vez de H).
- **Rasgo**: una línea observada; varias filas del catálogo no resueltas cuentan como un solo rasgo.
- **Jy/beam**: intensidad por elemento de resolución; **no** es abundancia.

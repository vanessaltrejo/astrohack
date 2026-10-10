# El pipeline explicado en sencillo, paso a paso

Versión para humanos de `analysis/README.md`. Cada paso dice **qué hace**, **por qué** y
**dónde se ve el resultado**. Los umbrales exactos están en el README y en la clase `Config`
de `pipeline.py`.

**La idea en una frase.** Cada molécula emite un *código de barras* fijo de líneas (frecuencias
de laboratorio). En el espectro, ese código aparece **desplazado** por la velocidad de la fuente
y **atenuado** según la temperatura. Identificar una molécula es encontrar su código completo,
desplazado todo por igual, con las barras de la altura correcta y sin que falte ninguna barra
grande.

---

## Paso 0 · Reglas del juego (convenciones)

- Las frecuencias del espectro están en el marco LSRK, *observadas*; las del catálogo son en
  *reposo*. La relación es el efecto Doppler (convención radio):
  `v = c · (1 − ν_obs / ν_reposo)`, con c = 299 792.458 km/s. Se aplica **una sola vez**.
- Un canal = 0.244 MHz ≈ 0.21 km/s. Las líneas en B tienen ~1 km/s de ancho (≈ 5 canales).
- Las dos ventanas W1 y W2 **nunca se unen** (hay un hueco entre ellas).
- Intensidad en Jy/beam. No es abundancia.

## Paso 1 · Medir el ruido (σ)

- **Qué.** Para cada ventana y posición se busca tramos del espectro *sin líneas*, y la
  desviación estándar en esos tramos es σ. Se usan hasta 6 tramos largos y separados.
- **Por qué.** Todo lo demás ("este pico es real", "esta línea falta") se mide en unidades de
  σ. Si σ se midiera incluyendo líneas, saldría demasiado grande y perderíamos detecciones.
- **Detalle importante: canales correlacionados.** Los canales vecinos no son independientes
  (ρ₁ ≈ 0.6–0.75). Se calcula un factor κ (3–5) y todos los errores formales se multiplican por
  √κ. Sin esto, los errores saldrían 2 veces demasiado pequeños.
- **Dónde.** `outputs/ruido.csv` y bandas azules de `figuras/panorama_*.png`.
  σ ≈ 24 mJy/beam en B_offset.

## Paso 2 · Encontrar picos

- **Qué.** `find_peaks` sobre el espectro (y sobre el espectro invertido, para absorciones).
  Umbral: altura ≥ 4σ, prominencia ≥ 3σ. En A se suaviza antes porque sus líneas son 6 veces
  más anchas.
- **Por qué 4σ.** Con ~1900 canales por ventana, un umbral de 3σ daría varios falsos picos por
  ventana; 4σ, menos de uno. Los de 4–5σ se marcan `weak`.
- **Absorciones.** Se conservan con bandera `absorption` pero **no** cuentan como evidencia.
- **Dónde.** `outputs/peaks_<W>_<pos>.csv`; triángulos en los panoramas. 299 picos en total.

## Paso 3 · Ajustar cada pico con una gaussiana

- **Qué.** Alrededor de cada pico: línea base + gaussiana + hasta 5 vecinos ajustados a la vez.
  Se obtiene centro (frecuencia), FWHM (km/s), amplitud, área y sus errores (×√κ).
- **Por qué.** El centro con error sub‑canal es lo que permite medir velocidades a 0.05 km/s;
  la anchura y los residuos nos dicen si hay mezcla.
- **Banderas.** `blend` (residuo grande en el núcleo o vecino solapado), `asymmetric` (alas
  desiguales; en B casi siempre por una **absorción adyacente** al rojo), `edge`.
- **Lección práctica.** Cuando hay absorción adyacente, el *centro* es fiable pero el *área* no.

## Paso 4 · Candidatas por pico

- **Qué.** Para cada pico, todas las transiciones del catálogo cuya velocidad implícita esté en
  [−2, 8] km/s. Se guarda esa velocidad, Δν, Eu y logI.
- **Por qué.** Es la lista "qué podría ser este pico". Sola no identifica nada: casi todos los
  picos tienen varias candidatas.
- **Dónde.** Columnas `candidates` en `peaks.json`; tabla *Candidatas* del tablero.

## Paso 5 · Preparar el código de barras de cada especie

- **Agrupar.** Filas del catálogo de la misma especie más cercanas que medio ancho de línea
  son **un solo rasgo** (p. ej. CH₃CN K=3 A1/A2, cuartetos de glicina). Regla de los
  organizadores: no contarlas como evidencias independientes.
- **Excluir.** Filas con incertidumbre de catálogo > 1 MHz (4 canales) no son identificables;
  se apartan y se declara cuántas (`n_excluded_unc`).
- **Rasgos fuertes.** Sólo se exige que aparezcan los rasgos a ≤ 1.5 dex (factor 30) del más
  intenso de la especie en la banda. logI₃₀₀ se usa **sólo para ordenar dentro de la especie**.
- **Tolerancia.** Una coincidencia vale si |Δν| ≤ max(2 canales, ½ FWHM, 3·unc_catálogo).

## Paso 6 · Buscar la velocidad de cada especie

- **Qué.** Se prueba cada velocidad de 0 a 6 km/s en pasos de 0.05 y se cuenta cuántos rasgos
  fuertes caen sobre un pico de emisión (asignación uno a uno). Se queda con la v que más
  coincidencias da.
- **Dos pasadas.** Primero libre (diagnóstico). Después, **con la velocidad de la fuente
  conocida**, sólo se permite ±1 km/s alrededor de ella: todas las moléculas del mismo gas
  tienen la misma v. El veredicto publicado es el de la segunda pasada.
- **Por qué funciona.** Una especie real da *muchas* coincidencias a *una* v; una falsa da
  pocas, repartidas.

## Paso 7 · ¿Las alturas de las barras son razonables?

- **Qué.** Con dos temperaturas extremas (100 y 300 K) se calcula cuán intensa debería ser
  cada línea **respecto a las demás de su especie**. La escala absoluta sale de las propias
  coincidencias (mediana → confusores; **mínimo** → cota conservadora para el veto).
- **Por qué el mínimo.** Otros portadores sólo pueden *sumar* flujo, así que cada pico es una
  cota superior de lo que aporta la especie. Con la escala mínima, decir "falta una línea" es
  lo más conservador posible.
- **Estados de cada rasgo fuerte.**
  - `matched`: hay pico dentro de la tolerancia.
  - `overbright`: hay pico, pero > 10× lo esperado → lo domina otra molécula; no cuenta.
  - `ambiguous`: no hay pico asignado pero sí señal > 3σ cerca.
  - `missing`: se esperaba ≥ 6σ (escala conservadora) y no hay nada > 3σ. **Esto refuta.**
  - `below_limit`: ni se esperaba ver ni se ve. Neutral.

## Paso 8 · Confusión con otras especies

Una coincidencia no es *limpia* si el pico está mezclado, si sus alas son asimétricas sin
absorción que lo explique, o si otra especie plausible tiene un rasgo fuerte en el mismo sitio
con intensidad esperada apreciable. Las limpias pesan 1; las no limpias, 0.5.

## Paso 9 · ¿Podría ser casualidad? (FAP)

- **Qué.** Probabilidad de obtener ≥ n coincidencias por azar, dada la densidad de picos de la
  ventana (λ picos/MHz) y la tolerancia de cada rasgo: `p_i = 1 − exp(−2·λ·tol_i)`, suma
  Poisson‑binomial, multiplicada por el número de velocidades probadas.
- **Por qué.** En un espectro con un pico cada ~2 MHz, caer "cerca" de algo es fácil. El FAP
  cuantifica cuánto. CH₃CN: 3×10⁻⁹. Glicina: 0.013 (y aun así se descarta por otros motivos).

## Paso 10 · Nota y veredicto

- **Score (0–1)** = completitud × calidad × significancia × ½ por cada línea ausente × ½ si la
  velocidad no es la de la fuente. Es un resumen continuo para ordenar.
- **Veredicto** (en este orden):
  1. **descartada**: ≥ 2 coincidencias pero ≥ 2 ausentes, o 1 ausente con FAP alto o velocidad
     incoherente.
  2. **fuerte**: ≥ 3 limpias, FAP < 10⁻³, 0 ausentes, completitud ≥ 0.5, v coherente y poca
     dispersión de v.
  3. **tentativa**: ≥ 2 coincidencias, FAP < 0.05, ≤ 1 ausente, v coherente.
  4. **insuficiente**: lo demás. Incluye toda especie con **un solo rasgo fuerte** en la banda:
     una línea nunca identifica una molécula.

## Paso 11 · Velocidad de la fuente

Mediana ponderada de las velocidades de las coincidencias limpias de las especies fuertes.
B_offset 2.62 ± 0.03, B_pico 2.61 ± 0.03, A 3.71 ± 0.61 km/s. Se comprueba sin identificar
nada: correlación cruzada de cada posición con B_offset (B_pico 2.54 ± 0.03, A 3.35 ± 0.41).

## Paso 12 · ¿Y si cambiamos los umbrales? (sensibilidad)

Se repite todo con 9 variantes (umbral de detección 5σ, factor 10 ↔ 100 para "rasgo fuerte",
tolerancia más estrecha, etc.). CH₃CN, CH₂DOH, CH₃CHO y la glicina no cambian nunca; C₂H₅CN y
CH₃OCHO sí → por eso se presentan como "probable" y "tentativa".

## Lo que el pipeline NO hace (y hay que decir en el informe)

- No calcula abundancias ni columnas: la escala de intensidades es sólo relativa.
- No modela opacidad: las líneas gruesas (CH₃CN K bajo) salen más débiles de lo "esperado".
- Supone picos repartidos al azar para el FAP (aproximación en un espectro tan poblado).
- Un espectro de un píxel; los haces de W1 y W2 difieren ligeramente.
- "Descartada" = las coincidencias no son de esa especie; **no** = la especie no existe allí.

## Analogía para la presentación

Buscar una canción en una radio llena de emisoras: el catálogo es la partitura; la velocidad
es cuánto está desafinada toda la canción (todas las notas igual); el FAP es la probabilidad
de que el ruido de fondo suene por casualidad como la melodía; "ausente" es que falte el
estribillo. La glicina es una canción de la que oímos algunas notas sueltas, desafinadas de
forma distinta, y sin estribillo.

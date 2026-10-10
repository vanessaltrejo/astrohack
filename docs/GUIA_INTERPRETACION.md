# Guía de interpretación · qué falta por hacer (equipo Huellas)

Estado al 10‑oct‑2026, ~21 h restantes. El pipeline v1 está hecho y validado; **lo que falta es
interpretar, verificar y escribir**. Esta guía dice qué mirar, dónde está y qué producir.
Todo número del informe debe salir de `analysis/outputs/` o de una verificación anotada aquí.

Decisiones ya tomadas (JP): C₂H₅CN se presenta como **"probable"**, no "fuerte"; A y B_pico
**sí** van en el entregable; despliegue en **Vercel**; **sí** se hace contraste LTE en CASSIS.

---

## 0. Reproducir y dónde está cada cosa (5 min)

```bash
pip install -r analysis/requirements.txt
python analysis/pipeline.py            # ~1 min, regenera outputs/ y web/public/data/
python analysis/validate_outputs.py    # debe terminar en OK
cd web && npm install && npm test && npm run dev   # tablero en http://localhost:3000
```

| Quiero… | Abro… |
|---|---|
| Entender el método y cada umbral | `analysis/README.md` (está todo, en español) |
| Ver el veredicto de cada especie | `analysis/outputs/species_scores.csv` (o sección *Huellas* del tablero) |
| Juzgar línea por línea una especie | `analysis/outputs/figuras/huella_<pos>_<especie>.png` |
| Ver la ventana completa con picos | `analysis/outputs/figuras/panorama_<pos>.png` |
| Las líneas que **no** explica el catálogo | `analysis/outputs/sin_identificar.csv` |
| Cuánto cambian los veredictos con los umbrales | `analysis/outputs/sensibilidad.csv` |
| La tabla de evidencia a entregar | `analysis/outputs/evidencia_borrador.csv` (116 filas, columna `equipo` vacía) |
| Ruido y velocidades adoptadas | `outputs/ruido.csv`, `outputs/velocidades_adoptadas.csv` |

Reproducibilidad comprobada el 10‑oct (Python 3.11, scipy actual): veredictos, velocidades,
picos y FAP idénticos a lo commiteado. Solo cambian los **errores formales** (`center_err_MHz`,
`area_err_Jy_kms`) de ajustes degenerados emisión+absorción, hasta ~30 %, y una bandera
`asymmetric` de un pico `weak`. Para el ZIP: fijar versiones (están en `requirements.txt`) y
no citar errores de área de líneas con `adjacent_absorption`.

## 1. Cómo leer un veredicto (10 min, todos)

Cada fila de `species_scores.csv` es una especie en una posición:

- **n_matched / n_predicted**: rasgos fuertes del catálogo (filas no resueltas ya agrupadas)
  con un pico de emisión a la velocidad de la especie, sobre los que se esperaban en cobertura.
- **n_missing_strong**: rasgos que *deberían* verse (≥ 6σ con la escala más conservadora) y no
  hay nada > 3σ. Un solo ausente ya pesa mucho; dos descartan.
- **fap**: probabilidad de obtener ≥ n_matched coincidencias por azar en un espectro tan
  poblado. Fuerte exige < 10⁻³.
- **v_mean ± v_std**: velocidad de la especie. Las reales caen a ≤ 0.15 km/s de la sistémica
  (2.62 km/s en B). Si no, sospecha.
- **n_clean**: coincidencias sin mezcla ni confusión con otra especie plausible.
- **verdict**: `fuerte` / `tentativa` / `insuficiente` / `descartada`. *Insuficiente* no es
  "no está": es "no hay evidencia suficiente en estas dos ventanas". *Descartada* es "las
  coincidencias encontradas no son de esta especie".

En las figuras `huella_*`: banda azul = tolerancia de coincidencia; trazo gris = pico esperado
(escala conservadora); línea punteada = v sistémica; rojo = ajuste. Un panel **AUSENTE** en rojo
es la evidencia más fuerte *en contra*.

Resultado actual (B_offset, la posición principal):

| Especie | Veredicto | n | FAP | v (km/s) | Cómo presentarlo |
|---|---|---|---|---|---|
| CH₃CN | fuerte | 10/10 | 3e‑9 | 2.73 ± 0.17 | detección firme |
| CH₂DOH | fuerte | 15/16 | 2e‑12 | 2.74 ± 0.13 | detección firme |
| CH₃CHO | fuerte | 7/7 | 1e‑6 | 2.54 ± 0.06 | detección firme |
| C₂H₅CN | fuerte (frontera) | 7/12 | 6e‑4 | 2.57 ± 0.09 | **probable** |
| CH₃OCHO | tentativa | 7/22 | 0.03 | 2.60 ± 0.06 | tentativa |
| Glicina‑I | descartada | 9/19, 1 ausente | 0.013 | 1.69 ± 0.36 | **control negativo** |
| CH₃OH, ¹³CH₃OH, NH₂CHO, SO₂ | insuficiente | 1 rasgo en cobertura | — | — | "no decidible con W1+W2" |

---

## 2. Tareas de interpretación (por prioridad)

Cada tarea dice *qué producir*. Poned vuestro nombre al lado y anotad el resultado en
`docs/NOTAS_EQUIPO.md` (crearlo) para que el informe lo recoja.

### T1 · Revisión humana de las 4 especies fuertes en B_offset — 2 h · 2 personas

El rúbrica puntúa autoría: el jurado preguntará "¿por qué esa línea es CH₃CN y no otra cosa?".

1. Abrid `huella_B_offset_CH3CN.png`, `..._CH2DOH.png`, `..._CH3CHO.png`, `..._C2H5CN.png`.
2. Panel por panel, decidid: ¿el pico está donde debe (dentro de la banda azul, cerca de la
   punteada)? ¿La anchura es la típica (~1 km/s)? ¿Hay otra especie marcada encima (etiquetas
   superiores)? ¿El ajuste rojo es razonable?
3. Rellenad en `evidencia_borrador.csv`: `equipo` (nombre del equipo), y revisad `mezcla`,
   `alternativas` y `decision` de cada fila. Si cambiáis una decisión, escribid por qué en
   NOTAS_EQUIPO.
4. Preguntas concretas que hay que poder responder en la defensa:
   - **C₂H₅CN 7/12**: 5 rasgos fuertes están por debajo del límite de detección
     (`n_detectable = 7`), no ausentes. Comprobad que es así mirando sus paneles y explicadlo.
   - **CH₂DOH**: 1 coincidencia *overbright* (demasiado brillante para la especie). ¿Qué otra
     molécula la domina? (campo `confused_with` en `species_scores.json`).
   - **CH₃CHO**: 24 filas del catálogo se excluyeron por incertidumbre > 1 MHz. Decidlo en el
     informe: es una limitación de catálogo, no del dato.
   - **CH₃CN K=3 A1/A2** y otros dobletes: un solo rasgo, nunca dos evidencias.

### T2 · El control negativo: glicina — 1 h · 1 persona

Es el resultado más vendible (astrobiología + rigor). El argumento tiene tres patas; verificadlas
en `huella_B_offset_Glycine-I.png` y `huella_B_pico_Glycine-I.png`:

1. **Velocidad**: las 9 "coincidencias" están a 1.69 ± 0.36 km/s, 0.93 km/s por debajo de la
   sistémica (~6σ con las 6 limpias); ninguna especie real se desvía más de 0.15 km/s.
2. **Línea ausente**: el rasgo de 349 249.6 MHz (segundo más intenso) debería verse a
   0.21 Jy/beam (8.6σ) y hay 1.7σ. En B_pico faltan además el más intenso (349 563.0 MHz).
3. **Confusión**: varias coincidencias caen sobre líneas de CH₃CHO, CH₂DOH y CH₃OCHO
   (etiquetas superiores de los paneles). Listad cuáles.

Añadid contexto bibliográfico (verificad en ADS antes de citar): glicina no se ha detectado en
el medio interestelar; hay límites superiores previos hacia IRAS 16293 (Ceccarelli et al. 2000)
y modelos de por qué sería difícil (Jiménez‑Serra et al. 2014). Nuestro resultado es un
**límite**, no una prueba de ausencia: decidlo así.

### T3 · Líneas sin identificar → Splatalogue/CDMS — 2 h · 1 persona con internet

`sin_identificar.csv`: 10 picos con SNR > 10 en B_offset sin transición del catálogo local,
incluida **la línea más brillante de la banda** (349 627.82 MHz LSRK, 1.64 Jy/beam, SNR 73).
El panorama muestra además decenas de triángulos grises ("emisión sin asignar") más débiles: el
catálogo local cubre solo 13 especies.

Procedimiento, por pico:

1. Frecuencia de reposo a la v adoptada: ν_rest = ν_LSRK / (1 − 2.62/299792.458). Ya está
   calculada en la columna `freq_reposo_MHz_a_v_adoptada`.
2. En https://splatalogue.online (o CDMS/JPL directamente) buscar ±1.5 MHz, filtrando
   Eu < ~1000 K y especies vistas en PILS/hot corinos: CH₃OH vt=1, ¹³CH₃OH, CH₃¹⁸OH, CH₃OCH₃,
   CH₃OCHO vt=1, C₂H₅OH, c‑C₂H₄O, H₂CS, SO₂, HNCO, CH₃SH, t‑HCOOH, CH₃COCH₃, (CH₂OH)₂,
   isotopólogos ¹³C/D de lo ya detectado.
3. Para cada candidato anotar: especie, catálogo+tag, ν_rest, Eu, logI, Δν respecto al pico.
4. **Regla**: un candidato con una sola línea es "posible portador", nunca "detección". Si el
   candidato tiene *otras* líneas fuertes dentro de W1/W2, comprobad si están (eso sí sería
   evidencia). Si queréis, pasadme la lista y añado la especie al catálogo local y el pipeline
   la puntúa igual que las demás.
5. Producto: `docs/lineas_sin_identificar.md` con una tabla, y una frase en el informe. Decir
   honestamente "no identificada" también puntúa.

### T4 · Contraste LTE en CASSIS — 2–3 h · 1 persona

Objetivo: comprobar que las intensidades *relativas* de CH₃CN (y CH₂DOH) son compatibles con
una Tex y N razonables, y obtener un Tex aproximado. Es la parte "herramientas" de la rúbrica.

1. Importar `data/espectros/B_offset_W1_MHz_Jy.txt` y `_W2_` en CASSIS (ASCII; omitid la
   cabecera `#`). **No unir W1 y W2**: dos espectros separados.
2. Convertir Jy/beam → K para el modelo: T_B [K] ≈ 1.222×10³ · S[mJy/beam] / (ν[GHz]² · θ_maj · θ_min [″]).
   Con el haz de W1 (0.751″×0.611″) a 349 GHz: **1 Jy/beam ≈ 21.9 K**; W2 (0.826″×0.576″): **≈ 21.1 K**.
3. Parámetros iniciales: v_LSR = 2.62 km/s, FWHM = 1.0 km/s, Tex 100–300 K, tamaño de fuente
   ≥ haz (dilución 1), N(CH₃CN) ~ 10¹⁶ cm⁻² como punto de partida (ajustad).
4. Comparar el modelo con las 10 líneas de CH₃CN (K=0…9 de J=19→18). Las de K bajo pueden
   salir más débiles que el modelo por opacidad: **esperado**, anotadlo.
5. Producto: una figura (modelo sobre dato) y Tex, N con su rango. Sin pretensiones de
   abundancia: el informe dice "compatible con Tex ~ X K", no "N = …±…".

### T5 · B_pico y A: infall y perfiles anchos — 1 h · 1 persona

- **Absorción al rojo hacia B**: 21/22 (B_offset) y 29/32 (B_pico) absorciones están al rojo de
  su emisión, mediana +1.0 / +1.2 km/s (p ~ 10⁻⁶). Es la firma de caída de material sobre el
  continuo brillante de B (Pineda et al. 2012, A&A 544, L7). Mirad `panorama_B_pico.png`
  (triángulos blancos) y elegid 2 ejemplos limpios para una figura del informe. Datos en
  `web/public/data/pipeline_meta.json` → bloque de absorciones.
- **A**: líneas de 6–10 km/s, algunas con doble pico (CH₃CN K=2,3): opacidad o varias
  componentes (A es binaria). Solo CH₃CN es fuerte; CH₂DOH tentativa. Presentad A como
  "identificaciones menos firmes" y explicad por qué (ruido, mezcla, velocidad 3.7 ± 0.6).
- Consistencia: v(B_pico) = 2.61 ≈ v(B_offset) = 2.62; v(A) = 3.7 ± 0.6 coincide con la
  correlación cruzada (3.35 ± 0.41). Usadlo como comprobación independiente.

### T6 · Astrobiología (20 % de la nota) — 2 h · 1 persona

Un párrafo por molécula detectada, con cita verificada en ADS:

| Molécula | Por qué importa | Referencia PILS a verificar |
|---|---|---|
| CH₃CN | nitrilo; precursor de aminoácidos (síntesis de Strecker) | Calcutt et al. 2018, A&A 616, A90 (N = 4×10¹⁶, Tex 110 K hacia B) |
| C₂H₅CN | nitrilo complejo; química de N en el hot corino | Calcutt et al. 2018 (N = 3.6×10¹⁵, 9 % de CH₃CN) |
| CH₃CHO | aldehído; precursor de azúcares (formosa) | Jørgensen et al. 2018, A&A 620, A170 (N = 1.2×10¹⁷, Tex ≈ 125 K) |
| CH₂DOH | deuteración: herencia de la fase fría pre‑estelar | Jørgensen et al. 2018 (N = 7×10¹⁷, D/H ≈ 2.4 %) |
| CH₃OCHO | éster; química de superficie de hielos | Jørgensen et al. 2016, 2018 (N = 2.6×10¹⁷) |
| Glicina | aminoácido más simple; nuestro límite | Ceccarelli et al. 2000, A&A 362, 1122; Drozdovskaya et al. 2019, MNRAS 490, 50 (N < 9.2×10¹⁴ hacia B) |

Referencias verificadas el 10‑oct en ADS/arXiv; detalle y matices en `docs/VERIFICACION_CANDIDATAS.md`.

Mensaje de fondo: IRAS 16293 B es un *hot corino* rico en COMs cuya química se hereda en parte
de la fase fría (deuteración) y se libera al sublimar los hielos; la ausencia de glicina a nuestro
nivel de sensibilidad es consistente con la literatura.

### T7 · Informe, diapositivas y ZIP — 4 h · todos, al final

- Informe (2–3 páginas): 1) datos y método (medio párrafo + tabla de ruido), 2) resultados
  (tabla de veredictos + 1 figura huella + 1 panorama), 3) glicina, 4) infall/A, 5) límites,
  6) créditos y declaración de IA. **Cada número con su archivo de origen.**
- Declaración de IA: redactar y pegarla en `web/src/lib/config.ts` (`AI_DECLARATION`) y en el
  informe. Hoy pone "[pendiente]".
- ZIP reproducible: `analysis/`, `docs/`, `web/public/data/`, informe, evidencia; **sin cubos**.
- Vercel: importar el repo, *Root Directory* = `web`. Antes: `npm run build` sin errores.

---

## 3. Lo que NO se puede hacer (reglas de los organizadores)

- No unir W1 y W2 (hueco de 0.74 MHz entre ellas).
- Doppler **una sola vez**, convención radio, c = 299 792.458 km/s. Las frecuencias del CSV son
  LSRK observadas, no de reposo.
- Jy/beam no es abundancia. `log10_I_300K` no es A_ij ni brillo predicho; solo sirve para
  ordenar líneas *dentro* de una especie.
- Varias filas de catálogo no resueltas = **un** rasgo, nunca evidencias independientes.
- El ruido se mide en tramos sin líneas (ya está hecho: `ruido.csv`).
- Absorciones y mezclas se **marcan**, no se borran.
- Crédito obligatorio: *This paper makes use of the following ALMA data: ADS/JAO.ALMA#2013.1.00278.S*;
  citar ARI‑L, Jørgensen et al. 2016 (PILS) y las entradas CDMS/JPL usadas
  (`data/catalogos/procedencia_catalogos.json`).

## 4. Frases que hay que poder defender ante el jurado

1. "¿Por qué 2.62 km/s?" → mediana ponderada de 32 líneas limpias de 4 especies; coincide con
   la correlación cruzada y con el valor inicial de los organizadores (2.7).
2. "¿Cómo sabéis que no es casualidad?" → FAP: Poisson‑binomial con la densidad de picos de la
   ventana; CH₃CN 3×10⁻⁹.
3. "¿Por qué descartáis la glicina si coinciden 9 líneas?" → T2.
4. "¿Qué es la línea más brillante?" → T3 (o "no está en el catálogo local; candidato X").
5. "¿Qué cambia si movéis los umbrales?" → `sensibilidad.csv`: CH₃CN, CH₂DOH, CH₃CHO y glicina
   no cambian en 9 variantes; C₂H₅CN y CH₃OCHO sí (por eso "probable" y "tentativa").
6. "¿Qué es la absorción al lado de cada línea?" → T5.

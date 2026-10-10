# Verificación de las moléculas candidatas (B_offset) · 10‑oct‑2026

Revisión independiente, línea por línea, de los veredictos del pipeline v1, con dos
comprobaciones que el pipeline **no** hace (patrón de Boltzmann y contraste con la literatura
PILS). Datos: `analysis/outputs/species_scores.csv`, `peaks_*.csv`, `figuras/huella_B_offset_*.png`.

## 0. Qué significa "candidata" y qué pruebas tiene que pasar

El catálogo local trae 13 especies que los organizadores eligieron como *plausibles o
alternativas*. Ser candidata no es estar: cada especie tiene que superar cinco pruebas.

| # | Prueba | Por qué |
|---|---|---|
| 1 | **Varias líneas, no una** | Una sola coincidencia en un espectro con ~300 picos es azar. |
| 2 | **Todas a la misma velocidad, y esa velocidad es la de la fuente (2.62 km/s)** | Todas las moléculas del mismo gas comparten v_LSR. Una especie "a otra velocidad" es una identificación falsa. |
| 3 | **No falta ninguna línea fuerte** | Si el catálogo predice una línea intensa y no está, la hipótesis se refuta. |
| 4 | **Las intensidades relativas siguen un patrón de Boltzmann** | Con una sola temperatura de excitación (Tex), `I ∝ 10^logI₃₀₀ · exp(−Eu(1/T − 1/300))`. He ajustado T a las líneas limpias: una especie real da dispersión ≤ 0.3 dex y una T plausible (100–300 K en IRAS 16293B). |
| 5 | **Consistencia con PILS** | Jørgensen+2016/2018, Calcutt+2018 ya estudiaron esta fuente con el mismo tipo de datos (ALMA Banda 7, 0.5″, FWHM 1.0 km/s, v 2.5–2.7 km/s). |

Pruebas 1–3 las hace el pipeline; 4 y 5 están automatizadas en
`analysis/verificar_candidatas.py` (salidas: `outputs/verificacion_boltzmann.csv`,
`outputs/picos_compartidos.csv`, `figuras/boltzmann_<pos>.png`; referencias en
`analysis/referencias_pils.csv`). **Todas las conclusiones de v1 se sostienen**, con dos matices
(C₂H₅CN y CH₃OCHO) y una limpieza pendiente (picos reclamados por dos especies).

## 1. Resumen

| Especie | Veredicto v1 | Líneas | v (km/s) | T_rot (dispersión) | PILS hacia B | Conclusión |
|---|---|---|---|---|---|---|
| CH₃CN | fuerte | 10/10 | 2.73 ± 0.17 | ~380 K (0.21 dex), inflada por opacidad | N = 4×10¹⁶, Tex 110 K, **ópticamente gruesa** (Calcutt+18) | **Confirmada** |
| CH₂DOH | fuerte | 15/16 | 2.74 ± 0.13 | 220 K (0.20 dex) | N = 7×10¹⁷, grupo "caliente" 300 K (Jørgensen+18) | **Confirmada** |
| CH₃CHO | fuerte | 7/7 | 2.54 ± 0.06 | 120 K (0.22 dex) | N = 1.2×10¹⁷, Tex ≈ 125 K (Jørgensen+18) | **Confirmada**; T_rot coincide con PILS |
| C₂H₅CN | fuerte (frontera) | 5 limpias + 1 dudosa | 2.57 ± 0.09 | 180 K (0.04 dex) | N = 3.6×10¹⁵, Tex 110 K (Calcutt+18) | **Probable** (líneas débiles, como se espera) |
| CH₃OCHO | tentativa | 7/22 (las 7 más intensas) | 2.60 ± 0.06 | 160 K (0.14 dex) | N = 2.6×10¹⁷, grupo caliente (Jørgensen+18) | **Físicamente sólida**; "tentativa" sólo por el criterio automático |
| Glicina‑I | descartada | 9 "coincidencias" | 1.69 ± 0.36 | **no ajusta** (0.53 dex, T→∞) | N < 9.2×10¹⁴ (Drozdovskaya+19); no detectada (Ceccarelli+00) | **Descartada, con tres argumentos independientes** |
| CH₃OH, ¹³CH₃OH, NH₂CHO, SO₂ | insuficiente | 1 rasgo en banda | — | CH₃OH N ≈ 10¹⁹ (seguro que está) | **No decidible** con W1+W2 |

T_rot es un ajuste a amplitudes de pico, sin corrección de opacidad ni de función de partición:
sirve para ver si el *patrón* es el de una molécula real, no como medida de Tex.

## 2. Especie por especie

### CH₃CN (cianuro de metilo) — confirmada

- **Qué vemos.** La escalera completa J = 19→18, K = 0…9 (10 rasgos; K=3, 6 y 9 son pares
  A1/A2 agrupados en un rasgo). Eu desde 168 K (K=0) hasta 745 K (K=9). Las 10 detectadas,
  SNR 14–41, v = 2.73 ± 0.17 km/s.
- **Patrón.** La intensidad **baja monótonamente con K** (1.0 Jy en K=0–4 → 0.15 Jy en K=9):
  exactamente lo que hace una escalera K a Tex fija. Las de K ≤ 4 se aplanan en ~1 Jy/beam
  (≈ 22 K de brillo): **saturación por opacidad**. Por eso el ajuste de T_rot da ~380 K
  (sesgado al alza): Calcutt+2018 encontró lo mismo y tuvo que usar ¹³CH₃CN y v₈=1 para la
  columna.
- **Literatura.** Calcutt+2018 (A&A 616, A90): hacia B, N = 4.0×10¹⁶ cm⁻², Tex 110 K, FWHM
  1.0 km/s, v 2.7 km/s. Nuestros anchos (0.6–2.0 km/s, ensanchados por la absorción adyacente)
  y velocidad coinciden.
- **Por qué es candidata.** Nitrilo más abundante del hot corino; trazador clásico de gas denso
  y caliente; precursor de aminoácidos (síntesis de Strecker con aldehídos + NH₃).

### CH₂DOH (metanol monodeuterado) — confirmada

- **Qué vemos.** 15/16 rasgos. Doce de ellos son la serie Q J₄ → J₃ (J = 9…14) con logI casi
  idéntico (−3.82…−3.87) y Eu 168–297 K; aparecen todos con amplitudes parecidas (0.5–0.9 Jy),
  como corresponde a una serie homogénea. Más dos líneas de Eu alto (530 K) más débiles.
- **Patrón.** T_rot ≈ 220 K, dispersión 0.20 dex. Jørgensen+2018 nota que varias transiciones
  de CH₂DOH hacia B son ópticamente gruesas, lo que explica parte de la dispersión.
- **El rasgo "overbright"** (349 672.7 MHz): se esperaba ≤ 0.03 Jy y hay ~0.35 Jy. El pipeline
  lo excluye bien: lo domina otro portador.
- **Literatura.** Jørgensen+2018 (A&A 620, A170): N(CH₂DOH) = 7.1×10¹⁷ cm⁻² hacia B, grupo
  caliente (~300 K), CH₂DOH/CH₃OH = 0.071 (D/H ≈ 2.4 % tras corrección estadística).
- **Por qué es candidata.** El deuterio alto es herencia de la fase fría pre‑estelar (química
  en hielos a 10–20 K); medir D/H es la forma de fechar la química.
- **Aviso.** 6 filas del catálogo se excluyeron por incertidumbre > 1 MHz. No afecta.

### CH₃CHO (acetaldehído) — confirmada

- **Qué vemos.** 7/7, serie J = 18→17 en varios subestados torsionales, Eu 311–566 K, más una
  línea de Eu = 40 K. Velocidad **la más ajustada de todas**: 2.54 ± 0.06 km/s.
- **Patrón.** T_rot ≈ 120 K (0.22 dex). **Coincide con los 125 K que PILS asigna a esta
  especie** (grupo "frío": CH₃CHO, CH₃OCH₃, CH₂CO, c‑C₂H₄O). Es la comprobación más bonita
  del informe: el patrón de intensidades reproduce la temperatura de la literatura.
- **Mezclas.** La línea de 349 062.5 MHz la reclama también la glicina (ver §3) y la de
  349 755.7 MHz también CH₂DOH; ambas marcadas `blend`. Quedan 5 limpias.
- **Literatura.** Jørgensen+2018: N = 1.2×10¹⁷ cm⁻², Tex ≈ 125 K.
- **Por qué es candidata.** Aldehído más simple con grupo metilo; precursor de azúcares
  (reacción de formosa) y de aminoácidos (Strecker).
- **Aviso.** 24 filas del catálogo excluidas por unc > 1 MHz (transiciones mal predichas en el
  catálogo JPL); es limitación del catálogo, decidlo así.

### C₂H₅CN (cianuro de etilo) — probable

- **Qué vemos.** Serie J = 39→38, Ka = 8…14, Eu 407–553 K. El pipeline cuenta 7, pero dos no
  valen: 349 392.3 MHz es en realidad la línea K=3 de CH₃CN (v implícita 1.81 km/s,
  incoherente) y 349 396.2 MHz es un ajuste fallido (amplitud 0). Quedan **5 líneas limpias y
  débiles** (SNR 5.6–11.5, 0.11–0.27 Jy) a v = 2.42–2.66 km/s.
- **Patrón.** T_rot ≈ 180 K con dispersión **0.04 dex**: las cinco tienen justo las
  intensidades relativas que predice el catálogo. Las 4 "ambiguas" muestran señal de 3–4σ donde
  se esperaba ≈ 0.1 Jy (4σ): compatibles, no en contra.
- **Literatura.** Calcutt+2018: N = 3.6×10¹⁵ cm⁻², Tex 110 K, 9 % de CH₃CN hacia B. Que sus
  líneas sean 5–10 veces más débiles que las de CH₃CN es lo esperado.
- **Veredicto.** FAP 6×10⁻⁴ (justo bajo el corte) y cambia a "tentativa" en 2 de 9 variantes.
  La decisión del equipo de llamarla **probable** es la correcta.
- **Por qué es candidata.** Nitrilo complejo, misma familia que CH₃CN; su cociente con CH₃CN
  informa de la química de N en superficie de hielos.

### CH₃OCHO (formiato de metilo) — físicamente sólida, etiqueta "tentativa"

- **Qué vemos.** De 22 rasgos predichos, 7 coinciden: **son los 7 más intensos del catálogo**
  (logI −3.7 a −3.9: cuarteto J = 28→27 Ka=9 en 348 909/348 915/349 049/349 066 MHz y el par
  29→28 en 349 176/349 685 MHz). Amplitudes observadas 0.55–0.79 Jy frente a 0.54–0.80
  esperadas. v = 2.60 ± 0.06 km/s. Los 15 restantes tienen logI −4.7 a −5.2 (≤ 0.06 Jy
  esperados ≈ 2.5σ): **indetectables**, no ausentes.
- **Patrón.** T_rot ≈ 160 K (0.14 dex).
- **Por qué "tentativa".** El FAP (0.03) y la completitud (7/22) penalizan que el catálogo
  prediga muchas líneas débiles bajo el umbral. Con `strong_dex = 1.0` pasa a "fuerte"
  (`sensibilidad.csv`). Es un artefacto del criterio, no del dato.
- **Literatura.** Jørgensen+2018: N = 2.6×10¹⁷ cm⁻², grupo caliente; una de las moléculas
  históricas de IRAS 16293 (Jørgensen+2016).
- **Recomendación.** Presentarla como "detección probable; tentativa según el criterio
  automático, por N líneas débiles predichas bajo el límite" y mostrar los 6 paneles fuertes.

### Glicina‑I — descartada (control negativo)

Tres argumentos independientes, cualquiera bastaría:

1. **Velocidad.** Las 9 "coincidencias" dan v = 1.69 ± 0.36 km/s: 0.93 km/s por debajo de la
   sistémica (≈ 6σ). Las cinco especies reales están a ≤ 0.15 km/s.
2. **Línea ausente.** El rasgo de 349 249.6 MHz (cuarteto, 2.º más intenso) debería verse a
   ≥ 0.21 Jy (8.6σ) incluso con la escala más conservadora; hay 1.7σ. Y el más intenso
   (349 563.0 MHz) sólo tiene 5σ donde se esperaban ≥ 0.2 Jy.
3. **Patrón imposible.** Las "coincidencias" no siguen ninguna Boltzmann: dispersión 0.53 dex
   y la T de ajuste se va al límite (800 K). Una línea de Eu = 714 K "detectada" a 0.66 Jy
   mientras falta una de Eu = 497 K más intensa es incompatible con cualquier Tex.

Además, 3 de las 9 caen sobre líneas de CH₃CHO (349 062.5), CH₂DOH (349 183.8) y CH₃OCHO
(349 065.7), que las explican a la velocidad correcta.

**Literatura.** Ceccarelli+2000 (A&A 362, 1122): no detectada con IRAM 30 m, N < 5×10¹²
(haz grande). Drozdovskaya+2019 (MNRAS 490, 50, Apéndice A), con los datos PILS hacia B:
**N(glicina) < 9.2×10¹⁴ cm⁻²** (Tex 300 K, 0.5″). Nuestro resultado es coherente con ambos.
No existe detección de glicina en el medio interestelar.

**Cómo decirlo.** "No detectada a nuestra sensibilidad; las coincidencias aparentes se
refutan por velocidad, por línea ausente y por patrón de intensidades". Nunca "no hay glicina".

### Especies con un solo rasgo en banda — no decidibles

- **CH₃OH**: su única línea en W1+W2 (349 107 MHz) **sí** está (SNR 26, v 2.57). Es coherente,
  pero una línea no identifica; además se sabe que N(CH₃OH) ≈ 10¹⁹ hacia B. Decirlo así.
- **NH₂CHO (formamida)**: su única línea (349 634.0 MHz) no coincide: la línea brillante vecina
  (349 627.8 LSRK, SNR 73) implicaría v = 5.3 km/s. **La línea más brillante de la banda NO es
  formamida.** Sigue sin identificar (tarea T3).
- **¹³CH₃OH, SO₂**: una línea cada una, sin evidencia suficiente.

## 3. Limpieza pendiente: picos reclamados por dos especies

El pipeline asigna uno‑a‑uno *dentro* de cada especie, pero no entre especies. Seis picos de
B_offset están contados por dos. Resolución propuesta (gana la especie cuya v implícita es la
sistémica):

| Pico | SNR | Reclamado por | Asignar a |
|---|---|---|---|
| W2‑Boff‑016 | 37.6 | CH₃CN (2.64) · C₂H₅CN (1.81) | CH₃CN |
| W1‑Boff‑048 | 23.9 | CH₂DOH (2.58) · Glicina (1.73) | CH₂DOH |
| W1‑Boff‑033 | 32.0 | CH₃OCHO (2.57) · Glicina (1.94) | CH₃OCHO |
| W2‑Boff‑069 | 34.4 | CH₂DOH (3.39) · CH₃CHO (2.04) | mezcla real; no contar para ninguna |
| W1‑Boff‑014 | 22.7 | CH₂DOH (2.54) · ¹³CH₃OH (5.81) | CH₂DOH |
| W1‑Boff‑030 | 25.9 | Glicina (2.08) · CH₂(OH)CHO (3.07) | ninguna clara; revisar en T3 |

Ninguna reasignación cambia un veredicto (CH₃CN sigue 10/10, CH₂DOH 14/16, CH₃CHO 6/7,
C₂H₅CN 5 limpias). Conviene aplicarla en `evidencia_borrador.csv` (columna `mezcla` /
`alternativas`) para que el jurado no encuentre el mismo pico dos veces.

## 4. Referencias verificadas (ADS/arXiv, 10‑oct‑2026)

- Jørgensen et al. 2016, A&A 595, A117 — PILS (visión general; glicolaldehído, etilenglicol, metanol).
- Jørgensen et al. 2018, A&A 620, A170 — isotopólogos de COMs con O hacia B: CH₂DOH, CH₃CHO,
  CH₃OCHO, C₂H₅OH, CH₃OCH₃; Tex 125 vs 300 K; tamaño 0.5″, FWHM 1.0 km/s, v 2.5–2.7.
- Calcutt et al. 2018, A&A 616, A90 — nitrilos: CH₃CN (ópticamente gruesa), C₂H₅CN, C₂H₃CN, HC₃N.
- Lykke et al. 2017, A&A 597, A53 — óxido de etileno, acetona, propanal (**no** acetaldehído;
  corregido en la guía).
- Ceccarelli et al. 2000, A&A 362, 1122 — búsqueda de glicina, no detección.
- Drozdovskaya et al. 2019, MNRAS 490, 50 — B frente al cometa 67P; Apéndice A: límite de glicina.
- Pineda et al. 2012, A&A 544, L7 — absorción desplazada al rojo (infall) hacia B.

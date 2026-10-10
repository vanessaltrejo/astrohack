# Notas de diseño del tablero · investigación (10‑oct‑2026)

Investigación previa al rediseño visual de `web/`. Dos fuentes: referencias de tableros
espaciales/científicos y catálogos de "tells" de interfaces generadas por IA.

## Referencias útiles

| Qué tomar | Fuente |
|---|---|
| Lienzo casi negro con tinte azul (#111217), paneles un tono más claros, hairlines al 8–15 % de blanco, radios 4 px, mono para todo lo etiquetado | Grafana design language · https://www.webdesignhot.com/design.md/grafana/ |
| Navy #0B1120 + ámbar telemetría #FFB800; "legible a 3 m con poca luz" | Mission Control DS · https://opendesigner.io/design-systems/mission-control |
| Franja superior de cifras grandes en mono, visual central, registro con severidades debajo | Converge "Satellite Mission Control" · https://converge.ai/enter/marketplace/templates/cinematic-satellite-mission-control-dashboard |
| "Profundidad por tono, no por sombra"; sin glassmorphism; un acento por página | Astro editorial · https://www.webdesignhot.com/design.md/astro/ |
| Profundidad con hairlines de 1 px; colores de gráfico sólo dentro de los gráficos | The Economist · https://www.shadcn.io/design/economist/raw |
| Tres familias: display + cuerpo + mono "para números y etiquetas pequeñas" | NASA Horizon · https://www.nasa.gov/nasa-brand-center/brand-guidelines |
| Paleta categórica ordenada; en oscuro el paso más claro = valor mayor | IBM Carbon data viz · https://carbondesignsystem.com/data-visualization/color-palettes/ |
| Cifras tabulares obligatorias en ejes y tablas | Datawrapper · https://datawrapper.de/blog/fonts-for-data-visualization |
| Marca real de ALMA: navy #223370, naranja #FCB32D, teal #005081 | https://www.almaobservatory.org/ (style.css) |
| Dribbble "Solar Dynamics Observatory UI" (vista de un solo canal ≈ una ventana espectral) | https://dribbble.com/shots/1228771-Solar-Dynamics-Observatory-UI |
| **Anti‑referencia**: "Orbital Analytics", glass + sci‑fi + gradientes | https://dribbble.com/shots/27135902-Orbital-Analytics-Futuristic-Charts-UI-for-AI-Dashboard |

Dribbble no devuelve contenido a los fetchers: las entradas de Dribbble vienen de títulos y
etiquetas, no de capturas verificadas.

## Tells de "vibecoded" (resumen) y su alternativa

Fuentes: impeccable.style/slop, 925studios, robotsonpayroll, prg.sh, superdesign.dev,
ux‑skill wiki (dashboards), charla Tableau STL "I can tell AI built your dashboard".

| Tell | Alternativa |
|---|---|
| Degradados índigo→azul, texto degradado, halos/blobs, glassmorphism | Un tono dominante + un acento; sólido; sin blur decorativo |
| Inter/Geist en todo con jerarquía plana | Display + cuerpo + mono; jerarquía por tamaño/peso/tracking |
| Hero centrado enorme + eyebrow/pill + 3 tarjetas iguales | Cabecera compacta; agrupar por relación, ritmo asimétrico |
| Tarjetas con radio 16 px y sombra en todo; tarjetas anidadas | Hairlines; tarjetas sólo para agrupar campos |
| Pills/badges y emojis como iconos; puntos pulsantes | Badges sólo para estado, chips mono contorneados |
| Instinto de landing en pantallas funcionales | Densidad y contención; cifras tabulares; mono para IDs |
| Métricas en rejilla 3×igual, cada una en su tarjeta | Una métrica primaria grande, 2–4 secundarias, hairlines |
| Colores de estado con degradado | Semánticos sólidos; color de marca sólo para identidad |

## Diagnóstico del tablero actual (v1)

Lo que ya está bien: tipografía propia (Bricolage Grotesque + Martian Mono), cifras tabulares,
hairlines, sin sombras ni degradados, copy en español específico.

Lo que delata "generado": fondo índigo + tinta crema (paleta editorial por defecto); 13 chips
pill saturados de especies; segmentos y badges con radio 999 px; wordmark condensado de 4.6 rem
con tagline y lede (hero de landing sobre una pantalla funcional); nav con `backdrop-blur`;
tooltip con sombra grande; Plotly con modebar y rejilla por defecto; ledes largas bajo cada
sección.

## Dirección propuesta: "cuaderno de observación / consola"

- Lienzo #0B1120 (navy casi negro), superficies #141C2E / #1B2233, hairline #FFFFFF14; sin
  sombras ni blur. Texto #F2F6FA / #9AA3B5 / #5F6B82.
- Un acento: ámbar #FFB800 (interacción, posición activa, v_LSR). Semánticos sólidos para
  veredictos. Colores de especie: 6 tonos apagados para las especies con veredicto y gris para el
  resto; sólo dentro de los gráficos y de su leyenda.
- Tipografía: mantener Bricolage (display, sin condensar) + Martian Mono; mono para todo
  número, unidad, frecuencia, ID, tick y eyebrow (11 px, mayúsculas, tracking).
- Cabecera compacta tipo registro: "HUELLAS · IRAS 16293‑2422 · ALMA 2013.1.00278.S · Banda 7"
  y una fila clave:valor en mono (posición, v_LSR, σ, haz, picos, especies). Sin hero.
- Secciones numeradas 01–05 con eyebrow mono; ledes de una línea.
- Controles rectangulares (radio 2–4 px), chips contorneados, sin pills.
- Plotly: fondo transparente, rejilla al 4 %, ejes mono apagados, sin modebar visible, líneas
  1–1.5 px.
- Tablas: densas, numéricos mono alineados a la derecha, hover por hairline no por relleno.

## Segunda ronda (10‑oct, tarde): por qué la v2 todavía parecía generada

Crítica independiente sobre capturas de la v2, contrastada con catálogos de "tells" de 2025–26
(impeccable.style/slop, adriankrebs.ch/blog/design-slop, capitalandcompute.net/blog/fix-ai-slop-design,
pixelslop ai-slop-patterns, 925studios, datawrapper.de/blog/fonts-for-data-visualization, NN/g
clutter-charts, Tufte "data-ink"). Tells de **segunda generación** que la v2 cometía y cómo se
corrigieron en la v3:

| Tell | En la v2 | v3 |
|---|---|---|
| Eyebrow mono mayúscula sobre cada título, secciones numeradas "01 —" | en todas las secciones y la nav | eliminado; título serif + subtítulo en cursiva |
| Mismo número en varios sitios (v_LSR aparecía 4 veces) | tira de estado + aside + lista del mapa + slider | tira de estado eliminada; v_LSR sólo en marcador y slider (marcas "inicial/adoptada" en la pista) |
| 90 % del texto en mono tracked uppercase; "·" y "—" como separadores | etiquetas, leyendas, tablas | Plex Sans en minúscula; mono sólo para identificadores |
| Muro de 13 chips iguales | fila de especies | agrupadas por veredicto, con icono |
| Tile de métrica (cifra + micro‑etiqueta + fila de stats) | "4 FUERTES …" | frase editorial: "4 *especies con detección firme*" + lista |
| Lectura ámbar gigante estilo panel de instrumentos | "2.70 km/s" a 2 rem | valor discreto junto al slider |
| Texto de instrucciones en la interfaz | "arrastra para ampliar", "pasa el cursor…" | eliminado; affordances e iconos |
| Sin iconos; botones sólo texto; "ƒ" decorativo | toda la UI | Lucide en todos los controles; KaTeX para símbolos |
| Bricolage Grotesque / Instrument Serif / mono como pareja reconocible de IA | fuentes v1–v2 | Newsreader + IBM Plex Sans + Plex Mono (IDs) |
| Dos velocidades distintas para la misma especie sin explicación (2.73 vs 2.82) | marcador vs cabecera de huellas | la cabecera muestra Δv respecto a la adoptada |
| Candidatas sin jerarquía ("+1 más") | chips iguales | la más cercana a la v adoptada resaltada; resto atenuado; "+n" con tooltip |
| Movimiento genérico o ausente | revelados básicos | hover de especie ↔ espectro, anillo en el mapa, reorden animado, cabecera compacta, esqueleto, atajos |

Dribbble (visto directamente en el navegador): las búsquedas "astronomy dashboard",
"spectroscopy software" y "scientific data visualization dark" devuelven sobre todo conceptos
sci‑fi brillantes y SaaS genérico (anti‑referencias). Lo único aprovechable: cifras grandes en
peso ligero con la unidad en tono bajo y anotaciones sobre el espectro (V. Titova, "Space UI and
Astronomy Data Visualization", dribbble.com/shots/27774850).

## Tercera ronda (10‑oct, noche): corrección de "aislar" / "ver en el espectro" y anotaciones

- **Causa del "bug" al aislar una especie**: el eje de carriles (categorías) de Plotly se autoajustaba a las
  especies con líneas visibles, así que al aislar una especie el carril ocupaba un tercio del gráfico con
  uno o dos carriles gigantes. Ahora el carril lista sólo las especies activas, su altura es proporcional
  (≈ 3 % por especie, mínimo 7 %, máximo 33 %) y el rango es fijo. Al pulsar "aislar" el deslizador salta
  a la velocidad propia de la especie: ahora el valor parpadea y un aviso lo explica.
- **"Ver en el espectro"**: `uirevision` depende del rango pedido, de modo que el zoom programático
  siempre se aplica aunque el usuario hubiera hecho zoom a mano; la banda objetivo (±0.6 MHz) se
  ilumina en ámbar 1.2 s para que el ojo la encuentre tras el salto.
- **Anotaciones editoriales** (patrón Observable / The Markup): los tres picos más brillantes sin
  transición del catálogo a menos de 0.6 km/s de la velocidad adoptada se anotan en el espectro como
  *sin identificar · S/N n*, en serif cursiva, con la etiqueta hacia el lado libre y bajo el pico si
  éste roza el techo. En B offset / W2 aparece la línea de S/N 73 que el informe debe discutir.
- Rejillas responsivas (una columna por debajo de `lg`/`xl`), foco inicial de los diálogos en el
  contenido (sin anillo ámbar en el botón de cerrar).

## Cuarta ronda: tooltip propio, deslizador y desplazamiento al gráfico

- El tooltip de Plotly se sustituye por una caja propia (`SpectrumTooltip.tsx`): nombre–valor con
  KaTeX y la tipografía de la página; tres variantes según lo que hay bajo el cursor (canal del
  espectro con S/N, pico con banderas y mejor candidata a la velocidad adoptada, transición del
  catálogo con ν_rest, ν_obs, E_u, log I y entrada). Se coloca a la derecha del cursor y se
  voltea cerca del borde derecho del gráfico.
- Deslizador de v_LSR (`VelocitySlider.tsx`): pista con relleno hasta el valor, marcas cada 1 km/s,
  marcas con nombre (inicial / adoptada) que fijan la velocidad al pulsarlas, entrada numérica
  editable, pasos ±0.05 (Mayús ±0.5) con botones y flechas, botón de volver a la adoptada y
  lectura de Δv respecto a la adoptada.
- "Ver en el espectro" / "aislar" desplazaban la página a la cabecera de la sección, dejando el
  gráfico bajo el pliegue en portátiles: parecía que el gráfico "se rompía". Ahora desplazan al
  propio gráfico (`#espectro-plot`, con `scroll-margin-top`). Se elimina además la `transition`
  animada de Plotly (datos y layout cambian a la vez y podía dejar fotogramas a medias); el
  fundido lo hace CSS.

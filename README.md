# Sparks · AstroHack SATEM 2026

**¿Qué molécula produce cada línea?** Una herramienta de **apoyo a la decisión** para el espectro de ALMA de la
protoestrella **IRAS 16293-2422** (proyecto 2013.1.00278.S, banda 7, 348.83–349.77 GHz). Para cada línea, ordena las
moléculas candidatas, da un porcentaje relativo y explica **por qué**. La decisión final es de quien analiza.

```
P(molécula | línea) ∝ frecuencia × coeficiente de Einstein × se repite × complejidad × visto en el espacio × entorno
```

La documentación completa (qué hicimos, por qué, el modelo, las pruebas y los límites) está en
[`docs/DOCUMENTACION_COMPLETA.md`](docs/DOCUMENTACION_COMPLETA.md).

## Qué le hacemos a los datos

Un solo paso: de frecuencia observada (LSRK) a frecuencia en reposo, `ν_reposo = ν_LSRK / (1 − v/c)`, con la velocidad
**dada** por los organizadores (B: 2.7 km/s; A: 3.2 km/s). No limpiamos, suavizamos ni recalibramos los datos.

## Estructura

| Carpeta | Contenido |
|---|---|
| `data/` | Copia ligera del paquete oficial (espectros CSV, catálogo local, procedencia, plantilla de evidencia, continuo). No se edita. |
| `data/externos/` | Datos que añadimos: transiciones de CDMS/JPL (Splatalogue) con coeficientes de Einstein, censo CDMS de 348 moléculas, catálogo ampliado y fichas de moléculas. |
| `analysis/` | Motor en Python: catálogos, fichas, probabilidad por línea y pruebas. Resultados en `analysis/outputs/`. |
| `notebooks/` | Gráficas de referencia de las instrucciones, reproducidas (`01_graficas_referencia.ipynb`). |
| `web/` | Tablero (Next.js, sitio estático). Sus datos están en `web/public/data/`. |
| `docs/` | Documentación completa. |

## El tablero

| Pantalla | Qué muestra |
|---|---|
| **Analizar** | Espectro, tabla de líneas y, para la línea elegida, la molécula más probable, alternativas, comparación factor por factor, el porqué y las huellas. Pesos de cada factor ajustables. |
| **Cómo lo calculamos** | Los 7 pasos de los datos a la probabilidad, con números y gráficas reales; al final, el resto de las gráficas de las instrucciones. |
| **Moléculas (348)** | Censo CDMS y especies de laboratorio: resúmenes que filtran, moléculas que explican líneas en nuestro espectro y ficha de cada una con su **análisis prebiótico** (ingredientes C/H/N/O/P/S, factores bióticos —solvente, proteínas, ADN/ARN, lípidos, azúcares— y abióticos —temperatura, presión, aire, gravedad, radiación— en el espacio y en la Tierra). Átomos, elementos y estado vienen de la fórmula y del censo CDMS; las líneas explicadas, del motor; entorno, rutas prebióticas y textos, de las fichas de moléculas (`analysis/fichas.py`, `analysis/prebiotico.py`). Criterios en la documentación completa, §9. |
| **Evidencia** | Tabla con las columnas de `evidencia_plantilla.csv`, exportable a CSV. |

## Reproducir

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 1. Datos base del tablero (meta, catálogo, espectros)
.venv/bin/python analysis/exportar_base_web.py

# 2. Catálogos y fichas (los CSV ya están en data/externos; sólo hace falta internet para volver a descargar Splatalogue)
.venv/bin/python analysis/t2_aij_catalogo_local.py     # coeficiente de Einstein del catálogo oficial
.venv/bin/python analysis/t1_censo_cdms.py             # censo CDMS de 348 moléculas
.venv/bin/python analysis/t2b_catalogo_ampliado.py     # catálogo ampliado etiquetado con el censo
.venv/bin/python analysis/fichas.py                    # fichas de moléculas y análisis prebiótico

# 3. Motor: ruido, líneas, probabilidad por línea → web/public/data/{peaks,probabilidad,spectra}.json
.venv/bin/python analysis/probabilidad.py
.venv/bin/python analysis/t4_pruebas.py                # robustez y sensibilidad

# 4. Gráficas de referencia
.venv/bin/python notebooks/build_01_graficas_referencia.py && cp notebooks/figs/*.png web/public/figs/

# 5. Tablero
cd web && npm ci && npm run dev          # http://localhost:3000
npm test && npm run build                # pruebas y sitio estático (con el servidor de desarrollo apagado)
```

**Publicar en Vercel:** importar el repositorio con **Root Directory = `web`** y el preset **Next.js** (sitio estático; sin backend ni variables de entorno). Python sólo se usa en local para generar los datos, que ya están en `web/public/data/`.

## Resultados principales (B offset)

- Moléculas que más líneas explican: CH₂DOH, CH₃CN, CH₃CHO, CH₃OCHO y C₂H₅CN, las mismas que reporta PILS para esta fuente.
- Robustez: con 13 especies o con 30, la molécula más probable no cambia en ninguna línea (51/51); con las 380 especies, cambia en 3 de 51.
- Glicina: candidata en 13 líneas, probabilidad máxima 2.3 %; no gana ninguna.
- La línea más brillante de la banda (349 631 MHz en reposo) queda **ambigua**: sin identificación firme.

## Créditos

This project makes use of the following ALMA data: ADS/JAO.ALMA#2013.1.00278.S. Productos ARI-L.
Contexto PILS: Jørgensen et al. 2016, A&A 595, A117. Catálogos CDMS (Colonia) y JPL, consultados vía Splatalogue.

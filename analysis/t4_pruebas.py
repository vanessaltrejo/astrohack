"""T4 · Pruebas del motor v3 (B_offset).

(a) Robustez al tamaño de la base (observación del juez): mismo ganador por pico con 13 especies
    (catálogo oficial), 30 (13 + las 17 especies del censo con más líneas en banda) y todas.
(b) Glicina: probabilidad máxima en cualquier pico.
(c) Línea más brillante de la banda.
(d) Sensibilidad a los supuestos: priors ×2 y ÷2, T de población 150/500 K.

Salida: analysis/outputs/pruebas_T4.json + impresión en pantalla.
"""
import copy
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import probabilidad as M  # noqa: E402

POS = "B_offset"
esp, cat0, cen, fichas, ruido = M.cargar()
cat = M.preparar_catalogo(cat0, cen, fichas)
oficiales = set(cat[cat.origen == "catalogo_local_oficial"].especie)
extra = (cat[(cat.origen == "splatalogue") & (cat.visto_en_espacio == "detectada")]
         .groupby("especie").size().sort_values(ascending=False).head(17).index)
U = {"13 (catálogo oficial)": oficiales, "30 (13 + 17 del censo)": oficiales | set(extra), "todas": None}

res, ganadores = {}, {}
for nombre, uni in U.items():
    _, Cd, _ = M.analizar(POS, esp, cat, ruido, universo=uni)
    top = Cd[Cd.rango == 1].set_index("pico")
    ganadores[nombre] = top
    print(f"{nombre:24s} especies={cat.especie.nunique() if uni is None else len(uni):4d}  "
          f"picos={len(top)}  fuera_del_catálogo={int((top.especie == '(fuera del catálogo)').sum())}")

base = ganadores["13 (catálogo oficial)"]
asignados = base[base.especie != "(fuera del catálogo)"].index
comparacion = {}
for nombre in ["30 (13 + 17 del censo)", "todas"]:
    g = ganadores[nombre]
    igual = (g.loc[asignados, "especie"] == base.loc[asignados, "especie"])
    cambia = base.loc[asignados][~igual.values]
    comparacion[nombre] = dict(picos_asignados_con_13=int(len(asignados)), mismo_ganador=int(igual.sum()),
                               fraccion=float(igual.mean()))
    print(f"\n13 -> {nombre}: mismo ganador en {igual.sum()}/{len(asignados)} picos ({igual.mean():.0%})")
    # ¿los que cambian eran picos con P alta o baja?
    print("  P (con 13) de los picos que cambian:", np.round(cambia.P.values, 2).tolist())
    print("  nuevos ganadores:", g.loc[cambia.index, "especie"].value_counts().head(8).to_dict())
res["robustez"] = comparacion

# P media de las especies de PILS por universo, sólo en picos que ganan
for nombre, top in ganadores.items():
    print(f"\n{nombre}: picos ganados por especie oficial ->",
          top[top.especie.isin(oficiales)].especie.value_counts().to_dict())

# (b) glicina y (c) línea más brillante, universo completo
_, Cd, _ = M.analizar(POS, esp, cat, ruido)
gly = Cd[Cd.especie == "Glycine-I"]
print(f"\n(b) Glicina-I: aparece como candidata en {gly.pico.nunique()} picos; P máxima = {gly.P.max():.3f}; "
      f"gana en {int((gly.rango == 1).sum())} picos")
print(gly.sort_values("P", ascending=False).head(3)[["pico", "Jy", "P", "rango", "L_frecuencia", "L_Einstein",
                                                      "L_repeticion", "lineas_presentes", "lineas_fuertes",
                                                      "prior_complejidad", "prior_espacio"]].round(3).to_string(index=False))
res["glicina"] = dict(picos_candidata=int(gly.pico.nunique()), P_max=float(gly.P.max()),
                      gana=int((gly.rango == 1).sum()))

brill = Cd.loc[Cd.Jy.idxmax(), "pico"]
b = Cd[Cd.pico == brill].head(5)
print(f"\n(c) Línea más brillante: {brill}  ν_obs = {b.nu_obs_MHz.iloc[0]:.3f} MHz  "
      f"ν_reposo = {b.nu_reposo_MHz.iloc[0]:.3f} MHz  {b.Jy.iloc[0]:.2f} Jy/haz")
print(b[["especie", "P", "delta_MHz", "L_frecuencia", "L_Einstein", "L_repeticion", "Eu_K"]].round(3).to_string(index=False))
res["linea_brillante"] = json.loads(b[["especie", "P", "delta_MHz"]].to_json(orient="records"))

# (d) sensibilidad
orig = copy.deepcopy(M.PARAM)
top0 = Cd[Cd.rango == 1].set_index("pico").especie
# el umbral "fuera del catálogo" usa una complejidad de referencia 0.1: se transforma igual que los priors
eps = lambda ref: float(np.exp(-2.0) * 0.5 * 0.5 * ref)
variantes = {
    "complejidad ^2 (más fuerte)": (lambda c: c.assign(prior_complejidad=c.prior_complejidad ** 2), eps(0.1 ** 2)),
    "complejidad ^0.5 (más débil)": (lambda c: c.assign(prior_complejidad=c.prior_complejidad ** 0.5), eps(0.1 ** 0.5)),
    "sin complejidad": (lambda c: c.assign(prior_complejidad=1.0), eps(1.0)),
    "no detectada = 0.2": (lambda c: c.assign(prior_espacio=c.visto_en_espacio.map({**orig["prior_espacio"], "no detectada": 0.2})), eps(0.1)),
    "no detectada = 0.05": (lambda c: c.assign(prior_espacio=c.visto_en_espacio.map({**orig["prior_espacio"], "no detectada": 0.05})), eps(0.1)),
    "sin entorno": (lambda c: c.assign(factor_entorno=1.0), eps(0.1)),
}
sens = {}
print("\n(d) Sensibilidad (fracción de picos con el mismo ganador que la versión base):")
for k, (f, e) in variantes.items():
    M.PARAM["eps_fuera"] = e
    _, Cv, _ = M.analizar(POS, esp, f(cat), ruido)
    M.PARAM["eps_fuera"] = orig["eps_fuera"]
    tv = Cv[Cv.rango == 1].set_index("pico").especie
    fr = float((tv == top0).mean()); sens[k] = fr
    print(f"  {k:30s} {fr:.0%}")
for k, val in {"T_pob_K": 150.0, "T_pob_K ": 500.0}.items():
    M.PARAM["T_pob_K"] = val
    _, Cv, _ = M.analizar(POS, esp, cat, ruido)
    tv = Cv[Cv.rango == 1].set_index("pico").especie
    fr = float((tv == top0).mean()); sens[f"T población {val:.0f} K"] = fr
    print(f"  {'T población ' + str(int(val)) + ' K':30s} {fr:.0%}")
M.PARAM.update(orig)
res["sensibilidad"] = sens
(Path(__file__).resolve().parent / "outputs/pruebas_T4.json").write_text(json.dumps(res, ensure_ascii=False, indent=1))
(Path(__file__).resolve().parents[1] / "web/public/data/pruebas.json").write_text(json.dumps(res, ensure_ascii=False, allow_nan=False))

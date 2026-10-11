"""T2 · Añade el coeficiente de Einstein (Aij) a cada fila del catálogo local, tal cual lo publica
CDMS/JPL vía Splatalogue. No se calcula nada: se identifica la MISMA transición y se copia su Aij.

Criterio de "misma transición": misma entrada (|tag|), misma g_superior, misma E_superior (±0.05 K)
y frecuencia a < 1 MHz (las diferencias > 0.01 MHz vienen de versiones distintas del catálogo, p. ej.
glicolaldehído CDMS 2026 frente a la versión anterior en Splatalogue). El catálogo oficial no se toca.

Entrada:  data/catalogos/catalogo_local.csv, data/externos/splatalogue_CDMS_JPL_348.80-349.80GHz.csv
Salida:   data/externos/catalogo_local_con_aij.csv
"""
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
loc = pd.read_csv(ROOT / "data/catalogos/catalogo_local.csv", dtype={"entrada": str})
sp = pd.read_csv(ROOT / "data/externos/splatalogue_CDMS_JPL_348.80-349.80GHz.csv")
sp["g"] = pd.to_numeric(sp.upperStateDegen, errors="coerce")

out = []
for _, r in loc.iterrows():
    c = sp[(sp.moleculeTag.abs() == abs(r.tag_original)) & (sp.g == r.g_superior)
           & ((sp.upper_state_energy_K - r.E_superior_K).abs() < 0.05)
           & ((sp.orderedfreq - r.frecuencia_reposo_MHz).abs() < 1.0)]
    if len(c):
        b = c.loc[(c.orderedfreq - r.frecuencia_reposo_MHz).abs().idxmin()]
        out.append(dict(log10_Aij_s_1=b.aij, Aij_s_1=10 ** b.aij, Aij_lista=b.linelist,
                        Aij_delta_freq_MHz=round(b.orderedfreq - r.frecuencia_reposo_MHz, 4),
                        Aij_QN_splatalogue=b.resolved_QNs))
    else:
        # ¿misma transición pero con g_u truncada en Splatalogue (p. ej. 11 en vez de 111)? Su Aij se
        # calculó con esa g errónea, así que NO se copia: se deja vacío y se anota el motivo.
        t = sp[(sp.moleculeTag.abs() == abs(r.tag_original))
               & ((sp.upper_state_energy_K - r.E_superior_K).abs() < 0.05)
               & ((sp.orderedfreq - r.frecuencia_reposo_MHz).abs() < 1.0)]
        nota = "g_u truncada en Splatalogue; Aij no confiable" if len(t) else "sin transición equivalente"
        out.append(dict(log10_Aij_s_1=np.nan, Aij_s_1=np.nan, Aij_lista=nota, Aij_delta_freq_MHz=np.nan,
                        Aij_QN_splatalogue=""))
res = pd.concat([loc, pd.DataFrame(out)], axis=1)
res.to_csv(ROOT / "data/externos/catalogo_local_con_aij.csv", index=False)

print(f"filas con Aij: {res.log10_Aij_s_1.notna().sum()} de {len(res)}")
print(res.groupby("especie").agg(filas=("especie", "size"), con_aij=("log10_Aij_s_1", "count"),
      max_abs_dfreq_MHz=("Aij_delta_freq_MHz", lambda s: s.abs().max()),
      log10_Aij_min=("log10_Aij_s_1", "min"), log10_Aij_max=("log10_Aij_s_1", "max")).to_string())

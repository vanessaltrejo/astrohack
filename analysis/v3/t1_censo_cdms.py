"""T1 · Censo de moléculas interestelares/circunestelares de CDMS (09/2026) en formato estructurado.

Fuente: https://cdms.astro.uni-koeln.de/classic/molecules (copia en data/externos/cdms_molecules_2026-09.html),
la misma tabla de la diapositiva 5 de la presentación de apertura. Las columnas de la tabla dan el nº de átomos.
Marcas de CDMS: "?" tentativa · "*" detectada sólo por espectroscopía IR (sin espectro rotacional) ·
"**" espectroscopía electrónica · "(2026)" año de detección reciente. H2C(CH)3CN ? figura en la tabla pero CDMS
no la cuenta (detección cuestionada): 349 filas − 1 = 348.

Salida: data/externos/censo_cdms_2026-09.csv
"""
import html
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
s = (ROOT / "data/externos/cdms_molecules_2026-09.html").read_text()
tabla = re.findall(r"<table.*?</table>", s, flags=re.S)[0]
filas = re.findall(r"<tr.*?</tr>", tabla, flags=re.S)
cab = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
       for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", filas[0], flags=re.S)]

registros = []
for f in filas[1:]:
    for k, celda in enumerate(re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", f, flags=re.S)):
        txt = html.unescape(re.sub(r"<[^>]+>", "", celda)).strip()
        if not txt:
            continue
        anio = re.search(r"\((20\d\d)\)", txt)
        formula = re.sub(r"\s*\(20\d\d\)", "", txt).strip()
        tentativa = "?" in formula
        estrellas = len(re.search(r"(\**)\s*$", formula.replace("(*)", "*").replace("?", "").strip()).group(1))
        limpia = re.sub(r"\s*\(\?\)|\s*\?|\(\*\)|\*+", "", formula).strip()
        href = re.findall(r'href="([^"]+)"', celda)
        cuestionada = limpia == "H2C(CH)3CN"
        registros.append(dict(
            formula=limpia, formula_cdms=txt,
            n_atomos=cab[k].replace(" atoms", "").replace(">", ">"),
            estado="cuestionada" if cuestionada else ("tentativa" if tentativa else "detectada"),
            solo_IR=estrellas == 1, electronica=estrellas == 2,
            anio_deteccion=int(anio.group(1)) if anio else None,
            cuenta_en_348=not cuestionada,
            url_cdms=("https://cdms.astro.uni-koeln.de" + href[0]) if href else ""))

df = pd.DataFrame(registros)
df.to_csv(ROOT / "data/externos/censo_cdms_2026-09.csv", index=False)
print("filas:", len(df), "| cuentan:", df.cuenta_en_348.sum())
print(df.groupby("n_atomos", sort=False).size().to_dict())
print(df.estado.value_counts().to_dict(), "| solo_IR:", df.solo_IR.sum(), "| electrónica:", df.electronica.sum())
print(df[df.estado != "detectada"][["formula", "n_atomos", "estado"]].to_string(index=False))

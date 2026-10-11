"""T2b · Catálogo ampliado: todas las transiciones de laboratorio (CDMS + JPL) en la banda, etiquetadas con
el censo CDMS 09/2026 (¿vista en el espacio?) y su complejidad (nº de átomos).

- Las 13 especies del catálogo oficial usan SUS filas (frecuencias oficiales) + Aij de T2.
- El resto sale de Splatalogue tal cual (Aij publicado por CDMS/JPL).
- La correspondencia nombre químico -> molécula del censo es una TABLA REVISADA A MANO (CENSO abajo).
  None = la especie existe en el laboratorio pero no está en el censo (no vista en el espacio).
  Un nombre que no esté en la tabla se reporta como aviso y se trata como no vista.

Salida: data/externos/catalogo_ampliado.csv
"""
import html
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from formulas import composicion  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

# nombre químico normalizado (Splatalogue) -> fórmula tal como aparece en el censo CDMS, o None
CENSO = {
    "ethylene glycol": "(CH2OH)2", "methoxymethanol": "CH3OCH2OH", "acetone": "(CH3)2CO", "oxetane": None,
    "dimethyl ether": "(CH3)2O", "ethanol": "CH3CH2OH", "aluminum monochloride": "AlCl", "ethynyl": "C2H",
    "ethylene": "C2H4", "ethyl isocyanate": "C2H5NCO", "ethylamine": "C2H5NH2", "n-propanol": "n-C3H7OH",
    "ethyl formate": "C2H5OCHO", "hydroxyacetone": "CH3C(O)CH2OH", "cyanomethylidyne": "C2N",
    "thioxoethenylidene": "C2S", "cyanoethynylide ion": "C3N−", "1,3-butadiynyl radical": "C4H",
    "thiobutatrienylidene": "C4S", "2,4-pentadiynylidyne": "C5H", "cyanobutadiynylide anion": "C5N−",
    "thiopentatetraeynlidene": "C5S", "1,3,5-hexatriynyl": "C6H", "1,3,5-hexatriynyl anion": "C6H−",
    "phenylacetylene": "C6H5CCH", "phosphapropynylidyne": "CCP", "malononitrile": "CH2(CN)2",
    "cyanopropynyl": "CH2C3N", "methylenecyclopropene": None, "vinylacetylene": "CH2CHCCH",
    "propargyl alcohol": None, "propenal": "CH2CHCHO", "vinyl cyanide": "CH2CHCN", "vinyl isocyanide": None,
    "cyclopropene": None, "methyl acetylene": "CH3C2H", "2-butynenitrile": "CH3C3N", "butadienisonitril": None,
    "cyanoallene": "CH2CCHCN", "propargyl cyanide": "HCCCH2CN", "methyl diacetylene": "CH3C4H",
    "1-butyne": "CH3CH2CCH", "ethyl cyanide": "CH3CH2CN", "ethyl isocyanide": None, "propargylamine": None,
    "ethanethiol": "CH3CH2SH", "ethylenimine": None, "vinylamine": "C2H3NH2", "acetaldehyde": "CH3CHO",
    "ethylene oxide": "c-C2H4O", "oxirane": "c-C2H4O", "vinyl alcohol": "H2CCHOH", "ethylene sulfide": None,
    "methyl cyanide": "CH3CN", "hydroxyacetonitrile": "HOCH2CN", "methyl cyanate": None,
    "methyl isocyanate": "CH3NCO", "methyl isocyanide": "CH3NC", "methylamine": "CH3NH2", "methoxy": "CH3O",
    "1,2-propanediol": None, "1,3-propanediol": None, "methanol": "CH3OH", "methyl mercaptan": "CH3SH",
    "pyrrole": None, "cyclo-propyl cyanide": None, "pyridine": None, "ethenthione": "H2C2S",
    "propadienthione": "H2C3S", "formaldehyde": "H2CO", "aminoacetonitrile": "H2NCH2CN", "water": "H2O",
    "hydrogen peroxide": "H2O2", "cyanoformaldehyde": "HC(O)CN", "acetic acid": "CH3COOH",
    "glycolaldehyde": "CH2OHCHO", "methyl formate": "HC(O)OCH3", "monothiformic acid": "HC(O)SH",
    "monothioformic acid": "HC(O)SH", "cyanoacetylene": "HC3N", "ethyne isocyanide": "HCCNC",
    "2-propynal": "HCCCHO", "propynal": "HCCCHO", "cyclopropenone": "c-H2C3O", "propadienone": "l-H2C3O",
    "propynonyl": "HCCCO", "formyl radical": "HCO", "formic acid": "HCOOH", "methylene peroxide": None,
    "cyanomethanimine": "HNCHCN", "cyanoamidogen/iminomethyleneamidogen": "HNCN",
    "isothiocyanic acid": "HNCS", "hydroperoxy radical": "HO2",
    "glycine": None,                      # CDMS: detección cuestionada, "not yet detected"
    "methyl carbamate": "CH3OC(O)NH2", "aminoethanol": "HOCH2CH2NH2", "vinyl formate": None, "hono": "HONO",
    "thiosulfeno": "HS2", "potassium cyanide, potassium isocyanide": "KCN", "magnesium monoacetylide": "MgC2H",
    "magnesium isocyanide": "MgNC", "protonated dicyane": "NCCNH+", "formamide": "NH2CHO", "ammonia": "NH3",
    "nitric oxide": "NO", "hydroxyl radical": "OH", "phosphine": "PH3", "phosphorus monoxide": "PO",
    "sulfur monoxide ion": "SO+", "sulfur dioxide": "SO2", "disilicone carbide": "Si2C",
    "silicon tetracarbide": "SiC4", "silicon cyanide": "SiCN", "silyl cyanide": "SiH3CN",
    "silicon mononitride": "SiN", "titanium dioxide": "TiO2", "cyclopropenylidene": "c-C3H2",
    "propadienylidene": "l-C3H2", "o-benzyne": "c-C6H4", "benzonitrile": "c-C6H5CN", "silicon carbide": "c-SiC2",
    "cyclopropynylidyne": "c-C3H", "propynylidyne": "l-C3H", "butatrienylidene": "l-C4H2",
    "3-cyano-1,2-propadienylidene": "l-HC4N", "butyronitrile": "n-C3H7CN", "n-butyronitrile": "n-C3H7CN",
    "iso-propyl cyanide": "i-C3H7CN",
    # composición no coincidente por notación isotópica, pero sí están en el censo
    "3-thioxo-1,2-propadieylidene": "C3S", "3-thioxo-1,2-propadienylidene": "C3S", "hydrogen cyanide": "HCN",
    "isocyanic acid": "HNCO", "ketene": "H2C2O", "methanimine": "H2CNH", "silicon monosulfide": "SiS",
    "silicon monoxide": "SiO", "sodium cyanide": "NaCN", "potassium chloride": "KCl",
    # en el laboratorio pero no en el censo
    "dihydroxyacetone": None,             # CDMS: detección cuestionada
    "2-cyanobutane": None, "2-isocyano-3-propynenitrile": None, "3-methylbutyronitrile": None, "anisole": None,
    "benzaldehyde": None, "bromine dioxide": None, "butadiynylsilylidyne": None, "calcium monomethyl": None,
    "calcium monofluoride": None, "carbonyl cyanide": None, "carbonyl fluoride": None, "chlorine dioxide": None,
    "chlorine monoxide": None, "chlorine nitrate": None, "chlorine peroxide": None, "chloryl chloride": None,
    "cyanoethenone": None, "cyanoethynyl silylidyne": None, "cyanoformamide": None, "cyanosilylidene": None,
    "cyclopentadieneoxide": None, "diethyl ether": None, "difluoromethane": None, "diketene": None,
    "disilyne": None, "disulfur dioxide": None, "disulfurmonoxide": None, "dithioformic acid": None,
    "ethane": None, "formyl chloride": None, "formyl fluoride": None, "furan": None, "hooo radical": None,
    "hydrogen disulfide": None, "hypochlorous acid": None, "iodine monoxide": None, "manganese monoxide": None,
    "methyl chloride": None, "methyl peroxide": None, "methyl thiocyanate": None,
    "methyleneaminoacetonitrile": None, "nitric acid": None, "nitrogen dioxide": None, "nitrosyl cyanide": None,
    "nitryl chloride": None, "ozone": None, "peroxynitric acid": None, "peroxynitrous acid": None,
    "phenol": None, "phosphidogen": None, "phosphorus dioxide": None, "propane": None,
    "scandium monochloride": None, "selenium dioxide": None, "sulfuric acid": None, "tetrasulfur": None,
    "thiozone": None, "titanium sulfide": None, "vinoxy": None, "yttrium monoxide": None,
    "yttrium monosulfide": None, "silylidene": None, "n-butyl cyanide": None, "t-butyl cyanide": None, "α-alanine": None,
}


def norm(chem: str) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", "", str(chem))).strip().lower()
    s = re.sub(r",?\s*v[a-z]?\s*\d*\s*=\s*\d.*$", "", s)                     # ", v18 = 1", ", vt = 0, 1"
    s = re.sub(r",?\s*(gauche/anti combined|anti|gauche)$", "", s)
    s = re.sub(r",?\s*(cis|trans)-isomer$", "", s)
    s = re.sub(r"\s*\((g\.s\.|global fit).*\)$", "", s)
    s = re.sub(r",\s*[a-z'g]+$", "", s) if s.startswith(("1,2-propanediol", "1,3-propanediol")) else s
    s = re.sub(r"^(anti|gauche|trans|cis|<i>anti</i>)\s*-\s*", "", s)
    s = re.sub(r"\s+-\s+", " ", s).strip()
    return {"cis honо": "hono", "cis hono": "hono", "trans hono": "hono"}.get(s, s)


def es_isotopologo(nombre: str) -> bool:
    n = re.split(r"\s", html.unescape(re.sub(r"<[^>]+>", "", nombre)).strip())[0]
    return bool(re.search(r"D|\d{2}[A-Z]", n.replace("Dimethyl", "")))


cen = pd.read_csv(ROOT / "data/externos/censo_cdms_2026-09.csv")
cen_idx = cen.set_index("formula")
loc = pd.read_csv(ROOT / "data/externos/catalogo_local_con_aij.csv", dtype={"entrada": str})
sp = pd.read_csv(ROOT / "data/externos/splatalogue_CDMS_JPL_348.80-349.80GHz.csv")

# 1) filas de Splatalogue que NO son de las especies del catálogo oficial (ésas van con sus filas oficiales)
tags_loc = set(loc.tag_original.abs())
# misma transición = misma E_sup (±0.5 K) y frecuencia a < 1 MHz (CDMS y JPL pueden diferir hasta ~0.7 MHz)
lf_, le_ = loc.frecuencia_reposo_MHz.to_numpy(), loc.E_superior_K.to_numpy()
dup_loc = np.array([bool(np.any((np.abs(lf_ - f) < 1.0) & (np.abs(le_ - e) < 0.5)))
                    for f, e in zip(sp.orderedfreq, sp.upper_state_energy_K)])
ext = sp[~sp.moleculeTag.abs().isin(tags_loc) & ~dup_loc].copy()

# 2) una sola lista por transición: si CDMS y JPL repiten la misma, se queda CDMS
ext["nq"] = ext.chemical_name.map(norm)
ext["iso"] = ext.name.map(es_isotopologo)
ext["_base"] = ext.name.map(lambda s: re.split(r"\s", html.unescape(re.sub(r"<[^>]+>", "", s)).strip())[0])
ext = ext.sort_values(["linelist", "orderedfreq"]).reset_index(drop=True)          # "CDMS" < "JPL"
quitar = set()
for _, g in ext.groupby(["nq", "_base"]):
    if g.linelist.nunique() < 2:
        continue
    cd, jp = g[g.linelist == "CDMS"], g[g.linelist == "JPL"]
    for j, r in jp.iterrows():
        if np.any((np.abs(cd.orderedfreq - r.orderedfreq) < 1.0) &
                  (np.abs(cd.upper_state_energy_K - r.upper_state_energy_K) < 0.5)):
            quitar.add(j)
# además, filas repetidas exactas dentro de una misma lista
ext = ext.drop(index=list(quitar)).drop_duplicates(["nq", "_base", "orderedfreq", "upper_state_energy_K"])
print("duplicados CDMS/JPL eliminados:", len(quitar))

avisos = sorted(set(ext.nq) - set(CENSO))
ext["formula_censo"] = ext.nq.map(lambda k: CENSO.get(k))

# 3) catálogo oficial (13 especies), con su mapeo al censo
LOC2CENSO = {"CH3OH": "CH3OH", "13CH3OH": "CH3OH", "CH2DOH": "CH3OH", "CH3CN": "CH3CN", "NH2CHO": "NH2CHO",
             "CH3CHO": "CH3CHO", "CH3OCHO": "HC(O)OCH3", "CH2(OH)CHO": "CH2OHCHO", "C2H5OH": "CH3CH2OH",
             "CH3OCH3": "(CH3)2O", "C2H5CN": "CH3CH2CN", "SO2": "SO2", "Glycine-I": None}
L = pd.DataFrame(dict(
    especie=loc.especie, nombre_quimico=loc.especie, formula_censo=loc.especie.map(LOC2CENSO),
    isotopologo=loc.especie.isin(["13CH3OH", "CH2DOH"]), origen="catalogo_local_oficial",
    lista=loc.catalogo, tag=loc.tag_original, frecuencia_reposo_MHz=loc.frecuencia_reposo_MHz,
    incertidumbre_MHz=loc.incertidumbre_MHz, log10_Aij=loc.log10_Aij_s_1, E_superior_K=loc.E_superior_K,
    g_superior=loc.g_superior, QN=loc.QN_superior.astype(str) + " - " + loc.QN_inferior.astype(str)))
E = pd.DataFrame(dict(
    especie=ext.name.map(lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()),
    nombre_quimico=ext.chemical_name.map(lambda s: html.unescape(re.sub(r"<[^>]+>", "", str(s))).strip()),
    formula_censo=ext.formula_censo, isotopologo=ext.iso, origen="splatalogue", lista=ext.linelist,
    tag=ext.moleculeTag, frecuencia_reposo_MHz=ext.orderedfreq, incertidumbre_MHz=np.nan, log10_Aij=ext.aij,
    E_superior_K=ext.upper_state_energy_K, g_superior=pd.to_numeric(ext.upperStateDegen, errors="coerce"),
    QN=ext.resolved_QNs.map(lambda q: html.unescape(re.sub(r"<[^>]+>", "", str(q))).strip())))
cat = pd.concat([L, E], ignore_index=True)

# 4) etiquetas del censo: estado y nº de átomos
def info(row):
    f = row.formula_censo
    if isinstance(f, str) and f in cen_idx.index:
        c = cen_idx.loc[f]
        return pd.Series(dict(visto_en_espacio=c.estado, n_atomos=c.n_atomos, solo_IR=c.solo_IR))
    comp = composicion(row.especie)[0]
    n = sum(int(x) for x in re.findall(r"[A-Z][a-z]?(\d+)", comp)) if comp else np.nan
    return pd.Series(dict(visto_en_espacio="no detectada", n_atomos=str(n), solo_IR=False))

cat = pd.concat([cat, cat.apply(info, axis=1)], axis=1)
cat.loc[cat.especie == "Glycine-I", "n_atomos"] = "10"
cat.to_csv(ROOT / "data/externos/catalogo_ampliado.csv", index=False)

print("transiciones:", len(cat), "| oficiales:", (cat.origen == "catalogo_local_oficial").sum(),
      "| splatalogue:", (cat.origen == "splatalogue").sum())
print("moléculas del censo representadas:", cat.formula_censo.dropna().nunique())
print(cat.groupby("visto_en_espacio").agg(transiciones=("especie", "size"),
                                          nombres_quimicos=("nombre_quimico", "nunique")).to_string())
print("sin Aij:", cat.log10_Aij.isna().sum())
fallo = cat.formula_censo.dropna()[~cat.formula_censo.dropna().isin(cen_idx.index)].unique()
print("fórmulas de la tabla que no existen en el censo:", list(fallo))
print("AVISO nombres químicos sin revisar:", avisos)

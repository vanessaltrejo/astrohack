"""Fichas de moléculas: descripción, condiciones abióticas favorables (entorno) y relevancia biótica/prebiótica.

BORRADOR REDACTADO CON IA (Claude) — TODAS LAS FICHAS ESTÁN PENDIENTES DE VERIFICACIÓN por el equipo.
- Fichas manuales (MANUAL): moléculas con líneas en nuestra banda que importan para la identificación,
  más las de interés prebiótico. Texto específico.
- Resto: ficha generada por familia química (reglas en `familia()`), texto genérico de su familia.

El campo `entorno` alimenta el factor de entorno del motor:
  hot_corino (1.0)  -> se observa en núcleos calientes protoestelares como IRAS 16293-2422 B
  ubicua (1.0)      -> moléculas simples presentes en casi todos los entornos, incluidos hot corinos
  nube_fria (0.5)   -> típica de nubes oscuras frías (cadenas de carbono, iones, radicales)
  circunestelar (0.1) -> envolturas de estrellas evolucionadas (compuestos con metales)
  atmosfera_lab (0.1) -> química atmosférica terrestre o sólo de laboratorio, no observada en el ISM

Salida: data/externos/fichas_moleculas.json (348 del censo + especies de laboratorio con líneas en la banda)
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from formulas import composicion  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

FACTOR_ENTORNO = {"hot_corino": 1.0, "ubicua": 1.0, "nube_fria": 0.5, "circunestelar": 0.1, "atmosfera_lab": 0.1}

# relevancia: "directa" (bloque o precursor directo de biomoléculas), "relacionada", "no_conocida"
MANUAL = {
    "CH3OH": dict(nombre="Metanol", entorno="hot_corino", relevancia="relacionada",
        descripcion="El alcohol más simple; se forma en los hielos de los granos por hidrogenación de CO y se libera al gas al calentarse (>100 K). Es la base de la química orgánica compleja en hot corinos.",
        abiotico="Hielos de granos fríos (10–20 K) + calentamiento protoestelar que los sublima.",
        biotico="En la Tierra lo producen microorganismos (metilótrofos) y la degradación de pectinas; precursor de moléculas orgánicas mayores."),
    "CH3CN": dict(nombre="Acetonitrilo (cianuro de metilo)", entorno="hot_corino", relevancia="relacionada",
        descripcion="Trompo simétrico: sus transiciones J→J−1 forman una 'escalera' de componentes K muy juntas, clásica para medir temperatura en núcleos calientes.",
        abiotico="Gas caliente (100–300 K) cerca de protoestrellas; química en fase gas y en hielos.",
        biotico="Nitrilo; los nitrilos son precursores propuestos de aminoácidos y nucleobases (química del HCN)."),
    "CH3CHO": dict(nombre="Acetaldehído", entorno="hot_corino", relevancia="relacionada",
        descripcion="Aldehído de dos carbonos, abundante en hot corinos y en cometas.",
        abiotico="Química de granos y de fase gas en regiones templadas/calientes.",
        biotico="Intermediario del metabolismo (fermentación alcohólica); precursor propuesto de azúcares y de alanina (síntesis de Strecker)."),
    "HC(O)OCH3": dict(nombre="Formiato de metilo", entorno="hot_corino", relevancia="relacionada",
        descripcion="Éster más simple; muy abundante en hot corinos, con muchísimas líneas en submilimétrico.",
        abiotico="Hot corinos y núcleos calientes; formación en hielos y en fase gas.",
        biotico="Isómero del glicolaldehído y del ácido acético (C2H4O2); sirve de referencia para comparar isómeros prebióticos."),
    "CH2OHCHO": dict(nombre="Glicolaldehído", entorno="hot_corino", relevancia="directa",
        descripcion="El azúcar más simple: dos carbonos, un aldehído y un alcohol. Detectado hacia IRAS 16293-2422 B (Jørgensen et al. 2012).",
        abiotico="Hielos irradiados o calentados; reacción formosa a partir de formaldehído.",
        biotico="Precursor de la ribosa (azúcar del ARN) vía reacción formosa."),
    "CH3CH2OH": dict(nombre="Etanol", entorno="hot_corino", relevancia="relacionada",
        descripcion="Alcohol de dos carbonos, presente en hot corinos y cometas.",
        abiotico="Hielos de granos; liberado en regiones calientes.",
        biotico="Producto de la fermentación en la Tierra; no es biomarcador en el espacio."),
    "(CH3)2O": dict(nombre="Dimetil éter", entorno="hot_corino", relevancia="no_conocida",
        descripcion="Éter más simple; abundante en núcleos calientes, isómero del etanol.",
        abiotico="Hot corinos; formación en hielos y fase gas a partir de metanol.",
        biotico="Sin papel biológico conocido."),
    "CH3CH2CN": dict(nombre="Propionitrilo (cianuro de etilo)", entorno="hot_corino", relevancia="relacionada",
        descripcion="Nitrilo saturado de tres carbonos, típico de núcleos calientes.",
        abiotico="Hot cores/corinos; química de hielos ricos en nitrógeno.",
        biotico="Nitrilo; familia química precursora de aminoácidos."),
    "NH2CHO": dict(nombre="Formamida", entorno="hot_corino", relevancia="directa",
        descripcion="Molécula más simple con enlace peptídico (–C(O)–N–). Detectada hacia IRAS 16293-2422 (Kahane et al. 2013; Coutens et al. 2016).",
        abiotico="Hot corinos y choques; formación en hielos o fase gas (NH2 + H2CO).",
        biotico="Con calor y minerales produce nucleobases, aminoácidos y azúcares (química de formamida)."),
    "SO2": dict(nombre="Dióxido de azufre", entorno="ubicua", relevancia="no_conocida",
        descripcion="Molécula de azufre común en choques, flujos y regiones calientes.",
        abiotico="Choques, flujos protoestelares, atmósferas volcánicas.",
        biotico="Sin papel biológico directo; en la Tierra, sobre todo volcánico e industrial."),
    "Glycine": dict(nombre="Glicina", entorno="hot_corino", relevancia="directa",
        descripcion="El aminoácido más simple. NO detectada en el ISM según CDMS (detecciones cuestionadas); sí hallada en el cometa 67P (Rosetta) y en meteoritos.",
        abiotico="Se espera en hielos irradiados/calentados; sus líneas serían débiles y con muchos niveles.",
        biotico="Bloque de las proteínas; detectarla en el ISM sería clave para el origen de la vida."),
    "H2CO": dict(nombre="Formaldehído", entorno="ubicua", relevancia="directa",
        descripcion="Aldehído más simple, en casi todos los entornos.", abiotico="Ubicuo; fase gas y hielos.",
        biotico="Materia prima de la reacción formosa (azúcares)."),
    "HCN": dict(nombre="Cianuro de hidrógeno", entorno="ubicua", relevancia="directa",
        descripcion="Nitrilo más simple, trazador de gas denso.", abiotico="Ubicuo.",
        biotico="Su oligomerización produce adenina y aminoácidos (química de Oró)."),
    "HC3N": dict(nombre="Cianoacetileno", entorno="ubicua", relevancia="directa",
        descripcion="Cadena de carbono más simple de la familia HCnN.", abiotico="Nubes frías y hot corinos.",
        biotico="Precursor propuesto de pirimidinas (citosina)."),
    "HNCO": dict(nombre="Ácido isociánico", entorno="ubicua", relevancia="relacionada",
        descripcion="Molécula más simple con C, H, N y O.", abiotico="Ubicuo, abundante en choques y hot corinos.",
        biotico="Relacionado químicamente con la formamida y los enlaces peptídicos."),
    "H2NCH2CN": dict(nombre="Aminoacetonitrilo", entorno="hot_corino", relevancia="directa",
        descripcion="Precursor directo de la glicina por hidrólisis.", abiotico="Núcleos calientes (Sgr B2).",
        biotico="Vía de Strecker hacia la glicina."),
    "H2NC(O)NH2": dict(nombre="Urea", entorno="hot_corino", relevancia="directa",
        descripcion="Primera molécula orgánica sintetizada en el laboratorio (Wöhler, 1828).",
        abiotico="Núcleos calientes (Sgr B2).", biotico="Precursora de pirimidinas; producto del metabolismo."),
    "HOCH2CH2NH2": dict(nombre="Etanolamina", entorno="hot_corino", relevancia="directa",
        descripcion="Cabeza polar de fosfolípidos.", abiotico="Nube molecular G+0.693 (centro galáctico).",
        biotico="Componente de membranas celulares."),
    "(CH2OH)2": dict(nombre="Etilenglicol", entorno="hot_corino", relevancia="relacionada",
        descripcion="Alcohol de azúcar más simple; reducido del glicolaldehído.", abiotico="Hot corinos y cometas.",
        biotico="Relacionado con la química de azúcares."),
    "CH3COOH": dict(nombre="Ácido acético", entorno="hot_corino", relevancia="relacionada",
        descripcion="Ácido carboxílico; isómero del formiato de metilo.", abiotico="Núcleos calientes.",
        biotico="Metabolito universal (acetil-CoA)."),
    "CH3NCO": dict(nombre="Isocianato de metilo", entorno="hot_corino", relevancia="relacionada",
        descripcion="Detectado hacia IRAS 16293-2422 B (Ligterink et al. 2017; Martín-Doménech et al. 2017).",
        abiotico="Hot corinos.", biotico="Contiene un grupo similar al enlace peptídico."),
    "CH3OC(O)NH2": dict(nombre="Carbamato de metilo", entorno="hot_corino", relevancia="relacionada",
        descripcion="Isómero de la glicina, detectado recientemente.", abiotico="Hot cores.",
        biotico="Isómero de la glicina: útil para distinguir falsas detecciones de glicina."),
    "NH2OH": dict(nombre="Hidroxilamina", entorno="hot_corino", relevancia="directa",
        descripcion="Precursora propuesta de aminoácidos y del ARN.", abiotico="Nube G+0.693.",
        biotico="Precursora en rutas de síntesis de ribonucleótidos."),
    "(CH3)2S": dict(nombre="Dimetil sulfuro", entorno="hot_corino", relevancia="relacionada",
        descripcion="Detectado en el ISM en 2025.", abiotico="Nube molecular del centro galáctico.",
        biotico="En la Tierra lo produce casi sólo la vida (fitoplancton): biomarcador propuesto en exoplanetas, aunque su detección en el ISM muestra que también se forma sin vida."),
    "PH3": dict(nombre="Fosfina", entorno="circunestelar", relevancia="relacionada",
        descripcion="Detectada en envolturas de estrellas evolucionadas (IRC+10216).",
        abiotico="Envolturas circunestelares ricas en carbono.",
        biotico="Biomarcador propuesto (caso de Venus, Greaves et al. 2020, diapositiva 12); el fósforo es esencial para ADN/ARN."),
    "H2O": dict(nombre="Agua", entorno="ubicua", relevancia="directa",
        descripcion="Muy abundante en hielos y gas caliente.", abiotico="Ubicua.", biotico="Disolvente de la vida."),
    "SiO": dict(nombre="Monóxido de silicio", entorno="ubicua", relevancia="no_conocida",
        descripcion="Trazador de choques: el silicio se libera de los granos.", abiotico="Choques y flujos protoestelares.",
        biotico="Sin papel biológico."),
    "SiS": dict(nombre="Monosulfuro de silicio", entorno="ubicua", relevancia="no_conocida",
        descripcion="Choques y envolturas circunestelares.", abiotico="Choques, envolturas de estrellas AGB.",
        biotico="Sin papel biológico."),
    "CH3SH": dict(nombre="Metanotiol", entorno="hot_corino", relevancia="relacionada",
        descripcion="Análogo de azufre del metanol.", abiotico="Hot corinos.", biotico="Producto del metabolismo bacteriano."),
    "HCOOH": dict(nombre="Ácido fórmico", entorno="hot_corino", relevancia="relacionada",
        descripcion="Ácido carboxílico más simple.", abiotico="Hot corinos, hielos.", biotico="Metabolito común."),
    "CH2CHCN": dict(nombre="Cianuro de vinilo (acrilonitrilo)", entorno="hot_corino", relevancia="relacionada",
        descripcion="Nitrilo insaturado; también en la atmósfera de Titán.", abiotico="Núcleos calientes, Titán.",
        biotico="Se propuso que forma membranas (azotosomas) en Titán."),
    "CH3NH2": dict(nombre="Metilamina", entorno="hot_corino", relevancia="directa",
        descripcion="Amina más simple.", abiotico="Núcleos calientes; también en el cometa 67P.",
        biotico="Precursora de la glicina en hielos irradiados."),
}

ATMOSFERA = {"Cl", "Br", "I", "F", "Se"}            # halógenos y otros típicos de química atmosférica/lab
METALES = {"Al", "Na", "K", "Mg", "Ca", "Fe", "Ti", "Sc", "Y", "Mn"}


def familia(formula: str, nombre_quimico: str = "") -> tuple[str, str, str]:
    """(familia, entorno, relevancia) por reglas químicas. Sólo para fichas sin redacción manual."""
    comp, _ = composicion(formula)
    els = set(re.findall(r"[A-Z][a-z]?", comp))
    n = sum(int(x) for x in re.findall(r"[A-Z][a-z]?(\d+)", comp)) if comp else 0
    carga = comp.endswith(("+", "-"))
    nq = nombre_quimico.lower()
    if els & METALES:
        return "compuesto con metal", "circunestelar", "no_conocida"
    if els & ATMOSFERA and "HCl" not in formula and formula not in {"AlCl", "NaCl", "KCl", "HF", "CF+", "AlF", "H2Cl+", "HCl+", "CH3Cl"}:
        return "halógeno / química atmosférica", "atmosfera_lab", "no_conocida"
    if any(k in nq for k in ["nitric", "nitrogen dioxide", "ozone", "peroxy", "sulfuric", "hypochlor", "peroxynit"]):
        return "química atmosférica", "atmosfera_lab", "no_conocida"
    if carga:
        return "ion", "nube_fria", "no_conocida"
    if "Si" in els or "P" in els:
        return "compuesto de silicio/fósforo", "circunestelar" if "Si" in els and n > 3 else "ubicua", \
            "relacionada" if "P" in els else "no_conocida"
    h = int(re.search(r"H(\d+)", comp).group(1)) if re.search(r"H(\d+)", comp) else 0
    c = int(re.search(r"C(\d+)", comp).group(1)) if re.search(r"C(\d+)", comp) else 0
    if c >= 6 and h <= c and ("N" in els or els <= {"C", "H"}):
        return "aromático / cadena larga", "nube_fria", "no_conocida"
    if c >= 3 and h <= 2:
        return "cadena de carbono insaturada", "nube_fria", "no_conocida"
    if n <= 4:
        return "molécula simple", "ubicua", "relacionada" if els & {"N", "O"} and "C" in els else "no_conocida"
    if c >= 1 and h >= c and (els & {"O", "N", "S"}):
        return "orgánica compleja saturada (COM)", "hot_corino", "relacionada" if els & {"N"} else "no_conocida"
    return "orgánica insaturada", "nube_fria", "no_conocida"


TEXTO_FAMILIA = {
    "compuesto con metal": ("Molécula con átomo metálico, observada sobre todo en envolturas de estrellas evolucionadas.",
                            "Envolturas circunestelares calientes de estrellas AGB, donde los metales están en fase gas."),
    "halógeno / química atmosférica": ("Especie medida en laboratorio, propia de la química atmosférica terrestre.",
                                       "Atmósferas planetarias o laboratorio; no observada en el medio interestelar."),
    "química atmosférica": ("Especie medida en laboratorio, propia de la química atmosférica terrestre.",
                            "Atmósferas planetarias o laboratorio; no observada en el medio interestelar."),
    "ion": ("Ion molecular; vive poco en gas denso porque se recombina rápido.",
            "Nubes frías o difusas ionizadas por rayos cósmicos o UV."),
    "compuesto de silicio/fósforo": ("Molécula con silicio o fósforo.",
                                     "Choques (Si liberado de granos) o envolturas circunestelares."),
    "aromático / cadena larga": ("Molécula aromática o cadena larga de carbono.",
                                 "Nubes oscuras frías (p. ej. TMC-1), química rica en carbono."),
    "cadena de carbono insaturada": ("Cadena de carbono pobre en hidrógeno.",
                                     "Nubes oscuras frías y envolturas ricas en carbono."),
    "molécula simple": ("Molécula de pocos átomos.", "Presente en muchos entornos, incluidos núcleos calientes."),
    "orgánica compleja saturada (COM)": ("Molécula orgánica compleja rica en hidrógeno.",
                                         "Núcleos calientes protoestelares: se forma en hielos y se libera al calentarse."),
    "orgánica insaturada": ("Molécula orgánica con enlaces múltiples.", "Nubes frías y regiones templadas."),
}


def ficha(formula, n_atomos, estado, nombre_quimico="", en_censo=True, url=""):
    n_atomos = "?" if pd.isna(n_atomos) else str(n_atomos)
    url = "" if pd.isna(url) else url
    m = MANUAL.get(formula)
    fam, ent, rel = familia(formula, nombre_quimico)
    if formula == "Glycine":
        fam = "aminoácido"
    if m:
        return dict(formula=formula, nombre=m["nombre"], n_atomos=n_atomos, visto_en_espacio=estado,
                    en_censo=en_censo, familia=fam, entorno=m["entorno"],
                    factor_entorno=FACTOR_ENTORNO[m["entorno"]], relevancia_biotica=m["relevancia"],
                    descripcion=m["descripcion"], condiciones_abioticas=m["abiotico"],
                    condiciones_bioticas=m["biotico"], tipo_ficha="manual", url_cdms=url,
                    verificacion="pendiente", fuente_texto="borrador IA (Claude)")
    if en_censo and ent == "atmosfera_lab":      # está en el censo: sí se ha visto en el espacio
        fam, ent = "molécula simple", "ubicua"
    desc, abio = TEXTO_FAMILIA[fam]
    return dict(formula=formula, nombre=nombre_quimico or formula, n_atomos=n_atomos, visto_en_espacio=estado,
                en_censo=en_censo, familia=fam, entorno=ent, factor_entorno=FACTOR_ENTORNO[ent],
                relevancia_biotica=rel, descripcion=desc, condiciones_abioticas=abio,
                condiciones_bioticas="Sin papel biológico conocido." if rel == "no_conocida" else
                "Contiene C con N/O: familia química relacionada con precursores prebióticos.",
                tipo_ficha="por familia", url_cdms=url, verificacion="pendiente", fuente_texto="borrador IA (Claude)")


if __name__ == "__main__":
    cen = pd.read_csv(ROOT / "data/externos/censo_cdms_2026-09.csv")
    cat = pd.read_csv(ROOT / "data/externos/catalogo_ampliado.csv")
    nombres = cat.dropna(subset=["formula_censo"]).groupby("formula_censo").nombre_quimico.first().to_dict()
    nombres.update({"CH3OH": "Methanol", "CH3CN": "Methyl Cyanide", "SO2": "Sulfur Dioxide"})
    fichas = [ficha(r.formula, r.n_atomos, r.estado, nombres.get(r.formula, ""), True, r.url_cdms)
              for r in cen.itertuples()]
    # especies de laboratorio con líneas en la banda que NO están en el censo
    nc = cat[cat.formula_censo.isna()].groupby("nombre_quimico").agg(especie=("especie", "first"),
                                                                     n=("n_atomos", "first")).reset_index()
    for r in nc.itertuples():
        clave = "Glycine" if r.nombre_quimico in ("Glycine", "Glycine-I") else r.especie
        if clave == "Glycine" and any(f["formula"] == "Glycine" for f in fichas):
            continue
        f = ficha(clave, r.n, "no detectada", r.nombre_quimico, False)
        f["especie_laboratorio"] = r.especie
        fichas.append(f)
    out = ROOT / "data/externos/fichas_moleculas.json"
    out.write_text(json.dumps(fichas, ensure_ascii=False, indent=1, allow_nan=False))
    (ROOT / "web/public/data/fichas_moleculas.json").write_text(json.dumps(fichas, ensure_ascii=False, allow_nan=False))
    df = pd.DataFrame(fichas)
    print("fichas:", len(df), "| del censo:", df.en_censo.sum(), "| manuales:", (df.tipo_ficha == "manual").sum())
    print(df.groupby(["en_censo", "entorno"]).size().to_string())
    print(df[df.en_censo & (df.entorno.isin(["circunestelar", "atmosfera_lab"]))].formula.tolist()[:60])

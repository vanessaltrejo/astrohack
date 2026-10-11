"""Análisis prebiótico de una molécula: ingredientes, factores bióticos y abióticos, y veredicto en el espacio y en la Tierra.

Base: documentos de la competencia (Documento de participantes: relación con ingredientes o procesos anteriores a la
vida, «también es válido concluir que el vínculo todavía es incierto»; presentación de apertura: diap. 3 —C, H, N, O, P, S y su
papel—, diap. 6 —ADN/ARN—, diap. 8 —nube fría → calentamiento → disco—, diap. 25 —relacionar con una ruta química y con
las condiciones que necesitaría—) y la retroalimentación de los jueces (factor biótico clave: el agua o solvente;
biomoléculas: proteínas, ácidos nucleicos, lípidos, carbohidratos; factores abióticos: temperatura, aire, presión,
gravedad).

Criterios (explícitos, no una etiqueta «porque sí»):
  · directa      → existe una ruta química conocida hacia una familia de biomoléculas (tabla RUTAS, revisada a mano);
                   el agua es el solvente de la vida y se clasifica aparte.
  · ingrediente  → contiene C y al menos uno de N, O, P o S, sin ruta directa conocida.
  · sin_papel    → el resto.
Los elementos CHNOPS salen de la fórmula (dato). Las rutas y textos son BORRADOR DE IA, pendientes de verificación.
"""
import re

from formulas import composicion

# Papel de cada elemento según la diapositiva 3 de la presentación de apertura
CHNOPS = {
    "C": "estructura de las moléculas orgánicas",
    "H": "agua y moléculas orgánicas",
    "N": "proteínas y bases del ADN/ARN",
    "O": "agua y muchas biomoléculas",
    "P": "ADN/ARN y membranas",
    "S": "algunos aminoácidos y enzimas",
}

FAMILIAS = {
    "proteinas": "Proteínas",
    "acidos_nucleicos": "ADN / ARN",
    "lipidos": "Lípidos y membranas",
    "carbohidratos": "Azúcares",
}

# Las mismas familias dentro de una frase
EN_FRASE = {"proteinas": "proteínas", "acidos_nucleicos": "ADN/ARN", "lipidos": "lípidos de membrana", "carbohidratos": "azúcares"}

# Rutas conocidas hacia biomoléculas (fórmula del censo → familia → cómo). Borrador de IA, pendiente de verificación.
RUTAS = {
    "HCN": {"acidos_nucleicos": "su oligomerización produce adenina", "proteinas": "aminoácidos vía síntesis de Strecker"},
    "H2CO": {"carbohidratos": "reacción formosa: forma azúcares, entre ellos la ribosa"},
    "CH2OHCHO": {"carbohidratos": "reacción formosa hacia la ribosa", "acidos_nucleicos": "ribosa del ARN; con cianamida forma ribonucleótidos"},
    "NH2CHO": {"acidos_nucleicos": "al calentarse con minerales forma nucleobases", "proteinas": "la misma química forma aminoácidos"},
    "H2NCH2CN": {"proteinas": "su hidrólisis produce glicina"},
    "Glycine": {"proteinas": "es un aminoácido: bloque directo de las proteínas"},
    "H2NC(O)NH2": {"acidos_nucleicos": "precursora de pirimidinas (citosina, uracilo)"},
    "HOCH2CH2NH2": {"lipidos": "cabeza polar de los fosfolípidos de membrana"},
    "NH2OH": {"acidos_nucleicos": "propuesta en rutas hacia ribonucleótidos", "proteinas": "propuesta en rutas hacia aminoácidos"},
    "HC3N": {"acidos_nucleicos": "con urea o cianato forma citosina"},
    "CH3NH2": {"proteinas": "forma glicina en hielos irradiados"},
    "CH3CHO": {"proteinas": "produce alanina vía síntesis de Strecker"},
}

# Solvente que necesita la ruta en un planeta (por defecto, agua líquida)
SOLVENTE = {
    "NH2CHO": "Puede actuar como su propio solvente; con agua también funciona",
    "Glycine": "Agua, con ciclos de humedad y secado para unir aminoácidos en cadenas",
}
TEMPERATURA_PLANETA = {"NH2CHO": "100–160 °C, calentada con minerales"}

TEMPERATURA_ESPACIO = {
    "hot_corino": "Se forma en hielos a 10–20 K y pasa al gas por encima de ~100 K (núcleo caliente)",
    "ubicua": "Presente tanto en gas frío (10–20 K) como caliente (> 100 K)",
    "nube_fria": "Gas frío, 10–20 K",
    "circunestelar": "Envolturas de estrellas evolucionadas, de cientos a miles de K",
    "atmosfera_lab": "Condiciones de laboratorio o de atmósferas planetarias",
}


def chnops(formula: str) -> list[str]:
    comp, _ = composicion(formula)
    presentes = set(re.findall(r"[A-Z][a-z]?", comp))
    if formula == "Glycine":                      # el nombre no es una fórmula
        presentes = {"C", "H", "N", "O"}
    return [e for e in CHNOPS if e in presentes]


def analizar(formula: str, entorno: str, estado: str) -> dict:
    el = chnops(formula)
    rutas = RUTAS.get(formula, {})
    if formula == "H2O":
        clase = "solvente"
    elif rutas:
        clase = "directa"
    elif "C" in el and set(el) & {"N", "O", "P", "S"}:
        clase = "ingrediente"
    else:
        clase = "sin_papel"

    necesita_agua = clase == "directa"
    visto = estado in ("detectada", "tentativa")
    familias = [dict(familia=k, nombre=FAMILIAS[k], via=v) for k, v in rutas.items()]

    if clase == "solvente":
        tierra = "Es el solvente de la vida: sin agua líquida (u otro solvente) los ingredientes no reaccionan para formar biomoléculas."
    elif clase == "directa":
        nombres = [EN_FRASE[k] for k in rutas]
        lista = nombres[0] if len(nombres) == 1 else ", ".join(nombres[:-1]) + " y " + nombres[-1]
        tierra = f"Puede contribuir a formar {lista} si hay agua líquida, energía y temperaturas moderadas."
    elif clase == "ingrediente":
        tierra = f"Aporta {', '.join(el)} a la química orgánica, pero no conocemos una ruta directa hacia una biomolécula."
    else:
        tierra = "Sin papel prebiótico conocido."

    espacio = {
        "detectada": "Se forma y se ha observado en el espacio (censo CDMS).",
        "tentativa": "Observación tentativa en el espacio (censo CDMS).",
        "cuestionada": "Su detección en el espacio está cuestionada.",
    }.get(estado, "No confirmada en el espacio: no aparece como detectada en el censo CDMS.")

    if clase in ("directa", "solvente"):
        titular = "Prebiótica · observada en el espacio" if visto else "Prebiótica en la Tierra · no confirmada en el espacio"
    elif clase == "ingrediente":
        titular = "Ingrediente potencial"
    else:
        titular = "Sin papel prebiótico conocido"

    aplica = clase in ("directa", "solvente")
    sin_ruta = "Sin ruta conocida: no hay condiciones que evaluar."
    abioticos = {
        "temperatura": {"espacio": (TEMPERATURA_ESPACIO.get(entorno, "—") if visto
                                    else "No confirmada en el espacio. Si existiera ahí: " + TEMPERATURA_ESPACIO.get(entorno, "—")),
                        "tierra": TEMPERATURA_PLANETA.get(formula, "0–100 °C, el rango del agua líquida a 1 atm") if aplica else sin_ruta},
        "presion": {"espacio": "Casi vacío: gas extremadamente diluido",
                    "tierra": "Suficiente para que exista agua líquida (más de 0.006 atm)" if aplica else sin_ruta},
        "atmosfera": {"espacio": "No hay aire: la molécula queda expuesta a la radiación",
                      "tierra": "Protege de la radiación UV y mantiene el agua líquida" if aplica else sin_ruta},
        "gravedad": {"espacio": "No interviene",
                     "tierra": "Un planeta con gravedad suficiente retiene la atmósfera y los océanos" if aplica else sin_ruta},
        "radiacion": {"espacio": "UV y rayos cósmicos procesan los hielos y forman moléculas complejas",
                      "tierra": "Energía para las reacciones: UV, descargas eléctricas o fuentes hidrotermales" if aplica else sin_ruta},
    }

    return dict(
        clase=clase, titular=titular, chnops=el, familias=familias,
        solvente=(SOLVENTE.get(formula, "Agua líquida") if clase == "directa" else
                  "Es el solvente" if clase == "solvente" else "No aplica (sin ruta conocida)"),
        necesita_agua=necesita_agua, espacio=espacio, tierra=tierra, abioticos=abioticos,
    )


def relevancia(clase: str) -> str:
    """Relevancia biótica de la ficha, derivada del análisis (una sola fuente de verdad)."""
    return {"directa": "directa", "solvente": "directa", "ingrediente": "relacionada"}.get(clase, "no_conocida")

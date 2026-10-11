"""Composición elemental de una fórmula molecular (para emparejar el censo CDMS con Splatalogue).

Isótopos (D, 13C, 18O, 15N, 34S, ...) se cuentan como su elemento padre; se informa si es isotopólogo.
Se ignoran prefijos de isómero (l-, c-, n-, i-, E-, Z-, cis-, trans-, aGg'-, 1-, 2,5-...) y estados vibracionales.
"""
import html
import re
from collections import Counter

MASAS_ISOTOPO = {"13", "15", "17", "18", "29", "30", "33", "34", "35", "36", "37", "41", "46", "50", "79", "80", "81"}


def _tokens(f: str, mult: int, out: Counter, iso: list) -> None:
    i = 0
    while i < len(f):
        if f[i] == "(":
            depth, j = 1, i + 1
            while depth:
                depth += {"(": 1, ")": -1}.get(f[j], 0); j += 1
            m = re.match(r"\d+", f[j:])
            n = int(m.group()) if m else 1
            _tokens(f[i + 1:j - 1], mult * n, out, iso)
            i = j + (len(m.group()) if m else 0)
            continue
        m = re.match(r"(\d{1,2})?([A-Z][a-z]?)(\d*)", f[i:])
        if not m:
            i += 1; continue
        mass, el, n = m.groups()
        end = m.end()
        # "O79BrO", "CH313CN": los 2 últimos dígitos antes de una mayúscula son la masa del isótopo
        # siguiente, no un conteo (O + 79Br + O; CH3 + 13C + N).
        if len(n) >= 2 and n[-2:] in MASAS_ISOTOPO and re.match(r"[A-Z]", f[i + end:i + end + 1]):
            n, end = n[:-2], end - 2
        if el == "D":
            el = "H"; iso.append("D")
        elif mass:
            iso.append(mass + el)
        out[el] += mult * (int(n) if n else 1)
        i += end


def composicion(nombre: str) -> tuple[str, bool]:
    """('C2H4O2+', es_isotopologo) a partir de un nombre de CDMS o Splatalogue."""
    s = html.unescape(re.sub(r"<[^>]+>", "", nombre)).strip()
    s = re.split(r"\s|,\s", s)[0]                                   # quita "v=0", ", vt = 0, 1"
    carga = "+" if s.endswith("+") else ("-" if s.endswith(("-", "−")) else "")
    s = s.rstrip("+-−")
    s = re.sub(r"^(?:[0-9,]+-|[a-zA-Z']{1,5}-)+", "", s)          # prefijos de isómero
    s = s.replace("=", "")
    out, iso = Counter(), []
    _tokens(s, 1, out, iso)
    clave = "".join(f"{e}{out[e]}" for e in sorted(out)) + carga
    return clave, bool(iso)


if __name__ == "__main__":
    for n in ["HC(O)OCH3", "CH3OCHO v=0", "cis-CH2OHCHO v=0", "13CH3OH vt=0-2", "CH2DOH", "(CH3)2O",
              "CH3CH2CN", "C2H5CN", "NH2CH2CH2OH  v25=1", "HOCH2CH2NH2", "c-C3H2", "H3O+", "C4H−",
              "2,5-c-C6H6S", "1-C10H7CN", "(CH2OH)2", "CH3C(O)CH2OH", "13CH3CHO, vt &le; 1", "E-CH3CHCHCN"]:
        print(f"{n:25s} -> {composicion(n)}")

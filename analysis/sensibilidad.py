#!/usr/bin/env python3
"""Sensibilidad de los veredictos a los umbrales del pipeline.

Uso:  python analysis/sensibilidad.py     (~1 min; escribe analysis/outputs/sensibilidad.csv)

Re-ejecuta pipeline.run() en memoria (sin escribir JSON/CSV/figuras) variando un umbral cada
vez, y tabula el veredicto de cada especie × posición y las velocidades adoptadas. Sirve para
distinguir conclusiones robustas de conclusiones que dependen de un umbral concreto.
"""
from __future__ import annotations

import contextlib
import dataclasses
import io
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline as P  # noqa: E402

VARIANTS: dict[str, dict] = {
    "base": {},
    "strong_dex=1.0": {"strong_dex": 1.0},
    "strong_dex=2.0": {"strong_dex": 2.0},
    "snr_detect=5": {"snr_detect": 5.0},
    "overbright=5": {"overbright_factor": 5.0},
    "overbright=20": {"overbright_factor": 20.0},
    "tol_fwhm=0.75": {"tol_fwhm_factor": 0.75},
    "veto_sigma=4": {"veto_expected_sigma": 4.0},
    "unc_max=2MHz": {"unc_max_MHz": 2.0},
}


def main() -> None:
    P.write_outputs = lambda *a, **k: None  # no tocar los productos oficiales
    rows = []
    for name, kw in VARIANTS.items():
        cfg = dataclasses.replace(P.Config(), **kw)
        with contextlib.redirect_stdout(io.StringIO()):
            o = P.run(make_figures=False, cfg=cfg)
        for p in P.POSITIONS:
            for s, sr in o["scores"][p].items():
                rows.append({"variante": name, "posicion": p, "especie": s, "verdict": sr.verdict,
                             "n_matched": sr.n_matched, "n_predicted": sr.n_predicted,
                             "fap": sr.fap, "score": round(sr.score, 3),
                             "v_adoptada_kms": o["v_adopt"][p]["v_kms"]})
        print(f"{name}: hecho", flush=True)
    df = pd.DataFrame(rows)
    out = P.OUT / "sensibilidad.csv"
    df.to_csv(out, index=False, float_format="%.4g")
    piv = df.pivot_table(index=["posicion", "especie"], columns="variante", values="verdict",
                         aggfunc="first")[list(VARIANTS)]
    piv["estable"] = piv.nunique(axis=1) == 1
    print(piv.to_string())
    print(f"-> {out}")


if __name__ == "__main__":
    main()

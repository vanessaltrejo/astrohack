#!/usr/bin/env python3
"""Valida los productos del pipeline contra docs/DATA_SCHEMA.md.

Uso:  python analysis/validate_outputs.py      (código de salida 0 = todo correcto)

Comprueba: JSON estricto (sin NaN/Infinity), estructura y tipos de peaks.json y
species_scores.json, referencias cruzadas (catalog_id -> catalog.json, peak_id -> peaks.json),
coherencia de conteos (n_matched, n_missing_strong), que spectra.json conserve frecuencias e
intensidades de los CSV originales (sólo cambia el bloque noise), y que evidencia_borrador.csv
tenga exactamente las columnas de data/evidencia_plantilla.csv y figuras existentes.
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web" / "public" / "data"
OUT = ROOT / "analysis" / "outputs"
WINDOWS = ("W1", "W2")
POSITIONS = ("B_offset", "B_pico", "A")
TAG = {"B_offset": "Boff", "B_pico": "Bpic", "A": "A"}
FLAGS = {"blend", "absorption", "edge", "weak", "asymmetric"}
VERDICTS = {"fuerte", "tentativa", "insuficiente", "descartada"}
STATUS = {"matched", "unmatched", "missing"}
FIT_KEYS = ("center_GHz", "fwhm_kms", "amp_Jy", "area_Jy_kms", "baseline_Jy", "center_err_MHz")
CAND_KEYS = ("catalog_id", "species", "rest_MHz", "v_kms", "delta_MHz", "Eu_K", "logI_300K", "unc_MHz")
LINE_KEYS = ("catalog_id", "rest_MHz", "Eu_K", "logI_300K", "peak_id", "v_kms", "snr", "blend")
SCORE_KEYS = ("n_predicted", "n_matched", "n_missing_strong", "v_mean_kms", "v_std_kms", "score",
              "verdict", "lines")

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def num(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def load_strict(path: Path) -> Any:
    def bad(c: str) -> None:
        raise ValueError(f"constante no JSON {c}")
    return json.loads(path.read_text(), parse_constant=bad)


def check_peaks(peaks: Any, meta: dict, catalog: list[dict]) -> dict[str, set[str]]:
    ids_by_pos: dict[str, set[str]] = {p: set() for p in POSITIONS}
    if set(peaks) != set(WINDOWS):
        err(f"peaks.json: claves de ventana {sorted(peaks)}")
    for w in WINDOWS:
        lo, hi = meta["windows"][w]["range_GHz"]
        for p in POSITIONS:
            lst = peaks.get(w, {}).get(p)
            if not isinstance(lst, list):
                err(f"peaks.json: falta lista {w}/{p}")
                continue
            for pk in lst:
                where = f"peaks {w}/{p}/{pk.get('id')}"
                if not re.fullmatch(rf"{w}-{TAG[p]}-\d{{3}}", str(pk.get("id"))):
                    err(f"{where}: id con formato inesperado")
                if pk["id"] in ids_by_pos[p]:
                    err(f"{where}: id duplicado")
                ids_by_pos[p].add(pk["id"])
                for k in ("freq_GHz", "peak_Jy", "snr"):
                    if not num(pk.get(k)):
                        err(f"{where}: {k} no numérico")
                if num(pk.get("freq_GHz")) and not lo - 1e-6 <= pk["freq_GHz"] <= hi + 1e-6:
                    err(f"{where}: freq fuera de la ventana")
                fit = pk.get("fit")
                if not isinstance(fit, dict) or not isinstance(fit.get("ok"), bool):
                    err(f"{where}: fit.ok ausente")
                else:
                    for k in FIT_KEYS:
                        if k not in fit:
                            err(f"{where}: fit.{k} ausente")
                        elif fit["ok"] and not num(fit[k]):
                            err(f"{where}: fit.{k} no numérico con ok=true")
                flags = pk.get("flags")
                if not isinstance(flags, list) or not set(flags) <= FLAGS:
                    err(f"{where}: flags inválidas {flags}")
                if pk.get("kind") == "absorption" and "absorption" not in (flags or []):
                    err(f"{where}: absorción sin bandera 'absorption'")
                for c in pk.get("candidates", []):
                    if any(k not in c for k in CAND_KEYS):
                        err(f"{where}: candidato incompleto {c}")
                        continue
                    cid = c["catalog_id"]
                    if not (isinstance(cid, int) and 0 <= cid < len(catalog)):
                        err(f"{where}: catalog_id {cid} inválido")
                        continue
                    row = catalog[cid]
                    if row["species"] != c["species"] or abs(row["rest_MHz"] - c["rest_MHz"]) > 1e-3:
                        err(f"{where}: candidato {cid} no coincide con catalog.json")
                    if not -2.0 - 1e-6 <= c["v_kms"] <= 8.0 + 1e-6:
                        err(f"{where}: v_kms {c['v_kms']} fuera de [-2, 8]")
    return ids_by_pos


def check_scores(scores: Any, ids_by_pos: dict[str, set[str]], catalog: list[dict]) -> None:
    species = {r["species"] for r in catalog}
    for p in POSITIONS:
        if p not in scores:
            err(f"species_scores.json: falta posición {p}")
            continue
        for s, d in scores[p].items():
            where = f"scores {p}/{s}"
            if s not in species:
                err(f"{where}: especie no está en el catálogo")
            for k in SCORE_KEYS:
                if k not in d:
                    err(f"{where}: falta {k}")
            if d.get("verdict") not in VERDICTS:
                err(f"{where}: veredicto {d.get('verdict')}")
            if not (num(d.get("score")) and 0 <= d["score"] <= 1):
                err(f"{where}: score fuera de [0, 1]")
            lines = d.get("lines", [])
            if len(lines) != d.get("n_predicted"):
                err(f"{where}: len(lines)={len(lines)} != n_predicted={d.get('n_predicted')}")
            n_m = sum(1 for ln in lines if ln.get("peak_id"))
            if n_m != d.get("n_matched"):
                err(f"{where}: n_matched={d.get('n_matched')} pero {n_m} líneas con peak_id")
            n_miss = sum(1 for ln in lines if ln.get("status") == "missing")
            if n_miss != d.get("n_missing_strong"):
                err(f"{where}: n_missing_strong no cuadra con status")
            if (d.get("v_mean_kms") is None) != (d.get("n_matched") == 0):
                err(f"{where}: v_mean_kms nulo inconsistente con n_matched")
            for ln in lines:
                if any(k not in ln for k in LINE_KEYS):
                    err(f"{where}: línea incompleta")
                    continue
                if ln.get("status") not in STATUS:
                    err(f"{where}: status {ln.get('status')} fuera del contrato web")
                if catalog[ln["catalog_id"]]["species"] != s:
                    err(f"{where}: catalog_id {ln['catalog_id']} es de otra especie")
                if ln["peak_id"] is not None:
                    if ln["peak_id"] not in ids_by_pos[p]:
                        err(f"{where}: peak_id {ln['peak_id']} no existe en peaks.json/{p}")
                    if ln["status"] != "matched" or not num(ln["v_kms"]):
                        err(f"{where}: línea con peak_id debe ser matched con v_kms")
                if not isinstance(ln["blend"], bool):
                    err(f"{where}: blend no booleano")


def check_spectra(spec: Any, meta: dict) -> None:
    for w in WINDOWS:
        d = pd.read_csv(ROOT / "data" / "espectros" / f"{w}_espectros.csv")
        f = np.array(spec[w]["freq_GHz"])
        if len(f) != meta["windows"][w]["channels"] or np.max(np.abs(f - d.frecuencia_LSRK_GHz)) > 1e-6:
            err(f"spectra.json {w}: eje de frecuencias alterado")
        for p in POSITIONS:
            y = np.array(spec[w][p], dtype=float)
            if np.max(np.abs(y - d[f"{p}_Jy_beam"])) > 1e-5:
                err(f"spectra.json {w}/{p}: intensidades alteradas")
            nz = spec[w]["noise"].get(p, {})
            if not (num(nz.get("sigma_Jy")) and nz["sigma_Jy"] > 0):
                err(f"spectra.json {w}/{p}: sigma_Jy inválido")
            segs = nz.get("segments_GHz", [])
            if len(segs) < 3:
                err(f"spectra.json {w}/{p}: menos de 3 segmentos de ruido")
            lo, hi = meta["windows"][w]["range_GHz"]
            for a, b in segs:
                if not lo - 1e-6 <= a < b <= hi + 1e-6:
                    err(f"spectra.json {w}/{p}: segmento {a}-{b} fuera de rango")


def check_evidence() -> None:
    tpl = list(pd.read_csv(ROOT / "data" / "evidencia_plantilla.csv", nrows=0).columns)
    ev = pd.read_csv(OUT / "evidencia_borrador.csv", dtype=str, keep_default_na=False)
    if list(ev.columns) != tpl:
        err("evidencia_borrador.csv: columnas distintas de la plantilla")
    if not set(ev.decision) <= {"fuerte", "tentativa"}:
        err("evidencia_borrador.csv: decisiones fuera de fuerte/tentativa")
    if (ev.equipo != "").any():
        err("evidencia_borrador.csv: 'equipo' debe quedar vacío")
    for fig in set(ev.archivo_figura):
        if not (ROOT / fig).exists():
            err(f"evidencia_borrador.csv: figura inexistente {fig}")


def main() -> int:
    meta = load_strict(WEB / "meta.json")
    catalog = load_strict(WEB / "catalog.json")
    try:
        peaks = load_strict(WEB / "peaks.json")
        scores = load_strict(WEB / "species_scores.json")
        spec = load_strict(WEB / "spectra.json")
    except ValueError as e:
        print(f"JSON no estricto: {e}")
        return 1
    ids = check_peaks(peaks, meta, catalog)
    check_scores(scores, ids, catalog)
    check_spectra(spec, meta)
    check_evidence()
    for name in ["species_scores.csv"] + [f"peaks_{w}_{p}.csv" for w in WINDOWS for p in POSITIONS]:
        if not (OUT / name).exists():
            err(f"falta analysis/outputs/{name}")
    for p in POSITIONS:
        if not (OUT / "figuras" / f"panorama_{p}.png").exists():
            err(f"falta figura panorama_{p}.png")
    n_pk = sum(len(peaks[w][p]) for w in WINDOWS for p in POSITIONS)
    if errors:
        print(f"{len(errors)} errores:")
        for e in errors[:50]:
            print("  -", e)
        return 1
    print(f"OK: {n_pk} picos, {sum(len(v) for v in scores.values())} especie×posición, "
          f"spectra.json intacto salvo 'noise', evidencia con {len(pd.read_csv(OUT / 'evidencia_borrador.csv'))} filas")
    return 0


if __name__ == "__main__":
    sys.exit(main())

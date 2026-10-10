"""Independent verification of the pipeline's species verdicts (steps 4 and 5 of
docs/VERIFICACION_CANDIDATAS.md), automated.

Step 4 - Boltzmann pattern: for every species x position with >= 3 clean matched lines, fit a
single rotation temperature to the peak amplitudes,
    log10(amp) = const + logI_300K - Eu * (1/T - 1/300) / ln(10),
and report T_rot, the rms scatter (dex) and whether the pattern is plausible. A real species
gives scatter <~ 0.35 dex at a temperature inside the grid; a chance alignment does not.
Opacity flattens the pattern (CH3CN low-K lines), so T_rot is a consistency check, not Tex.

Step 5 - Literature: compare adopted velocity, median FWHM of clean lines and T_rot with the
PILS values curated in analysis/referencias_pils.csv (each row carries its citation).

Also lists peaks matched by more than one species and proposes an owner (the species whose
implied velocity is closest to the adopted source velocity).

Reads  web/public/data/{species_scores,peaks,catalog,pipeline_meta}.json
Writes analysis/outputs/verificacion_boltzmann.csv, picos_compartidos.csv,
       figuras/boltzmann_<pos>.png
Run:   python analysis/verificar_candidatas.py [--no-figures]
"""
from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "public" / "data"
OUT = ROOT / "analysis" / "outputs"
FIG = OUT / "figuras"
REFS = ROOT / "analysis" / "referencias_pils.csv"

T_GRID = np.arange(30.0, 801.0, 2.0)
RMS_OK = 0.35          # dex: max scatter for a plausible single-T pattern
T_RANGE_OK = (50.0, 600.0)   # T_rot pinned outside this = no pattern
MIN_LINES = 3
LIT_T_FACTOR = 2.5     # T_rot within this factor of PILS Tex counts as consistent (opacity, peak vs area)
LIT_V_TOL = 0.3        # km/s
LIT_FWHM_FACTOR = 1.6


def load():
    s = json.loads((DATA / "species_scores.json").read_text(encoding="utf-8"))
    p = json.loads((DATA / "peaks.json").read_text(encoding="utf-8"))
    meta = json.loads((DATA / "pipeline_meta.json").read_text(encoding="utf-8"))
    peaks = {q["id"]: q for w in p for pos in p[w] for q in p[w][pos]}
    refs = {}
    with REFS.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            refs[(r["especie"], r["posicion"])] = r
    return s, peaks, meta, refs


def adopted_velocity(meta, pos):
    # pipeline_meta.json: try the obvious keys, fall back to README values
    for key in ("velocities", "velocidades", "v_adopted_kms", "v_pos_kms"):
        v = meta.get(key)
        if isinstance(v, dict) and pos in v:
            x = v[pos]
            return float(x["v_kms"] if isinstance(x, dict) else x)
    return {"B_offset": 2.618, "B_pico": 2.607, "A": 3.707}[pos]


def amp_of(q):
    f = q.get("fit")
    return float(f["amp_Jy"]) if f and f.get("ok") else float(q["peak_Jy"])


def fwhm_of(q):
    f = q.get("fit")
    return float(f["fwhm_kms"]) if f and f.get("ok") else np.nan


def fit_trot(Eu, logI, logA):
    """Grid fit of T; returns (T_best, rms_best, const_best, rms at 100 K, rms at 300 K)."""
    def rms(T):
        x = logI - Eu * (1.0 / T - 1.0 / 300.0) / np.log(10.0)
        c = np.mean(logA - x)
        return float(np.sqrt(np.mean((logA - x - c) ** 2))), float(c)
    R = np.array([rms(T)[0] for T in T_GRID])
    i = int(np.argmin(R))
    return float(T_GRID[i]), float(R[i]), rms(T_GRID[i])[1], rms(100.0)[0], rms(300.0)[0]


def main(make_figs=True):
    s, peaks, meta, refs = load()
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    panels = defaultdict(list)
    for pos, species in s.items():
        v_pos = adopted_velocity(meta, pos)
        lit_pos = "B" if pos.startswith("B") else "A"
        for sp, d in species.items():
            clean = [l for l in d["lines"] if l.get("detail") == "matched" and not l.get("blend") and l.get("peak_id") in peaks]
            row = dict(posicion=pos, especie=sp, verdict=d["verdict"], n_matched=d["n_matched"],
                       n_clean_used=len(clean), Eu_min_K="", Eu_max_K="", T_rot_K="", rms_dex="",
                       rms_100K="", rms_300K="", patron_ok="", fwhm_mediana_kms="", v_especie_kms=d.get("v_mean_kms", ""),
                       lit_Tex_K="", lit_N_cm2="", lit_FWHM_kms="", lit_v_kms="", lit_ref="",
                       coherente_v="", coherente_fwhm="", coherente_T="", conclusion="")
            if len(clean) >= MIN_LINES:
                Eu = np.array([l["Eu_K"] for l in clean]); logI = np.array([l["logI_300K"] for l in clean])
                A = np.array([amp_of(peaks[l["peak_id"]]) for l in clean])
                ok = A > 0
                if ok.sum() >= MIN_LINES:
                    Eu, logI, logA = Eu[ok], logI[ok], np.log10(A[ok])
                    T, r, c, r100, r300 = fit_trot(Eu, logI, logA)
                    pinned = not (T_RANGE_OK[0] < T < T_RANGE_OK[1])
                    row.update(Eu_min_K=f"{Eu.min():.0f}", Eu_max_K=f"{Eu.max():.0f}", T_rot_K=f"{T:.0f}",
                               rms_dex=f"{r:.2f}", rms_100K=f"{r100:.2f}", rms_300K=f"{r300:.2f}",
                               patron_ok="si" if (r <= RMS_OK and not pinned) else "no")
                    fw = np.array([fwhm_of(peaks[l["peak_id"]]) for l in clean])
                    fw = fw[np.isfinite(fw)]
                    if fw.size:
                        row["fwhm_mediana_kms"] = f"{np.median(fw):.2f}"
                    panels[pos].append((sp, d["verdict"], Eu, logI, logA, T, c, r))
            ref = refs.get((sp, lit_pos))
            if ref:
                row.update(lit_Tex_K=ref["Tex_K"], lit_N_cm2=ref["N_cm2"], lit_FWHM_kms=ref["FWHM_kms"],
                           lit_v_kms=ref["v_kms"], lit_ref=ref["referencia"])
                if row["v_especie_kms"] not in ("", None):
                    row["coherente_v"] = "si" if abs(float(row["v_especie_kms"]) - float(ref["v_kms"])) <= LIT_V_TOL else "no"
                if row["fwhm_mediana_kms"]:
                    q = float(row["fwhm_mediana_kms"]) / float(ref["FWHM_kms"])
                    row["coherente_fwhm"] = "si" if 1 / LIT_FWHM_FACTOR <= q <= LIT_FWHM_FACTOR else "no"
                if row["T_rot_K"] and ref["limite_superior"] == "no":
                    q = float(row["T_rot_K"]) / float(ref["Tex_K"])
                    row["coherente_T"] = "si" if 1 / LIT_T_FACTOR <= q <= LIT_T_FACTOR else "no"
            # one-line conclusion
            notes = []
            if row["coherente_fwhm"] == "no" and pos.startswith("B"):
                n_abs = sum(1 for l in clean if l.get("adjacent_absorption"))
                if n_abs:
                    notes.append(f"FWHM ensanchada por absorcion adyacente en {n_abs}/{len(clean)} lineas")
            if row["T_rot_K"] and row["lit_Tex_K"] and ref and ref["limite_superior"] == "no" \
                    and float(row["T_rot_K"]) > LIT_T_FACTOR * float(ref["Tex_K"]):
                notes.append("T_rot alta: aplanamiento por opacidad (esperado en lineas brillantes)")
            if len(clean) < MIN_LINES:
                row["conclusion"] = f"< {MIN_LINES} lineas limpias: no verificable"
            elif row["patron_ok"] == "no" and row["coherente_v"] == "no":
                row["conclusion"] = "NO sigue un patron de una sola temperatura y v incoherente: coincidencias espurias"
            elif row["patron_ok"] == "no":
                row["conclusion"] = "patron plano o disperso: opacidad o amplitudes poco fiables (absorcion); v coherente"
            elif row["coherente_v"] != "no" and row["coherente_fwhm"] != "no":
                row["conclusion"] = "patron Boltzmann plausible y consistente con PILS" if ref else "patron Boltzmann plausible (sin referencia PILS)"
            else:
                row["conclusion"] = "patron ok; v o FWHM fuera de la referencia"
            if notes:
                row["conclusion"] += " | " + "; ".join(notes)
            rows.append(row)

    with (OUT / "verificacion_boltzmann.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)

    # shared peaks
    shared = []
    for pos, species in s.items():
        v_pos = adopted_velocity(meta, pos)
        claims = defaultdict(list)
        for sp, d in species.items():
            for l in d["lines"]:
                if l.get("detail") == "matched" and l.get("peak_id"):
                    claims[l["peak_id"]].append((sp, l["rest_MHz"], l.get("v_kms")))
        for pid, lst in claims.items():
            if len(lst) < 2:
                continue
            best = min(lst, key=lambda t: abs((t[2] or 99) - v_pos))
            others = [t for t in lst if t is not best]
            # if two species are both within 0.3 km/s of v_pos it is a genuine blend
            close = [t for t in lst if t[2] is not None and abs(t[2] - v_pos) <= 0.3]
            owner = best[0] if len(close) <= 1 and abs((best[2] or 99) - v_pos) <= 0.3 else "mezcla: no contar"
            shared.append(dict(posicion=pos, pico=pid, snr=peaks[pid]["snr"],
                               reclamado_por="; ".join(f"{t[0]} {t[1]:.3f} (v={t[2]})" for t in lst),
                               asignar_a=owner))
    with (OUT / "picos_compartidos.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["posicion", "pico", "snr", "reclamado_por", "asignar_a"]); w.writeheader(); w.writerows(shared)

    if make_figs:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        FIG.mkdir(parents=True, exist_ok=True)
        for pos, items in panels.items():
            order = {"fuerte": 0, "tentativa": 1, "insuficiente": 2, "descartada": 3}
            items = sorted(items, key=lambda t: (order.get(t[1], 9), t[0]))
            n = len(items); ncol = 3; nrow = int(np.ceil(n / ncol))
            fig, axes = plt.subplots(nrow, ncol, figsize=(4.2 * ncol, 3.3 * nrow), squeeze=False)
            for ax, (sp, verdict, Eu, logI, logA, T, c, r) in zip(axes.flat, items):
                y = logA - logI  # observed / catalog strength at 300 K
                ax.scatter(Eu, y, s=28, color="#1f5fbf" if verdict in ("fuerte", "tentativa") else "#c0392b", zorder=3)
                xx = np.linspace(min(Eu) * 0.9, max(Eu) * 1.05, 50)
                ax.plot(xx, c - xx * (1 / T - 1 / 300) / np.log(10), color="k", lw=1)
                ax.set_title(f"{sp} · {verdict} · T_rot≈{T:.0f} K · rms {r:.2f} dex", fontsize=9)
                ax.set_xlabel("E_u (K)"); ax.set_ylabel("log(amp / I_300K)")
                ax.grid(alpha=0.3)
            for ax in list(axes.flat)[n:]:
                ax.axis("off")
            fig.suptitle(f"Patrón de Boltzmann de las coincidencias limpias · {pos}", fontsize=11)
            fig.tight_layout()
            fig.savefig(FIG / f"boltzmann_{pos}.png", dpi=200)
            plt.close(fig)

    # console summary
    print(f"{'pos':9} {'especie':11} {'verdict':12} {'n':>2} {'T_rot':>6} {'rms':>5} {'patron':>6} {'v_ok':>4} {'fw_ok':>5} {'T_ok':>4}  conclusion")
    for r in rows:
        if r["n_clean_used"] >= MIN_LINES or r["lit_ref"]:
            print(f"{r['posicion']:9} {r['especie']:11} {r['verdict']:12} {r['n_clean_used']:>2} {r['T_rot_K']:>6} {r['rms_dex']:>5} {r['patron_ok']:>6} {r['coherente_v']:>4} {r['coherente_fwhm']:>5} {r['coherente_T']:>4}  {r['conclusion']}")
    print(f"\n{len(shared)} picos reclamados por >1 especie -> outputs/picos_compartidos.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main(make_figs="--no-figures" not in sys.argv))

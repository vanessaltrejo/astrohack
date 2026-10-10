"""Figuras del pipeline AstroHack SATEM 2026 (PNG, 300 dpi, etiquetas en español).

1. ``panorama_<pos>.png``: ventanas W1 y W2 completas (cada una en dos tramos para que se
   lean las líneas), segmentos de ruido sombreados, umbral ±4σ y picos detectados. Los picos
   asignados a especies fuerte/tentativa se colorean por especie (color fijo por especie y
   forma de marcador distinta: la identidad nunca depende sólo del color); el resto en gris;
   absorciones con triángulo hacia arriba.
2. ``huella_<pos>_<especie>.png``: "huella" de identificación clásica. Un panel por rasgo
   fuerte predicho (agrupado), en velocidad radio respecto de SU frecuencia de reposo,
   ±10 km/s alrededor de la velocidad adoptada de la posición; ajuste gaussiano superpuesto,
   banda de tolerancia, nivel esperado (escala conservadora) y estado del rasgo.

Se llama desde pipeline.run(); no tiene CLI propia.
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

import pipeline as P  # noqa: E402

DPI = 300
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#9a9893"
GRID = "#e6e5e0"
SURFACE = "#fcfcfb"
NOISE_BAND = "#d9e8f7"
# paleta categórica de referencia (modo claro, validada); slot fijo por especie
SLOTS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
SPECIES_SLOT = {"CH3CN": 0, "CH2DOH": 1, "CH3CHO": 2, "C2H5CN": 3, "CH3OCHO": 4, "CH3OCH3": 5,
                "CH2(OH)CHO": 6, "Glycine-I": 7}
MARKERS = ["o", "s", "D", "P", "X", "v", "h", "*"]
STATUS_ES = {"matched": "coincide", "overbright": "demasiado brillante", "ambiguous": "ambigua",
             "below_limit": "bajo el límite", "missing": "AUSENTE"}

plt.rcParams.update({
    "font.size": 8, "axes.edgecolor": INK2, "axes.labelcolor": INK, "xtick.color": INK2,
    "ytick.color": INK2, "axes.linewidth": 0.6, "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE, "legend.frameon": False,
})


def _color(species: str) -> str:
    return SLOTS[SPECIES_SLOT[species]] if species in SPECIES_SLOT else MUTED


def _marker(species: str) -> str:
    return MARKERS[SPECIES_SLOT[species]] if species in SPECIES_SLOT else "o"


def _assignments(scores: dict[str, P.SpeciesResult]) -> dict[str, str]:
    """peak_id -> especie (sólo especies fuerte/tentativa; si dos reclaman el mismo pico gana
    la de mayor score)."""
    out: dict[str, tuple[str, float]] = {}
    for s, sr in scores.items():
        if sr.verdict not in ("fuerte", "tentativa"):
            continue
        for ln in sr.lines:
            pid = ln.get("peak_id")
            if pid and (pid not in out or sr.score > out[pid][1]):
                out[pid] = (s, sr.score)
    return {k: v[0] for k, v in out.items()}


# --------------------------------------------------------------------------------------
# 1. Panorama
# --------------------------------------------------------------------------------------
def overview(p: str, res: dict[str, P.WinPos], scores: dict[str, P.SpeciesResult],
             v_adopt: dict[str, Any], out: Path) -> Path:
    assign = _assignments(scores)
    fig, axes = plt.subplots(4, 1, figsize=(11, 10.5))
    shown: dict[str, Any] = {}
    for k, w in enumerate(P.WINDOWS):
        wp = res[w]
        f, y = wp.sp.freq_GHz, wp.sp.y
        nz = wp.noise
        n = len(f)
        for j, sl in enumerate((slice(0, n // 2 + 10), slice(n // 2 - 10, n))):
            ax = axes[2 * k + j]
            fx = f[sl]
            for a, b in nz.segments_GHz:
                if b >= fx[0] and a <= fx[-1]:
                    h = ax.axvspan(a, b, color=NOISE_BAND, lw=0, zorder=0)
                    shown.setdefault("Segmento de ruido", h)
            for sgn in (1, -1):
                h = ax.axhline(nz.baseline + sgn * 4 * nz.sigma, color=MUTED, lw=0.6, ls="--", zorder=1)
            shown.setdefault("±4σ", h)
            ax.plot(fx, y[sl], color=INK, lw=0.5, drawstyle="steps-mid", zorder=2)
            for pk in wp.peaks:
                x0 = f[pk.idx]
                if not (fx[0] <= x0 <= fx[-1]):
                    continue
                if pk.kind == "absorption":
                    h = ax.plot(x0, pk.value, marker="^", ms=3.5, color=INK2, mfc="white",
                                mew=0.6, ls="none", zorder=3)[0]
                    shown.setdefault("Absorción", h)
                    continue
                sp_name = assign.get(pk.id)
                if sp_name:
                    h = ax.plot(x0, pk.value + 0.03 * (np.ptp(y) or 1), marker=_marker(sp_name), ms=4,
                                color=_color(sp_name), mec="white", mew=0.4, ls="none", zorder=4)[0]
                    shown.setdefault(sp_name, h)
                else:
                    h = ax.plot(x0, pk.value + 0.03 * (np.ptp(y) or 1), marker="v", ms=3, color=MUTED,
                                ls="none", zorder=3)[0]
                    shown.setdefault("Emisión sin asignar", h)
            ax.set_xlim(fx[0], fx[-1])
            lo, hi = float(np.min(y)), float(np.max(y))
            ax.set_ylim(lo - 0.08 * (hi - lo), hi + 0.12 * (hi - lo))
            ax.grid(axis="y", color=GRID, lw=0.5)
            ax.set_ylabel("Intensidad (Jy/beam)")
            ax.text(0.005, 0.95, f"{w} · tramo {'ab'[j]}", transform=ax.transAxes, va="top",
                    fontsize=7.5, color=INK2)
            ax.ticklabel_format(axis="x", useOffset=False)
    axes[-1].set_xlabel("Frecuencia LSRK (GHz)")
    va = v_adopt
    sig = ", ".join(f"σ_{w} = {res[w].noise.sigma * 1e3:.1f} mJy/beam" for w in P.WINDOWS)
    fig.suptitle(f"IRAS 16293-2422 · posición {p} · v adoptada = {va['v_kms']:.2f} ± "
                 f"{(va['err_kms'] or 0):.2f} km/s · {sig}", fontsize=9, color=INK, x=0.01,
                 ha="left")
    order = ["Segmento de ruido", "±4σ", "Absorción", "Emisión sin asignar"] + \
        sorted([k for k in shown if k in SPECIES_SLOT], key=lambda s: SPECIES_SLOT[s])
    keys = [k for k in order if k in shown]
    labels = [f"{k} ({scores[k].verdict})" if k in scores else k for k in keys]
    fig.legend([shown[k] for k in keys], labels, loc="lower center", ncol=min(len(keys), 5),
               fontsize=7.5, bbox_to_anchor=(0.5, 0.0))
    fig.tight_layout(rect=(0, 0.04, 1, 0.97))
    path = out / f"panorama_{p}.png"
    fig.savefig(path, dpi=DPI)
    plt.close(fig)
    return path


# --------------------------------------------------------------------------------------
# 2. Huella por especie
# --------------------------------------------------------------------------------------
def fingerprint(p: str, species: str, sr: P.SpeciesResult, res: dict[str, P.WinPos],
                v_pos: float, fwhm_typ: float, other_strong: list[tuple[str, float, str]],
                cfg: P.Config, out: Path, half_kms: float = 10.0, max_panels: int = 20) -> Path:
    lines = [ln for ln in sr.lines if ln["detail"] != "below_limit"]
    n_below = len(sr.lines) - len(lines)
    if not lines:  # especie sin rasgos detectables: mostrar los más intensos igualmente
        lines = sorted(sr.lines, key=lambda ln: -ln["logI_300K"])[:4]
        n_below -= len(lines)
    lines = sorted(lines, key=lambda ln: -ln["logI_300K"])[:max_panels]
    lines = sorted(lines, key=lambda ln: ln["rest_MHz"])
    n = len(lines)
    ncol = 4 if n > 6 else max(n, 1) if n <= 3 else 3
    nrow = math.ceil(n / ncol)
    fig, axes = plt.subplots(nrow, ncol, figsize=(2.75 * ncol, 2.15 * nrow + 0.7), squeeze=False)
    peaks_by_id = {pk.id: (w, pk) for w in P.WINDOWS for pk in res[w].peaks}
    for ax, ln in zip(axes.flat, lines):
        w = ln["window"]
        wp = res[w]
        nu_rest = ln["rest_MHz"]
        v = P.C_KMS * (1 - wp.sp.freq_GHz * 1e3 / nu_rest)
        m = np.abs(v - v_pos) <= half_kms
        ax.plot(v[m], wp.sp.y[m], color=INK, lw=0.6, drawstyle="steps-mid", zorder=2)
        tol = max(cfg.tol_min_ch * wp.sp.dnu_MHz, cfg.tol_fwhm_factor * fwhm_typ / P.C_KMS * nu_rest,
                  cfg.tol_unc_factor * (ln.get("unc_MHz") or 0.0))
        tol_kms = tol / nu_rest * P.C_KMS
        ax.axvspan(sr.v_best - tol_kms, sr.v_best + tol_kms, color=NOISE_BAND, lw=0, zorder=0)
        ax.axvline(v_pos, color=INK2, lw=0.6, ls=":", zorder=1)
        ax.axhline(wp.noise.baseline + 3 * wp.noise.sigma, color=MUTED, lw=0.5, ls="--", zorder=1)
        ax.axhline(wp.noise.baseline, color=GRID, lw=0.6, zorder=1)
        # ajuste gaussiano del pico asociado (coincidente o demasiado brillante)
        pid = ln.get("peak_id") or ln.get("nearest_peak_id")
        if pid and pid in peaks_by_id:
            _, pk = peaks_by_id[pid]
            mdl = pk.model
            if pk.fit.get("ok") and "popt" in mdl:
                xs = np.linspace(mdl["lo"], mdl["hi"] - 1, 400)
                vs = P.C_KMS * (1 - np.interp(xs, np.arange(len(wp.sp.freq_GHz)), wp.sp.freq_GHz)
                                * 1e3 / nu_rest)
                popt = mdl["popt"]
                ax.plot(vs, P._multi_gauss(xs, *popt), color=_color(species), lw=1.1, zorder=3)
                base = popt[1] + popt[2] * (xs - popt[0])
                comp = base + popt[3] * np.exp(-0.5 * ((xs - popt[4]) / popt[5]) ** 2)
                ax.plot(vs, comp, color=_color(species), lw=0.8, ls="--", zorder=3)
        # nivel esperado (escala conservadora, Tex menos favorable)
        if ln.get("expected_peak_Jy") is not None:
            e = wp.noise.baseline + ln["expected_peak_Jy"]
            ax.plot([sr.v_best - tol_kms, sr.v_best + tol_kms], [e, e], color=INK2, lw=1.4,
                    solid_capstyle="butt", zorder=4)
        # rasgos fuertes de otras especies en el panel
        ymax = float(np.max(wp.sp.y[m])) if m.any() else 1.0
        ymin = float(np.min(wp.sp.y[m])) if m.any() else 0.0
        top = ymax + 0.18 * (ymax - ymin)
        for o_sp, o_rest, o_w in other_strong:
            if o_w != w:
                continue
            vo = P.C_KMS * (1 - o_rest * (1 - v_pos / P.C_KMS) / nu_rest)  # su ν observada a v_pos
            if abs(vo - v_pos) <= half_kms:
                ax.plot(vo, top, marker="|", ms=6, color=_color(o_sp), mew=1.2, zorder=4)
                ax.text(vo, top, o_sp, fontsize=5.2, color=INK2, rotation=90, ha="center",
                        va="bottom")
        ax.set_xlim(v_pos - half_kms, v_pos + half_kms)
        ax.set_ylim(ymin - 0.1 * (ymax - ymin), top + 0.55 * (ymax - ymin))
        st = STATUS_ES.get(ln["detail"], ln["detail"])
        extra = []
        if ln["status"] == "matched":
            extra.append(f"v={ln['v_kms']:.2f}")
            extra.append(f"SNR {ln['snr']:.0f}")
            if ln.get("blend"):
                extra.append("mezcla")
            if ln.get("adjacent_absorption"):
                extra.append("abs. adyacente")
        stcolor = "#b3261e" if ln["detail"] == "missing" else INK
        ax.set_title(f"{nu_rest:.3f} MHz · {w}\nEu={ln['Eu_K']:.0f} K · logI={ln['logI_300K']:.2f}",
                     loc="left", fontsize=5.8, color=INK2)
        ax.set_title(st + ("\n" + " · ".join(extra) if extra else ""), loc="right", fontsize=5.8,
                     color=stcolor, fontweight="bold" if ln["detail"] == "missing" else "normal")
        ax.tick_params(labelsize=6)
    for ax in axes.flat[n:]:
        ax.axis("off")
    for ax in axes[-1, :]:
        ax.set_xlabel("Velocidad radio LSRK (km/s)", fontsize=7)
    for ax in axes[:, 0]:
        ax.set_ylabel("Intensidad (Jy/beam)", fontsize=7)
    vm = f"{sr.v_mean:.2f} ± {sr.v_std:.2f}" if sr.v_mean is not None and sr.v_std is not None else (
        f"{sr.v_mean:.2f}" if sr.v_mean is not None else "—")
    fig.suptitle(
        f"{species} en {p} · veredicto: {sr.verdict.upper()} · {sr.n_matched}/{sr.n_predicted} rasgos "
        f"fuertes coinciden ({sr.n_clean} limpios), {sr.n_missing_strong} ausentes · v = {vm} km/s · "
        f"FAP = {sr.fap:.1e} · score = {sr.score:.2f}",
        fontsize=8, color=INK, x=0.01, ha="left")
    fig.text(0.01, 0.005,
             f"Línea punteada: v adoptada de la posición ({v_pos:.2f} km/s). Banda azul: tolerancia de "
             f"coincidencia en v_especie = {sr.v_best:.2f} km/s. Trazo gris horizontal: pico esperado "
             f"(escala conservadora). Discontinua: 3σ. Curva: ajuste local (continua = modelo total, "
             f"discontinua = componente). Marcas superiores: rasgos fuertes de otras especies."
             + (f" Omitidos {n_below} rasgos bajo el límite de detección." if n_below > 0 else ""),
             fontsize=5.6, color=INK2, ha="left", va="bottom", wrap=True)
    fig.tight_layout(rect=(0, 0.035, 1, 0.965))
    path = out / f"huella_{p}_{P.fname(species)}.png"
    fig.savefig(path, dpi=DPI)
    plt.close(fig)
    return path


def make_all(res: dict[str, dict[str, P.WinPos]], scores: dict[str, dict[str, P.SpeciesResult]],
             v_adopt: dict[str, dict[str, Any]], groups_by_pos: dict[str, dict[str, list[P.Group]]],
             fwhm_typ: dict[str, float], cfg: P.Config, out: Path) -> list[Path]:
    """Panorama por posición + huellas de las especies fuerte/tentativa en cada posición,
    las 4 primeras por score en B_offset (pedido explícito) y la glicina (control negativo)."""
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for p in P.POSITIONS:
        paths.append(overview(p, res[p], scores[p], v_adopt[p], out))
        ranked = sorted(scores[p].items(), key=lambda kv: -kv[1].score)
        chosen = {s for s, sr in ranked if sr.verdict in ("fuerte", "tentativa")}
        if p == "B_offset":
            chosen |= {s for s, _ in ranked[:4]}
        chosen |= {s for s in scores[p] if s.lower().startswith("glycine")}
        strong = {s: P.strong_groups(g, cfg) for s, g in groups_by_pos[p].items()}
        for s in sorted(chosen, key=lambda s: -scores[p][s].score):
            others = [(o, g.rest_MHz, g.window) for o, gs in strong.items() if o != s
                      and scores[p][o].verdict in ("fuerte", "tentativa") for g in gs]
            paths.append(fingerprint(p, s, scores[p][s], res[p], v_adopt[p]["v_kms"], fwhm_typ[p],
                                     others, cfg, out))
    return paths

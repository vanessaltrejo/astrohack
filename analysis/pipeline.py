#!/usr/bin/env python3
"""Pipeline científico AstroHack SATEM 2026 (IRAS 16293-2422, ALMA 2013.1.00278.S).

Para cada ventana (W1, W2) × posición (B_offset, B_pico, A):

  a. ruido robusto a partir de >=3 segmentos libres de líneas (registrados),
  b. detección de picos de emisión y de absorción (scipy.signal.find_peaks),
  c. ajuste gaussiano local (multi-componente + línea base lineal) con control de residuos,
  d. candidatos de catálogo por pico (velocidad implícita en [-2, 8] km/s),
  e. puntuación de consistencia en velocidad por especie × posición (dos pasos: búsqueda
     libre -> velocidad de la posición -> re-evaluación con confusores y coherencia),
  f. escritura de web/public/data/{peaks,species_scores,pipeline_meta}.json, del bloque
     ``noise`` de spectra.json y de tablas/figuras en analysis/outputs/.
  + diagnósticos: comprobación de velocidad por correlación cruzada (sin identificar líneas),
     desfase absorción-emisión (P-Cygni inverso) y picos brillantes sin candidato en el catálogo.

Uso:  python analysis/pipeline.py [--no-figures]      (~50 s con figuras, ~6 s sin ellas)
      python analysis/validate_outputs.py              (comprueba el contrato de datos)

Convenciones: frecuencias observadas LSRK; velocidad radio v = c (1 - nu_obs/nu_rest),
aplicada UNA sola vez; c = 299792.458 km/s. Intensidades en Jy/beam.
Todos los umbrales están en la clase ``Config`` y se documentan en analysis/README.md.
"""
from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.ndimage import binary_dilation, gaussian_filter1d
from scipy.optimize import curve_fit
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
WEB = ROOT / "web" / "public" / "data"
OUT = ROOT / "analysis" / "outputs"
FIG = OUT / "figuras"

C_KMS = 299792.458
WINDOWS = ("W1", "W2")
POSITIONS = ("B_offset", "B_pico", "A")
POS_TAG = {"B_offset": "Boff", "B_pico": "Bpic", "A": "A"}
V_START = {"B_offset": 2.7, "B_pico": 2.7, "A": 3.2}
FWHM_TO_SIGMA = 1.0 / (2.0 * math.sqrt(2.0 * math.log(2.0)))  # 1/2.3548


# --------------------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Profile:
    """Parámetros dependientes del tipo de perfil (líneas estrechas en B, anchas en A)."""

    name: str
    smooth_ch: float        # sigma del suavizado gaussiano previo a find_peaks (canales)
    min_distance_ch: int    # distancia mínima entre picos
    min_width_ch: float     # anchura mínima (a media prominencia) para aceptar un pico
    dilate_ch: int          # dilatación de la máscara de líneas para el ruido
    min_seg_ch: int         # longitud mínima de un segmento libre
    fit_half_ch: int        # semiancho de la ventana de ajuste local
    center_slack_ch: float  # libertad del centro respecto al pico detectado
    fwhm_kms_bounds: tuple[float, float]
    edge_ch: int            # distancia al borde de ventana para la marca "edge"


PROFILES = {
    "narrow": Profile("narrow", 0.0, 3, 2.0, 6, 15, 12, 3.0, (0.25, 5.0), 10),
    "broad": Profile("broad", 2.0, 10, 5.0, 30, 20, 45, 8.0, (1.0, 20.0), 25),
}
POS_PROFILE = {"B_offset": "narrow", "B_pico": "narrow", "A": "broad"}


@dataclass(frozen=True)
class Config:
    snr_detect: float = 4.0          # altura mínima (en sigma) de un pico/absorción
    prom_sigma: float = 3.0          # prominencia mínima (en sigma)
    snr_weak: float = 5.0            # picos con 4 <= SNR < 5 se marcan "weak"
    noise_clip: float = 3.0          # recorte iterativo de la máscara de líneas
    noise_max_segments: int = 6
    noise_min_segments: int = 3
    v_cand_range: tuple[float, float] = (-2.0, 8.0)   # rango de velocidad para candidatos
    v_grid: tuple[float, float, float] = (0.0, 6.0, 0.05)
    strong_dex: float = 1.5          # "fuerte" = logI dentro de 1.5 dex del máximo de la especie
    unc_max_MHz: float = 1.0         # filas con incertidumbre mayor no son identificables
    tol_unc_factor: float = 3.0      # tolerancia = max(2 canales, 0.5 FWHM, 3 unc)
    tol_fwhm_factor: float = 0.5
    tol_min_ch: float = 2.0
    veto_expected_sigma: float = 6.0  # una línea "debería verse" si su pico esperado >= 6 sigma
    veto_absent_sigma: float = 3.0    # ... y se declara ausente si no hay emisión > 3 sigma
    tex_scenarios: tuple[float, ...] = (100.0, 300.0)  # K, para escalar logI dentro de la especie
    fuerte_min_match: int = 3
    fuerte_max_fap: float = 1e-3
    tentativa_min_match: int = 2
    tentativa_max_fap: float = 0.05
    overbright_factor: float = 10.0   # pico observado > 10x el esperado -> otro portador
    dv_window_kms: dict = field(default_factory=lambda: {"narrow": 1.0, "broad": 2.0})
    signif_dex: float = 6.0           # S = min(1, -log10(FAP)/6) en el score
    fwhm_cap: float = 1.0             # FWHM por pico en la tolerancia <= 1.0 × FWHM típico
    v_std_max_kms: float = 0.35       # coherencia en v: std <= max(0.35, 0.5·tol) km/s
    tentativa_vstd_factor: float = 1.5  # tentativa tolera 1.5× la dispersión en v de "fuerte"
    veto_min_match: int = 2           # el veto exige >= 2 coincidencias (escala conservadora)
    v_sys_tol_fwhm: float = 0.5       # coherencia: |v_especie - v_pos| <= max(0.5 FWHM, 3σ)
    blend_resid_sigma: float = 4.0    # residuo de núcleo > max(4σ, 10 % |A|) -> "blend"
    blend_resid_frac: float = 0.10
    asym_z: float = 3.0               # asimetría de residuos (derecha - izquierda) en σ
    confuser_min_sigma: float = 3.0   # un confusor plausible debe predecir >= 3σ ...
    confuser_min_frac: float = 0.20   # ... y >= 20 % del pico observado
    v_floor_kms: float = 0.10         # error sistemático mínimo por línea (½ canal) para v adoptada


CFG = Config()


# --------------------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------------------
def v_from(nu_obs: np.ndarray | float, nu_rest: np.ndarray | float) -> Any:
    """Velocidad radio (km/s): v = c (1 - nu_obs / nu_rest)."""
    return C_KMS * (1.0 - np.asarray(nu_obs) / np.asarray(nu_rest))


def nu_obs_from(nu_rest: Any, v: float) -> Any:
    """Frecuencia observada para una velocidad radio v: nu_obs = nu_rest (1 - v/c)."""
    return np.asarray(nu_rest) * (1.0 - v / C_KMS)


def runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """Intervalos [i0, i1) contiguos donde mask es True."""
    m = np.concatenate([[False], mask.astype(bool), [False]])
    d = np.diff(m.astype(int))
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def r(x: Any, nd: int = 4) -> Any:
    """Redondeo seguro para JSON (None/NaN -> None)."""
    if x is None:
        return None
    x = float(x)
    return None if not math.isfinite(x) else round(x, nd)


# --------------------------------------------------------------------------------------
# Datos
# --------------------------------------------------------------------------------------
@dataclass
class Spectrum:
    window: str
    position: str
    freq_GHz: np.ndarray
    y: np.ndarray

    @property
    def dnu_MHz(self) -> float:
        return float(np.median(np.diff(self.freq_GHz)) * 1e3)

    @property
    def dv_kms(self) -> float:
        return C_KMS * self.dnu_MHz / (np.mean(self.freq_GHz) * 1e3)

    def freq_at(self, x: float) -> float:
        """Frecuencia (GHz) en un índice de canal fraccionario."""
        return float(np.interp(x, np.arange(len(self.freq_GHz)), self.freq_GHz))


def load_spectra() -> dict[str, dict[str, Spectrum]]:
    out: dict[str, dict[str, Spectrum]] = {}
    for w in WINDOWS:
        d = pd.read_csv(DATA / "espectros" / f"{w}_espectros.csv")
        f = d["frecuencia_LSRK_GHz"].to_numpy(float)
        assert np.all(np.diff(f) > 0), "se espera eje de frecuencia creciente"
        out[w] = {p: Spectrum(w, p, f, d[f"{p}_Jy_beam"].to_numpy(float)) for p in POSITIONS}
    return out


def load_catalog() -> pd.DataFrame:
    cat = pd.read_csv(DATA / "catalogos" / "catalogo_local.csv", dtype={"entrada": str})
    cat = cat.reset_index().rename(columns={"index": "catalog_id"})  # mismo id que catalog.json
    return cat


# --------------------------------------------------------------------------------------
# a. Ruido
# --------------------------------------------------------------------------------------
@dataclass
class Noise:
    sigma: float
    baseline: float
    segments_idx: list[tuple[int, int]]
    segments_GHz: list[tuple[float, float]]
    seg_rms: list[float]
    rho: list[float]              # autocorrelación a desfases 1..3 (canales)
    kappa: float                  # factor de varianza por correlación: 1 + 2 sum rho_k
    sigma_lower_envelope: float   # estimador inicial (percentil 25 del rms local)
    method: str


def _local_rms(y: np.ndarray, w: int = 25, step: int = 5) -> tuple[np.ndarray, np.ndarray]:
    x = np.arange(w)
    rms, lvl = [], []
    for i in range(0, len(y) - w, step):
        s = y[i:i + w]
        c = np.polyfit(x, s, 1)
        rms.append(np.std(s - np.polyval(c, x), ddof=2))
        lvl.append(np.median(s))
    return np.array(rms), np.array(lvl)


def estimate_noise(sp: Spectrum, prof: Profile, cfg: Config = CFG) -> Noise:
    """Ruido a partir de segmentos libres de líneas.

    1) sigma0 = percentil 25 del rms local (ventanas de 25 canales, tendencia lineal
       restada) -> estimador de "envolvente inferior", válido aunque la mayoría de los
       canales tengan emisión (posición A).
    2) Máscara de líneas iterativa: |y - b| > 3 sigma, dilatada ±dilate_ch canales
       (6 en B; 30 en A, ~6 km/s, porque las alas anchas quedan por debajo de 3 sigma).
    3) Segmentos = tramos contiguos libres de >= min_seg_ch canales con nivel compatible
       con la línea base; se eligen hasta 6, los más largos y separados >= 20 MHz.
    4) sigma = desviación estándar de la concatenación (segmento - mediana del segmento).
    """
    y = sp.y
    rms, lvl = _local_rms(y)
    sigma0 = float(np.percentile(rms, 25))
    b = float(np.median(lvl[rms <= sigma0]))
    sigma = sigma0
    dilate, min_seg = prof.dilate_ch, prof.min_seg_ch
    for _attempt in range(4):
        free = np.ones_like(y, bool)
        for _ in range(8):
            line = np.abs(y - b) > cfg.noise_clip * sigma
            line = binary_dilation(line, iterations=dilate) if dilate > 0 else line
            free = ~line
            if free.sum() < 3 * min_seg:
                break
            b_new = float(np.median(y[free]))
            # el sigma de la máscara no puede superar 1.5 sigma0: si lo hace es que alas de
            # líneas anchas se están colando como "ruido" (divergencia observada en A/W1)
            s_new = min(float(np.std(y[free], ddof=1)), 1.5 * sigma0)
            conv = abs(s_new - sigma) < 1e-4 and abs(b_new - b) < 1e-4
            b, sigma = b_new, s_new
            if conv:
                break
        cand = []
        for i0, i1 in runs(free):
            i0, i1 = i0 + 1, i1 - 1  # recorta un canal en cada extremo
            if i1 - i0 >= min_seg and abs(np.median(y[i0:i1]) - b) < sigma:
                cand.append((i0, i1))
        cand.sort(key=lambda t: t[1] - t[0], reverse=True)
        chosen: list[tuple[int, int]] = []
        for c in cand:  # prioridad a segmentos separados
            mid = sp.freq_GHz[(c[0] + c[1]) // 2]
            if all(abs(mid - sp.freq_GHz[(q[0] + q[1]) // 2]) > 0.020 for q in chosen):
                chosen.append(c)
            if len(chosen) >= cfg.noise_max_segments:
                break
        for c in cand:
            if len(chosen) >= cfg.noise_min_segments:
                break
            if c not in chosen:
                chosen.append(c)
        if len(chosen) >= cfg.noise_min_segments:
            break
        dilate, min_seg = max(dilate // 2, 2), max(int(min_seg * 0.7), 8)
    else:
        raise RuntimeError(f"No se encontraron 3 segmentos libres en {sp.window}/{sp.position}")
    chosen.sort()
    pieces = [y[i0:i1] - np.median(y[i0:i1]) for i0, i1 in chosen]
    sig = float(np.std(np.concatenate(pieces), ddof=1))
    # autocorrelación de canales (ruido correlacionado): media ponderada por longitud
    rho = []
    for k in (1, 2, 3):
        num = sum(np.sum(p[:-k] * p[k:]) for p in pieces)
        den = sum(np.sum(p * p) for p in pieces)
        rho.append(float(num / den))
    kappa = float(1.0 + 2.0 * sum(max(rk, 0.0) for rk in rho))
    return Noise(
        sigma=sig, baseline=b, segments_idx=chosen,
        segments_GHz=[(float(sp.freq_GHz[i0]), float(sp.freq_GHz[i1 - 1])) for i0, i1 in chosen],
        seg_rms=[float(np.std(p, ddof=1)) for p in pieces], rho=rho, kappa=kappa,
        sigma_lower_envelope=sigma0,
        method=(f"std de {len(chosen)} segmentos libres (mediana restada); máscara iterativa "
                f"{cfg.noise_clip:g}σ dilatada ±{dilate} canales; σ0 = percentil 25 del rms local"),
    )


# --------------------------------------------------------------------------------------
# b. Detección de picos
# --------------------------------------------------------------------------------------
@dataclass
class Peak:
    idx: int
    kind: str          # "emission" | "absorption"
    value: float       # Jy/beam (en el espectro usado para detectar)
    snr: float         # |value - baseline| / sigma
    width_ch: float
    id: str = ""
    fit: dict = field(default_factory=dict)
    model: dict = field(default_factory=dict)   # parámetros para re-evaluar el ajuste (figuras)
    flags: list[str] = field(default_factory=list)
    candidates: list[dict] = field(default_factory=list)

    @property
    def sign(self) -> int:
        return 1 if self.kind == "emission" else -1


def detect_peaks(sp: Spectrum, noise: Noise, prof: Profile, cfg: Config = CFG) -> list[Peak]:
    """find_peaks sobre +y (emisión) y -y (absorción) con umbral de SNR y prominencia."""
    ys = gaussian_filter1d(sp.y, prof.smooth_ch) if prof.smooth_ch > 0 else sp.y
    s, b = noise.sigma, noise.baseline
    peaks: list[Peak] = []
    for sign, kind in ((1, "emission"), (-1, "absorption")):
        z = sign * (ys - b)
        idx, props = find_peaks(z, height=cfg.snr_detect * s, prominence=cfg.prom_sigma * s,
                                distance=prof.min_distance_ch, width=prof.min_width_ch)
        for i, wd in zip(idx, props["widths"]):
            peaks.append(Peak(int(i), kind, float(ys[i]), float(z[i] / s), float(wd)))
    peaks.sort(key=lambda p: p.idx)
    return peaks


# --------------------------------------------------------------------------------------
# c. Ajuste gaussiano local
# --------------------------------------------------------------------------------------
def _multi_gauss(x: np.ndarray, *p: float) -> np.ndarray:
    x0 = p[0]
    out = p[1] + p[2] * (x - x0)
    for k in range(3, len(p), 3):
        a, mu, sg = p[k:k + 3]
        out = out + a * np.exp(-0.5 * ((x - mu) / sg) ** 2)
    return out


def fit_peak(t: int, peaks: list[Peak], sp: Spectrum, noise: Noise, prof: Profile,
             cfg: Config = CFG) -> None:
    """Ajuste local: gaussiana objetivo + vecinas detectadas en la ventana + base lineal.

    Rellena peaks[t].fit, .model y .flags. El ajuste es descriptivo: el error formal
    (covarianza con sigma absoluta) se infla por sqrt(kappa) para el ruido correlacionado.
    """
    pk = peaks[t]
    n = len(sp.y)
    lo, hi = max(0, pk.idx - prof.fit_half_ch), min(n, pk.idx + prof.fit_half_ch + 1)
    x = np.arange(lo, hi, dtype=float)
    yy = sp.y[lo:hi]
    dv = C_KMS * sp.dnu_MHz / (sp.freq_GHz[pk.idx] * 1e3)  # km/s por canal
    smin, smax = (bd / dv * FWHM_TO_SIGMA for bd in prof.fwhm_kms_bounds)
    neigh = [q for q in peaks if q is not pk and lo <= q.idx < hi]
    neigh = sorted(neigh, key=lambda q: abs(q.idx - pk.idx))[:5]
    comps = [pk] + neigh
    x0 = float(pk.idx)
    edge_y = np.concatenate([yy[:3], yy[-3:]])
    p0 = [x0, float(np.median(edge_y)) if len(edge_y) else 0.0, 0.0]
    lb = [x0 - 1e-6, -np.inf, -np.inf]
    ub = [x0 + 1e-6, np.inf, np.inf]
    for q in comps:
        a0 = q.value - noise.baseline
        s0 = float(np.clip(q.width_ch * FWHM_TO_SIGMA, smin * 1.01, smax * 0.99))
        p0 += [a0, float(q.idx), s0]
        if q.sign > 0:
            lb += [0.0, q.idx - prof.center_slack_ch, smin]
            ub += [np.inf, q.idx + prof.center_slack_ch, smax]
        else:
            lb += [-np.inf, q.idx - prof.center_slack_ch, smin]
            ub += [0.0, q.idx + prof.center_slack_ch, smax]
    p0 = list(np.clip(p0, np.array(lb) + 1e-9, np.array(ub) - 1e-9))
    p0[0] = x0
    flags: list[str] = []
    if pk.kind == "absorption":
        flags.append("absorption")
    if pk.idx < prof.edge_ch or pk.idx > n - 1 - prof.edge_ch:
        flags.append("edge")
    if pk.snr < cfg.snr_weak:
        flags.append("weak")
    try:
        popt, pcov = curve_fit(_multi_gauss, x, yy, p0=p0, bounds=(lb, ub),
                               sigma=np.full_like(yy, noise.sigma), absolute_sigma=True,
                               maxfev=20000)
        perr = np.sqrt(np.clip(np.diag(pcov), 0, np.inf)) * math.sqrt(noise.kappa)
        ok = bool(np.all(np.isfinite(perr[3:6])))
    except (RuntimeError, ValueError):
        ok = False
    if not ok:
        pk.fit = {"ok": False, "center_GHz": None, "fwhm_kms": None, "amp_Jy": None,
                  "area_Jy_kms": None, "area_err_Jy_kms": None, "baseline_Jy": None,
                  "center_err_MHz": None}
        pk.model = {"resid_asym": False, "adjacent_opposite": False, "amp_degenerate": True}
        pk.flags = flags
        return
    a, mu, sg = popt[3:6]
    ea, emu, esg = perr[3:6]
    cov = pcov[3:6, 3:6] * noise.kappa
    fwhm_ch = sg / FWHM_TO_SIGMA
    area = a * sg * math.sqrt(2 * math.pi) * dv
    var_area = 2 * math.pi * dv ** 2 * (sg ** 2 * cov[0, 0] + a ** 2 * cov[2, 2] + 2 * a * sg * cov[0, 2])
    base_at_mu = popt[1] + popt[2] * (mu - x0)
    # --- control de residuos en el núcleo (±1 FWHM) ---
    resid = yy - _multi_gauss(x, *popt)
    core = np.abs(x - mu) <= max(fwhm_ch, 2.0)
    left = core & (x < mu)
    right = core & (x > mu)
    resid_asym = False
    if left.sum() >= 2 and right.sum() >= 2:
        z_asym = (resid[right].sum() - resid[left].sum()) / (
            noise.sigma * math.sqrt(noise.kappa * (left.sum() + right.sum())))
        resid_asym = abs(z_asym) > cfg.asym_z
    resid_max = float(np.max(np.abs(resid[core]))) / noise.sigma if core.any() else 0.0
    # Mezcla: residuo de núcleo > max(4σ, 10 % de la amplitud) -> falta una componente.
    # (el umbral relativo evita llamar "mezcla" a la no-gaussianidad de líneas de SNR ~40)
    blend = resid_max > max(cfg.blend_resid_sigma, cfg.blend_resid_frac * abs(a) / noise.sigma)
    adjacent_opposite = False
    for j in range(1, len(comps)):
        a_j, mu_j, sg_j = popt[3 + 3 * j:6 + 3 * j]
        if abs(mu_j - mu) < 0.6 * (fwhm_ch + sg_j / FWHM_TO_SIGMA):
            if np.sign(a_j) == np.sign(a):
                blend = True             # otra componente del MISMO signo solapada
            else:
                adjacent_opposite = True  # emisión + absorción solapadas (p.ej. P-Cygni inverso)
    if blend:
        flags.append("blend")
    if resid_asym or adjacent_opposite:
        flags.append("asymmetric")
    if (mu - sg * 2.0 < lo or mu + sg * 2.0 > hi - 1) and "edge" not in flags:
        flags.append("edge")
    pk.fit = {
        "ok": True,
        "center_GHz": sp.freq_at(mu),
        "fwhm_kms": float(fwhm_ch * dv),
        "amp_Jy": float(a),
        "area_Jy_kms": float(area),
        "area_err_Jy_kms": float(math.sqrt(max(var_area, 0.0))),
        "baseline_Jy": float(base_at_mu),
        "center_err_MHz": float(emu * sp.dnu_MHz),
    }
    pk.model = {"lo": lo, "hi": hi, "popt": [float(v) for v in popt],
                "resid_max_sigma": resid_max, "resid_asym": bool(resid_asym),
                "adjacent_opposite": bool(adjacent_opposite),
                # amplitud degenerada (|A|/σ_A < 3) aunque el pico sea significativo: típico de
                # emisión + absorción solapadas; el área de la componente es modelo-dependiente
                "amp_degenerate": bool(abs(a) / max(ea, 1e-12) < 3.0)}
    pk.flags = flags


# --------------------------------------------------------------------------------------
# Resultado por ventana × posición
# --------------------------------------------------------------------------------------
@dataclass
class WinPos:
    sp: Spectrum
    noise: Noise
    prof: Profile
    peaks: list[Peak]

    def center_MHz(self, pk: Peak) -> float:
        if pk.fit.get("ok"):
            return pk.fit["center_GHz"] * 1e3
        return float(self.sp.freq_GHz[pk.idx] * 1e3)

    def amp(self, pk: Peak) -> float:
        if pk.fit.get("ok"):
            return float(pk.fit["amp_Jy"])
        return pk.value - self.noise.baseline


def analyse_window_position(sp: Spectrum, cfg: Config = CFG) -> WinPos:
    prof = PROFILES[POS_PROFILE[sp.position]]
    noise = estimate_noise(sp, prof, cfg)
    peaks = detect_peaks(sp, noise, prof, cfg)
    for t in range(len(peaks)):
        fit_peak(t, peaks, sp, noise, prof, cfg)
    for k, pk in enumerate(peaks, 1):
        pk.id = f"{sp.window}-{POS_TAG[sp.position]}-{k:03d}"
    return WinPos(sp, noise, prof, peaks)


# --------------------------------------------------------------------------------------
# e. Puntuación por especie
# --------------------------------------------------------------------------------------
@dataclass
class Group:
    """Rasgo espectral = filas del catálogo de una especie no resueltas entre sí."""

    species: str
    ids: list[int]
    rest_MHz: float
    logI: float
    Eu_K: float
    unc_MHz: float
    window: str
    lead_id: int


def build_groups(cat: pd.DataFrame, group_tol_MHz: float, cfg: Config = CFG
                 ) -> tuple[dict[str, list[Group]], dict[str, int]]:
    """Agrupa por especie las filas a < group_tol_MHz (encadenadas) en cobertura (v = 3 km/s).

    Excluye filas con incertidumbre > unc_max_MHz (no identificables). logI del grupo =
    log10 de la suma de 10**logI; frecuencia = media ponderada; unc = máximo.
    """
    meta = json.load(open(WEB / "meta.json"))
    ranges = {w: [x * 1e3 for x in meta["windows"][w]["range_GHz"]] for w in WINDOWS}

    def win(nu_rest: float) -> str | None:
        nu = float(nu_obs_from(nu_rest, 3.0))
        for w, (lo, hi) in ranges.items():
            if lo + 1.0 <= nu <= hi - 1.0:
                return w
        return None

    groups: dict[str, list[Group]] = {}
    excluded: dict[str, int] = {}
    for sp_name, d in cat.groupby("especie"):
        d = d.sort_values("frecuencia_reposo_MHz")
        excluded[sp_name] = int((d.incertidumbre_MHz > cfg.unc_max_MHz).sum())
        d = d[d.incertidumbre_MHz <= cfg.unc_max_MHz]
        d = d[[win(f) is not None for f in d.frecuencia_reposo_MHz]]
        cur: list[pd.Series] = []
        out: list[Group] = []

        def flush() -> None:
            if not cur:
                return
            I = np.array([10 ** c.log10_I_300K_nm2_MHz for c in cur])
            f = np.array([c.frecuencia_reposo_MHz for c in cur])
            lead = cur[int(np.argmax(I))]
            fr = float(np.sum(I * f) / I.sum())
            out.append(Group(sp_name, [int(c.catalog_id) for c in cur], fr, float(np.log10(I.sum())),
                             float(lead.E_superior_K), float(max(c.incertidumbre_MHz for c in cur)),
                             win(fr) or "", int(lead.catalog_id)))

        for _, row in d.iterrows():
            if cur and row.frecuencia_reposo_MHz - cur[-1].frecuencia_reposo_MHz > group_tol_MHz:
                flush()
                cur = []
            cur.append(row)
        flush()
        groups[sp_name] = out
    return groups, excluded


def poisson_binomial_sf(p: np.ndarray, m: int) -> float:
    """P(X >= m) para X = suma de Bernoulli independientes con probabilidades p."""
    dist = np.zeros(len(p) + 1)
    dist[0] = 1.0
    for pi in p:
        dist[1:] = dist[1:] * (1 - pi) + dist[:-1] * pi
        dist[0] *= (1 - pi)
    return float(dist[m:].sum())


@dataclass
class SpeciesResult:
    species: str
    position: str
    n_predicted: int
    n_detectable: int
    n_matched: int
    n_missing_strong: int
    n_ambiguous: int
    n_excluded_unc: int
    v_best: float
    v_mean: float | None
    v_std: float | None
    p_chance: float
    fap: float
    completeness: float
    score: float
    verdict: str
    lines: list[dict]
    v_best_free: float | None = None     # resultado de la búsqueda libre (paso 1)
    n_matched_free: int | None = None
    fap_free: float | None = None
    v_range: tuple[float, float] = (0.0, 6.0)
    n_clean: int = 0                     # coincidencias sin blend ni confusión
    n_overbright: int = 0
    quality: float = 0.0
    v_offset: float | None = None        # v_media - v_pos (paso 2)
    coherent: bool = True


def strong_groups(groups: list[Group], cfg: Config = CFG) -> list[Group]:
    """Rasgos "fuertes": logI del grupo dentro de strong_dex del máximo de la especie."""
    if not groups:
        return []
    lmax = max(g.logI for g in groups)
    return [g for g in groups if g.logI >= lmax - cfg.strong_dex]


def score_species(position: str, groups: list[Group], wp: dict[str, WinPos], fwhm_typ_kms: float,
                  n_excluded: int, v_range: tuple[float, float] | None = None,
                  confusers: list[tuple[Group, float]] | None = None,
                  v_sys: tuple[float, float] | None = None,
                  cfg: Config = CFG) -> SpeciesResult:
    """Consistencia en velocidad de los rasgos fuertes de una especie en una posición.

    1. Rasgos fuertes: logI_grupo >= max(logI_grupo en cobertura) - strong_dex.
    2. Para v en v_range (por defecto [0, 6] km/s; paso 0.05): cuenta rasgos fuertes con un pico de emisión
       detectado a |nu_pico - nu_pred(v)| <= tol, con tol = max(2 canales, 0.5 FWHM_pico,
       3 unc); asignación uno-a-uno. Se elige v con más coincidencias (desempate: menor
       suma de (Δ/tol)^2).
    3. Estado de cada rasgo no coincidente: "missing" (veto) si el pico esperado escalando
       logI con las líneas coincidentes es >= 6 sigma en ambos escenarios Tex (100 y 300 K)
       y no hay emisión > 3 sigma en ±tol; "ambiguous" si hay emisión >3σ o absorción < -3σ
       pero ningún pico detectado en tolerancia; "below_limit" en otro caso.
       Una coincidencia cuyo pico observado supera en > overbright_factor el esperado (en el
       escenario Tex más favorable) se reclasifica "overbright": la emisión existe pero es
       demasiado intensa para esta transición -> la domina otro portador (cuenta como ambigua).
       Una coincidencia es "blend" (no limpia) si el ajuste está marcado blend, si sus residuos
       son asimétricos sin absorción adyacente que lo explique, o si un rasgo fuerte de OTRA
       especie plausible (``confusers``: pares (rasgo, pico esperado máx. en Jy) de especies
       fuerte/tentativa en el paso libre) cae dentro de la tolerancia del mismo pico con
       intensidad esperada >= max(3σ, 20 % del pico observado).
    4. FAP: P(X >= n_matched) por azar (Poisson-binomial con p_i = 1 - exp(-λ 2 tol_i),
       λ = densidad de picos de emisión) multiplicada por el número de ensayos en velocidad.
    5. Coherencia con la fuente (sólo si se da ``v_sys`` = (v_pos, err)): las moléculas de un
       mismo núcleo caliente comparten velocidad sistémica, así que
       |v_media - v_pos| <= max(0.5·FWHM_típico, 3·σ_Δ), σ_Δ² = std²/n + err_pos².
    6. score = completitud × calidad × S × 0.5**n_missing × (0.5 si incoherente),
       S = min(1, -log10(FAP)/6).
    """
    strong = strong_groups(groups, cfg)
    confusers = confusers or []
    dnu = {w: wp[w].sp.dnu_MHz for w in WINDOWS}
    fwhm_typ_MHz = fwhm_typ_kms / C_KMS * 349.3e3

    def tol_line(g: Group, fwhm_MHz: float) -> float:
        return max(cfg.tol_min_ch * dnu[g.window], cfg.tol_fwhm_factor * fwhm_MHz,
                   cfg.tol_unc_factor * g.unc_MHz)

    # picos de emisión disponibles por ventana
    em = {w: [pk for pk in wp[w].peaks if pk.kind == "emission"] for w in WINDOWS}
    em_c = {w: np.array([wp[w].center_MHz(pk) for pk in em[w]]) for w in WINDOWS}
    # FWHM por pico, acotado a fwhm_cap × FWHM típico de la posición: un ajuste ancho (mezcla,
    # absorción adyacente) no debe abrir la tolerancia a varios km/s
    em_fw = {w: np.array([min(pk.fit["fwhm_kms"] if pk.fit.get("ok") else fwhm_typ_kms,
                              cfg.fwhm_cap * fwhm_typ_kms) / C_KMS * c
                          for pk, c in zip(em[w], em_c[w])])
             for w in WINDOWS}

    def match_at(v: float) -> tuple[dict[int, tuple[str, int, float, float]], float]:
        pairs = []
        for gi, g in enumerate(strong):
            nu = float(nu_obs_from(g.rest_MHz, v))
            c, fw = em_c[g.window], em_fw[g.window]
            if len(c) == 0:
                continue
            tol = np.maximum.reduce([np.full_like(c, cfg.tol_min_ch * dnu[g.window]),
                                     cfg.tol_fwhm_factor * fw,
                                     np.full_like(c, cfg.tol_unc_factor * g.unc_MHz)])
            dd = c - nu
            for k in np.where(np.abs(dd) <= tol)[0]:
                pairs.append(((dd[k] / tol[k]) ** 2, gi, g.window, int(k), float(dd[k]), float(tol[k])))
        pairs.sort()
        used_g, used_p, res, cost = set(), set(), {}, 0.0
        for q, gi, w, k, dd, tl in pairs:
            if gi in used_g or (w, k) in used_p:
                continue
            used_g.add(gi)
            used_p.add((w, k))
            res[gi] = (w, k, dd, tl)
            cost += q
        return res, cost

    vmin, vmax = v_range if v_range is not None else cfg.v_grid[:2]
    grid = np.arange(vmin, vmax + 1e-9, cfg.v_grid[2])
    best = (-1, np.inf, 0.0)
    scan = []
    for v in grid:
        res, cost = match_at(float(v))
        scan.append(len(res))
        if (len(res), -cost) > (best[0], -best[1]):
            best = (len(res), cost, float(v))
    # centro de la meseta de máximo número de coincidencias (más estable que el primer máximo)
    scan_a = np.array(scan)
    if best[0] > 0:
        plateau = grid[scan_a == best[0]]
        near = plateau[np.abs(plateau - best[2]) <= 0.5]
        v_best = float(np.median(near)) if len(near) else best[2]
        res_b, cost_b = match_at(v_best)
        if len(res_b) < best[0]:
            v_best = best[2]
            res_b, _ = match_at(v_best)
    else:
        v_best = float(0.5 * (vmin + vmax))
        res_b = {}

    # escala de intensidad (relativa, dentro de la especie) a partir de las coincidencias
    def logI_T(g: Group, T: float) -> float:
        return g.logI - g.Eu_K * (1 / T - 1 / 300.0) / math.log(10)

    def scales(keys: list[int], how: str = "median") -> dict[float, float]:
        """Escala amplitud/10**logI_T por escenario Tex. "median": típica (clasificar overbright,
        confusores); "min": conservadora -cada pico es una cota SUPERIOR de la contribución de
        la especie, porque otros portadores sólo suman flujo- (usada para el veto)."""
        if not keys:
            return {}
        amp = np.array([wp[res_b[gi][0]].amp(em[res_b[gi][0]][res_b[gi][1]]) for gi in keys])
        red = np.median if how == "median" else np.min
        return {T: float(red(amp / 10 ** np.array([logI_T(strong[gi], T) for gi in keys])))
                for T in cfg.tex_scenarios}

    overbright: set[int] = set()
    scale = scales(list(res_b))
    for _ in range(2):
        if not scale:
            break
        ob = set()
        for gi, (w, k, dd, tl) in res_b.items():
            exp_max = max(scale[T] * 10 ** logI_T(strong[gi], T) for T in cfg.tex_scenarios)
            if wp[w].amp(em[w][k]) > cfg.overbright_factor * exp_max:
                ob.add(gi)
        if ob == overbright or len(ob) == len(res_b):
            overbright = ob if len(ob) < len(res_b) else overbright
            break
        overbright = ob
        scale = scales([gi for gi in res_b if gi not in overbright])
    good = [gi for gi in res_b if gi not in overbright]
    scale_min = scales(good, "min")
    matched_v = [float(v_from(em_c[w][k], strong[gi].rest_MHz))
                 for gi, (w, k, dd, tl) in res_b.items() if gi not in overbright]

    lines, n_missing, n_amb, n_det = [], 0, 0, 0
    p_list, tol_kms_list = [], []
    for gi, g in enumerate(strong):
        sp = wp[g.window].sp
        noise = wp[g.window].noise
        tol_typ = tol_line(g, fwhm_typ_MHz)
        tol_kms_list.append(tol_typ / g.rest_MHz * C_KMS)
        lam = len(em[g.window]) / (sp.freq_GHz[-1] - sp.freq_GHz[0]) / 1e3  # picos por MHz
        # expected: conservador (escala mínima, Tex menos favorable) -> veto y "detectable"
        # expected_max: generoso (escala mediana, Tex más favorable) -> confusores y ensayos FAP
        expected = expected_max = None
        if scale:
            expected = min(scale_min[T] * 10 ** logI_T(g, T) for T in cfg.tex_scenarios)
            expected_max = max(scale[T] * 10 ** logI_T(g, T) for T in cfg.tex_scenarios)
        # ensayo del FAP sólo si una coincidencia con este rasgo PODRÍA contarse: si incluso en
        # el escenario más favorable se espera < snr_detect·σ / overbright_factor, cualquier pico
        # detectado (>= 4σ) sería "overbright" y no contaría
        if expected_max is None or expected_max >= cfg.snr_detect * noise.sigma / cfg.overbright_factor:
            p_list.append(1 - math.exp(-lam * 2 * tol_typ))
        entry: dict[str, Any] = {"catalog_id": g.lead_id, "rest_MHz": round(g.rest_MHz, 4),
                                 "Eu_K": r(g.Eu_K, 1), "logI_300K": r(g.logI, 4),
                                 "unc_MHz": r(g.unc_MHz, 4),
                                 "peak_id": None, "v_kms": None, "v_err_kms": None, "snr": None,
                                 "blend": False, "status": "", "detail": "",
                                 "grouped_ids": g.ids, "window": g.window,
                                 "expected_peak_Jy": r(expected, 4),
                                 "expected_peak_max_Jy": r(expected_max, 4)}
        if gi in res_b:
            w, k, dd, tl = res_b[gi]
            pk = em[w][k]
            amp_obs = wp[w].amp(pk)
            sig_w = wp[w].noise.sigma
            # confusión: rasgo fuerte de OTRA especie plausible (fuerte/tentativa en el paso 1)
            # dentro de la tolerancia del mismo pico y con intensidad esperada no despreciable
            conf = sorted({o.species for o, e_max in confusers if o.window == w
                           and abs(float(nu_obs_from(o.rest_MHz, v_best)) - em_c[w][k])
                           <= max(tl, cfg.tol_unc_factor * o.unc_MHz)
                           and e_max >= max(cfg.confuser_min_sigma * sig_w,
                                            cfg.confuser_min_frac * amp_obs)})
            v_line = float(v_from(em_c[w][k], g.rest_MHz))
            cerr = pk.fit.get("center_err_MHz") if pk.fit.get("ok") else None
            v_err = math.hypot(cerr if cerr is not None else wp[w].sp.dnu_MHz, g.unc_MHz) \
                / g.rest_MHz * C_KMS
            is_blend = ("blend" in pk.flags or bool(conf)
                        or (pk.model.get("resid_asym", False)
                            and not pk.model.get("adjacent_opposite", False)))
            entry.update(v_kms=r(v_line, 3), v_err_kms=r(v_err, 3), snr=r(pk.snr, 2),
                         confused_with=conf, blend=bool(is_blend),
                         adjacent_absorption=bool(pk.model.get("adjacent_opposite", False)))
            if gi in overbright:
                # la emisión existe pero es >10x la esperada: la domina otro portador
                entry.update(status="unmatched", detail="overbright", nearest_peak_id=pk.id)
                n_amb += 1
            else:
                entry.update(status="matched", detail="matched", peak_id=pk.id)
            n_det += 1
        else:
            nu = float(nu_obs_from(g.rest_MHz, v_best)) / 1e3
            m = np.abs(sp.freq_GHz - nu) * 1e3 <= tol_typ
            seg = sp.y[m] - noise.baseline if m.any() else np.array([0.0])
            ymax, ymin = float(seg.max()), float(seg.min())
            detectable = expected is None or expected >= cfg.veto_expected_sigma * noise.sigma
            if ymax > cfg.veto_absent_sigma * noise.sigma or ymin < -cfg.veto_absent_sigma * noise.sigma:
                detail = "ambiguous"
                if detectable:
                    n_amb += 1
                    n_det += 1
            elif expected is not None and detectable:
                detail = "missing"
                n_missing += 1
                n_det += 1
            else:
                detail = "below_limit"
            # status según el contrato web: matched | unmatched | missing
            entry.update(status="missing" if detail == "missing" else "unmatched", detail=detail,
                         snr=r(ymax / noise.sigma, 2))
        lines.append(entry)

    n_pred, n_match = len(strong), len(res_b) - len(overbright)
    n_clean = sum(1 for ln in lines if ln["status"] == "matched" and not ln["blend"])
    if n_pred and len(p_list) >= n_match:
        p_chance = poisson_binomial_sf(np.array(p_list), n_match)
        n_trials = max(1.0, (vmax - vmin) / (2 * float(np.median(tol_kms_list))))
        fap = min(1.0, n_trials * p_chance)
    else:
        p_chance, fap = 1.0, 1.0
    completeness = n_match / max(1.0, n_match + n_missing + 0.5 * n_amb)
    # calidad: las coincidencias mezcladas/confundidas valen la mitad
    quality = (n_clean + 0.5 * (n_match - n_clean)) / n_match if n_match else 0.0
    # significancia: S = min(1, -log10(FAP)/6) -> FAP 1e-6: 1; 1e-3: 0.5; 0.05: 0.22; 0.25: 0.10
    signif = min(1.0, max(0.0, -math.log10(max(fap, 1e-300)) / cfg.signif_dex))
    score = completeness * quality * signif * 0.5 ** n_missing if n_match else 0.0
    # v media/dispersión: de las coincidencias limpias si hay >= 2 (los centroides mezclados
    # están sesgados); si no, de todas las coincidencias
    clean_v = [ln["v_kms"] for ln in lines if ln["status"] == "matched" and not ln["blend"]]
    vv = clean_v if len(clean_v) >= 2 else matched_v
    v_mean = float(np.mean(vv)) if vv else None
    v_std = float(np.std(vv, ddof=1)) if len(vv) >= 2 else None
    v_std_all = float(np.std(matched_v, ddof=1)) if len(matched_v) >= 2 else None
    tol_kms_med = float(np.median(tol_kms_list)) if tol_kms_list else 0.0
    v_std_max = max(cfg.v_std_max_kms, 0.5 * tol_kms_med)
    # el veto ("las coincidencias NO son de esta especie") sólo se aplica a hipótesis con
    # >= 2 coincidencias: refutar una única coincidencia no descarta nada
    veto_valid = n_match >= cfg.veto_min_match
    # coherencia con la velocidad sistémica de la posición
    v_offset, coherent = None, True
    if v_sys is not None and v_mean is not None:
        v_pos, v_pos_err = v_sys
        n_v = len(vv)
        spread = v_std if v_std is not None else (
            next((ln["v_err_kms"] for ln in lines if ln["status"] == "matched"), 0.0) or 0.0)
        sig_off = math.sqrt(spread ** 2 / max(n_v, 1) + (v_pos_err or 0.0) ** 2)
        v_offset = v_mean - v_pos
        coherent = abs(v_offset) <= max(cfg.v_sys_tol_fwhm * fwhm_typ_kms, 3.0 * sig_off)
    if not coherent:
        score *= 0.5
    if veto_valid and (n_missing >= 2 or (n_missing >= 1 and (fap > cfg.tentativa_max_fap
                                                              or not coherent))):
        verdict = "descartada"
    elif (n_clean >= cfg.fuerte_min_match and fap < cfg.fuerte_max_fap and n_missing == 0
          and completeness >= 0.5 and (v_std or 0.0) <= v_std_max and coherent):
        verdict = "fuerte"
    elif (n_match >= cfg.tentativa_min_match and fap < cfg.tentativa_max_fap and n_missing <= 1
          and coherent and (v_std or 0.0) <= cfg.tentativa_vstd_factor * v_std_max):
        verdict = "tentativa"
    else:
        verdict = "insuficiente"
    return SpeciesResult(groups[0].species if groups else "", position, n_pred, n_det, n_match,
                         n_missing, n_amb, n_excluded, v_best, v_mean, v_std, p_chance, fap,
                         completeness, float(np.clip(score, 0, 1)), verdict, lines,
                         v_range=(float(vmin), float(vmax)), n_clean=n_clean,
                         n_overbright=len(overbright), quality=quality,
                         v_offset=v_offset, coherent=coherent)


def adopted_velocity(scores: dict[str, "SpeciesResult"], position: str,
                     cfg: Config = CFG) -> dict[str, Any]:
    """Velocidad de la posición: mediana ponderada de las v de líneas coincidentes y limpias
    (no blend) de especies "fuerte" (si hay < 3 líneas, se añaden las "tentativa"; si
    tampoco, v inicial). Peso w_i = 1 / (σ_ajuste² + σ_catálogo² + σ_suelo²), todo en km/s,
    con σ_suelo = 0.10 km/s (½ canal), de modo que una línea con frecuencia de laboratorio
    imprecisa o un ajuste degenerado (absorción adyacente) pesa poco.
    Error = 1.2533·MAD/√n (error de la mediana), y se informa también la dispersión (MAD)."""
    vs: list[float] = []
    ws: list[float] = []
    used: list[str] = []
    level = ""
    for level in ("fuerte", "tentativa"):
        allowed = ("fuerte",) if level == "fuerte" else ("fuerte", "tentativa")
        vs, ws, used = [], [], []
        for s, sr in scores.items():
            if sr.verdict not in allowed:
                continue
            for ln in sr.lines:
                if ln["status"] == "matched" and not ln["blend"]:
                    vs.append(ln["v_kms"])
                    ws.append(1.0 / (ln["v_err_kms"] ** 2 + cfg.v_floor_kms ** 2))
                    used.append(s)
        if len(vs) >= 3:
            break
    if len(vs) < 3:
        return {"v_kms": V_START[position], "scatter_kms": None, "err_kms": None, "n_lines": 0,
                "from_verdict": "v_start (sin especies fiables)", "species": []}
    o = np.argsort(vs)
    vs_a, ws_a = np.array(vs)[o], np.array(ws)[o]
    cw = np.cumsum(ws_a) / ws_a.sum()
    vmed = float(vs_a[np.searchsorted(cw, 0.5)])
    mad = float(1.4826 * np.median(np.abs(vs_a - np.median(vs_a))))
    return {"v_kms": round(vmed, 3), "scatter_kms": round(mad, 3),
            "err_kms": round(1.2533 * mad / math.sqrt(len(vs)), 3), "n_lines": len(vs),
            "from_verdict": level, "species": sorted(set(used))}


def _ccf_lag(t: np.ndarray, x: np.ndarray, maxlag: int) -> tuple[float, float]:
    """Desfase (canales, con interpolación parabólica) que maximiza la correlación
    normalizada entre la plantilla t y el espectro x (x[i] ~ t[i - lag])."""
    t = t - np.median(t)
    x = x - np.median(x)
    n = len(t)
    lags = np.arange(-maxlag, maxlag + 1)
    c = np.array([np.sum(t[max(0, -k):n - max(0, k)] * x[max(0, k):n - max(0, -k)]) for k in lags])
    c = c / math.sqrt(np.sum(t * t) * np.sum(x * x))
    i = int(np.clip(np.argmax(c), 1, len(c) - 2))
    y0, y1, y2 = c[i - 1], c[i], c[i + 1]
    den = y0 - 2 * y1 + y2
    d = 0.5 * (y0 - y2) / den if den != 0 else 0.0
    return float(lags[i] + d), float(c[i])


def velocity_crosscheck(res: dict[str, dict[str, WinPos]], v_adopt: dict[str, dict[str, Any]],
                        fwhm_typ: dict[str, float], ref: str = "B_offset",
                        maxlag_kms: float = 8.0) -> dict[str, Any]:
    """Comprobación independiente de la identificación: correlación cruzada de cada posición
    con la plantilla ``ref`` (B_offset), suavizada al FWHM típico de la posición objetivo
    (σ_suav² = FWHM_obj² - FWHM_ref²). Como ambas comparten eje de frecuencias, el desfase k
    (canales) da Δv = -c·k·Δν/ν. Se mide en las 4 mitades de ventana (W1a, W1b, W2a, W2b):
    Δv = media, error = std/√4. v_ccf = v_ref + Δv."""
    out: dict[str, Any] = {}
    for p in POSITIONS:
        if p == ref:
            continue
        ests: list[float] = []
        per: dict[str, float] = {}
        for w in WINDOWS:
            t_sp, x_sp = res[ref][w].sp, res[p][w].sp
            dv_ch = t_sp.dv_kms
            sm = math.sqrt(max(fwhm_typ[p] ** 2 - fwhm_typ[ref] ** 2, 0.0)) / dv_ch * FWHM_TO_SIGMA
            t = gaussian_filter1d(t_sp.y, sm) if sm > 0.3 else t_sp.y
            n = len(t)
            maxlag = int(maxlag_kms / dv_ch)
            for half, sl in (("a", slice(0, n // 2)), ("b", slice(n // 2, n))):
                k, _ = _ccf_lag(t[sl], x_sp.y[sl], maxlag)
                dv = -C_KMS * k * t_sp.dnu_MHz / (np.mean(t_sp.freq_GHz) * 1e3)
                per[f"{w}{half}"] = round(dv, 3)
                ests.append(dv)
        dv_m = float(np.mean(ests))
        err = float(np.std(ests, ddof=1) / math.sqrt(len(ests)))
        out[p] = {"ref": ref, "dv_kms": round(dv_m, 3), "dv_err_kms": round(err, 3),
                  "v_ccf_kms": round(v_adopt[ref]["v_kms"] + dv_m, 3),
                  "v_ccf_err_kms": round(math.hypot(err, v_adopt[ref]["err_kms"] or 0.0), 3),
                  "por_media_ventana": per}
    return out


def absorption_diagnostics(res: dict[str, dict[str, WinPos]], max_dv_kms: float = 3.0
                           ) -> dict[str, Any]:
    """Para cada absorción detectada, desfase en velocidad respecto del pico de emisión más
    cercano (|Δv| <= 3 km/s): Δv = v_abs - v_em = -c (ν_abs - ν_em)/ν_em; Δv > 0 = absorción
    desplazada al rojo (perfil P-Cygni inverso, firma de caída de material). Se informa la
    fracción al rojo y la probabilidad binomial (p = 0.5) de obtener al menos esa fracción."""
    from scipy.stats import binomtest
    out: dict[str, Any] = {}
    for p in POSITIONS:
        dvs: list[float] = []
        n_abs = 0
        for w in WINDOWS:
            wp = res[p][w]
            em_c = [wp.center_MHz(q) for q in wp.peaks if q.kind == "emission"]
            for a in wp.peaks:
                if a.kind != "absorption":
                    continue
                n_abs += 1
                ca = wp.center_MHz(a)
                d = [-C_KMS * (ca - ce) / ce for ce in em_c]
                d = [x for x in d if abs(x) <= max_dv_kms]
                if d:
                    dvs.append(min(d, key=abs))
        n_red = int(sum(x > 0 for x in dvs))
        out[p] = {"n_absorption": n_abs, "n_with_emission": len(dvs), "n_redshifted": n_red,
                  "median_dv_kms": r(np.median(dvs), 3) if dvs else None,
                  "p16_p84_dv_kms": [r(x, 3) for x in np.percentile(dvs, [16, 84])] if dvs else None,
                  "p_binomial": float(f"{binomtest(n_red, len(dvs), 0.5, alternative='greater').pvalue:.3g}")
                  if dvs else None}
    return out


# --------------------------------------------------------------------------------------
# d. Candidatos por pico
# --------------------------------------------------------------------------------------
def attach_candidates(wpos: WinPos, cat: pd.DataFrame, v_adopt: float, cfg: Config = CFG) -> None:
    """Transiciones con velocidad implícita en v_cand_range; delta_MHz = nu_cat - nu_rest_obs,
    donde nu_rest_obs = nu_pico / (1 - v_adopt/c) (Doppler aplicado una vez)."""
    rest = cat.frecuencia_reposo_MHz.to_numpy()
    for pk in wpos.peaks:
        nu = wpos.center_MHz(pk)
        v = v_from(nu, rest)
        sel = np.where((v >= cfg.v_cand_range[0]) & (v <= cfg.v_cand_range[1]))[0]
        nu_rest_obs = nu / (1 - v_adopt / C_KMS)
        cands = []
        for i in sel:
            row = cat.iloc[i]
            cands.append({"catalog_id": int(row.catalog_id), "species": row.especie,
                          "rest_MHz": float(row.frecuencia_reposo_MHz), "v_kms": r(v[i], 3),
                          "delta_MHz": r(row.frecuencia_reposo_MHz - nu_rest_obs, 4),
                          "Eu_K": r(row.E_superior_K, 1), "logI_300K": r(row.log10_I_300K_nm2_MHz, 4),
                          "unc_MHz": r(row.incertidumbre_MHz, 4)})
        cands.sort(key=lambda c: abs(c["delta_MHz"]))
        pk.candidates = cands


# --------------------------------------------------------------------------------------
# Orquestación
# --------------------------------------------------------------------------------------
def run(make_figures: bool = True, cfg: Config = CFG) -> dict[str, Any]:
    t0 = time.time()
    spectra = load_spectra()
    cat = load_catalog()
    res: dict[str, dict[str, WinPos]] = {p: {} for p in POSITIONS}
    for w in WINDOWS:
        for p in POSITIONS:
            res[p][w] = analyse_window_position(spectra[w][p], cfg)

    # FWHM típico por posición (picos de emisión aislados, SNR >= 8, ajuste correcto)
    fwhm_typ: dict[str, float] = {}
    for p in POSITIONS:
        fw = [pk.fit["fwhm_kms"] for w in WINDOWS for pk in res[p][w].peaks
              if pk.kind == "emission" and pk.fit.get("ok") and pk.snr >= 8
              and not ({"blend", "asymmetric", "edge"} & set(pk.flags))]
        fwhm_typ[p] = float(np.median(fw)) if fw else (1.1 if p != "A" else 7.0)

    # Paso 1 (libre): búsqueda de velocidad por especie en 0-6 km/s, sin confusores.
    # Velocidad de la posición = mediana ponderada (precisión) de las líneas limpias de las
    #         especies "fuerte" del paso 1.
    # Paso 2 (final): cada especie se re-evalúa en v_pos ± dv_window (las especies de un mismo
    #         núcleo caliente comparten velocidad sistémica dentro de ~1 km/s) y ahora sí se
    #         buscan confusores, pero sólo entre especies fuerte/tentativa del paso 1 y con su
    #         intensidad esperada (escala del paso 1). El veredicto final es el del paso 2; el
    #         paso 1 se conserva como diagnóstico (v_best_free, n_matched_free, fap_free).
    scores: dict[str, dict[str, SpeciesResult]] = {}
    groups_by_pos: dict[str, dict[str, list[Group]]] = {}
    v_adopt: dict[str, dict[str, Any]] = {}
    for p in POSITIONS:
        dnu = res[p]["W1"].sp.dnu_MHz
        gtol = max(cfg.tol_min_ch * dnu, 0.5 * fwhm_typ[p] / C_KMS * 349.3e3)
        groups, excluded = build_groups(cat, gtol, cfg)
        groups_by_pos[p] = groups
        strong_all = {s: strong_groups(g, cfg) for s, g in groups.items()}

        free = {s: score_species(p, g, res[p], fwhm_typ[p], excluded[s], None, None, None, cfg)
                for s, g in groups.items()}
        for s, sr in free.items():
            sr.species = s
        plausible = {s for s, sr in free.items() if sr.verdict in ("fuerte", "tentativa")}

        def conf_for(s: str) -> list[tuple[Group, float]]:
            out: list[tuple[Group, float]] = []
            for o in plausible - {s}:
                for g, ln in zip(strong_all[o], free[o].lines):
                    if ln["expected_peak_max_Jy"] is not None:
                        out.append((g, float(ln["expected_peak_max_Jy"])))
            return out

        v_adopt[p] = adopted_velocity(free, p, cfg)
        vp = v_adopt[p]["v_kms"]
        dvw = cfg.dv_window_kms[POS_PROFILE[p]]
        scores[p] = {}
        for s, g in groups.items():
            sr = score_species(p, g, res[p], fwhm_typ[p], excluded[s], (vp - dvw, vp + dvw),
                               conf_for(s), (vp, v_adopt[p]["err_kms"] or 0.0), cfg)
            sr.species = s
            sr.v_best_free, sr.n_matched_free, sr.fap_free = free[s].v_best, free[s].n_matched, free[s].fap
            scores[p][s] = sr
        # velocidad final con los veredictos del paso 2
        v_adopt[p] = adopted_velocity(scores[p], p, cfg)
        v_adopt[p]["v_pass1_kms"] = vp
    for p in POSITIONS:
        for w in WINDOWS:
            attach_candidates(res[p][w], cat, v_adopt[p]["v_kms"], cfg)
    ccf = velocity_crosscheck(res, v_adopt, fwhm_typ)
    for p, c in ccf.items():
        v_adopt[p]["v_ccf_kms"] = c["v_ccf_kms"]
        v_adopt[p]["v_ccf_err_kms"] = c["v_ccf_err_kms"]

    absd = absorption_diagnostics(res)
    write_outputs(res, scores, v_adopt, fwhm_typ, cat, cfg, ccf, absd)
    if make_figures:
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import figures  # import local: matplotlib sólo si se piden figuras
        figures.make_all(res, scores, v_adopt, groups_by_pos, fwhm_typ, cfg, FIG)
    dt = time.time() - t0
    print(f"pipeline OK en {dt:.1f} s")
    return {"res": res, "scores": scores, "v_adopt": v_adopt, "fwhm_typ": fwhm_typ, "ccf": ccf,
            "absorption": absd, "groups": groups_by_pos}


# --------------------------------------------------------------------------------------
# f. Escritura
# --------------------------------------------------------------------------------------
def peak_json(wpos: WinPos, pk: Peak) -> dict[str, Any]:
    f = pk.fit
    return {
        "id": pk.id,
        "freq_GHz": round(float(wpos.sp.freq_GHz[pk.idx]), 7),
        "peak_Jy": r(pk.value, 4),
        "snr": r(pk.snr, 2),
        "fit": {"ok": bool(f.get("ok")), "center_GHz": r(f.get("center_GHz"), 7),
                "fwhm_kms": r(f.get("fwhm_kms"), 3), "amp_Jy": r(f.get("amp_Jy"), 4),
                "area_Jy_kms": r(f.get("area_Jy_kms"), 4), "baseline_Jy": r(f.get("baseline_Jy"), 4),
                "center_err_MHz": r(f.get("center_err_MHz"), 4),
                "area_err_Jy_kms": r(f.get("area_err_Jy_kms"), 4)},
        "flags": list(pk.flags),
        "candidates": pk.candidates,
        "kind": pk.kind,
        "adjacent_absorption": bool(pk.model.get("adjacent_opposite", False)),
    }


def write_outputs(res: dict[str, dict[str, WinPos]], scores: dict[str, dict[str, SpeciesResult]],
                  v_adopt: dict[str, dict[str, Any]], fwhm_typ: dict[str, float],
                  cat: pd.DataFrame, cfg: Config, ccf: dict[str, Any] | None = None,
                  absd: dict[str, Any] | None = None) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # ---- peaks.json + CSV
    peaks_js: dict[str, dict[str, list]] = {w: {} for w in WINDOWS}
    for w in WINDOWS:
        for p in POSITIONS:
            wpos = res[p][w]
            peaks_js[w][p] = [peak_json(wpos, pk) for pk in wpos.peaks]
            rows = []
            for pk in wpos.peaks:
                f = pk.fit
                top = [f"{c['species']}@{c['rest_MHz']:.3f}(Δ={c['delta_MHz']:+.2f})" for c in pk.candidates[:4]]
                rows.append({"id": pk.id, "tipo": pk.kind, "freq_GHz": wpos.sp.freq_GHz[pk.idx],
                             "peak_Jy": pk.value, "snr": pk.snr, "fit_ok": f.get("ok"),
                             "center_GHz": f.get("center_GHz"), "center_err_MHz": f.get("center_err_MHz"),
                             "fwhm_kms": f.get("fwhm_kms"), "amp_Jy": f.get("amp_Jy"),
                             "area_Jy_kms": f.get("area_Jy_kms"), "area_err_Jy_kms": f.get("area_err_Jy_kms"),
                             "baseline_Jy": f.get("baseline_Jy"),
                             "resid_max_sigma": pk.model.get("resid_max_sigma"),
                             "resid_asimetrico": pk.model.get("resid_asym"),
                             "absorcion_adyacente": pk.model.get("adjacent_opposite"),
                             "amp_degenerada": pk.model.get("amp_degenerate"),
                             "flags": ";".join(pk.flags), "n_candidatos": len(pk.candidates),
                             "candidatos_top": " | ".join(top)})
            pd.DataFrame(rows).to_csv(OUT / f"peaks_{w}_{p}.csv", index=False, float_format="%.6g")
    json.dump(peaks_js, open(WEB / "peaks.json", "w"), ensure_ascii=False, separators=(",", ":"))

    # ---- species_scores.json + CSV
    sc_js: dict[str, dict[str, Any]] = {}
    rows = []
    for p in POSITIONS:
        sc_js[p] = {}
        for s, sr in sorted(scores[p].items(), key=lambda kv: -kv[1].score):
            sc_js[p][s] = {"n_predicted": sr.n_predicted, "n_matched": sr.n_matched,
                           "n_missing_strong": sr.n_missing_strong,
                           "v_mean_kms": r(sr.v_mean, 3), "v_std_kms": r(sr.v_std, 3),
                           "score": r(sr.score, 3), "verdict": sr.verdict,
                           "n_detectable": sr.n_detectable, "n_ambiguous": sr.n_ambiguous,
                           "n_clean": sr.n_clean, "n_overbright": sr.n_overbright,
                           "completeness": r(sr.completeness, 3), "quality": r(sr.quality, 3),
                           "v_offset_kms": r(sr.v_offset, 3), "coherent": sr.coherent,
                           "n_excluded_unc": sr.n_excluded_unc,
                           "v_best_kms": r(sr.v_best, 3), "fap": float(f"{sr.fap:.3g}"),
                           "v_search_kms": [r(sr.v_range[0], 3), r(sr.v_range[1], 3)],
                           "v_best_free_kms": r(sr.v_best_free, 3), "n_matched_free": sr.n_matched_free,
                           "lines": sr.lines}
            rows.append({"posicion": p, "especie": s, "n_predicted": sr.n_predicted,
                         "n_detectable": sr.n_detectable, "n_matched": sr.n_matched,
                         "n_missing_strong": sr.n_missing_strong, "n_ambiguous": sr.n_ambiguous,
                         "n_clean": sr.n_clean, "n_overbright": sr.n_overbright,
                         "n_filas_excluidas_unc": sr.n_excluded_unc, "v_best_kms": sr.v_best,
                         "v_mean_kms": sr.v_mean, "v_std_kms": sr.v_std, "p_azar": sr.p_chance,
                         "fap": sr.fap, "completitud": sr.completeness, "calidad": sr.quality,
                         "dv_sistemica_kms": sr.v_offset, "coherente": sr.coherent,
                         "score": sr.score,
                         "v_busqueda": f"{sr.v_range[0]:.2f}..{sr.v_range[1]:.2f}",
                         "v_libre_kms": sr.v_best_free, "n_matched_libre": sr.n_matched_free,
                         "fap_libre": sr.fap_free,
                         "verdict": sr.verdict})
    json.dump(sc_js, open(WEB / "species_scores.json", "w"), ensure_ascii=False, separators=(",", ":"))
    pd.DataFrame(rows).to_csv(OUT / "species_scores.csv", index=False, float_format="%.4g")

    # ---- spectra.json: sólo se reemplaza el bloque noise
    spec_path = WEB / "spectra.json"
    spec = json.load(open(spec_path))
    for w in WINDOWS:
        for p in POSITIONS:
            nz = res[p][w].noise
            spec[w]["noise"][p] = {
                "sigma_Jy": round(nz.sigma, 5),
                "segments_GHz": [[round(a, 6), round(b, 6)] for a, b in nz.segments_GHz],
                "method": nz.method,
            }
    json.dump(spec, open(spec_path, "w"), separators=(",", ":"))

    # ---- pipeline_meta.json (velocidades adoptadas, ruido detallado, umbrales)
    meta = {
        "generated_by": "analysis/pipeline.py",
        "v_adopted": v_adopt,
        "v_crosscheck_ccf": ccf or {},
        "absorption_vs_emission": absd or {},
        "fwhm_typ_kms": {p: round(v, 3) for p, v in fwhm_typ.items()},
        "noise": {w: {p: {"sigma_Jy": round(res[p][w].noise.sigma, 5),
                          "baseline_Jy": round(res[p][w].noise.baseline, 5),
                          "sigma_lower_envelope_Jy": round(res[p][w].noise.sigma_lower_envelope, 5),
                          "segment_rms_Jy": [round(x, 5) for x in res[p][w].noise.seg_rms],
                          "rho_lag1_3": [round(x, 3) for x in res[p][w].noise.rho],
                          "kappa": round(res[p][w].noise.kappa, 3),
                          "n_emission": sum(pk.kind == "emission" for pk in res[p][w].peaks),
                          "n_absorption": sum(pk.kind == "absorption" for pk in res[p][w].peaks)}
                      for p in POSITIONS} for w in WINDOWS},
        "config": {k: (list(v) if isinstance(v, tuple) else v) for k, v in cfg.__dict__.items()},
    }
    json.dump(meta, open(WEB / "pipeline_meta.json", "w"), ensure_ascii=False, indent=1)
    pd.DataFrame([{"posicion": p, **v} for p, v in v_adopt.items()]).to_csv(
        OUT / "velocidades_adoptadas.csv", index=False)
    noise_rows = [{"ventana": w, "posicion": p, "sigma_Jy": res[p][w].noise.sigma,
                   "baseline_Jy": res[p][w].noise.baseline,
                   "sigma0_envolvente_Jy": res[p][w].noise.sigma_lower_envelope,
                   "rho1": res[p][w].noise.rho[0], "kappa": res[p][w].noise.kappa,
                   "segmentos_GHz": "; ".join(f"{a:.5f}-{b:.5f}" for a, b in res[p][w].noise.segments_GHz),
                   "rms_por_segmento": "; ".join(f"{x:.4f}" for x in res[p][w].noise.seg_rms)}
                  for w in WINDOWS for p in POSITIONS]
    pd.DataFrame(noise_rows).to_csv(OUT / "ruido.csv", index=False, float_format="%.5g")

    write_evidence(res, scores, cat)
    write_unidentified(res, v_adopt, fwhm_typ, cfg)


def write_unidentified(res: dict[str, dict[str, WinPos]], v_adopt: dict[str, dict[str, Any]],
                       fwhm_typ: dict[str, float], cfg: Config, min_snr: float = 10.0) -> None:
    """Picos de emisión con SNR >= 10 SIN ninguna transición del catálogo local dentro de la
    tolerancia max(2 canales, 0.5 FWHM_típico, 3 unc) a la velocidad adoptada: evidencia de que
    el catálogo local no agota los portadores (consultar CDMS/JPL completos)."""
    rows = []
    for p in POSITIONS:
        for w in WINDOWS:
            wp = res[p][w]
            for pk in wp.peaks:
                if pk.kind != "emission" or pk.snr < min_snr:
                    continue
                nu = wp.center_MHz(pk)
                near = [c for c in pk.candidates if abs(c["delta_MHz"]) <= max(
                    cfg.tol_min_ch * wp.sp.dnu_MHz, 0.5 * fwhm_typ[p] / C_KMS * nu,
                    cfg.tol_unc_factor * (c["unc_MHz"] or 0.0))]
                if near:
                    continue
                nearest = pk.candidates[0] if pk.candidates else None
                rows.append({"posicion": p, "ventana": w, "id": pk.id,
                             "freq_LSRK_MHz": round(nu, 3),
                             "freq_reposo_MHz_a_v_adoptada": round(nu / (1 - v_adopt[p]["v_kms"] / C_KMS), 3),
                             "snr": round(pk.snr, 1), "amp_Jy": r(wp.amp(pk), 3),
                             "fwhm_kms": r(pk.fit.get("fwhm_kms"), 2), "flags": ";".join(pk.flags),
                             "candidato_mas_cercano": (f"{nearest['species']} {nearest['rest_MHz']:.3f} "
                                                       f"(Δ={nearest['delta_MHz']:+.2f} MHz)") if nearest else ""})
    pd.DataFrame(rows).sort_values(["posicion", "snr"], ascending=[True, False]).to_csv(
        OUT / "sin_identificar.csv", index=False)


def fname(species: str) -> str:
    """Nombre de especie apto para archivo: CH2(OH)CHO -> CH2OHCHO."""
    return "".join(ch for ch in species if ch.isalnum() or ch in "-_")


def write_evidence(res: dict[str, dict[str, WinPos]], scores: dict[str, dict[str, SpeciesResult]],
                   cat: pd.DataFrame) -> None:
    """Borrador de evidencia_plantilla.csv: una fila por rasgo coincidente de especies
    con veredicto fuerte/tentativa."""
    cols = list(pd.read_csv(DATA / "evidencia_plantilla.csv", nrows=0).columns)
    rows = []
    for p in POSITIONS:
        strong_by_sp = {s: {ln["catalog_id"] for ln in sr.lines} for s, sr in scores[p].items()}
        for s, sr in sorted(scores[p].items(), key=lambda kv: -kv[1].score):
            if sr.verdict not in ("fuerte", "tentativa"):
                continue
            for ln in sr.lines:
                if ln["status"] != "matched":
                    continue
                w = ln["window"]
                wpos = res[p][w]
                pk = next(q for q in wpos.peaks if q.id == ln["peak_id"])
                lead = cat.iloc[ln["catalog_id"]]
                v = ln["v_kms"]
                alts = []
                for c in pk.candidates:
                    if c["species"] == s or c["catalog_id"] not in strong_by_sp.get(c["species"], set()):
                        continue
                    tol = max(2 * wpos.sp.dnu_MHz, 0.5 * (pk.fit.get("fwhm_kms") or 1.0) / C_KMS * c["rest_MHz"],
                              3 * c["unc_MHz"])
                    if abs(c["delta_MHz"]) <= tol:
                        alts.append(f"{c['species']} {c['rest_MHz']:.3f} (Δ={c['delta_MHz']:+.2f} MHz)")
                f = pk.fit
                mezcla = [fl for fl in pk.flags if fl == "blend"]
                mezcla += [f"confusión con {o}" for o in ln.get("confused_with", [])]
                if ln.get("adjacent_absorption"):
                    mezcla.append("absorción adyacente (perfil P-Cygni inverso)")
                elif "asymmetric" in pk.flags:
                    mezcla.append("asimétrica")
                rows.append({
                    "equipo": "", "hipotesis": f"{s} en {p}",
                    "especie": s, "catalogo": lead.catalogo, "entrada": str(lead.entrada).zfill(6),
                    "frecuencia_reposo_MHz": ln["rest_MHz"], "ventana": w, "posicion": p,
                    "frecuencia_pico_LSRK_MHz": round(wpos.center_MHz(pk), 4),
                    "v_radio_kms": v, "FWHM_kms": r(f.get("fwhm_kms"), 3),
                    "baseline_Jy_beam": r(f.get("baseline_Jy"), 4),
                    "sigma_Jy_beam": round(wpos.noise.sigma, 4), "SNR": r(pk.snr, 2),
                    "area_Jy_beam_kms": r(f.get("area_Jy_kms"), 4),
                    "metodo_incertidumbre": (f"σ de {len(wpos.noise.segments_GHz)} segmentos libres; "
                                             f"error formal del ajuste ×√κ (κ={wpos.noise.kappa:.2f}); "
                                             f"σ_área={r(f.get('area_err_Jy_kms'), 4)} Jy/beam·km/s; "
                                             f"σ_ν={r(f.get('center_err_MHz'), 4)} MHz; "
                                             f"unc_cat={cat.iloc[ln['catalog_id']].incertidumbre_MHz} MHz"),
                    "grupo_rasgo": "+".join(str(i) for i in ln["grouped_ids"]),
                    "mezcla": ("sí: " + "; ".join(mezcla)) if mezcla else ("posible" if alts else "no"),
                    "alternativas": "; ".join(alts),
                    "decision": sr.verdict,
                    "archivo_figura": f"analysis/outputs/figuras/huella_{p}_{fname(s)}.png",
                })
    pd.DataFrame(rows, columns=cols).to_csv(OUT / "evidencia_borrador.csv", index=False)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--no-figures", action="store_true", help="omite las figuras PNG")
    args = ap.parse_args()
    run(make_figures=not args.no_figures)


if __name__ == "__main__":
    main()

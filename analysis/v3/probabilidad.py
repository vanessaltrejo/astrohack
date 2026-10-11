"""T3 · Motor v3: probabilidad por línea de qué molécula la produce.

Datos crudos (sin limpiar ni suavizar). Única transformación: observado -> reposo con la velocidad DADA
(B 2.7 km/s, A 3.2 km/s; Guía p. 8 y diapositiva 22).

  P(s | pico) ∝ L_frecuencia · L_Einstein · L_repeticion · Prior_complejidad · Prior_espacio · Factor_entorno

más la opción "fuera del catálogo". Todos los parámetros están en PARAM (se copian a la salida).

Uso:  .venv/bin/python analysis/v3/probabilidad.py            (universo completo)
Salida: analysis/v3/outputs/probabilidad_{pos}.csv (pico × candidata), picos_{pos}.csv, resumen_especies.csv,
        web/public/data/probabilidad.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.ndimage import median_filter
from scipy.optimize import curve_fit
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "outputs"
C = 299792.458  # km/s

PARAM = dict(
    v_kms={"B_offset": 2.7, "B_pico": 2.7, "A": 3.2},   # dadas por los organizadores
    snr_pico=4.0, prominencia_sigma=3.0, distancia_canales=3,
    sigma_v_kms=0.5,            # tolerancia por movimiento interno del gas (≈ media FWHM típica en B)
    unc_defecto_MHz=0.1,        # incertidumbre de catálogo cuando la fuente no la da (Splatalogue)
    unc_max_MHz=1.0,            # filas con incertidumbre > 1 MHz (~4 canales) no son identificables: se excluyen
    ventana_sigma=3.0,          # candidatas hasta 3σ en frecuencia
    T_K=150.0,                  # temperatura para S = g_u·Aij·exp(−Eu/T)
    fuertes_dex=1.5,            # "línea fuerte" = S dentro de 1.5 dex de la más fuerte de la especie en banda
    agrupar_canales=2.0,        # filas a < 2 canales = un solo rasgo no resuelto (Guía p. 7)
    sigma_log_intensidad=0.5,   # dex: tolerancia entre altura observada y predicha
    E_ref_K=500.0, T_pob_K=300.0,  # población: niveles con Eu > 500 K se castigan como exp(−(Eu−500)/300)
    rep_no_comprobable=0.5,     # L_repeticion si la especie tiene 1 sola línea fuerte en banda
    prior_espacio={"detectada": 1.0, "tentativa": 0.5, "no detectada": 0.1, "cuestionada": 0.1},
    # "fuera del catálogo" = candidata hipotética a 2σ, L_E 0.5, L_rep 0.5, complejidad 0.1, vista, entorno 1
    eps_fuera=float(np.exp(-2.0) * 0.5 * 0.5 * 0.1),
)

LOC2CENSO = {"CH3OH": "CH3OH", "13CH3OH": "CH3OH", "CH2DOH": "CH3OH", "CH3CN": "CH3CN", "NH2CHO": "NH2CHO",
             "CH3CHO": "CH3CHO", "CH3OCHO": "HC(O)OCH3", "CH2(OH)CHO": "CH2OHCHO", "C2H5OH": "CH3CH2OH",
             "CH3OCH3": "(CH3)2O", "C2H5CN": "CH3CH2CN", "SO2": "SO2", "Glycine-I": None}


# ----------------------------------------------------------------------------- carga
def cargar():
    esp = {i: pd.read_csv(ROOT / f"data/espectros/W{i}_espectros.csv") for i in (1, 2)}
    cat = pd.read_csv(ROOT / "data/externos/catalogo_ampliado.csv")
    cen = pd.read_csv(ROOT / "data/externos/censo_cdms_2026-09.csv")
    fichas = json.loads((ROOT / "data/externos/fichas_moleculas.json").read_text())
    return esp, cat, cen, fichas, None      # el ruido se estima aquí mismo (estimar_ruido)


def ruido_empirico(f, y, intervalos):
    """Igual que el cuaderno oficial: desviación estándar de segmentos sin líneas, mediana restada."""
    piezas = [y[(f >= lo) & (f <= hi)] - np.median(y[(f >= lo) & (f <= hi)]) for lo, hi in intervalos]
    return float(np.std(np.concatenate(piezas), ddof=1))


def sigma_envolvente(y, w=25, paso=5, pct=25):
    """σ0: percentil 25 del rms local (ventanas de 25 canales, tendencia lineal restada)."""
    x = np.arange(w); r = []
    for a in range(0, len(y) - w + 1, paso):
        z = y[a:a + w]; r.append(np.std(z - np.polyval(np.polyfit(x, z, 1), x), ddof=2))
    return float(np.percentile(r, pct)), np.array(r)


def tramos_libres(y, dilat, min_ch, nsig=3.0, win=151, nmax=6):
    """Los `nmax` tramos más largos sin líneas: |y − base| ≤ nsig·σ0, máscara dilatada ±dilat canales."""
    s0, _ = sigma_envolvente(y)
    b = y - median_filter(y, size=win, mode="nearest")
    m = np.convolve((np.abs(b - np.median(b)) > nsig * s0).astype(float), np.ones(2 * dilat + 1), mode="same") > 0
    runs, i = [], 0
    while i < len(y):
        if m[i]:
            i += 1; continue
        j = i
        while j < len(y) and not m[j]:
            j += 1
        if j - i >= min_ch:
            runs.append((i, j - 1))
        i = j
    return sorted(sorted(runs, key=lambda r: r[0] - r[1])[:nmax])


def estimar_ruido(f, y, pos):
    """σ y línea base. B: desviación estándar de tramos sin líneas (línea base lineal por tramo, como pide la
    Guía p. 8: se indica intervalo y método). A: casi no tiene tramos libres (líneas de ~6 km/s) → σ0 de envolvente."""
    s0, r = sigma_envolvente(y)
    if pos == "A":
        w = 25; x = np.arange(w)
        libres = [a for a, rr in zip(range(0, len(y) - w + 1, 5), r) if rr <= 1.2 * s0]
        base = float(np.median([np.median(y[a:a + w]) for a in libres])) if libres else float(np.median(y))
        return dict(sigma=s0, baseline=base, segmentos=[],
                    metodo="envolvente inferior (percentil 25 del rms local en ventanas de 25 canales): A casi no tiene tramos libres")
    runs = tramos_libres(y, dilat=6, min_ch=15)
    res, dof = [], 0
    for a, b in runs:
        z = y[a:b + 1]; x = np.arange(len(z))
        res.append(z - np.polyval(np.polyfit(x, z, 1), x)); dof += len(z) - 2
    sig = float(np.sqrt(np.sum(np.concatenate(res) ** 2) / dof))
    base = float(np.mean([np.median(y[a:b + 1]) for a, b in runs]))
    return dict(sigma=sig, baseline=base, segmentos=[(float(f[a]), float(f[b])) for a, b in runs],
                metodo=f"desviación estándar de {len(runs)} tramos sin líneas (línea base lineal por tramo; "
                       f"máscara 3σ0 dilatada ±6 canales)")


def ajustar_pico(f_GHz, y, canal, sigma, ancho_ch):
    """Ajuste gaussiano + constante en velocidad alrededor del pico (misma forma que `ajustar` del cuaderno
    oficial; descriptivo, no identifica la molécula). Errores formales: no incluyen correlación de canales."""
    n = len(y); lo, hi = max(0, canal - ancho_ch), min(n, canal + ancho_ch + 1)
    f0 = f_GHz[canal]
    x = C * (1 - f_GHz[lo:hi] / f0); z = y[lo:hi]
    if len(x) < 9:
        return dict(ok=False)
    base = float(np.median(z)); amp = float(z.max() - base)
    sd_max = 8.0 if ancho_ch > 20 else 3.0
    try:
        par, cov = curve_fit(lambda t, a, mu, sd, b: b + a * np.exp(-.5 * ((t - mu) / sd) ** 2), x, z,
                             p0=[max(amp, 1e-3), float(x[np.argmax(z)]), min(0.5, sd_max / 2), base],
                             bounds=([0, x.min(), .1, -np.inf], [np.inf, x.max(), sd_max, np.inf]))
    except Exception:
        return dict(ok=False)
    a, mu, sd, b = par
    res = z - (b + a * np.exp(-.5 * ((x - mu) / sd) ** 2))
    core = np.abs(x - mu) <= 2.355 * sd
    err = np.sqrt(np.diag(cov))
    return dict(ok=True, centro_GHz=float(f0 * (1 - mu / C)), fwhm_kms=float(2.35482 * sd), amp_Jy=float(a),
                area_Jy_kms=float(a * sd * np.sqrt(2 * np.pi)), baseline_Jy=float(b),
                centro_err_MHz=float(err[1] * f0 * 1000 / C),
                blend=bool(core.any() and np.abs(res[core]).max() > max(4 * sigma, 0.1 * a)))


def preparar_catalogo(cat, cen, fichas):
    cat = cat.copy()
    cat = cat[cat.log10_Aij.notna()].copy()
    cat["unc"] = cat.incertidumbre_MHz.fillna(PARAM["unc_defecto_MHz"])
    cat = cat[cat.unc <= PARAM["unc_max_MHz"]].copy()
    cat["S"] = cat.g_superior * 10 ** cat.log10_Aij * np.exp(-cat.E_superior_K / PARAM["T_K"])
    # complejidad: fracción del censo (348) con ese nº de átomos
    cuenta = cen[cen.cuenta_en_348].n_atomos.astype(str).value_counts()
    def bin_(n):
        n = str(n)
        return ">12" if n.isdigit() and int(n) > 12 else n
    cat["bin_atomos"] = cat.n_atomos.map(bin_)
    cat["prior_complejidad"] = cat.bin_atomos.map(lambda b: cuenta.get(b, 0) / 348)
    cat["prior_espacio"] = cat.visto_en_espacio.map(PARAM["prior_espacio"])
    # Isotopólogos (13C, D, 18O...) que NO están en el catálogo oficial: que la molécula madre se haya visto no
    # significa que esa variante rara se haya visto -> se tratan como no confirmados.
    iso_ext = (cat.isotopologo == True) & (cat.origen != "catalogo_local_oficial")  # noqa: E712
    cat.loc[iso_ext, "prior_espacio"] = PARAM["prior_espacio"]["no detectada"]
    cat.loc[iso_ext, "visto_en_espacio"] = "isotopólogo no confirmado"
    # entorno: ficha por fórmula del censo; las demás por nombre químico
    por_formula = {f["formula"]: f["factor_entorno"] for f in fichas}
    por_nombre = {f["nombre"]: f["factor_entorno"] for f in fichas if not f["en_censo"]}
    def ent(r):
        if isinstance(r.formula_censo, str):
            return por_formula.get(r.formula_censo, 0.5)
        if r.especie == "Glycine-I" or r.nombre_quimico == "Glycine":
            return por_formula.get("Glycine", 1.0)
        return por_nombre.get(r.nombre_quimico, 0.5)
    cat["factor_entorno"] = cat.apply(ent, axis=1)
    cat["molecula"] = cat.formula_censo.fillna(cat.nombre_quimico.replace({"Glycine-I": "Glycine"}))
    # id de fila en catalog.json (las 348 oficiales ocupan 0..347 en el mismo orden); -1 = especie ampliada
    cat["catalog_id"] = np.where(cat.origen == "catalogo_local_oficial", cat.index, -1)
    return cat


# ----------------------------------------------------------------------------- picos
def detectar(f, y, sigma):
    idx, _ = find_peaks(y, height=PARAM["snr_pico"] * sigma, prominence=PARAM["prominencia_sigma"] * sigma,
                        distance=PARAM["distancia_canales"])
    ida, _ = find_peaks(-y, height=PARAM["snr_pico"] * sigma, prominence=PARAM["prominencia_sigma"] * sigma,
                        distance=PARAM["distancia_canales"])
    em = pd.DataFrame(dict(canal=idx, tipo="emision"))
    ab = pd.DataFrame(dict(canal=ida, tipo="absorcion"))
    p = pd.concat([em, ab]).sort_values("canal").reset_index(drop=True)
    p["nu_obs_MHz"] = f[p.canal] * 1000
    p["Jy"] = y[p.canal]
    p["snr"] = np.abs(p.Jy) / sigma
    return p


def sigma_nu(nu_MHz, unc, dch_MHz):
    return np.sqrt((dch_MHz / 2) ** 2 + unc ** 2 + (nu_MHz * PARAM["sigma_v_kms"] / C) ** 2)


# ----------------------------------------------------------------------------- motor
NOISE: dict = {}   # (pos, ventana) -> dict(sigma, baseline, segmentos, metodo), lo llena analizar()


def analizar(pos, esp, cat, ruido=None, universo=None):
    """universo: conjunto de valores de `especie` permitidos (None = todas)."""
    v = PARAM["v_kms"][pos]
    if universo is not None:
        cat = cat[cat.especie.isin(universo)]
    picos, filas = [], []
    rangos_reposo = {}
    for i in (1, 2):
        d = esp[i]; f = d.frecuencia_LSRK_GHz.to_numpy(); y = d[f"{pos}_Jy_beam"].to_numpy()
        rz = estimar_ruido(f, y, pos)
        sig = rz["sigma"]
        p = detectar(f, y, sig)
        p["ventana"] = f"W{i}"; p["sigma_Jy"] = sig
        ancho = 60 if pos == "A" else 12
        fits = [ajustar_pico(f, y, int(c), sig, ancho) if t == "emision" else dict(ok=False)
                for c, t in zip(p.canal, p.tipo)]
        p["fit_ok"] = [x["ok"] for x in fits]
        for k in ["centro_GHz", "fwhm_kms", "amp_Jy", "area_Jy_kms", "baseline_Jy", "centro_err_MHz"]:
            p[k] = [x.get(k, np.nan) for x in fits]
        p["blend"] = [bool(x.get("blend", False)) for x in fits]
        NOISE[(pos, f"W{i}")] = rz
        p["nu_reposo_MHz"] = p.nu_obs_MHz / (1 - v / C)          # el único paso sobre los datos
        p["id"] = [f"{pos}-W{i}-{k:03d}" for k in range(len(p))]
        picos.append(p)
        rangos_reposo[f"W{i}"] = (f.min() * 1000 / (1 - v / C), f.max() * 1000 / (1 - v / C), f, y, sig)
    P = pd.concat(picos, ignore_index=True)
    dch = 0.24413
    em = P[P.tipo == "emision"]

    # --- rasgos fuertes por especie (agrupados) y su presencia -> repetición y escala de intensidad
    especie_info = {}
    for sp_, g in cat.groupby("especie"):
        g = g[[any(lo <= nu <= hi for lo, hi, *_ in rangos_reposo.values()) for nu in g.frecuencia_reposo_MHz]]
        if g.empty:
            continue
        g = g.sort_values("frecuencia_reposo_MHz")
        grupo = (g.frecuencia_reposo_MHz.diff().fillna(1e9) > PARAM["agrupar_canales"] * dch).cumsum()
        R = g.groupby(grupo).agg(nu=("frecuencia_reposo_MHz", lambda x: np.average(x, weights=g.loc[x.index, "S"]) if g.loc[x.index, "S"].sum() > 0 else x.mean()),
                                 S=("S", "sum"), unc=("unc", "max"))
        Smax = R.S.max()
        fuertes = R[R.S >= Smax / 10 ** PARAM["fuertes_dex"]].copy()
        pres, ratios = [], []
        for r in fuertes.itertuples():
            sn = sigma_nu(r.nu, r.unc, dch)
            cerca = em[np.abs(em.nu_reposo_MHz - r.nu) <= 2 * sn]
            if len(cerca):
                k = cerca.Jy.idxmax(); pres.append(P.loc[k, "id"]); ratios.append(P.loc[k, "Jy"] / r.S)
            else:
                pres.append(None)
        fuertes["pico"] = pres
        especie_info[sp_] = dict(R=R, Smax=Smax, fuertes=fuertes,
                                 ratios=dict(zip([x for x in pres if x], ratios)))

    # --- candidatas por pico
    for p in em.itertuples():
        win = cat[np.abs(cat.frecuencia_reposo_MHz - p.nu_reposo_MHz) <= PARAM["ventana_sigma"] *
                  sigma_nu(p.nu_reposo_MHz, cat.unc, dch)]
        for sp_, g in win.groupby("especie"):
            info = especie_info.get(sp_)
            if info is None:
                continue
            sn = sigma_nu(g.frecuencia_reposo_MHz, g.unc, dch)
            # densidad normalizada: a igual z, un σ grande (catálogo impreciso) vale menos
            sn0 = sigma_nu(p.nu_reposo_MHz, 0.0, dch)
            lf = np.exp(-0.5 * ((g.frecuencia_reposo_MHz - p.nu_reposo_MHz) / sn) ** 2) * (sn0 / sn)
            b = lf.idxmax()
            nu_b = g.loc[b, "frecuencia_reposo_MHz"]
            # rasgo no resuelto: filas de la especie a < 2 canales de la mejor
            grp = g[np.abs(g.frecuencia_reposo_MHz - nu_b) <= PARAM["agrupar_canales"] * dch]
            S_g = grp.S.sum()
            # Einstein: escala de la especie con OTRAS líneas presentes (deja fuera este pico)
            otros = [r for k, r in info["ratios"].items() if k != p.id]
            if otros and np.median(otros) * S_g > 0:
                pred = np.median(otros) * S_g
                L_E = float(np.exp(-0.5 * (np.log10(max(p.Jy, 1e-6) / pred) / PARAM["sigma_log_intensidad"]) ** 2))
                modo_E = "escala de otras líneas"
            else:
                rel = S_g / info["Smax"]
                L_E = float(min(1.0, rel * 10 ** PARAM["fuertes_dex"]))
                pred = np.nan; modo_E = "fuerza relativa en la especie"
            # población del nivel superior (Boltzmann): sin castigo hasta E_ref, después exp(−(Eu−E_ref)/T)
            L_pob = float(min(1.0, np.exp(-(g.loc[b, "E_superior_K"] - PARAM["E_ref_K"]) / PARAM["T_pob_K"])))
            L_E = L_E * L_pob
            F = info["fuertes"]
            n_f, n_p = len(F), int(F.pico.notna().sum())
            L_rep = PARAM["rep_no_comprobable"] if n_f < 2 else (n_p + 1) / (n_f + 2)
            r0 = g.loc[b]
            score = lf[b] * L_E * L_rep * r0.prior_complejidad * r0.prior_espacio * r0.factor_entorno
            filas.append(dict(
                pico=p.id, ventana=p.ventana, nu_obs_MHz=p.nu_obs_MHz, nu_reposo_MHz=p.nu_reposo_MHz,
                Jy=p.Jy, snr=p.snr, especie=sp_, molecula=r0.molecula, nombre_quimico=r0.nombre_quimico,
                origen=r0.origen, lista=r0.lista, tag=int(r0.tag), catalog_id=int(r0.catalog_id), unc_MHz=float(r0.unc),
                isotopologo=bool(r0.isotopologo), nu_cat_MHz=nu_b, delta_MHz=nu_b - p.nu_reposo_MHz,
                sigma_nu_MHz=sn[b], log10_Aij=r0.log10_Aij, Eu_K=r0.E_superior_K, QN=r0.QN,
                n_filas_rasgo=len(grp), L_frecuencia=lf[b], L_Einstein=L_E, modo_Einstein=modo_E, L_poblacion=L_pob,
                pico_predicho_Jy=pred, L_repeticion=L_rep, lineas_fuertes=n_f, lineas_presentes=n_p,
                n_atomos=r0.n_atomos, prior_complejidad=r0.prior_complejidad,
                visto_en_espacio=r0.visto_en_espacio, prior_espacio=r0.prior_espacio,
                factor_entorno=r0.factor_entorno, puntaje=score))
    Cd = pd.DataFrame(filas)
    fuera = pd.DataFrame(dict(pico=em.id, ventana=em.ventana, nu_obs_MHz=em.nu_obs_MHz,
                              nu_reposo_MHz=em.nu_reposo_MHz, Jy=em.Jy, snr=em.snr,
                              especie="(fuera del catálogo)", molecula="(fuera del catálogo)",
                              puntaje=PARAM["eps_fuera"]))
    Cd = pd.concat([Cd, fuera], ignore_index=True)
    Cd["P"] = Cd.puntaje / Cd.groupby("pico").puntaje.transform("sum")
    Cd = Cd.sort_values(["pico", "P"], ascending=[True, False])
    Cd["rango"] = Cd.groupby("pico").cumcount() + 1
    return P, Cd, especie_info


def resumen(Cd):
    top = Cd[Cd.rango == 1]
    r = top.groupby("molecula").agg(picos_ganados=("pico", "size"), P_media=("P", "mean")).reset_index()
    tot = Cd.groupby("molecula").P.sum().rename("P_acumulada").reset_index()
    return r.merge(tot, on="molecula", how="right").fillna({"picos_ganados": 0}).sort_values(
        ["picos_ganados", "P_acumulada"], ascending=False)


def _nan(x):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else x


def exportar_web(guardado, cat):
    """peaks.json (lista de picos del motor v3, mismo esquema de siempre) y bloque `noise` de spectra.json."""
    loc = pd.read_csv(ROOT / "data/catalogos/catalogo_local.csv")
    logI = loc.log10_I_300K_nm2_MHz.to_dict()
    peaks = {"W1": {}, "W2": {}}
    filas_ruido = []
    for pos, (P, Cd) in guardado.items():
        # sólo candidatas con P >= 0.10: un pico donde gana "fuera del catálogo" queda sin candidata (sin identificar)
        cand = Cd[(Cd.rango <= 3) & (Cd.especie != "(fuera del catálogo)") & (Cd.P >= 0.10)]
        por_pico = {k: g for k, g in cand.groupby("pico")}
        for w in ("W1", "W2"):
            lista = []
            for r in P[P.ventana == w].itertuples():
                flags = []
                if r.tipo == "absorcion":
                    flags.append("absorption")
                if r.snr < 5:
                    flags.append("weak")
                if r.canal < 10 or r.canal > 1907:
                    flags.append("edge")
                if r.blend:
                    flags.append("blend")
                fit = None
                if r.fit_ok:
                    fit = dict(ok=True, center_GHz=round(float(r.centro_GHz), 7), fwhm_kms=round(float(r.fwhm_kms), 3),
                               amp_Jy=round(float(r.amp_Jy), 4), area_Jy_kms=round(float(r.area_Jy_kms), 4),
                               baseline_Jy=round(float(r.baseline_Jy), 4),
                               center_err_MHz=round(float(r.centro_err_MHz), 4))
                else:
                    fit = dict(ok=False)
                cs = []
                g = por_pico.get(r.id)
                if g is not None and r.tipo == "emision":
                    for c in g.itertuples():
                        cs.append(dict(
                            catalog_id=int(c.catalog_id), species=c.especie, rest_MHz=round(float(c.nu_cat_MHz), 4),
                            v_kms=round(float(C * (1 - c.nu_obs_MHz / c.nu_cat_MHz)), 3),
                            delta_MHz=round(float(c.delta_MHz), 4), Eu_K=round(float(c.Eu_K), 1),
                            logI_300K=round(float(logI.get(int(c.catalog_id), 0.0)), 4) if c.catalog_id >= 0 else 0.0,
                            unc_MHz=round(float(c.unc_MHz), 4), P=round(float(c.P), 4)))
                lista.append(dict(id=r.id, freq_GHz=round(float(r.nu_obs_MHz) / 1000, 7), peak_Jy=round(float(r.Jy), 4),
                                  snr=round(float(r.snr), 1), fit=fit, flags=flags, candidates=cs))
            peaks[w][pos] = lista
    (ROOT / "web/public/data/peaks.json").write_text(json.dumps(peaks, ensure_ascii=False))

    sp_path = ROOT / "web/public/data/spectra.json"
    spectra = json.loads(sp_path.read_text())
    for (pos, w), rz in NOISE.items():
        spectra[w]["noise"][pos] = dict(sigma_Jy=round(rz["sigma"], 6), baseline_Jy=round(rz["baseline"], 6),
                                        segments_GHz=[[round(a, 6), round(b, 6)] for a, b in rz["segmentos"]],
                                        method=rz["metodo"])
        filas_ruido.append(dict(posicion=pos, ventana=w, sigma_mJy=round(rz["sigma"] * 1000, 2),
                                baseline_mJy=round(rz["baseline"] * 1000, 2), n_tramos=len(rz["segmentos"]),
                                tramos_GHz="; ".join(f"{a:.5f}-{b:.5f}" for a, b in rz["segmentos"]), metodo=rz["metodo"]))
    sp_path.write_text(json.dumps(spectra, ensure_ascii=False, separators=(",", ":")))
    pd.DataFrame(filas_ruido).to_csv(OUT / "ruido_v3.csv", index=False)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    esp, cat0, cen, fichas, ruido = cargar()
    cat = preparar_catalogo(cat0, cen, fichas)
    web = dict(parametros=PARAM, posiciones={})
    guardado = {}
    for pos in ["B_offset", "B_pico", "A"]:
        P, Cd, info = analizar(pos, esp, cat, ruido)
        guardado[pos] = (P, Cd)
        P.to_csv(OUT / f"picos_{pos}.csv", index=False)
        Cd.to_csv(OUT / f"probabilidad_{pos}.csv", index=False)
        R = resumen(Cd)
        R.to_csv(OUT / f"resumen_{pos}.csv", index=False)
        # líneas fuertes de cada especie y si aparecen (factor "se repite"): oficiales + ganadoras
        oficiales = set(cat[cat.origen == "catalogo_local_oficial"].especie)
        ganadoras = set(Cd[(Cd.rango == 1)].especie) - {"(fuera del catálogo)"}
        especies = {}
        for sp_ in sorted(oficiales | ganadoras):
            if sp_ not in info:
                continue
            F = info[sp_]["fuertes"]
            especies[sp_] = dict(
                n_fuertes=int(len(F)), n_presentes=int(F.pico.notna().sum()),
                fuertes=[dict(nu_reposo_MHz=round(float(r.nu), 4), S=float(r.S),
                              pico=(r.pico if isinstance(r.pico, str) else None)) for r in F.itertuples()])
        web["posiciones"][pos] = dict(
            picos=json.loads(P.to_json(orient="records")),
            candidatas=json.loads(Cd[Cd.rango <= 5].to_json(orient="records")),
            resumen=json.loads(R.head(30).to_json(orient="records")),
            especies=especies)
        n_em = (P.tipo == "emision").sum()
        print(f"\n=== {pos}: {n_em} picos de emisión, {(P.tipo == 'absorcion').sum()} absorciones, "
              f"σ W1/W2 = {P.groupby('ventana').sigma_Jy.first().round(4).to_dict()}")
        print(R.head(12).to_string(index=False))
    (ROOT / "web/public/data/probabilidad.json").write_text(json.dumps(web, ensure_ascii=False))
    exportar_web(guardado, cat)

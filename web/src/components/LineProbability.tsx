"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { PosKey, WinKey } from "@/lib/data";

type Cand = {
  pico: string;
  ventana: WinKey;
  nu_obs_MHz: number;
  nu_reposo_MHz: number;
  Jy: number;
  snr: number;
  especie: string;
  molecula: string;
  P: number;
  rango: number;
  delta_MHz?: number | null;
  sigma_nu_MHz?: number | null;
  L_frecuencia?: number | null;
  L_Einstein?: number | null;
  L_poblacion?: number | null;
  L_repeticion?: number | null;
  lineas_presentes?: number | null;
  lineas_fuertes?: number | null;
  prior_complejidad?: number | null;
  n_atomos?: string | null;
  visto_en_espacio?: string | null;
  prior_espacio?: number | null;
  factor_entorno?: number | null;
  log10_Aij?: number | null;
  Eu_K?: number | null;
  QN?: string | null;
  origen?: string | null;
  lista?: string | null;
  isotopologo?: boolean | null;
};
type Resumen = { molecula: string; picos_ganados: number; P_media: number | null; P_acumulada: number };
type Datos = {
  parametros: { v_kms: Record<PosKey, number> };
  posiciones: Record<PosKey, { candidatas: Cand[]; resumen: Resumen[] }>;
};

const FUERA = "(fuera del catálogo)";
const PALETA = ["var(--color-accent)", "var(--color-data)", "#a78bfa", "#f472b6", "#94a3b8"];
const n = (x: number | null | undefined, d = 2) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(d));

/** Probabilidad por línea (motor v3): para cada pico, qué moléculas lo explican y por qué. */
export default function LineProbability({
  active,
  win,
  setWin,
  onZoom,
}: {
  active: PosKey;
  win: WinKey;
  setWin: (w: WinKey) => void;
  onZoom: (w: WinKey, fGHz: number) => void;
}) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [orden, setOrden] = useState<"freq" | "snr">("snr");

  useEffect(() => {
    fetch("/data/probabilidad.json")
      .then((r) => r.json())
      .then(setDatos)
      .catch(() => setDatos(null));
  }, []);

  const picos = useMemo(() => {
    if (!datos) return [];
    const m = new Map<string, Cand[]>();
    for (const c of datos.posiciones[active]?.candidatas ?? []) {
      if (c.ventana !== win) continue;
      m.set(c.pico, [...(m.get(c.pico) ?? []), c]);
    }
    const arr = [...m.values()].map((cs) => cs.sort((a, b) => a.rango - b.rango));
    return arr.sort((a, b) => (orden === "snr" ? b[0].snr - a[0].snr : a[0].nu_obs_MHz - b[0].nu_obs_MHz));
  }, [datos, active, win, orden]);

  if (!datos) return <p className="caption">Cargando probabilidades (analysis/v3/probabilidad.py)…</p>;
  const resumen = (datos.posiciones[active]?.resumen ?? []).filter((r) => r.molecula !== FUERA && r.picos_ganados > 0).slice(0, 10);

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <p className="text-[0.88rem] text-ink-2">
          <span className="id text-ink">P(molécula | línea) ∝ frecuencia × Einstein × se repite × complejidad × visto en el espacio × entorno</span>
          . Datos crudos; única transformación observado → reposo con v = {datos.parametros.v_kms[active]} km/s (dada). La opción{" "}
          <i>fuera del catálogo</i> siempre compite. La decisión final es de quien analiza.
        </p>
        <div>
          <p className="text-[0.72rem] uppercase tracking-wide text-muted">Moléculas que más líneas explican ({active})</p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[0.84rem]">
            {resumen.map((r) => (
              <span key={r.molecula}>
                <span className="id text-ink">{r.molecula}</span> <span className="text-muted">{r.picos_ganados}</span>
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-[0.78rem]">
        {(["W1", "W2"] as WinKey[]).map((w) => (
          <button key={w} type="button" onClick={() => setWin(w)} className={`border px-2 py-0.5 ${win === w ? "border-accent text-ink" : "border-rule text-ink-2"}`}>
            {w}
          </button>
        ))}
        <span className="ml-3 text-muted">ordenar por</span>
        {(
          [
            ["snr", "S/N"],
            ["freq", "frecuencia"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setOrden(k)} className={`border px-2 py-0.5 ${orden === k ? "border-accent text-ink" : "border-rule text-ink-2"}`}>
            {l}
          </button>
        ))}
        <span className="ml-auto text-muted">{picos.length} picos de emisión</span>
      </div>

      <table className="w-full text-[0.82rem]">
        <thead className="text-left text-[0.7rem] uppercase tracking-wide text-muted">
          <tr className="border-b border-rule">
            <th className="w-6" />
            <th className="py-1.5">ν obs (GHz)</th>
            <th>ν reposo (MHz)</th>
            <th className="text-right">Jy/haz</th>
            <th className="pr-4 text-right">S/N</th>
            <th>probabilidad por molécula</th>
          </tr>
        </thead>
        <tbody>
          {picos.map((cs) => {
            const p = cs[0];
            const open = abierto === p.pico;
            return (
              <Fragment key={p.pico}>
                <tr className="cursor-pointer border-b border-rule hover:bg-plate-2" onClick={() => setAbierto(open ? null : p.pico)}>
                  <td className="text-muted">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  <td className="id py-1.5">
                    <button
                      type="button"
                      className="hover:text-accent"
                      title="Ver en el espectro"
                      onClick={(e) => {
                        e.stopPropagation();
                        onZoom(p.ventana, p.nu_obs_MHz / 1000);
                      }}
                    >
                      {(p.nu_obs_MHz / 1000).toFixed(5)}
                    </button>
                  </td>
                  <td className="id">{p.nu_reposo_MHz.toFixed(2)}</td>
                  <td className="text-right">{p.Jy.toFixed(2)}</td>
                  <td className="pr-4 text-right">{p.snr.toFixed(0)}</td>
                  <td className="py-1">
                    <div className="flex h-5 w-full overflow-hidden bg-plate">
                      {cs.map((c, i) => (
                        <div
                          key={c.especie}
                          title={`${c.especie}: ${(c.P * 100).toFixed(0)} %`}
                          style={{ width: `${c.P * 100}%`, background: c.especie === FUERA ? "repeating-linear-gradient(45deg,#334155 0 4px,#1e293b 4px 8px)" : PALETA[i] }}
                        />
                      ))}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[0.74rem] text-ink-2">
                      {cs.slice(0, 3).map((c, i) => (
                        <span key={c.especie}>
                          <span className="mr-1 inline-block h-2 w-2" style={{ background: c.especie === FUERA ? "#334155" : PALETA[i] }} />
                          {c.especie} <b className="text-ink">{(c.P * 100).toFixed(0)}%</b>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
                {open ? (
                  <tr className="border-b border-rule bg-plate">
                    <td />
                    <td colSpan={5} className="py-2">
                      <table className="w-full text-[0.76rem]">
                        <thead className="text-left text-muted">
                          <tr>
                            <th>candidata</th>
                            <th className="text-right">P</th>
                            <th className="text-right">Δν (MHz)</th>
                            <th className="text-right">frecuencia</th>
                            <th className="text-right">log Aij</th>
                            <th className="text-right">Eu (K)</th>
                            <th className="text-right">Einstein</th>
                            <th className="text-right">se repite</th>
                            <th className="text-right">átomos → complejidad</th>
                            <th className="text-right">visto en el espacio</th>
                            <th className="text-right">entorno</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cs.map((c) => (
                            <tr key={c.especie} className="border-t border-rule">
                              <td className="py-1">
                                <span className="id text-ink">{c.especie}</span>
                                {c.QN ? <span className="ml-2 text-muted">{c.QN}</span> : null}
                                {c.origen === "catalogo_local_oficial" ? <span className="ml-2 text-accent">catálogo oficial</span> : null}
                                {c.isotopologo ? (
                                  <span className="ml-2 text-data" title="Contiene un isótopo raro (13C, D, 18O…). Su forma principal es mucho más abundante: si aparece sola esta, desconfía.">
                                    isotopólogo
                                  </span>
                                ) : null}
                              </td>
                              <td className="text-right font-semibold">{(c.P * 100).toFixed(1)}%</td>
                              {c.especie === FUERA ? (
                                <td colSpan={9} className="text-muted">
                                  ninguna transición del catálogo explica mejor la línea que una candidata mediocre de referencia
                                </td>
                              ) : (
                                <>
                                  <td className="text-right">{n(c.delta_MHz, 3)}</td>
                                  <td className="text-right">{n(c.L_frecuencia)}</td>
                                  <td className="text-right">{n(c.log10_Aij)}</td>
                                  <td className="text-right">{n(c.Eu_K, 0)}</td>
                                  <td className="text-right" title={`población ${n(c.L_poblacion)}`}>
                                    {n(c.L_Einstein)}
                                  </td>
                                  <td className="text-right" title="líneas fuertes presentes / esperadas en W1+W2">
                                    {n(c.L_repeticion)} ({c.lineas_presentes}/{c.lineas_fuertes})
                                  </td>
                                  <td className="text-right">
                                    {c.n_atomos} → {n(c.prior_complejidad, 3)}
                                  </td>
                                  <td className="text-right">
                                    {c.visto_en_espacio} → {n(c.prior_espacio, 1)}
                                  </td>
                                  <td className="text-right">{n(c.factor_entorno, 1)}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

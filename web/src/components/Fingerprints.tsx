"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import type { CatalogLine, LineStatus, Meta, PosKey, ScoreLine, SpeciesScore, SpeciesScores, Spectra, WinKey } from "@/lib/data";
import { lineStatus, WINDOW_KEYS } from "@/lib/data";
import { FP_MAX_PANELS, FP_VMAX, FP_VMIN, POSITION_LABELS, STRONG_DEX } from "@/lib/config";
import { speciesInfo } from "@/lib/species";
import { observedFreqGHz, paddedRange, sliceVelocity, strongLines, windowForFreq, type Slice } from "@/lib/spectro";
import { f } from "@/lib/format";
import { Pending, STATUS, StatusTag, VerdictBadge } from "./ui";

interface PanelLine {
  cat: CatalogLine;
  win: WinKey | null;
  status: LineStatus | null;
  sl: ScoreLine | null;
  slice: Slice | null;
}

export interface FingerprintsProps {
  meta: Meta;
  spectra: Spectra;
  catalog: CatalogLine[];
  catalogById: Map<number, CatalogLine>;
  speciesKeys: string[];
  scores: SpeciesScores | null;
  scoresState: "ok" | "missing" | "error";
  active: PosKey;
  fpSpecies: string;
  setFpSpecies: (s: string) => void;
  vControl: number;
  onZoomLine: (win: WinKey, freqGHz: number) => void;
  onLogLine: (line: CatalogLine, win: WinKey | null, peakId: string | null) => void;
  onShowInSpectrum: (species: string, v: number) => void;
}

export default function Fingerprints(p: FingerprintsProps) {
  const [sharedY, setSharedY] = useState(true);
  const posScores = p.scores?.[p.active] ?? null;
  const score: SpeciesScore | null = posScores?.[p.fpSpecies] ?? null;
  const info = speciesInfo(p.fpSpecies);

  const vAdopt = score?.v_best_kms ?? score?.v_mean_kms ?? null;
  const vLine = vAdopt ?? p.vControl;
  const vSource = vAdopt !== null ? "pipeline" : "control";

  const axes = useMemo(
    () => ({ W1: p.spectra.W1.freq_GHz, W2: p.spectra.W2.freq_GHz }) as Record<WinKey, number[]>,
    [p.spectra],
  );

  const panels = useMemo<PanelLine[]>(() => {
    let base: { cat: CatalogLine; sl: ScoreLine | null }[];
    if (score) {
      base = score.lines
        .map((sl) => ({ cat: p.catalogById.get(sl.catalog_id), sl }))
        .filter((x): x is { cat: CatalogLine; sl: ScoreLine } => !!x.cat);
    } else {
      const ls = p.catalog.filter(
        (l) => l.species === p.fpSpecies && windowForFreq(axes, observedFreqGHz(l.rest_MHz, vLine)) !== null,
      );
      base = strongLines(ls, STRONG_DEX)
        .sort((a, b) => b.logI_300K - a.logI_300K)
        .slice(0, FP_MAX_PANELS)
        .map((cat) => ({ cat, sl: null }));
    }
    base.sort((a, b) => a.cat.rest_MHz - b.cat.rest_MHz);
    return base.slice(0, FP_MAX_PANELS).map(({ cat, sl }) => {
      const w =
        (sl?.window && WINDOW_KEYS.includes(sl.window) ? sl.window : null) ??
        windowForFreq(axes, observedFreqGHz(cat.rest_MHz, vLine)) ??
        cat.window;
      const slice = w
        ? sliceVelocity(p.spectra[w].freq_GHz, p.spectra[w][p.active], cat.rest_MHz, FP_VMIN, FP_VMAX)
        : null;
      return { cat, win: w, status: sl ? lineStatus(sl) : null, sl, slice };
    });
  }, [score, p.catalog, p.catalogById, p.fpSpecies, p.spectra, p.active, axes, vLine]);

  const yShared = useMemo(
    () => paddedRange(panels.flatMap((x) => x.slice?.y ?? []), 0.1) ?? ([-0.1, 1] as [number, number]),
    [panels],
  );

  const ranked = useMemo(() => {
    if (!posScores) return [];
    return Object.entries(posScores).sort((a, b) => b[1].score - a[1].score || b[1].n_matched - a[1].n_matched);
  }, [posScores]);

  const statusCounts = useMemo(() => {
    const m = new Map<LineStatus, number>();
    for (const x of panels) if (x.status) m.set(x.status, (m.get(x.status) ?? 0) + 1);
    return m;
  }, [panels]);

  return (
    <div className="grid grid-cols-[minmax(27rem,30rem)_minmax(0,1fr)] gap-8">
      {/* marcador */}
      <div>
        <h3 className="mb-2 text-lg font-semibold">Marcador en {POSITION_LABELS[p.active]}</h3>
        {posScores ? (
          <div className="plate overflow-hidden">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Especie</th>
                  <th>Coinciden</th>
                  <th className="r">v̄ ± σ (km/s)</th>
                  <th>Veredicto</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(([sp, s]) => {
                  const si = speciesInfo(sp);
                  const sel = sp === p.fpSpecies;
                  const frac = s.n_predicted > 0 ? s.n_matched / s.n_predicted : 0;
                  return (
                    <tr
                      key={sp}
                      className="cursor-pointer"
                      aria-selected={sel}
                      tabIndex={0}
                      onClick={() => p.setFpSpecies(sp)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") p.setFpSpecies(sp);
                      }}
                      style={sel ? { background: "var(--color-plate-2)", boxShadow: `inset 3px 0 0 ${si.color}` } : undefined}
                    >
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: si.color }} />
                          <span className={sel ? "font-semibold text-ink" : "text-ink"}>{si.formula}</span>
                        </span>
                        <span className="block pl-[1.1rem] text-[0.72rem] text-muted">{si.name}</span>
                      </td>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="relative block h-[6px] w-14 flex-none rounded-full bg-rule" aria-hidden>
                            <span
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ width: `${frac * 100}%`, background: si.color }}
                            />
                          </span>
                          <span className="num">
                            {s.n_matched}/{s.n_predicted}
                          </span>
                        </span>
                        {s.n_missing_strong > 0 ? (
                          <span className="mt-0.5 block text-[0.72rem] text-ink-2">
                            <span style={{ color: "var(--color-critical)" }}>✕</span> {s.n_missing_strong} fuerte
                            {s.n_missing_strong > 1 ? "s" : ""} ausente{s.n_missing_strong > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="r num whitespace-nowrap">
                        {s.v_mean_kms !== null ? (
                          <>
                            {f(s.v_mean_kms, 2)}
                            <span className="text-muted"> ± {s.v_std_kms !== null ? f(s.v_std_kms, 2) : "—"}</span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <VerdictBadge verdict={s.verdict} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Pending what={p.scoresState === "error" ? "species_scores.json (con errores de lectura)" : "species_scores.json"}>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.speciesKeys.map((sp) => {
                const si = speciesInfo(sp);
                return (
                  <button key={sp} type="button" className="chip" aria-pressed={sp === p.fpSpecies} onClick={() => p.setFpSpecies(sp)}>
                    <span className="dot" style={{ background: si.color }} />
                    {si.formula}
                  </button>
                );
              })}
            </div>
          </Pending>
        )}
        <p className={`mt-3 text-xs text-muted ${posScores ? "" : "hidden"}`}>
          Ordenado por puntuación del pipeline (0–1). “Coinciden” cuenta las líneas fuertes predichas en W1+W2 con un pico a
          la velocidad común. Una línea fuerte ausente es evidencia en contra.
        </p>
      </div>

      {/* huellas */}
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <span className="h-3 w-3 rounded-[2px]" style={{ background: info.color }} />
              {info.formula}
              <span className="font-normal text-ink-2">{info.name}</span>
            </h3>
            <p className="text-sm text-ink-2">
              {panels.length} líneas {score ? "predichas por el pipeline" : `fuertes del catálogo (≤ ${STRONG_DEX} dex de la más intensa)`}
              , vistas en velocidad. Línea vertical: v = <span className="num">{f(vLine, 2)}</span> km/s (
              {vSource === "pipeline" ? "adoptada por el pipeline" : "control de velocidad"}).
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {score ? <VerdictBadge verdict={score.verdict} /> : null}
            <div className="seg" role="group" aria-label="Escala vertical">
              <button type="button" aria-pressed={sharedY} onClick={() => setSharedY(true)}>
                Escala común
              </button>
              <button type="button" aria-pressed={!sharedY} onClick={() => setSharedY(false)}>
                Propia
              </button>
            </div>
            <button type="button" className="btn" onClick={() => p.onShowInSpectrum(p.fpSpecies, vLine)}>
              Ver solo {info.formula} en el espectro
            </button>
          </div>
        </div>

        {statusCounts.size ? (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-ink-2">
            {(Object.keys(STATUS) as LineStatus[])
              .filter((s) => statusCounts.has(s))
              .map((s) => (
                <span key={s} className="inline-flex items-center gap-1" title={STATUS[s].hint}>
                  <span style={{ color: STATUS[s].color }}>{STATUS[s].icon}</span>
                  {STATUS[s].label} <span className="num">{statusCounts.get(s)}</span>
                </span>
              ))}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full border border-ink" /> intensidad esperada
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[0.7rem]">▾</span> v del pico asociado
            </span>
          </div>
        ) : null}

        {panels.length === 0 ? (
          <p className="text-sm text-muted">Esta especie no tiene líneas fuertes dentro de W1 o W2.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
            {panels.map((x) => (
              <Panel
                key={x.cat.id}
                line={x}
                color={info.color}
                vLine={vLine}
                yDomain={sharedY ? yShared : (paddedRange(x.slice?.y ?? [], 0.12) ?? yShared)}
                sigma={x.win ? p.spectra[x.win].noise[p.active].sigma_Jy : null}
                onZoom={() => x.win && p.onZoomLine(x.win, observedFreqGHz(x.cat.rest_MHz, x.sl?.v_kms ?? vLine))}
                onLog={() => p.onLogLine(x.cat, x.win, x.sl?.peak_id ?? null)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const W = 216;
const H = 112;
const M = { l: 34, r: 6, t: 8, b: 18 };

function Panel({
  line,
  color,
  vLine,
  yDomain,
  sigma,
  onZoom,
  onLog,
}: {
  line: PanelLine;
  color: string;
  vLine: number;
  yDomain: [number, number];
  sigma: number | null;
  onZoom: () => void;
  onLog: () => void;
}) {
  const { cat, slice, status, sl } = line;
  const x = scaleLinear().domain([FP_VMIN, FP_VMAX]).range([M.l, W - M.r]);
  const y = scaleLinear().domain(yDomain).range([H - M.b, M.t]);
  const muted = status !== null && status !== "matched";
  const stroke = muted ? "#8189a9" : color;

  // trazo escalonado (cada canal es un escalón centrado)
  let d = "";
  if (slice && slice.x.length > 1) {
    const xs = slice.x;
    for (let i = 0; i < xs.length; i++) {
      const half = i < xs.length - 1 ? (xs[i + 1] - xs[i]) / 2 : (xs[i] - xs[i - 1]) / 2;
      const left = i === 0 ? xs[i] - half : (xs[i - 1] + xs[i]) / 2;
      const right = xs[i] + half;
      const yy = y(slice.y[i]);
      d += `${i === 0 ? "M" : "L"}${x(left).toFixed(1)},${yy.toFixed(1)}L${x(right).toFixed(1)},${yy.toFixed(1)}`;
    }
  }
  const borderColor = status ? STATUS[status].color : "var(--color-rule)";
  const yTicks = y.ticks(2);
  const expected = sl?.expected_peak_Jy ?? null;

  return (
    <figure className="plate flex flex-col overflow-hidden" style={{ borderTop: `2px solid ${borderColor}` }}>
      <figcaption className="flex items-start justify-between gap-2 px-2.5 pt-1.5">
        <span>
          <span className="num block text-ink">{cat.rest_MHz.toFixed(2)} MHz</span>
          <span className="num block text-[0.7rem] text-muted">
            E<sub>u</sub> {cat.Eu_K.toFixed(0)} K, log I {cat.logI_300K.toFixed(2)}
          </span>
        </span>
        <span className="flex flex-col items-end">
          {status ? <StatusTag status={status} /> : null}
          <span className="text-[0.7rem] text-muted">{line.win ?? "fuera de W1/W2"}</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Línea ${cat.rest_MHz.toFixed(2)} MHz en velocidad`}>
        {sigma !== null ? (
          <rect x={M.l} width={W - M.l - M.r} y={y(sigma)} height={Math.max(0, y(-sigma) - y(sigma))} fill="rgba(236,230,214,0.08)" />
        ) : null}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#3d4379" : "#262a52"} strokeWidth={1} />
            <text x={M.l - 4} y={y(t)} dy="0.32em" textAnchor="end" fontSize={8.5} fill="#8189a9" fontFamily="var(--nf-mono)">
              {t.toFixed(Math.abs(yDomain[1] - yDomain[0]) < 0.5 ? 2 : 1)}
            </text>
          </g>
        ))}
        {[-5, 0, 5, 10].map((t) => (
          <text key={t} x={x(t)} y={H - 5} textAnchor="middle" fontSize={8.5} fill="#8189a9" fontFamily="var(--nf-mono)">
            {t}
          </text>
        ))}
        <line x1={x(vLine)} x2={x(vLine)} y1={M.t} y2={H - M.b} stroke="#ece6d6" strokeWidth={1} opacity={0.75} />
        {d ? <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" /> : null}
        {sl?.v_kms !== null && sl?.v_kms !== undefined ? (
          <path
            d={`M${x(sl.v_kms) - 4},${M.t}L${x(sl.v_kms) + 4},${M.t}L${x(sl.v_kms)},${M.t + 6}Z`}
            fill="#ece6d6"
          />
        ) : null}
        {expected !== null && Number.isFinite(expected) ? (
          <circle cx={x(vLine)} cy={Math.max(M.t, Math.min(H - M.b, y(expected)))} r={3} fill="none" stroke="#ece6d6" strokeWidth={1.2} />
        ) : null}
        {!slice || slice.x.length === 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={10} fill="#8189a9">
            sin canales en este rango
          </text>
        ) : null}
      </svg>
      <div className="flex items-center justify-between border-t border-rule px-1.5 py-0.5 text-[0.74rem]">
        <span className="num px-1 text-muted">
          {sl?.snr !== null && sl?.snr !== undefined ? `SNR ${sl.snr.toFixed(1)}` : " "}
        </span>
        <span className="flex">
          <button
            type="button"
            className="btn btn-quiet whitespace-nowrap px-2 py-0"
            onClick={onZoom}
            disabled={!line.win}
            title="Ampliar esta línea en el espectro (±5 MHz)"
          >
            Espectro
          </button>
          <button type="button" className="btn btn-quiet whitespace-nowrap px-2 py-0" onClick={onLog} title="Añadir al registro de evidencia">
            Registrar
          </button>
        </span>
      </div>
    </figure>
  );
}

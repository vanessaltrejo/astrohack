"use client";

import { useEffect, useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { Maximize2, ZoomIn, Plus, Filter } from "lucide-react";
import type { CatalogLine, LineStatus, Meta, PosKey, ScoreLine, Spectra, WinKey } from "@/lib/data";
import { speciesRows, type V3Pos } from "@/lib/probabilidad";
import { FP_MAX_PANELS, FP_VMAX, FP_VMIN, POSITION_LABELS, STRONG_DEX } from "@/lib/config";
import { speciesInfo } from "@/lib/species";
import { observedFreqGHz, paddedRange, sliceVelocity, strongLines, windowForFreq, type Slice } from "@/lib/spectro";
import { f } from "@/lib/format";
import { useReveal } from "@/lib/motion";
import { Dialog, Pending, STATUS, StatusTag } from "./ui";
import { Tex, SYM } from "./Tex";

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
  /** salida del motor v3 para la posición activa (probabilidad por línea) */
  v3: V3Pos | null;
  active: PosKey;
  fpSpecies: string;
  setFpSpecies: (s: string) => void;
  vControl: number;
  onHoverSpecies: (s: string | null) => void;
  onZoomLine: (win: WinKey, freqGHz: number) => void;
  onLogLine: (line: CatalogLine, win: WinKey | null, peakId: string | null) => void;
  onShowInSpectrum: (species: string, v: number) => void;
}

const T = { ink: "#f2f6fa", ink2: "#b8c0cf", muted: "#7c879b", grid: "rgba(255,255,255,0.06)", zero: "rgba(255,255,255,0.18)" };
const SANS = '"IBM Plex Sans", sans-serif';

export default function Fingerprints(p: FingerprintsProps) {
  const [sharedY, setSharedY] = useState(true);
  const [inspect, setInspect] = useState<number | null>(null);
  const info = speciesInfo(p.fpSpecies);
  const gridRef = useReveal<HTMLDivElement>();

  // velocidad dada por los organizadores; el espectro sólo se lleva de observado a reposo
  const vLine = p.vControl;

  const axes = useMemo(
    () => ({ W1: p.spectra.W1.freq_GHz, W2: p.spectra.W2.freq_GHz }) as Record<WinKey, number[]>,
    [p.spectra],
  );

  const features = p.v3?.especies?.[p.fpSpecies]?.fuertes ?? null;
  const panels = useMemo<PanelLine[]>(() => {
    const ls = p.catalog.filter(
      (l) => l.species === p.fpSpecies && windowForFreq(axes, observedFreqGHz(l.rest_MHz, vLine)) !== null,
    );
    const base = strongLines(ls, STRONG_DEX)
      .sort((a, b) => b.logI_300K - a.logI_300K)
      .slice(0, FP_MAX_PANELS)
      .sort((a, b) => a.rest_MHz - b.rest_MHz);
    return base.map((cat) => {
      const w = windowForFreq(axes, observedFreqGHz(cat.rest_MHz, vLine)) ?? cat.window;
      const slice = w ? sliceVelocity(p.spectra[w].freq_GHz, p.spectra[w][p.active], cat.rest_MHz, FP_VMIN, FP_VMAX) : null;
      // "se repite": la línea aparece (o falta) según el motor v3, que ya agrupó las filas no resueltas
      let status: LineStatus | null = null;
      if (features) {
        let best: { d: number; pico: string | null } | null = null;
        for (const ft of features) {
          const d = Math.abs(ft.nu_reposo_MHz - cat.rest_MHz);
          if (d <= 0.6 && (!best || d < best.d)) best = { d, pico: ft.pico };
        }
        if (best) status = best.pico ? "matched" : "missing";
      }
      return { cat, win: w, status, sl: null, slice };
    });
  }, [p.catalog, p.fpSpecies, p.spectra, p.active, axes, vLine, features]);

  // al cambiar de especie o posición, vuelve a revelar la rejilla con escalonado
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    el.classList.remove("is-in");
    const t = requestAnimationFrame(() => el.classList.add("is-in"));
    return () => cancelAnimationFrame(t);
  }, [p.fpSpecies, p.active, gridRef]);

  const yShared = useMemo(
    () => paddedRange(panels.flatMap((x) => x.slice?.y ?? []), 0.1) ?? ([-0.1, 1] as [number, number]),
    [panels],
  );

  const ranked = useMemo(() => (p.v3 ? speciesRows(p.v3, p.speciesKeys) : []), [p.v3, p.speciesKeys]);

  const statusCounts = useMemo(() => {
    const m = new Map<LineStatus, number>();
    for (const x of panels) if (x.status) m.set(x.status, (m.get(x.status) ?? 0) + 1);
    return m;
  }, [panels]);

  const inspected = inspect !== null ? (panels.find((x) => x.cat.id === inspect) ?? null) : null;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(24rem,27rem)_minmax(0,1fr)]">
      {/* marcador */}
      <div>
        <h3 className="serif mb-2 text-[1.1rem]">
          Marcador <em className="text-ink-2">en {POSITION_LABELS[p.active]}</em>
        </h3>
        {p.v3 ? (
          <div className="plate overflow-hidden">
            <table className="dtable">
              <thead>
                <tr>
                  <th>Especie</th>
                  <th>Se repite</th>
                  <th className="r">Líneas que explica</th>
                  <th className="r">P media</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const sp = r.especie;
                  const si = speciesInfo(sp);
                  const sel = sp === p.fpSpecies;
                  const frac = r.fuertes > 0 ? r.presentes / r.fuertes : 0;
                  return (
                    <tr
                      key={sp}
                      className="cursor-pointer"
                      aria-selected={sel}
                      tabIndex={0}
                      onClick={() => p.setFpSpecies(sp)}
                      onMouseEnter={() => p.onHoverSpecies(sp)}
                      onMouseLeave={() => p.onHoverSpecies(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") p.setFpSpecies(sp);
                      }}
                      style={sel ? { boxShadow: `inset 2px 0 0 ${si.color}` } : undefined}
                    >
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 flex-none" style={{ background: si.color }} />
                          <span className={sel ? "font-semibold text-ink" : "text-ink"}>{si.formula}</span>
                        </span>
                        <span className="block pl-4 text-[0.72rem] italic text-muted">{si.name}</span>
                      </td>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="relative block h-[4px] w-12 flex-none bg-rule" aria-hidden>
                            <span className="absolute inset-y-0 left-0 transition-[width] duration-300" style={{ width: `${frac * 100}%`, background: si.color }} />
                          </span>
                          <span>
                            {r.presentes}/{r.fuertes}
                          </span>
                        </span>
                        {r.fuertes - r.presentes > 0 ? (
                          <span className="mt-0.5 block text-[0.7rem] text-ink-2">
                            <span style={{ color: "var(--color-critical)" }}>✕</span> {r.fuertes - r.presentes} ausente
                            {r.fuertes - r.presentes > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="r whitespace-nowrap">{r.gana > 0 ? r.gana : <span className="text-muted">0</span>}</td>
                      <td className="r whitespace-nowrap">
                        {r.pMedia !== null ? `${(r.pMedia * 100).toFixed(0)}%` : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Pending what="probabilidad.json (analysis/v3/probabilidad.py)">
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
        <p className={`caption mt-2 ${p.v3 ? "" : "hidden"}`}>
          Orden por las líneas que cada especie explica (la candidata de mayor probabilidad). “Se repite” cuenta las
          líneas fuertes de la especie en W1 y W2 que aparecen a la velocidad dada; una línea fuerte ausente pesa en contra.
        </p>
      </div>

      {/* huellas */}
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <h3 className="serif flex items-center gap-2 text-[1.35rem]">
              <span className="h-2.5 w-2.5" style={{ background: info.color }} />
              {info.formula}
              <em className="text-ink-2">{info.name}</em>
            </h3>
            <p className="caption mt-0.5">
              {panels.length} líneas fuertes del catálogo (≤ {STRONG_DEX} dex), línea vertical en{" "}
              <Tex>{String.raw`v = ` + f(vLine, 1)}</Tex> km/s (dada)
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn btn-quiet" aria-pressed={sharedY} onClick={() => setSharedY((x) => !x)} title="Misma escala vertical en todos los paneles">
              Escala común
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => p.onShowInSpectrum(p.fpSpecies, vLine)} title="Dejar sólo esta especie en el espectro">
              <Filter className="icon" />
              Aislar en el espectro
            </button>
          </div>
        </div>

        {statusCounts.size ? (
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.76rem] text-ink-2">
            {(Object.keys(STATUS) as LineStatus[])
              .filter((s) => statusCounts.has(s))
              .map((s) => {
                const S = STATUS[s];
                return (
                  <span key={s} className="inline-flex items-center gap-1" title={S.hint}>
                    <S.Icon className="icon" style={{ color: S.color }} aria-hidden />
                    {statusCounts.get(s)} {S.label}
                  </span>
                );
              })}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full border border-ink" /> intensidad esperada
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="text-[0.7rem]">▾</span> pico asociado
            </span>
          </div>
        ) : null}

        {panels.length === 0 ? (
          <p className="text-sm text-muted">Esta especie no tiene líneas fuertes dentro de W1 o W2.</p>
        ) : (
          <div ref={gridRef} className="reveal grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-2.5">
            {panels.map((x, i) => (
              <div key={x.cat.id} className="reveal-item" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                <Panel
                  line={x}
                  color={info.color}
                  vLine={vLine}
                  yDomain={sharedY ? yShared : (paddedRange(x.slice?.y ?? [], 0.12) ?? yShared)}
                  sigma={x.win ? p.spectra[x.win].noise[p.active].sigma_Jy : null}
                  onZoom={() => x.win && p.onZoomLine(x.win, observedFreqGHz(x.cat.rest_MHz, x.sl?.v_kms ?? vLine))}
                  onLog={() => p.onLogLine(x.cat, x.win, x.sl?.peak_id ?? null)}
                  onInspect={() => setInspect(x.cat.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={inspected !== null}
        onClose={() => setInspect(null)}
        kind="modal"
        title={inspected ? `${inspected.cat.rest_MHz.toFixed(4)} MHz` : ""}
        subtitle={`${info.formula}, ${info.name}, en ${POSITION_LABELS[p.active]}`}
        actions={
          inspected ? (
            <>
              <button
                type="button"
                className="btn"
                disabled={!inspected.win}
                onClick={() => {
                  if (inspected.win) p.onZoomLine(inspected.win, observedFreqGHz(inspected.cat.rest_MHz, inspected.sl?.v_kms ?? vLine));
                  setInspect(null);
                }}
              >
                <ZoomIn className="icon" />
                Ver en el espectro
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  p.onLogLine(inspected.cat, inspected.win, inspected.sl?.peak_id ?? null);
                  setInspect(null);
                }}
              >
                <Plus className="icon" />
                Registrar
              </button>
            </>
          ) : null
        }
      >
        {inspected ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
            <Panel
              line={inspected}
              color={info.color}
              vLine={vLine}
              yDomain={sharedY ? yShared : (paddedRange(inspected.slice?.y ?? [], 0.12) ?? yShared)}
              sigma={inspected.win ? p.spectra[inspected.win].noise[p.active].sigma_Jy : null}
              large
            />
            <dl className="kv content-start">
              <dt>Catálogo</dt>
              <dd>
                {inspected.cat.catalog} <span className="id">{inspected.cat.entry}</span>
              </dd>
              <dt>Transición</dt>
              <dd>
                {inspected.cat.qn_up} → {inspected.cat.qn_lo}
              </dd>
              <dt>
                <Tex>{SYM.nuRest}</Tex>
              </dt>
              <dd>
                {inspected.cat.rest_MHz.toFixed(4)} ± {inspected.cat.unc_MHz} MHz
              </dd>
              <dt>
                <Tex>{SYM.nuObs}</Tex>
              </dt>
              <dd>{observedFreqGHz(inspected.cat.rest_MHz, vLine).toFixed(5)} GHz</dd>
              <dt>
                <Tex>{SYM.Eu}</Tex>
              </dt>
              <dd>{inspected.cat.Eu_K.toFixed(1)} K</dd>
              <dt>
                <Tex>{SYM.logI}</Tex>
              </dt>
              <dd>{inspected.cat.logI_300K.toFixed(3)}</dd>
              <dt>Ventana</dt>
              <dd>{inspected.win ?? "fuera de W1/W2"}</dd>
              {inspected.sl ? (
                <>
                  <dt>Estado</dt>
                  <dd>{inspected.status ? STATUS[inspected.status].label : "—"}</dd>
                  <dt>
                    <Tex>{String.raw`v_{\mathrm{pico}}`}</Tex>
                  </dt>
                  <dd>{inspected.sl.v_kms !== null && inspected.sl.v_kms !== undefined ? `${inspected.sl.v_kms.toFixed(3)} km/s` : "—"}</dd>
                  <dt>
                    <Tex>{SYM.snr}</Tex>
                  </dt>
                  <dd>{inspected.sl.snr !== null && inspected.sl.snr !== undefined ? inspected.sl.snr.toFixed(1) : "—"}</dd>
                  <dt>Esperado</dt>
                  <dd>
                    {inspected.sl.expected_peak_Jy !== undefined && inspected.sl.expected_peak_Jy !== null
                      ? `${inspected.sl.expected_peak_Jy.toFixed(3)} Jy/beam`
                      : "—"}
                  </dd>
                  <dt>Pico</dt>
                  <dd className="id">{inspected.sl.peak_id ?? "—"}</dd>
                </>
              ) : null}
            </dl>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Panel({
  line,
  color,
  vLine,
  yDomain,
  sigma,
  onZoom,
  onLog,
  onInspect,
  large = false,
}: {
  line: PanelLine;
  color: string;
  vLine: number;
  yDomain: [number, number];
  sigma: number | null;
  onZoom?: () => void;
  onLog?: () => void;
  onInspect?: () => void;
  large?: boolean;
}) {
  const W = large ? 560 : 216;
  const H = large ? 300 : 112;
  const M = large ? { l: 48, r: 10, t: 12, b: 26 } : { l: 34, r: 6, t: 8, b: 18 };
  const fs = large ? 11 : 8.5;
  const { cat, slice, status, sl } = line;
  const x = scaleLinear().domain([FP_VMIN, FP_VMAX]).range([M.l, W - M.r]);
  const y = scaleLinear().domain(yDomain).range([H - M.b, M.t]);
  const muted = status !== null && status !== "matched";
  const stroke = muted ? T.muted : color;

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
  const borderColor = status ? STATUS[status].color : "var(--color-rule-strong)";
  const yTicks = y.ticks(large ? 5 : 2);
  const expected = sl?.expected_peak_Jy ?? null;

  const svg = (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Línea ${cat.rest_MHz.toFixed(2)} MHz en velocidad`}>
      {sigma !== null ? <rect x={M.l} width={W - M.l - M.r} y={y(sigma)} height={Math.max(0, y(-sigma) - y(sigma))} fill="rgba(242,246,250,0.07)" /> : null}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? T.zero : T.grid} strokeWidth={1} />
          <text x={M.l - 4} y={y(t)} dy="0.32em" textAnchor="end" fontSize={fs} fill={T.muted} fontFamily={SANS}>
            {t.toFixed(Math.abs(yDomain[1] - yDomain[0]) < 0.5 ? 2 : 1)}
          </text>
        </g>
      ))}
      {(large ? [-8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12] : [-5, 0, 5, 10]).map((t) => (
        <text key={t} x={x(t)} y={H - (large ? 8 : 5)} textAnchor="middle" fontSize={fs} fill={T.muted} fontFamily={SANS}>
          {t}
        </text>
      ))}
      <line x1={x(vLine)} x2={x(vLine)} y1={M.t} y2={H - M.b} stroke="#ffb800" strokeWidth={1} opacity={0.8} />
      {d ? <path d={d} fill="none" stroke={stroke} strokeWidth={large ? 1.8 : 1.5} strokeLinejoin="round" pathLength={1} className="draw-once" /> : null}
      {sl?.v_kms !== null && sl?.v_kms !== undefined ? <path d={`M${x(sl.v_kms) - 4},${M.t}L${x(sl.v_kms) + 4},${M.t}L${x(sl.v_kms)},${M.t + 6}Z`} fill={T.ink} /> : null}
      {expected !== null && Number.isFinite(expected) ? (
        <circle cx={x(vLine)} cy={Math.max(M.t, Math.min(H - M.b, y(expected)))} r={large ? 4 : 3} fill="none" stroke={T.ink} strokeWidth={1.2} />
      ) : null}
      {!slice || slice.x.length === 0 ? (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={10} fill={T.muted} fontFamily={SANS}>
          sin canales en este rango
        </text>
      ) : null}
      {large ? (
        <text x={W - M.r} y={H - 8} textAnchor="end" fontSize={fs} fill={T.muted} fontFamily={SANS}>
          km/s
        </text>
      ) : null}
    </svg>
  );

  if (large) return <div className="plate overflow-hidden">{svg}</div>;

  return (
    <figure
      className="plate flex cursor-zoom-in flex-col overflow-hidden transition-colors duration-150 hover:bg-plate-2"
      style={{ borderTop: `2px solid ${borderColor}` }}
      onClick={onInspect}
    >
      <figcaption className="flex items-start justify-between gap-2 px-2.5 pt-1.5">
        <span>
          <span className="block text-[0.86rem] text-ink">{cat.rest_MHz.toFixed(2)} MHz</span>
          <span className="block text-[0.7rem] text-muted">
            <Tex>{SYM.Eu}</Tex> {cat.Eu_K.toFixed(0)} K, <Tex>{SYM.logI}</Tex> {cat.logI_300K.toFixed(2)}
          </span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          {status ? <StatusTag status={status} /> : null}
          <span className="text-[0.68rem] text-muted">{line.win ?? "fuera de W1/W2"}</span>
        </span>
      </figcaption>
      {svg}
      <div className="flex items-center justify-between border-t border-rule px-1.5 py-0.5 text-[0.72rem]" onClick={(e) => e.stopPropagation()}>
        <span className="px-1 text-muted">{sl?.snr !== null && sl?.snr !== undefined ? `S/N ${sl.snr.toFixed(1)}` : " "}</span>
        <span className="flex">
          <button type="button" className="btn btn-quiet px-1.5 py-0" onClick={onZoom} disabled={!line.win} title="Ampliar esta línea en el espectro (±5 MHz)" aria-label="Ver en el espectro">
            <ZoomIn className="icon" />
          </button>
          <button type="button" className="btn btn-quiet px-1.5 py-0" onClick={onLog} title="Añadir al registro de evidencia" aria-label="Registrar">
            <Plus className="icon" />
          </button>
          <button type="button" className="btn btn-quiet px-1.5 py-0" onClick={onInspect} title="Ampliar el panel" aria-label="Ampliar">
            <Maximize2 className="icon" />
          </button>
        </span>
      </div>
    </figure>
  );
}

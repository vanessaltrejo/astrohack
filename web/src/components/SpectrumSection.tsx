"use client";

import { useMemo } from "react";
import type { CatalogLine, Meta, Peak, PosKey, WinKey, WindowSpectra } from "@/lib/data";
import { POSITION_KEYS, WINDOW_KEYS } from "@/lib/data";
import { POSITION_LABELS, V_MAX, V_MIN, V_STEP } from "@/lib/config";
import { POSITION_COLORS, speciesInfo } from "@/lib/species";
import { sliceFreq } from "@/lib/spectro";
import { f } from "@/lib/format";
import SpectrumView from "./SpectrumView";
import { MethodTip } from "./ui";

export interface SpectrumSectionProps {
  meta: Meta;
  spectra: WindowSpectra;
  win: WinKey;
  setWin: (w: WinKey) => void;
  active: PosKey;
  setActive: (p: PosKey) => void;
  overlay: PosKey[];
  toggleOverlay: (p: PosKey) => void;
  v: number;
  vPlot: number;
  setV: (v: number) => void;
  vPipeline: number | null;
  rest: boolean;
  setRest: (b: boolean) => void;
  guides: boolean;
  setGuides: (b: boolean) => void;
  speciesKeys: string[];
  speciesOn: Set<string>;
  toggleSpecies: (s: string) => void;
  setAllSpecies: (on: boolean) => void;
  minLogI: number;
  setMinLogI: (x: number) => void;
  lineCounts: Map<string, number>;
  visibleLines: CatalogLine[];
  peaks: Peak[] | null;
  peaksState: "ok" | "missing" | "error";
  sigma: number;
  baseline: number;
  xRange: [number, number] | null;
  yRange: [number, number] | null;
  onRangeChange: (x: [number, number] | null, y: [number, number] | null) => void;
  selRange: [number, number] | null;
  setSelRange: (r: [number, number] | null) => void;
}

export default function SpectrumSection(p: SpectrumSectionProps) {
  const shown = [p.active, ...p.overlay.filter((x) => x !== p.active)];
  const wm = p.meta.windows[p.win];

  const sel = useMemo(() => {
    if (!p.selRange) return null;
    const s = sliceFreq(p.spectra.freq_GHz, p.spectra[p.active], p.selRange[0], p.selRange[1]);
    if (s.y.length === 0) return null;
    let k = 0;
    let sum = 0;
    for (let i = 0; i < s.y.length; i++) {
      sum += s.y[i];
      if (s.y[i] > s.y[k]) k = i;
    }
    return {
      n: s.y.length,
      f0: Math.min(...s.x),
      f1: Math.max(...s.x),
      max: s.y[k],
      fmax: s.x[k],
      area: (sum - s.y.length * p.baseline) * wm.step_kms,
    };
  }, [p.selRange, p.spectra, p.active, p.baseline, wm.step_kms]);

  const nVisible = p.visibleLines.length;

  return (
    <div>
      {/* fila 1: ventana, posición, marco */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2">
          <div className="seg" role="group" aria-label="Ventana espectral">
            {WINDOW_KEYS.map((w) => (
              <button key={w} type="button" aria-pressed={p.win === w} onClick={() => p.setWin(w)}>
                {w}
              </button>
            ))}
          </div>
          <span className="num text-muted">
            {f(p.meta.windows[p.win].range_GHz[0], 3)}–{f(p.meta.windows[p.win].range_GHz[1], 3)} GHz
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Posiciones">
          {POSITION_KEYS.map((pos) => {
            const isActive = pos === p.active;
            const isShown = shown.includes(pos);
            return (
              <span
                key={pos}
                className="inline-flex items-center rounded-full border"
                style={{ borderColor: isShown ? POSITION_COLORS[pos] : "var(--color-rule)" }}
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => p.setActive(pos)}
                  title="Hacer activa: fija σ, picos, huellas y la velocidad inicial"
                  className={`flex items-center gap-1.5 rounded-l-full py-0.5 pl-2.5 pr-2 text-sm ${
                    isActive ? "bg-plate-2 font-semibold text-ink" : "text-ink-2"
                  }`}
                >
                  <span aria-hidden className="inline-block h-[2px] w-4" style={{ background: POSITION_COLORS[pos] }} />
                  {POSITION_LABELS[pos]}
                </button>
                <button
                  type="button"
                  disabled={isActive}
                  aria-pressed={isShown}
                  aria-label={`Superponer ${POSITION_LABELS[pos]}`}
                  title={isActive ? "Posición activa" : "Superponer en el gráfico"}
                  onClick={() => p.toggleOverlay(pos)}
                  className="border-l border-rule px-2 py-0.5 text-xs text-muted disabled:opacity-40"
                >
                  {isActive ? "activa" : isShown ? "quitar" : "superponer"}
                </button>
              </span>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <label className="btn btn-quiet cursor-pointer">
            <input type="checkbox" checked={p.rest} onChange={(e) => p.setRest(e.target.checked)} />
            Mostrar reposo
          </label>
          <label className="btn btn-quiet cursor-pointer">
            <input type="checkbox" checked={p.guides} onChange={(e) => p.setGuides(e.target.checked)} />
            Líneas guía
          </label>
          <MethodTip />
        </div>
      </div>

      {/* fila 2: velocidad, el control protagonista */}
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-6">
        <label htmlFor="vslider" className="flex items-baseline gap-2">
          <span className="text-ink-2">
            v<sub>LSR</sub>
          </span>
          <span className="num text-[2.1rem] font-medium leading-none text-ink" aria-live="polite">
            {p.v.toFixed(2)}
          </span>
          <span className="text-sm text-muted">km/s</span>
        </label>
        <div className="relative">
          <input
            id="vslider"
            className="vslider"
            type="range"
            min={V_MIN}
            max={V_MAX}
            step={V_STEP}
            value={p.v}
            onChange={(e) => p.setV(Number(e.target.value))}
            aria-valuetext={`${p.v.toFixed(2)} kilómetros por segundo`}
          />
          <div className="num pointer-events-none flex justify-between px-[5px] text-[0.7rem] text-muted" aria-hidden>
            {Array.from({ length: V_MAX - V_MIN + 1 }, (_, i) => (
              <span key={i}>{V_MIN + i}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start gap-1">
          <button type="button" className="btn btn-quiet" onClick={() => p.setV(p.meta.positions[p.active].v_start_kms)}>
            Inicial de {POSITION_LABELS[p.active]}: <span className="num">{f(p.meta.positions[p.active].v_start_kms, 2)}</span>
          </button>
          {p.vPipeline !== null ? (
            <button type="button" className="btn btn-quiet" onClick={() => p.setV(Math.round(p.vPipeline! / V_STEP) * V_STEP)}>
              Adoptada por el pipeline: <span className="num">{f(p.vPipeline, 2)}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* fila 3: especies e intensidad mínima */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {p.speciesKeys.map((sp) => {
          const info = speciesInfo(sp);
          const on = p.speciesOn.has(sp);
          return (
            <button
              key={sp}
              type="button"
              className="chip"
              aria-pressed={on}
              onClick={() => p.toggleSpecies(sp)}
              title={`${info.name} — ${p.lineCounts.get(sp) ?? 0} líneas en ${p.win} sobre el umbral`}
            >
              <span className="dot" style={{ background: info.color }} />
              {info.formula}
              <span className="num text-[0.72rem] text-muted">{p.lineCounts.get(sp) ?? 0}</span>
            </button>
          );
        })}
        <span className="mx-1 h-4 w-px bg-rule" aria-hidden />
        <button type="button" className="btn btn-quiet" onClick={() => p.setAllSpecies(true)}>
          Todas
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => p.setAllSpecies(false)}>
          Ninguna
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-2">
          log I<sub className="-ml-1.5">300K</sub> ≥
          <input
            type="range"
            min={-12}
            max={-2}
            step={0.1}
            value={p.minLogI}
            onChange={(e) => p.setMinLogI(Number(e.target.value))}
            className="w-36"
          />
          <span className="num w-12 text-ink">{f(p.minLogI, 1)}</span>
        </label>
      </div>

      {/* leyenda */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.8rem] text-ink-2">
        {shown.map((pos) => (
          <span key={pos} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-5" style={{ background: POSITION_COLORS[pos] }} />
            {POSITION_LABELS[pos]}
            {pos === p.active ? <span className="text-muted">(activa)</span> : null}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-[2px] bg-[rgba(236,230,214,0.16)]" />
          ±1σ = <span className="num">{f(p.sigma * 1000, 1)}</span> mJy/beam
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="text-[0.7rem] text-ink-2">▼</span>
          {p.peaks
            ? `${p.peaks.length} picos detectados en ${POSITION_LABELS[p.active]}`
            : p.peaksState === "error"
              ? "peaks.json no se pudo leer"
              : "picos: análisis en curso"}
        </span>
        <span className="ml-auto text-muted">
          {nVisible} líneas del catálogo visibles. Arrastra para ampliar; doble clic para ver todo.
        </span>
      </div>

      <div className="plate mt-2 overflow-hidden">
        <SpectrumView
          spectra={p.spectra}
          active={p.active}
          shown={shown}
          v={p.vPlot}
          rest={p.rest}
          guides={p.guides}
          lines={p.visibleLines}
          laneSpecies={p.speciesKeys}
          peaks={p.peaks}
          sigma={p.sigma}
          baseline={p.baseline}
          xRange={p.xRange}
          yRange={p.yRange}
          onRangeChange={p.onRangeChange}
          onSelectRange={p.setSelRange}
        />
      </div>

      <div className="mt-2 flex min-h-[2.2rem] flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink-2">
        {sel ? (
          <>
            <span className="text-ink">Selección en {POSITION_LABELS[p.active]}</span>
            <span>
              <span className="num">
                {f(sel.f0, 5)}–{f(sel.f1, 5)}
              </span>{" "}
              GHz, <span className="num">{sel.n}</span> canales
            </span>
            <span>
              máximo <span className="num">{f(sel.max, 3)}</span> Jy/beam en <span className="num">{f(sel.fmax, 5)}</span> GHz
              (SNR <span className="num">{f((sel.max - p.baseline) / p.sigma, 1)}</span>)
            </span>
            <span>
              ∑(S − base)·Δv = <span className="num">{f(sel.area, 3)}</span> Jy/beam·km/s
            </span>
            <button type="button" className="btn btn-quiet" onClick={() => p.setSelRange(null)}>
              Limpiar selección
            </button>
          </>
        ) : (
          <span className="text-muted">
            Usa “Box Select” en la barra del gráfico para medir un intervalo: canales, máximo, SNR y área integrada.
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { BookOpen, Eye, EyeOff, Grid2x2, Layers, Crosshair, Eraser } from "lucide-react";
import SpectrumTooltip from "./SpectrumTooltip";
import type { CatalogLine, Meta, Peak, PosKey, WinKey, WindowSpectra } from "@/lib/data";
import { POSITION_KEYS, WINDOW_KEYS } from "@/lib/data";
import { POSITION_LABELS } from "@/lib/config";
import { POSITION_COLORS, speciesInfo } from "@/lib/species";
import { sliceFreq } from "@/lib/spectro";
import { f } from "@/lib/format";
import { useRestartAnimation } from "@/lib/motion";
import SpectrumView, { type HoverInfo } from "./SpectrumView";
import { Tex, SYM } from "./Tex";

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
  /** grupo de la especie según el motor v3 (explica líneas / candidata sin ganar / sin candidatas) */
  groupOf: (sp: string) => string;
  winsOf: (sp: string) => number;
  hoverSpecies: string | null;
  setHoverSpecies: (s: string | null) => void;
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
  onMethod: () => void;
  busy: boolean;
  laneSpecies: string[];
  flashRange: [number, number] | null;
  /** cambia cuando v se fija desde fuera (aislar, marcas): el valor parpadea una vez */
  vPulse: number;
}

const GROUP_ORDER = ["explica líneas", "candidata sin ganar", "sin candidatas"];

export default function SpectrumSection(p: SpectrumSectionProps) {
  const shown = [p.active, ...p.overlay.filter((x) => x !== p.active)];
  const wm = p.meta.windows[p.win];
  const plotRef = useRef<HTMLDivElement | null>(null);
  useRestartAnimation(plotRef, "fade-swap", `${p.active}-${p.win}`);
  const [hover, setHover] = useState<HoverInfo | null>(null);

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
    return { n: s.y.length, f0: Math.min(...s.x), f1: Math.max(...s.x), max: s.y[k], fmax: s.x[k], area: (sum - s.y.length * p.baseline) * wm.step_kms };
  }, [p.selRange, p.spectra, p.active, p.baseline, wm.step_kms]);

  // especies agrupadas por veredicto (una fila por grupo, no un muro de chips)
  const { speciesKeys, groupOf } = p;
  const groups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const sp of speciesKeys) {
      const k = groupOf(sp);
      g.set(k, [...(g.get(k) ?? []), sp]);
    }
    return GROUP_ORDER.filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const);
  }, [speciesKeys, groupOf]);

  const vStart = p.meta.positions[p.active].v_start_kms;

  return (
    <div>
      {/* controles: ventana · posiciones · opciones */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="seg" role="group" aria-label="Ventana espectral">
          {WINDOW_KEYS.map((w) => (
            <button key={w} type="button" aria-pressed={p.win === w} onClick={() => p.setWin(w)} title={`${f(p.meta.windows[w].range_GHz[0], 3)}–${f(p.meta.windows[w].range_GHz[1], 3)} GHz`}>
              {w}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Posiciones">
          {POSITION_KEYS.map((pos) => {
            const isActive = pos === p.active;
            const isShown = shown.includes(pos);
            return (
              <span
                key={pos}
                className="inline-flex items-center overflow-hidden rounded-[3px] border"
                style={{ borderColor: isActive ? POSITION_COLORS[pos] : isShown ? "var(--color-rule-strong)" : "var(--color-rule)" }}
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => p.setActive(pos)}
                  title="Posición activa: fija σ, picos, huellas y la velocidad inicial"
                  className={`flex items-center gap-1.5 py-0.5 pl-2 pr-2 text-[0.8rem] ${isActive ? "bg-plate-2 font-semibold text-ink" : "text-ink-2 hover:text-ink"}`}
                >
                  <span aria-hidden className="inline-block h-[2px] w-3.5" style={{ background: POSITION_COLORS[pos] }} />
                  {POSITION_LABELS[pos]}
                </button>
                {!isActive ? (
                  <button
                    type="button"
                    aria-pressed={isShown}
                    aria-label={`Superponer ${POSITION_LABELS[pos]}`}
                    title={isShown ? "Quitar del gráfico" : "Superponer en el gráfico"}
                    onClick={() => p.toggleOverlay(pos)}
                    className={`border-l border-rule px-1.5 py-0.5 ${isShown ? "text-ink" : "text-muted hover:text-ink"}`}
                  >
                    <Layers className="icon" />
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="btn btn-quiet" aria-pressed={p.rest} onClick={() => p.setRest(!p.rest)} title="Eje en frecuencia de reposo (desplaza el espectro a la v elegida)">
            {p.rest ? <Eye className="icon" /> : <EyeOff className="icon" />}
            Reposo
          </button>
          <button type="button" className="btn btn-quiet" aria-pressed={p.guides} onClick={() => p.setGuides(!p.guides)} title="Líneas guía verticales en cada transición visible">
            <Grid2x2 className="icon" />
            Guías
          </button>
          <button type="button" className="btn btn-quiet" onClick={p.onMethod} title="Convenciones y fórmulas">
            <BookOpen className="icon" />
            Método
          </button>
        </div>
      </div>

      {/* velocidad */}
      <div className="mt-4 border-y border-rule py-3">
        {/* velocidad fija: la dada por los organizadores (no se estima ni se ajusta) */}
        <p className="text-[0.84rem] text-ink-2">
          v = <b className="text-ink">{vStart} km/s</b> <span className="text-muted">(dada · sólo observado → reposo)</span>
        </p>
      </div>

      {/* especies por veredicto */}
      <div className="mt-3 flex flex-wrap items-start gap-x-5 gap-y-2">
        {groups.map(([k, sps]) => {
          return (
            <div key={k} className="flex flex-wrap items-center gap-1.5">
              <span className="label mr-0.5 inline-flex items-center gap-1" title="según la probabilidad por línea (motor v3)">
                {k}
              </span>
              {sps.map((sp) => {
                const info = speciesInfo(sp);
                return (
                  <button
                    key={sp}
                    type="button"
                    className="chip"
                    aria-pressed={p.speciesOn.has(sp)}
                    onClick={() => p.toggleSpecies(sp)}
                    onMouseEnter={() => p.setHoverSpecies(sp)}
                    onMouseLeave={() => p.setHoverSpecies(null)}
                    title={`${info.name}: ${p.lineCounts.get(sp) ?? 0} líneas en ${p.win} sobre el umbral · gana ${p.winsOf(sp)} picos`}
                  >
                    <span className="dot" style={{ background: info.color }} />
                    {info.formula}
                    <span className="text-[0.68rem] text-muted">{p.lineCounts.get(sp) ?? 0}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          <button type="button" className="btn btn-quiet py-0.5" onClick={() => p.setAllSpecies(p.speciesOn.size < p.speciesKeys.length)}>
            {p.speciesOn.size < p.speciesKeys.length ? "Todas" : "Ninguna"}
          </button>
          <label className="flex items-center gap-2 text-[0.78rem] text-ink-2">
            <Tex>{SYM.logI + String.raw` \geq`}</Tex>
            <input type="range" min={-12} max={-2} step={0.1} value={p.minLogI} onChange={(e) => p.setMinLogI(Number(e.target.value))} className="w-28" />
            <span className="w-10 text-ink">{f(p.minLogI, 1)}</span>
          </label>
        </div>
      </div>

      <div id="espectro-plot" ref={plotRef} className="plate relative mt-3 scroll-mt-24 overflow-hidden">
        <span className={`hairline-progress ${p.busy ? "busy" : ""}`} aria-hidden />
        <SpectrumTooltip hover={hover} rest={p.rest} v={p.vPlot} sigma={p.sigma} baseline={p.baseline} vRef={p.vPipeline} />
        <SpectrumView
          spectra={p.spectra}
          active={p.active}
          shown={shown}
          v={p.vPlot}
          rest={p.rest}
          guides={p.guides}
          lines={p.visibleLines}
          laneSpecies={p.laneSpecies}
          hoverSpecies={p.hoverSpecies}
          flashRange={p.flashRange}
          annotateUnidentified
          vRef={p.vPipeline}
          onHoverPoint={setHover}
          peaks={p.peaks}
          sigma={p.sigma}
          baseline={p.baseline}
          xRange={p.xRange}
          yRange={p.yRange}
          onRangeChange={p.onRangeChange}
          onSelectRange={p.setSelRange}
        />
      </div>

      {/* leyenda + medición de la selección */}
      <div className="mt-2 flex min-h-[1.8rem] flex-wrap items-center gap-x-5 gap-y-1 text-[0.78rem] text-ink-2">
        {shown.map((pos) => (
          <span key={pos} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-5" style={{ background: POSITION_COLORS[pos] }} />
            {POSITION_LABELS[pos]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 bg-[rgba(242,246,250,0.1)]" />
          <Tex>{String.raw`\pm 1\sigma = ` + f(p.sigma * 1000, 1) + String.raw`\ \mathrm{mJy\,beam^{-1}}`}</Tex>
        </span>
        {p.peaks ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="text-[0.7rem]">▼</span>
            {p.peaks.length} picos
          </span>
        ) : p.peaksState === "error" ? (
          <span className="text-critical">peaks.json no se pudo leer</span>
        ) : null}
        {sel ? (
          <span className="ml-auto inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <Crosshair className="icon text-accent" />
            <span>
              {f(sel.f0, 5)}–{f(sel.f1, 5)} GHz, {sel.n} canales
            </span>
            <span>
              máx. {f(sel.max, 3)} Jy/beam, S/N {f((sel.max - p.baseline) / p.sigma, 1)}
            </span>
            <span>
              <Tex>{String.raw`\textstyle\sum (S - b)\,\Delta v`}</Tex> = {f(sel.area, 3)} Jy/beam·km/s
            </span>
            <button type="button" className="btn btn-quiet py-0.5" onClick={() => p.setSelRange(null)}>
              <Eraser className="icon" />
              Limpiar
            </button>
          </span>
        ) : (
          <span className="ml-auto text-muted">{p.visibleLines.length} transiciones visibles</span>
        )}
      </div>
    </div>
  );
}

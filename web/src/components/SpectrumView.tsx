"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Data, Layout, Shape, PlotRelayoutEvent, PlotSelectionEvent, PlotMouseEvent, Config } from "plotly.js";
import type { CatalogLine, Peak, PosKey, WindowSpectra } from "@/lib/data";
import { observedFreqGHz, toRestFrameGHz } from "@/lib/spectro";
import { POSITION_COLORS, SPECIES, speciesInfo } from "@/lib/species";
import { POSITION_LABELS } from "@/lib/config";

const Plot = dynamic(() => import("./Plot"), {
  ssr: false,
  loading: () => (
    <div className="num flex h-[620px] items-center justify-center text-sm text-muted">cargando el graficador…</div>
  ),
});

const C = {
  plate: "#111a2b",
  grid: "rgba(255,255,255,0.05)",
  rule: "rgba(255,255,255,0.18)",
  ink: "#f2f6fa",
  ink2: "#b8c0cf",
  muted: "#7c879b",
  band: "rgba(242,246,250,0.07)",
  marker: "rgba(242,246,250,0.5)",
};
const SANS = '"IBM Plex Sans", system-ui, sans-serif';

export interface SpectrumViewProps {
  spectra: WindowSpectra;
  active: PosKey;
  shown: PosKey[];
  v: number;
  rest: boolean;
  guides: boolean;
  lines: CatalogLine[];
  laneSpecies: string[];
  /** especie bajo el cursor en la leyenda: sus guías y su carril se realzan */
  hoverSpecies?: string | null;
  peaks: Peak[] | null;
  sigma: number;
  baseline: number;
  /** banda que se ilumina una vez tras "ver en el espectro" (GHz LSRK) */
  flashRange?: [number, number] | null;
  /** picos sin candidata cerca de la velocidad adoptada que se anotan en el gráfico (los más brillantes) */
  annotateUnidentified?: boolean;
  /** velocidad de referencia (adoptada) para decidir si un pico tiene candidata plausible */
  vRef?: number | null;
  /** tooltip propio: se llama con el dato bajo el cursor (o null al salir) */
  onHoverPoint?: (h: HoverInfo | null) => void;
  /** rango x en GHz LSRK (null = completo) */
  xRange: [number, number] | null;
  yRange: [number, number] | null;
  onRangeChange: (x: [number, number] | null, y: [number, number] | null) => void;
  onSelectRange: (r: [number, number] | null) => void;
  height?: number;
}

export type HoverInfo =
  | { kind: "spectrum"; pos: PosKey; fGHz: number; y: number; px: number; py: number; pw: number }
  | { kind: "peak"; peak: Peak; px: number; py: number; pw: number }
  | { kind: "line"; line: CatalogLine; px: number; py: number; pw: number };

/** tamaño del trazo vertical de cada línea del catálogo en su carril: más intensa = más alta */
function tickSize(logI: number): number {
  const t = Math.min(1, Math.max(0, (logI + 9) / 6.5));
  return 5 + t * 9;
}

export default function SpectrumView(p: SpectrumViewProps) {
  const { spectra, active, shown, v, rest, guides, lines, laneSpecies, peaks, sigma, baseline } = p;
  const hover = p.hoverSpecies ?? null;

  // marco de la abscisa: LSRK observado o reposo (desplazando el espectro con la v elegida)
  const toX = useMemo(() => (rest ? (fGHz: number) => toRestFrameGHz(fGHz, v) : (fGHz: number) => fGHz), [rest, v]);
  const fromX = useMemo(
    () => (rest ? (xGHz: number) => xGHz * (1 - v / 299792.458) : (xGHz: number) => xGHz),
    [rest, v],
  );

  const xAxisData = useMemo(() => spectra.freq_GHz.map(toX), [spectra.freq_GHz, toX]);

  const traces = useMemo<Data[]>(() => {
    const out: Data[] = [];
    // espectros: la posición activa se dibuja al final (encima)
    const order = [...shown.filter((s) => s !== active), active];
    for (const pos of order) {
      const isActive = pos === active;
      out.push({
        type: "scatter",
        mode: "lines",
        name: POSITION_LABELS[pos],
        x: xAxisData,
        y: spectra[pos],
        xaxis: "x",
        yaxis: "y",
        line: { color: POSITION_COLORS[pos], width: isActive ? 1.3 : 1.0, shape: "hvh", simplify: false },
        opacity: isActive ? 1 : 0.8,
        hoverinfo: "none",
        meta: { kind: "spectrum", pos },
        connectgaps: false,
      });
    }

    // picos detectados (posición activa)
    if (peaks && peaks.length) {
      out.push({
        type: "scatter",
        mode: "markers",
        name: "Picos",
        x: peaks.map((pk) => toX(pk.fit?.ok && pk.fit.center_GHz ? pk.fit.center_GHz : pk.freq_GHz)),
        y: peaks.map((pk) => pk.peak_Jy + 2.2 * sigma),
        xaxis: "x",
        yaxis: "y",
        marker: {
          symbol: "triangle-down",
          size: 7,
          color: C.marker,
          line: { width: 0 },
        },
        hoverinfo: "none",
        meta: { kind: "peaks" },
      });
    }

    // carriles de especies (código de barras): un trazo por especie
    const bySpecies = new Map<string, CatalogLine[]>();
    for (const l of lines) {
      const arr = bySpecies.get(l.species) ?? [];
      arr.push(l);
      bySpecies.set(l.species, arr);
    }
    for (const sp of laneSpecies) {
      const ls = bySpecies.get(sp) ?? [];
      const info = speciesInfo(sp);
      out.push({
        type: "scatter",
        mode: "markers",
        name: info.formula,
        x: ls.map((l) => (rest ? l.rest_MHz / 1000 : observedFreqGHz(l.rest_MHz, v))),
        y: ls.map(() => info.formula),
        xaxis: "x",
        yaxis: "y2",
        marker: {
          symbol: "line-ns",
          size: ls.map((l) => tickSize(l.logI_300K)),
          line: { color: info.color, width: hover === sp ? 3 : 2 },
          color: info.color,
        },
        opacity: hover && hover !== sp ? 0.35 : 1,
        hoverinfo: "none",
        meta: { kind: "lane", species: sp },
      });
    }
    return out;
  }, [shown, active, xAxisData, spectra, peaks, sigma, toX, lines, laneSpecies, rest, v, hover]);

  const flash = p.flashRange ?? null;
  const shapes = useMemo<Partial<Shape>[]>(() => {
    const s: Partial<Shape>[] = [
      {
        type: "rect",
        xref: "paper",
        yref: "y",
        x0: 0,
        x1: 1,
        y0: baseline - sigma,
        y1: baseline + sigma,
        fillcolor: C.band,
        line: { width: 0 },
        layer: "below",
      },
    ];
    if (flash) {
      s.push({
        type: "rect",
        xref: "x",
        yref: "y domain" as Shape["yref"],
        x0: toX(flash[0]),
        x1: toX(flash[1]),
        y0: 0,
        y1: 1,
        fillcolor: "rgba(255,184,0,0.10)",
        line: { color: "rgba(255,184,0,0.45)", width: 1 },
        layer: "below",
      });
    }
    if (guides) {
      // pocas especies → guías más visibles; muchas → apenas un susurro
      const nSp = new Set(lines.map((l) => l.species)).size;
      const op = nSp <= 2 ? 0.55 : nSp <= 5 ? 0.35 : 0.2;
      for (const l of lines) {
        const x = rest ? l.rest_MHz / 1000 : observedFreqGHz(l.rest_MHz, v);
        const isHover = hover === l.species;
        s.push({
          type: "line",
          xref: "x",
          yref: "y domain" as Shape["yref"],
          x0: x,
          x1: x,
          y0: 0,
          y1: 1,
          line: { color: speciesInfo(l.species).color, width: isHover ? 1.5 : 1 },
          opacity: hover ? (isHover ? 0.85 : 0.08) : op,
          layer: "below",
        });
      }
    }
    return s;
  }, [baseline, sigma, guides, lines, rest, v, hover, flash, toX]);

  // anotaciones editoriales: los picos más brillantes sin candidata en el catálogo
  const annotations = useMemo(() => {
    if (!p.annotateUnidentified || !peaks) return [];
    const fr = spectra.freq_GHz;
    const xmid = (fr[0] + fr[fr.length - 1]) / 2;
    let ymax = 0;
    for (const y of spectra[active]) if (y !== null && y > ymax) ymax = y;
    const vr = p.vRef ?? v;
    // "sin identificar": ninguna transición del catálogo a menos de 0.6 km/s de la velocidad de referencia
    const unidentified = (pk: Peak) => !(pk.candidates ?? []).some((c) => Math.abs(c.v_kms - vr) <= 0.6);
    return peaks
      .filter((pk) => pk.peak_Jy > 0 && pk.snr >= 10 && unidentified(pk))
      .sort((a, b) => b.snr - a.snr)
      .slice(0, 3)
      .map((pk) => {
        const fx = pk.fit?.ok && pk.fit.center_GHz ? pk.fit.center_GHz : pk.freq_GHz;
        const leftHalf = fx < xmid;
        const nearTop = pk.peak_Jy > 0.7 * ymax;
        return {
          x: toX(fx),
          y: pk.peak_Jy,
          xref: "x" as const,
          yref: "y" as const,
          text: `<i>sin identificar</i>  S/N ${pk.snr.toFixed(0)}`,
          showarrow: true,
          arrowhead: 0,
          arrowwidth: 1,
          arrowcolor: C.ink2,
          // la etiqueta se coloca hacia el lado libre y, si el pico roza el techo, por debajo
          ax: leftHalf ? 70 : -70,
          ay: nearTop ? 36 : -28,
          xanchor: (leftHalf ? "left" : "right") as "left" | "right",
        font: { family: "Newsreader Variable, Georgia, serif", size: 12.5, color: C.ink },
          bgcolor: "rgba(11,17,32,0.85)",
          bordercolor: C.rule,
          borderpad: 3,
        };
      });
  }, [p.annotateUnidentified, p.vRef, v, peaks, toX, spectra, active]);

  // rango por defecto = la ventana completa (Plotly añadiría margen por los marcadores)
  const fullRange = useMemo<[number, number]>(() => {
    const fr = spectra.freq_GHz;
    const a = Math.min(fr[0], fr[fr.length - 1]);
    const b = Math.max(fr[0], fr[fr.length - 1]);
    const h = Math.abs(fr[1] - fr[0]) / 2;
    return [a - h, b + h];
  }, [spectra.freq_GHz]);
  const displayRange = (p.xRange ?? fullRange).map(toX) as [number, number];
  // el carril de códigos de barras crece con el nº de especies visibles (1 carril ≈ 3 % de la altura)
  const laneFrac = Math.min(0.33, Math.max(0.07, 0.028 * laneSpecies.length + 0.03));

  const layout = useMemo<Partial<Layout>>(
    () => ({
      height: p.height ?? 620,
      autosize: true,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 84, r: 14, t: 8, b: 44 },
      font: { family: SANS, size: 11, color: C.muted },
      showlegend: false,
      dragmode: "zoom",
      hovermode: "closest",
      hoverdistance: 14,
      selectdirection: "h",
      uirevision: `${p.xRange ? p.xRange.join(",") : "full"}|${p.yRange ? p.yRange.join(",") : "auto"}`,
      xaxis: {
        anchor: "y2",
        domain: [0, 1],
        title: {
          text: rest ? `Frecuencia en reposo (GHz) a v = ${v.toFixed(2)} km/s` : "Frecuencia LSRK (GHz)",
          font: { family: SANS, size: 11.5, color: C.ink2 },
          standoff: 8,
        },
        tickformat: ".3f",
        gridcolor: C.grid,
        linecolor: C.rule,
        zeroline: false,
        ticks: "outside",
        ticklen: 4,
        tickcolor: C.rule,
        range: displayRange,
        autorange: false,
      },
      yaxis: {
        domain: [laneFrac + 0.05, 1],
        title: {
          text: "Intensidad (Jy/beam)",
          font: { family: SANS, size: 11.5, color: C.ink2 },
        },
        gridcolor: C.grid,
        zeroline: true,
        zerolinecolor: C.rule,
        linecolor: C.rule,
        tickformat: ".2f",
        ...(p.yRange ? { range: p.yRange, autorange: false } : { autorange: true }),
      },
      yaxis2: {
        domain: [0, laneFrac],
        type: "category",
        categoryorder: "array",
        categoryarray: laneSpecies.map((s) => speciesInfo(s).formula),
        tickmode: "array",
        tickvals: laneSpecies.map((s) => speciesInfo(s).formula),
        ticktext: laneSpecies.map((s) => speciesInfo(s).formula),
        range: [laneSpecies.length - 0.5, -0.5],
        autorange: false,
        fixedrange: true,
        showgrid: true,
        gridcolor: C.grid,
        tickfont: { family: SANS, size: 11, color: C.ink2 },
        linecolor: C.rule,
      },
      shapes,
      annotations,
    }),
    [p.height, rest, v, displayRange[0], displayRange[1], p.xRange, p.yRange, laneSpecies, laneFrac, shapes, annotations], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const config = useMemo<Partial<Config>>(
    () => ({
      displaylogo: false,
      responsive: true,
      scrollZoom: false,
      modeBarButtonsToRemove: ["lasso2d", "autoScale2d", "resetScale2d", "toImage"],
      doubleClick: false,
    }),
    [],
  );

  function handleRelayout(e: Readonly<PlotRelayoutEvent>) {
    const ev = e as Record<string, unknown>;
    if (ev["xaxis.autorange"] === true || ev["autosize"] === true) {
      if (ev["xaxis.autorange"] === true) p.onRangeChange(null, null);
      return;
    }
    const xr0 = Array.isArray(ev["xaxis.range"]) ? (ev["xaxis.range"] as unknown[]) : null;
    const x0 = xr0 ? xr0[0] : ev["xaxis.range[0]"];
    const x1 = xr0 ? xr0[1] : ev["xaxis.range[1]"];
    const y0 = ev["yaxis.range[0]"];
    const y1 = ev["yaxis.range[1]"];
    if (typeof x0 === "number" && typeof x1 === "number") {
      const xr: [number, number] = [fromX(x0), fromX(x1)];
      const yr: [number, number] | null = typeof y0 === "number" && typeof y1 === "number" ? [y0, y1] : null;
      p.onRangeChange(xr, yr);
    } else if (typeof y0 === "number" && typeof y1 === "number") {
      p.onRangeChange(p.xRange, [y0, y1]);
    } else if (ev["yaxis.autorange"] === true) {
      p.onRangeChange(p.xRange, null);
    }
  }

  // tooltip propio (KaTeX, tipografía de la página) en lugar del de Plotly
  const bySpecies = useMemo(() => {
    const m = new Map<string, CatalogLine[]>();
    for (const l of lines) m.set(l.species, [...(m.get(l.species) ?? []), l]);
    return m;
  }, [lines]);
  function handleHover(e: Readonly<PlotMouseEvent>) {
    const onHover = p.onHoverPoint;
    if (!onHover) return;
    const pt = e.points?.[0];
    if (!pt) return;
    const gd = (e.event?.target as Element | null)?.closest?.(".js-plotly-plot") as HTMLElement | null;
    const rect = gd?.getBoundingClientRect();
    const px = rect ? e.event.clientX - rect.left : 0;
    const py = rect ? e.event.clientY - rect.top : 0;
    const pw = rect ? rect.width : 1000;
    const meta = (pt.data as { meta?: { kind: string; pos?: PosKey; species?: string } }).meta;
    const i = pt.pointIndex ?? pt.pointNumber;
    if (!meta) return;
    if (meta.kind === "spectrum" && meta.pos) {
      onHover({ kind: "spectrum", pos: meta.pos, fGHz: spectra.freq_GHz[i], y: spectra[meta.pos][i] ?? NaN, px, py, pw });
    } else if (meta.kind === "peaks" && peaks) {
      onHover({ kind: "peak", peak: peaks[i], px, py, pw });
    } else if (meta.kind === "lane" && meta.species) {
      const l = bySpecies.get(meta.species)?.[i];
      if (l) onHover({ kind: "line", line: l, px, py, pw });
    }
  }

  function handleSelected(e: Readonly<PlotSelectionEvent> | undefined) {
    const r = e?.range?.x;
    if (r && r.length === 2) p.onSelectRange([fromX(Number(r[0])), fromX(Number(r[1]))]);
    else p.onSelectRange(null);
  }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={config}
      useResizeHandler
      style={{ width: "100%", height: p.height ?? 620 }}
      onRelayout={handleRelayout}
      onHover={handleHover}
      onUnhover={() => p.onHoverPoint?.(null)}
      onSelected={handleSelected}
      onDeselect={() => p.onSelectRange(null)}
      onDoubleClick={() => p.onRangeChange(null, null)}
    />
  );
}

export const ALL_SPECIES_ORDER = SPECIES.map((s) => s.key);

"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Data, Layout, Shape, PlotRelayoutEvent, PlotSelectionEvent, Config } from "plotly.js";
import type { CatalogLine, Peak, PosKey, WindowSpectra } from "@/lib/data";
import { observedFreqGHz, toRestFrameGHz } from "@/lib/spectro";
import { POSITION_COLORS, SPECIES, speciesInfo } from "@/lib/species";
import { POSITION_LABELS } from "@/lib/config";

const Plot = dynamic(() => import("./Plot"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[620px] items-center justify-center text-sm text-muted">Cargando el graficador…</div>
  ),
});

const C = {
  plate: "#191c38",
  grid: "#262a52",
  rule: "#3d4379",
  ink: "#ece6d6",
  ink2: "#b6b7cb",
  muted: "#8189a9",
};

export interface SpectrumViewProps {
  spectra: WindowSpectra;
  active: PosKey;
  shown: PosKey[];
  v: number;
  rest: boolean;
  guides: boolean;
  lines: CatalogLine[];
  laneSpecies: string[];
  peaks: Peak[] | null;
  sigma: number;
  baseline: number;
  /** rango x en GHz LSRK (null = completo) */
  xRange: [number, number] | null;
  yRange: [number, number] | null;
  onRangeChange: (x: [number, number] | null, y: [number, number] | null) => void;
  onSelectRange: (r: [number, number] | null) => void;
  height?: number;
}

/** tamaño del trazo vertical de cada línea del catálogo en su carril: más intensa = más alta */
function tickSize(logI: number): number {
  const t = Math.min(1, Math.max(0, (logI + 9) / 6.5));
  return 5 + t * 9;
}

export default function SpectrumView(p: SpectrumViewProps) {
  const { spectra, active, shown, v, rest, guides, lines, laneSpecies, peaks, sigma, baseline } = p;

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
        line: { color: POSITION_COLORS[pos], width: isActive ? 1.4 : 1.1, shape: "hvh" },
        opacity: isActive ? 1 : 0.8,
        hovertemplate: `${POSITION_LABELS[pos]}<br>%{x:.5f} GHz<br>%{y:.3f} Jy/beam<extra></extra>`,
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
          color: "rgba(236,230,214,0.55)",
          line: { width: 0 },
        },
        customdata: peaks.map((pk) => [
          pk.id,
          pk.snr.toFixed(1),
          pk.fit?.fwhm_kms !== undefined ? pk.fit.fwhm_kms.toFixed(2) : "—",
          (pk.flags ?? []).join(", ") || "sin banderas",
          pk.candidates?.[0]
            ? `${speciesInfo(pk.candidates[0].species).formula} @ ${pk.candidates[0].v_kms.toFixed(2)} km/s`
            : "sin candidata",
        ]),
        hovertemplate:
          "<b>%{customdata[0]}</b><br>SNR %{customdata[1]} · FWHM %{customdata[2]} km/s<br>%{customdata[3]}<br>1ª candidata: %{customdata[4]}<extra></extra>",
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
          line: { color: info.color, width: 2 },
          color: info.color,
        },
        customdata: ls.map((l) => [
          info.formula,
          info.name,
          l.rest_MHz.toFixed(4),
          l.Eu_K.toFixed(1),
          l.logI_300K.toFixed(2),
          `${l.catalog} ${l.entry}`,
          `${l.qn_up} → ${l.qn_lo}`,
          observedFreqGHz(l.rest_MHz, v).toFixed(5),
        ]),
        hovertemplate:
          "<b>%{customdata[0]}</b> %{customdata[1]}<br>ν reposo %{customdata[2]} MHz<br>ν obs. %{customdata[7]} GHz<br>E<sub>u</sub> %{customdata[3]} K · log I %{customdata[4]}<br>%{customdata[5]} · %{customdata[6]}<extra></extra>",
      });
    }
    return out;
  }, [shown, active, xAxisData, spectra, peaks, sigma, toX, lines, laneSpecies, rest, v]);

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
        fillcolor: "rgba(236,230,214,0.09)",
        line: { width: 0 },
        layer: "below",
      },
    ];
    if (guides) {
      // pocas especies → guías más visibles; muchas → apenas un susurro
      const nSp = new Set(lines.map((l) => l.species)).size;
      const op = nSp <= 2 ? 0.55 : nSp <= 5 ? 0.35 : 0.2;
      for (const l of lines) {
        const x = rest ? l.rest_MHz / 1000 : observedFreqGHz(l.rest_MHz, v);
        s.push({
          type: "line",
          xref: "x",
          yref: "y domain" as Shape["yref"],
          x0: x,
          x1: x,
          y0: 0,
          y1: 1,
          line: { color: speciesInfo(l.species).color, width: 1 },
          opacity: op,
          layer: "below",
        });
      }
    }
    return s;
  }, [baseline, sigma, guides, lines, rest, v]);

  // rango por defecto = la ventana completa (Plotly añadiría margen por los marcadores)
  const fullRange = useMemo<[number, number]>(() => {
    const fr = spectra.freq_GHz;
    const a = Math.min(fr[0], fr[fr.length - 1]);
    const b = Math.max(fr[0], fr[fr.length - 1]);
    const h = Math.abs(fr[1] - fr[0]) / 2;
    return [a - h, b + h];
  }, [spectra.freq_GHz]);
  const displayRange = (p.xRange ?? fullRange).map(toX) as [number, number];

  const layout = useMemo<Partial<Layout>>(
    () => ({
      height: p.height ?? 620,
      autosize: true,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: C.plate,
      margin: { l: 96, r: 18, t: 10, b: 48 },
      font: { family: "var(--nf-mono), ui-monospace, monospace", size: 11, color: C.ink2 },
      hoverlabel: {
        bgcolor: "#212548",
        bordercolor: C.rule,
        font: { family: "var(--nf-display), system-ui, sans-serif", size: 13, color: C.ink },
      },
      showlegend: false,
      dragmode: "zoom",
      hovermode: "closest",
      selectdirection: "h",
      uirevision: "spectrum",
      xaxis: {
        anchor: "y2",
        domain: [0, 1],
        title: {
          text: rest ? `Frecuencia en reposo (GHz), v = ${v.toFixed(2)} km/s` : "Frecuencia LSRK (GHz)",
          font: { family: "var(--nf-display), system-ui, sans-serif", size: 13, color: C.ink2 },
          standoff: 8,
        },
        tickformat: ".3f",
        gridcolor: C.grid,
        linecolor: C.rule,
        zeroline: false,
        ticks: "outside",
        tickcolor: C.rule,
        range: displayRange,
        autorange: false,
      },
      yaxis: {
        domain: [0.38, 1],
        title: {
          text: "Intensidad (Jy/beam)",
          font: { family: "var(--nf-display), system-ui, sans-serif", size: 13, color: C.ink2 },
        },
        gridcolor: C.grid,
        zeroline: true,
        zerolinecolor: C.rule,
        linecolor: C.rule,
        tickformat: ".2f",
        ...(p.yRange ? { range: p.yRange, autorange: false } : { autorange: true }),
      },
      yaxis2: {
        domain: [0, 0.33],
        type: "category",
        categoryorder: "array",
        categoryarray: laneSpecies.map((s) => speciesInfo(s).formula),
        tickmode: "array",
        tickvals: laneSpecies.map((s) => speciesInfo(s).formula),
        ticktext: laneSpecies.map((s) => speciesInfo(s).formula),
        autorange: "reversed",
        fixedrange: true,
        showgrid: true,
        gridcolor: C.grid,
        tickfont: { family: "var(--nf-display), system-ui, sans-serif", size: 11, color: C.ink2 },
        linecolor: C.rule,
      },
      shapes,
    }),
    [p.height, rest, v, displayRange[0], displayRange[1], p.yRange, laneSpecies, shapes], // eslint-disable-line react-hooks/exhaustive-deps
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
      onSelected={handleSelected}
      onDeselect={() => p.onSelectRange(null)}
      onDoubleClick={() => p.onRangeChange(null, null)}
    />
  );
}

export const ALL_SPECIES_ORDER = SPECIES.map((s) => s.key);

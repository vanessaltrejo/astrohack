"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Tex, SYM } from "./Tex";
import type { Continuum, Meta, Peaks, PipelineMeta, PosKey } from "@/lib/data";
import { POSITION_KEYS, WINDOW_KEYS } from "@/lib/data";
import { CONTINUUM_BEAM_PA_FALLBACK_DEG, POSITION_LABELS } from "@/lib/config";
import { POSITION_COLORS } from "@/lib/species";
import { asinhInverse, asinhStretch } from "@/lib/spectro";
import { heat, heatCss } from "@/lib/colormap";
import { decDms, f, raHms } from "@/lib/format";
import { Pending } from "./ui";

export interface FieldMapProps {
  continuum: Continuum | null;
  meta: Meta;
  active: PosKey;
  setActive: (p: PosKey) => void;
  sigmaOf: (w: "W1" | "W2", p: PosKey) => number;
  peaks: Peaks | null;
  pipeline: PipelineMeta | null;
}

const BETA_FRAC = 0.01; // β del asinh como fracción del máximo
const INK = "#f2f6fa";
const NIGHT = "#0b1120";

/** Mapa del continuo con las tres posiciones; panel lateral compacto junto al espectro. */
export default function FieldMap({ continuum, meta, active, setActive, sigmaOf, peaks, pipeline }: FieldMapProps) {
  const [zoom, setZoom] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number; val: number | null } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [href, setHref] = useState<string | null>(null);
  // anillo que se expande una vez al cambiar la posición activa
  const [ringKey, setRingKey] = useState(0);
  const firstRing = useRef(true);
  useEffect(() => {
    if (firstRing.current) {
      firstRing.current = false;
      return;
    }
    setRingKey((k) => k + 1);
  }, [active]);

  const stats = useMemo(() => {
    if (!continuum) return null;
    let max = -Infinity;
    for (const row of continuum.data) for (const v of row) if (v !== null && Number.isFinite(v) && v > max) max = v;
    return { max, beta: max * BETA_FRAC };
  }, [continuum]);

  // rasteriza una vez; la fila 0 de FITS es la de abajo → se invierte y
  useEffect(() => {
    if (!continuum || !stats) return;
    const { nx, ny, data } = continuum;
    const c = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = c;
    c.width = nx;
    c.height = ny;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(nx, ny);
    for (let j = 0; j < ny; j++) {
      const row = data[j];
      const sy = ny - 1 - j;
      for (let i = 0; i < nx; i++) {
        const v = row?.[i];
        const o = (sy * nx + i) * 4;
        if (v === null || v === undefined || !Number.isFinite(v)) {
          img.data[o + 3] = 0;
          continue;
        }
        const [r, g, b] = heat(asinhStretch(v, stats.beta, stats.max));
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    setHref(c.toDataURL("image/png"));
  }, [continuum, stats]);

  if (!continuum || !stats) return <Pending what="continuum.json" />;

  const { nx, ny, pixel_arcsec: pix } = continuum;
  const toSvg = (x: number, y: number) => ({ cx: x + 0.5, cy: ny - y - 0.5 });
  const pts = POSITION_KEYS.map((k) => ({ k, ...toSvg(continuum.positions[k].x, continuum.positions[k].y) }));

  // vista: núcleo (encuadre de las tres posiciones) o campo completo
  const pad = 26;
  const xs = pts.map((q) => q.cx);
  const ys = pts.map((q) => q.cy);
  const cx0 = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy0 = (Math.min(...ys) + Math.max(...ys)) / 2;
  const half = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 + pad;
  const vb = zoom ? { x: cx0 - half, y: cy0 - half, w: 2 * half, h: 2 * half } : { x: 0, y: 0, w: nx, h: ny };
  const k = vb.w / 100; // unidad visual relativa al encuadre

  const bmaj = continuum.beam_arcsec?.[0] ?? null;
  const bmin = continuum.beam_arcsec?.[1] ?? null;
  const bpa = continuum.beam_pa_deg ?? CONTINUUM_BEAM_PA_FALLBACK_DEG;
  // PA desde el norte hacia el este; con el este a la izquierda, el eje mayor apunta a (−sin PA, −cos PA)
  const beamAngle = (Math.atan2(-Math.cos((bpa * Math.PI) / 180), -Math.sin((bpa * Math.PI) / 180)) * 180) / Math.PI;
  const arcsecPx = 1 / pix;
  const center = { x: (nx - 1) / 2, y: (ny - 1) / 2 };

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return;
    const q = pt.matrixTransform(m.inverse());
    const i = Math.floor(q.x);
    const jScreen = Math.floor(q.y);
    const j = ny - 1 - jScreen;
    if (i < 0 || i >= nx || j < 0 || j >= ny) return setHover(null);
    const val = continuum!.data[j]?.[i] ?? null;
    setHover({ x: i, y: j, val });
  }

  const legendStops = Array.from({ length: 48 }, (_, i) => i / 47);
  const legendTicks = [0, 0.5, 1].map((t) => ({ t, v: asinhInverse(t, stats.beta, stats.max) }));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="serif text-[1.1rem]">
          Continuo a 0.86 mm <em className="text-ink-2">y posiciones</em>
        </h3>
        <button type="button" className="btn btn-quiet py-0.5" onClick={() => setZoom((z) => !z)} title={zoom ? "Ver el campo completo" : "Encuadrar las tres posiciones"}>
          {zoom ? <Maximize2 className="icon" /> : <Minimize2 className="icon" />}
          {zoom ? "Campo" : "Núcleo"}
        </button>
      </div>
      <div className="plate overflow-hidden p-0">
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="block aspect-square w-full"
          role="img"
          aria-label="Continuo a 0.86 mm con las tres posiciones de extracción"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <rect x={0} y={0} width={nx} height={ny} fill="#111a2b" />
          {href ? (
            <image href={href} x={0} y={0} width={nx} height={ny} style={{ imageRendering: "pixelated" }} preserveAspectRatio="none" />
          ) : null}

          {pts.map((q) => {
            const isA = q.k === active;
            return (
              <g
                key={q.k}
                role="button"
                tabIndex={0}
                aria-label={`Activar ${POSITION_LABELS[q.k]}`}
                className="mapmark cursor-pointer"
                onClick={() => setActive(q.k)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActive(q.k);
                }}
              >
                <circle className="mapmark-hit" cx={q.cx} cy={q.cy} r={3.4 * k} fill="transparent" strokeWidth={0.4 * k} />
                <circle cx={q.cx} cy={q.cy} r={(isA ? 2.4 : 1.7) * k} fill="none" stroke={NIGHT} strokeWidth={0.9 * k} />
                <circle
                  cx={q.cx}
                  cy={q.cy}
                  r={(isA ? 2.4 : 1.7) * k}
                  fill="none"
                  stroke={POSITION_COLORS[q.k]}
                  strokeWidth={(isA ? 0.6 : 0.4) * k}
                  style={{ transition: "r 200ms cubic-bezier(0,0,0,1), stroke-width 200ms ease" }}
                />
                <circle cx={q.cx} cy={q.cy} r={0.35 * k} fill={POSITION_COLORS[q.k]} />
                {isA && ringKey > 0 ? (
                  <circle key={ringKey} className="ring-once" cx={q.cx} cy={q.cy} r={2 * k} fill="none" stroke={POSITION_COLORS[q.k]} strokeWidth={0.4 * k} style={{ transformBox: "fill-box" }} />
                ) : null}
                <text
                  x={q.cx + (q.k === "B_pico" ? -3.2 * k : 3.2 * k)}
                  y={q.cy + (q.k === "B_pico" ? -2.6 * k : 3.8 * k)}
                  textAnchor={q.k === "B_pico" ? "end" : "start"}
                  fontSize={3.3 * k}
                  fill={INK}
                  stroke={NIGHT}
                  strokeWidth={0.8 * k}
                  paintOrder="stroke"
                  fontWeight={isA ? 700 : 500}
                  fontFamily='"IBM Plex Sans", sans-serif'
                >
                  {POSITION_LABELS[q.k]}
                </text>
              </g>
            );
          })}

          {/* haz y barra de escala, en la esquina inferior */}
          {bmaj && bmin ? (
            <g transform={`translate(${vb.x + 6 * k + (bmaj / pix) / 2}, ${vb.y + vb.h - 6 * k - (bmaj / pix) / 2})`}>
              <ellipse
                rx={bmaj / pix / 2}
                ry={bmin / pix / 2}
                transform={`rotate(${beamAngle})`}
                fill="rgba(242,246,250,0.22)"
                stroke={INK}
                strokeWidth={0.25 * k}
              />
            </g>
          ) : null}
          <g transform={`translate(${vb.x + vb.w - 6 * k - arcsecPx}, ${vb.y + vb.h - 6 * k})`}>
            <line x1={0} x2={arcsecPx} y1={0} y2={0} stroke={INK} strokeWidth={0.45 * k} />
            <line x1={0} x2={0} y1={-1 * k} y2={1 * k} stroke={INK} strokeWidth={0.35 * k} />
            <line x1={arcsecPx} x2={arcsecPx} y1={-1 * k} y2={1 * k} stroke={INK} strokeWidth={0.35 * k} />
            <text x={arcsecPx / 2} y={-2 * k} textAnchor="middle" fontSize={3.2 * k} fill={INK} fontFamily='"IBM Plex Sans", sans-serif'>
              1″
            </text>
          </g>
          <g transform={`translate(${vb.x + 6 * k}, ${vb.y + 7 * k})`} fontSize={3 * k} fill="#b8c0cf" fontFamily='"IBM Plex Sans", sans-serif'>
            <text x={0} y={0}>N ↑</text>
            <text x={0} y={4.2 * k}>E ←</text>
          </g>
        </svg>
      </div>

      {/* escala de color + lectura del cursor */}
      <div className="mt-2">
        <div className="flex h-1.5 overflow-hidden" aria-hidden>
          {legendStops.map((t) => (
            <span key={t} className="flex-1" style={{ background: heatCss(t) }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[0.7rem] text-muted">
          {legendTicks.map(({ t, v }) => (
            <span key={t}>{v < 0.01 ? f(v * 1000, 1) : f(v * 1000, 0)}</span>
          ))}
          <span className="ml-2 text-ink-2">mJy/beam, asinh</span>
        </div>
        <p className="mt-1 min-h-[1.1rem] text-[0.72rem] text-muted">
          {hover ? (
            <>
              <Tex>{String.raw`\Deltalpha`}</Tex> {f((center.x - hover.x) * pix, 2)}″, <Tex>{String.raw`\Delta\delta`}</Tex>{" "}
              {f((hover.y - center.y) * pix, 2)}″ {hover.val !== null ? `· ${f(hover.val * 1000, 1)} mJy/beam` : ""}
            </>
          ) : (
            " "
          )}
        </p>
      </div>

      {/* posiciones */}
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {POSITION_KEYS.map((pos) => {
          const m = meta.positions[pos];
          const isA = pos === active;
          const va = pipeline?.v_adopted?.[pos];
          const nPk = peaks ? WINDOW_KEYS.reduce((s, w) => s + (peaks[w]?.[pos]?.length ?? 0), 0) : null;
          return (
            <li key={pos}>
              <button
                type="button"
                onClick={() => setActive(pos)}
                aria-pressed={isA}
                className={`grid w-full grid-cols-[0.9rem_1fr] items-start gap-x-2 px-1 py-2 text-left transition-colors duration-150 hover:bg-plate-2 ${
                  isA ? "bg-plate-2" : ""
                }`}
                style={isA ? { boxShadow: `inset 2px 0 0 ${POSITION_COLORS[pos]}` } : undefined}
              >
                <span className="mt-[0.45rem] h-[2px] w-3" style={{ background: POSITION_COLORS[pos] }} />
                <span className="min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`text-[0.9rem] ${isA ? "font-semibold text-ink" : "text-ink-2"}`}>{POSITION_LABELS[pos]}</span>
                    <span className="text-[0.68rem] text-muted">
                      {raHms(m.ra_deg)} {decDms(m.dec_deg)}
                    </span>
                  </span>
                  <span className="mt-0.5 grid grid-cols-3 gap-x-2 text-[0.72rem] text-ink-2">
                    <span>
                      <Tex className="text-muted">{SYM.vlsr}</Tex> {va ? `${f(va.v_kms, 2)} ± ${f(va.err_kms ?? null, 2)}` : f(m.v_start_kms, 2)}
                    </span>
                    <span>
                      <Tex className="text-muted">{SYM.sigma}</Tex> {f(sigmaOf("W1", pos) * 1000, 0)} / {f(sigmaOf("W2", pos) * 1000, 0)}
                    </span>
                    <span>
                      <span className="text-muted">picos</span> {nPk ?? "—"}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="caption mt-2">
        <Tex>{SYM.vlsr}</Tex> adoptada en km/s y <Tex>{SYM.sigma}</Tex> de W1 / W2 en mJy/beam. Haz del continuo{" "}
        {continuum.beam_arcsec ? `${f(continuum.beam_arcsec[0], 2)}″ × ${f(continuum.beam_arcsec[1], 2)}″` : "—"}, píxel {f(pix, 2)}″.
      </p>
    </div>
  );
}

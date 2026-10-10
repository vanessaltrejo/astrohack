"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { V_MAX, V_MIN, V_STEP } from "@/lib/config";
import { f } from "@/lib/format";
import { Tex, SYM } from "./Tex";

/**
 * Control de v_LSR: pista con relleno hasta el valor, marcas de la velocidad inicial
 * (organizadores) y la adoptada (pipeline), pasos finos (±0.05) y gruesos (Mayús: ±0.5),
 * entrada numérica, y lectura de Δv respecto a la adoptada. Flechas del teclado sobre la pista.
 */
export default function VelocitySlider({
  v,
  setV,
  vStart,
  vAdopted,
  pulse,
  stepKms,
}: {
  v: number;
  setV: (v: number) => void;
  vStart: number;
  vAdopted: number | null;
  pulse: number;
  stepKms: number;
}) {
  const pct = (x: number) => ((x - V_MIN) / (V_MAX - V_MIN)) * 100;
  const clamp = (x: number) => Math.min(V_MAX, Math.max(V_MIN, Math.round(x / V_STEP) * V_STEP));
  const [text, setText] = useState(v.toFixed(2));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(v.toFixed(2));
  }, [v]);

  const commit = () => {
    editing.current = false;
    const n = Number(text.replace(",", "."));
    if (Number.isFinite(n)) setV(clamp(n));
    else setText(v.toFixed(2));
  };
  const dv = vAdopted !== null ? v - vAdopted : null;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-6">
      {/* lectura + entrada numérica */}
      <label className="flex items-baseline gap-2">
        <Tex className="text-ink-2">{SYM.vlsr}</Tex>
        <span key={pulse} className={`relative ${pulse ? "flash-once" : ""}`}>
          <input
            className="w-[4.6rem] bg-transparent text-[1.55rem] font-light leading-none text-ink outline-none [appearance:textfield] focus:text-accent"
            value={text}
            inputMode="decimal"
            aria-label="Velocidad LSR en kilómetros por segundo"
            onFocus={() => (editing.current = true)}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "ArrowUp") setV(clamp(v + (e.shiftKey ? 0.5 : V_STEP)));
              if (e.key === "ArrowDown") setV(clamp(v - (e.shiftKey ? 0.5 : V_STEP)));
            }}
          />
        </span>
        <Tex className="text-[0.8rem] text-muted">{SYM.kms}</Tex>
      </label>

      {/* pista */}
      <div className="relative pb-6 pt-5">
        <div className="pointer-events-none absolute inset-x-0 top-[25px] h-[2px] bg-rule-strong" aria-hidden>
          <div className="h-full bg-accent/70 transition-[width] duration-75" style={{ width: `${pct(v)}%` }} />
        </div>
        {/* marcas cada 1 km/s */}
        {Array.from({ length: V_MAX - V_MIN + 1 }, (_, i) => V_MIN + i).map((t) => (
          <span key={t} className="pointer-events-none absolute top-[22px] h-[8px] w-px bg-rule-strong" style={{ left: `${pct(t)}%` }} aria-hidden>
            <span className="absolute left-1/2 top-[9px] -translate-x-1/2 text-[0.66rem] text-muted">{t}</span>
          </span>
        ))}
        <input
          id="vslider"
          className="vslider relative z-10"
          type="range"
          min={V_MIN}
          max={V_MAX}
          step={V_STEP}
          value={v}
          onChange={(e) => setV(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
              e.preventDefault();
              setV(clamp(v + (e.key === "ArrowRight" ? 0.5 : -0.5)));
            }
          }}
          aria-valuetext={`${v.toFixed(2)} kilómetros por segundo`}
        />
        {/* marcas con nombre: inicial (organizadores) y adoptada (pipeline) */}
        <button type="button" className="vtick above z-20" style={{ left: `${pct(vStart)}%`, background: "var(--color-muted)" }} onClick={() => setV(clamp(vStart))} title={`Velocidad inicial de los organizadores, ${vStart.toFixed(2)} km/s`}>
          <span>inicial {f(vStart, 2)}</span>
        </button>
        {vAdopted !== null ? (
          <button type="button" className="vtick z-20" style={{ left: `${pct(vAdopted)}%`, background: "var(--color-accent)" }} onClick={() => setV(clamp(vAdopted))} title={`Velocidad adoptada por el pipeline, ${vAdopted.toFixed(2)} km/s`}>
            <span className="text-accent">adoptada {f(vAdopted, 2)}</span>
          </button>
        ) : null}
      </div>

      {/* pasos y Δv */}
      <div className="flex flex-col items-end gap-1">
        <div className="seg" role="group" aria-label="Ajuste fino de la velocidad">
          <button type="button" onClick={(e) => setV(clamp(v - (e.shiftKey ? 0.5 : V_STEP)))} title="−0.05 km/s (Mayús: −0.5)" aria-label="Disminuir velocidad">
            <Minus className="icon" />
          </button>
          <button type="button" onClick={(e) => setV(clamp(v + (e.shiftKey ? 0.5 : V_STEP)))} title="+0.05 km/s (Mayús: +0.5)" aria-label="Aumentar velocidad">
            <Plus className="icon" />
          </button>
          <button type="button" onClick={() => setV(clamp(vAdopted ?? vStart))} title="Volver a la velocidad adoptada" aria-label="Volver a la velocidad adoptada" disabled={dv !== null && Math.abs(dv) < 1e-6}>
            <RotateCcw className="icon" />
          </button>
        </div>
        <p className="caption whitespace-nowrap">
          {dv !== null ? (
            <>
              <Tex>{String.raw`\Delta v = ` + (dv >= 0 ? "+" : "-") + Math.abs(dv).toFixed(2)}</Tex> km/s respecto a la adoptada
            </>
          ) : (
            <>paso 0.05 km/s, canal {f(stepKms, 2)} km/s</>
          )}
        </p>
      </div>
    </div>
  );
}

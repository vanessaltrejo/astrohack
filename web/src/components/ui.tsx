"use client";

import type { ReactNode } from "react";
import type { LineStatus, Verdict } from "@/lib/data";

/** Tooltip “método” con la fórmula Doppler y las convenciones. */
export function MethodTip() {
  return (
    <span className="tip">
      <button type="button" className="btn btn-quiet" aria-describedby="metodo-body">
        <span aria-hidden className="num text-[0.8em]">ƒ</span> Método
      </button>
      <span id="metodo-body" role="tooltip" className="tip-body">
        <span className="block font-semibold text-ink">Convención radio, marco LSRK</span>
        <span className="num mt-2 block text-ink">v = c · (1 − ν<sub>LSRK</sub> / ν<sub>reposo</sub>)</span>
        <span className="num block text-ink">ν<sub>obs</sub> = ν<sub>reposo</sub> · (1 − v / c)</span>
        <span className="num block">c = 299 792.458 km/s</span>
        <span className="mt-2 block">
          La corrección se aplica una sola vez, a las líneas del catálogo (o al espectro si activas “reposo”). W1 y
          W2 se tratan por separado: nunca se unen. Intensidades en Jy/beam. La banda gris es ±1σ del ruido de la
          posición activa, medido en segmentos libres de líneas.
        </span>
      </span>
    </span>
  );
}

/** Estado vacío mientras pipeline.py no publica sus productos. */
export function Pending({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <div className="pending-stripes rounded-lg border border-dashed border-rule-strong px-6 py-8 text-ink-2">
      <p className="font-semibold text-ink">Análisis en curso</p>
      <p className="mt-1 max-w-[62ch] text-sm">
        {what} todavía no está en <span className="num">/data</span>. Cuando pipeline.py lo publique, pulsa
        “Recargar análisis” arriba; no hace falta reconstruir el sitio.
      </p>
      {children}
    </div>
  );
}

const VERDICT: Record<Verdict, { label: string; icon: string; color: string }> = {
  fuerte: { label: "fuerte", icon: "●", color: "var(--color-good)" },
  tentativa: { label: "tentativa", icon: "◐", color: "var(--color-warning)" },
  insuficiente: { label: "insuficiente", icon: "○", color: "var(--color-muted)" },
  descartada: { label: "descartada", icon: "✕", color: "var(--color-critical)" },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict] ?? VERDICT.insuficiente;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-[1px] text-[0.78rem] text-ink"
      style={{ borderColor: v.color }}
    >
      <span aria-hidden style={{ color: v.color }}>
        {v.icon}
      </span>
      {v.label}
    </span>
  );
}

export const STATUS: Record<LineStatus, { label: string; icon: string; color: string; hint: string }> = {
  matched: { label: "coincide", icon: "✓", color: "var(--color-good)", hint: "hay un pico detectado a la velocidad común" },
  ambiguous: {
    label: "ambigua",
    icon: "≈",
    color: "var(--color-warning)",
    hint: "el pico existe pero otra especie lo explica igual de bien",
  },
  overbright: {
    label: "sobrebrillante",
    icon: "▲",
    color: "var(--color-serious)",
    hint: "el pico es mucho más intenso de lo que predice el modelo",
  },
  missing: {
    label: "ausente",
    icon: "✕",
    color: "var(--color-critical)",
    hint: "línea fuerte esperada sin emisión: evidencia en contra",
  },
  below_limit: {
    label: "bajo el límite",
    icon: "↓",
    color: "var(--color-muted)",
    hint: "la intensidad esperada queda bajo el ruido: no informa",
  },
  unmatched: { label: "sin pico", icon: "○", color: "var(--color-muted)", hint: "no hay un pico asociado" },
};

export function StatusTag({ status }: { status: LineStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1 text-[0.74rem] text-ink-2" title={s.hint}>
      <span aria-hidden style={{ color: s.color }}>
        {s.icon}
      </span>
      {s.label}
    </span>
  );
}

export function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
      <div>
        <h2 id={`${id}-title`} className="section-title">
          {title}
        </h2>
      </div>
      {children ? <div className="lede text-sm">{children}</div> : null}
    </header>
  );
}

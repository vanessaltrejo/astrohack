"use client";

import { POSITION_LABELS } from "@/lib/config";
import { POSITION_COLORS, speciesInfo } from "@/lib/species";
import { observedFreqGHz, toRestFrameGHz } from "@/lib/spectro";
import { f } from "@/lib/format";
import type { HoverInfo } from "./SpectrumView";
import { STATUS } from "./ui";
import { Tex, SYM } from "./Tex";

const FLAG_ES: Record<string, string> = { blend: "mezcla", absorption: "absorción", edge: "borde", weak: "débil", asymmetric: "asimétrica" };

/** Tooltip del espectro: caja nombre–valor con la tipografía y los símbolos de la página. */
export default function SpectrumTooltip({
  hover,
  rest,
  v,
  sigma,
  baseline,
  vRef,
}: {
  hover: HoverInfo | null;
  rest: boolean;
  v: number;
  sigma: number;
  baseline: number;
  vRef: number | null;
}) {
  if (!hover) return null;
  // la caja va a la derecha del cursor salvo cerca del borde derecho del gráfico
  const flip = hover.px > 0.62 * hover.pw;
  const style: React.CSSProperties = {
    position: "absolute",
    top: Math.max(8, hover.py - 12),
    ...(flip ? { right: `calc(100% - ${hover.px - 14}px)` } : { left: hover.px + 14 }),
    pointerEvents: "none",
    zIndex: 20,
  };
  void STATUS;

  let head: React.ReactNode = null;
  let rows: [React.ReactNode, React.ReactNode][] = [];

  if (hover.kind === "spectrum") {
    const snr = sigma > 0 ? (hover.y - baseline) / sigma : NaN;
    head = (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-[2px] w-4" style={{ background: POSITION_COLORS[hover.pos] }} />
        {POSITION_LABELS[hover.pos]}
      </span>
    );
    rows = [
      [<Tex key="a">{SYM.nuObs}</Tex>, `${f(hover.fGHz, 5)} GHz`],
      ...(rest ? [[<Tex key="r">{SYM.nuRest}</Tex>, `${f(toRestFrameGHz(hover.fGHz, v), 5)} GHz`] as [React.ReactNode, React.ReactNode]] : []),
      ["Intensidad", `${f(hover.y, 3)} Jy/beam`],
      [<Tex key="s">{SYM.snr}</Tex>, Number.isFinite(snr) ? f(snr, 1) : "—"],
    ];
  } else if (hover.kind === "peak") {
    const pk = hover.peak;
    const best = vRef !== null ? [...(pk.candidates ?? [])].sort((a, b) => Math.abs(a.v_kms - vRef) - Math.abs(b.v_kms - vRef))[0] : pk.candidates?.[0];
    head = (
      <span>
        Pico <span className="id">{pk.id}</span>
      </span>
    );
    rows = [
      [<Tex key="s">{SYM.snr}</Tex>, f(pk.snr, 1)],
      [<Tex key="w">{SYM.fwhm}</Tex>, pk.fit?.fwhm_kms !== undefined ? `${f(pk.fit.fwhm_kms, 2)} km/s` : "—"],
      ["Banderas", (pk.flags ?? []).map((x) => FLAG_ES[x] ?? x).join(", ") || "ninguna"],
      [
        "Candidata",
        best ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2" style={{ background: speciesInfo(best.species).color }} />
            {speciesInfo(best.species).formula} a {f(best.v_kms, 2)} km/s
            {(pk.candidates?.length ?? 0) > 1 ? <span className="text-muted"> (+{(pk.candidates?.length ?? 1) - 1})</span> : null}
          </span>
        ) : (
          <em className="text-ink-2">sin candidata en el catálogo</em>
        ),
      ],
    ];
  } else {
    const l = hover.line;
    const info = speciesInfo(l.species);
    head = (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-2 w-2" style={{ background: info.color }} />
        {info.formula} <em className="font-normal text-ink-2">{info.name}</em>
      </span>
    );
    rows = [
      [<Tex key="r">{SYM.nuRest}</Tex>, `${l.rest_MHz.toFixed(4)} MHz`],
      [<Tex key="o">{SYM.nuObs}</Tex>, `${f(observedFreqGHz(l.rest_MHz, v), 5)} GHz a ${f(v, 2)} km/s`],
      [<Tex key="e">{SYM.Eu}</Tex>, `${f(l.Eu_K, 1)} K`],
      [<Tex key="i">{SYM.logI}</Tex>, f(l.logI_300K, 2)],
      ["Entrada", <span key="c">{l.catalog} <span className="id">{l.entry}</span></span>],
      ["Transición", `${l.qn_up} → ${l.qn_lo}`],
    ];
  }

  return (
    <div style={style} className="w-max max-w-[22rem] border border-rule-strong bg-night/95 px-3 py-2 text-[0.78rem] shadow-none">
      <p className="mb-1 font-medium text-ink">{head}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-[1px]">
        {rows.map(([k, val], i) => (
          <div key={i} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-ink">{val}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

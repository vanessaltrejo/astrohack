"use client";

import type { WindowSpectra, PosKey, WinKey } from "@/lib/data";
import type { Feature } from "@/lib/modelo";

/**
 * Huellas: cada línea fuerte de la molécula, vista en velocidad (−8 … +8 km/s alrededor de la velocidad dada).
 * Si la molécula está presente, todas sus líneas fuertes deberían mostrar un pico en la línea punteada.
 */
export default function Huellas({
  feats,
  spectra,
  pos,
  v,
  c,
  nombre,
}: {
  feats: Feature[];
  spectra: Record<WinKey, WindowSpectra>;
  pos: PosKey;
  v: number;
  c: number;
  nombre: string;
}) {
  const panels = [...feats]
    .sort((a, b) => b.S - a.S)
    .slice(0, 12)
    .sort((a, b) => a.nu_reposo_MHz - b.nu_reposo_MHz)
    .map((f) => {
      for (const w of ["W1", "W2"] as WinKey[]) {
        const fr = spectra[w].freq_GHz;
        const y = spectra[w][pos] as number[];
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < fr.length; i++) {
          const vel = c * (1 - (fr[i] * 1000) / f.nu_reposo_MHz);
          if (vel >= v - 8 && vel <= v + 8) {
            xs.push(vel);
            ys.push(y[i]);
          }
        }
        if (xs.length > 5) return { f, w, xs, ys };
      }
      return { f, w: null as WinKey | null, xs: [] as number[], ys: [] as number[] };
    })
    .filter((p) => p.xs.length);
  if (!panels.length) return <p className="text-muted">Esta molécula no tiene líneas fuertes en W1 ni W2.</p>;
  const ymax = Math.max(0.1, ...panels.flatMap((p) => p.ys));
  const ymin = Math.min(-0.05, ...panels.flatMap((p) => p.ys));
  const W = 200;
  const H = 96;
  const X = (vel: number) => ((vel - (v - 8)) / 16) * W;
  const Y = (y: number) => H - ((y - ymin) / (ymax - ymin)) * H;
  const nPres = panels.filter((p) => p.f.pico).length;

  return (
    <div>
      <p className="mb-3 text-[0.9rem] text-ink-2">
        <b className="text-ink">{nombre}</b>: {nPres} de {panels.length} líneas fuertes muestran un pico en la velocidad dada (línea punteada).
        Una molécula real debería “repetirse” en todas sus líneas fuertes; las que faltan pesan en contra.
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
        {panels.map((p) => {
          const ok = !!p.f.pico;
          return (
            <figure key={p.f.nu_reposo_MHz} className="rounded-md border-2 bg-white p-2" style={{ borderColor: ok ? "#15803d" : "#b91c1c" }}>
              <figcaption className="mb-1 flex items-center justify-between text-[0.78rem]">
                <span className="tabular-nums">{p.f.nu_reposo_MHz.toFixed(2)} MHz</span>
                <span className="rounded px-1.5 font-semibold" style={{ color: ok ? "#15803d" : "#b91c1c", background: ok ? "#dcfce7" : "#fee2e2" }}>
                  {ok ? "✓ aparece" : "✗ falta"}
                </span>
              </figcaption>
              <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
                <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="#d3dae4" />
                <line x1={X(v)} x2={X(v)} y1={0} y2={H} stroke="#1d4ed8" strokeDasharray="3 3" />
                <polyline
                  fill="none"
                  stroke="#0b1220"
                  strokeWidth={1.2}
                  vectorEffect="non-scaling-stroke"
                  points={p.xs.map((x, i) => `${X(x).toFixed(1)},${Y(p.ys[i]).toFixed(1)}`).join(" ")}
                />
              </svg>
              <p className="mt-0.5 flex justify-between text-[0.7rem] text-muted">
                <span>{v - 8} km/s</span>
                <span>{p.w}</span>
                <span>{v + 8} km/s</span>
              </p>
            </figure>
          );
        })}
      </div>
      <p className="mt-2 text-[0.78rem] text-muted">Misma escala vertical en todos los paneles. Eje horizontal: velocidad radio (km/s).</p>
    </div>
  );
}

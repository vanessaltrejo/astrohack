"use client";

import { ArrowDownToLine, Dna, Droplets, Earth, Gauge, Hexagon, Layers, Link2, Sun, Telescope, Thermometer, Wind, type LucideIcon } from "lucide-react";

export type Prebiotico = {
  clase: "directa" | "solvente" | "ingrediente" | "sin_papel";
  titular: string;
  chnops: string[];
  familias: { familia: string; nombre: string; via: string }[];
  solvente: string;
  necesita_agua: boolean;
  espacio: string;
  tierra: string;
  abioticos: Record<"temperatura" | "presion" | "atmosfera" | "gravedad" | "radiacion", { espacio: string; tierra: string }>;
};

// Papel de cada elemento (presentación de apertura, diapositiva 3)
const CHNOPS: [string, string, string][] = [
  ["C", "Carbono", "estructura de las moléculas orgánicas"],
  ["H", "Hidrógeno", "agua y moléculas orgánicas"],
  ["N", "Nitrógeno", "proteínas y bases del ADN/ARN"],
  ["O", "Oxígeno", "agua y muchas biomoléculas"],
  ["P", "Fósforo", "ADN/ARN y membranas"],
  ["S", "Azufre", "algunos aminoácidos y enzimas"],
];
const BIOMOLECULAS: { k: string; nombre: string; Icon: LucideIcon }[] = [
  { k: "proteinas", nombre: "Proteínas", Icon: Link2 },
  { k: "acidos_nucleicos", nombre: "ADN / ARN", Icon: Dna },
  { k: "lipidos", nombre: "Lípidos y membranas", Icon: Layers },
  { k: "carbohidratos", nombre: "Azúcares", Icon: Hexagon },
];
const ABIOTICOS: { k: keyof Prebiotico["abioticos"]; nombre: string; Icon: LucideIcon }[] = [
  { k: "temperatura", nombre: "Temperatura", Icon: Thermometer },
  { k: "presion", nombre: "Presión", Icon: Gauge },
  { k: "atmosfera", nombre: "Aire / atmósfera", Icon: Wind },
  { k: "gravedad", nombre: "Gravedad", Icon: ArrowDownToLine },
  { k: "radiacion", nombre: "Radiación y energía", Icon: Sun },
];
const ESTILO: Record<Prebiotico["clase"], { fg: string; bg: string; borde: string }> = {
  directa: { fg: "#166534", bg: "#dcfce7", borde: "#15803d" },
  solvente: { fg: "#1e40af", bg: "#dbeafe", borde: "#1d4ed8" },
  ingrediente: { fg: "#115e59", bg: "#ccfbf1", borde: "#0f766e" },
  sin_papel: { fg: "#334155", bg: "#e2e8f0", borde: "#64748b" },
};

function Titulo({ children }: { children: React.ReactNode }) {
  return <h5 className="mb-2 text-[0.74rem] font-bold uppercase tracking-wide text-ink-2">{children}</h5>;
}

/** ¿Es prebiótica y en qué condiciones? Ingredientes, factores bióticos y abióticos, en el espacio y en la Tierra. */
export default function AnalisisPrebiotico({ p, enEspacio }: { p: Prebiotico; enEspacio: boolean }) {
  const e = ESTILO[p.clase];
  const familias = new Map(p.familias.map((f) => [f.familia, f.via]));
  return (
    <section className="space-y-4 rounded-lg border-2 p-4" style={{ borderColor: e.borde }}>
      {/* veredicto */}
      <div className="rounded-md px-3 py-2" style={{ background: e.bg, color: e.fg }}>
        <p className="text-[0.72rem] font-bold uppercase tracking-wide">Análisis prebiótico</p>
        <p className="text-[1.15rem] font-bold leading-tight">{p.titular}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-rule p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[0.8rem] font-bold">
            <Telescope className="h-4 w-4 text-accent" /> En el espacio
          </p>
          <p className={`text-[0.86rem] ${enEspacio ? "text-ink" : "font-semibold text-critical"}`}>{p.espacio}</p>
        </div>
        <div className="rounded-md border border-rule p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[0.8rem] font-bold">
            <Earth className="h-4 w-4 text-good" /> En la Tierra
          </p>
          <p className="text-[0.86rem]">{p.tierra}</p>
        </div>
      </div>

      {/* ingredientes CHNOPS */}
      <div>
        <Titulo>Ingredientes de la vida que contiene (C, H, N, O, P, S)</Titulo>
        <div className="grid grid-cols-6 gap-1.5">
          {CHNOPS.map(([el, nombre, papel]) => {
            const si = p.chnops.includes(el);
            return (
              <div
                key={el}
                title={`${nombre}: ${papel}`}
                className="flex flex-col items-center rounded-md border-2 py-1.5"
                style={si ? { background: "#0f1f4b", borderColor: "#0f1f4b", color: "#fff" } : { borderColor: "#d3dae4", color: "#94a0b4" }}
              >
                <span className="text-[1.25rem] font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  {el}
                </span>
                <span className="mt-0.5 text-[0.62rem]">{nombre}</span>
              </div>
            );
          })}
        </div>
        {p.chnops.length ? (
          <p className="mt-1.5 text-[0.8rem] text-ink-2">
            {CHNOPS.filter(([el]) => p.chnops.includes(el))
              .map(([el, , papel]) => `${el}: ${papel}`)
              .join(" · ")}
          </p>
        ) : (
          <p className="mt-1.5 text-[0.8rem] text-ink-2">No contiene ninguno de los seis elementos principales de la vida.</p>
        )}
      </div>

      {/* factores bióticos */}
      <div>
        <Titulo>Factores bióticos</Titulo>
        <div className="mb-2 flex items-start gap-2 rounded-md border-2 p-2.5" style={{ borderColor: p.clase === "solvente" || p.necesita_agua ? "#1d4ed8" : "#d3dae4" }}>
          <Droplets className="mt-0.5 h-5 w-5 flex-none" style={{ color: p.clase === "solvente" || p.necesita_agua ? "#1d4ed8" : "#94a0b4" }} />
          <div className="text-[0.84rem]">
            <b>Solvente (agua)</b> — {p.solvente}.
            <span className="block text-[0.76rem] text-muted">Sin solvente, aunque haya ingredientes, no reaccionan para formar biomoléculas.</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {BIOMOLECULAS.map(({ k, nombre, Icon }) => {
            const via = familias.get(k);
            return (
              <div key={k} className="rounded-md border-2 p-2" style={via ? { borderColor: "#15803d", background: "#f0fdf4" } : { borderColor: "#e6ebf2" }}>
                <p className="flex items-center gap-1.5 text-[0.82rem] font-bold" style={{ color: via ? "#166534" : "#94a0b4" }}>
                  <Icon className="h-4 w-4" /> {nombre}
                </p>
                <p className="mt-0.5 text-[0.76rem]" style={{ color: via ? "#24314a" : "#94a0b4" }}>
                  {via ?? "sin ruta conocida"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* factores abióticos */}
      <div>
        <Titulo>Factores abióticos: dónde se forma y qué necesitaría para participar en la química de la vida</Titulo>
        <div className="overflow-hidden rounded-md border border-rule">
          <table className="w-full text-[0.8rem]">
            <thead className="bg-plate text-left">
              <tr>
                <th className="w-[9.5rem] px-2 py-1.5" />
                <th className="px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    <Telescope className="h-3.5 w-3.5 text-accent" /> En el espacio
                  </span>
                </th>
                <th className="px-2 py-1.5">
                  <span className="flex items-center gap-1">
                    <Earth className="h-3.5 w-3.5 text-good" /> En la Tierra
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ABIOTICOS.map(({ k, nombre, Icon }) => (
                <tr key={k} className="border-t border-rule align-top">
                  <td className="px-2 py-1.5 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-ink-2" /> {nombre}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-ink-2">{p.abioticos[k].espacio}</td>
                  <td className={`px-2 py-1.5 ${p.abioticos[k].tierra.startsWith("Sin ruta") ? "text-muted" : "text-ink"}`}>{p.abioticos[k].tierra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[0.74rem] text-muted">
        Criterio: <b>prebiótica</b> si hay una ruta química conocida hacia proteínas, ADN/ARN, lípidos o azúcares; <b>ingrediente potencial</b> si
        contiene carbono con N, O, P o S sin ruta conocida. Elementos: de la fórmula. Rutas y textos: borrador de IA, pendiente de verificación.
      </p>
    </section>
  );
}

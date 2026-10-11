"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Spectra, PosKey, WinKey } from "@/lib/data";
import { FACTORES, type V3 } from "@/lib/modelo";

type Pruebas = {
  robustez: Record<string, { picos_asignados_con_13: number; mismo_ganador: number; fraccion: number }>;
  glicina: { picos_candidata: number; P_max: number; gana: number };
  linea_brillante: { especie: string; P: number }[];
  sensibilidad: Record<string, number>;
};

const POS: Record<PosKey, string> = { B_offset: "B offset", B_pico: "B pico", A: "A" };

function Paso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[2.2rem_1fr] gap-3 border-b border-rule pb-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-side text-[0.9rem] font-bold text-white">{n}</span>
      <div className="min-w-0">
        <h3 className="mb-2 text-[1.1rem] font-semibold">{titulo}</h3>
        {children}
      </div>
    </section>
  );
}

function Barra({ label, valor, max, texto, color = "#1d4ed8" }: { label: ReactNode; valor: number; max: number; texto: string; color?: string }) {
  return (
    <div className="grid grid-cols-[minmax(12rem,19rem)_1fr_5rem] items-center gap-2 text-[0.86rem]">
      <span>{label}</span>
      <span className="h-3 rounded-sm bg-plate-2">
        <span className="block h-full rounded-sm" style={{ width: `${Math.max(1, (valor / max) * 100)}%`, background: color }} />
      </span>
      <span className="text-right tabular-nums">{texto}</span>
    </div>
  );
}

function Figura({ src, pie }: { src: string; pie: string }) {
  return (
    <figure className="rounded-md border border-rule bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={pie} className="w-full" loading="lazy" />
      <figcaption className="mt-1 text-[0.78rem] text-muted">{pie}</figcaption>
    </figure>
  );
}

/** «Cómo lo calculamos»: el recorrido desde los datos hasta la probabilidad, con números y gráficas reales. */
export default function Backstage({ v3, spectra }: { v3: V3; spectra: Spectra }) {
  const [pr, setPr] = useState<Pruebas | null>(null);
  useEffect(() => {
    fetch("/data/pruebas.json")
      .then((r) => r.json())
      .then(setPr, () => setPr(null));
  }, []);
  const b = v3.backstage;
  const maxCenso = Math.max(...b.censo_por_atomos.map((x) => x.n));

  return (
    <div className="mx-auto max-w-[62rem] space-y-6">
      <p className="text-[0.95rem] text-ink-2">
        Todo lo que ve la pantalla <b className="text-ink">Analizar</b> sale de estos pasos. Cada número es reproducible con el código del repositorio
        (<span className="font-mono text-[0.85em]">analysis/v3/</span>).
      </p>

      <Paso n={1} titulo="Los datos, sin tocar">
        <p className="mb-3 text-[0.9rem] text-ink-2">
          Espectros de ALMA de tres posiciones (A, B pico, B offset) en dos ventanas (W1, W2), tal como vienen en el paquete: sin suavizar, sin restar
          fondo, sin recalibrar. Comprobamos que los archivos son idénticos a los oficiales (huella SHA256).
        </p>
        <Figura src="/figs/fig2_tres_posiciones.png" pie="Las tres posiciones en W1 y W2, misma escala (reproduce la Figura 3 de la Guía)." />
      </Paso>

      <Paso n={2} titulo="Un solo paso: de frecuencia observada a frecuencia en reposo">
        <p className="mb-2 text-[0.9rem] text-ink-2">
          El gas se mueve, y eso corre las líneas (efecto Doppler). Con la velocidad <b className="text-ink">dada por los organizadores</b> (B: 2.7 km/s,
          A: 3.2 km/s) llevamos el espectro a reposo, una sola vez:
        </p>
        <p className="mb-3 rounded-md bg-plate px-4 py-2 text-center font-mono text-[0.95rem]">ν_reposo = ν_observada / (1 − v/c)   ·   2.7 km/s ↔ 3.14 MHz a 349 GHz</p>
        <Figura src="/figs/fig1_espectro_B_offset.png" pie="Arriba: observado. Abajo: en reposo. Es la gráfica del cuaderno oficial." />
      </Paso>

      <Paso n={3} titulo="¿Cuánto mide el ruido?">
        <p className="mb-3 text-[0.9rem] text-ink-2">
          Medimos el ruido (σ) sólo en tramos sin líneas (sombreados en verde). Una línea cuenta si supera 4σ.
        </p>
        <div className="mb-3 overflow-x-auto">
          <table className="w-full text-[0.86rem]">
            <thead className="bg-plate text-left text-[0.74rem] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-1.5">Posición</th>
                <th className="px-3 py-1.5 text-right">σ W1 (mJy/haz)</th>
                <th className="px-3 py-1.5 text-right">σ W2 (mJy/haz)</th>
                <th className="px-3 py-1.5">Método</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(POS) as PosKey[]).map((p) => (
                <tr key={p} className="border-t border-rule">
                  <td className="px-3 py-1.5 font-medium">{POS[p]}</td>
                  {(["W1", "W2"] as WinKey[]).map((w) => (
                    <td key={w} className="px-3 py-1.5 text-right tabular-nums">
                      {(spectra[w].noise[p].sigma_Jy * 1000).toFixed(1)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-ink-2">{p === "A" ? "envolvente inferior (A casi no tiene tramos libres)" : "6 tramos sin líneas"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Figura src="/figs/fig4_ruido.png" pie="B offset: tramos sin líneas usados para medir el ruido." />
      </Paso>

      <Paso n={4} titulo="Las líneas detectadas">
        <div className="space-y-1.5">
          {(Object.keys(POS) as PosKey[]).map((p) => {
            const pk = v3.posiciones[p].picos;
            const em = pk.filter((x) => x.tipo === "emision").length;
            const ab = pk.length - em;
            return (
              <Barra
                key={p}
                label={`${POS[p]}: ${em} emisiones, ${ab} absorciones`}
                valor={em}
                max={110}
                texto={`${em}`}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[0.8rem] text-muted">
          Las absorciones se marcan pero no se usan como evidencia. A cada emisión le ajustamos una gaussiana sólo para describir su ancho.
        </p>
      </Paso>

      <Paso n={5} titulo="¿Contra qué comparamos? Los catálogos">
        <div className="space-y-1.5">
          <Barra label={`Catálogo oficial (${b.especies_oficiales} especies)`} valor={b.catalogo_oficial} max={b.splatalogue_filas} texto={`${b.catalogo_oficial}`} color="#0f1f4b" />
          <Barra label="… con coeficiente de Einstein" valor={b.con_aij_oficial} max={b.splatalogue_filas} texto={`${b.con_aij_oficial}`} color="#0f1f4b" />
          <Barra label="CDMS + JPL en la banda (Splatalogue)" valor={b.splatalogue_filas} max={b.splatalogue_filas} texto={`${b.splatalogue_filas}`} />
          <Barra label="Sin duplicados (ampliado)" valor={b.ampliado_filas} max={b.splatalogue_filas} texto={`${b.ampliado_filas}`} />
          <Barra label={`Utilizables (${b.especies_total} especies)`} valor={b.utilizables} max={b.splatalogue_filas} texto={`${b.utilizables}`} color="#15803d" />
        </div>
        <p className="mt-2 text-[0.8rem] text-muted">
          Número de transiciones. Utilizables = con coeficiente de Einstein y degeneración g_u publicados, e incertidumbre ≤ 1 MHz. El coeficiente de Einstein se copia tal cual
          de CDMS/JPL; no lo calculamos.
        </p>
        <h4 className="mb-1 mt-4 text-[0.9rem] font-semibold">El «estándar» de complejidad: las {b.censo} moléculas conocidas en el espacio, por número de átomos</h4>
        <div className="flex h-32 items-end gap-1.5">
          {b.censo_por_atomos.map((x) => (
            <div key={x.atomos} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[0.72rem] tabular-nums">{x.n}</span>
              <span className="w-full rounded-t-sm bg-side" style={{ height: `${(x.n / maxCenso) * 90}px` }} />
              <span className="text-[0.72rem] text-muted">{x.atomos}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[0.8rem] text-muted">Censo CDMS (diapositiva 5). Complejidad de una molécula = (moléculas con su número de átomos) / {b.censo}.</p>
      </Paso>

      <Paso n={6} titulo="Los seis factores de cada candidata">
        <p className="mb-2 rounded-md bg-plate px-4 py-2 text-center font-mono text-[0.92rem]">
          P(molécula | línea) ∝ frecuencia × Einstein × se repite × complejidad × visto en el espacio × entorno
        </p>
        <ul className="space-y-1.5 text-[0.88rem]">
          {FACTORES.map((f) => (
            <li key={f.key}>
              <b>{f.label}:</b> <span className="text-ink-2">{f.ayuda}.</span>
            </li>
          ))}
          <li>
            <b>Fuera del catálogo:</b> <span className="text-ink-2">siempre compite, como una candidata débil de referencia. Si gana, la línea queda «sin identificar».</span>
          </li>
        </ul>
        <p className="mt-2 text-[0.8rem] text-muted">Los % se normalizan por línea. Son puntajes relativos para decidir, no probabilidades calibradas.</p>
      </Paso>

      <Paso n={7} titulo="¿Podemos confiar? Pruebas">
        {pr ? (
          <div className="space-y-4">
            <div>
              <h4 className="mb-1 text-[0.9rem] font-semibold">¿Cambia la respuesta si ampliamos la base de moléculas? (B offset)</h4>
              <div className="space-y-1.5">
                {Object.entries(pr.robustez).map(([k, r]) => (
                  <Barra
                    key={k}
                    label={`13 especies → ${k.startsWith("30") ? "30 especies" : "todas (380)"}`}
                    valor={r.fraccion}
                    max={1}
                    texto={`${Math.round(r.fraccion * 100)} % igual`}
                    color="#15803d"
                  />
                ))}
              </div>
              <p className="mt-1 text-[0.8rem] text-muted">Porcentaje de líneas cuya molécula más probable no cambia.</p>
            </div>
            <div>
              <h4 className="mb-1 text-[0.9rem] font-semibold">¿Depende de nuestros supuestos? (mismo ganador al cambiar uno a la vez)</h4>
              <div className="space-y-1.5">
                {Object.entries(pr.sensibilidad).map(([k, val]) => (
                  <Barra key={k} label={k} valor={val} max={1} texto={`${Math.round(val * 100)} %`} color={val >= 0.85 ? "#15803d" : "#a16207"} />
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-rule p-3">
                <h4 className="text-[0.9rem] font-semibold">Control: glicina</h4>
                <p className="text-[0.86rem] text-ink-2">
                  Aparece como candidata en {pr.glicina.picos_candidata} líneas, pero su probabilidad máxima es{" "}
                  <b className="text-ink">{(pr.glicina.P_max * 100).toFixed(1)} %</b> y no gana ninguna. No hay evidencia de glicina en estos datos.
                </p>
              </div>
              <div className="rounded-md border border-rule p-3">
                <h4 className="text-[0.9rem] font-semibold">La línea más brillante (S/N ≈ 70)</h4>
                <div className="mt-1 space-y-1">
                  {pr.linea_brillante.slice(0, 3).map((x) => (
                    <Barra key={x.especie} label={x.especie} valor={x.P} max={1} texto={`${Math.round(x.P * 100)} %`} color="#64748b" />
                  ))}
                </div>
                <p className="mt-1 text-[0.8rem] text-muted">Ambigua: la reportamos sin identificación firme.</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted">Cargando pruebas…</p>
        )}
      </Paso>
    </div>
  );
}

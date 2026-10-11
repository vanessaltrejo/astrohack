"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { prettyFormula } from "@/lib/formula";
import { loadJson } from "@/lib/data";

export type Ficha = {
  formula: string;
  nombre: string;
  n_atomos: string;
  visto_en_espacio: string;
  en_censo: boolean;
  familia: string;
  entorno: string;
  factor_entorno: number;
  relevancia_biotica: string;
  descripcion: string;
  condiciones_abioticas: string;
  condiciones_bioticas: string;
  tipo_ficha: string;
  url_cdms?: string;
  verificacion: string;
  especie_laboratorio?: string;
};

const ENTORNO: Record<string, string> = {
  hot_corino: "núcleo caliente (hot corino)",
  ubicua: "ubicua",
  nube_fria: "nube fría",
  circunestelar: "envoltura circunestelar",
  atmosfera_lab: "atmósfera / laboratorio",
};
const RELEVANCIA: Record<string, { label: string; color: string }> = {
  directa: { label: "prebiótica directa", color: "var(--color-good)" },
  relacionada: { label: "relacionada", color: "var(--color-data)" },
  no_conocida: { label: "sin relevancia conocida", color: "var(--color-muted)" },
};

/** Base de datos de moléculas: las 348 del censo CDMS (diapositiva 5) + especies de laboratorio en la banda. */
export default function MoleculesPanel() {
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"censo" | "todas" | "prebioticas" | "laboratorio">("censo");
  const [sel, setSel] = useState<Ficha | null>(null);

  useEffect(() => {
    loadJson<Ficha[]>("fichas_moleculas.json").then(setFichas, () => setFichas([]));
  }, []);

  const lista = useMemo(() => {
    if (!fichas) return [];
    const s = q.trim().toLowerCase();
    return fichas
      .filter((f) =>
        filtro === "censo"
          ? f.en_censo
          : filtro === "laboratorio"
            ? !f.en_censo
            : filtro === "prebioticas"
              ? f.relevancia_biotica === "directa"
              : true,
      )
      .filter((f) => !s || f.formula.toLowerCase().includes(s) || f.nombre.toLowerCase().includes(s) || f.familia.includes(s));
  }, [fichas, q, filtro]);

  if (!fichas) return <p className="caption">Cargando fichas…</p>;
  const nCenso = fichas.filter((f) => f.en_censo && f.visto_en_espacio !== "cuestionada").length;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <p className="caption mb-3 border-l-2 border-accent pl-3">
          Borrador redactado con IA — <b>todas las fichas están pendientes de verificación</b>. Censo: CDMS 09/2026, {nCenso}{" "}
          moléculas (misma tabla que la diapositiva 5).
        </p>
        <label className="flex items-center gap-2 border border-rule px-2 py-1.5">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar fórmula, nombre o familia"
            className="w-full bg-transparent text-[0.86rem] outline-none"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1 text-[0.74rem]">
          {(
            [
              ["censo", "Censo (348)"],
              ["prebioticas", "Prebióticas"],
              ["laboratorio", "Sólo laboratorio"],
              ["todas", "Todas"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltro(k)}
              className={`border px-2 py-0.5 ${filtro === k ? "border-accent text-ink" : "border-rule text-ink-2 hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
        <ul className="mt-3 max-h-[75vh] overflow-y-auto border-t border-rule">
          {lista.map((f) => (
            <li key={f.formula + f.nombre}>
              <button
                type="button"
                onClick={() => setSel(f)}
                className={`flex w-full items-baseline gap-3 border-b border-rule px-1 py-1.5 text-left text-[0.84rem] hover:bg-plate-2 ${
                  sel === f ? "bg-plate-2" : ""
                }`}
              >
                <span className="w-36 shrink-0 truncate font-medium text-ink">{prettyFormula(f.formula)}</span>
                <span className="flex-1 truncate text-ink-2">{f.nombre !== f.formula ? f.nombre : ""}</span>
                <span className="shrink-0 text-[0.7rem] text-muted">{f.n_atomos} át.</span>
                <span
                  className="h-2 w-2 shrink-0"
                  title={RELEVANCIA[f.relevancia_biotica]?.label}
                  style={{ background: RELEVANCIA[f.relevancia_biotica]?.color }}
                />
              </button>
            </li>
          ))}
        </ul>
        <p className="caption mt-2">{lista.length} resultados</p>
      </div>

      <div>
        {sel ? (
          <article className="space-y-3 text-[0.88rem]">
            <header>
              <p className="text-[1.4rem] font-semibold text-ink">{prettyFormula(sel.formula)}</p>
              <p className="text-[1.1rem] text-ink-2">{sel.nombre}</p>
            </header>
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-[0.82rem]">
              <dt className="text-muted">Átomos</dt>
              <dd>{sel.n_atomos}</dd>
              <dt className="text-muted">¿Vista en el espacio?</dt>
              <dd>
                {sel.visto_en_espacio}
                {sel.en_censo ? " (censo CDMS)" : " (no está en el censo)"}
              </dd>
              <dt className="text-muted">Familia</dt>
              <dd>{sel.familia}</dd>
              <dt className="text-muted">Entorno típico</dt>
              <dd>
                {ENTORNO[sel.entorno] ?? sel.entorno} · factor {sel.factor_entorno}
              </dd>
              <dt className="text-muted">Relevancia biótica</dt>
              <dd style={{ color: RELEVANCIA[sel.relevancia_biotica]?.color }}>{RELEVANCIA[sel.relevancia_biotica]?.label}</dd>
            </dl>
            <section>
              <h4 className="text-[0.74rem] uppercase tracking-wide text-muted">Descripción</h4>
              <p>{sel.descripcion}</p>
            </section>
            <section>
              <h4 className="text-[0.74rem] uppercase tracking-wide text-muted">Condiciones abióticas más favorables</h4>
              <p>{sel.condiciones_abioticas}</p>
            </section>
            <section>
              <h4 className="text-[0.74rem] uppercase tracking-wide text-muted">Condiciones / papel biótico</h4>
              <p>{sel.condiciones_bioticas}</p>
            </section>
            <p className="caption">
              Ficha {sel.tipo_ficha} · verificación: <span className="text-warning">{sel.verificacion}</span>
              {sel.url_cdms ? (
                <>
                  {" · "}
                  <a href={sel.url_cdms} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    página CDMS
                  </a>
                </>
              ) : null}
            </p>
          </article>
        ) : (
          <p className="caption">Elige una molécula para ver su ficha.</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { prettyFormula } from "@/lib/formula";
import { loadJson, type PosKey } from "@/lib/data";
import AnalisisPrebiotico, { type Prebiotico } from "./AnalisisPrebiotico";

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
  especie_laboratorio?: string;
  prebiotico: Prebiotico;
};

/** Líneas que explica cada molécula en nuestro espectro (candidata principal), por posición. Clave = fórmula o nombre. */
export type Explica = Record<string, Partial<Record<PosKey, number>>>;

const ENTORNO: Record<string, string> = {
  hot_corino: "Núcleo caliente",
  ubicua: "Ubicua",
  nube_fria: "Nube fría",
  circunestelar: "Envoltura circunestelar",
  atmosfera_lab: "Atmósfera / laboratorio",
};
const RELEVANCIA: Record<string, { label: string; color: string }> = {
  directa: { label: "Prebiótica (ruta conocida)", color: "#15803d" },
  relacionada: { label: "Ingrediente potencial", color: "#0f766e" },
  no_conocida: { label: "Sin papel conocido", color: "#64748b" },
};
const ESTADO: Record<string, string> = {
  detectada: "Detectada",
  tentativa: "Tentativa",
  cuestionada: "Cuestionada",
  "no detectada": "Sólo laboratorio",
};
const POS_LABEL: Record<PosKey, string> = {
  B_offset: "B offset",
  B_pico: "B pico",
  A: "A",
};
const ORDEN_ATOMOS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  ">12",
];

type Filtro = {
  tipo: "atomos" | "estado" | "entorno" | "relevancia" | "espectro";
  valor: string;
  texto: string;
};

const explicaDe = (f: Ficha, ex: Explica) =>
  ex[f.formula] ?? (!f.en_censo ? ex[f.nombre] : undefined) ?? {};
const totalDe = (e: Partial<Record<PosKey, number>>) =>
  Object.values(e).reduce<number>((a, b) => a + (b ?? 0), 0);
const binAtomos = (f: Ficha) => (Number(f.n_atomos) > 12 ? ">12" : f.n_atomos);

/** Moléculas: resumen visual (filtros) arriba; lista y ficha abajo, cada una con su propio scroll. */
export default function MoleculesPanel({ explica }: { explica: Explica }) {
  const [fichas, setFichas] = useState<Ficha[] | null>(null);
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [sel, setSel] = useState<Ficha | null>(null);

  useEffect(() => {
    loadJson<Ficha[]>("fichas_moleculas.json").then(setFichas, () =>
      setFichas([]),
    );
  }, []);

  // un filtro por tipo; tocar el mismo valor lo quita
  const toggle = (f: Filtro) =>
    setFiltros((fs) =>
      fs.some((x) => x.tipo === f.tipo && x.valor === f.valor)
        ? fs.filter((x) => x.tipo !== f.tipo)
        : [...fs.filter((x) => x.tipo !== f.tipo), f],
    );
  const activo = (tipo: Filtro["tipo"], valor: string) =>
    filtros.some((x) => x.tipo === tipo && x.valor === valor);

  const lista = useMemo(() => {
    if (!fichas) return [];
    const s = q.trim().toLowerCase();
    return fichas
      .filter((f) =>
        filtros.every((x) => {
          if (x.tipo === "atomos") return binAtomos(f) === x.valor;
          if (x.tipo === "estado") return f.visto_en_espacio === x.valor;
          if (x.tipo === "entorno") return f.entorno === x.valor;
          if (x.tipo === "relevancia") return f.relevancia_biotica === x.valor;
          return totalDe(explicaDe(f, explica)) > 0;
        }),
      )
      .filter(
        (f) =>
          !s ||
          f.formula.toLowerCase().includes(s) ||
          f.nombre.toLowerCase().includes(s) ||
          f.familia.includes(s),
      )
      .sort(
        (a, b) =>
          totalDe(explicaDe(b, explica)) - totalDe(explicaDe(a, explica)),
      );
  }, [fichas, q, filtros, explica]);

  if (!fichas) return <p className="caption">Cargando fichas…</p>;

  const conteo = (xs: Ficha[], key: (f: Ficha) => string) => {
    const m = new Map<string, number>();
    for (const f of xs) m.set(key(f), (m.get(key(f)) ?? 0) + 1);
    return m;
  };
  const censo = fichas.filter(
    (f) => f.en_censo && f.visto_en_espacio !== "cuestionada",
  );
  const porAtomos = conteo(censo, binAtomos);
  const porEstado = conteo(fichas, (f) => f.visto_en_espacio);
  const porEntorno = conteo(fichas, (f) => f.entorno);
  const porRelevancia = conteo(fichas, (f) => f.relevancia_biotica);
  const enEspectro = fichas
    .map((f) => ({ f, e: explicaDe(f, explica) }))
    .filter((x) => totalDe(x.e) > 0)
    .sort((a, b) => totalDe(b.e) - totalDe(a.e));
  const maxAtomos = Math.max(...porAtomos.values());
  const actual = (sel && lista.includes(sel) ? sel : lista[0]) ?? null;

  return (
    <div className="space-y-5">
      {/* resumen visual: cada bloque filtra la lista */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <Tarjeta
          titulo="Por número de átomos"
          fuente="Censo CDMS: 348 moléculas detectadas en el espacio (diapositiva 5)"
        >
          <div className="flex h-28 items-end gap-1">
            {ORDEN_ATOMOS.map((k) => {
              const n = porAtomos.get(k) ?? 0;
              const on = activo("atomos", k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    toggle({ tipo: "atomos", valor: k, texto: `${k} átomos` })
                  }
                  className="flex flex-1 flex-col items-center gap-0.5"
                  title={`${n} moléculas con ${k} átomos`}
                >
                  <span className="text-[0.66rem] tabular-nums text-ink-2">
                    {n}
                  </span>
                  <span
                    className="w-full rounded-t-sm transition-colors"
                    style={{
                      height: `${(n / maxAtomos) * 72}px`,
                      background: on ? "#1d4ed8" : "#0f1f4b",
                    }}
                  />
                  <span
                    className={`text-[0.66rem] ${on ? "font-bold text-accent" : "text-muted"}`}
                  >
                    {k}
                  </span>
                </button>
              );
            })}
          </div>
        </Tarjeta>

        <Tarjeta
          titulo="¿Vista en el espacio?"
          fuente="Censo CDMS; «sólo laboratorio» = con líneas en nuestra banda pero fuera del censo"
        >
          <Barras
            items={[
              "detectada",
              "tentativa",
              "cuestionada",
              "no detectada",
            ].map((k) => ({ k, label: ESTADO[k], n: porEstado.get(k) ?? 0 }))}
            activo={(k) => activo("estado", k)}
            onClick={(k) =>
              toggle({ tipo: "estado", valor: k, texto: ESTADO[k] })
            }
          />
        </Tarjeta>

        <Tarjeta
          titulo="Entorno típico"
          fuente="Fichas de moléculas"
        >
          <Barras
            items={Object.keys(ENTORNO).map((k) => ({
              k,
              label: ENTORNO[k],
              n: porEntorno.get(k) ?? 0,
            }))}
            activo={(k) => activo("entorno", k)}
            onClick={(k) =>
              toggle({ tipo: "entorno", valor: k, texto: ENTORNO[k] })
            }
          />
        </Tarjeta>

        <Tarjeta
          titulo="¿Es prebiótica?"
          fuente="Análisis prebiótico: ruta conocida hacia una biomolécula, o C con N/O/P/S"
        >
          <Barras
            items={Object.keys(RELEVANCIA).map((k) => ({
              k,
              label: RELEVANCIA[k].label,
              n: porRelevancia.get(k) ?? 0,
              color: RELEVANCIA[k].color,
            }))}
            activo={(k) => activo("relevancia", k)}
            onClick={(k) =>
              toggle({
                tipo: "relevancia",
                valor: k,
                texto: RELEVANCIA[k].label,
              })
            }
          />
        </Tarjeta>
      </div>

      {/* en nuestro espectro */}
      <section className="rounded-lg border border-rule p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[1rem] font-semibold">
            En nuestro espectro: moléculas que explican líneas
          </h3>
          <button
            type="button"
            className={`btn ${activo("espectro", "si") ? "btn-primary" : ""}`}
            onClick={() =>
              toggle({
                tipo: "espectro",
                valor: "si",
                texto: "Explican líneas",
              })
            }
          >
            {activo("espectro", "si")
              ? "Mostrando sólo éstas"
              : "Mostrar sólo éstas en la lista"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {enEspectro.map(({ f, e }) => (
            <button
              key={f.formula + f.nombre}
              type="button"
              onClick={() => setSel(f)}
              className={`rounded-md border px-2.5 py-1 text-left text-[0.84rem] hover:border-accent ${actual === f ? "border-accent bg-accent-dim" : "border-rule"}`}
            >
              <span className="font-semibold">{prettyFormula(f.formula)}</span>{" "}
              <span className="text-muted">
                {totalDe(e)} {totalDe(e) === 1 ? "línea" : "líneas"}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[0.78rem] text-muted">
          Líneas (sumando las 3 posiciones) en las que es la candidata más
          probable según nuestro motor. Las variantes isotópicas cuentan con su
          molécula madre.
        </p>
      </section>

      {/* búsqueda y filtros activos */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[min(18rem,100%)] flex-1 items-center gap-2 rounded-md border border-rule px-2 py-1.5">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar fórmula, nombre o familia"
            className="w-full bg-transparent text-[0.88rem] outline-none"
          />
        </label>
        {filtros.map((x) => (
          <button
            key={x.tipo}
            type="button"
            onClick={() => toggle(x)}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[0.8rem] font-medium text-white"
          >
            {x.texto} <X className="h-3.5 w-3.5" />
          </button>
        ))}
        {filtros.length ? (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => setFiltros([])}
          >
            Limpiar filtros
          </button>
        ) : null}
        <span className="text-[0.84rem] text-muted">
          {lista.length} {lista.length === 1 ? "molécula" : "moléculas"}
        </span>
      </div>

      {/* ficha completa, sin scroll; la lista (con scroll propio) mide lo mismo que la ficha */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="relative max-h-[60vh] overflow-y-auto rounded-lg border border-rule lg:max-h-none lg:overflow-visible">
          <ul className="lg:absolute lg:inset-0 lg:overflow-y-auto">
            {lista.map((f) => {
              const n = totalDe(explicaDe(f, explica));
              const on = actual === f;
              return (
                <li key={f.formula + f.nombre}>
                  <button
                    type="button"
                    onClick={() => setSel(f)}
                    className={`flex w-full items-center gap-3 border-b border-rule px-3 py-2 text-left text-[0.86rem] hover:bg-plate ${on ? "bg-accent-dim" : ""}`}
                    style={
                      on ? { boxShadow: "inset 3px 0 0 #1d4ed8" } : undefined
                    }
                  >
                    <span className="w-32 shrink-0 truncate font-semibold">
                      {prettyFormula(f.formula)}
                    </span>
                    <span className="flex-1 truncate text-ink-2">
                      {f.nombre !== f.formula ? f.nombre : ""}
                    </span>
                    {n ? (
                      <span className="shrink-0 rounded bg-accent-dim px-1.5 text-[0.72rem] font-semibold text-accent">
                        {n} en el espectro
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[0.74rem] text-muted">
                      {f.n_atomos} át.
                    </span>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      title={RELEVANCIA[f.relevancia_biotica]?.label}
                      style={{
                        background: RELEVANCIA[f.relevancia_biotica]?.color,
                      }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-lg border-2 border-ink p-5">
          {actual ? (
            <FichaDetalle
              f={actual}
              e={explicaDe(actual, explica)}
              porAtomos={porAtomos}
            />
          ) : (
            <p className="caption">
              Ninguna molécula coincide con los filtros.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Tarjeta({
  titulo,
  fuente,
  children,
}: {
  titulo: string;
  fuente: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-rule p-4">
      <h3 className="mb-2 text-[0.95rem] font-semibold">{titulo}</h3>
      <div className="flex-1">{children}</div>
      <p className="mt-2 text-[0.72rem] text-muted">
        {fuente}. Toca para filtrar.
      </p>
    </section>
  );
}

function Barras({
  items,
  activo,
  onClick,
}: {
  items: { k: string; label: string; n: number; color?: string }[];
  activo: (k: string) => boolean;
  onClick: (k: string) => void;
}) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <button
          key={i.k}
          type="button"
          onClick={() => onClick(i.k)}
          className="grid w-full grid-cols-[9.5rem_1fr_2.5rem] items-center gap-2 text-left text-[0.82rem]"
        >
          <span className={activo(i.k) ? "font-bold text-accent" : ""}>
            {i.label}
          </span>
          <span className="h-3 rounded-sm bg-plate-2">
            <span
              className="block h-full rounded-sm"
              style={{
                width: `${(i.n / max) * 100}%`,
                background: activo(i.k) ? "#1d4ed8" : (i.color ?? "#0f1f4b"),
              }}
            />
          </span>
          <span className="text-right tabular-nums">{i.n}</span>
        </button>
      ))}
    </div>
  );
}

function FichaDetalle({
  f,
  e,
  porAtomos,
}: {
  f: Ficha;
  e: Partial<Record<PosKey, number>>;
  porAtomos: Map<string, number>;
}) {
  const bin = binAtomos(f);
  const nBin = porAtomos.get(bin);
  const rel = RELEVANCIA[f.relevancia_biotica];
  return (
    <article className="space-y-4 text-[0.9rem]">
      <header>
        <p className="text-[1.7rem] font-semibold leading-tight">
          {prettyFormula(f.formula)}
        </p>
        {f.nombre !== f.formula ? (
          <p className="text-[1.05rem] text-ink-2">{f.nombre}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2 text-[0.78rem] font-semibold">
          <span className="rounded bg-plate-2 px-2 py-0.5">
            {ESTADO[f.visto_en_espacio] ?? f.visto_en_espacio}
          </span>
          <span className="rounded bg-plate-2 px-2 py-0.5">
            {f.n_atomos} átomos
          </span>
          <span className="rounded bg-plate-2 px-2 py-0.5">
            {ENTORNO[f.entorno] ?? f.entorno}
          </span>
          {rel ? (
            <span
              className="rounded px-2 py-0.5 text-white"
              style={{ background: rel.color }}
            >
              {rel.label}
            </span>
          ) : null}
        </div>
      </header>

      <AnalisisPrebiotico
        p={f.prebiotico}
        enEspacio={
          f.visto_en_espacio === "detectada" ||
          f.visto_en_espacio === "tentativa"
        }
      />

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-plate p-3">
          <p className="text-[0.74rem] font-semibold uppercase tracking-wide text-muted">
            En nuestro espectro
          </p>
          {totalDe(e) ? (
            <ul className="mt-1 space-y-0.5">
              {(Object.keys(POS_LABEL) as PosKey[]).map((p) => (
                <li key={p} className="flex justify-between">
                  <span>{POS_LABEL[p]}</span>
                  <b className="tabular-nums">{e[p] ?? 0} líneas</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-ink-2">
              No es la candidata más probable de ninguna línea.
            </p>
          )}
        </div>
        <div className="rounded-md bg-plate p-3">
          <p className="text-[0.74rem] font-semibold uppercase tracking-wide text-muted">
            Complejidad
          </p>
          <p className="mt-1">
            {f.en_censo && nBin ? (
              <>
                <b>{nBin}</b> de las 348 moléculas conocidas tienen{" "}
                {bin === ">12" ? "más de 12" : bin} átomos.
              </>
            ) : (
              <>
                {f.n_atomos} átomos. No está en el censo de moléculas
                detectadas.
              </>
            )}
          </p>
        </div>
      </section>

      <Bloque titulo="Descripción">{f.descripcion}</Bloque>
      <Bloque titulo="Condiciones abióticas más favorables">
        {f.condiciones_abioticas}
      </Bloque>
      <Bloque titulo="Condiciones / papel biótico">
        {f.condiciones_bioticas}
      </Bloque>

      <p className="rounded-md border border-dashed border-rule-strong px-3 py-2 text-[0.78rem] text-ink-2">
        Átomos y estado: censo CDMS. «En nuestro espectro»: nuestro motor.
        Familia, entorno, rutas prebióticas y textos: ficha {f.tipo_ficha}.
        {f.url_cdms ? (
          <>
            {" "}
            <a
              href={f.url_cdms}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent hover:underline"
            >
              Ver en CDMS
            </a>
          </>
        ) : null}
      </p>
    </article>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="text-[0.74rem] font-semibold uppercase tracking-wide text-muted">
        {titulo}
      </h4>
      <p className="mt-0.5">{children}</p>
    </section>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Atom, ClipboardList, Images, Plus, RotateCcw, ScanSearch, Workflow, ZoomIn, ZoomOut } from "lucide-react";
import { findPeak, loadCore, loadJson, loadPeaks, type CatalogLine, type CoreLoad, type Peaks, type PosKey, type WinKey } from "@/lib/data";
import { loadRows, loadTeam, saveRows, saveTeam, type EvidenceRow } from "@/lib/evidence";
import { prefillRow } from "@/lib/prefill";
import { prettyFormula } from "@/lib/formula";
import { toRestFrameGHz } from "@/lib/spectro";
import { TEAM_NAME_DEFAULT } from "@/lib/config";
import { esBase, FACTORES, FUERA, nivel, NIVEL, PESOS_BASE, pct, recalcular, type Cand, type FactorKey, type Nivel, type Pesos, type V3 } from "@/lib/modelo";
import Sidebar from "./Sidebar";
import EvidenceLog from "./EvidenceLog";
import MoleculesPanel, { type Ficha } from "./MoleculesPanel";
import ReferencePlots from "./ReferencePlots";
import Backstage from "./Backstage";
import Huellas from "./Huellas";

const Plot = dynamic(() => import("./Plot"), { ssr: false });

const POS: { key: PosKey; label: string; hint: string }[] = [
  { key: "B_offset", label: "B offset", hint: "recomendada: líneas estrechas" },
  { key: "B_pico", label: "B pico", hint: "máximo del polvo de B" },
  { key: "A", label: "A", hint: "líneas anchas y mezcladas" },
];
const ENTORNO: Record<string, string> = {
  hot_corino: "núcleo caliente (como IRAS 16293 B)",
  ubicua: "presente en casi todos los entornos",
  nube_fria: "nubes frías",
  circunestelar: "envolturas de estrellas viejas",
  atmosfera_lab: "sólo atmósfera / laboratorio",
};
const BIO: Record<string, string> = {
  directa: "Interés prebiótico directo",
  relacionada: "Relacionada con química prebiótica",
  no_conocida: "Sin relevancia prebiótica conocida",
};
const CAND_COLORS = ["#1d4ed8", "#7c3aed", "#0e7490"];

type Vista = "analizar" | "backstage" | "moleculas" | "graficas" | "evidencia";

function Pagina({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-5">
        <h1 className="text-[1.35rem] font-semibold leading-tight">{titulo}</h1>
        <p className="text-[0.88rem] text-ink-2">{subtitulo}</p>
      </header>
      {children}
    </section>
  );
}

export default function Workbench() {
  const [core, setCore] = useState<CoreLoad | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [v3, setV3] = useState<V3 | null>(null);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCore().then(setCore, (e: Error) => setError(e.message));
    loadPeaks().then(setPeaks);
    loadJson<V3>("probabilidad.json").then(setV3, (e: Error) => setError(e.message));
    loadJson<Ficha[]>("fichas_moleculas.json").then(setFichas, (e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="p-10 text-critical">{error}</p>;
  if (!core || !v3) return <p className="p-10 text-muted">Cargando datos…</p>;
  return <Loaded core={core} peaks={peaks} v3={v3} fichas={fichas} />;
}

function Loaded({ core, peaks, v3, fichas }: { core: CoreLoad; peaks: Peaks | null; v3: V3; fichas: Ficha[] }) {
  const { meta, spectra, catalog } = core;
  const catalogById = useMemo(() => new Map(catalog.map((l) => [l.id, l])), [catalog]);
  const [pos, setPos] = useState<PosKey>("B_offset");
  const [win, setWin] = useState<WinKey>("W1");
  const [sel, setSel] = useState<string | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [pesos, setPesos] = useState<Pesos>(PESOS_BASE);
  const [vista, setVista] = useState<Vista>("analizar");
  const [rows, setRowsRaw] = useState<EvidenceRow[]>([]);
  const [team, setTeamRaw] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setRowsRaw(loadRows());
    setTeamRaw(loadTeam() || TEAM_NAME_DEFAULT);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);
  const setRows = useCallback((fn: (r: EvidenceRow[]) => EvidenceRow[]) => {
    setRowsRaw((prev) => {
      const next = fn(prev);
      saveRows(next);
      return next;
    });
  }, []);

  const irA = useCallback((x: Vista) => {
    setVista(x);
    window.scrollTo({ top: 0 });
  }, []);

  const v = v3.parametros.v_kms[pos];
  const C = meta.c_kms;
  const data = v3.posiciones[pos];

  const fichaDe = useCallback(
    (c: Cand) =>
      fichas.find((f) => f.formula === c.molecula) ??
      fichas.find((f) => !f.en_censo && f.nombre === c.nombre_quimico) ??
      (c.especie === "Glycine-I" ? fichas.find((f) => f.formula === "Glycine") : undefined),
    [fichas],
  );
  /** nombre legible: el de la ficha (en español si existe) o el químico de CDMS/JPL */
  const nombreDe = useCallback(
    (c: Cand) => {
      if (c.especie === FUERA) return "";
      const f = fichaDe(c);
      const base = f?.nombre && f.nombre !== f.formula ? f.nombre : (c.nombre_quimico ?? "");
      return c.isotopologo ? `variante isotópica de ${base.toLowerCase()}` : base;
    },
    [fichaDe],
  );

  // candidatas por pico, recalculadas con los pesos
  const porPico = useMemo(() => {
    const m = new Map<string, Cand[]>();
    for (const c of data.candidatas) m.set(c.pico, [...(m.get(c.pico) ?? []), c]);
    for (const [k, cs] of m) m.set(k, recalcular(cs, pesos));
    return m;
  }, [data, pesos]);
  // ganador con los pesos del modelo, para señalar qué cambia al moverlos
  const ganadorBase = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of data.candidatas) if (c.rango === 1) m.set(c.pico, c.especie);
    return m;
  }, [data]);

  const lineas = useMemo(
    () =>
      data.picos
        .filter((p) => p.tipo === "emision" && p.ventana === win)
        .map((p) => ({ p, cs: porPico.get(p.id) ?? [] }))
        .sort((a, b) => b.p.snr - a.p.snr),
    [data, win, porPico],
  );
  const conteo = useMemo(() => {
    const n: Record<Nivel, number> = { alta: 0, media: 0, baja: 0, "sin identificar": 0 };
    for (const l of lineas) n[nivel(l.cs[0])]++;
    return n;
  }, [lineas]);
  const cambian = useMemo(() => lineas.filter((l) => l.cs[0] && ganadorBase.get(l.p.id) !== l.cs[0].especie).length, [lineas, ganadorBase]);
  const masFrecuentes = useMemo(() => {
    const m = new Map<string, { n: number; iso: boolean }>();
    for (const l of lineas) {
      const t = l.cs[0];
      if (t && t.especie !== FUERA) m.set(t.especie, { n: (m.get(t.especie)?.n ?? 0) + 1, iso: !!t.isotopologo });
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6);
  }, [lineas]);

  useEffect(() => {
    if (!lineas.some((l) => l.p.id === sel)) setSel(lineas[0]?.p.id ?? null);
  }, [lineas, sel]);
  useEffect(() => setFoco(null), [sel, pos]);

  const actual = lineas.find((l) => l.p.id === sel) ?? null;
  const alternativas = useMemo(() => actual?.cs.filter((c) => c.especie !== FUERA) ?? [], [actual]);
  const enfocada = alternativas.find((c) => c.especie === foco) ?? alternativas[0];

  // ---------- gráfico ----------
  const sp = spectra[win];
  const xRest = useMemo(() => sp.freq_GHz.map((f) => toRestFrameGHz(f, v, C)), [sp, v, C]);
  const top5 = useMemo(() => alternativas.slice(0, 5), [alternativas]);
  const traces = useMemo(() => {
    const t: Plotly.Data[] = [
      { x: xRest, y: sp[pos] as number[], type: "scatter", mode: "lines", line: { color: "#0b1220", width: 1, shape: "hvh" }, hoverinfo: "skip", name: "espectro" },
    ];
    for (const n of Object.keys(NIVEL) as Nivel[]) {
      const ls = lineas.filter((l) => nivel(l.cs[0]) === n);
      if (!ls.length) continue;
      t.push({
        x: ls.map((l) => l.p.nu_reposo_MHz / 1000),
        y: ls.map((l) => l.p.Jy + 0.06),
        customdata: ls.map((l) => l.p.id),
        type: "scatter",
        mode: "markers",
        marker: { symbol: "triangle-down", size: 11, color: NIVEL[n].color, line: { color: "#fff", width: 1 } },
        text: ls.map((l) => (l.cs[0] && l.cs[0].especie !== FUERA ? `${prettyFormula(l.cs[0].especie)} · ${pct(l.cs[0].P)}` : "sin identificar")),
        hovertemplate: "%{text}<br>%{x:.5f} GHz (reposo)<extra></extra>",
        name: NIVEL[n].texto,
      });
    }
    if (actual) {
      t.push({
        x: [actual.p.nu_reposo_MHz / 1000],
        y: [actual.p.Jy + 0.06],
        type: "scatter",
        mode: "markers",
        marker: { symbol: "circle-open", size: 22, color: "#1d4ed8", line: { width: 3 } },
        hoverinfo: "skip",
        showlegend: false,
      });
    }
    return t;
  }, [xRest, sp, pos, lineas, actual]);
  const { shapes, annotations } = useMemo(() => {
    const lista = (zoom ? top5 : enfocada ? [enfocada] : []).filter((c) => c.nu_cat_MHz != null);
    return {
      shapes: lista.map((c) => ({
        type: "line" as const,
        x0: (c.nu_cat_MHz as number) / 1000,
        x1: (c.nu_cat_MHz as number) / 1000,
        yref: "paper" as const,
        y0: 0,
        y1: 1,
        line: { color: c === enfocada ? "#1d4ed8" : "#94a0b4", width: c === enfocada ? 2 : 1.2, dash: "dot" as const },
      })),
      annotations: zoom
        ? lista.map((c, i) => ({
            x: (c.nu_cat_MHz as number) / 1000,
            y: 1 - i * 0.09,
            yref: "paper" as const,
            text: `${prettyFormula(c.especie)} ${pct(c.P)}`,
            showarrow: false,
            xanchor: "left" as const,
            font: { size: 12, color: c === enfocada ? "#1d4ed8" : "#24314a" },
            bgcolor: "rgba(255,255,255,0.9)",
          }))
        : [],
    };
  }, [zoom, top5, enfocada]);
  const xRange: [number, number] | undefined =
    zoom && actual ? [actual.p.nu_reposo_MHz / 1000 - 0.006, actual.p.nu_reposo_MHz / 1000 + 0.006] : undefined;

  // ---------- evidencia ----------
  const registrar = useCallback(
    (c: Cand) => {
      const oficial = c.catalog_id >= 0 ? catalogById.get(c.catalog_id) : undefined;
      const line: CatalogLine = oficial ?? {
        id: c.catalog_id,
        species: c.especie,
        catalog: c.lista ?? "",
        entry: String(Math.abs(c.tag ?? 0)).padStart(6, "0"),
        rest_MHz: c.nu_cat_MHz ?? c.nu_reposo_MHz,
        unc_MHz: c.unc_MHz ?? 0,
        logI_300K: 0,
        Eu_K: c.Eu_K ?? 0,
        El_cm1: 0,
        gu: 0,
        qn_up: c.QN ?? "",
        qn_lo: "",
        window: c.ventana,
      };
      const found = findPeak(peaks, c.pico);
      const row = prefillRow({
        team,
        line,
        win: c.ventana,
        pos,
        peak: found?.peak ?? null,
        noise: spectra[c.ventana].noise[pos],
        decision: `pendiente (${pct(c.P)} en esta línea${esBase(pesos) ? "" : ", pesos modificados"})`,
      });
      setRows((rs) => [...rs, row]);
      setToast(`${prettyFormula(c.especie)} añadida a Evidencia`);
    },
    [catalogById, peaks, team, pos, spectra, setRows, pesos],
  );

  const feats = enfocada ? (data.especies[enfocada.especie]?.fuertes ?? null) : null;
  const fichaFoco = enfocada ? fichaDe(enfocada) : undefined;

  return (
    <div className="min-h-screen bg-night pl-[92px] text-ink">
      <Sidebar
        items={[
          { id: "analizar", label: "Analizar", Icon: ScanSearch, onClick: () => irA("analizar"), active: vista === "analizar" },
          { id: "backstage", label: "Cómo lo calculamos", Icon: Workflow, onClick: () => irA("backstage"), active: vista === "backstage" },
          { id: "moleculas", label: "Moléculas (348)", Icon: Atom, onClick: () => irA("moleculas"), active: vista === "moleculas" },
          { id: "graficas", label: "Gráficas Python", Icon: Images, onClick: () => irA("graficas"), active: vista === "graficas" },
          { id: "evidencia", label: "Evidencia", Icon: ClipboardList, onClick: () => irA("evidencia"), active: vista === "evidencia", badge: rows.length },
        ]}
      />

      <main className="px-4 pb-16 pt-5 md:px-8">
        {vista === "analizar" ? (
          <>
        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <div>
            <h1 className="text-[1.35rem] font-semibold leading-tight">¿Qué molécula produce cada línea?</h1>
            <p className="text-[0.88rem] text-ink-2">
              IRAS 16293-2422 · ALMA banda 7 · ordena las candidatas de cada línea y explica por qué. <b className="text-ink">La decisión final es tuya.</b>
            </p>
          </div>
          <ol className="flex flex-wrap gap-x-5 gap-y-1 text-[0.8rem] text-ink-2">
            {["Elige posición y ventana", "Toca una línea", "Compara candidatas", "Añádela a Evidencia"].map((t, i) => (
              <li key={t} className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[0.64rem] font-bold text-white">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </header>

        {/* datos */}
        <section className="mb-3 flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-rule bg-plate px-4 py-3">
          <div>
            <p className="mb-1 text-[0.74rem] font-semibold uppercase tracking-wide text-muted">Posición</p>
            <div className="seg">
              {POS.map((p) => (
                <button key={p.key} type="button" aria-pressed={pos === p.key} onClick={() => setPos(p.key)} title={p.hint}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[0.74rem] font-semibold uppercase tracking-wide text-muted">Ventana</p>
            <div className="seg">
              {(["W1", "W2"] as WinKey[]).map((w) => (
                <button key={w} type="button" aria-pressed={win === w} onClick={() => setWin(w)}>
                  {w} · {meta.windows[w].range_GHz[0].toFixed(2)}–{meta.windows[w].range_GHz[1].toFixed(2)} GHz
                </button>
              ))}
            </div>
          </div>
          <p className="text-[0.86rem] text-ink-2">
            Velocidad <b className="text-ink">{v} km/s</b> (dada por los organizadores). Único paso sobre los datos: observado → reposo.
          </p>
        </section>

        {/* modelo */}
        <section className="mb-4 rounded-lg border border-rule px-4 py-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[0.95rem] font-semibold">
              Peso de cada factor <span className="font-normal text-ink-2">— cámbialos y mira cómo cambian las respuestas</span>
            </p>
            {!esBase(pesos) ? (
              <span className="flex items-center gap-3 text-[0.86rem]">
                <span className="rounded bg-[#fef3c7] px-2 py-0.5 font-semibold text-[#a16207]">
                  Pesos modificados: {cambian} de {lineas.length} líneas cambian de molécula
                </span>
                <button type="button" className="btn" onClick={() => setPesos(PESOS_BASE)}>
                  <RotateCcw className="icon" /> Restablecer
                </button>
              </span>
            ) : (
              <span className="text-[0.82rem] text-muted">Pesos del modelo (todos normales)</span>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(21rem,1fr))] gap-x-8 gap-y-2">
            {FACTORES.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap text-[0.86rem]" title={f.ayuda}>
                  {f.label}
                </span>
                <div className="seg">
                  {(
                    [
                      [0, "Apagado"],
                      [1, "Normal"],
                      [2, "Doble"],
                    ] as const
                  ).map(([val, t]) => (
                    <button key={t} type="button" aria-pressed={pesos[f.key as FactorKey] === val} onClick={() => setPesos({ ...pesos, [f.key]: val })}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* resumen */}
        <section className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9rem]">
          <span>
            <b>{lineas.length}</b> líneas en {win}
          </span>
          {(Object.keys(NIVEL) as Nivel[]).map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: NIVEL[n].color }} />
              {NIVEL[n].corto} <b>{conteo[n]}</b>
            </span>
          ))}
          <span className="text-ink-2">
            Más frecuentes:{" "}
            {masFrecuentes.map(([e, x], i) => (
              <span key={e} className="text-ink">
                {i ? " · " : ""}
                {prettyFormula(e)}
                {x.iso ? <sup title="variante isotópica">iso</sup> : null} <span className="text-muted">({x.n})</span>
              </span>
            ))}
          </span>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_32rem]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* gráfico */}
            <div className="min-w-0 rounded-lg border border-rule bg-white p-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
                <p className="text-[0.86rem] font-semibold">
                  Espectro de {POS.find((p) => p.key === pos)?.label}, {win} (frecuencia en reposo)
                </p>
                {zoom ? (
                  <button type="button" className="btn" onClick={() => setZoom(false)}>
                    <ZoomOut className="icon" /> Ver ventana completa
                  </button>
                ) : actual ? (
                  <button type="button" className="btn" onClick={() => setZoom(true)}>
                    <ZoomIn className="icon" /> Acercar y ver candidatas
                  </button>
                ) : null}
              </div>
              <Plot
                data={traces}
                layout={{
                  height: 360,
                  autosize: true,
                  margin: { l: 56, r: 12, t: 10, b: 46 },
                  paper_bgcolor: "#ffffff",
                  plot_bgcolor: "#ffffff",
                  font: { family: "Inter Variable, Inter, sans-serif", size: 12.5, color: "#0b1220" },
                  xaxis: { title: { text: "Frecuencia en reposo (GHz)" }, gridcolor: "#e6ebf2", range: xRange, zeroline: false },
                  yaxis: { title: { text: "Intensidad (Jy/haz)" }, gridcolor: "#e6ebf2", zerolinecolor: "#94a0b4" },
                  showlegend: false,
                  shapes,
                  annotations,
                  hovermode: "closest",
                }}
                config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"] }}
                useResizeHandler
                style={{ width: "100%" }}
                onClick={(e) => {
                  const id = e.points?.[0]?.customdata as string | undefined;
                  if (id) setSel(id);
                }}
              />
              <p className="px-2 pb-1 text-[0.8rem] text-muted">
                Triángulos = líneas detectadas (≥ 4σ), coloreados por confianza. Punteada azul = frecuencia de la candidata elegida
                {zoom ? "; grises = las otras candidatas" : ""}.
              </p>
            </div>

            {/* tabla */}
            <div className="relative min-h-[24rem] min-w-0 flex-1 overflow-hidden rounded-lg border border-rule">
              <div className="absolute inset-0 overflow-auto">
                <table className="w-full min-w-[40rem] text-[0.88rem]">
                  <thead className="sticky top-0 z-10 bg-plate text-left text-[0.74rem] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">Línea (reposo, MHz)</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right">Intensidad (Jy/haz)</th>
                      <th className="px-3 py-2 text-right">S/N</th>
                      <th className="px-3 py-2">Molécula más probable</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2">Confianza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map(({ p, cs }) => {
                      const t = cs[0];
                      const n = nivel(t);
                      const on = p.id === sel;
                      const sinId = !t || t.especie === FUERA;
                      const cambio = !esBase(pesos) && t && ganadorBase.get(p.id) !== t.especie;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSel(p.id)}
                          className={`cursor-pointer border-t border-rule ${on ? "bg-accent-dim" : "hover:bg-plate"}`}
                          style={on ? { boxShadow: "inset 3px 0 0 #1d4ed8" } : undefined}
                        >
                          <td className="px-3 py-1.5 tabular-nums text-[0.84rem]">{p.nu_reposo_MHz.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{p.Jy.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{p.snr.toFixed(0)}</td>
                          <td className="px-3 py-1.5">
                            {sinId ? (
                              <span className="font-medium text-critical">sin identificar</span>
                            ) : (
                              <>
                                <span className="font-medium">{prettyFormula(t.especie)}</span>
                                <span className="ml-2 text-[0.78rem] text-muted">{nombreDe(t)}</span>
                                {cambio ? <span className="ml-2 text-[0.72rem] font-semibold text-warning">cambió</span> : null}
                              </>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{sinId ? "—" : pct(t.P)}</td>
                          <td className="px-3 py-1.5">
                            <span className="rounded px-1.5 py-0.5 text-[0.76rem] font-semibold" style={{ color: NIVEL[n].color, background: NIVEL[n].bg }}>
                              {NIVEL[n].corto}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* panel de la línea seleccionada */}
          <aside className="min-w-0 self-start">
            {actual ? (
              <div className="rounded-lg border-2 border-ink bg-white">
                <div className="border-b border-rule px-4 py-3">
                  <p className="text-[0.76rem] font-semibold uppercase tracking-wide text-muted">Línea seleccionada</p>
                  <p className="mt-0.5 tabular-nums text-[1.05rem]">{actual.p.nu_reposo_MHz.toFixed(2)} MHz</p>
                  <p className="text-[0.84rem] text-ink-2">
                    {actual.p.Jy.toFixed(2)} Jy/haz · S/N {actual.p.snr.toFixed(0)}
                    {actual.p.fwhm_kms ? ` · ancho ${actual.p.fwhm_kms.toFixed(1)} km/s` : ""}
                    {actual.p.blend ? " · posible mezcla" : ""}
                  </p>
                </div>

                <Resultado cs={actual.cs} nombreDe={nombreDe} />

                {alternativas.length ? (
                  <div className="border-t border-rule px-4 py-3">
                    <p className="mb-2 text-[0.76rem] font-semibold uppercase tracking-wide text-muted">Comparar candidatas (toca una para ver su porqué)</p>
                    <Comparar cs={alternativas.slice(0, 3)} foco={enfocada} setFoco={setFoco} />
                  </div>
                ) : null}

                {enfocada ? (
                  <>
                    <div className="border-t border-rule px-4 py-3">
                      <p className="mb-2 text-[0.76rem] font-semibold uppercase tracking-wide text-muted">¿Por qué {prettyFormula(enfocada.especie)}?</p>
                      <Porque c={enfocada} ficha={fichaFoco} />
                    </div>
                    {fichaFoco ? (
                      <div className="border-t border-rule px-4 py-3 text-[0.86rem]">
                        <p className="mb-1 text-[0.76rem] font-semibold uppercase tracking-wide text-muted">Sobre la molécula</p>
                        <p>{fichaFoco.descripcion}</p>
                        <p className="mt-1 font-medium">{BIO[fichaFoco.relevancia_biotica] ?? ""}</p>
                        <p className="mt-1 text-[0.76rem] text-muted">Ficha en borrador, pendiente de verificación.</p>
                      </div>
                    ) : null}
                    <div className="border-t border-rule px-4 py-3">
                      <button type="button" className="btn btn-primary w-full justify-center py-2 text-[0.9rem]" onClick={() => registrar(enfocada)}>
                        <Plus className="icon" /> Añadir {prettyFormula(enfocada.especie)} a Evidencia
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-muted">Selecciona una línea.</p>
            )}
          </aside>
        </div>

        {/* huellas, debajo para no saturar la parte de arriba */}
        {enfocada && feats && feats.length ? (
          <section className="mt-8 rounded-lg border border-rule p-4">
            <h2 className="mb-1 text-[1.15rem] font-semibold">Huellas de {prettyFormula(enfocada.especie)}: ¿se repite?</h2>
            <Huellas
              feats={feats}
              spectra={spectra}
              pos={pos}
              v={v}
              c={C}
              nombre={`${prettyFormula(enfocada.especie)}${nombreDe(enfocada) ? ` (${nombreDe(enfocada)})` : ""}`}
            />
          </section>
        ) : null}

          </>
        ) : vista === "backstage" ? (
          <Pagina titulo="Cómo lo calculamos" subtitulo="De los datos a la probabilidad, paso a paso, con los números reales del análisis.">
            <Backstage v3={v3} spectra={spectra} />
          </Pagina>
        ) : vista === "moleculas" ? (
          <Pagina titulo="Moléculas" subtitulo="Las 348 del censo CDMS y las especies de laboratorio con líneas en nuestra banda.">
            <MoleculesPanel />
          </Pagina>
        ) : vista === "graficas" ? (
          <Pagina titulo="Gráficas Python" subtitulo="Las gráficas de las instrucciones, reproducidas con el único paso permitido sobre los datos.">
            <ReferencePlots />
          </Pagina>
        ) : (
          <Pagina titulo="Evidencia" subtitulo="Las líneas que el equipo decide defender, con las columnas de evidencia_plantilla.csv.">
            <EvidenceLog
              rows={rows}
              setRows={setRows}
              team={team}
              setTeam={(t) => {
                setTeamRaw(t);
                saveTeam(t);
              }}
              flashId={null}
            />
          </Pagina>
        )}

        <footer className="mt-10 border-t border-rule pt-4 text-[0.78rem] text-muted">
          This project makes use of the following ALMA data: {meta.credit}. ALMA is a partnership of ESO, NSF and NINS, with NRC, NSTC, ASIAA and KASI,
          in cooperation with the Republic of Chile. Productos ARI-L; contexto PILS (Jørgensen et al. 2016). Catálogos CDMS y JPL (vía Splatalogue).
        </footer>
      </main>

      {toast ? (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-[0.88rem] text-white shadow-lg">
          ✓ {toast}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- resultado y alternativas
function Resultado({ cs, nombreDe }: { cs: Cand[]; nombreDe: (c: Cand) => string }) {
  const top = cs[0];
  const n = nivel(top);
  const sinId = !top || top.especie === FUERA;
  return (
    <div className="px-4 py-3">
      <p className="text-[0.76rem] font-semibold uppercase tracking-wide text-muted">Molécula más probable</p>
      {sinId ? (
        <p className="mt-1 text-[1.25rem] font-semibold text-critical">Sin identificar</p>
      ) : (
        <p className="mt-1 flex items-baseline gap-3">
          <span className="text-[1.6rem] font-semibold">{prettyFormula(top.especie)}</span>
          <span className="text-[1.4rem] font-semibold" style={{ color: NIVEL[n].color }}>
            {pct(top.P)}
          </span>
        </p>
      )}
      {!sinId ? <p className="text-[0.9rem] text-ink-2">{nombreDe(top)}</p> : null}
      <span className="mt-2 inline-block rounded px-2 py-0.5 text-[0.8rem] font-semibold" style={{ color: NIVEL[n].color, background: NIVEL[n].bg }}>
        Confianza: {NIVEL[n].texto}
      </span>
      {sinId ? (
        <p className="mt-2 text-[0.86rem] text-ink-2">
          Ninguna transición de CDMS/JPL en la banda explica esta línea mejor que una candidata débil de referencia. Puede ser una especie fuera de los
          catálogos o una mezcla. Abajo están las mejores candidatas igualmente.
        </p>
      ) : null}
      <p className="mb-1 mt-4 text-[0.76rem] font-semibold uppercase tracking-wide text-muted">Si no es esa, ¿cuál podría ser?</p>
      <div className="space-y-1.5">
        {cs.slice(0, 6).map((c, i) => (
          <div key={c.especie} className="grid grid-cols-[1.2rem_9rem_1fr_3rem] items-center gap-2 text-[0.86rem]">
            <span className="text-muted">{i + 1}</span>
            <span className={`truncate ${c.especie === FUERA ? "italic text-muted" : "font-medium"}`} title={c.especie === FUERA ? "" : nombreDe(c)}>
              {c.especie === FUERA ? "fuera del catálogo" : prettyFormula(c.especie)}
            </span>
            <span className="h-2.5 rounded-sm bg-plate-2">
              <span
                className="block h-full rounded-sm"
                style={{ width: `${c.P * 100}%`, background: c.especie === FUERA ? "#94a0b4" : i === 0 ? "#1d4ed8" : "#64748b" }}
              />
            </span>
            <span className="text-right tabular-nums">{pct(c.P)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tono = (x: number | null | undefined) => (x == null ? "#475569" : x >= 0.6 ? "#15803d" : x >= 0.25 ? "#a16207" : "#b91c1c");

/** Valor de cada factor en 0–1 para comparar. La complejidad se expresa relativa a la más común del censo (49/348). */
function valorFactor(c: Cand, key: FactorKey): number | null {
  switch (key) {
    case "frecuencia":
      return c.L_frecuencia ?? null;
    case "einstein":
      return c.L_Einstein ?? null;
    case "repite":
      return c.L_repeticion ?? null;
    case "complejidad":
      return c.prior_complejidad != null ? c.prior_complejidad / (49 / 348) : null;
    case "espacio":
      return c.prior_espacio ?? null;
    case "entorno":
      return c.factor_entorno ?? null;
  }
}

/** Matriz: factores en filas, candidatas en columnas. */
function Comparar({ cs, foco, setFoco }: { cs: Cand[]; foco: Cand | undefined; setFoco: (e: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.84rem]">
        <thead>
          <tr>
            <th className="w-[8.5rem]" />
            {cs.map((c, i) => (
              <th key={c.especie} className="px-1 pb-1">
                <button
                  type="button"
                  onClick={() => setFoco(c.especie)}
                  className={`w-full rounded-md border-2 px-1.5 py-1 text-center text-[0.84rem] font-semibold ${
                    c === foco ? "border-accent bg-accent-dim text-ink" : "border-rule text-ink-2 hover:border-rule-strong"
                  }`}
                >
                  <span className="block truncate" style={{ color: CAND_COLORS[i] }}>
                    {prettyFormula(c.especie)}
                  </span>
                  <span className="block text-[0.78rem] font-normal">{pct(c.P)}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FACTORES.map((f) => (
            <tr key={f.key} className="border-t border-rule">
              <td className="py-1 pr-2 font-medium">{f.label}</td>
              {cs.map((c) => {
                const x = f.key === "complejidad" ? null : valorFactor(c, f.key);
                const shown = valorFactor(c, f.key);
                return (
                  <td key={c.especie} className="py-1 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: tono(x) }} />
                      <span className="tabular-nums text-ink-2">{shown == null ? "—" : shown.toFixed(2)}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[0.74rem] text-muted">
        Valores de 0 a 1 (complejidad: relativa a la más común del censo, punto gris porque es contexto). Verde a favor · ámbar a medias · rojo en contra.
      </p>
    </div>
  );
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** 10^-2.79 → "1.6 × 10⁻³" */
function sci(log10: number | null | undefined): string {
  if (log10 == null) return "—";
  const e = Math.floor(log10);
  return `${(10 ** (log10 - e)).toFixed(1)} × 10${[...String(e)].map((ch) => SUP[ch] ?? ch).join("")}`;
}

/** Los factores, en palabras. */
function Porque({ c, ficha }: { c: Cand; ficha: Ficha | undefined }) {
  const lf = c.L_frecuencia ?? null;
  const le = c.L_Einstein ?? null;
  const visto = c.visto_en_espacio ?? "—";
  const filas: { k: string; v: string; x: number | null }[] = [
    { k: "Frecuencia", v: `${lf != null && lf >= 0.6 ? "Coincide" : lf != null && lf >= 0.25 ? "Cerca" : "Lejos"}: a ${Math.abs(c.delta_MHz ?? 0).toFixed(2)} MHz del catálogo`, x: lf },
    {
      k: "Coef. de Einstein",
      v: `A = ${sci(c.log10_Aij)} s⁻¹ ${(c.log10_Aij ?? 0) >= -6 ? "(en el rango probable 10⁻⁶–10⁻²)" : "(debajo de 10⁻⁶: muy improbable)"}, nivel a ${Math.round(c.Eu_K ?? 0)} K: ${le != null && le >= 0.6 ? "intensidad esperada compatible" : le != null && le >= 0.25 ? "algo distinta a la esperada" : "no debería verse tan intensa"}`,
      x: le,
    },
    {
      k: "Se repite",
      v: (c.lineas_fuertes ?? 0) < 2 ? "sólo 1 línea fuerte en la banda: no se puede comprobar" : `${c.lineas_presentes} de ${c.lineas_fuertes} líneas fuertes aparecen (ver Huellas abajo)`,
      x: c.L_repeticion ?? null,
    },
    { k: "Complejidad", v: `${c.n_atomos} átomos (${Math.round((c.prior_complejidad ?? 0) * 348)} de 348 moléculas conocidas)`, x: null },
    {
      k: "Visto en el espacio",
      v: visto === "detectada" ? "Sí (censo CDMS)" : visto === "tentativa" ? "Tentativa" : visto === "isotopólogo no confirmado" ? "Variante isotópica no confirmada" : "No",
      x: c.prior_espacio ?? null,
    },
    { k: "Entorno", v: ficha ? (ENTORNO[ficha.entorno] ?? ficha.entorno) : "—", x: c.factor_entorno ?? null },
  ];
  return (
    <ul className="space-y-1.5">
      {filas.map((f) => (
        <li key={f.k} className="grid grid-cols-[8.5rem_1fr] gap-2 text-[0.86rem]">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: tono(f.x) }} />
            {f.k}
          </span>
          <span className="text-ink-2">{f.v}</span>
        </li>
      ))}
    </ul>
  );
}

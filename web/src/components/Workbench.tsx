"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Atom, BookOpen, ClipboardList, Images, Plus, ScanSearch, ZoomOut } from "lucide-react";
import { findPeak, loadAnalysis, loadCore, type CatalogLine, type CoreLoad, type Peaks, type PosKey, type WinKey } from "@/lib/data";
import { loadRows, loadTeam, saveRows, saveTeam, type EvidenceRow } from "@/lib/evidence";
import { prefillRow } from "@/lib/prefill";
import { prettyFormula } from "@/lib/formula";
import { TEAM_NAME_DEFAULT } from "@/lib/config";
import Sidebar from "./Sidebar";
import EvidenceLog from "./EvidenceLog";
import MoleculesPanel, { type Ficha } from "./MoleculesPanel";
import ReferencePlots from "./ReferencePlots";
import { Dialog, MethodBody } from "./ui";

const Plot = dynamic(() => import("./Plot"), { ssr: false });

// ---------------------------------------------------------------- tipos de probabilidad.json
type Cand = {
  pico: string;
  ventana: WinKey;
  nu_obs_MHz: number;
  nu_reposo_MHz: number;
  Jy: number;
  snr: number;
  especie: string;
  molecula: string;
  nombre_quimico?: string | null;
  P: number;
  rango: number;
  delta_MHz?: number | null;
  L_frecuencia?: number | null;
  L_Einstein?: number | null;
  L_poblacion?: number | null;
  L_repeticion?: number | null;
  lineas_presentes?: number | null;
  lineas_fuertes?: number | null;
  n_atomos?: string | null;
  prior_complejidad?: number | null;
  visto_en_espacio?: string | null;
  factor_entorno?: number | null;
  log10_Aij?: number | null;
  Eu_K?: number | null;
  QN?: string | null;
  origen?: string | null;
  lista?: string | null;
  tag?: number | null;
  catalog_id: number;
  unc_MHz?: number | null;
  nu_cat_MHz?: number | null;
  isotopologo?: boolean | null;
};
type Pico = { id: string; ventana: WinKey; tipo: string; nu_obs_MHz: number; nu_reposo_MHz: number; Jy: number; snr: number; fwhm_kms?: number | null; blend?: boolean };
type Feature = { nu_reposo_MHz: number; pico: string | null };
type PosData = { picos: Pico[]; candidatas: Cand[]; especies: Record<string, { n_fuertes: number; n_presentes: number; fuertes: Feature[] }> };
type V3 = { parametros: { v_kms: Record<PosKey, number> }; posiciones: Record<PosKey, PosData> };

const FUERA = "(fuera del catálogo)";
const POS: { key: PosKey; label: string; hint: string }[] = [
  { key: "B_offset", label: "B offset", hint: "recomendada: líneas estrechas" },
  { key: "B_pico", label: "B pico", hint: "máximo del polvo de B" },
  { key: "A", label: "A", hint: "líneas anchas y mezcladas" },
];

// confianza orientativa a partir del % de la candidata principal
type Nivel = "alta" | "media" | "baja" | "sin identificar";
const NIVEL: Record<Nivel, { color: string; bg: string; texto: string }> = {
  alta: { color: "#15803d", bg: "#dcfce7", texto: "Alta (≥ 70 %)" },
  media: { color: "#a16207", bg: "#fef3c7", texto: "Media (40–70 %)" },
  baja: { color: "#475569", bg: "#e2e8f0", texto: "Baja (< 40 %)" },
  "sin identificar": { color: "#b91c1c", bg: "#fee2e2", texto: "Sin identificar: gana «fuera del catálogo»" },
};
function nivel(top: Cand | undefined): Nivel {
  if (!top || top.especie === FUERA) return "sin identificar";
  return top.P >= 0.7 ? "alta" : top.P >= 0.4 ? "media" : "baja";
}
const pct = (p: number) => `${Math.round(p * 100)} %`;

export default function Workbench() {
  const [core, setCore] = useState<CoreLoad | null>(null);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [v3, setV3] = useState<V3 | null>(null);
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCore().then(setCore, (e: Error) => setError(e.message));
    loadAnalysis().then((a) => setPeaks(a.peaks));
    fetch("/data/probabilidad.json").then((r) => r.json()).then(setV3, () => setError("No se pudo leer probabilidad.json"));
    fetch("/data/fichas_moleculas.json").then((r) => r.json()).then(setFichas, () => setFichas([]));
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
  const [zoom, setZoom] = useState(false);
  const [panel, setPanel] = useState<null | "moleculas" | "graficas" | "evidencia" | "metodo">(null);
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

  const v = v3.parametros.v_kms[pos];
  const C = meta.c_kms;
  const data = v3.posiciones[pos];

  // candidatas por pico (ordenadas) y líneas de esta ventana
  const porPico = useMemo(() => {
    const m = new Map<string, Cand[]>();
    for (const c of data.candidatas) m.set(c.pico, [...(m.get(c.pico) ?? []), c]);
    for (const cs of m.values()) cs.sort((a, b) => a.rango - b.rango);
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
  const masFrecuentes = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lineas) {
      const t = l.cs[0];
      if (t && t.especie !== FUERA) m.set(t.especie, (m.get(t.especie) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [lineas]);

  // selección por defecto: la línea más intensa
  useEffect(() => {
    if (!lineas.some((l) => l.p.id === sel)) setSel(lineas[0]?.p.id ?? null);
  }, [lineas, sel]);
  const actual = lineas.find((l) => l.p.id === sel) ?? null;
  const top = actual?.cs[0];

  // ---------- gráfico ----------
  const sp = spectra[win];
  const xRest = useMemo(() => sp.freq_GHz.map((f) => f / (1 - v / C)), [sp, v, C]);
  const traces = useMemo(() => {
    const t: Plotly.Data[] = [
      {
        x: xRest,
        y: sp[pos] as number[],
        type: "scatter",
        mode: "lines",
        line: { color: "#0b1220", width: 1, shape: "hvh" },
        hoverinfo: "skip",
        name: "espectro",
      },
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
  const shapes = useMemo(() => {
    if (!actual || !top || top.especie === FUERA || !top.nu_cat_MHz) return [];
    return [
      {
        type: "line" as const,
        x0: top.nu_cat_MHz / 1000,
        x1: top.nu_cat_MHz / 1000,
        yref: "paper" as const,
        y0: 0,
        y1: 1,
        line: { color: "#1d4ed8", width: 1.5, dash: "dot" as const },
      },
    ];
  }, [actual, top]);
  const xRange: [number, number] | undefined =
    zoom && actual ? [actual.p.nu_reposo_MHz / 1000 - 0.012, actual.p.nu_reposo_MHz / 1000 + 0.012] : undefined;

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
        decision: `pendiente (${pct(c.P)} en esta línea)`,
      });
      setRows((rs) => [...rs, row]);
      setToast(`${prettyFormula(c.especie)} añadida a Evidencia`);
    },
    [catalogById, peaks, team, pos, spectra, setRows],
  );

  const ficha = useCallback(
    (c: Cand) =>
      fichas.find((f) => f.formula === c.molecula) ??
      fichas.find((f) => !f.en_censo && f.nombre === c.nombre_quimico) ??
      (c.especie === "Glycine-I" ? fichas.find((f) => f.formula === "Glycine") : undefined),
    [fichas],
  );

  return (
    <div className="min-h-screen bg-night pl-[92px] text-ink">
      <Sidebar
        items={[
          { id: "analizar", label: "Analizar", Icon: ScanSearch, onClick: () => setPanel(null), active: panel === null },
          { id: "moleculas", label: "Moléculas (348)", Icon: Atom, onClick: () => setPanel("moleculas"), active: panel === "moleculas" },
          { id: "graficas", label: "Gráficas Python", Icon: Images, onClick: () => setPanel("graficas"), active: panel === "graficas" },
          { id: "evidencia", label: "Evidencia", Icon: ClipboardList, onClick: () => setPanel("evidencia"), active: panel === "evidencia", badge: rows.length },
          { id: "metodo", label: "Cómo funciona", Icon: BookOpen, onClick: () => setPanel("metodo"), active: panel === "metodo" },
        ]}
      />

      <main className="mx-auto max-w-[1500px] px-6 pb-16 pt-6">
        {/* encabezado */}
        <header className="mb-5">
          <h1 className="text-[1.6rem] font-semibold leading-tight">¿Qué molécula produce cada línea?</h1>
          <p className="mt-1 max-w-[80ch] text-ink-2">
            IRAS 16293-2422 · ALMA banda 7. Para cada línea del espectro, la herramienta ordena las moléculas candidatas y explica por qué.
            <b className="text-ink"> La decisión final es tuya.</b>
          </p>
          <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[0.86rem] text-ink-2">
            {["Elige posición y ventana", "Toca una línea (gráfico o tabla)", "Revisa la molécula más probable y el porqué", "Añádela a Evidencia"].map((t, i) => (
              <li key={t} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.72rem] font-bold text-white">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </header>

        {/* controles */}
        <section className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 rounded-lg border border-rule bg-plate px-4 py-3">
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

        {/* resumen */}
        <section className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9rem]">
          <span>
            <b>{lineas.length}</b> líneas en {win}
          </span>
          {(Object.keys(NIVEL) as Nivel[]).map((n) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm" style={{ background: NIVEL[n].color }} />
              {NIVEL[n].texto.split(":")[0].split(" (")[0]} <b>{conteo[n]}</b>
            </span>
          ))}
          <span className="text-ink-2">
            Más frecuentes:{" "}
            {masFrecuentes.map(([e, k], i) => (
              <span key={e} className="text-ink">
                {i ? " · " : ""}
                {prettyFormula(e)} <span className="text-muted">({k})</span>
              </span>
            ))}
          </span>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_30rem]">
          {/* izquierda: gráfico + tabla */}
          <div className="min-w-0 space-y-4">
            <div className="rounded-lg border border-rule bg-white p-2">
              <div className="flex items-center justify-between px-2 pt-1">
                <p className="text-[0.86rem] font-semibold">Espectro de {POS.find((p) => p.key === pos)?.label}, {win} (frecuencia en reposo)</p>
                {zoom ? (
                  <button type="button" className="btn" onClick={() => setZoom(false)}>
                    <ZoomOut className="icon" /> Ver ventana completa
                  </button>
                ) : actual ? (
                  <button type="button" className="btn" onClick={() => setZoom(true)}>
                    Acercar a la línea seleccionada
                  </button>
                ) : null}
              </div>
              <Plot
                data={traces}
                layout={{
                  height: 360,
                  margin: { l: 56, r: 12, t: 10, b: 46 },
                  paper_bgcolor: "#ffffff",
                  plot_bgcolor: "#ffffff",
                  font: { family: "IBM Plex Sans, sans-serif", size: 12.5, color: "#0b1220" },
                  xaxis: { title: { text: "Frecuencia en reposo (GHz)" }, gridcolor: "#e6ebf2", range: xRange, zeroline: false },
                  yaxis: { title: { text: "Intensidad (Jy/haz)" }, gridcolor: "#e6ebf2", zerolinecolor: "#94a0b4" },
                  showlegend: false,
                  shapes,
                  hovermode: "closest",
                  dragmode: "zoom",
                }}
                config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"] }}
                style={{ width: "100%" }}
                onClick={(e) => {
                  const id = e.points?.[0]?.customdata as string | undefined;
                  if (id) setSel(id);
                }}
              />
              <p className="px-2 pb-1 text-[0.8rem] text-muted">
                Triángulos = líneas detectadas (≥ 4σ), coloreadas por confianza. Línea punteada azul = frecuencia de la molécula más probable para la
                línea seleccionada.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-rule">
              <table className="w-full text-[0.88rem]">
                <thead className="bg-plate text-left text-[0.74rem] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Línea (reposo, MHz)</th>
                    <th className="px-3 py-2 text-right">Intensidad</th>
                    <th className="px-3 py-2 text-right">S/N</th>
                    <th className="px-3 py-2">Molécula más probable</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2">Confianza</th>
                  </tr>
                </thead>
              </table>
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-[0.88rem]">
                  <tbody>
                    {lineas.map(({ p, cs }) => {
                      const t = cs[0];
                      const n = nivel(t);
                      const on = p.id === sel;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSel(p.id)}
                          className={`cursor-pointer border-t border-rule ${on ? "bg-accent-dim" : "hover:bg-plate"}`}
                          style={on ? { boxShadow: "inset 3px 0 0 #1d4ed8" } : undefined}
                        >
                          <td className="px-3 py-1.5 font-mono text-[0.84rem]">{p.nu_reposo_MHz.toFixed(2)}</td>
                          <td className="px-3 py-1.5 text-right">{p.Jy.toFixed(2)} Jy/haz</td>
                          <td className="px-3 py-1.5 text-right">{p.snr.toFixed(0)}</td>
                          <td className="px-3 py-1.5 font-medium">{t && t.especie !== FUERA ? prettyFormula(t.especie) : <span className="text-critical">—</span>}</td>
                          <td className="px-3 py-1.5 text-right">{t ? pct(t.P) : ""}</td>
                          <td className="px-3 py-1.5">
                            <span className="rounded px-1.5 py-0.5 text-[0.76rem] font-semibold" style={{ color: NIVEL[n].color, background: NIVEL[n].bg }}>
                              {n}
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

          {/* derecha: la línea seleccionada */}
          <aside className="self-start xl:sticky xl:top-4">
            {actual ? (
              <LineaSeleccionada
                p={actual.p}
                cs={actual.cs}
                feats={top ? (data.especies[top.especie]?.fuertes ?? null) : null}
                ficha={top && top.especie !== FUERA ? ficha(top) : undefined}
                onRegistrar={registrar}
              />
            ) : (
              <p className="text-muted">Selecciona una línea.</p>
            )}
          </aside>
        </div>

        <footer className="mt-10 border-t border-rule pt-4 text-[0.78rem] text-muted">
          This project makes use of the following ALMA data: {meta.credit}. ALMA is a partnership of ESO, NSF and NINS, with NRC, NSTC, ASIAA and KASI,
          in cooperation with the Republic of Chile. Productos ARI-L; contexto PILS (Jørgensen et al. 2016). Catálogos CDMS y JPL (vía Splatalogue).
        </footer>
      </main>

      <Dialog open={panel === "moleculas"} onClose={() => setPanel(null)} kind="sheet" title="Moléculas" subtitle="censo CDMS (348) y especies de laboratorio en la banda">
        <MoleculesPanel />
      </Dialog>
      <Dialog open={panel === "graficas"} onClose={() => setPanel(null)} kind="sheet" title="Gráficas Python" subtitle="las de las instrucciones, reproducidas">
        <ReferencePlots />
      </Dialog>
      <Dialog open={panel === "evidencia"} onClose={() => setPanel(null)} kind="sheet" title="Evidencia" subtitle="columnas de evidencia_plantilla.csv">
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
      </Dialog>
      <Dialog open={panel === "metodo"} onClose={() => setPanel(null)} kind="modal" title="Cómo funciona">
        <MethodBody />
      </Dialog>

      {toast ? (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ink px-4 py-2.5 text-[0.88rem] text-white shadow-lg">
          ✓ {toast}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- panel derecho
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

function LineaSeleccionada({
  p,
  cs,
  feats,
  ficha,
  onRegistrar,
}: {
  p: Pico;
  cs: Cand[];
  feats: Feature[] | null;
  ficha: Ficha | undefined;
  onRegistrar: (c: Cand) => void;
}) {
  const top = cs[0];
  const n = nivel(top);
  const sinId = !top || top.especie === FUERA;
  return (
    <div className="rounded-lg border-2 border-ink bg-white">
      <div className="border-b border-rule px-4 py-3">
        <p className="text-[0.76rem] font-semibold uppercase tracking-wide text-muted">Línea seleccionada</p>
        <p className="mt-0.5 font-mono text-[1.05rem]">{p.nu_reposo_MHz.toFixed(2)} MHz</p>
        <p className="text-[0.84rem] text-ink-2">
          {p.Jy.toFixed(2)} Jy/haz · S/N {p.snr.toFixed(0)}
          {p.fwhm_kms ? ` · ancho ${p.fwhm_kms.toFixed(1)} km/s` : ""}
          {p.blend ? " · posible mezcla" : ""}
        </p>
      </div>

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
        {!sinId && ficha ? (
          <p className="text-[0.9rem] text-ink-2">
            {top.isotopologo ? `variante isotópica de ${ficha.nombre.toLowerCase()}` : ficha.nombre}
          </p>
        ) : null}
        <span className="mt-2 inline-block rounded px-2 py-0.5 text-[0.8rem] font-semibold" style={{ color: NIVEL[n].color, background: NIVEL[n].bg }}>
          Confianza: {NIVEL[n].texto}
        </span>
        {sinId ? (
          <p className="mt-2 text-[0.86rem] text-ink-2">
            Ninguna transición de CDMS/JPL en la banda explica esta línea mejor que una candidata débil de referencia. Puede ser una especie fuera de los
            catálogos o una mezcla.
          </p>
        ) : null}

        {/* alternativas */}
        <div className="mt-4 space-y-1.5">
          {cs.map((c) => (
            <div key={c.especie} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-2 text-[0.86rem]">
              <span className={`truncate ${c.especie === FUERA ? "italic text-muted" : "font-medium"}`} title={c.especie}>
                {c.especie === FUERA ? "fuera del catálogo" : prettyFormula(c.especie)}
              </span>
              <span className="h-2.5 rounded-sm bg-plate-2">
                <span className="block h-full rounded-sm" style={{ width: `${c.P * 100}%`, background: c.especie === FUERA ? "#94a0b4" : c === top ? "#1d4ed8" : "#64748b" }} />
              </span>
              <span className="text-right tabular-nums">{pct(c.P)}</span>
            </div>
          ))}
        </div>
      </div>

      {!sinId ? (
        <>
          <div className="border-t border-rule px-4 py-3">
            <p className="mb-2 text-[0.76rem] font-semibold uppercase tracking-wide text-muted">¿Por qué {prettyFormula(top.especie)}?</p>
            <Porque c={top} feats={feats} ficha={ficha} />
          </div>
          {ficha ? (
            <div className="border-t border-rule px-4 py-3 text-[0.86rem]">
              <p className="mb-1 text-[0.76rem] font-semibold uppercase tracking-wide text-muted">Sobre la molécula</p>
              <p>{ficha.descripcion}</p>
              <p className="mt-1 font-medium">{BIO[ficha.relevancia_biotica] ?? ""}</p>
              <p className="mt-1 text-[0.76rem] text-muted">Ficha en borrador, pendiente de verificación.</p>
            </div>
          ) : null}
          <div className="border-t border-rule px-4 py-3">
            <button type="button" className="btn btn-primary w-full justify-center py-2 text-[0.9rem]" onClick={() => onRegistrar(top)}>
              <Plus className="icon" /> Añadir {prettyFormula(top.especie)} a Evidencia
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
/** 10^-2.79 → "1.6 × 10⁻³" */
function sci(log10: number | null | undefined): string {
  if (log10 == null) return "—";
  const e = Math.floor(log10);
  const m = 10 ** (log10 - e);
  return `${m.toFixed(1)} × 10${[...String(e)].map((ch) => SUP[ch] ?? ch).join("")}`;
}

/** Los factores, en palabras. Verde = a favor, ámbar = a medias, rojo = en contra. */
function Porque({ c, feats, ficha }: { c: Cand; feats: Feature[] | null; ficha: Ficha | undefined }) {
  const tono = (x: number | null | undefined) => (x == null ? "#475569" : x >= 0.6 ? "#15803d" : x >= 0.25 ? "#a16207" : "#b91c1c");
  const lf = c.L_frecuencia ?? null;
  const le = c.L_Einstein ?? null;
  const lr = c.L_repeticion ?? null;
  const visto = c.visto_en_espacio ?? "—";
  const vistoTono = visto === "detectada" ? 1 : visto === "tentativa" ? 0.4 : 0.1;
  const ent = c.factor_entorno ?? null;
  const filas: { k: string; v: string; x: number | null }[] = [
    {
      k: "Frecuencia",
      v: `${lf != null && lf >= 0.6 ? "Coincide" : lf != null && lf >= 0.25 ? "Cerca" : "Lejos"}: a ${Math.abs(c.delta_MHz ?? 0).toFixed(2)} MHz del catálogo`,
      x: lf,
    },
    {
      k: "Coef. de Einstein",
      v: `A = ${sci(c.log10_Aij)} s⁻¹, nivel a ${Math.round(c.Eu_K ?? 0)} K: ${le != null && le >= 0.6 ? "intensidad esperada compatible" : le != null && le >= 0.25 ? "intensidad algo distinta a la esperada" : "no debería verse tan intensa"}`,
      x: le,
    },
    {
      k: "Se repite",
      v:
        (c.lineas_fuertes ?? 0) < 2
          ? "sólo tiene 1 línea fuerte en la banda: no se puede comprobar"
          : `${c.lineas_presentes} de ${c.lineas_fuertes} líneas fuertes aparecen en W1 + W2`,
      x: lr,
    },
    {
      k: "Complejidad",
      v: `${c.n_atomos} átomos (${Math.round((c.prior_complejidad ?? 0) * 348)} de las 348 moléculas conocidas tienen ese tamaño)`,
      x: null,
    },
    {
      k: "Visto en el espacio",
      v: visto === "detectada" ? "Sí (censo CDMS)" : visto === "tentativa" ? "Tentativa" : visto === "isotopólogo no confirmado" ? "Variante isotópica no confirmada" : "No",
      x: vistoTono,
    },
    {
      k: "Entorno",
      v: ficha ? ENTORNO[ficha.entorno] ?? ficha.entorno : "—",
      x: ent,
    },
  ];
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap gap-x-3 text-[0.74rem] text-muted">
        {(
          [
            ["#15803d", "a favor"],
            ["#a16207", "a medias"],
            ["#b91c1c", "en contra"],
            ["#475569", "contexto"],
          ] as const
        ).map(([col, t]) => (
          <span key={t} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: col }} />
            {t}
          </span>
        ))}
      </p>
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
      {feats && feats.length > 1 ? (
        <div className="pt-1">
          <p className="text-[0.78rem] text-muted">Sus líneas fuertes en la banda (✓ aparece · ✗ falta):</p>
          <p className="mt-1 flex flex-wrap gap-1.5 font-mono text-[0.76rem]">
            {feats.map((f) => (
              <span
                key={f.nu_reposo_MHz}
                className="rounded px-1.5 py-0.5"
                style={{ background: f.pico ? "#dcfce7" : "#fee2e2", color: f.pico ? "#15803d" : "#b91c1c" }}
              >
                {f.pico ? "✓" : "✗"} {f.nu_reposo_MHz.toFixed(1)}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}

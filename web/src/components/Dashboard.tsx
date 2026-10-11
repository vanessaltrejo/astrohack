"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Atom, AudioWaveform, BookOpen, ChartBarBig, ClipboardList, Fingerprint, Images, Keyboard, RefreshCw, Table2 } from "lucide-react";
import {
  findPeak,
  loadAnalysis,
  loadCore,
  type AnalysisLoad,
  type CatalogLine,
  type CoreLoad,
  type Peak,
  type PeakCandidate,
  type PosKey,
  type Verdict,
  type WinKey,
} from "@/lib/data";
import { AI_DECLARATION, APP_NAME, LOGI_DEFAULT, PEAK_ZOOM_HALF_GHZ, POSITION_LABELS, PROJECT_LABEL, SOURCE_LABEL, TEAM_NAME_DEFAULT } from "@/lib/config";
import { orderedSpecies, speciesInfo } from "@/lib/species";
import { observedFreqGHz, paddedRange, sliceFreq } from "@/lib/spectro";
import { loadRows, loadTeam, saveRows, saveTeam, type EvidenceRow } from "@/lib/evidence";
import { prefillRow } from "@/lib/prefill";
import { f } from "@/lib/format";
import { useReveal, useScrollSpy } from "@/lib/motion";
import SpectrumSection from "./SpectrumSection";
import PeaksTable from "./PeaksTable";
import Fingerprints from "./Fingerprints";
import FieldMap from "./FieldMap";
import EvidenceLog from "./EvidenceLog";
import { Dialog, MethodBody, SectionHead, ShortcutsBody } from "./ui";
import RightRail from "./RightRail";
import MoleculesPanel from "./MoleculesPanel";
import ReferencePlots from "./ReferencePlots";
import LineProbability from "./LineProbability";
import { Tex, SYM } from "./Tex";

const SECTIONS = [
  { id: "espectro", label: "Espectro", key: "1" },
  { id: "probabilidad", label: "Probabilidad", key: "2" },
  { id: "huellas", label: "Huellas", key: "3" },
  { id: "candidatas", label: "Candidatas", key: "4" },
] as const;
const SECTION_IDS = SECTIONS.map((s) => s.id);

export default function Dashboard() {
  const [core, setCore] = useState<CoreLoad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisLoad | null>(null);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    loadCore().then(setCore, (e: Error) => setError(e.message));
    loadAnalysis().then(setAnalysis);
  }, []);

  const reload = useCallback(async () => {
    setReloading(true);
    try {
      setAnalysis(await loadAnalysis(true));
    } finally {
      setReloading(false);
    }
  }, []);

  if (error)
    return (
      <main className="mx-auto max-w-3xl px-8 py-24">
        <h1 className="wordmark text-5xl">{APP_NAME}</h1>
        <p className="mt-6 text-lg">No se pudieron cargar los datos base.</p>
        <p className="id mt-2 text-critical">{error}</p>
        <p className="mt-4 text-ink-2">
          Comprueba que existen <span className="id">meta.json</span>, <span className="id">spectra.json</span> y{" "}
          <span className="id">catalog.json</span> en <span className="id">web/public/data/</span> (los genera{" "}
          <span className="id">analysis/export_web.py</span>).
        </p>
      </main>
    );

  if (!core) return <Skeleton />;

  return <Loaded core={core} analysis={analysis} reload={reload} reloading={reloading} />;
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1680px] px-6" aria-busy>
      <div className="flex items-center gap-6 py-3">
        <span className="wordmark text-[1.6rem]">{APP_NAME}</span>
        <span className="skeleton h-3 w-40" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <span className="skeleton block h-8 w-44" />
          <span className="skeleton block h-4 w-2/3" />
          <span className="skeleton block h-[560px] w-full" />
        </div>
        <div className="space-y-3">
          <span className="skeleton block h-24 w-full" />
          <span className="skeleton block aspect-square w-full" />
        </div>
      </div>
    </div>
  );
}

function Loaded({
  core,
  analysis,
  reload,
  reloading,
}: {
  core: CoreLoad;
  analysis: AnalysisLoad | null;
  reload: () => void;
  reloading: boolean;
}) {
  const { meta, spectra, catalog, continuum } = core;
  const peaks = analysis?.peaks ?? null;
  const scores = analysis?.scores ?? null;
  const pipeline = analysis?.pipeline ?? null;
  const peaksState = analysis ? analysis.peaksState : "missing";
  const scoresState = analysis ? analysis.scoresState : "missing";

  const speciesKeys = useMemo(() => orderedSpecies(catalog.map((l) => l.species)), [catalog]);
  const catalogById = useMemo(() => new Map(catalog.map((l) => [l.id, l])), [catalog]);

  // ---------- estado ----------
  const [win, setWinRaw] = useState<WinKey>("W1");
  const [active, setActiveRaw] = useState<PosKey>("B_offset");
  const [overlay, setOverlay] = useState<PosKey[]>([]);
  const [v, setV] = useState<number>(meta.positions.B_offset.v_start_kms);
  const vPlot = useDeferredValue(v);
  const [speciesOn, setSpeciesOn] = useState<Set<string>>(() => new Set(speciesKeys));
  const [hoverSpecies, setHoverSpecies] = useState<string | null>(null);
  const [minLogI, setMinLogI] = useState(LOGI_DEFAULT);
  const [rest, setRest] = useState(false);
  const [guides, setGuides] = useState(true);
  const [xRange, setXRange] = useState<[number, number] | null>(null);
  const [yRange, setYRange] = useState<[number, number] | null>(null);
  const [selRange, setSelRange] = useState<[number, number] | null>(null);
  const [fpSpecies, setFpSpecies] = useState<string | null>(null);
  const [rows, setRowsRaw] = useState<EvidenceRow[]>([]);
  const [team, setTeamRaw] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [method, setMethod] = useState(false);
  const [keys, setKeys] = useState(false);
  const [molPanel, setMolPanel] = useState(false);
  const [figPanel, setFigPanel] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  const [flashRange, setFlashRange] = useState<[number, number] | null>(null);
  const [vPulse, setVPulse] = useState(0);
  const current = useScrollSpy(SECTION_IDS);
  const revHuellas = useReveal<HTMLElement>();
  const revCand = useReveal<HTMLElement>();
  const headRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setRowsRaw(loadRows());
    setTeamRaw(loadTeam() || TEAM_NAME_DEFAULT);
  }, []);

  // cabecera compacta a partir de 40 px de scroll
  useEffect(() => {
    const onScroll = () => setShrunk(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const setRows = useCallback((fn: (r: EvidenceRow[]) => EvidenceRow[]) => {
    setRowsRaw((prev) => {
      const next = fn(prev);
      saveRows(next);
      return next;
    });
  }, []);
  const setTeam = useCallback((t: string) => {
    setTeamRaw(t);
    saveTeam(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const fpDefault = useMemo(() => {
    const ps = scores?.[active];
    if (ps) {
      const best = Object.entries(ps).sort((a, b) => b[1].score - a[1].score || b[1].n_matched - a[1].n_matched)[0];
      if (best) return best[0];
    }
    return speciesKeys.includes("CH3OCHO") ? "CH3OCHO" : speciesKeys[0];
  }, [scores, active, speciesKeys]);
  const fpSp = fpSpecies ?? fpDefault;

  // ---------- acciones ----------
  const setWin = useCallback((w: WinKey) => {
    setWinRaw(w);
    setXRange(null);
    setYRange(null);
    setSelRange(null);
  }, []);

  const setActive = useCallback(
    (p: PosKey) => {
      if (p !== active) setV(meta.positions[p].v_start_kms);
      setActiveRaw(p);
      setOverlay((o) => o.filter((x) => x !== p));
      setSelRange(null);
    },
    [meta, active],
  );

  const toggleOverlay = useCallback((p: PosKey) => {
    setOverlay((o) => (o.includes(p) ? o.filter((x) => x !== p) : [...o, p]));
  }, []);

  const scrollTo = (id: string) => {
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  };
  /** lleva el gráfico (no la cabecera de la sección) a la vista, con los controles encima si caben */
  const scrollToPlot = () => {
    // dos frames: el primero deja que React pinte el nuevo rango, el segundo desplaza
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("espectro-plot")?.scrollIntoView({ block: "start" })));
  };

  const fitY = useCallback(
    (w: WinKey, positions: PosKey[], x0: number, x1: number): [number, number] | null => {
      const vals: number[] = [];
      for (const p of positions) vals.push(...sliceFreq(spectra[w].freq_GHz, spectra[w][p], x0, x1).y);
      const s = spectra[w].noise[positions[0]]?.sigma_Jy ?? 0;
      vals.push(-s, s);
      const r = paddedRange(vals, 0.12);
      if (!r) return null;
      return [r[0], r[1] + 2.5 * s];
    },
    [spectra],
  );

  const zoomTo = useCallback(
    (w: WinKey, p: PosKey, fGHz: number) => {
      setWinRaw(w);
      if (p !== active) setActive(p);
      const x: [number, number] = [fGHz - PEAK_ZOOM_HALF_GHZ, fGHz + PEAK_ZOOM_HALF_GHZ];
      setXRange(x);
      setYRange(fitY(w, [p, ...overlay.filter((o) => o !== p)], x[0], x[1]));
      setSelRange(null);
      setRest(false);
      // la banda objetivo se ilumina ~1.2 s para que el ojo la encuentre tras el salto
      setFlashRange([fGHz - 0.0006, fGHz + 0.0006]);
      scrollToPlot();
    },
    [active, setActive, fitY, overlay],
  );
  useEffect(() => {
    if (!flashRange) return;
    const t = setTimeout(() => setFlashRange(null), 1200);
    return () => clearTimeout(t);
  }, [flashRange]);

  const addEvidence = useCallback(
    (row: EvidenceRow) => {
      setRows((rs) => [...rs, row]);
      setFlashId(row._id);
      setToast(`${speciesInfo(row.especie).formula} ${row.frecuencia_reposo_MHz} MHz añadida al registro`);
    },
    [setRows],
  );

  const logCandidate = useCallback(
    (w: WinKey, p: PosKey, peak: Peak, cand: PeakCandidate) => {
      const line = catalogById.get(cand.catalog_id);
      if (!line) return;
      addEvidence(prefillRow({ team, line, win: w, pos: p, peak, noise: spectra[w].noise[p] }));
    },
    [catalogById, addEvidence, team, spectra],
  );

  const logLine = useCallback(
    (line: CatalogLine, w: WinKey | null, peakId: string | null) => {
      const found = peakId ? findPeak(peaks, peakId) : null;
      const verdict = scores?.[active]?.[line.species]?.verdict;
      addEvidence(
        prefillRow({
          team,
          line,
          win: w,
          pos: active,
          peak: found?.peak ?? null,
          noise: w ? spectra[w].noise[active] : null,
          decision: verdict ? `pendiente (pipeline: ${verdict})` : "pendiente",
        }),
      );
    },
    [peaks, scores, active, addEvidence, team, spectra],
  );

  const showInSpectrum = useCallback((sp: string, vv: number) => {
    const vq = Math.min(6, Math.max(0, Math.round(vv / 0.05) * 0.05));
    setSpeciesOn(new Set([sp]));
    setVPulse((k) => k + 1);
    setGuides(true);
    setRest(false);
    setXRange(null);
    setYRange(null);
    void vq;
    setToast(`Sólo ${speciesInfo(sp).formula} en el espectro`);
    scrollToPlot();
  }, []);

  // atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const sec = SECTIONS.find((s) => s.key === e.key);
      if (sec) return scrollTo(sec.id);
      switch (e.key) {
        case "e":
          return setDrawer(true);
        case "m":
          return setMethod(true);
        case "?":
          return setKeys(true);
        case "w":
          return setWin(win === "W1" ? "W2" : "W1");
        case "b":
          return setActive("B_offset");
        case "p":
          return setActive("B_pico");
        case "a":
          return setActive("A");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [win, setWin, setActive]);

  // ---------- derivados ----------
  const [lo, hi] = meta.windows[win].range_GHz;
  const windowLines = useMemo(
    () =>
      catalog.filter((l) => {
        const fo = observedFreqGHz(l.rest_MHz, vPlot);
        return fo >= lo && fo <= hi;
      }),
    [catalog, vPlot, lo, hi],
  );
  const lineCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of windowLines) if (l.logI_300K >= minLogI) m.set(l.species, (m.get(l.species) ?? 0) + 1);
    return m;
  }, [windowLines, minLogI]);
  const visibleLines = useMemo(
    () => windowLines.filter((l) => speciesOn.has(l.species) && l.logI_300K >= minLogI),
    [windowLines, speciesOn, minLogI],
  );

  const sigma = spectra[win].noise[active]?.sigma_Jy ?? 0;
  const baseline = pipeline?.noise?.[win]?.[active]?.baseline_Jy ?? 0;
  const activePeaks = peaks?.[win]?.[active] ?? null;
  // velocidad DADA por los organizadores (Guía p. 8, diapositiva 22); no se estima
  const vPipeline = meta.positions[active].v_start_kms;
  const verdictOf = useCallback((sp: string): Verdict | null => scores?.[active]?.[sp]?.verdict ?? null, [scores, active]);
  const laneSpecies = useMemo(() => speciesKeys.filter((sp) => speciesOn.has(sp)), [speciesKeys, speciesOn]);


  const wm = meta.windows.W1;

  return (
    <div className="pr-[76px]">
      <RightRail
        items={[
          ...SECTIONS.map((sec) => ({
            id: sec.id,
            label: sec.label,
            Icon: { espectro: AudioWaveform, probabilidad: ChartBarBig, huellas: Fingerprint, candidatas: Table2 }[sec.id],
            onClick: () => scrollTo(sec.id),
            active: current === sec.id,
            title: `${sec.label} (${sec.key})`,
          })),
          { id: "moleculas", label: "Moléculas (348)", Icon: Atom, onClick: () => setMolPanel(true), divider: true, title: "Base de datos de moléculas" },
          { id: "graficas", label: "Gráficas Python", Icon: Images, onClick: () => setFigPanel(true), title: "Gráficas de referencia reproducidas" },
          { id: "evidencia", label: "Evidencia", Icon: ClipboardList, onClick: () => setDrawer(true), badge: rows.length, divider: true, title: "Registro de evidencia (e)" },
          { id: "metodo", label: "Método", Icon: BookOpen, onClick: () => setMethod(true), title: "Método (m)" },
          { id: "recargar", label: "Recargar", Icon: RefreshCw, onClick: reload, spin: reloading, title: "Volver a leer el análisis" },
          { id: "atajos", label: "Atajos", Icon: Keyboard, onClick: () => setKeys(true), title: "Atajos de teclado (?)" },
        ]}
      />
      {/* ---------- cabecera ---------- */}
      <header ref={headRef} className={`masthead sticky top-0 z-30 border-b border-rule bg-night/95 ${shrunk ? "shrunk" : ""}`}>
        <div className="masthead-row mx-auto flex max-w-[1680px] items-center gap-5 px-6 py-3">
          <a href="#espectro" className="wordmark text-[1.6rem] text-ink">
            {APP_NAME}
          </a>
          <p className="hidden text-[0.84rem] text-ink-2 md:block">
            {SOURCE_LABEL} <span className="text-muted">— {PROJECT_LABEL}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-6">
        {/* ---------- espectro + campo ---------- */}
        <section id="espectro" aria-labelledby="espectro-title" className="pt-7">
          <SectionHead
            id="espectro"
            title="Espectro"
            subtitle={
              <>
                {POSITION_LABELS[active]}, {win}, {f(meta.windows[win].range_GHz[0], 3)}–{f(meta.windows[win].range_GHz[1], 3)} GHz
              </>
            }
          />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <SpectrumSection
              meta={meta}
              spectra={spectra[win]}
              win={win}
              setWin={setWin}
              active={active}
              setActive={setActive}
              overlay={overlay}
              toggleOverlay={toggleOverlay}
              v={v}
              vPlot={vPlot}
              setV={setV}
              vPipeline={vPipeline}
              rest={rest}
              setRest={setRest}
              guides={guides}
              setGuides={setGuides}
              speciesKeys={speciesKeys}
              speciesOn={speciesOn}
              toggleSpecies={(sp) =>
                setSpeciesOn((s) => {
                  const n = new Set(s);
                  if (n.has(sp)) n.delete(sp);
                  else n.add(sp);
                  return n;
                })
              }
              setAllSpecies={(on) => setSpeciesOn(on ? new Set(speciesKeys) : new Set())}
              verdictOf={verdictOf}
              hoverSpecies={hoverSpecies}
              setHoverSpecies={setHoverSpecies}
              minLogI={minLogI}
              setMinLogI={setMinLogI}
              lineCounts={lineCounts}
              visibleLines={visibleLines}
              peaks={activePeaks}
              peaksState={peaksState}
              sigma={sigma}
              baseline={baseline}
              xRange={xRange}
              yRange={yRange}
              onRangeChange={(x, y) => {
                setXRange(x);
                setYRange(y);
              }}
              selRange={selRange}
              setSelRange={setSelRange}
              onMethod={() => setMethod(true)}
              busy={v !== vPlot}
              laneSpecies={laneSpecies}
              flashRange={flashRange}
              vPulse={vPulse}
            />

            <aside className="self-start lg:sticky lg:top-[4.2rem]">
              {/* velocidad dada + acceso al motor v3 */}
              <div className="mb-6 border-b border-rule pb-5">
                <p className="fig text-[2.6rem]">
                  {vPipeline} <span className="serif ml-1 text-[1.1rem] italic text-ink-2">km/s</span>
                </p>
                <p className="caption mt-1">velocidad dada por los organizadores para {POSITION_LABELS[active]}; el espectro sólo se lleva de observado a reposo</p>
                <button type="button" className="btn mt-3" onClick={() => scrollTo("probabilidad")}>
                  <ChartBarBig className="icon" /> Ver probabilidad por línea
                </button>
                <p className="caption mt-3">
                  Haz {f(wm.beam_arcsec[0], 2)}″ × {f(wm.beam_arcsec[1], 2)}″, canal {f(wm.step_MHz * 1000, 0)} kHz ({f(wm.step_kms, 2)} km/s),
                  intensidades en <Tex>{SYM.jyb}</Tex> de un píxel. Crédito ALMA {meta.credit}.
                </p>
              </div>

              <FieldMap
                continuum={continuum}
                meta={meta}
                active={active}
                setActive={setActive}
                sigmaOf={(w, p) => spectra[w].noise[p]?.sigma_Jy ?? NaN}
                peaks={peaks}
                pipeline={pipeline}
              />
            </aside>
          </div>
        </section>

        {/* ---------- probabilidad por línea (motor v3) ---------- */}
        <section id="probabilidad" aria-labelledby="probabilidad-title" className="pt-16">
          <SectionHead id="probabilidad" title="Probabilidad por línea" subtitle="qué molécula explica cada pico, y por qué" />
          <LineProbability active={active} win={win} setWin={setWin} onZoom={(w, fGHz) => zoomTo(w, active, fGHz)} />
        </section>

        {/* ---------- huellas ---------- */}
        <section id="huellas" aria-labelledby="huellas-title" className="reveal pt-16" ref={revHuellas}>
          <SectionHead id="huellas" title="Huellas moleculares" subtitle="cada línea predicha, vista en velocidad" />
          <Fingerprints
            meta={meta}
            spectra={spectra}
            catalog={catalog}
            catalogById={catalogById}
            speciesKeys={speciesKeys}
            scores={scores}
            scoresState={scoresState}
            active={active}
            fpSpecies={fpSp}
            setFpSpecies={setFpSpecies}
            vControl={v}
            vAdopted={vPipeline}
            onHoverSpecies={setHoverSpecies}
            onZoomLine={(w, fGHz) => zoomTo(w, active, fGHz)}
            onLogLine={logLine}
            onShowInSpectrum={showInSpectrum}
          />
        </section>

        {/* ---------- candidatas ---------- */}
        <section id="candidatas" aria-labelledby="candidatas-title" className="reveal pb-10 pt-16" ref={revCand}>
          <SectionHead id="candidatas" title="Candidatas" subtitle={<>picos de S/N ≥ 4 y las transiciones que podrían explicarlos</>} />
          <PeaksTable peaks={peaks} peaksState={peaksState} active={active} vAdopted={vPipeline} onZoom={zoomTo} onLog={logCandidate} />
        </section>
      </main>

      <footer className="mt-10 border-t border-rule">
        <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-6 px-6 py-6 text-[0.78rem] text-ink-2 md:grid-cols-[1fr_auto] md:gap-8">
          <div className="max-w-[96ch] space-y-1.5">
            <p className="text-ink">This paper makes use of the following ALMA data: {meta.credit}.</p>
            <p className="text-muted">
              ALMA is a partnership of ESO (representing its member states), NSF (USA) and NINS (Japan), together with NRC (Canada), NSTC and ASIAA (Taiwan),
              and KASI (Republic of Korea), in cooperation with the Republic of Chile. The Joint ALMA Observatory is operated by ESO, AUI/NRAO and NAOJ. Cubos
              procesados por ARI-L (ALMA Re-Imaging of Legacy data). Contexto científico: PILS, Protostellar Interferometric Line Survey (Jørgensen et al.
              2016, A&amp;A 595, A117). Espectroscopía: catálogos CDMS (Colonia) y JPL.
            </p>
            <p className="text-muted">{AI_DECLARATION}</p>
          </div>
          <div className="text-right">
            <p className="wordmark text-xl text-ink">{APP_NAME}</p>
            <p className="caption mt-1">AstroHack SATEM 2026</p>
          </div>
        </div>
      </footer>

      <Dialog open={drawer} onClose={() => setDrawer(false)} kind="sheet" title="Evidencia" subtitle="una fila por línea defendida o descartada">
        <EvidenceLog rows={rows} setRows={setRows} team={team} setTeam={setTeam} flashId={flashId} />
      </Dialog>

      <Dialog open={method} onClose={() => setMethod(false)} kind="modal" title="Método" subtitle="convenciones y fórmulas">
        <MethodBody />
      </Dialog>

      <Dialog open={molPanel} onClose={() => setMolPanel(false)} kind="sheet" title="Moléculas" subtitle="censo CDMS 09/2026 (348) + especies de laboratorio en la banda">
        <MoleculesPanel />
      </Dialog>

      <Dialog open={figPanel} onClose={() => setFigPanel(false)} kind="sheet" title="Gráficas de referencia" subtitle="las de las instrucciones, reproducidas en Python">
        <ReferencePlots />
      </Dialog>

      <Dialog open={keys} onClose={() => setKeys(false)} kind="modal" narrow title="Atajos">
        <ShortcutsBody />
      </Dialog>

      {toast ? (
        <div role="status" className="toast fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 border border-rule-strong bg-plate-2 px-4 py-2.5 text-[0.84rem]">
          <span style={{ color: "var(--color-good)" }}>✓</span>
          {toast}
          <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => setDrawer(true)}>
            Ver registro
          </button>
        </div>
      ) : null}
    </div>
  );
}

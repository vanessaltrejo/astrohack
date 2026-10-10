"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  findPeak,
  loadAnalysis,
  loadCore,
  POSITION_KEYS,
  type AnalysisLoad,
  type CatalogLine,
  type CoreLoad,
  type Peak,
  type PeakCandidate,
  type PosKey,
  type WinKey,
} from "@/lib/data";
import { AI_DECLARATION, APP_NAME, APP_TAGLINE, LOGI_DEFAULT, PEAK_ZOOM_HALF_GHZ, POSITION_LABELS } from "@/lib/config";
import { orderedSpecies, speciesInfo } from "@/lib/species";
import { observedFreqGHz, paddedRange, sliceFreq } from "@/lib/spectro";
import { loadRows, loadTeam, saveRows, saveTeam, type EvidenceRow } from "@/lib/evidence";
import { prefillRow } from "@/lib/prefill";
import SpectrumSection from "./SpectrumSection";
import PeaksTable from "./PeaksTable";
import Fingerprints from "./Fingerprints";
import FieldMap from "./FieldMap";
import EvidenceLog from "./EvidenceLog";
import { SectionHead } from "./ui";

const SECTIONS = [
  { id: "espectro", label: "Espectro" },
  { id: "candidatas", label: "Candidatas" },
  { id: "huellas", label: "Huellas moleculares" },
  { id: "campo", label: "Campo" },
  { id: "evidencia", label: "Evidencia" },
] as const;

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
        <h1 className="wordmark text-6xl">{APP_NAME}</h1>
        <p className="mt-6 text-lg">No se pudieron cargar los datos base.</p>
        <p className="num mt-2 text-critical">{error}</p>
        <p className="mt-4 text-ink-2">
          Comprueba que existen <span className="num">meta.json</span>, <span className="num">spectra.json</span> y{" "}
          <span className="num">catalog.json</span> en <span className="num">web/public/data/</span> (los genera{" "}
          <span className="num">analysis/export_web.py</span>).
        </p>
      </main>
    );

  if (!core)
    return (
      <main className="mx-auto max-w-3xl px-8 py-24">
        <h1 className="wordmark text-6xl">{APP_NAME}</h1>
        <p className="mt-6 text-ink-2">Cargando espectros ALMA…</p>
      </main>
    );

  return <Loaded core={core} analysis={analysis} reload={reload} reloading={reloading} />;
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

  useEffect(() => {
    setRowsRaw(loadRows());
    setTeamRaw(loadTeam());
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
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // especie por defecto en huellas: la mejor puntuada de la posición activa
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

  const fitY = useCallback(
    (w: WinKey, positions: PosKey[], x0: number, x1: number): [number, number] | null => {
      const vals: number[] = [];
      for (const p of positions) vals.push(...sliceFreq(spectra[w].freq_GHz, spectra[w][p], x0, x1).y);
      const s = spectra[w].noise[positions[0]]?.sigma_Jy ?? 0;
      vals.push(-s, s);
      const r = paddedRange(vals, 0.12);
      if (!r) return null;
      // deja aire para los marcadores de pico (que se dibujan 2.2σ por encima)
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
      scrollTo("espectro");
    },
    [active, setActive, fitY, overlay],
  );

  const addEvidence = useCallback(
    (row: EvidenceRow) => {
      setRows((rs) => [...rs, row]);
      setFlashId(row._id);
      setToast(`Fila añadida a Evidencia: ${speciesInfo(row.especie).formula} ${row.frecuencia_reposo_MHz} MHz`);
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

  const showInSpectrum = useCallback(
    (sp: string, vv: number) => {
      setSpeciesOn(new Set([sp]));
      setV(Math.min(6, Math.max(0, Math.round(vv / 0.05) * 0.05)));
      setGuides(true);
      setRest(false);
      setXRange(null);
      setYRange(null);
      scrollTo("espectro");
    },
    [],
  );

  // ---------- derivados del espectro ----------
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
  const vPipeline = pipeline?.v_adopted?.[active]?.v_kms ?? null;

  const nPeaks = peaks
    ? (["W1", "W2"] as const).reduce((s, w) => s + POSITION_KEYS.reduce((t, p) => t + (peaks[w]?.[p]?.length ?? 0), 0), 0)
    : null;
  const nScored = scores ? Object.keys(scores[active] ?? {}).length : null;

  return (
    <>
      <header className="mx-auto max-w-[1680px] px-8 pb-4 pt-6">
        <div className="flex items-end gap-x-10">
          <h1 className="wordmark text-[4.6rem]">{APP_NAME}</h1>
          <div className="pb-1.5">
            <p className="text-xl font-medium leading-snug text-ink">{APP_TAGLINE}</p>
            <p className="lede mt-1 text-[0.95rem]">
              Cada molécula emite un patrón fijo de líneas. Si todas aparecen a la misma velocidad, la huella coincide.
              Mueve v<sub>LSR</sub> y mira cómo el código de barras de cada especie se desliza sobre el espectro.
            </p>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-30 border-y border-rule bg-night/90 backdrop-blur" aria-label="Secciones">
        <div className="mx-auto flex max-w-[1680px] items-center gap-1 px-8 py-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-md px-3 py-1 text-sm text-ink-2 hover:bg-plate-2 hover:text-ink">
              {s.label}
            </a>
          ))}
          <div className="ml-auto flex items-center gap-4 text-[0.8rem] text-ink-2">
            <span>
              Posición activa{" "}
              <span className="font-semibold text-ink">{POSITION_LABELS[active]}</span>
            </span>
            <span className="h-4 w-px bg-rule" aria-hidden />
            <span title="peaks.json">
              {nPeaks !== null ? (
                <>
                  <span className="num text-ink">{nPeaks}</span> picos
                </>
              ) : (
                <span className="text-warning">picos en curso</span>
              )}
            </span>
            <span title="species_scores.json">
              {nScored !== null ? (
                <>
                  <span className="num text-ink">{nScored}</span> especies puntuadas
                </>
              ) : (
                <span className="text-warning">puntuaciones en curso</span>
              )}
            </span>
            <button type="button" className="btn" onClick={reload} disabled={reloading}>
              {reloading ? "Recargando…" : "Recargar análisis"}
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1680px] px-8">
        <section id="espectro" aria-labelledby="espectro-title" className="pt-6">
          <SectionHead id="espectro" title="Espectro">
            Arriba, la intensidad medida en ALMA. Abajo, un carril por especie con sus líneas del catálogo; el trazo es
            más alto cuanto más intensa es la línea.
          </SectionHead>
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
          />
        </section>

        <section id="candidatas" aria-labelledby="candidatas-title" className="pt-16">
          <SectionHead id="candidatas" title="Candidatas">
            Picos detectados por el pipeline (SNR ≥ 4) con las transiciones del catálogo que podrían explicarlos.
          </SectionHead>
          <PeaksTable peaks={peaks} peaksState={peaksState} active={active} onZoom={zoomTo} onLog={logCandidate} />
        </section>

        <section id="huellas" aria-labelledby="huellas-title" className="pt-16">
          <SectionHead id="huellas" title="Huellas moleculares">
            Una detección se sostiene cuando todas las líneas fuertes de la especie aparecen a la misma velocidad. Cada
            panel muestra una línea predicha en el eje de velocidad, de −8 a 12 km/s.
          </SectionHead>
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
            onZoomLine={(w, fGHz) => zoomTo(w, active, fGHz)}
            onLogLine={logLine}
            onShowInSpectrum={showInSpectrum}
          />
        </section>

        <section id="campo" aria-labelledby="campo-title" className="pt-16">
          <SectionHead id="campo" title="Campo">
            Emisión continua del polvo alrededor del sistema binario y los tres puntos donde se extrajeron los espectros.
          </SectionHead>
          <FieldMap
            continuum={continuum}
            meta={meta}
            active={active}
            setActive={setActive}
            sigmaOf={(w, p) => spectra[w].noise[p]?.sigma_Jy ?? NaN}
            peaks={peaks}
            pipeline={pipeline}
          />
        </section>

        <section id="evidencia" aria-labelledby="evidencia-title" className="pb-8 pt-16">
          <SectionHead id="evidencia" title="Evidencia">
            El registro que entrega el equipo: una fila por línea defendida o descartada, con su medida y su decisión.
          </SectionHead>
          <EvidenceLog rows={rows} setRows={setRows} team={team} setTeam={setTeam} flashId={flashId} />
        </section>
      </main>

      <footer className="mt-16 border-t border-rule">
        <div className="mx-auto grid max-w-[1680px] grid-cols-[1fr_auto] gap-8 px-8 py-8 text-[0.82rem] text-ink-2">
          <div className="max-w-[90ch] space-y-1.5">
            <p className="text-ink">
              This paper makes use of the following ALMA data: {meta.credit}.
            </p>
            <p>
              ALMA is a partnership of ESO (representing its member states), NSF (USA) and NINS (Japan), together with NRC (Canada), NSTC and ASIAA
              (Taiwan), and KASI (Republic of Korea), in cooperation with the Republic of Chile. The Joint ALMA Observatory is operated by ESO, AUI/NRAO and NAOJ. Cubos procesados por
              ARI-L (ALMA Re-Imaging of Legacy data). Contexto científico: PILS, Protostellar Interferometric Line Survey
              (Jørgensen et al. 2016, A&amp;A 595, A117). Espectroscopía: catálogos CDMS (Colonia) y JPL.
            </p>
            <p className="text-muted">{AI_DECLARATION}</p>
          </div>
          <div className="text-right text-muted">
            <p className="wordmark text-2xl text-ink-2">{APP_NAME}</p>
            <p>AstroHack SATEM 2026</p>
          </div>
        </div>
      </footer>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-rule-strong bg-plate-2 px-4 py-2.5 text-sm shadow-[0_12px_30px_rgb(0_0_0/0.45)]"
        >
          <span style={{ color: "var(--color-good)" }}>✓</span>
          {toast}
          <a href="#evidencia" className="text-focus underline-offset-2 hover:underline">
            Ver registro
          </a>
        </div>
      ) : null}
    </>
  );
}

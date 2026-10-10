"use client";

import { useMemo, useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Plus } from "lucide-react";
import type { Peak, PeakCandidate, Peaks, PosKey, WinKey } from "@/lib/data";
import { POSITION_KEYS, WINDOW_KEYS } from "@/lib/data";
import { POSITION_LABELS } from "@/lib/config";
import { speciesInfo } from "@/lib/species";
import { f } from "@/lib/format";
import { Pending } from "./ui";
import { Tex, SYM } from "./Tex";

const FLAG_ES: Record<string, string> = {
  blend: "mezcla",
  absorption: "absorción",
  edge: "borde",
  weak: "débil",
  asymmetric: "asimétrica",
};

type Row = { win: WinKey; pos: PosKey; peak: Peak };
type SortKey = "id" | "freq" | "snr" | "fwhm" | "ncand";

export interface PeaksTableProps {
  peaks: Peaks | null;
  peaksState: "ok" | "missing" | "error";
  active: PosKey;
  vAdopted: number | null;
  onZoom: (win: WinKey, pos: PosKey, freqGHz: number) => void;
  onLog: (win: WinKey, pos: PosKey, peak: Peak, cand: PeakCandidate) => void;
}

export default function PeaksTable({ peaks, peaksState, active, vAdopted, onZoom, onLog }: PeaksTableProps) {
  const [posFilter, setPosFilter] = useState<"activa" | "todas">("activa");
  const [winFilter, setWinFilter] = useState<"todas" | WinKey>("todas");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "snr", dir: -1 });
  const [tbody] = useAutoAnimate<HTMLTableSectionElement>({ duration: 150, easing: "cubic-bezier(0,0,0,1)" });

  const rows = useMemo<Row[]>(() => {
    if (!peaks) return [];
    const out: Row[] = [];
    for (const w of WINDOW_KEYS)
      for (const pos of POSITION_KEYS)
        for (const pk of peaks[w]?.[pos] ?? []) out.push({ win: w, pos, peak: pk });
    return out;
  }, [peaks]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const val = (r: Row): number | string => {
      switch (sort.key) {
        case "id":
          return r.peak.id;
        case "freq":
          return r.peak.freq_GHz;
        case "snr":
          return r.peak.snr;
        case "fwhm":
          return r.peak.fit?.fwhm_kms ?? -Infinity;
        case "ncand":
          return r.peak.candidates?.length ?? 0;
      }
    };
    return rows
      .filter((r) => (posFilter === "activa" ? r.pos === active : true))
      .filter((r) => (winFilter === "todas" ? true : r.win === winFilter))
      .filter((r) => {
        if (!needle) return true;
        const hay = [
          r.peak.id,
          r.peak.freq_GHz.toFixed(4),
          ...(r.peak.flags ?? []).map((x) => `${x} ${FLAG_ES[x] ?? ""}`),
          ...(r.peak.candidates ?? []).map((c) => `${c.species} ${speciesInfo(c.species).name}`),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => {
        const va = val(a);
        const vb = val(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
      });
  }, [rows, posFilter, winFilter, q, sort, active]);

  if (!peaks) return <Pending what={peaksState === "error" ? "peaks.json (con errores de lectura)" : "peaks.json"} />;

  const th = (key: SortKey, label: React.ReactNode, right = false) => {
    const on = sort.key === key;
    const Icon = on ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th className={right ? "r" : ""} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 hover:text-ink ${on ? "text-ink" : ""}`}
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "id" || key === "freq" ? 1 : -1 }))}
        >
          {label}
          <Icon className="icon opacity-70" aria-hidden />
        </button>
      </th>
    );
  };

  // la mejor candidata es la más cercana a la velocidad adoptada
  const rank = (cands: PeakCandidate[]) =>
    vAdopted === null ? cands : [...cands].sort((a, b) => Math.abs(a.v_kms - vAdopted) - Math.abs(b.v_kms - vAdopted));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="field-icon">
          <Search className="icon" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Especie, pico, bandera o frecuencia"
            className="field w-72 py-1 text-[0.8rem]"
            aria-label="Buscar en la tabla de picos"
          />
        </label>
        <div className="seg" role="group" aria-label="Filtrar por posición">
          <button type="button" aria-pressed={posFilter === "activa"} onClick={() => setPosFilter("activa")}>
            {POSITION_LABELS[active]}
          </button>
          <button type="button" aria-pressed={posFilter === "todas"} onClick={() => setPosFilter("todas")}>
            Todas las posiciones
          </button>
        </div>
        <div className="seg" role="group" aria-label="Filtrar por ventana">
          {(["todas", ...WINDOW_KEYS] as const).map((w) => (
            <button key={w} type="button" aria-pressed={winFilter === w} onClick={() => setWinFilter(w)}>
              {w === "todas" ? "W1 y W2" : w}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[0.78rem] text-muted">
          <span className="text-ink">{filtered.length}</span> de {rows.length} picos
        </span>
      </div>
      <div className="plate max-h-[34rem] overflow-auto">
        <table className="dtable">
          <thead>
            <tr>
              {th("id", "Pico")}
              <th>Ventana</th>
              <th>Posición</th>
              {th("freq", <Tex>{SYM.nuObs + String.raw`\ (\mathrm{GHz})`}</Tex>, true)}
              {th("snr", <Tex>{SYM.snr}</Tex>, true)}
              {th("fwhm", <Tex>{SYM.fwhm + String.raw`\ (\mathrm{km\,s^{-1}})`}</Tex>, true)}
              <th>Banderas</th>
              {th(
                "ncand",
                <>
                  Candidatas <span className="font-normal">(</span>
                  <Tex>{String.raw`v,\ \Delta\nu`}</Tex>
                  <span className="font-normal">)</span>
                </>,
              )}
            </tr>
          </thead>
          <tbody ref={tbody}>
            {filtered.map((r) => {
              const fGHz = r.peak.fit?.ok && r.peak.fit.center_GHz ? r.peak.fit.center_GHz : r.peak.freq_GHz;
              const cands = rank(r.peak.candidates ?? []);
              return (
                <tr
                  key={`${r.pos}-${r.peak.id}`}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => onZoom(r.win, r.pos, fGHz)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onZoom(r.win, r.pos, fGHz);
                  }}
                >
                  <td className="id whitespace-nowrap text-ink">{r.peak.id}</td>
                  <td>{r.win}</td>
                  <td>{POSITION_LABELS[r.pos]}</td>
                  <td className="r">{f(fGHz, 5)}</td>
                  <td className="r text-ink">{f(r.peak.snr, 1)}</td>
                  <td className="r">{f(r.peak.fit?.fwhm_kms, 2)}</td>
                  <td className="text-ink-2">
                    {(r.peak.flags ?? []).map((x) => FLAG_ES[x] ?? x).join(", ") || <span className="text-muted">—</span>}
                  </td>
                  <td className="max-w-[30rem]">
                    <div className="flex flex-wrap gap-1">
                      {cands.slice(0, 3).map((c, i) => {
                        const info = speciesInfo(c.species);
                        return (
                          <button
                            key={c.catalog_id}
                            type="button"
                            className="chip"
                            aria-pressed={i === 0}
                            title={`Añadir a Evidencia: ${info.name}, ${c.rest_MHz.toFixed(3)} MHz, Eu ${c.Eu_K} K, log I ${c.logI_300K}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onLog(r.win, r.pos, r.peak, c);
                            }}
                          >
                            <span className="dot" style={{ background: info.color }} />
                            {info.formula}
                            <span className={`text-[0.7rem] ${i === 0 ? "text-ink-2" : "text-muted"}`}>
                              {f(c.v_kms, 2)}, {c.delta_MHz >= 0 ? "+" : "−"}
                              {Math.abs(c.delta_MHz).toFixed(2)}
                            </span>
                            <Plus className="icon opacity-50" aria-hidden />
                          </button>
                        );
                      })}
                      {cands.length > 3 ? (
                        <span
                          className="self-center text-[0.72rem] text-muted"
                          title={cands
                            .slice(3)
                            .map((c) => `${speciesInfo(c.species).formula} ${f(c.v_kms, 2)} km/s`)
                            .join("\n")}
                        >
                          +{cands.length - 3}
                        </span>
                      ) : null}
                      {cands.length === 0 ? <span className="text-muted">sin candidata en el catálogo</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? <p className="px-4 py-6 text-sm text-muted">Ningún pico cumple el filtro.</p> : null}
      </div>
    </div>
  );
}

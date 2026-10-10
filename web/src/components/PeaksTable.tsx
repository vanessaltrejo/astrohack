"use client";

import { useMemo, useState } from "react";
import type { Peak, PeakCandidate, Peaks, PosKey, WinKey } from "@/lib/data";
import { POSITION_KEYS, WINDOW_KEYS } from "@/lib/data";
import { POSITION_LABELS } from "@/lib/config";
import { speciesInfo } from "@/lib/species";
import { f } from "@/lib/format";
import { Pending } from "./ui";

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
  onZoom: (win: WinKey, pos: PosKey, freqGHz: number) => void;
  onLog: (win: WinKey, pos: PosKey, peak: Peak, cand: PeakCandidate) => void;
}

export default function PeaksTable({ peaks, peaksState, active, onZoom, onLog }: PeaksTableProps) {
  const [posFilter, setPosFilter] = useState<"activa" | "todas">("activa");
  const [winFilter, setWinFilter] = useState<"todas" | WinKey>("todas");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "snr", dir: -1 });

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

  const th = (key: SortKey, label: string, right = false) => (
    <th className={right ? "r" : ""} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-ink"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "id" || key === "freq" ? 1 : -1 }))}
      >
        {label}
        <span aria-hidden className="text-[0.7em]">
          {sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "△"}
        </span>
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar especie, id, bandera o frecuencia"
          className="field w-80 py-1 text-sm"
          aria-label="Buscar en la tabla de picos"
        />
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
        <span className="ml-auto text-sm text-muted">
          <span className="num text-ink">{filtered.length}</span> de {rows.length} picos. Clic en una fila para ampliarla
          en el espectro (±5 MHz).
        </span>
      </div>
      <div className="plate max-h-[30rem] overflow-auto">
        <table className="dtable">
          <thead>
            <tr>
              {th("id", "Pico")}
              <th>Ventana</th>
              <th>Posición</th>
              {th("freq", "ν LSRK (GHz)", true)}
              {th("snr", "SNR", true)}
              {th("fwhm", "FWHM (km/s)", true)}
              <th>Banderas</th>
              {th("ncand", "Candidatas (v, Δν)")}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const fGHz = r.peak.fit?.ok && r.peak.fit.center_GHz ? r.peak.fit.center_GHz : r.peak.freq_GHz;
              const cands = r.peak.candidates ?? [];
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
                  <td className="num whitespace-nowrap text-ink">{r.peak.id}</td>
                  <td>{r.win}</td>
                  <td>{POSITION_LABELS[r.pos]}</td>
                  <td className="r num">{f(fGHz, 5)}</td>
                  <td className="r num text-ink">{f(r.peak.snr, 1)}</td>
                  <td className="r num">{f(r.peak.fit?.fwhm_kms, 2)}</td>
                  <td className="text-ink-2">
                    {(r.peak.flags ?? []).map((x) => FLAG_ES[x] ?? x).join(", ") || <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {cands.slice(0, 4).map((c) => {
                        const info = speciesInfo(c.species);
                        return (
                          <button
                            key={c.catalog_id}
                            type="button"
                            className="chip"
                            aria-pressed="true"
                            title={`Añadir a Evidencia: ${info.name}, ${c.rest_MHz.toFixed(3)} MHz, Eu ${c.Eu_K} K, log I ${c.logI_300K}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onLog(r.win, r.pos, r.peak, c);
                            }}
                          >
                            <span className="dot" style={{ background: info.color }} />
                            {info.formula}
                            <span className="num text-[0.72rem] text-ink-2">
                              {f(c.v_kms, 2)} · {c.delta_MHz >= 0 ? "+" : "−"}
                              {Math.abs(c.delta_MHz).toFixed(2)}
                            </span>
                          </button>
                        );
                      })}
                      {cands.length > 4 ? <span className="text-xs text-muted">+{cands.length - 4} más</span> : null}
                      {cands.length === 0 ? <span className="text-muted">sin candidata en catálogo</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Ningún pico cumple el filtro. Borra la búsqueda o cambia la posición.</p>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted">
        Cada candidata muestra la velocidad que implicaría (km/s) y Δν (MHz): frecuencia predicha a la v adoptada por el
        pipeline menos la del pico. Pulsa una candidata para añadirla al registro de evidencia.
      </p>
    </div>
  );
}

"use client";

import { COLUMN_LABELS, EVIDENCE_COLUMNS, emptyRow, toCsv, type EvidenceColumn, type EvidenceRow } from "@/lib/evidence";

export interface EvidenceLogProps {
  rows: EvidenceRow[];
  setRows: (fn: (rows: EvidenceRow[]) => EvidenceRow[]) => void;
  team: string;
  setTeam: (t: string) => void;
  flashId: string | null;
}

const NUMERIC = new Set<EvidenceColumn>([
  "frecuencia_reposo_MHz",
  "frecuencia_pico_LSRK_MHz",
  "v_radio_kms",
  "FWHM_kms",
  "baseline_Jy_beam",
  "sigma_Jy_beam",
  "SNR",
  "area_Jy_beam_kms",
  "entrada",
]);

const WIDE: Partial<Record<EvidenceColumn, string>> = {
  hipotesis: "14rem",
  metodo_incertidumbre: "18rem",
  alternativas: "18rem",
  mezcla: "10rem",
  decision: "10rem",
  archivo_figura: "10rem",
};

export default function EvidenceLog({ rows, setRows, team, setTeam, flashId }: EvidenceLogProps) {
  function update(id: string, col: EvidenceColumn, value: string) {
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, [col]: value } : r)));
  }

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evidencia${team ? `_${team.replace(/\W+/g, "_")}` : ""}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Equipo
          <input
            className="field w-48 py-1 text-sm"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="nombre del equipo"
          />
        </label>
        <button type="button" className="btn" onClick={() => setRows((rs) => [...rs, emptyRow(team)])}>
          Añadir fila vacía
        </button>
        <button type="button" className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          Exportar CSV
        </button>
        <span className="ml-auto text-sm text-muted">
          <span className="num text-ink">{rows.length}</span> filas. Se guardan en este navegador; exporta el CSV para
          entregarlo.
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule-strong px-6 py-8 text-sm text-ink-2">
          <p className="font-semibold text-ink">El registro está vacío</p>
          <p className="mt-1 max-w-[62ch]">
            Pulsa “Registrar” en una huella molecular o una candidata en la tabla de picos: la fila se rellena con la
            especie, la entrada del catálogo, el ajuste del pico y el ruido. Después completa hipótesis y decisión.
          </p>
        </div>
      ) : (
        <div className="plate max-h-[32rem] overflow-auto">
          <table className="dtable">
            <thead>
              <tr>
                <th />
                {EVIDENCE_COLUMNS.map((c) => (
                  <th key={c} title={c}>
                    {COLUMN_LABELS[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} style={r._id === flashId ? { background: "var(--color-plate-2)" } : undefined}>
                  <td>
                    <button
                      type="button"
                      className="btn btn-quiet px-1.5 py-0"
                      aria-label="Borrar fila"
                      title="Borrar fila"
                      onClick={() => setRows((rs) => rs.filter((x) => x._id !== r._id))}
                    >
                      ✕
                    </button>
                  </td>
                  {EVIDENCE_COLUMNS.map((c) => (
                    <td key={c} className="p-1">
                      <input
                        className={`field w-full ${NUMERIC.has(c) ? "num text-[0.74rem]" : ""}`}
                        style={{ minWidth: WIDE[c] ?? "7rem" }}
                        value={r[c]}
                        aria-label={`${COLUMN_LABELS[c]}`}
                        onChange={(e) => update(r._id, c, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        Las columnas son las de <span className="num">data/evidencia_plantilla.csv</span>, en el mismo orden.
      </p>
    </div>
  );
}

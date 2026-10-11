import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FUERA, PESOS_BASE, recalcular, type Cand, type V3 } from "./modelo";

const v3 = JSON.parse(readFileSync(join(__dirname, "../../public/data/probabilidad.json"), "utf8")) as V3;

function porPico(cs: Cand[]) {
  const m = new Map<string, Cand[]>();
  for (const c of cs) m.set(c.pico, [...(m.get(c.pico) ?? []), c]);
  return m;
}

describe("recalcular (modelo en el navegador)", () => {
  it("con pesos normales reproduce el % y el orden de analysis/v3/probabilidad.py", () => {
    for (const pos of ["B_offset", "B_pico", "A"] as const) {
      for (const cs of porPico(v3.posiciones[pos].candidatas).values()) {
        const r = recalcular(cs, PESOS_BASE);
        for (const c of r) {
          const orig = cs.find((x) => x.especie === c.especie)!;
          expect(c.P).toBeCloseTo(orig.P, 9);
        }
        expect(r[0].especie).toBe(cs.find((x) => x.rango === 1)!.especie);
      }
    }
  });

  it("cada línea incluye la opción «fuera del catálogo»", () => {
    for (const cs of porPico(v3.posiciones.B_offset.candidatas).values()) expect(cs.some((c) => c.especie === FUERA)).toBe(true);
  });

  it("apagar la frecuencia hace que ese factor no influya", () => {
    const cs = [...porPico(v3.posiciones.B_offset.candidatas).values()][0];
    const sinFrec = recalcular(cs, { ...PESOS_BASE, frecuencia: 0 });
    const igualada = recalcular(
      cs.map((c) => ({ ...c, L_frecuencia: 0.5 })),
      { ...PESOS_BASE, frecuencia: 0 },
    );
    expect(sinFrec.map((c) => c.especie)).toEqual(igualada.map((c) => c.especie));
  });
});

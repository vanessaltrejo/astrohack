import { describe, expect, it } from "vitest";
import {
  C_KMS,
  asinhInverse,
  asinhStretch,
  dopplerVelocity,
  inAxis,
  integratedArea,
  nearestChannel,
  observedFreqGHz,
  sliceFreq,
  sliceMax,
  sliceVelocity,
  toRestFrameGHz,
  windowForFreq,
} from "./spectro";

// eje sintético con el paso real de W1 (0.24413 MHz)
const STEP_GHZ = 0.000244130041748;
const axis = Array.from({ length: 1918 }, (_, i) => 348.834448336 + i * STEP_GHZ);

describe("dopplerVelocity / observedFreqGHz (convención radio)", () => {
  it("usa c = 299792.458 km/s", () => {
    expect(C_KMS).toBe(299792.458);
  });

  it("v = 0 deja la frecuencia en reposo", () => {
    expect(observedFreqGHz(349050.12, 0)).toBeCloseTo(349.05012, 10);
    expect(dopplerVelocity(349.05012, 349050.12)).toBeCloseTo(0, 9);
  });

  it("v positiva (alejándose) reduce la frecuencia observada", () => {
    const f = observedFreqGHz(349050.12, 2.7);
    expect(f).toBeLessThan(349.05012);
    // Δν = ν0 · v / c = 349050.12 MHz · 2.7 / c ≈ 3.1436 MHz
    expect((349.05012 - f) * 1000).toBeCloseTo((349050.12 * 2.7) / C_KMS, 9);
  });

  it("ida y vuelta es exacta (se aplica una sola vez)", () => {
    for (const v of [-8, 0, 2.7, 3.2, 12]) {
      const f = observedFreqGHz(348823.577, v);
      expect(dopplerVelocity(f, 348823.577)).toBeCloseTo(v, 9);
    }
  });

  it("valor de referencia del esquema: 349.04661 GHz frente a 349050.12 MHz ≈ 2.97 km/s", () => {
    expect(dopplerVelocity(349.04661, 349050.12)).toBeCloseTo(C_KMS * (1 - 349046.61 / 349050.12), 9);
    expect(dopplerVelocity(349.04661, 349050.12)).toBeCloseTo(3.0146, 3);
  });

  it("toRestFrameGHz invierte observedFreqGHz", () => {
    const f = observedFreqGHz(349100, 2.7);
    expect(toRestFrameGHz(f, 2.7)).toBeCloseTo(349.1, 10);
  });
});

describe("nearestChannel", () => {
  it("encuentra el canal exacto", () => {
    expect(nearestChannel(axis, axis[0])).toBe(0);
    expect(nearestChannel(axis, axis[1000])).toBe(1000);
    expect(nearestChannel(axis, axis[1917])).toBe(1917);
  });
  it("redondea al vecino más cercano", () => {
    expect(nearestChannel(axis, axis[10] + 0.4 * STEP_GHZ)).toBe(10);
    expect(nearestChannel(axis, axis[10] + 0.6 * STEP_GHZ)).toBe(11);
  });
  it("satura en los extremos", () => {
    expect(nearestChannel(axis, 300)).toBe(0);
    expect(nearestChannel(axis, 400)).toBe(1917);
  });
  it("funciona con ejes descendentes", () => {
    const desc = [...axis].reverse();
    expect(nearestChannel(desc, axis[10])).toBe(1907);
  });
  it("eje vacío → -1", () => {
    expect(nearestChannel([], 1)).toBe(-1);
  });
});

describe("cortes", () => {
  const y = axis.map((_, i) => i);

  it("sliceFreq incluye los extremos y respeta el orden", () => {
    const s = sliceFreq(axis, y, axis[5], axis[9]);
    expect(s.idx).toEqual([5, 6, 7, 8, 9]);
    expect(s.y).toEqual([5, 6, 7, 8, 9]);
  });

  it("sliceFreq descarta nulos", () => {
    const yn: (number | null)[] = [...y];
    yn[7] = null;
    expect(sliceFreq(axis, yn, axis[5], axis[9]).idx).toEqual([5, 6, 8, 9]);
  });

  it("sliceVelocity devuelve v ascendente dentro de [vMin, vMax]", () => {
    const rest = 349000.0; // MHz, dentro de W1
    const s = sliceVelocity(axis, y, rest, -8, 12);
    expect(s.x.length).toBeGreaterThan(90); // 20 km/s / 0.2097 ≈ 95 canales
    expect(s.x.length).toBeLessThan(100);
    for (let k = 1; k < s.x.length; k++) expect(s.x[k]).toBeGreaterThan(s.x[k - 1]);
    expect(Math.min(...s.x)).toBeGreaterThanOrEqual(-8);
    expect(Math.max(...s.x)).toBeLessThanOrEqual(12);
    // v ascendente ⇔ canal (frecuencia) descendente
    expect(s.idx[0]).toBeGreaterThan(s.idx[s.idx.length - 1]);
    // cada x corresponde exactamente a su canal
    s.idx.forEach((i, k) => expect(s.x[k]).toBeCloseTo(dopplerVelocity(axis[i], rest), 9));
  });

  it("una línea inyectada a v = 2.7 aparece en v ≈ 2.7 tras el corte", () => {
    const rest = 349050.12;
    const fObs = observedFreqGHz(rest, 2.7);
    const yy = axis.map((f) => Math.exp(-0.5 * ((f - fObs) / (2 * STEP_GHZ)) ** 2));
    const s = sliceVelocity(axis, yy, rest, -8, 12);
    const m = sliceMax(s)!;
    expect(Math.abs(m.x - 2.7)).toBeLessThan(0.21); // dentro de un canal
  });

  it("línea fuera del eje → corte vacío", () => {
    expect(sliceVelocity(axis, y, 351000, -8, 12).x).toEqual([]);
  });

  it("integratedArea = ∑I · Δv", () => {
    expect(integratedArea({ idx: [0, 1, 2], x: [0, 1, 2], y: [1, 2, 3] }, 0.2)).toBeCloseTo(1.2, 12);
  });
});

describe("ventanas", () => {
  const w2 = Array.from({ length: 1918 }, (_, i) => 349.303181377 + i * STEP_GHZ);
  it("inAxis / windowForFreq nunca mezclan W1 y W2", () => {
    expect(inAxis(axis, 349.0)).toBe(true);
    expect(inAxis(axis, 349.5)).toBe(false);
    expect(windowForFreq({ W1: axis, W2: w2 }, 349.0)).toBe("W1");
    expect(windowForFreq({ W1: axis, W2: w2 }, 349.5)).toBe("W2");
    expect(windowForFreq({ W1: axis, W2: w2 }, 350.5)).toBeNull();
  });
});

describe("estiramiento asinh", () => {
  it("0 y negativos → 0; máximo → 1; inversa consistente", () => {
    expect(asinhStretch(-1, 0.01, 2.5)).toBe(0);
    expect(asinhStretch(2.5, 0.01, 2.5)).toBeCloseTo(1, 12);
    const t = asinhStretch(0.3, 0.01, 2.5);
    expect(asinhInverse(t, 0.01, 2.5)).toBeCloseTo(0.3, 10);
  });
});

import { paddedRange, strongLines } from "./spectro";

describe("utilidades", () => {
  it("paddedRange ignora nulos y añade margen", () => {
    expect(paddedRange([null, 0, 1, undefined, NaN], 0.1)).toEqual([-0.1, 1.1]);
    expect(paddedRange([null])).toBeNull();
  });
  it("strongLines aplica el umbral en dex respecto a la más intensa", () => {
    const ls = [{ logI_300K: -3 }, { logI_300K: -4.4 }, { logI_300K: -4.6 }];
    expect(strongLines(ls, 1.5).length).toBe(2);
    expect(strongLines([], 1.5)).toEqual([]);
  });
});

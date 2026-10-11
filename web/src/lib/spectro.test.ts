import { describe, expect, it } from "vitest";
import { C_KMS, dopplerVelocity, toRestFrameGHz } from "./spectro";

describe("Doppler (convención radio, una sola vez)", () => {
  it("usa c = 299792.458 km/s", () => {
    expect(C_KMS).toBe(299792.458);
  });

  it("v = 0 deja la frecuencia igual", () => {
    expect(toRestFrameGHz(349.0, 0)).toBe(349.0);
  });

  it("2.7 km/s a 349 GHz desplaza 3.14 MHz (dato de la presentación de apertura)", () => {
    expect((toRestFrameGHz(349.0, 2.7) - 349.0) * 1000).toBeCloseTo(3.14, 2);
  });

  it("dopplerVelocity invierte toRestFrameGHz", () => {
    const nuObs = 349.0;
    const nuRestMHz = toRestFrameGHz(nuObs, 2.7) * 1000;
    expect(dopplerVelocity(nuObs, nuRestMHz)).toBeCloseTo(2.7, 9);
  });
});

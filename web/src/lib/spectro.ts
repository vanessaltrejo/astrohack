/**
 * Física compartida del tablero: la conversión Doppler (convención radio, marco LSRK).
 *
 *   v = c · (1 − ν_LSRK / ν_reposo)        ν_reposo = ν_LSRK / (1 − v / c)
 *
 * La corrección se aplica UNA sola vez, con la velocidad dada por los organizadores.
 */

export const C_KMS = 299792.458;

/** Velocidad radio (km/s) de una frecuencia observada LSRK (GHz) respecto a una línea en reposo (MHz). */
export function dopplerVelocity(nuObsGHz: number, nuRestMHz: number, c = C_KMS): number {
  return c * (1 - (nuObsGHz * 1000) / nuRestMHz);
}

/** Lleva una frecuencia observada (GHz) al marco de reposo para una velocidad v (km/s). */
export function toRestFrameGHz(nuObsGHz: number, vKms: number, c = C_KMS): number {
  return nuObsGHz / (1 - vKms / c);
}

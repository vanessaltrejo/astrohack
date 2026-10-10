/**
 * Rampa secuencial “calor” para el continuo de polvo (emisión térmica):
 * de la superficie del gráfico a crema, con luminosidad monótona creciente.
 * Es la excepción “semantic heat” de la guía de dataviz: siempre con barra de escala.
 */
const STOPS: [number, [number, number, number]][] = [
  [0.0, [25, 28, 56]], // #191C38 = superficie
  [0.22, [74, 36, 78]],
  [0.45, [150, 52, 70]],
  [0.68, [222, 112, 52]],
  [0.86, [246, 190, 110]],
  [1.0, [255, 246, 222]],
];

export function heat(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0));
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    const [t0, c0] = STOPS[i - 1];
    if (x <= t1) {
      const f = (x - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + f * (c1[k] - c0[k]))) as [number, number, number];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export function heatCss(t: number): string {
  const [r, g, b] = heat(t);
  return `rgb(${r} ${g} ${b})`;
}

/** Formato numérico consistente (punto decimal, signo menos tipográfico). */
export function f(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return x.toFixed(digits).replace(/^-/, "−");
}

export function fSigned(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(digits);
}

/** AR en grados → “16h32m22.58s”. */
export function raHms(deg: number): string {
  const h = deg / 15;
  const hh = Math.floor(h);
  const m = (h - hh) * 60;
  const mm = Math.floor(m);
  const ss = (m - mm) * 60;
  return `${hh}h${String(mm).padStart(2, "0")}m${ss.toFixed(2).padStart(5, "0")}s`;
}

/** Dec en grados → “−24°28′32.8″”. */
export function decDms(deg: number): string {
  const s = deg < 0 ? "−" : "+";
  const a = Math.abs(deg);
  const dd = Math.floor(a);
  const m = (a - dd) * 60;
  const mm = Math.floor(m);
  const ss = (m - mm) * 60;
  return `${s}${dd}°${String(mm).padStart(2, "0")}′${ss.toFixed(1).padStart(4, "0")}″`;
}

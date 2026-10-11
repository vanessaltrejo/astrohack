/** Fórmulas legibles: subíndices para conteos y superíndices para masas isotópicas (13CH3OH → ¹³CH₃OH). */
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
const MASAS = new Set(["13", "15", "17", "18", "29", "30", "33", "34", "35", "36", "37", "41", "46", "50", "79", "80", "81"]);

const sub = (d: string) => [...d].map((c) => SUB[c] ?? c).join("");
const sup = (d: string) => [...d].map((c) => SUP[c] ?? c).join("");

const NOMBRES: Record<string, string> = { "Glycine-I": "Glicina (NH₂CH₂COOH)" };

export function prettyFormula(raw: string): string {
  if (NOMBRES[raw]) return NOMBRES[raw];
  // sólo la parte química (antes de " v=0", ", vt…")
  const m = raw.match(/^([^\s,]+)(.*)$/);
  if (!m) return raw;
  const [, f, rest] = m;
  let out = "";
  let i = 0;
  while (i < f.length) {
    const ch = f[i];
    if (/\d/.test(ch)) {
      let j = i;
      while (j < f.length && /\d/.test(f[j])) j++;
      const run = f.slice(i, j);
      const prev = i > 0 ? f[i - 1] : "";
      const next = f[j] ?? "";
      const afterLetter = /[A-Za-z)]/.test(prev);
      if (!afterLetter) {
        // al inicio o tras "-" / "(": masa isotópica si va antes de un elemento
        out += /[A-Z]/.test(next) && MASAS.has(run) ? sup(run) : run;
      } else if (run.length >= 3 && MASAS.has(run.slice(-2)) && /[A-Z]/.test(next)) {
        out += sub(run.slice(0, -2)) + sup(run.slice(-2));
      } else if (run.length === 2 && MASAS.has(run) && /[A-Z]/.test(next) && prev !== ")") {
        // ambiguo (p. ej. "CH313CN" ya tratado arriba); dos dígitos tras letra = conteo
        out += sub(run);
      } else {
        out += sub(run);
      }
      i = j;
    } else {
      out += ch;
      i++;
    }
  }
  return out + rest;
}

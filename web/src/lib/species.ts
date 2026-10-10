/**
 * Identidad visual de cada especie. El orden es fijo (familias químicas) y es
 * también el orden de los carriles del espectro: los colores se validaron como
 * paleta categórica de 13 pasos sobre la superficie oscura (#191C38) con el
 * validador de dataviz — vecinos ΔE CVD ≥ 16, visión normal ≥ 17, contraste ≥ 3:1.
 * El color sigue a la especie: filtrar nunca repinta a las demás.
 * Las especies se distinguen además por su carril (posición), no solo por color.
 */
export interface SpeciesInfo {
  key: string;
  formula: string;
  name: string;
  color: string;
  family: "metanol" | "orgánica con O" | "orgánica con N" | "azufre";
}

export const SPECIES: SpeciesInfo[] = [
  { key: "CH3OH", formula: "CH₃OH", name: "metanol", color: "#23ac6a", family: "metanol" },
  { key: "13CH3OH", formula: "¹³CH₃OH", name: "metanol-¹³C", color: "#9550bb", family: "metanol" },
  { key: "CH2DOH", formula: "CH₂DOH", name: "metanol deuterado", color: "#e26b1b", family: "metanol" },
  { key: "CH3OCHO", formula: "CH₃OCHO", name: "formiato de metilo", color: "#3295f6", family: "orgánica con O" },
  { key: "CH3OCH3", formula: "CH₃OCH₃", name: "dimetil éter", color: "#be3d70", family: "orgánica con O" },
  { key: "C2H5OH", formula: "C₂H₅OH", name: "etanol", color: "#a376e9", family: "orgánica con O" },
  { key: "CH3CHO", formula: "CH₃CHO", name: "acetaldehído", color: "#9a9725", family: "orgánica con O" },
  { key: "CH2(OH)CHO", formula: "CH₂(OH)CHO", name: "glicolaldehído", color: "#297cae", family: "orgánica con O" },
  { key: "NH2CHO", formula: "NH₂CHO", name: "formamida", color: "#c3441f", family: "orgánica con N" },
  { key: "CH3CN", formula: "CH₃CN", name: "acetonitrilo", color: "#da60a4", family: "orgánica con N" },
  { key: "C2H5CN", formula: "C₂H₅CN", name: "cianuro de etilo", color: "#51850e", family: "orgánica con N" },
  { key: "Glycine-I", formula: "NH₂CH₂COOH", name: "glicina (conf. I)", color: "#12a5b1", family: "orgánica con N" },
  { key: "SO2", formula: "SO₂", name: "dióxido de azufre", color: "#5c65d6", family: "azufre" },
];

const BY_KEY = new Map(SPECIES.map((s) => [s.key, s]));
const UNKNOWN_COLOR = "#7E86A6";

export function speciesInfo(key: string): SpeciesInfo {
  return BY_KEY.get(key) ?? { key, formula: key, name: key, color: UNKNOWN_COLOR, family: "orgánica con O" };
}

/** Especies presentes en el catálogo, en el orden fijo (las desconocidas al final). */
export function orderedSpecies(keys: Iterable<string>): string[] {
  const set = new Set(keys);
  const known = SPECIES.map((s) => s.key).filter((k) => set.has(k));
  const unknown = [...set].filter((k) => !BY_KEY.has(k)).sort();
  return [...known, ...unknown];
}

/** Posiciones: ink para la principal del paquete, azul y rosa para las demás (validado: ΔE CVD ≥ 12, normal ≥ 23). */
export const POSITION_COLORS: Record<string, string> = {
  B_offset: "#ECE6D6",
  B_pico: "#4E97EC",
  A: "#DA6295",
};

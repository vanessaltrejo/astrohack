/**
 * Identidad visual de cada especie. El orden es fijo (familias químicas) y es
 * también el orden de los carriles del espectro: los colores se validaron como
 * paleta categórica de 13 pasos sobre la superficie oscura (#191C38; v2: saturación ×0.78 y +7 % de luz para el navy #111A2B) con el
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
  { key: "CH3OH", formula: "CH₃OH", name: "metanol", color: "#3bb87c", family: "metanol" },
  { key: "13CH3OH", formula: "¹³CH₃OH", name: "metanol-¹³C", color: "#a274bb", family: "metanol" },
  { key: "CH2DOH", formula: "CH₂DOH", name: "metanol deuterado", color: "#d4834c", family: "metanol" },
  { key: "CH3OCHO", formula: "CH₃OCHO", name: "formiato de metilo", color: "#66a6e6", family: "orgánica con O" },
  { key: "CH3OCH3", formula: "CH₃OCH₃", name: "dimetil éter", color: "#bc6386", family: "orgánica con O" },
  { key: "C2H5OH", formula: "C₂H₅OH", name: "etanol", color: "#af8fe0", family: "orgánica con O" },
  { key: "CH3CHO", formula: "CH₃CHO", name: "acetaldehído", color: "#a8a53b", family: "orgánica con O" },
  { key: "CH2(OH)CHO", formula: "CH₂(OH)CHO", name: "glicolaldehído", color: "#418cba", family: "orgánica con O" },
  { key: "NH2CHO", formula: "NH₂CHO", name: "formamida", color: "#c95c3d", family: "orgánica con N" },
  { key: "CH3CN", formula: "CH₃CN", name: "acetonitrilo", color: "#d688b3", family: "orgánica con N" },
  { key: "C2H5CN", formula: "C₂H₅CN", name: "cianuro de etilo", color: "#639522", family: "orgánica con N" },
  { key: "Glycine-I", formula: "NH₂CH₂COOH", name: "glicina (conf. I)", color: "#2ab2bd", family: "orgánica con N" },
  { key: "SO2", formula: "SO₂", name: "dióxido de azufre", color: "#8489d2", family: "azufre" },
];

const BY_KEY = new Map(SPECIES.map((s) => [s.key, s]));
const UNKNOWN_COLOR = "#7c879b";

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

/** Posiciones: tinta para la principal del paquete, azul frío y ámbar (los tres colores de la interfaz). */
export const POSITION_COLORS: Record<string, string> = {
  B_offset: "#F2F6FA",
  B_pico: "#5AC8FA",
  A: "#FFB800",
};

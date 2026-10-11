"use client";

const FIGS = [
  {
    src: "/figs/fig1_espectro_B_offset.png",
    titulo: "Espectro B_offset, observado y en reposo",
    origen: "Cuaderno oficial Inicio_AstroHack.ipynb (gráfica W1/W2 · B_offset)",
  },
  {
    src: "/figs/fig2_tres_posiciones.png",
    titulo: "A, B_pico y B_offset en W1 y W2",
    origen: "Guía de datos calibrados, Figura 3 (misma escala, sin normalizar ni suavizar)",
  },
  {
    src: "/figs/fig3_fragmento_catalogo.png",
    titulo: "Fragmento de W1 · B_offset con el catálogo",
    origen: "Presentación de apertura, diapositiva 20 + función candidatos()",
  },
  { src: "/figs/fig4_ruido.png", titulo: "Ruido en intervalos sin líneas", origen: "Cuaderno oficial, ruido_empirico()" },
  {
    src: "/figs/fig5_ajuste_gaussiano.png",
    titulo: "Ajuste gaussiano + residuos (CH₃CN 19₀–18₀)",
    origen: "Cuaderno oficial, ajustar()",
  },
  {
    src: "/figs/fig6_continuo_posiciones.png",
    titulo: "Continuo y las tres posiciones",
    origen: "Cuaderno oficial, extracción del cubo verificada",
  },
];

/** Gráficas básicas de las instrucciones, reproducidas en Python (notebooks/01_graficas_referencia.ipynb). */
export default function ReferencePlots() {
  return (
    <div>
      <p className="caption mb-4 border-l-2 border-accent pl-3">
        Reproducidas con <span className="id">notebooks/01_graficas_referencia.ipynb</span>. Única transformación de los datos:{" "}
        <b>observado → reposo</b>, <span className="id">ν_reposo = ν_LSRK / (1 − v/c)</span>, con v dada por los organizadores (B 2.7 km/s,
        A 3.2 km/s). Comprobado: archivos idénticos al paquete (SHA256), 2.7 km/s = 3.14 MHz a 349 GHz, extracción del cubo exacta.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {FIGS.map((f) => (
          <figure key={f.src} className="border border-rule bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt={f.titulo} className="w-full" loading="lazy" />
            <figcaption className="mt-2 px-1 text-[0.8rem] text-ink">
              <b>{f.titulo}.</b> <span className="text-ink-2">{f.origen}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

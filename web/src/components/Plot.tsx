"use client";
/**
 * Plotly (paquete “basic”: scatter/bar) cargado solo en el cliente.
 * Se importa con next/dynamic desde SpectrumView para no inflar el bundle inicial.
 */
import Plotly from "plotly.js-basic-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";

const Plot = createPlotlyComponent(Plotly);
export default Plot;

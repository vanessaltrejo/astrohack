declare module "plotly.js-basic-dist-min" {
  import * as Plotly from "plotly.js";
  export = Plotly;
}
declare module "react-plotly.js/factory" {
  import type { ComponentType } from "react";
  import type { PlotParams } from "react-plotly.js";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export default function createPlotlyComponent(plotly: any): ComponentType<PlotParams>;
}

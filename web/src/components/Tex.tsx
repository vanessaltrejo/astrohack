"use client";

import { useMemo } from "react";
import katex from "katex";

/**
 * Inline (or display) LaTeX via KaTeX. Used for every physical symbol in the UI
 * (v_LSR, σ, ν, E_u, log I_300K, Δν…) so labels read like a paper, not like code.
 * Rendering is synchronous and cached per expression.
 */
const cache = new Map<string, string>();

export function Tex({ children, display = false, className }: { children: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    const key = (display ? "D:" : "I:") + children;
    let h = cache.get(key);
    if (!h) {
      h = katex.renderToString(children, { displayMode: display, throwOnError: false, output: "html", strict: "ignore" });
      cache.set(key, h);
    }
    return h;
  }, [children, display]);
  const Tag = display ? "div" : "span";
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Common symbols, so call sites stay short and consistent. */
export const SYM = {
  vlsr: String.raw`v_{\mathrm{LSR}}`,
  sigma: String.raw`\sigma`,
  nu: String.raw`\nu`,
  nuRest: String.raw`\nu_{\mathrm{rest}}`,
  nuObs: String.raw`\nu_{\mathrm{LSRK}}`,
  Eu: String.raw`E_{\mathrm{u}}`,
  logI: String.raw`\log I_{300\,\mathrm{K}}`,
  dnu: String.raw`\Delta\nu`,
  fwhm: String.raw`\Delta v_{\mathrm{FWHM}}`,
  snr: String.raw`S/N`,
  theta: String.raw`\theta`,
  jyb: String.raw`\mathrm{Jy\,beam^{-1}}`,
  kms: String.raw`\mathrm{km\,s^{-1}}`,
} as const;

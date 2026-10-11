"use client";

import { AudioWaveform, Boxes, Flame, Repeat, Telescope, Zap, type LucideIcon } from "lucide-react";
import type { FactorKey } from "@/lib/modelo";

/**
 * Ícono y color de cada factor. Se usan igual en los controles de peso, la matriz de comparación y el «¿Por qué?»,
 * para que cada factor se reconozca de un vistazo. Los colores evitan verde/ámbar/rojo, reservados para «a favor / en contra».
 */
export const FACTOR_UI: Record<FactorKey, { Icon: LucideIcon; color: string }> = {
  frecuencia: { Icon: AudioWaveform, color: "#1d4ed8" },
  einstein: { Icon: Zap, color: "#7c3aed" },
  repite: { Icon: Repeat, color: "#0f766e" },
  complejidad: { Icon: Boxes, color: "#4338ca" },
  espacio: { Icon: Telescope, color: "#0369a1" },
  entorno: { Icon: Flame, color: "#be185d" },
};

/** Ficha cuadrada con el ícono del factor en su color. */
export default function FactorIcon({ k, size = "md" }: { k: FactorKey; size?: "sm" | "md" }) {
  const { Icon, color } = FACTOR_UI[k];
  const box = size === "sm" ? "h-5 w-5" : "h-7 w-7";
  const ico = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span className={`inline-flex ${box} flex-none items-center justify-center rounded-md`} style={{ background: `${color}1a`, color }} aria-hidden>
      <Icon className={ico} strokeWidth={2.2} />
    </span>
  );
}

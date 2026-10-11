"use client";

import type { ComponentType, SVGProps } from "react";

export type SideItem = {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  onClick: () => void;
  active?: boolean;
  badge?: number;
};

/** Sidebar delgado a la izquierda, azul marino, con texto blanco. */
export default function Sidebar({ items }: { items: SideItem[] }) {
  return (
    <nav aria-label="Secciones" className="fixed left-0 top-0 z-40 flex h-screen w-[92px] flex-col bg-side py-4 text-side-ink">
      <div className="mb-5 flex flex-col items-center gap-1.5 px-2" aria-label="Sparks">
        <SparksMark />
        <span className="text-[0.95rem] font-semibold tracking-[0.04em]">Sparks</span>
      </div>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={it.onClick}
          aria-current={it.active ? "page" : undefined}
          className={`relative mx-2 mb-1 flex flex-col items-center gap-1 rounded-md px-1 py-2.5 text-[0.7rem] font-medium leading-tight transition-colors ${
            it.active ? "bg-side-2 text-side-ink" : "text-side-muted hover:bg-side-2 hover:text-side-ink"
          }`}
        >
          <it.Icon className="h-5 w-5" aria-hidden />
          <span className="text-center">{it.label}</span>
          {it.badge ? (
            <span className="absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-white px-1 text-[0.62rem] font-bold text-side">{it.badge}</span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

/** Logo: destello de cuatro puntas con dos chispas menores (línea espectral → idea). */
function SparksMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="sparks-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ff9f1c" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#1b2f6b" />
      <path d="M18 7 C19 15 21 17 29 18 C21 19 19 21 18 29 C17 21 15 19 7 18 C15 17 17 15 18 7 Z" fill="url(#sparks-g)" />
      <path d="M30 24 C30.4 27 31 27.6 34 28 C31 28.4 30.4 29 30 32 C29.6 29 29 28.4 26 28 C29 27.6 29.6 27 30 24 Z" fill="#ffffff" />
      <circle cx="28.5" cy="10" r="1.6" fill="#ffffff" />
    </svg>
  );
}

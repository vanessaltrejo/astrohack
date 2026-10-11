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
      <div className="mb-4 px-2 text-center text-[0.8rem] font-semibold leading-tight tracking-wide">
        Sparks
        <span className="mt-0.5 block text-[0.62rem] font-normal text-side-muted">AstroHack 2026</span>
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

"use client";

import type { ComponentType, SVGProps } from "react";

export type RailItem = {
  id: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
  onClick: () => void;
  active?: boolean;
  badge?: number;
  title?: string;
  divider?: boolean;
  spin?: boolean;
};

/** Sidebar delgado a la izquierda: sustituye a la navegación y los botones de la cabecera. */
export default function LeftRail({ items }: { items: RailItem[] }) {
  return (
    <nav
      aria-label="Secciones y herramientas"
      className="fixed left-0 top-0 z-40 flex h-screen w-[76px] flex-col items-stretch gap-0.5 border-r border-rule bg-night/95 py-3"
    >
      {items.map((it) => (
        <div key={it.id}>
          {it.divider ? <span className="mx-3 my-2 block h-px bg-rule" aria-hidden /> : null}
          <button
            type="button"
            onClick={it.onClick}
            title={it.title ?? it.label}
            aria-current={it.active ? "location" : undefined}
            className={`group relative flex w-full flex-col items-center gap-1 px-1 py-2 text-[0.66rem] leading-tight transition-colors duration-150 ${
              it.active ? "text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            <span
              className={`absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 ${it.active ? "bg-accent" : "bg-transparent"}`}
              aria-hidden
            />
            <it.Icon className={`h-[18px] w-[18px] ${it.spin ? "animate-spin" : ""}`} aria-hidden />
            <span className="text-center">{it.label}</span>
            {it.badge ? (
              <span className="absolute right-2 top-1 rounded-[2px] bg-accent px-1 text-[0.6rem] font-semibold text-night">{it.badge}</span>
            ) : null}
          </button>
        </div>
      ))}
    </nav>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Diálogo nativo (<dialog>) en forma de panel lateral (sheet) o modal. */
export function Dialog({
  open,
  onClose,
  kind,
  title,
  subtitle,
  children,
  actions,
  narrow = false,
}: {
  open: boolean;
  onClose: () => void;
  kind: "sheet" | "modal";
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  narrow?: boolean;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // el foco va al contenido, no al botón de cerrar (evita el anillo de foco al abrir)
      body.current?.focus({ preventScroll: true });
    } else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${kind} ${narrow ? "narrow" : ""}`}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full max-h-[100dvh] flex-col">
        <header className="flex items-center gap-4 border-b border-rule px-5 py-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
            <h2 className="title text-[1.35rem]">{title}</h2>
            {subtitle ? <p className="subtitle text-[0.95rem]">{subtitle}</p> : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <button type="button" className="btn btn-quiet px-2" onClick={onClose} aria-label="Cerrar">
              <X className="icon" />
            </button>
          </div>
        </header>
        <div ref={body} tabIndex={-1} className={`min-h-0 flex-1 overflow-auto px-5 py-4 outline-none ${kind === "modal" ? "max-h-[80dvh]" : ""}`}>
          {children}
        </div>
      </div>
    </dialog>
  );
}

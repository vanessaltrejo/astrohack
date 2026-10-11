"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CheckCircle2, CircleDashed, Circle, XCircle, X, Check, AlertTriangle, ArrowDown, Minus, type LucideIcon } from "lucide-react";
import type { LineStatus, Verdict } from "@/lib/data";
import { Tex, SYM } from "./Tex";

/** Estado vacío mientras pipeline.py no publica sus productos. */
export function Pending({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <div className="pending-stripes rounded border border-dashed border-rule-strong px-6 py-8 text-ink-2">
      <p className="font-semibold text-ink">Análisis en curso</p>
      <p className="mt-1 max-w-[62ch] text-sm">
        {what} todavía no está en <span className="id">/data</span>. Cuando pipeline.py lo publique, pulsa “Recargar”
        arriba; no hace falta reconstruir el sitio.
      </p>
      {children}
    </div>
  );
}

export const VERDICT: Record<Verdict, { label: string; Icon: LucideIcon; color: string; sentence: string }> = {
  fuerte: { label: "fuerte", Icon: CheckCircle2, color: "var(--color-good)", sentence: "detección firme" },
  tentativa: { label: "tentativa", Icon: CircleDashed, color: "var(--color-warning)", sentence: "detección tentativa" },
  insuficiente: { label: "insuficiente", Icon: Circle, color: "var(--color-muted)", sentence: "evidencia insuficiente" },
  descartada: { label: "descartada", Icon: XCircle, color: "var(--color-critical)", sentence: "descartada" },
};

export function VerdictBadge({ verdict, quiet = false }: { verdict: Verdict; quiet?: boolean }) {
  const v = VERDICT[verdict] ?? VERDICT.insuficiente;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] text-[0.76rem] font-medium ${
        quiet ? "text-ink-2" : "border px-1.5 py-[1px] text-ink"
      }`}
      style={quiet ? undefined : { borderColor: v.color, background: `color-mix(in srgb, ${v.color} 12%, transparent)` }}
    >
      <v.Icon className="icon" style={{ color: v.color }} aria-hidden />
      {v.label}
    </span>
  );
}

export const STATUS: Record<LineStatus, { label: string; Icon: LucideIcon; color: string; hint: string }> = {
  matched: { label: "coincide", Icon: Check, color: "var(--color-good)", hint: "hay un pico detectado a la velocidad común" },
  ambiguous: { label: "ambigua", Icon: Minus, color: "var(--color-warning)", hint: "hay señal, pero otra especie la explica igual de bien" },
  overbright: { label: "sobrebrillante", Icon: AlertTriangle, color: "var(--color-serious)", hint: "mucho más intensa de lo que predice el modelo: la domina otro portador" },
  missing: { label: "ausente", Icon: X, color: "var(--color-critical)", hint: "línea fuerte esperada sin emisión: evidencia en contra" },
  below_limit: { label: "bajo el límite", Icon: ArrowDown, color: "var(--color-muted)", hint: "la intensidad esperada queda bajo el ruido: no informa" },
  unmatched: { label: "sin pico", Icon: Circle, color: "var(--color-muted)", hint: "no hay un pico asociado" },
};

export function StatusTag({ status }: { status: LineStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1 text-[0.72rem] text-ink-2" title={s.hint}>
      <s.Icon className="icon" style={{ color: s.color }} aria-hidden />
      {s.label}
    </span>
  );
}

/** Cabecera de sección: sólo el título (serif) y, opcionalmente, un subtítulo en cursiva y acciones. */
export function SectionHead({
  id,
  title,
  subtitle,
  actions,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="title">
          {title}
        </h2>
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Diálogo nativo. `kind="sheet"` es el cajón lateral derecho; `kind="modal"` una ventana
 * centrada. Esc y clic en el fondo cierran; el foco queda atrapado por el navegador.
 */
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

export function MethodBody() {
  return (
    <div className="max-w-[68ch] space-y-4 text-[0.92rem] leading-relaxed text-ink-2">
      <section>
        <h3 className="serif text-[1.15rem] text-ink">Los datos no se tocan</h3>
        <p>
          Espectros en <Tex>{SYM.jyb}</Tex> tal como vienen del paquete, sin suavizar, sin restar fondo y sin recalibrar. W1 y
          W2 se tratan por separado y nunca se unen. Las intensidades no son abundancias.
        </p>
      </section>
      <section>
        <h3 className="serif text-[1.15rem] text-ink">Un solo paso: de observado a reposo</h3>
        <div className="plate my-2 px-5 py-3 text-ink">
          <Tex display>{String.raw`\nu_{\mathrm{reposo}} = \frac{\nu_{\mathrm{LSRK}}}{1 - v/c},\qquad c = 299\,792.458\ \mathrm{km\,s^{-1}}`}</Tex>
        </div>
        <p>
          La velocidad es la <b className="text-ink">dada por los organizadores</b> (B ≈ 2.7 km/s, A ≈ 3.2 km/s); no se estima
          ni se ajusta. El Doppler se aplica una sola vez. Ruido: desviación estándar de tramos sin líneas, con la mediana
          de cada tramo restada, como en el cuaderno oficial (en A, que casi no tiene tramos libres, se usa la envolvente inferior).
        </p>
      </section>
      <section>
        <h3 className="serif text-[1.15rem] text-ink">Probabilidad por línea</h3>
        <p>Para cada pico de emisión (≥ 4σ) y cada transición cercana de CDMS/JPL:</p>
        <div className="plate my-2 px-5 py-3 text-ink">
          <Tex display>{String.raw`P(s\mid\text{línea}) \propto L_{\nu}\cdot L_{A}\cdot L_{\text{rep}}\cdot \pi_{\text{átomos}}\cdot \pi_{\text{espacio}}\cdot f_{\text{entorno}}`}</Tex>
        </div>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <b className="text-ink">Frecuencia</b> <Tex>{String.raw`L_\nu`}</Tex>: cercanía del pico a la transición (en reposo),
            con la incertidumbre del catálogo, el canal y el movimiento interno del gas.
          </li>
          <li>
            <b className="text-ink">Coeficiente de Einstein</b> <Tex>{String.raw`L_A`}</Tex>: el <Tex>{String.raw`A_{ij}`}</Tex>{" "}
            publicado por CDMS/JPL (con <Tex>{String.raw`g_u`}</Tex> y <Tex>{String.raw`E_u`}</Tex>). Una transición con poca
            intensidad esperada no explica un pico brillante.
          </li>
          <li>
            <b className="text-ink">Se repite</b> <Tex>{String.raw`L_{\text{rep}}`}</Tex>: qué fracción de las líneas fuertes de
            la molécula en W1 y W2 aparece, y cuántas faltan.
          </li>
          <li>
            <b className="text-ink">Complejidad</b> <Tex>{String.raw`\pi_{\text{átomos}}`}</Tex>: fracción de las 348 moléculas
            del censo CDMS con ese número de átomos.
          </li>
          <li>
            <b className="text-ink">Visto en el espacio</b> <Tex>{String.raw`\pi_{\text{espacio}}`}</Tex>: detectada, tentativa
            o no detectada según el censo Las variantes isotópicas que no están en el catálogo oficial cuentan como no confirmadas.
          </li>
          <li>
            <b className="text-ink">Entorno</b> <Tex>{String.raw`f_{\text{entorno}}`}</Tex>: si sus condiciones favorables se
            parecen a un núcleo caliente protoestelar.
          </li>
        </ul>
        <p>
          Siempre compite la opción <i>fuera del catálogo</i>. Los valores se normalizan a 100 % por pico. Son puntajes
          relativos, no probabilidades calibradas: la decisión final es de quien analiza.
        </p>
      </section>
      <section>
        <h3 className="serif text-[1.15rem] text-ink">Qué no hace</h3>
        <p>
          No convierte intensidad en abundancia, no estima la velocidad y no asume que una coincidencia sea una
          identificación. Las fichas de moléculas son borrador pendiente de verificación.
        </p>
      </section>
    </div>
  );
}

export function ShortcutsBody() {
  const rows: [string, string][] = [
    ["1 · 2 · 3", "ir a Espectro, Probabilidad, Huellas"],
    ["e", "abrir el registro de evidencia"],
    ["m", "ver el método"],
    ["w", "cambiar de ventana (W1 / W2)"],
    ["b · p · a", "activar B offset, B pico, A"],
    ["Esc", "cerrar"],
    ["?", "esta ayuda"],
  ];
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt>
            {k.split(" · ").map((x, i) => (
              <span key={x}>
                {i ? " " : ""}
                <kbd>{x}</kbd>
              </span>
            ))}
          </dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

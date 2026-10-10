"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** true when the user asked the OS for less motion (checked once; cheap enough). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Adds `is-in` to the element the first time it enters the viewport.
 * Pair with the `.reveal` class in globals.css. Children with `.reveal-item`
 * and a `--i` custom property get a staggered delay.
 */
export function useReveal<T extends HTMLElement>(margin = "0px 0px -8% 0px"): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.disconnect();
          }
        }
      },
      { rootMargin: margin, threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return ref;
}

/** Counts from the previous value to `value` over `ms` (ease-out). Returns the displayed number. */
export function useCountUp(value: number | null, ms = 650): number | null {
  const [shown, setShown] = useState<number | null>(value);
  const prev = useRef<number | null>(value);
  useEffect(() => {
    if (value === null) {
      setShown(null);
      prev.current = null;
      return;
    }
    const from = prev.current ?? 0;
    prev.current = value;
    if (prefersReducedMotion() || from === value) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (value - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/**
 * Restarts a CSS animation class on `ref` whenever `key` changes
 * (remove class, force reflow, add class). Used to crossfade the spectrum on
 * position/window switches without remounting Plotly.
 */
export function useRestartAnimation<T extends HTMLElement>(ref: RefObject<T | null>, cls: string, key: string | number) {
  const first = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    if (prefersReducedMotion()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }, [key, cls, ref]);
}

/** Which section id is currently most visible; for the masthead nav. */
export function useScrollSpy(ids: readonly string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const els = ids.map((id) => document.getElementById(id)).filter((x): x is HTMLElement => !!x);
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best: string | null = null;
        let bestR = 0;
        for (const [id, r] of visible) {
          if (r > bestR) {
            best = id;
            bestR = r;
          }
        }
        if (best) setCurrent(best);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.1, 0.25, 0.5] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return current;
}

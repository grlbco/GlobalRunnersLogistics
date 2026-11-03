"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Apple-style scroll-scrubbed image sequence drawn to <canvas>.
 * `trigger` is the tall pinned section; progress 0→1 maps to frame 1→count.
 */
export function FrameSequence({
  count,
  basePath,
  poster,
  triggerId,
  className,
}: {
  count: number;
  basePath: string;
  poster: string;
  triggerId: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const trigger = document.getElementById(triggerId);
    if (!canvas || !trigger || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const variant = window.innerWidth < 768 ? "mobile" : "desktop";
    const src = (i: number) => `${basePath}/${variant}/${String(i + 1).padStart(4, "0")}.webp`;
    const images: HTMLImageElement[] = new Array(count);
    let current = 0;

    const draw = (i: number) => {
      const img = images[i];
      if (!img || !img.complete || !img.naturalWidth) return;
      const { width: cw, height: ch } = canvas;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      draw(current);
    };

    // Load first frame immediately, the rest progressively when the browser is idle.
    const load = (i: number) =>
      new Promise<void>((res) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => res();
        img.onerror = () => res();
        img.src = src(i);
        images[i] = img;
      });
    load(0).then(() => {
      resize();
      canvas.dataset.ready = "true";
    });
    let i = 1;
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window ? (window as Window & { requestIdleCallback: (c: () => void) => number }).requestIdleCallback(cb) : setTimeout(cb, 16);
    const pump = () => {
      if (i >= count) return;
      const batch = [];
      for (let k = 0; k < 6 && i < count; k++, i++) batch.push(load(i));
      Promise.all(batch).then(() => idle(pump));
    };
    idle(pump);

    const st = ScrollTrigger.create({
      trigger,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: (self) => {
        const next = Math.min(count - 1, Math.round(self.progress * (count - 1)));
        if (next !== current) {
          current = next;
          requestAnimationFrame(() => draw(current));
        }
      },
    });
    window.addEventListener("resize", resize);
    return () => {
      st.kill();
      window.removeEventListener("resize", resize);
    };
  }, [count, basePath, triggerId]);

  return (
    <div className={className}>
      {/* Poster is the LCP element and the reduced-motion fallback. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100" />
    </div>
  );
}

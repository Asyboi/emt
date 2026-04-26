import { useEffect, useRef } from "react";

type Cell = {
  gx: number;
  gy: number;
  phase: number;
  freq: number;
  dCenter: number;
};

export function PixelCross() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const fadeStart = vh * 0.2;
      const fadeEnd = vh * 0.9;
      const t = Math.max(0, Math.min(1, (y - fadeStart) / (fadeEnd - fadeStart)));
      const eased = t * t * (3 - 2 * t);
      wrapper.style.opacity = String(1 - eased);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const FONT_FAMILY = "'JetBrains Mono', ui-monospace, monospace";
    const RAMP = " .·-:=+*#%@".split("");
    const SIZE = 21;
    const ARM = 7;
    const armStart = Math.floor((SIZE - ARM) / 2);
    const armEnd = armStart + ARM;

    let W = 0;
    let H = 0;
    let CELL = 22;
    let ox = 0;
    let oy = 0;

    const cells: Cell[] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const inH = y >= armStart && y < armEnd;
        const inV = x >= armStart && x < armEnd;
        if (!(inH || inV)) continue;
        const dx = x - (SIZE - 1) / 2;
        const dy = y - (SIZE - 1) / 2;
        cells.push({
          gx: x,
          gy: y,
          phase: Math.random() * Math.PI * 2,
          freq: 0.6 + Math.random() * 0.5,
          dCenter: Math.sqrt(dx * dx + dy * dy),
        });
      }
    }

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(W, H) * 0.82;
      CELL = Math.max(14, target / SIZE);
      const total = SIZE * CELL;
      ox = (W - total) / 2;
      oy = (H - total) / 2;
    };
    layout();
    window.addEventListener("resize", layout);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
      mouseRef.current.active = true;
    };
    const onLeave = () => {
      mouseRef.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);

    const TEXT = "#1A1A1A";
    const getPrimary = () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim() || "#C8102E";

    const tick = (now: number) => {
      ctx.clearRect(0, 0, W, H);
      const t = now * 0.001;
      const m = mouseRef.current;
      const PRIMARY = getPrimary();
      const fontPx = Math.max(10, CELL * 0.85);
      ctx.font = `500 ${fontPx}px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      cells.forEach((c) => {
        const px = ox + c.gx * CELL + CELL / 2;
        const py = oy + c.gy * CELL + CELL / 2;

        const wave = Math.sin(t * 0.9 - c.dCenter * 0.55 + c.phase) * 0.5 + 0.5;
        let intensity = 0.25 + wave * 0.55;

        let hot = 0;
        if (m.active) {
          const dx = px - m.x;
          const dy = py - m.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const R = Math.min(W, H) * 0.18;
          if (d < R) {
            hot = 1 - d / R;
            intensity = Math.min(1, intensity + hot * 0.7);
          }
        }

        const idx = Math.min(
          RAMP.length - 1,
          Math.max(0, Math.floor(intensity * (RAMP.length - 1))),
        );
        const glyph = RAMP[idx];
        if (glyph === " ") return;

        const col = hot > 0.05 ? PRIMARY : TEXT;
        ctx.globalAlpha =
          hot > 0.05 ? 0.75 + hot * 0.25 : 0.4 + intensity * 0.3;
        ctx.fillStyle = col;
        ctx.fillText(glyph, px, py);
      });
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", layout);
      window.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        willChange: "opacity",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

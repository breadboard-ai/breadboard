// Copyright 2026 Google LLC
// SPDX-License-Identifier: Apache-2.0

/**
 * GestureLayer — Canvas 2D overlay for circle/lasso gestures.
 *
 * Ported from the ea-ux spike. Draws an iridescent trail as the user
 * drags, detects when the gesture closes (forms a rough loop), and
 * reports what sections of the iframe fall within the lasso.
 *
 * Adapted for iframe architecture: instead of `data-circable` DOM
 * queries, this layer receives section rects from the React app via
 * the bridge and tests those rects against the lasso polygon.
 */

export { GestureLayer };
export type { GestureResult };

interface Point {
  x: number;
  y: number;
  t: number;
}

interface SectionRect {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GestureResult {
  /** The section IDs that were lassoed. */
  circled: string[];
  /** Labels of circled sections. */
  labels: string[];
  /** Bounding box of the gesture. */
  bounds: DOMRect;
  /** Center point of the gesture. */
  center: Point;
}

type GestureCallback = (result: GestureResult) => void;

class GestureLayer {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #points: Point[] = [];
  #isDrawing = false;
  #animationId = 0;
  #onComplete: GestureCallback;
  #trailHue = 0;
  #fadePoints: { points: Point[]; opacity: number }[] = [];
  #sectionRects: SectionRect[] = [];
  #iframeOffset = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, onComplete: GestureCallback) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d")!;
    this.#onComplete = onComplete;
    this.#resize();
    this.#bindEvents();
    this.#startRenderLoop();
  }

  /** Update the known section rects (called from bridge tracker). */
  updateSections(rects: SectionRect[], iframeOffset: { x: number; y: number }) {
    this.#sectionRects = rects;
    this.#iframeOffset = iframeOffset;
  }

  activate(): void {
    this.#canvas.classList.add("active");
  }

  deactivate(): void {
    this.#canvas.classList.remove("active");
    this.#points = [];
  }

  clearTrail(): void {
    this.#points = [];
    this.#fadePoints = [];
  }

  destroy(): void {
    cancelAnimationFrame(this.#animationId);
  }

  // ── Setup ─────────────────────────────────────────────────

  #resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.#canvas.width = window.innerWidth * dpr;
    this.#canvas.height = window.innerHeight * dpr;
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    window.addEventListener("resize", () => {
      this.#canvas.width = window.innerWidth * dpr;
      this.#canvas.height = window.innerHeight * dpr;
      this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  #bindEvents(): void {
    this.#canvas.addEventListener("pointerdown", (e) => this.#onPointerDown(e));
    this.#canvas.addEventListener("pointermove", (e) => this.#onPointerMove(e));
    this.#canvas.addEventListener("pointerup", () => this.#onPointerUp());
    this.#canvas.addEventListener("pointercancel", () => this.#onPointerUp());
  }

  #onPointerDown(e: PointerEvent): void {
    this.#isDrawing = true;
    this.#points = [];
    this.#trailHue = Math.random() * 360;
    this.#addPoint(e.clientX, e.clientY);
    this.#canvas.setPointerCapture(e.pointerId);
  }

  #onPointerMove(e: PointerEvent): void {
    if (!this.#isDrawing) return;
    this.#addPoint(e.clientX, e.clientY);
  }

  #onPointerUp(): void {
    if (!this.#isDrawing) return;
    this.#isDrawing = false;

    if (this.#points.length < 10) {
      this.#fadeAndClear();
      return;
    }

    // Save trail for fade animation.
    this.#fadePoints.push({ points: [...this.#points], opacity: 1 });

    // Detect circled sections.
    const result = this.#detectCircled();
    if (result.circled.length > 0) {
      this.#onComplete(result);
    } else {
      this.#fadeAndClear();
    }
  }

  #addPoint(x: number, y: number): void {
    this.#points.push({ x, y, t: performance.now() });
  }

  #fadeAndClear(): void {
    if (this.#points.length > 0) {
      this.#fadePoints.push({ points: [...this.#points], opacity: 1 });
    }
    this.#points = [];
  }

  // ── Rendering ─────────────────────────────────────────────

  #startRenderLoop(): void {
    const render = () => {
      this.#animationId = requestAnimationFrame(render);
      this.#draw();
    };
    render();
  }

  #draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Ensure bitmap matches viewport * DPR.
    if (this.#canvas.width !== w * dpr || this.#canvas.height !== h * dpr) {
      this.#canvas.width = w * dpr;
      this.#canvas.height = h * dpr;
    }

    // Apply DPR scale every frame (canvas.width= resets the transform).
    this.#ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.#ctx.clearRect(0, 0, w, h);

    // Fading trails.
    for (let i = this.#fadePoints.length - 1; i >= 0; i--) {
      const trail = this.#fadePoints[i];
      trail.opacity -= 0.08;
      if (trail.opacity <= 0) {
        this.#fadePoints.splice(i, 1);
        continue;
      }
      this.#drawTrail(trail.points, trail.opacity);
    }

    // Active trail.
    if (this.#points.length > 1) {
      this.#drawTrail(this.#points, 1);
    }
  }

  #drawTrail(points: Point[], opacity: number): void {
    const ctx = this.#ctx;
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Multi-pass for iridescent glow.
    const passes = [
      { width: 20, alpha: 0.06, hueShift: 0 },
      { width: 12, alpha: 0.12, hueShift: 30 },
      { width: 6, alpha: 0.25, hueShift: 60 },
      { width: 3, alpha: 0.7, hueShift: 90 },
      { width: 1.5, alpha: 1, hueShift: 120 },
    ];

    for (const pass of passes) {
      ctx.lineWidth = pass.width;
      ctx.globalAlpha = opacity * pass.alpha;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }

      // Iridescent stroke — hue shifts along the path.
      const t = (performance.now() / 20) % 360;
      const gradient = ctx.createLinearGradient(
        points[0].x, points[0].y,
        points[points.length - 1].x, points[points.length - 1].y
      );
      gradient.addColorStop(0, `hsla(${t + this.#trailHue + pass.hueShift}, 80%, 70%, 1)`);
      gradient.addColorStop(0.33, `hsla(${t + this.#trailHue + pass.hueShift + 60}, 80%, 70%, 1)`);
      gradient.addColorStop(0.66, `hsla(${t + this.#trailHue + pass.hueShift + 120}, 80%, 70%, 1)`);
      gradient.addColorStop(1, `hsla(${t + this.#trailHue + pass.hueShift + 180}, 80%, 70%, 1)`);

      ctx.strokeStyle = gradient;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Hit Detection ─────────────────────────────────────────

  /**
   * Detect which iframe sections fall inside the lasso.
   * Uses cached section rects (reported from iframe via tracker),
   * offset by the iframe's position in the parent frame.
   */
  #detectCircled(): GestureResult {
    const bounds = this.#getBounds();
    const center: Point = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      t: performance.now(),
    };

    const circled: string[] = [];
    const labels: string[] = [];

    for (const section of this.#sectionRects) {
      // Translate iframe-relative rects to parent-frame coordinates.
      const elCenterX = section.x + section.width / 2 + this.#iframeOffset.x;
      const elCenterY = section.y + section.height / 2 + this.#iframeOffset.y;

      if (this.#isPointInLasso(elCenterX, elCenterY)) {
        circled.push(section.id);
        labels.push(section.label);
      }
    }

    return { circled, labels, bounds, center };
  }

  #isPointInLasso(px: number, py: number): boolean {
    // Ray-casting algorithm for point-in-polygon.
    const pts = this.#points;
    let inside = false;

    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;

      const intersect =
        yi > py !== yj > py &&
        px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  #getBounds(): DOMRect {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const p of this.#points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    return new DOMRect(minX, minY, maxX - minX, maxY - minY);
  }
}

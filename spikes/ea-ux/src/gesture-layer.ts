/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * GestureLayer — Canvas 2D overlay that captures circle/lasso gestures.
 *
 * Draws an iridescent trail as the user drags, detects when the gesture
 * closes (forms a rough loop), and reports what circable elements fall
 * within the lasso.
 */
export { GestureLayer };

interface Point {
  x: number;
  y: number;
  t: number;
}

interface GestureResult {
  /** The circable element IDs that were lassoed */
  circled: string[];
  /** Bounding box of the gesture */
  bounds: DOMRect;
  /** Center point of the gesture */
  center: Point;
}

type GestureCallback = (result: GestureResult) => void;

class GestureLayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private points: Point[] = [];
  private isDrawing = false;
  private animationId = 0;
  private onComplete: GestureCallback;
  private trailHue = 0;
  private fadePoints: { points: Point[]; opacity: number }[] = [];

  constructor(canvas: HTMLCanvasElement, onComplete: GestureCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onComplete = onComplete;
    this.resize();
    this.bindEvents();
    this.startRenderLoop();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    window.addEventListener("resize", () => {
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }

  activate(): void {
    this.canvas.classList.add("active");
  }

  deactivate(): void {
    this.canvas.classList.remove("active");
    this.points = [];
  }

  private bindEvents(): void {
    // Pointer events for unified mouse/touch handling.
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.canvas.addEventListener("pointerup", () => this.onPointerUp());
    this.canvas.addEventListener("pointercancel", () => this.onPointerUp());
  }

  private onPointerDown(e: PointerEvent): void {
    this.isDrawing = true;
    this.points = [];
    this.trailHue = Math.random() * 360;
    this.addPoint(e.clientX, e.clientY);
    this.canvas.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.addPoint(e.clientX, e.clientY);
  }

  private onPointerUp(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.points.length < 10) {
      // Too short — just fade out.
      this.fadeAndClear();
      return;
    }

    // Save trail for fade animation.
    this.fadePoints.push({ points: [...this.points], opacity: 1 });

    // Detect circled elements.
    const result = this.detectCircled();
    if (result.circled.length > 0) {
      this.onComplete(result);
    } else {
      this.fadeAndClear();
    }
  }

  private addPoint(x: number, y: number): void {
    this.points.push({ x, y, t: performance.now() });
  }

  private fadeAndClear(): void {
    if (this.points.length > 0) {
      this.fadePoints.push({ points: [...this.points], opacity: 1 });
    }
    this.points = [];
  }

  clearTrail(): void {
    this.points = [];
    this.fadePoints = [];
  }

  // ─── Rendering ────────────────────────────────────────────

  private startRenderLoop(): void {
    const render = () => {
      this.animationId = requestAnimationFrame(render);
      this.draw();
    };
    render();
  }

  private draw(): void {
    const { ctx } = this;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Draw fading trails.
    for (let i = this.fadePoints.length - 1; i >= 0; i--) {
      const trail = this.fadePoints[i];
      trail.opacity -= 0.02;
      if (trail.opacity <= 0) {
        this.fadePoints.splice(i, 1);
        continue;
      }
      this.drawTrail(trail.points, trail.opacity);
    }

    // Draw active trail.
    if (this.points.length > 1) {
      this.drawTrail(this.points, 1);
    }
  }

  private drawTrail(points: Point[], opacity: number): void {
    const { ctx } = this;
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw multiple passes for the iridescent glow effect.
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
        points[0].x,
        points[0].y,
        points[points.length - 1].x,
        points[points.length - 1].y
      );
      gradient.addColorStop(
        0,
        `hsla(${t + this.trailHue + pass.hueShift}, 80%, 70%, 1)`
      );
      gradient.addColorStop(
        0.33,
        `hsla(${t + this.trailHue + pass.hueShift + 60}, 80%, 70%, 1)`
      );
      gradient.addColorStop(
        0.66,
        `hsla(${t + this.trailHue + pass.hueShift + 120}, 80%, 70%, 1)`
      );
      gradient.addColorStop(
        1,
        `hsla(${t + this.trailHue + pass.hueShift + 180}, 80%, 70%, 1)`
      );

      ctx.strokeStyle = gradient;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ─── Hit Detection ────────────────────────────────────────

  private detectCircled(): GestureResult {
    const bounds = this.getBounds();
    const center = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      t: performance.now(),
    };

    // Find circable elements whose centers fall within the lasso bounds.
    const circables = document.querySelectorAll("[data-circable]");
    const circled: string[] = [];

    for (const el of circables) {
      const rect = el.getBoundingClientRect();
      const elCenter = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };

      if (this.isPointInLasso(elCenter.x, elCenter.y)) {
        circled.push(el.getAttribute("data-circable")!);
        el.classList.add("selected");
      }
    }

    return { circled, bounds, center };
  }

  private isPointInLasso(px: number, py: number): boolean {
    // Ray-casting algorithm for point-in-polygon.
    const pts = this.points;
    let inside = false;

    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x,
        yi = pts[i].y;
      const xj = pts[j].x,
        yj = pts[j].y;

      const intersect =
        yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  private getBounds(): DOMRect {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    return new DOMRect(minX, minY, maxX - minX, maxY - minY);
  }

  destroy(): void {
    cancelAnimationFrame(this.animationId);
  }
}

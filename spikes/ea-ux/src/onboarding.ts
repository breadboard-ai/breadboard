/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Onboarding — a ghost lasso animation that teaches the circle gesture.
 *
 * On first load, an animated SVG path draws a circle around one of the
 * demo cards, showing the user the gesture without words.
 */
export { runOnboardingHint };

function runOnboardingHint(onComplete: () => void): void {
  const hint = document.getElementById("onboarding-hint")!;

  // Wait a beat, then show the hint text.
  setTimeout(() => {
    hint.classList.remove("hidden");
    hint.classList.add("visible");
  }, 1500);

  // Create ghost lasso SVG overlay.
  const target = document.querySelector(
    '[data-circable="appetizer"]'
  ) as HTMLElement;
  if (!target) {
    setTimeout(onComplete, 2000);
    return;
  }

  const rect = target.getBoundingClientRect();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
  svg.style.cssText = `
    position: absolute; inset: 0; z-index: 4;
    pointer-events: none; opacity: 0;
    transition: opacity 0.6s ease-out;
  `;

  // Build a rough ellipse path around the target.
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2 + 20;
  const ry = rect.height / 2 + 16;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  // Rough wobbly ellipse — intentionally imperfect to feel hand-drawn.
  const d = buildWobblyEllipse(cx, cy, rx, ry, 24);
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "url(#ghost-gradient)");
  path.setAttribute("stroke-width", "2.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-dasharray", String(path.getTotalLength?.() || 600));
  path.setAttribute(
    "stroke-dashoffset",
    String(path.getTotalLength?.() || 600)
  );
  path.style.cssText = `
    filter: drop-shadow(0 0 6px rgba(124, 106, 255, 0.5));
  `;

  // Gradient definition.
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const grad = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "linearGradient"
  );
  grad.id = "ghost-gradient";
  grad.innerHTML = `
    <stop offset="0%" stop-color="#7c6aff" />
    <stop offset="50%" stop-color="#ff9f6a" />
    <stop offset="100%" stop-color="#6aff9f" />
  `;
  defs.appendChild(grad);
  svg.appendChild(defs);
  svg.appendChild(path);
  document.getElementById("app")!.appendChild(svg);

  // Animate: fade in, draw the path, hold, fade out.
  setTimeout(() => {
    svg.style.opacity = "1";

    // Animate stroke-dashoffset to 0 (draws the circle).
    path.style.transition = "stroke-dashoffset 1.5s ease-in-out";
    // Need to get actual length after DOM insertion.
    const len = path.getTotalLength();
    path.setAttribute("stroke-dasharray", String(len));
    path.setAttribute("stroke-dashoffset", String(len));

    requestAnimationFrame(() => {
      path.style.strokeDashoffset = "0";
    });
  }, 2200);

  // Hold for a moment, then fade everything and transition.
  setTimeout(() => {
    svg.style.opacity = "0";
    hint.classList.remove("visible");
    hint.classList.add("hidden");

    setTimeout(() => {
      svg.remove();
      onComplete();
    }, 600);
  }, 5000);
}

/** Build a wobbly ellipse path with `n` points. */
function buildWobblyEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number
): string {
  const points: { x: number; y: number }[] = [];

  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * Math.PI * 2;
    // Add subtle random wobble for hand-drawn feel.
    const wobbleR = 1 + (Math.random() - 0.5) * 0.08;
    const x = cx + Math.cos(angle) * rx * wobbleR;
    const y = cy + Math.sin(angle) * ry * wobbleR;
    points.push({ x, y });
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${cpx} ${cpy}`;
  }
  d += " Z";

  return d;
}

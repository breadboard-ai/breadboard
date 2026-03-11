/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Main entry — wires together the demo content, gesture layer, and flow.
 */
import "./style.css";
import { renderDemoContent } from "./demo-content";
import { GestureLayer } from "./gesture-layer";
import { DemoFlow } from "./demo-flow";
import { DistortionLayer } from "./distortion-layer";

// ─── DOM References ─────────────────────────────────────────

const projection = document.getElementById("projection")!;
const gestureCanvas = document.getElementById(
  "gesture-canvas"
) as HTMLCanvasElement;
const contextInput = document.getElementById("context-input")!;
const contextLabel = document.getElementById("context-selection-label")!;
const contextField = document.getElementById(
  "context-field"
) as HTMLInputElement;
const activateBtn = document.getElementById("activate-btn")!;
const blurOverlay = document.getElementById("blur-overlay")!;
const onboardingOverlay = document.getElementById("onboarding-overlay")!;
const onboardingSuccess = document.getElementById("onboarding-success")!;
const arrowHint = document.getElementById("arrow-hint")!;

// ─── Initialize ─────────────────────────────────────────────

const flow = new DemoFlow();

// Render the hardcoded demo content.
renderDemoContent(projection);

// Set up gesture layer — activated when flow enters "selecting".
const gesture = new GestureLayer(gestureCanvas, (result) => {
  flow.transition("focused", result);
});

// Set up WebGL post-processing.
const distortion = new DistortionLayer();

// ─── Flow State Handlers ────────────────────────────────────

flow.onStateChange((state, data) => {
  switch (state) {
    case "onboarding":
      handleOnboarding();
      break;
    case "idle":
      handleIdle();
      break;
    case "selecting":
      handleSelecting();
      break;
    case "focused":
      handleFocused(
        data as { circled: string[]; center: { x: number; y: number } }
      );
      break;
    case "responding":
      handleResponding();
      break;
    case "resolved":
      handleResolved(data as { title: string; message: string });
      break;
  }
});

// Kick off — listeners are now registered.
flow.start();

// ─── State Handlers ─────────────────────────────────────────

function handleOnboarding(): void {
  // Hide demo content during onboarding — just the button is visible.
  projection.style.display = "none";

  // After a beat, show the arrow hint pointing at the button.
  setTimeout(() => {
    arrowHint.classList.remove("hidden");
    arrowHint.classList.add("visible");
  }, 1200);
}

function handleIdle(): void {
  // Deactivate gesture and remove selection mode.
  gesture.deactivate();
  gesture.clearTrail();
  activateBtn.classList.remove("active");
  projection.classList.remove("selection-mode");

  // If coming from focused: choreograph the exit.
  // 1. Hide UI immediately.
  contextInput.classList.remove("visible");
  contextInput.classList.add("hidden");
  contextField.value = "";

  // Remove resolved overlay.
  const overlay = document.querySelector(".resolved-overlay");
  if (overlay) overlay.remove();

  // Remove lifted cards + blur.
  document.querySelectorAll(".circable").forEach((el) => {
    el.classList.remove("selected", "lifted");
  });
  blurOverlay.classList.remove("visible");
  projection.classList.remove("blurred");

  // 2. If distortion is active, ramp it down then hide.
  distortion.deactivate().then(() => {
    // Fully clean after ramp-down.
  });
}

function handleSelecting(): void {
  // Activate gesture canvas + show selection mode visuals.
  gesture.activate();
  activateBtn.classList.add("active");
  projection.classList.add("selection-mode");

  // Hide the arrow hint — they found it.
  arrowHint.classList.remove("visible");
  arrowHint.classList.add("hidden");

  // In onboarding: reveal the card to circle.
  if (onboardingOverlay.style.display !== "none") {
    const card = document.getElementById("onboarding-card")!;
    card.classList.remove("hidden");
    card.classList.add("visible");
    onboardingOverlay.classList.add("selection-mode");
  }
}

function handleFocused(data: {
  circled: string[];
  center: { x: number; y: number };
}): void {
  // Disable gesture input.
  gesture.deactivate();
  activateBtn.classList.remove("active");
  projection.classList.remove("selection-mode");
  onboardingOverlay.classList.remove("selection-mode");

  // ── Onboarding: ripple effect → success message → transition to content.
  if (data.circled.includes("onboarding")) {
    // Ripple from the circle center.
    distortion.activate(onboardingOverlay, data.center.x, data.center.y);

    // After ripple plays, show success message.
    setTimeout(() => {
      distortion.fadeOut();
      onboardingOverlay.classList.add("dismissed");

      onboardingSuccess.classList.remove("hidden");
      onboardingSuccess.classList.add("visible");

      // After a moment, dismiss and reveal the real content.
      setTimeout(() => {
        onboardingSuccess.classList.remove("visible");
        onboardingSuccess.classList.add("hidden");
        onboardingOverlay.style.display = "none";
        projection.style.display = "";

        setTimeout(() => {
          flow.transition("idle");
        }, 500);
      }, 1800);
    }, 600);
    return;
  }

  // 1. FLASH: instant color acknowledgment — stays visible during capture.
  for (const id of data.circled) {
    const el = document.querySelector(`[data-circable="${id}"]`);
    if (el) {
      el.classList.add("selected");
    }
  }

  // 2. RIPPLE: capture immediately — flash stays visible during html2canvas
  // (~200-400ms), then WebGL canvas appears on top seamlessly.
  distortion.activate(projection, data.center.x, data.center.y);

  // Set up blur behind WebGL (invisible while ripple plays).
  projection.classList.add("blurred");
  blurOverlay.classList.add("visible");

  // 3. Remove flash glow while WebGL still covers it (no bleed-through).
  setTimeout(() => {
    for (const id of data.circled) {
      const el = document.querySelector(`[data-circable="${id}"]`);
      if (el) {
        el.classList.remove("selected");
      }
    }
  }, 300);

  // 4. LIFT + SETTLE: lift card + fade WebGL → clean reveal.
  setTimeout(() => {
    for (const id of data.circled) {
      const el = document.querySelector(`[data-circable="${id}"]`);
      if (el) {
        el.classList.add("lifted");
      }
    }

    const labels = data.circled
      .map((id) => {
        const el = document.querySelector(`[data-circable="${id}"]`);
        return el?.getAttribute("data-label") ?? id;
      })
      .join(" + ");

    contextLabel.textContent = labels;
    contextInput.classList.remove("hidden");
    contextInput.classList.add("visible");
    setTimeout(() => contextField.focus(), 100);

    distortion.fadeOut();
  }, 450);
}

function handleResponding(): void {
  // Hide contextual input.
  contextInput.classList.remove("visible");
  contextInput.classList.add("hidden");

  // Keep projection blurred and cards lifted — we're "working".
}

function handleResolved(response: { title: string; message: string }): void {
  // Show resolved overlay.
  const overlay = document.createElement("div");
  overlay.className = "resolved-overlay";
  overlay.innerHTML = `
    <div class="resolved-card">
      <h2>${response.title}</h2>
      <p>${response.message}</p>
    </div>
  `;
  document.getElementById("app")!.appendChild(overlay);

  // Animate in.
  requestAnimationFrame(() => {
    overlay.classList.add("visible");
  });

  // Click anywhere to dismiss.
  overlay.addEventListener("click", () => {
    flow.transition("idle");
  });
}

// ─── Click-to-dismiss on blur overlay ───────────────────────

blurOverlay.addEventListener("click", () => {
  const state = flow.getState();
  if (state === "focused") {
    flow.transition("idle");
  }
});

// ─── Activation: Button + Keyboard ──────────────────────────

activateBtn.addEventListener("click", () => {
  const state = flow.getState();
  if (state === "idle" || state === "onboarding") {
    flow.transition("selecting");
  } else if (state === "selecting") {
    // Go back to the previous state.
    flow.transition(
      onboardingOverlay.style.display !== "none" ? "onboarding" : "idle"
    );
  }
});

document.addEventListener("keydown", (e) => {
  // Escape: back to idle from selecting or focused.
  if (e.key === "Escape") {
    const state = flow.getState();
    if (state === "selecting" || state === "focused") {
      flow.transition("idle");
    }
    return;
  }

  // Cmd+E or Ctrl+E: toggle selection mode.
  if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    const state = flow.getState();
    if (state === "idle") {
      flow.transition("selecting");
    } else if (state === "selecting") {
      flow.transition("idle");
    }
    return;
  }
});

// ─── Input Handling ─────────────────────────────────────────

contextField.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && contextField.value.trim()) {
    e.stopPropagation();
    flow.simulateResponse(contextField.value.trim());
  }
  if (e.key === "Escape") {
    e.stopPropagation();
    flow.transition("idle");
  }
});

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Graph } from "./graph";
import { Camera } from "./camera";
import { isCtrlCommand } from "./utils/is-mac";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { calculateBounds } from "./utils/calculate-bounds";
import { clamp } from "./utils/clamp";
import { InspectableGraph } from "@google-labs/breadboard";
import { MAIN_BOARD_ID } from "../../constants/constants";

@customElement("bb-renderer")
export class Renderer extends LitElement {
  @property()
  accessor debug = false;

  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor camera = new Camera();

  @property()
  accessor tick = 0;

  @property()
  accessor zoomFactor = 250;

  @property()
  accessor minScale = 0.5;

  @property()
  accessor maxScale = 1.8;

  @property()
  accessor cullPadding = 0;

  @property()
  accessor graphFitPadding = 100;

  @state()
  accessor _boundsDirty = new Set<string>();

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--bb-ui-50);
      overflow: hidden;
      transform: translate(0, 0);
      contain: strict;
      container-type: size;
      user-select: none;
      width: 100%;
      height: 100%;
    }

    #overlay {
      display: none;
      position: absolute;
      border: 1px solid green;
      width: calc(100% + calc(2 * var(--cull-padding)));
      height: calc(100% + calc(2 * var(--cull-padding)));
      top: calc(var(--cull-padding) * -1);
      left: calc(var(--cull-padding) * -1);
      pointer-events: none;

      &.active {
        display: block;
      }
    }
  `;

  #lastBoundsForInteraction = new DOMRect();
  #boundsForInteraction = new DOMRect();
  #attemptFitToView = false;
  #attemptAdjustToNewBounds = false;
  #firstResize = true;

  #onWheelBound = this.#onWheel.bind(this);
  #resizeObserver = new ResizeObserver((entries) => {
    this.#lastBoundsForInteraction = this.#boundsForInteraction;
    this.#boundsForInteraction = this.getBoundingClientRect();

    if (this.#firstResize) {
      this.#attemptFitToView = true;
    } else {
      this.#attemptAdjustToNewBounds = true;
    }
    this.#firstResize = false;

    if (this.camera) {
      this.camera.bounds = entries[0].contentRect;
      this.tick++;
    }
  });
  #graphs = new Map<string, Graph>();
  #effects = new Map<string, () => void>();

  #addEffect(name: string, effect: () => void) {
    this.#effects.set(name, effect);
    this.#runEffects();
  }

  #removeEffect(name: string) {
    this.#effects.delete(name);
  }

  #onWheel(evt: WheelEvent) {
    evt.preventDefault();

    if (!this.camera) {
      return;
    }

    this.#removeEffect("camera");
    if (isCtrlCommand(evt)) {
      const currentScale = this.camera.transform.a;
      const newScale = currentScale * (1 - evt.deltaY / this.zoomFactor);

      let delta = currentScale / newScale;
      if (
        currentScale * delta < this.minScale ||
        currentScale * delta > this.maxScale
      ) {
        delta = 1;
      }

      const offsetX = evt.clientX - this.#boundsForInteraction.x;
      const offsetY = evt.clientY - this.#boundsForInteraction.y;

      this.camera.transform.translateSelf(offsetX, offsetY);
      this.camera.transform.scaleSelf(delta, delta);
      this.camera.transform.translateSelf(-offsetX, -offsetY);
    } else {
      this.camera.transform.translateSelf(evt.deltaX, evt.deltaY);
    }

    this.tick++;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
    this.addEventListener("wheel", this.#onWheelBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();
    this.removeEventListener("wheel", this.#onWheelBound);
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (this.#attemptFitToView) {
      this.#attemptFitToView = false;
      this.fitToView(false);
    }

    if (this.#attemptAdjustToNewBounds) {
      this.#attemptAdjustToNewBounds = false;
      this.#removeEffect("camera");
      this.#adjustToNewBounds();
    }

    if (changedProperties.has("graph") && this.graph) {
      // Main graph.
      let mainGraph = this.#graphs.get(MAIN_BOARD_ID);
      if (!mainGraph) {
        mainGraph = new Graph();
        this.#graphs.set(MAIN_BOARD_ID, mainGraph);
      }

      mainGraph.nodes = this.graph.nodes();
      mainGraph.edges = this.graph.edges();

      // Subgraphs.
      for (const [id, graph] of Object.entries(this.graph.graphs() ?? {})) {
        let subGraph = this.#graphs.get(id);
        if (!subGraph) {
          subGraph = new Graph();
          this.#graphs.set(id, subGraph);
        }

        subGraph.nodes = graph.nodes();
        subGraph.edges = graph.edges();
      }
    }

    if (changedProperties.has("cullPadding")) {
      if (this.cullPadding >= 0) {
        this.style.setProperty("--cull-padding", null);
      } else {
        this.style.setProperty("--cull-padding", `${this.cullPadding}px`);
      }
    }

    if (
      (changedProperties.has("tick") ||
        changedProperties.has("_boundsDirty")) &&
      this.graph &&
      this.camera
    ) {
      for (const graph of this.#graphs.values()) {
        graph.updateEntity(this.camera.transform.inverse());

        if (this.camera?.bounds) {
          graph.cullOutsideOf(this.camera.bounds, this.cullPadding);
        }
      }
    }

    this._boundsDirty.clear();
  }

  #adjustToNewBounds() {
    if (!this.camera) {
      return;
    }

    this.camera.transform.translateSelf(
      (this.#lastBoundsForInteraction.width -
        this.#boundsForInteraction.width) *
        0.5,
      (this.#lastBoundsForInteraction.height -
        this.#boundsForInteraction.height) *
        0.5
    );
  }

  fitToView(animated = true) {
    if (!this.#graphs || !this.#boundsForInteraction || !this.camera) {
      return;
    }

    const allGraphBounds = calculateBounds(this.#graphs);
    if (allGraphBounds.width === 0) {
      return;
    }

    const targetMatrix = this.#calculateCameraMatrixFromBounds(allGraphBounds);
    if (!animated) {
      this.camera.transform = targetMatrix;
    } else {
      this.#addEffect("camera", () => {
        if (!this.camera) {
          this.#removeEffect("camera");
          return;
        }

        const EASING = 10;
        const THRESHOLD = 0.001;
        const current = this.camera.transform.translate(0, 0); // Clone.

        current.a += (targetMatrix.a - current.a) / EASING;
        current.b += (targetMatrix.b - current.b) / EASING;
        current.c += (targetMatrix.c - current.c) / EASING;
        current.d += (targetMatrix.d - current.d) / EASING;
        current.e += (targetMatrix.e - current.e) / EASING;
        current.f += (targetMatrix.f - current.f) / EASING;

        if (
          Math.abs(current.a - targetMatrix.a) < THRESHOLD &&
          Math.abs(current.b - targetMatrix.b) < THRESHOLD &&
          Math.abs(current.c - targetMatrix.c) < THRESHOLD &&
          Math.abs(current.d - targetMatrix.d) < THRESHOLD &&
          Math.abs(current.e - targetMatrix.e) < THRESHOLD &&
          Math.abs(current.f - targetMatrix.f) < THRESHOLD
        ) {
          this.camera.transform = targetMatrix;
          this.tick++;
          this.#removeEffect("camera");
          return;
        }

        this.camera.transform = current;
        this.tick++;
      });
    }
  }

  #runningEffects = false;
  #runEffects() {
    const runEffects = () => {
      for (const effect of this.#effects.values()) {
        effect.call(this);
      }

      if (this.#effects.size === 0) {
        this.#runningEffects = false;
        return;
      }

      requestAnimationFrame(runEffects);
    };

    if (this.#runningEffects) {
      return;
    }

    requestAnimationFrame(runEffects);
  }

  #calculateCameraMatrixFromBounds(bounds: DOMRect) {
    const targetMatrix = new DOMMatrix();

    const delta = Math.min(
      (this.#boundsForInteraction.width - 2 * this.graphFitPadding) /
        bounds.width,
      (this.#boundsForInteraction.height - 2 * this.graphFitPadding) /
        bounds.height,
      1
    );

    if (delta === 0) {
      return targetMatrix;
    }

    const invDelta = clamp(1 / delta, this.minScale, this.maxScale);
    const pivot = new DOMPoint(
      this.#boundsForInteraction.width * 0.5,
      this.#boundsForInteraction.height * 0.5
    );

    targetMatrix
      .translateSelf(
        bounds.x - (this.#boundsForInteraction.width - bounds.width) * 0.5,
        bounds.y - (this.#boundsForInteraction.height - bounds.height) * 0.5
      )
      .translateSelf(pivot.x, pivot.y)
      .scaleSelf(invDelta, invDelta)
      .translateSelf(-pivot.x, -pivot.y);

    // Also ensure that the matrix values remain positive.
    targetMatrix.a = Math.max(targetMatrix.a, 0);
    targetMatrix.b = Math.max(targetMatrix.b, 0);
    targetMatrix.c = Math.max(targetMatrix.c, 0);
    targetMatrix.d = Math.max(targetMatrix.d, 0);

    return targetMatrix;
  }

  render() {
    if (!this.#graphs || !this.camera) {
      return nothing;
    }

    this.camera.showBounds = this.debug;

    return [
      html`${repeat(
        this.#graphs,
        ([id]) => id,
        ([, graph]) => {
          if (!this.camera) {
            return nothing;
          }

          graph.showBounds = this.debug;

          return html`<div
            @bbnodeselect=${() => {
              this.tick++;
            }}
            @bbnodetranslate=${() => {
              this._boundsDirty = new Set([
                ...this._boundsDirty,
                graph.boundsLabel,
              ]);
            }}
            @bbnodeboundsupdaterequest=${() => {
              this._boundsDirty = new Set([
                ...this._boundsDirty,
                graph.boundsLabel,
              ]);
            }}
          >
            ${graph}
          </div>`;
        }
      )}
      </div>`,
      this.camera,
      html`<div
        id="overlay"
        class=${classMap({ active: this.cullPadding < 0 })}
      ></div>`,
    ];
  }
}

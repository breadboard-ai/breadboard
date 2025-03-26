/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LitElement,
  html,
  css,
  nothing,
  PropertyValues,
  HTMLTemplateResult,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Graph } from "./graph";
import { Camera } from "./camera";
import { isCtrlCommand } from "./utils/is-ctrl-command";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { calculateBounds } from "./utils/calculate-bounds";
import { clamp } from "./utils/clamp";
import { EditSpec, InspectableGraph } from "@google-labs/breadboard";
import { MAIN_BOARD_ID } from "../../constants/constants";
import {
  SelectGraphContentsEvent,
  SelectionTranslateEvent,
} from "./events/events";
import { WorkspaceSelectionStateWithChangeId } from "../../types/types";
import {
  createEmptyWorkspaceSelectionState,
  createWorkspaceSelectionChangeId,
} from "../../utils/workspace";
import {
  MultiEditEvent,
  WorkspaceSelectionStateEvent,
} from "../../events/events";
import { styleMap } from "lit/directives/style-map.js";
import { Entity } from "./entity";
import { toGridSize } from "./utils/to-grid-size";

@customElement("bb-renderer")
export class Renderer extends LitElement {
  @property()
  accessor debug = false;

  @property()
  accessor graph: InspectableGraph | null = null;

  @property()
  accessor selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property({ reflect: true })
  accessor interactionMode: "inert" | "selection" | "move" = "inert";

  @property({ reflect: true, type: Boolean })
  accessor isDragMoving = false;

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

  @property()
  accessor graphTopologyUpdateId = 0;

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
      outline: none;
    }

    :host([interactionmode="move"]) {
      cursor: grab;
    }

    :host([interactionmode="move"][isdragmoving]) {
      cursor: grabbing;
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

    #selection {
      display: block;
      pointer-events: none;
      position: absolute;
      border: 1px solid var(--bb-neutral-500);
      background: oklch(from var(--bb-neutral-900) l c h / 0.05);
      z-index: 3;
    }
  `;

  #lastBoundsForInteraction = new DOMRect();
  #boundsForInteraction = new DOMRect();
  #attemptFitToView = false;
  #attemptAdjustToNewBounds = false;
  #firstResize = true;

  #onWheelBound = this.#onWheel.bind(this);
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onKeyUpBound = this.#onKeyUp.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);

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

  constructor() {
    super();

    this.tabIndex = 0;
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#resizeObserver.observe(this);
    this.addEventListener("wheel", this.#onWheelBound);
    this.addEventListener("pointerdown", this.#onPointerDownBound);
    this.addEventListener("pointermove", this.#onPointerMoveBound);
    this.addEventListener("pointerup", this.#onPointerUpBound);

    window.addEventListener("keydown", this.#onKeyDownBound);
    window.addEventListener("keyup", this.#onKeyUpBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.#resizeObserver.disconnect();
    this.removeEventListener("wheel", this.#onWheelBound);
    this.removeEventListener("pointerdown", this.#onPointerDownBound);
    this.removeEventListener("pointermove", this.#onPointerMoveBound);
    this.removeEventListener("pointerup", this.#onPointerUpBound);

    window.removeEventListener("keydown", this.#onKeyDownBound);
    window.removeEventListener("keyup", this.#onKeyUpBound);
  }

  #addEffect(name: string, effect: () => void) {
    this.#effects.set(name, effect);
    this.#runEffects();
  }

  #removeEffect(name: string) {
    this.#effects.delete(name);
  }

  #onKeyDown(evt: KeyboardEvent) {
    if (evt.code !== "Space" || this.interactionMode === "move") {
      return;
    }

    this.interactionMode = "move";
  }

  #onKeyUp() {
    this.interactionMode = "inert";
  }

  #dragStart: DOMPoint | null = null;
  #dragRect: DOMRect | null = null;
  #clickRect: DOMRect | null = null;
  #isToggleSelection = false;
  #isAdditiveSelection = false;
  #onPointerDown(evt: PointerEvent) {
    this.#dragStart = new DOMPoint(
      evt.clientX - this.#boundsForInteraction.left,
      evt.clientY - this.#boundsForInteraction.top
    );

    if (this.interactionMode === "move") {
      this.isDragMoving = true;
      return;
    }

    this.#dragRect = new DOMRect();
    this.#isToggleSelection = isCtrlCommand(evt);
    this.#isAdditiveSelection = evt.shiftKey;
    this.#updateDragRect(evt);
    this.interactionMode = "selection";
    this.tick++;

    // If the interaction is with the renderer, go into selection mode proper.
    const [top, ...rest] = evt.composedPath();
    if (top !== this) {
      // If the user has clicked on an unselected entity, change the behavior to
      // that of a click.
      const nearestEntity = rest.find((el) => el instanceof Entity);
      if (nearestEntity && !nearestEntity.selected) {
        this.#clickRect = DOMRect.fromRect(this.#dragRect);
        this.#dragRect = null;
        return;
      }

      this.interactionMode = "move";
    }
  }

  #onPointerMove(evt: PointerEvent) {
    if (!this.#dragStart) {
      return;
    }

    if (this.interactionMode === "move") {
      const delta = new DOMPoint(
        evt.clientX - this.#boundsForInteraction.left - this.#dragStart.x,
        evt.clientY - this.#boundsForInteraction.top - this.#dragStart.y
      );

      if (!this.camera.baseTransform) {
        this.camera.baseTransform = DOMMatrix.fromMatrix(this.camera.transform);
      }

      this.camera.transform.e =
        this.camera.baseTransform.e - delta.x * this.camera.transform.a;
      this.camera.transform.f =
        this.camera.baseTransform.f - delta.y * this.camera.transform.a;
    } else if (this.#dragRect) {
      this.#updateDragRect(evt);
    }

    this.tick++;
  }

  #onPointerUp() {
    this.#dragStart = null;
    this.#dragRect = null;

    if (this.interactionMode !== "move") {
      this.interactionMode = "inert";
    }
    this.#isAdditiveSelection = false;
    this.#isToggleSelection = false;
    this.camera.baseTransform = null;
    this.isDragMoving = false;
  }

  #updateDragRect(evt: PointerEvent) {
    if (!this.#dragStart || !this.#dragRect) {
      return;
    }

    const dragCurrent = new DOMPoint(
      evt.clientX - this.#boundsForInteraction.left,
      evt.clientY - this.#boundsForInteraction.top
    );
    const x = Math.min(this.#dragStart.x, dragCurrent.x);
    const y = Math.min(this.#dragStart.y, dragCurrent.y);
    const width = Math.abs(this.#dragStart.x - dragCurrent.x);
    const height = Math.abs(this.#dragStart.y - dragCurrent.y);

    this.#dragRect.x = x;
    this.#dragRect.y = y;
    this.#dragRect.width = width;
    this.#dragRect.height = height;
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

  protected shouldUpdate(changedProperties: PropertyValues): boolean {
    if (changedProperties.has("selectionState") && this.selectionState) {
      if (
        this.selectionState.selectionChangeId ===
        changedProperties.get("selectionState")?.selectionChangeId
      ) {
        return false;
      }
    }

    return true;
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

    if (changedProperties.has("cullPadding")) {
      if (this.cullPadding >= 0) {
        this.style.setProperty("--cull-padding", null);
      } else {
        this.style.setProperty("--cull-padding", `${this.cullPadding}px`);
      }
    }

    if (changedProperties.has("selectionState") && this.selectionState) {
      for (const [graphId, selectionState] of this.selectionState.selectionState
        .graphs) {
        const graph = this.#graphs.get(graphId);
        if (!graph) {
          continue;
        }

        graph.selectionState = selectionState;
      }
    }

    if (
      (changedProperties.has("graph") ||
        changedProperties.has("graphTopologyUpdateId")) &&
      this.graph &&
      this.camera
    ) {
      // Main graph.
      let mainGraph = this.#graphs.get(MAIN_BOARD_ID);
      if (!mainGraph) {
        mainGraph = new Graph(MAIN_BOARD_ID);
        this.#graphs.set(MAIN_BOARD_ID, mainGraph);
      }

      mainGraph.boundsLabel = this.graph.raw().title ?? "Untitled";
      mainGraph.nodes = this.graph.nodes();
      mainGraph.edges = this.graph.edges();
      mainGraph.resetTransform();

      // Subgraphs.
      for (const [id, graph] of Object.entries(this.graph.graphs() ?? {})) {
        let subGraph = this.#graphs.get(id);
        if (!subGraph) {
          subGraph = new Graph(id);
          this.#graphs.set(id, subGraph);
        }

        subGraph.boundsLabel = graph.raw().title ?? "Custom Tool";
        subGraph.nodes = graph.nodes();
        subGraph.edges = graph.edges();
        subGraph.resetTransform();
      }

      // Remove any stale graphs.
      const subGraphs = this.graph.graphs() ?? {};
      for (const graphId of this.#graphs.keys()) {
        if (graphId === MAIN_BOARD_ID || subGraphs[graphId]) {
          continue;
        }

        this.#graphs.delete(graphId);
      }
    }

    if (
      (changedProperties.has("tick") ||
        changedProperties.has("_boundsDirty") ||
        changedProperties.has("interactionMode") ||
        changedProperties.has("graphTopologyUpdateId")) &&
      this.graph &&
      this.camera
    ) {
      const inverseCameraMatrix = this.camera.transform.inverse();
      for (const graph of this.#graphs.values()) {
        graph.updateEntity(inverseCameraMatrix);

        if (this.interactionMode === "selection") {
          // Drag-select.
          if (this.#dragRect) {
            graph.selectInsideOf(
              this.#dragRect,
              0,
              this.#isAdditiveSelection,
              false
            );
          } else if (this.#clickRect) {
            // Click-select.
            graph.selectInsideOf(
              this.#clickRect,
              0,
              this.#isAdditiveSelection,
              this.#isToggleSelection
            );
          }
          this.#updateSelectionFromGraph(graph);
        }

        if (this.camera?.bounds) {
          graph.cullOutsideOf(this.camera.bounds, this.cullPadding);
        }
      }
    }

    this.#clickRect = null;
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

  #applyTranslationToSelection(x: number, y: number, hasSettled: boolean) {
    if (!this.selectionState) {
      return;
    }

    for (const graphId of this.selectionState.selectionState.graphs.keys()) {
      const graph = this.#graphs.get(graphId);
      if (!graph) {
        continue;
      }

      graph.applyTranslationToSelection(x, y, hasSettled);
    }

    // When the dragging settles, send out the update on all the node locations
    // so they can be persisted.
    if (hasSettled) {
      this.#emitSettledLocationEdits();
    }
  }

  #emitSettledLocationEdits() {
    if (!this.selectionState) {
      return;
    }

    const edits: EditSpec[] = [];

    for (const graphId of this.selectionState.selectionState.graphs.keys()) {
      const graph = this.#graphs.get(graphId);
      const graphSelection =
        this.selectionState.selectionState.graphs.get(graphId);
      if (!graph || !graphSelection) {
        continue;
      }

      for (const nodeId of graphSelection.nodes) {
        // Find the InspectableNode and the GraphNode entity and create the
        // updated metadata from the two.
        const graphNode = graph.nodes.find(
          (node) => node.descriptor.id === nodeId
        );
        const graphNodeEntity = graph.entities.get(nodeId);
        if (!graphNode || !graphNodeEntity) {
          continue;
        }

        const metadata = { ...(graphNode.metadata() ?? {}) };
        metadata.visual ??= {};

        const visual = metadata.visual as Record<string, number>;
        visual.x = toGridSize(graph.transform.e + graphNodeEntity.transform.e);
        visual.y = toGridSize(graph.transform.f + graphNodeEntity.transform.f);

        const editGraphId = graphId === MAIN_BOARD_ID ? "" : graphId;
        edits.push({
          type: "changemetadata",
          graphId: editGraphId,
          id: nodeId,
          metadata,
        });
      }
    }

    this.dispatchEvent(new MultiEditEvent(edits, "Update selection transform"));
  }

  #updateSelectionFromGraph(graph: Graph, createNewSelection = false) {
    const newState = createNewSelection
      ? createEmptyWorkspaceSelectionState()
      : (this.selectionState?.selectionState ??
        createEmptyWorkspaceSelectionState());

    if (graph.selectionState) {
      newState.graphs.set(graph.graphId, graph.selectionState);
    }

    const selectionChangeId = createWorkspaceSelectionChangeId();
    this.dispatchEvent(
      new WorkspaceSelectionStateEvent(
        selectionChangeId,
        newState,
        !this.#isAdditiveSelection,
        /** animated **/ false
      )
    );
  }

  render() {
    if (!this.#graphs || !this.camera) {
      return nothing;
    }

    this.camera.showBounds = this.debug;

    let selectionRectangle: HTMLTemplateResult | symbol = nothing;
    if (this.interactionMode === "selection" && this.#dragRect) {
      selectionRectangle = html`<div
        style=${styleMap({
          left: `${this.#dragRect.x}px`,
          top: `${this.#dragRect.y}px`,
          width: `${this.#dragRect.width}px`,
          height: `${this.#dragRect.height}px`,
        })}
        id="selection"
      ></div>`;
    }

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
            @bbselectgraphcontents=${(evt: SelectGraphContentsEvent) => {
              const graph = this.#graphs.get(evt.graphId);
              if (!graph) {
                return;
              }

              this.#updateSelectionFromGraph(graph, true);
            }}
            @bbselectiontranslate=${(evt: SelectionTranslateEvent) => {
              this.#applyTranslationToSelection(evt.x, evt.y, evt.hasSettled);

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
      selectionRectangle,
    ];
  }
}

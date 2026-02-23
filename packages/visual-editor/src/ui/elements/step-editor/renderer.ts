/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Global");

import {
  LitElement,
  html,
  css,
  nothing,
  PropertyValues,
  HTMLTemplateResult,
} from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { Graph } from "./graph.js";
import { Camera } from "./camera.js";
import { repeat } from "lit/directives/repeat.js";
import { classMap } from "lit/directives/class-map.js";
import { calculateBounds } from "./utils/calculate-bounds.js";
import { clamp } from "./utils/clamp.js";
import {
  GraphIdentifier,
  InspectableNode,
  NodeDescriptor,
  NodeIdentifier,
} from "@breadboard-ai/types";
import { A2_COMPONENTS } from "../../../a2/a2-registry.js";
import { MAIN_BOARD_ID } from "../../../sca/constants.js";
import {
  CreateNewAssetsEvent,
  GraphEdgeAttachmentMoveEvent,
  NodeAddEvent,
  NodeConfigurationRequestEvent,
  SelectGraphContentsEvent,
  SelectionMoveEvent,
  SelectionTranslateEvent,
} from "./events/events.js";
import { NewAsset } from "../../types/types.js";
import { createEmptyGraphSelectionState } from "../../../utils/graph-utils.js";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import type {
  AssetEdgeIdentifier,
  EdgeIdentifier,
} from "../../../sca/types.js";
import {
  DragConnectorStartEvent,
  EditorPointerPositionChangeEvent,
  NodeConfigurationUpdateRequestEvent,
  ZoomToFitEvent,
  MoveNodesEvent,
  ZoomInEvent,
  ZoomOutEvent,
  StateEvent,
} from "../../events/events.js";
import { styleMap } from "lit/directives/style-map.js";
import { Entity } from "./entity.js";
import { toGridSize } from "./utils/to-grid-size.js";
import { DragConnector } from "./drag-connector.js";
import { collectAssetIds, collectNodeIds } from "./utils/collect-ids.js";
import { EditorControls } from "./editor-controls.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { DATA_TYPE, MOVE_GRAPH_ID } from "./constants.js";
import { isCtrlCommand, isMacPlatform } from "../../input/is-ctrl-command.js";
import type { RendererRunState } from "../../../sca/types.js";

import { baseColors } from "../../styles/host/base-colors.js";
import { ItemSelect } from "../elements.js";

@customElement("bb-renderer")
export class Renderer extends SignalWatcher(LitElement) {
  // --- SCA context ---

  @consume({ context: scaContext })
  accessor sca!: SCA;

  get #gc() {
    return this.sca.controller.editor.graph;
  }

  // --- External state (set by canvas-controller) ---

  @property()
  accessor runState: RendererRunState | null = null;

  /**
   * Bridge between signal and non-signal world. Incremented every time
   * interesting signals change on the outside; used to track changes here.
   */
  @property()
  accessor runStateEffect = 0;

  @property()
  accessor debug = false;

  // --- Interaction ---

  @property({ reflect: true })
  accessor interactionMode: "inert" | "selection" | "pan" | "move" = "inert";

  @property({ reflect: true, type: Boolean })
  accessor isDragPanning = false;

  @property()
  accessor expandSelections = true;

  @property()
  accessor allowEdgeAttachmentMove = true;

  // --- Camera & zoom ---

  @property()
  accessor camera = new Camera();

  @property()
  accessor dragConnector = new DragConnector();

  @property()
  accessor tick = 0;

  @property()
  accessor zoomFactor = 250;

  @property()
  accessor minScale = 0.5;

  @property()
  accessor maxScale = 3;

  @property()
  accessor cullPadding = 0;

  @property()
  accessor graphFitPadding = 128;

  // --- Internal state ---

  #lastSeenSelectionId = -1;
  #lastGraphVersion = -1;

  @state()
  accessor _boundsDirty = new Set<string>();

  @state()
  accessor showDisclaimer = false;

  @state()
  accessor #selectionOverflowMenu: { x: number; y: number } | null = null;

  static styles = [
    baseColors,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        background: light-dark(var(--n-95), var(--n-10));
        overflow: hidden;
        transform: translate(0, 0);
        contain: strict;
        container-type: size;
        user-select: none;
        width: 100%;
        height: 100%;
        outline: none;
        touch-action: none;
        position: relative;
      }

      :host([interactionmode="pan"]) {
        cursor: grab;
      }

      :host([interactionmode="pan"][isdragpanning]) {
        cursor: grabbing;
      }

      #disclaimer {
        position: absolute;
        left: 0;
        bottom: 6px;
        width: 100%;
        margin: 0;
        font: 500 10px / 1 var(--bb-font-family);
        color: light-dark(var(--s-30), var(--n-60));
        text-align: center;
        padding: var(--bb-grid-size);
        background: transparent;
        opacity: 0;
        animation: fadeIn 0.6s cubic-bezier(0, 0, 0.3, 1) forwards;

        &.under-chat {
          width: auto;
          left: var(--bb-grid-size-4);
          bottom: var(--bb-grid-size-2);
          min-width: 280px;
        }
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
        border: 1px solid var(--light-dark-n-98);
        background: oklch(from var(--light-dark-n-10) l c h / 0.05);
        z-index: 4;
      }

      bb-editor-controls {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 3;
      }

      bb-item-select {
        position: fixed;
        --menu-width: 200px;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }

        to {
          opacity: 1;
        }
      }
    `,
  ];

  #editorControls: Ref<EditorControls> = createRef();

  #lastBoundsForInteraction = new DOMRect();
  #boundsForInteraction = new DOMRect();
  #fitToViewPre = false;
  #fitToViewPost = false;
  #attemptAdjustToNewBounds = false;
  #firstResize = true;

  #onWheelBound = this.#onWheel.bind(this);
  #onKeyDownBound = this.#onKeyDown.bind(this);
  #onKeyUpBound = this.#onKeyUp.bind(this);
  #onDragOverBound = this.#onDragOver.bind(this);
  #onDropBound = this.#onDrop.bind(this);
  #onPointerDownBound = this.#onPointerDown.bind(this);
  #onPointerMoveBound = this.#onPointerMove.bind(this);
  #onPointerUpBound = this.#onPointerUp.bind(this);

  #resizeObserver = new ResizeObserver((entries) => {
    this.#lastBoundsForInteraction = this.#boundsForInteraction;
    this.#boundsForInteraction = this.getBoundingClientRect();

    // If this is the very first resize, or if we're expanding from a viewport
    // that was too small for a meaningful fitToView (e.g. mobile view where
    // the graph editor was hidden or very narrow), do a full fitToView.
    const wasTooSmall =
      this.#lastBoundsForInteraction.width < 2 * this.graphFitPadding;
    if (this.#firstResize || wasTooSmall) {
      this.#fitToViewPre = true;
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
    this.addEventListener("dragover", this.#onDragOverBound);
    this.addEventListener("drop", this.#onDropBound);

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
    this.removeEventListener("dragover", this.#onDragOverBound);
    this.removeEventListener("drop", this.#onDropBound);

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
    if (evt.code !== "Space" || this.interactionMode === "pan") {
      return;
    }

    this.interactionMode = "pan";
  }

  #onKeyUp() {
    this.interactionMode = "inert";
  }

  #handleNewAssets(evt: CreateNewAssetsEvent) {
    evt.stopImmediatePropagation();

    if (this.#gc.readOnly) {
      return;
    }

    // Augment the added assets with the x & y coordinates of the
    // middle of the graph and dispatch the dropped assets event.

    const targetGraph = this.#graphs.get(MAIN_BOARD_ID);
    if (!targetGraph) {
      console.warn("Unable to add to graph");
      return;
    }

    const x =
      this.#boundsForInteraction.width * 0.5 - this.#boundsForInteraction.left;
    const y =
      this.#boundsForInteraction.height * 0.5 - this.#boundsForInteraction.top;
    let graphLocation = new DOMPoint(x, y).matrixTransform(
      targetGraph.worldTransform.inverse()
    );

    graphLocation.x += targetGraph.transform.e;
    graphLocation.y += targetGraph.transform.f;

    if (Number.isNaN(graphLocation.x) || Number.isNaN(graphLocation.y)) {
      // Set as 130, 20 so that it gets reset to 0, 0 below.
      graphLocation = new DOMPoint(130, 20);
    }

    const visual = {
      x: toGridSize(graphLocation.x - 130),
      y: toGridSize(graphLocation.y - 20),
    };

    const assets = evt.assets;
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      asset.visual = { ...visual };

      asset.visual.x += i * 10;
      asset.visual.y += i * 10;
    }

    this.dispatchEvent(new StateEvent({ eventType: "asset.add", assets }));
  }

  async #handleDroppedAssets(evt: DragEvent) {
    if (
      !evt.dataTransfer ||
      !evt.dataTransfer.files ||
      !evt.dataTransfer.files.length ||
      this.#gc.readOnly
    ) {
      return;
    }

    const filesDropped = evt.dataTransfer.files;
    if ([...filesDropped].some((file) => file.type.includes("json"))) {
      return;
    }

    evt.stopImmediatePropagation();

    const targetGraph = this.#graphs.get(MAIN_BOARD_ID);
    if (!targetGraph) {
      console.warn("Unable to add to graph");
      return;
    }

    const x = evt.clientX - this.#boundsForInteraction.x;
    const y = evt.clientY - this.#boundsForInteraction.y;
    let graphLocation = new DOMPoint(x, y).matrixTransform(
      targetGraph.worldTransform.inverse()
    );

    graphLocation.x += targetGraph.transform.e;
    graphLocation.y += targetGraph.transform.f;

    if (Number.isNaN(graphLocation.x) || Number.isNaN(graphLocation.y)) {
      // Set as 130, 20 so that it gets reset to 0, 0 below.
      graphLocation = new DOMPoint(130, 20);
    }

    const visual = {
      x: toGridSize(graphLocation.x - 130),
      y: toGridSize(graphLocation.y - 20),
    };

    const assetLoad = [...filesDropped].map((file, idx) => {
      return new Promise<NewAsset>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("loadend", () => {
          if (reader.result === null) {
            reject("");
            return;
          }

          const preamble = `data:${file.type};base64,`;
          const data = (reader.result as string).substring(preamble.length);

          resolve({
            name: file.name,
            path: file.name,
            type: "file",
            visual: { x: visual.x + idx * 10, y: visual.y + idx * 10 },
            data: {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data,
                    mimeType: file.type,
                  },
                },
              ],
            },
          });
        });
        reader.readAsDataURL(file);
      });
    });

    const assets = await Promise.all(assetLoad);
    this.dispatchEvent(new StateEvent({ eventType: "asset.add", assets }));
  }

  #onDragOver(evt: DragEvent) {
    evt.preventDefault();
  }

  #onDrop(evt: DragEvent) {
    evt.preventDefault();

    const nodeType = evt.dataTransfer?.getData(DATA_TYPE);
    if (!nodeType) {
      this.#handleDroppedAssets(evt);
      return;
    }

    this.#createNode(
      nodeType,
      /** create at center */ true,
      evt.clientX - this.#boundsForInteraction.x,
      evt.clientY - this.#boundsForInteraction.y
    );
  }

  #getGraphTitleByType(nodeType: string) {
    // Look up title from the static A2_COMPONENTS registry
    const component = A2_COMPONENTS.find((c) => c.url === nodeType);
    const title = component?.title ?? "Untitled item";

    // Friendly names logic. Optionally appends a number to the title so that
    // the user can disambiguate between multiple steps of the same type.
    let maxNumber = -1;
    for (const node of this.#gc.editor?.inspect("")?.nodes() || []) {
      if (node.descriptor.type !== nodeType) continue;
      const nodeFullTitle = node.descriptor.metadata?.title;
      if (!nodeFullTitle) continue;
      const { nodeTitle, number } = extractNumber(nodeFullTitle);
      if (nodeTitle !== title) continue;
      maxNumber = number;
    }
    if (maxNumber >= 0) {
      return `${title} ${maxNumber + 1}`;
    }

    return title;

    function extractNumber(s: string): { nodeTitle: string; number: number } {
      const match = / (\d+)$/.exec(s);
      if (!match || !match[1]) return { nodeTitle: s, number: 0 };
      const number = parseInt(match[1], 10);
      const nodeTitle = s.substring(0, match.index);
      return { number, nodeTitle };
    }
  }

  #createNode(
    nodeType: string,
    createAtCenter = true,
    x?: number,
    y?: number,
    subGraphId?: GraphIdentifier
  ) {
    let useXandYCoordinatesForSubgraph = true;
    if (!x || !y) {
      // Auto-drop to the middle, don't use the x & y coordinates.
      useXandYCoordinatesForSubgraph = false;

      x =
        this.#boundsForInteraction.width * 0.5 -
        this.#boundsForInteraction.left;
      y =
        this.#boundsForInteraction.height * 0.5 -
        this.#boundsForInteraction.top;
    }

    // Start with finding the natural intersection for the created node if the
    // x & y coordinates were set.
    const addLocation = new DOMRect(x, y, 0, 0);
    let targetGraphId = MAIN_BOARD_ID;
    if (useXandYCoordinatesForSubgraph) {
      for (const [graphId, graph] of this.#graphs) {
        if (graphId === MAIN_BOARD_ID) {
          continue;
        }

        if (graph.intersects(addLocation, 0)) {
          targetGraphId = graphId;
          break;
        }
      }
    }

    // If a subGraph has been provided, use that instead.
    if (subGraphId) {
      targetGraphId = subGraphId;
    }

    const targetGraph = this.#graphs.get(targetGraphId);
    if (!targetGraph) {
      console.warn("Unable to add to graph");
      return;
    }

    let graphLocation = new DOMPoint(x, y).matrixTransform(
      targetGraph.worldTransform.inverse()
    );

    graphLocation.x += targetGraph.transform.e;
    graphLocation.y += targetGraph.transform.f;

    if (Number.isNaN(graphLocation.x) || Number.isNaN(graphLocation.y)) {
      // Set as 130, 20 so that it gets reset to 0, 0 below.
      graphLocation = new DOMPoint(130, 20);
    }

    const id = globalThis.crypto.randomUUID();
    const title = this.#getGraphTitleByType(nodeType);
    const node: NodeDescriptor = {
      id,
      type: nodeType,
      metadata: {
        title,
        visual: {
          x: toGridSize(graphLocation.x - (createAtCenter ? 130 : 0)),
          y: toGridSize(graphLocation.y - (createAtCenter ? 20 : 0)),
        },
      },
    };

    this.dispatchEvent(
      new StateEvent({
        eventType: "node.add",
        node,
        graphId: targetGraphId === MAIN_BOARD_ID ? "" : targetGraphId,
      })
    );
  }

  #dragStart: DOMPoint | null = null;
  #dragRect: DOMRect | null = null;
  #clickRect: DOMRect | null = null;
  #isToggleSelection = false;
  #isAdditiveSelection = false;
  #refocusSelf = false;
  #onPointerDown(evt: PointerEvent) {
    if (this.#editorControls.value) {
      this.#editorControls.value.hidePickers();
    }

    this.#dragStart = new DOMPoint(
      evt.clientX - this.#boundsForInteraction.left,
      evt.clientY - this.#boundsForInteraction.top
    );

    // Middle mouse button.
    if (evt.button === 1) {
      this.interactionMode = "pan";
    }

    if (this.interactionMode === "pan") {
      this.isDragPanning = true;
      return;
    }

    this.#refocusSelf = true;
    this.#dragRect = new DOMRect();
    this.#isToggleSelection = isCtrlCommand(evt);
    this.#isAdditiveSelection = evt.shiftKey;
    this.#updateDragRect(evt);
    this.interactionMode = "selection";
    this.tick++;

    // If the interaction is with the renderer, go into selection mode proper.
    const [top, ...rest] = evt.composedPath();
    if (top !== this) {
      // If the user has clicked on an entity, change the behavior to a click.
      const nearestEntity =
        top instanceof Entity ? top : rest.find((el) => el instanceof Entity);
      if (
        nearestEntity &&
        (!nearestEntity.selected || this.#isToggleSelection)
      ) {
        this.#clickRect = DOMRect.fromRect(this.#dragRect);
        this.#clickRect.x -= 5;
        this.#clickRect.y -= 5;
        this.#clickRect.width = 10;
        this.#clickRect.height = 10;
        this.#dragRect = null;
        return;
      }

      this.interactionMode = "move";
    } else {
      this.setPointerCapture(evt.pointerId);
    }
  }

  #onPointerMove(evt: PointerEvent) {
    // This event informs the Visual Editor's root handler about the last known
    // cursor location for things like copy-paste. We adjust it with the
    // camera's transform before sending it so that they are renderer
    // coordinates rather than screen coordinates.
    const location = new DOMPoint(
      evt.clientX - this.#boundsForInteraction.left,
      evt.clientY - this.#boundsForInteraction.top
    ).matrixTransform(this.camera.transform);
    this.dispatchEvent(
      new EditorPointerPositionChangeEvent(location.x, location.y)
    );

    if (!this.#dragStart) {
      return;
    }

    if (this.interactionMode === "pan") {
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

  #onPointerUp(evt: PointerEvent) {
    this.#dragStart = null;
    this.#dragRect = null;

    if (this.interactionMode !== "pan" || evt.button === 1) {
      this.interactionMode = "inert";
    }
    this.#isAdditiveSelection = false;
    this.#isToggleSelection = false;
    this.camera.baseTransform = null;
    this.isDragPanning = false;

    if (!this.#refocusSelf) {
      return;
    }

    // Because the drag event will trigger a selection change and, with it, a
    // re-render, we will lose focus on the renderer. As such when the pointer
    // comes back up we schedule a focus call to restore it.
    requestAnimationFrame(() => {
      this.#refocusSelf = false;
      this.focus();
    });

    // Right mouse button - show delete option.
    const isOnControls = evt
      .composedPath()
      .some((el) => el === this.#editorControls.value);

    const hasSelections = this.sca.controller.editor.selection
      ? this.sca.controller.editor.selection.size > 0
      : false;

    if (evt.button !== 2 || isOnControls || !hasSelections) {
      return;
    }

    // Trigger the overflow menu.
    this.#selectionOverflowMenu = { x: evt.clientX, y: evt.clientY };
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

    // Only allow pan-drag and zoom when there are no other actions going on.
    if (this.interactionMode !== "inert") {
      return;
    }

    if (isCtrlCommand(evt) || evt.ctrlKey) {
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

  // NOTE: shouldUpdate is intentionally NOT overridden. The old guard
  // skipped re-renders when selectionState was the sole changed Lit property.
  // Now that selection is signal-driven, willUpdate's #lastSeenSelectionId
  // check handles skipping redundant inbound pushes instead.

  protected willUpdate(changedProperties: PropertyValues<this>): void {
    if (this.#fitToViewPre) {
      this.#fitToViewPre = false;
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

    const sel = this.sca.controller.editor.selection;
    if (sel && sel.selectionId !== this.#lastSeenSelectionId) {
      this.#lastSeenSelectionId = sel.selectionId;

      // Inbound: read from SelectionController (source of truth) and push to
      // Graph entities. Since the controller uses a flat model (no per-graph
      // partitioning), we pass the full selection to each Graph. Each Graph's
      // setter only applies selection to its own entities.
      const selection = sel.selection;
      const flatSelection = createEmptyGraphSelectionState();
      for (const id of selection.nodes) flatSelection.nodes.add(id);
      for (const id of selection.edges) flatSelection.edges.add(id as string);
      for (const id of selection.assets) flatSelection.assets.add(id);
      for (const id of selection.assetEdges)
        flatSelection.assetEdges.add(id as string);

      for (const [, graph] of this.#graphs) {
        graph.selectionState = flatSelection;

        // Expands node selections to include edges.
        if (this.expandSelections) {
          graph.expandSelections();
        }
      }
    }

    // Graph topology setup — runs when the graph version changes.
    const graph = this.#gc.editor?.inspect("") ?? null;
    const graphVersion = this.#gc.version;
    if (graph && this.camera && graphVersion !== this.#lastGraphVersion) {
      this.#lastGraphVersion = graphVersion;
      const graphUrl = new URL(graph.raw().url ?? window.location.href);

      // Main graph.
      let mainGraph = this.#graphs.get(MAIN_BOARD_ID);
      if (!mainGraph) {
        mainGraph = new Graph(MAIN_BOARD_ID);
        this.#graphs.set(MAIN_BOARD_ID, mainGraph);
      }

      // When going from an empty main graph to something populated ensure that
      // we re-center the graph to the view.
      const entitiesBefore = mainGraph.nodes.length + mainGraph.assets.size;
      const entitiesAfter = graph.nodes().length + graph.assets().size;
      if (entitiesBefore === 0 && entitiesAfter > 0) {
        this.#fitToViewPost = true;
      }

      const runtimeFlags = this.sca.controller.global.flags;
      if (runtimeFlags) {
        mainGraph.force2D = runtimeFlags.force2DGraph;
      }

      mainGraph.url = graphUrl;
      mainGraph.boundsLabel = graph.raw().title ?? "Untitled";
      mainGraph.nodes = graph.nodes();
      mainGraph.edges = graph.edges();
      mainGraph.graphAssets = this.#gc.graphAssets;
      mainGraph.readOnly = this.#gc.readOnly;

      mainGraph.assets = new Map(
        Array.from(graph.assets().entries()).filter(
          ([, asset]) => asset.type !== "connector"
        )
      );
      mainGraph.assetEdges = graph.assetEdges();

      mainGraph.allowEdgeAttachmentMove = this.allowEdgeAttachmentMove;
      mainGraph.resetTransform();

      // Subgraphs.
      for (const [id, subGraphData] of Object.entries(graph.graphs() ?? {})) {
        if (subGraphData.nodes().length === 0) {
          continue;
        }

        let subGraph = this.#graphs.get(id);
        if (!subGraph) {
          subGraph = new Graph(id);
          this.#graphs.set(id, subGraph);
        }

        subGraph.url = graphUrl;
        subGraph.boundsLabel = subGraphData.raw().title ?? "Custom Tool";
        subGraph.nodes = subGraphData.nodes();
        subGraph.edges = subGraphData.edges();
        subGraph.graphAssets = this.#gc.graphAssets;
        subGraph.readOnly = this.#gc.readOnly;

        subGraph.allowEdgeAttachmentMove = this.allowEdgeAttachmentMove;
        subGraph.resetTransform();
      }

      // Remove any stale graphs.
      const subGraphs = graph.graphs() ?? {};
      for (const graphId of this.#graphs.keys()) {
        if (graphId === MAIN_BOARD_ID || subGraphs[graphId]) {
          continue;
        }

        this.#graphs.delete(graphId);
      }

      // Update disclaimer.
      this.showDisclaimer = graph.nodes().length !== 0;
    }

    if (
      changedProperties.has("runState") ||
      changedProperties.has("runStateEffect")
    ) {
      const mainGraph = this.#graphs.get(MAIN_BOARD_ID);
      const runState = this.runState;
      if (mainGraph) {
        mainGraph.highlightActivity(runState);
      }
    }

    if (
      (changedProperties.has("tick") ||
        changedProperties.has("_boundsDirty") ||
        changedProperties.has("interactionMode")) &&
      graph &&
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
            graph.selectAt(
              this.#clickRect,
              0,
              this.#isAdditiveSelection,
              this.#isToggleSelection
            );
          }

          // Expands node selections to include edges.
          if (this.expandSelections) {
            graph.expandSelections();
          }

          this.#updateSelectionFromGraph();
        }

        if (this.camera?.bounds) {
          graph.cullOutsideOf(this.camera.bounds, this.cullPadding);
        }
      }
    }

    this.#clickRect = null;
    this._boundsDirty.clear();
  }

  protected updated(_changedProperties: PropertyValues): void {
    if (!this.#fitToViewPost) {
      return;
    }

    this.#fitToViewPost = false;
    requestAnimationFrame(() => {
      this.fitToView(false, /* retryOnEmpty */ true);
    });
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

  zoom(animated = false, requestedDelta = 0) {
    const currentScale = this.camera.transform.a;
    const newScale = currentScale * (1 - requestedDelta);

    let delta = currentScale / newScale;
    if (
      currentScale * delta < this.minScale ||
      currentScale * delta > this.maxScale
    ) {
      delta = 1;
    }

    const targetMatrix = this.camera.transform.translate(0, 0); // Clone.
    const offsetX =
      this.#boundsForInteraction.width * 0.5 - this.#boundsForInteraction.x;
    const offsetY =
      this.#boundsForInteraction.height * 0.5 - this.#boundsForInteraction.y;

    targetMatrix.translateSelf(offsetX, offsetY);
    targetMatrix.scaleSelf(delta, delta);
    targetMatrix.translateSelf(-offsetX, -offsetY);

    this.#updateCamera(animated, targetMatrix);
  }

  fitToView(animated = true, retryOnEmpty = false) {
    if (!this.#graphs || !this.#boundsForInteraction || !this.camera) {
      return;
    }

    const allGraphBounds = calculateBounds(this.#graphs);
    if (allGraphBounds.width === 0) {
      if (retryOnEmpty) {
        requestAnimationFrame(() => {
          this.fitToView(animated);
        });
      }
      return;
    }

    const targetMatrix = this.#calculateCameraMatrixFromBounds(allGraphBounds);
    this.#updateCamera(animated, targetMatrix);
  }

  #updateCamera(animated = false, targetMatrix: DOMMatrix) {
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

    if (delta <= 0) {
      return targetMatrix;
    }

    const invDelta = clamp(1 / delta, this.minScale, this.maxScale);
    const pivot = new DOMPoint(
      this.#boundsForInteraction.width * 0.5,
      this.#boundsForInteraction.height * 0.5
    );

    targetMatrix
      // We adjust up here because the controls at the top of the view are
      // slightly smaller than the controls at the bottom. So this small
      // adjustment means that when we zoom to fit it looks a little neater.
      .translateSelf(0, 28)

      // Now do the rest of the calculations.
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

  #applyMoveToSelection(
    eventX: number,
    eventY: number,
    deltaX: number,
    deltaY: number,
    hasSettled: boolean
  ) {
    if (!this.#gc.editor?.inspect("")) {
      return;
    }

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    let moveGraph = this.#graphs.get(MOVE_GRAPH_ID);
    if (!moveGraph) {
      moveGraph = new Graph(MOVE_GRAPH_ID);

      // Collect selected nodes from Graph entity flags (already in sync with
      // SelectionController from the inbound path).
      const nodes: InspectableNode[] = [];
      for (const [graphId, graph] of this.#graphs) {
        if (graphId === MOVE_GRAPH_ID) continue;
        const graphSel = graph.selectionState;
        if (!graphSel) continue;
        for (const node of graphSel.nodes) {
          const inspectableGraph = this.#gc.editor?.inspect("");
          const targetGraph =
            graphId === MAIN_BOARD_ID
              ? inspectableGraph
              : inspectableGraph?.graphs()?.[graphId];
          if (!targetGraph) continue;

          const inspectableNode = targetGraph.nodeById(node);
          if (inspectableNode) nodes.push(inspectableNode);
        }
      }

      moveGraph.nodes = nodes;
      this.#graphs.set(MOVE_GRAPH_ID, moveGraph);
      this.tick++;
    }

    moveGraph.applyTranslationToNodes(deltaX, deltaY, hasSettled);

    if (hasSettled) {
      this.#graphs.delete(MOVE_GRAPH_ID);

      // Finding the natural intersection for the selection.
      const x = eventX - this.#boundsForInteraction.x;
      const y = eventY - this.#boundsForInteraction.y;
      const addLocation = new DOMRect(x, y, 0, 0);
      let targetGraphId = MAIN_BOARD_ID;
      for (const [graphId, graph] of this.#graphs) {
        if (graphId === MAIN_BOARD_ID) {
          continue;
        }

        if (graph.intersects(addLocation, 0)) {
          targetGraphId = graphId;
          break;
        }
      }

      // Flatten the selection down from Graph entity flags.
      const moveNodes = new Map<GraphIdentifier, NodeIdentifier[]>();
      for (const [graphId, graph] of this.#graphs) {
        if (graphId === MOVE_GRAPH_ID) continue;
        const graphSel = graph.selectionState;
        if (!graphSel || graphSel.nodes.size === 0) continue;

        const moveNodeGraphItems: NodeIdentifier[] = [];
        for (const node of graphSel.nodes) {
          moveNodeGraphItems.push(node);
        }
        moveNodes.set(graphId, moveNodeGraphItems);
      }

      this.dispatchEvent(
        new MoveNodesEvent(
          moveNodes,
          targetGraphId,
          new DOMPoint(deltaX, deltaY)
        )
      );
    }
  }

  #applyTranslationToSelection(x: number, y: number, hasSettled: boolean) {
    // Apply translation to all graphs — each graph's
    // applyTranslationToSelection only affects its own selected entities.
    for (const [graphId, graph] of this.#graphs) {
      if (graphId === MOVE_GRAPH_ID) continue;
      graph.applyTranslationToSelection(x, y, hasSettled);
    }

    // When the dragging settles, send out the update on all the node locations
    // so they can be persisted.
    const hasMoved = x !== 0 || y !== 0;
    if (hasSettled && hasMoved) {
      this.#emitSettledLocationEdits();
    }
  }

  #emitSettledLocationEdits() {
    const edits: {
      type: "node" | "asset";
      id: string;
      graphId: string;
      x: number;
      y: number;
    }[] = [];

    // Read from Graph entity flags (already in sync with SelectionController).
    for (const [graphId, graph] of this.#graphs) {
      if (graphId === MOVE_GRAPH_ID) continue;
      const graphSelection = graph.selectionState;
      if (!graphSelection) continue;

      for (const nodeId of graphSelection.nodes) {
        const graphNode = graph.nodes.find(
          (node) => node.descriptor.id === nodeId
        );
        const graphNodeEntity = graph.entities.get(nodeId);
        if (!graphNode || !graphNodeEntity) {
          continue;
        }

        const editGraphId = graphId === MAIN_BOARD_ID ? "" : graphId;
        edits.push({
          type: "node",
          id: nodeId,
          graphId: editGraphId,
          x: toGridSize(graph.transform.e + graphNodeEntity.transform.e),
          y: toGridSize(graph.transform.f + graphNodeEntity.transform.f),
        });
      }

      if (!graphSelection) continue;
      for (const assetPath of graphSelection.assets) {
        const graphAssetEntity = graph.entities.get(assetPath);
        if (!graphAssetEntity) {
          continue;
        }

        const editGraphId = graphId === MAIN_BOARD_ID ? "" : graphId;
        edits.push({
          type: "asset",
          id: assetPath,
          graphId: editGraphId,
          x: toGridSize(graph.transform.e + graphAssetEntity.transform.e),
          y: toGridSize(graph.transform.f + graphAssetEntity.transform.f),
        });
      }
    }

    this.dispatchEvent(
      new StateEvent({
        eventType: "node.moveselection",
        updates: edits,
      })
    );
  }

  #updateSelectionFromGraph(createNewSelection = false) {
    // --- Outbound: write to SelectionController ---
    if (this.sca.controller.editor.selection) {
      const sel = this.sca.controller.editor.selection;
      if (!this.#isAdditiveSelection || createNewSelection) {
        sel.deselectAll();
      }

      // Sync the full state from all graphs' entity flags.
      for (const [gId, g] of this.#graphs) {
        if (gId === MOVE_GRAPH_ID) continue;
        const graphSel = g.selectionState;
        if (!graphSel) continue;
        for (const nodeId of graphSel.nodes) sel.addNode(nodeId);
        for (const edgeId of graphSel.edges)
          sel.addEdge(edgeId as EdgeIdentifier);
        for (const assetId of graphSel.assets) sel.addAsset(assetId);
        for (const assetEdgeId of graphSel.assetEdges)
          sel.addAssetEdge(assetEdgeId as AssetEdgeIdentifier);
      }

      this.#lastSeenSelectionId = sel.selectionId;
    }

    // NOTE: Legacy bridge removed. Entity-editor and canvas-controller
    // now read directly from SelectionController via SCA.
  }

  #maybeRenderOverflowMenu() {
    if (!this.#selectionOverflowMenu) {
      return nothing;
    }

    return html`<bb-item-select
      style=${styleMap({
        [`--left`]: `${this.#selectionOverflowMenu.x.toFixed(0)}px`,
        [`--top`]: `${this.#selectionOverflowMenu.y.toFixed(0)}px`,
      })}
      .autoActivate=${true}
      .values=${[
        {
          id: "placeholder",
          title: "Placeholder",
          icon: "delete",
          hidden: true,
        },
        {
          id: "delete",
          title: "Delete selection",
          icon: "delete",
        },
        {
          id: "duplicate",
          title: "Duplicate selection",
          icon: "content_copy",
        },
      ]}
      @close=${() => {
        this.#selectionOverflowMenu = null;
      }}
      @change=${(evt: Event) => {
        const [select] = evt.composedPath();
        if (!(select instanceof ItemSelect)) {
          return;
        }

        this.#selectionOverflowMenu = null;
        switch (select.value) {
          case "delete": {
            // There is already a keyboard shortcut for handling deletions so
            // we redirect this action to the same endpoint in the Visual Editor
            // root.
            this.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Delete",
                bubbles: true,
                cancelable: true,
                composed: true,
              })
            );
            break;
          }

          case "duplicate": {
            // There is already a keyboard shortcut for handling duplications so
            // we redirect this action to the same endpoint in the Visual Editor
            // root.
            this.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "d",
                ctrlKey: !isMacPlatform(),
                metaKey: isMacPlatform(),
                bubbles: true,
                cancelable: true,
                composed: true,
              })
            );
            break;
          }

          default: {
            console.log("Init", select.value);
            break;
          }
        }
      }}
    ></bb-item-select>`;
  }

  render() {
    if (!this.#graphs || !this.camera) {
      return nothing;
    }

    const inspectableGraph = this.#gc.editor?.inspect("") ?? null;
    const hasNoAssets = (inspectableGraph?.assets() ?? new Map()).size === 0;
    const hasNoSubGraphs =
      Object.keys(inspectableGraph?.graphs() ?? {}).length === 0;
    const subGraphsAreEmpty = Object.values(
      inspectableGraph?.graphs() ?? {}
    ).every((graph) => graph.nodes().length === 0);
    const showDefaultAdd =
      inspectableGraph?.nodes().length === 0 &&
      hasNoAssets &&
      (hasNoSubGraphs || subGraphsAreEmpty);

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
        ([graphId]) => graphId,
        ([graphId, graph]) => {
          if (!this.camera) {
            return nothing;
          }

          graph.showBounds = this.debug;

          return html`<div
            @bbnodeconfigurationrequest=${(
              evt: NodeConfigurationRequestEvent
            ) => {
              this.dispatchEvent(
                new NodeConfigurationUpdateRequestEvent(
                  evt.nodeId,
                  graphId === MAIN_BOARD_ID ? "" : graphId,
                  null,
                  null,
                  undefined,
                  undefined,
                  false,
                  evt.bounds
                )
              );
            }}
            @bbdragconnectorstart=${(evt: DragConnectorStartEvent) => {
              this.dragConnector.offset = new DOMPoint(
                this.#boundsForInteraction.x,
                this.#boundsForInteraction.y
              );

              this.dragConnector.start = evt.location;
              this.dragConnector.connectorType = evt.connectorType;

              if (evt.connectorType === "node") {
                const { nodeId, graphId, portId } = collectNodeIds(evt, "out");
                if (!nodeId || !graphId || !portId) {
                  console.warn(
                    "Unable to connect - no node/graph/port combination found"
                  );
                  return;
                }

                this.dragConnector.graphId = graphId;
                this.dragConnector.nodeId = nodeId;
                this.dragConnector.portId = portId;
              } else if (evt.connectorType === "asset") {
                const { graphId, assetPath } = collectAssetIds(evt);
                this.dragConnector.graphId = graphId;
                this.dragConnector.assetPath = assetPath;
              }
            }}
            @bbselectgraphcontents=${(evt: SelectGraphContentsEvent) => {
              const graph = this.#graphs.get(evt.graphId);
              if (!graph) {
                return;
              }

              this.#updateSelectionFromGraph(true);
            }}
            @bbselectionmove=${(evt: SelectionMoveEvent) => {
              this.#applyMoveToSelection(
                evt.eventX,
                evt.eventY,
                evt.deltaX,
                evt.deltaY,
                evt.hasSettled
              );
            }}
            @bbselectiontranslate=${(evt: SelectionTranslateEvent) => {
              if (this.interactionMode === "pan") {
                return;
              }

              this.#applyTranslationToSelection(evt.x, evt.y, evt.hasSettled);

              this._boundsDirty = new Set([
                ...this._boundsDirty,
                graph.boundsLabel,
              ]);
            }}
            @bbgraphedgeattachmentmove=${(
              evt: GraphEdgeAttachmentMoveEvent
            ) => {
              this.dispatchEvent(
                new StateEvent({
                  eventType: "node.changeedgeattachmentpoint",
                  graphId,
                  edge: evt.edge,
                  which: evt.which,
                  attachmentPoint: evt.value,
                })
              );
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
      html`<bb-editor-controls
        ${ref(this.#editorControls)}
        .graph=${inspectableGraph}
        .graphIsMine=${!this.#gc.readOnly}
        .history=${this.#gc.editor?.history() ?? null}
        .mainGraphId=${this.#gc.mainGraphId}
        .showDefaultAdd=${showDefaultAdd}
        .readOnly=${!!this.#gc.readOnly}
        @wheel=${(evt: WheelEvent) => {
          evt.stopImmediatePropagation();
        }}
        @bbnodeadd=${(evt: NodeAddEvent) => {
          this.#createNode(
            evt.nodeType,
            evt.createAtCenter,
            evt.x,
            evt.y,
            evt.subGraphId
          );
        }}
        @bbzoomin=${(evt: ZoomInEvent) => {
          this.zoom(evt.animate, -0.25);
        }}
        @bbzoomout=${(evt: ZoomOutEvent) => {
          this.zoom(evt.animate, 0.25);
        }}
        @bbzoomtofit=${(evt: ZoomToFitEvent) => {
          this.fitToView(evt.animate);
        }}
        @bbcreatenewasset=${(evt: CreateNewAssetsEvent) => {
          this.#handleNewAssets(evt);
        }}
      ></bb-editor-controls>`,
      this.camera,
      html`<div
        id="overlay"
        class=${classMap({ active: this.cullPadding < 0 })}
      ></div>`,
      selectionRectangle,
      this.dragConnector,
      this.showDisclaimer && !this.#gc.readOnly
        ? html`<p
            id="disclaimer"
            class=${this.sca.controller.global.flags.enableGraphEditorAgent
              ? "under-chat"
              : ""}
          >
            ${Strings.from("LABEL_DISCLAIMER")}
          </p>`
        : nothing,
      this.#maybeRenderOverflowMenu(),
    ];
  }
}

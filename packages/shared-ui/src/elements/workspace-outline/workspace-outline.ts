/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  GraphIdentifier,
  InspectableGraph,
  InspectableModule,
  InspectableNode,
  InspectableNodePorts,
  InspectablePort,
  NodeIdentifier,
  UnresolvedPathBoardCapability,
} from "@google-labs/breadboard";
import { LitElement, html, css, nothing, HTMLTemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import {
  BoardChosenEvent,
  BoardItemCopyEvent,
  ModuleDeleteEvent,
  NodeConfigurationUpdateRequestEvent,
  NodePartialUpdateEvent,
  OverflowMenuActionEvent,
  SubGraphDeleteEvent,
  WorkspaceSelectionStateEvent,
  WorkspaceItemVisualUpdateEvent,
  DragConnectorStartEvent,
  ShowTooltipEvent,
  HideTooltipEvent,
} from "../../events/events";
import { MAIN_BOARD_ID } from "../../constants/constants";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import { styleMap } from "lit/directives/style-map.js";
import { getSubItemColor } from "../../utils/subgraph-color";
import {
  isBoardArrayBehavior,
  isBoardBehavior,
  isConfigurableBehavior,
  isModuleBehavior,
} from "../../utils";
import { ModuleIdentifier } from "@breadboard-ai/types";
import {
  DragConnectorReceiver,
  OverflowAction,
  WorkspaceSelectionChangeId,
  WorkspaceSelectionStateWithChangeId,
  WorkspaceVisualChangeId,
} from "../../types/types";
import * as Utils from "../../utils/utils.js";

const OPEN_ITEMS_KEY = "bb-workspace-outline-open-items";
const OVERFLOW_MENU_CLEARANCE = 140;

type ItemIdentifier = GraphIdentifier | ModuleIdentifier;

interface Outline {
  main?: string;
  title: string;
  items: {
    nodes: InspectableNode[];
    ports: Map<NodeIdentifier, InspectableNodePorts>;
  };
  type: "imperative" | "declarative";
  runnable?: boolean;
  minimized?: boolean;
  subItems: Map<ItemIdentifier, Outline>;
}

interface OverflowMenu {
  type: "declarative" | "imperative";
  target: string | null;
  actions: OverflowAction[];
  location: { x: number; y: number };
}

@customElement("bb-workspace-outline")
export class WorkspaceOutline
  extends LitElement
  implements DragConnectorReceiver
{
  @property()
  graph: InspectableGraph | null = null;

  @property()
  renderId = "";

  @property({ reflect: true })
  mode = "tree" as const;

  @property()
  selectionState: WorkspaceSelectionStateWithChangeId | null = null;

  @property()
  graphStoreUpdateId: number = 0;

  @property({ reflect: true })
  showBoardReferenceMarkers = false;

  @state()
  filter: string | null = null;

  @state()
  private showOverflowMenu = false;
  #overflowMenu: OverflowMenu = {
    type: "declarative",
    target: null,
    actions: [],
    location: { x: 0, y: 0 },
  };

  #setOverflowMenuValues(config: Partial<OverflowMenu>) {
    this.#overflowMenu = { ...this.#overflowMenu, ...config };
    if (
      this.#overflowMenu.location.y >
      window.innerHeight - OVERFLOW_MENU_CLEARANCE
    ) {
      this.#overflowMenu.location.y =
        window.innerHeight - OVERFLOW_MENU_CLEARANCE;
    }
  }

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      background: var(--bb-neutral-0);
      min-width: 260px;
      height: 100%;
      overflow: hidden;
    }

    h1 {
      font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
        var(--bb-font-family);
      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size) 0;
    }

    #controls {
      height: var(--bb-grid-size-12);
      padding: var(--bb-grid-size-2);
      display: grid;
      grid-template-columns: 1fr min-content;
      column-gap: var(--bb-grid-size-2);
    }

    #controls input[type="text"],
    #controls input[type="search"],
    #controls select,
    #controls textarea {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
    }

    #controls input[type="search"]:focus {
      outline: none;
      box-shadow: inset 0 0 0 4px var(--bb-ui-50);
    }

    #controls #view-toggle {
      width: 60px;
      font-size: 0;
      border: 1px solid var(--bb-neutral-300);
      border-radius: var(--bb-grid-size);
      padding: 0;
      background: var(--bb-neutral-0);
      position: relative;
      cursor: pointer;
    }

    #controls #view-toggle::after {
      content: "";
      display: block;
      width: 100%;
      height: 100%;
      background: transparent;
      background-image: var(--bb-icon-list), var(--bb-icon-tree);
      background-position:
        4px center,
        34px center;
      background-size:
        20px 20px,
        20px 20px;
      background-repeat: no-repeat, no-repeat;
      position: relative;
    }

    #controls #view-toggle::before {
      content: "";
      display: block;
      width: calc(50% - 1px);
      height: 100%;
      background: var(--bb-ui-50);
      position: absolute;
      border-radius: var(--bb-grid-size) 0 0 var(--bb-grid-size);
      border-right: 1px solid var(--bb-neutral-300);
    }

    #controls #view-toggle.tree::before {
      left: 50%;
      border-radius: 0 var(--bb-grid-size) var(--bb-grid-size) 0;
      border-left: 1px solid var(--bb-neutral-300);
      border-right: none;
    }

    #container {
      overflow: auto;
      height: 100%;
    }

    #outline {
      height: calc(100% - 92px);
      overflow-x: hidden;
      overflow-y: scroll;
      padding: 0 var(--bb-grid-size-2);
      font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
        var(--bb-font-family);
      user-select: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary {
      list-style: none;
    }

    details.declarative,
    details.imperative {
      margin-bottom: var(--bb-grid-size);
    }

    details.declarative:last-of-type,
    details.imperative:last-of-type {
      margin-bottom: var(--bb-grid-size-5);
    }

    details.declarative summary,
    details.imperative summary {
      height: var(--bb-grid-size-7);
      display: flex;
      align-items: center;
    }

    details > summary {
      padding-right: var(--bb-grid-size-14);
      cursor: pointer;
      background: var(--bb-icon-unfold-more) calc(100% - 4px) center / 20px 20px
        no-repeat;
    }

    details[open] > summary {
      background: var(--bb-icon-unfold-less) calc(100% - 4px) center / 20px 20px
        no-repeat;
    }

    ul {
      margin: 0 0 0 var(--bb-grid-size-3);
      padding: 0;
      border-left: 1px solid var(--bb-neutral-300);
      list-style: none;
    }

    ul.ports {
      border-left: 1px solid transparent;
      position: relative;
      margin: 0 0 0 var(--bb-grid-size-2);
    }

    ul.ports::before {
      content: "";
      position: absolute;
      left: 0;
      width: 1px;
      height: calc(100% - var(--bb-grid-size-3));
      background: var(--bb-neutral-300);
      padding: 0;
    }

    li {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: var(--bb-grid-size) 0;
      padding: 0 0 0 var(--bb-grid-size-3);
      position: relative;
    }

    li.with-preview {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    li:has(> div > ul):last-of-type::after {
      content: "";
      background: var(--bb-neutral-0);
      width: 3px;
      top: 9px;
      height: calc(100% - 10px);
      position: absolute;
      left: -1px;
    }

    li.subgraph {
      display: flex;
      align-items: center;
    }

    li.port {
      position: relative;
      padding: 0 0 0 var(--bb-grid-size-6);
    }

    li.port::before {
      content: "";
      height: 1px;
      top: 8px;
      width: var(--bb-grid-size-4);
      background: var(--bb-neutral-300);
      position: absolute;
      left: 0;
    }

    li.port > .title::before {
      content: "";
      width: 8px;
      height: 8px;
      border: 1px solid var(--bb-neutral-500);
      background: var(--bb-neutral-0);
      border-radius: 50%;
      margin-right: var(--bb-grid-size);
      display: inline-block;
      pointer-events: none;
    }

    li.port > .title::before {
      margin-right: var(--bb-grid-size-2);
    }

    li.port > .title:has(.port-item)::before {
      margin-right: 0;
    }

    li.node > .title > .node-item,
    li.port > .title > .port-item {
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border: none;
      background: var(--bb-neutral-0);
      height: var(--bb-grid-size-5);
      border-radius: var(--bb-grid-size);
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
      padding: 0 var(--bb-grid-size);
      display: inline-block;
      line-height: var(--bb-grid-size-5);
      cursor: pointer;
    }

    li.node > .title > .node-item.selected {
      background: var(--bb-ui-600);
      color: var(--bb-neutral-0);
    }

    li.port > .title > button.port-item:hover,
    li.port > .title > button.port-item:focus {
      background: var(--bb-ui-50);
    }

    li.port.connected > .title::before {
      background: var(--bb-input-200);
      border: 1px solid var(--bb-input-600);
    }

    li.port.connected.configured > .title::before {
      background: var(--bb-ui-300);
      border: 1px solid var(--bb-ui-600);
    }

    :host([showBoardReferenceMarkers="true"]) li.port.board > .title::after {
      content: "";
      width: var(--bb-grid-size-2);
      height: calc(var(--bb-grid-size-2) - 1px);
      left: 22px;
      top: 3px;
      border: 3px solid transparent;
      border-radius: 50%;
      box-shadow: 0 0 0 3px var(--bb-joiner-500);
      position: absolute;
      pointer-events: none;
    }

    li.port.missing > .title::before {
      background: var(--bb-warning-300);
      border: 1px solid var(--bb-warning-700);
    }

    li.node > .title {
      display: flex;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      position: relative;
    }

    li.node > .title::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 20px 20px
        no-repeat;
      display: inline-block;
      margin-right: var(--bb-grid-size);
      flex: 0 0 auto;
      pointer-events: none;
    }

    li.node.input > .title::before {
      background: transparent var(--bb-icon-input) center center / 20px 20px
        no-repeat;
    }

    li.node.specialist > .title::before,
    li.node.model > .title::before {
      background: transparent var(--bb-icon-smart-toy) center center / 20px 20px
        no-repeat;
    }

    li.node.output > .title::before {
      background: transparent var(--bb-icon-output) center center / 20px 20px
        no-repeat;
    }

    li.node.runModule > .title::before {
      background: transparent var(--bb-icon-extension) center center / 20px 20px
        no-repeat;
    }

    li.node.runJavascript > .title::before {
      background: transparent var(--bb-icon-javascript) center center / 20px
        20px no-repeat;
    }

    li.node.content > .title::before {
      background: transparent var(--bb-icon-code-blocks) center center / 20px
        20px no-repeat;
    }

    li.node.secrets > .title::before {
      background: transparent var(--bb-icon-secrets) center center / 20px 20px
        no-repeat;
    }

    li.node.human > .title::before {
      background: transparent var(--bb-icon-human) center -1px / 20px 20px
        no-repeat;
    }

    li.node.urlTemplate > .title::before {
      background: transparent var(--bb-icon-http) center -1px / 20px 20px
        no-repeat;
    }

    li.node.fetch > .title::before {
      background: transparent var(--bb-icon-fetch) center -1px / 20px 20px
        no-repeat;
    }

    li.node.jsonata > .title::before {
      background: transparent var(--bb-icon-jsonata) center -1px / 20px 20px
        no-repeat;
    }

    li.node.joiner > .title::before {
      background: transparent var(--bb-icon-merge-type) center -1px / 20px 20px
        no-repeat;
    }

    .change-subitem:not(.main) {
      color: var(--bb-neutral-800);
      align-items: center;
      background: var(--bb-neutral-0);
      border: none;
      border-radius: var(--bb-grid-size);
      cursor: pointer;
      padding: 0 var(--bb-grid-size) 0 var(--bb-grid-size-7);
      height: var(--bb-grid-size-7);
      text-align: left;
      transition: background 0.1s cubic-bezier(0, 0, 0.3, 1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: calc(100% - 44px);
      position: relative;
    }

    .change-subitem:hover,
    .change-subitem:focus {
      background: var(--bb-ui-50);
    }

    .change-subitem.inverted:hover,
    .change-subitem.inverted:focus {
      color: var(--bb-neutral-0);
    }

    .change-subitem[disabled] {
      background: var(--bb-ui-50);
      cursor: default;
    }

    .declarative > summary > .title::before,
    .imperative > summary > .title::before {
      content: "";
      width: var(--bb-grid-size-5);
      height: var(--bb-grid-size-5);
      background: transparent var(--bb-icon-board) center center / 16px 16px
        no-repeat;
      display: inline-block;
      margin-right: var(--bb-grid-size);
      border-radius: var(--bb-grid-size);
      flex: 0 0 auto;
      position: absolute;
      top: var(--bb-grid-size);
      left: var(--bb-grid-size);
    }

    .imperative > summary > .title::before {
      background-image: var(--bb-icon-code);
    }

    .imperative.runnable > summary > .title::before {
      background-image: var(--bb-icon-extension);
    }

    .title {
      height: var(--bb-grid-size-5);
      flex: 0 0 auto;
    }

    summary > .title {
      border: none;
      background: transparent;
      padding: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: var(--bb-grid-size-2);
      padding-left: var(--bb-grid-size-7);
      position: relative;
      text-align: left;
      cursor: pointer;
      width: 100%;
      height: 100%;
      border-radius: var(--bb-grid-size);
    }

    details:not(.main) summary:hover > .title,
    details:not(.main) summary > .title:hover {
      width: calc(100% - 36px);
    }

    details:not(.main) summary:hover > .title:not(.selected),
    details:not(.main) summary > .title:not(.selected):hover {
      background: var(--bb-ui-50);
    }

    summary > .title.selected {
      background: var(--bb-ui-600);
      color: var(--bb-neutral-0);
    }

    .title:has(> .change-subitem) {
      height: var(--bb-grid-size-7);
    }

    .preview {
      font: 400 italic var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-500);
      margin-left: var(--bb-grid-size-2);
    }

    #create-new {
      margin-bottom: var(--bb-grid-size-3);
    }

    .create-new-board {
      border-radius: var(--bb-grid-size-6);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      background: var(--bb-neutral-0) var(--bb-icon-add-circle) 6px center /
        16px 16px no-repeat;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-900);
      cursor: pointer;
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
      border: 1px solid var(--bb-neutral-300);
    }

    .create-new-board:hover,
    .create-new-board:focus {
      background-color: var(--bb-neutral-50);
    }

    .create-new-module {
      border-radius: var(--bb-grid-size-6);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      background: var(--bb-neutral-0) var(--bb-icon-add-circle) 6px center /
        16px 16px no-repeat;
      height: var(--bb-grid-size-6);
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-6);
      color: var(--bb-neutral-900);
      cursor: pointer;
      transition: background-color 0.1s cubic-bezier(0, 0, 0.3, 1);
      border: 1px solid var(--bb-neutral-300);
    }

    .create-new-module:hover,
    .create-new-module:focus {
      background-color: var(--bb-neutral-50);
    }

    .color {
      display: flex;
      margin-left: var(--bb-grid-size);
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .color::before {
      content: "";
      background: var(--subgraph-label-color, red);
      border-radius: 50%;
      width: 10px;
      height: 10px;
    }

    .color.reference {
      background: var(--subgraph-label-color, red)
        var(--bb-icon-drag-click-inverted) center center / 16px 16px no-repeat;
      width: 20px;
      height: 20px;
      cursor: crosshair;
    }

    .color.reference::before {
      display: none;
    }

    .more {
      height: var(--bb-grid-size-7);
      width: var(--bb-grid-size-7);
      border: none;
      background: transparent var(--bb-icon-more-vert) center center / 20px 20px
        no-repeat;
      font-size: 0;
      flex: 0 0 auto;
      margin: 0 var(--bb-grid-size);
      display: none;
      cursor: pointer;
      border-radius: 50%;
      transition: background 0.1s cubic-bezier(0, 0, 0.3, 1);
    }

    summary:hover .more,
    .more:hover {
      display: block;
    }

    .more:hover,
    .more:focus {
      background-color: var(--bb-neutral-50);
    }

    .no-items {
      padding: var(--bb-grid-size-2) var(--bb-grid-size-3);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      font-style: italic;
      color: var(--bb-neutral-700);
    }

    bb-overflow-menu {
      position: fixed;
      z-index: 100;
      right: auto;
      bottom: auto;
    }
  `;

  #openItems = new Set<string>();
  #containerRef: Ref<HTMLDivElement> = createRef();

  #createSubItemId(id: string) {
    return `sg-${id}`;
  }

  isOnDragConnectorTarget(x: number, y: number): string | null {
    if (!this.shadowRoot) {
      return null;
    }

    const el = this.shadowRoot.elementFromPoint(x, y);
    if (!(el instanceof HTMLElement)) {
      return null;
    }

    let target: HTMLElement | null = el;
    do {
      if (
        target.dataset.dragConnectorTargetGraph &&
        target.dataset.dragConnectorTargetNode &&
        target.dataset.dragConnectorTargetPort
      ) {
        return `${target.dataset.dragConnectorTargetGraph}|${target.dataset.dragConnectorTargetNode}|${target.dataset.dragConnectorTargetPort}`;
      }

      target = target.parentElement;
    } while (target);

    return null;
  }

  highlight(_x: number, _y: number): void {
    // TODO.
    return;
  }

  removeHighlight(_x: number, _y: number): void {
    // TODO.
    return;
  }

  #getGraphDetails(graph: InspectableGraph) {
    const moduleToOutline = (
      id: ModuleIdentifier,
      module: InspectableModule
    ): Outline => {
      return {
        type: "imperative",
        title: module.metadata().title ?? id,
        items: {
          nodes: [],
          ports: new Map(),
        },
        runnable: module.metadata().runnable ?? false,
        subItems: new Map(),
      };
    };

    const graphToOutline = (
      graph: InspectableGraph,
      overrideTitle = true
    ): Outline => {
      const nodes: InspectableNode[] = [];
      const ports: Map<NodeIdentifier, InspectableNodePorts> = new Map();
      for (const node of graph.nodes()) {
        nodes.push(node);

        const nodePorts = node.currentPorts();
        ports.set(node.descriptor.id, nodePorts);
      }

      nodes.sort((a, b) => {
        // Attempt to sort inputs to the front, and outputs to the back.
        if (a.descriptor.type === "input" && b.descriptor.type !== "input") {
          return -1;
        }

        if (b.descriptor.type === "input" && a.descriptor.type !== "input") {
          return 1;
        }

        if (a.descriptor.type === "output" && b.descriptor.type !== "output") {
          return 1;
        }

        if (b.descriptor.type === "output" && a.descriptor.type !== "output") {
          return -1;
        }

        // Fall through to titles.
        if (a.title() < b.title()) {
          return -1;
        }

        if (a.title() > b.title()) {
          return 1;
        }

        return 0;
      });

      const subItems = new Map<GraphIdentifier | ModuleIdentifier, Outline>();
      const subGraphs = graph.graphs();
      if (subGraphs) {
        for (const [id, subGraph] of Object.entries(subGraphs)) {
          subItems.set(id, graphToOutline(subGraph, false));
        }
      }

      const modules = graph.modules();
      if (modules) {
        for (const [id, module] of Object.entries(modules)) {
          subItems.set(id, moduleToOutline(id, module));
        }
      }

      return {
        main: graph.main(),
        type: graph.imperative() ? "imperative" : "declarative",
        title: overrideTitle
          ? "Main Board"
          : (graph.raw().title ?? "Unnamed graph"),
        items: {
          nodes,
          ports,
        },
        minimized: graph.metadata()?.visual?.minimized ?? false,
        subItems,
      } as Outline;
    };

    if (typeof graph !== "object" || Array.isArray(graph)) {
      throw new Error("Unsupported information");
    }

    if (!graph) {
      throw new Error("Unable to load graph");
    }

    return graphToOutline(graph);
  }

  connectedCallback(): void {
    super.connectedCallback();

    const openItems = globalThis.sessionStorage.getItem(OPEN_ITEMS_KEY);
    if (openItems !== null) {
      try {
        this.#openItems = new Set(JSON.parse(openItems));
      } catch (err) {
        // Noop fail.
      }
    }
  }

  #storeOpenItems() {
    globalThis.sessionStorage.setItem(
      OPEN_ITEMS_KEY,
      JSON.stringify([...this.#openItems])
    );
  }

  #toBoardName(
    id: GraphIdentifier | ModuleIdentifier | UnresolvedPathBoardCapability
  ) {
    if (typeof id === "object") {
      id = id.path;
    }

    if (id.startsWith("#module:")) {
      const modules = this.graph?.modules();
      if (typeof id === "string") {
        id = id.slice("#module:".length);
      }

      if (modules && typeof id === "string" && modules[id]) {
        return modules[id].metadata().title ?? id;
      }
    } else {
      const subGraphs = this.graph?.graphs();
      if (typeof id === "string") {
        id = id.slice(1);
      }

      if (subGraphs && typeof id === "string" && subGraphs[id]) {
        return subGraphs[id].raw().title ?? id;
      }
    }
  }

  #renderPreview(port: InspectablePort) {
    let preview = "";
    if (isModuleBehavior(port.schema)) {
      const modules = this.graph?.modules();
      if (modules && typeof port.value === "string" && modules[port.value]) {
        return modules[port.value].metadata().title ?? port.value;
      }

      return "Unspecified Module";
    }

    if (isBoardBehavior(port.schema)) {
      const value = port.value;
      if (!value) return "Unset";
      return this.#toBoardName(value as GraphIdentifier);
    }

    if (isBoardArrayBehavior(port.schema) && Array.isArray(port.value)) {
      return port.value
        .map((module) => this.#toBoardName(module as ModuleIdentifier))
        .join(", ");
    }

    switch (typeof port.value) {
      case "object": {
        preview = JSON.stringify(port.value);
        break;
      }

      case "undefined": {
        preview = "";
        break;
      }

      default: {
        preview = `${port.value}`;
        break;
      }
    }

    return preview;
  }

  #renderWorkspaceItem(
    subGraphId: string | null,
    nodes: InspectableNode[],
    ports: Map<NodeIdentifier, InspectableNodePorts>,
    subGraphs: Map<GraphIdentifier, Outline>,
    seenSubItems: Set<string>,
    renderSubItemsInline = false
  ): HTMLTemplateResult {
    if (nodes.length === 0) {
      return html`<div class="no-items">There are no items available</div>`;
    }

    return html`<ul>
      ${map(nodes, (node) => {
        const { type } = node.descriptor;
        const nodePorts: InspectableNodePorts = ports.get(
          node.descriptor.id
        ) ?? {
          inputs: { ports: [], fixed: false },
          outputs: { ports: [], fixed: false },
          side: { ports: [], fixed: false },
        };

        const selection = this.selectionState?.selectionState.graphs.get(
          subGraphId ? subGraphId : MAIN_BOARD_ID
        );
        return html`<li class=${classMap({ node: true, [type]: true })}>
          <span class="title"
            ><button
              class=${classMap({
                ["node-item"]: true,
                selected: selection?.nodes.has(node.descriptor.id) ?? false,
              })}
              @click=${(evt: PointerEvent) => {
                const isMac = navigator.platform.indexOf("Mac") === 0;
                const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;
                const replaceExistingSelection = !isCtrlCommand;

                this.#changeWorkspaceItem(
                  subGraphId,
                  null,
                  node.descriptor.id,
                  replaceExistingSelection
                );
              }}
            >
              ${node.title()}
            </button></span
          >
          <ul class="ports">
            ${map(nodePorts.inputs.ports, (port) => {
              if (port.name === "*" || port.name === "") {
                return nothing;
              }

              const dragConnectorTargetPort =
                isBoardBehavior(port.schema) ||
                isBoardArrayBehavior(port.schema)
                  ? port.name
                  : null;

              return html`<li
                class=${classMap({
                  port: true,
                  [port.status]: true,
                  configured: port.configured,
                  "with-preview": true,
                  board: dragConnectorTargetPort ?? false,
                })}
                data-drag-connector-target-graph=${subGraphId
                  ? subGraphId
                  : MAIN_BOARD_ID}
                data-drag-connector-target-node=${node.descriptor.id ?? nothing}
                data-drag-connector-target-port=${dragConnectorTargetPort ??
                nothing}
              >
                <span class="title">
                  ${isConfigurableBehavior(port.schema)
                    ? html`<button
                        class="port-item"
                        @click=${(evt: PointerEvent) => {
                          const addHorizontalClickClearance = true;
                          this.dispatchEvent(
                            new NodeConfigurationUpdateRequestEvent(
                              node.descriptor.id,
                              subGraphId,
                              port,
                              port.name,
                              evt.clientX,
                              evt.clientY,
                              addHorizontalClickClearance
                            )
                          );
                        }}
                      >
                        ${port.title}
                      </button>`
                    : html`<span class="port-item">${port.title}</span>`}
                </span>
                <span class="preview">${this.#renderPreview(port)}</span>
              </li>`;
            })}
            ${map(nodePorts.side.ports, (port) => {
              if (port.name === "*" || port.name === "") {
                return nothing;
              }

              let graphDetail: HTMLTemplateResult | symbol = nothing;
              const portSubGraphId = (port.value as GraphIdentifier).slice(1);
              const portSubGraph = subGraphs.get(portSubGraphId);
              if (!portSubGraph) {
                graphDetail = html`Unable to locate subgraph`;
              } else {
                const graphButton = html`<bb-slide-board-selector
                  .graph=${this.graph}
                  .value=${portSubGraphId}
                  ?tree=${this.mode === "tree"}
                  @bbboardchosen=${(evt: BoardChosenEvent) => {
                    this.dispatchEvent(
                      new NodePartialUpdateEvent(
                        node.descriptor.id,
                        subGraphId,
                        { [port.name]: `#${evt.id}` }
                      )
                    );
                  }}
                ></bb-slide-board-selector>`;
                if (!renderSubItemsInline) {
                  graphDetail = graphButton;
                } else {
                  graphDetail = html`<div>
                    ${graphButton}${this.#renderWorkspaceItem(
                      portSubGraphId,
                      portSubGraph.items.nodes,
                      portSubGraph.items.ports,
                      portSubGraph.subItems,
                      seenSubItems,
                      renderSubItemsInline
                    )}
                  </div>`;
                }
              }

              return html`<li
                class=${classMap({
                  port: true,
                  subgraph: !renderSubItemsInline,
                  [port.status]: true,
                  configured: port.configured,
                })}
              >
                <span class="title">${port.title}</span>${graphDetail}
              </li>`;
            })}
          </ul>
        </li>`;
      })}
    </ul>`;
  }

  #setOpenStatusFor(id: string, value: boolean) {
    if (value) {
      this.#openItems.add(id);
    } else {
      this.#openItems.delete(id);
    }

    this.#storeOpenItems();
  }

  #renderWorkspace(
    type: string,
    main: string | undefined,
    title: string,
    nodes: InspectableNode[],
    ports: Map<NodeIdentifier, InspectableNodePorts>,
    subItems: Map<ItemIdentifier, Outline>,
    renderSubItemsInline: boolean
  ) {
    const subItemsList = [...subItems.entries()].sort(
      ([a, subItemA], [b, subItemB]) => {
        if (a === main) return -1;
        if (b === main) return 1;
        if (subItemA.type === "declarative" && subItemB.type === "imperative")
          return -1;
        if (subItemA.type === "imperative" && subItemB.type === "declarative")
          return 1;
        return a > b ? 1 : a < b ? -1 : 0;
      }
    );

    const seenSubItems = new Set<string>();
    return html`${type === "declarative"
      ? html`<details
          id=${MAIN_BOARD_ID}
          class=${classMap({
            declarative: true,
          })}
          ?open=${subItems.size === 0 || this.#openItems.has(MAIN_BOARD_ID)}
          @toggle=${(evt: Event) => {
            if (!(evt.target instanceof HTMLDetailsElement)) {
              return;
            }

            this.#setOpenStatusFor(MAIN_BOARD_ID, evt.target.open);
          }}
        >
          <summary>
            <button
              class=${classMap({ title: true })}
              @click=${(evt: PointerEvent) => {
                evt.stopPropagation();

                const isMac = navigator.platform.indexOf("Mac") === 0;
                const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

                this.#changeWorkspaceItem(null, null, null, !isCtrlCommand);
              }}
            >
              ${title}
            </button>
            <button
              class="more"
              @click=${(evt: PointerEvent) => {
                this.#setOverflowMenuValues({
                  type: main === undefined ? "declarative" : "imperative",
                  target: null,
                  actions: [
                    {
                      title: "Zoom to Fit",
                      name: "zoom-to-fit",
                      icon: "fit",
                    },
                    {
                      title: "Edit Board Information",
                      name: "edit-board-details",
                      icon: "edit-board-details",
                    },
                  ],
                  location: {
                    x: evt.clientX + 20,
                    y: evt.clientY,
                  },
                });
                this.showOverflowMenu = true;
              }}
            >
              More
            </button>
          </summary>
          ${this.#renderWorkspaceItem(
            null,
            nodes,
            ports,
            subItems,
            seenSubItems,
            renderSubItemsInline
          )}
        </details> `
      : nothing}
    ${map(subItemsList, ([id, subItem]) => {
      if (seenSubItems.has(id)) {
        return nothing;
      }

      const preventRefencing =
        subItem.type === "imperative" && !subItem.runnable;
      return html`<details
        style=${styleMap({
          "--subgraph-border-color": getSubItemColor(id, "border"),
          "--subgraph-label-color": getSubItemColor(id, "label"),
        })}
        id=${this.#createSubItemId(id)}
        class=${classMap({
          [subItem.type]: true,
          main: id === main,
          runnable: subItem.runnable ?? false,
          inverted: getSubItemColor<number>(id, "text", true) === 0xffffff,
        })}
        ?open=${this.#openItems.has(id)}
        @toggle=${(evt: Event) => {
          if (!(evt.target instanceof HTMLDetailsElement)) {
            return;
          }

          this.#setOpenStatusFor(id, evt.target.open);
        }}
      >
        <summary>
          <button
            class=${classMap({
              title: true,
              selected:
                this.selectionState?.selectionState.modules.has(id) ?? false,
            })}
            @click=${(evt: PointerEvent) => {
              evt.stopPropagation();

              const isMac = navigator.platform.indexOf("Mac") === 0;
              const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;
              const replaceExistingSelection = !isCtrlCommand;

              const subGraphId = subItem.type === "declarative" ? id : null;
              const moduleId = subItem.type === "imperative" ? id : null;
              this.#changeWorkspaceItem(
                subGraphId,
                moduleId,
                null,
                replaceExistingSelection
              );
            }}
          >
            ${subItem.title}
          </button>
          ${main !== id
            ? html` <button
                  class="more"
                  @click=${(evt: PointerEvent) => {
                    const showZoom =
                      subItem.type === "declarative" &&
                      (this.mode === "tree" ||
                        this.selectionState?.selectionState.graphs.has(id));

                    const actions: OverflowAction[] = [];

                    if (showZoom) {
                      actions.push({
                        title: "Zoom to Fit",
                        name: "zoom-to-fit",
                        icon: "fit",
                      });
                    }

                    if (subItem.type === "declarative") {
                      actions.push({
                        title: "Edit Board Information",
                        name: "edit-board-details",
                        icon: "edit-board-details",
                        value: id,
                      });

                      if (subItem.minimized) {
                        actions.push({
                          title: "Maximize",
                          name: "maximize",
                          icon: "maximize",
                          value: id,
                        });
                      } else {
                        actions.push({
                          title: "Minimize",
                          name: "minimize",
                          icon: "minimize",
                          value: id,
                        });
                      }
                    }

                    actions.push(
                      {
                        title: "Duplicate",
                        name: "duplicate",
                        icon: "duplicate",
                      },
                      {
                        title: "Delete",
                        name: "delete",
                        icon: "delete",
                      }
                    );

                    this.#setOverflowMenuValues({
                      type: subItem.type,
                      target: id,
                      actions,
                      location: {
                        x: evt.clientX + 20,
                        y: evt.clientY,
                      },
                    });
                    this.showOverflowMenu = true;
                  }}
                >
                  More
                </button>
                <span
                  class=${classMap({
                    color: true,
                    ["reference"]: !preventRefencing,
                  })}
                  @click=${(evt: PointerEvent) => {
                    if (preventRefencing) {
                      return;
                    }
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                  }}
                  @pointerover=${(evt: PointerEvent) => {
                    if (preventRefencing) {
                      return;
                    }

                    this.dispatchEvent(
                      new ShowTooltipEvent(
                        `Drag to a board port`,
                        evt.clientX,
                        evt.clientY
                      )
                    );
                  }}
                  @pointerout=${() => {
                    if (preventRefencing) {
                      return;
                    }

                    this.dispatchEvent(new HideTooltipEvent());
                  }}
                  @pointerdown=${(evt: PointerEvent) => {
                    if (preventRefencing) {
                      return;
                    }

                    evt.stopImmediatePropagation();

                    const source =
                      subItem.type === "declarative"
                        ? `#${id}`
                        : `#module:${id}`;

                    this.dispatchEvent(
                      new DragConnectorStartEvent(
                        {
                          x: evt.clientX,
                          y: evt.clientY,
                        },
                        source
                      )
                    );
                  }}
                ></span>`
            : nothing}
        </summary>
        ${this.#renderWorkspaceItem(
          id,
          subItem.items.nodes,
          subItem.items.ports,
          subItem.subItems,
          seenSubItems,
          false
        )}
      </details>`;
    })}
    ${this.showOverflowMenu
      ? html`<bb-overflow-menu
          .actions=${this.#overflowMenu.actions}
          .disabled=${false}
          @bboverflowmenuaction=${(evt: OverflowMenuActionEvent) => {
            this.showOverflowMenu = false;

            switch (evt.action) {
              case "minimize": {
                evt.stopImmediatePropagation();
                const graphId = evt.value as GraphIdentifier;
                if (!graphId) {
                  return;
                }

                const changeId = this.#visualChangeId();
                this.dispatchEvent(
                  new WorkspaceItemVisualUpdateEvent(changeId, graphId, {
                    minimized: true,
                  })
                );
                break;
              }

              case "maximize": {
                evt.stopImmediatePropagation();
                const graphId = evt.value as GraphIdentifier;
                if (!graphId) {
                  return;
                }

                const changeId = this.#visualChangeId();
                this.dispatchEvent(
                  new WorkspaceItemVisualUpdateEvent(changeId, graphId, {
                    minimized: false,
                  })
                );
                break;
              }

              case "zoom-to-fit": {
                evt.stopImmediatePropagation();

                this.#changeWorkspaceItem(
                  this.#overflowMenu.target ? this.#overflowMenu.target : null,
                  null
                );
                break;
              }

              case "quick-jump": {
                evt.stopImmediatePropagation();

                const subGraphId =
                  this.#overflowMenu.type === "declarative"
                    ? this.#overflowMenu.target
                    : null;
                const moduleId =
                  this.#overflowMenu.type === "imperative"
                    ? this.#overflowMenu.target
                    : null;
                this.#changeWorkspaceItem(subGraphId, moduleId);
                break;
              }

              case "duplicate": {
                evt.stopImmediatePropagation();

                if (!this.#overflowMenu.target) {
                  break;
                }

                const target = subItems.get(this.#overflowMenu.target);
                if (!target) {
                  break;
                }

                const name = prompt(
                  "What would you like to call this?",
                  `${target.title} Copy`
                );
                if (!name) {
                  break;
                }

                this.dispatchEvent(
                  new BoardItemCopyEvent(
                    this.#overflowMenu.target,
                    target.type === "declarative" ? "graph" : "module",
                    name
                  )
                );
                break;
              }

              case "delete": {
                evt.stopImmediatePropagation();

                if (!this.#overflowMenu.target) {
                  break;
                }

                const target = subItems.get(this.#overflowMenu.target);
                if (!target) {
                  break;
                }

                if (target.type === "declarative") {
                  if (!confirm("Are you sure you wish to delete this board?")) {
                    break;
                  }

                  this.dispatchEvent(
                    new SubGraphDeleteEvent(this.#overflowMenu.target)
                  );
                  break;
                } else {
                  if (
                    !confirm("Are you sure you wish to delete this module?")
                  ) {
                    break;
                  }

                  this.dispatchEvent(
                    new ModuleDeleteEvent(this.#overflowMenu.target)
                  );
                  break;
                }
              }
            }
          }}
          @bboverflowmenudismissed=${() => {
            this.showOverflowMenu = false;
          }}
          style=${styleMap({
            left: `${this.#overflowMenu.location.x}px`,
            top: `${this.#overflowMenu.location.y}px`,
          })}
        ></bb-overflow-menu>`
      : nothing} `;
  }

  #visualChangeId(): WorkspaceVisualChangeId {
    return crypto.randomUUID();
  }

  #selectionChangeId(): WorkspaceSelectionChangeId {
    return crypto.randomUUID();
  }

  #changeWorkspaceItem(
    subGraphId: GraphIdentifier | null,
    moduleId: ModuleIdentifier | null,
    nodeId: NodeIdentifier | null = null,
    replaceExistingSelections = true
  ) {
    const selectionState = Utils.Workspace.createSelection(
      this.selectionState?.selectionState ?? null,
      this.graph,
      subGraphId,
      moduleId,
      nodeId,
      replaceExistingSelections
    );
    const selectionChangeId = this.#selectionChangeId();
    this.dispatchEvent(
      new WorkspaceSelectionStateEvent(
        selectionChangeId,
        selectionState,
        replaceExistingSelections,
        "animated"
      )
    );
  }

  #renderOutline() {
    const outline = this.#getGraphDetails(this.graph!);
    let nodes = [...outline.items.nodes];
    const subItems = new Map([...outline.subItems]);
    if (this.filter) {
      nodes = nodes.filter((node) => {
        const filter = new RegExp(this.filter!, "gim");
        return filter.test(node.title());
      });

      for (const [id, graphOrModule] of subItems) {
        const filter = new RegExp(this.filter, "gim");
        if (filter.test(id) || filter.test(graphOrModule.title)) {
          continue;
        }

        subItems.delete(id);
      }
    }

    return this.#renderWorkspace(
      outline.type,
      outline.main,
      outline.title,
      nodes,
      outline.items.ports,
      subItems,
      this.mode === "tree"
    );
  }

  render() {
    return html`
      <div id="container" ${ref(this.#containerRef)}>
        <div id="controls">
          <input
            @input=${(evt: InputEvent) => {
              if (!(evt.target instanceof HTMLInputElement)) {
                return;
              }

              this.filter = evt.target.value;
            }}
            placeholder="Search for an item"
            type="search"
          />
        </div>
        <div id="outline">${this.#renderOutline()}</div>
      </div>
    `;
  }
}

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableEdge,
  InspectableNode,
  InspectableNodePorts,
  InspectablePort,
} from "@google-labs/breadboard";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import * as PIXI from "pixi.js";
import * as Dagre from "@dagrejs/dagre";
import {
  GraphNodeDblClickEvent,
  GraphNodeEdgeAttach,
  GraphNodeEdgeChange,
  GraphNodeEdgeDetach,
} from "../../events/events.js";

class InteractionTracker {
  static #instance: InteractionTracker;
  static instance() {
    if (!this.#instance) {
      this.#instance = new InteractionTracker();
    }

    return this.#instance;
  }

  private constructor() {
    // Constructor only callable by Singleton function.
  }

  public hoveredGraphNodePort: GraphNodePort | null = null;
  public hoveredGraphNode: GraphNode | null = null;
  public activeGraphNodePort: GraphNodePort | null = null;
  public activeGraphNode: GraphNode | null = null;
  public activeGraph: Graph | null = null;

  clear() {
    this.hoveredGraphNodePort = null;
    this.hoveredGraphNode = null;
    this.activeGraphNodePort = null;
    this.activeGraphNode = null;
    this.activeGraph = null;
  }
}

const GRAPH_NODE_DRAWN = "graphnodedrawn";
const GRAPH_NODE_MOVED = "graphnodemoved";
const GRAPH_INITIAL_DRAW = "graphinitialdraw";

enum GraphNodePortType {
  IN = "in",
  OUT = "out",
}

class GraphNodePort extends PIXI.Graphics {
  #isDirty = true;
  #radius = 3;
  #borderInactiveColor = 0xbbbbbb;
  #borderActiveColor = 0x475d3f;
  #activeColor = 0xaced8f;
  #inactiveColor = 0xdddddd;
  #active = false;

  constructor(public type: GraphNodePortType) {
    super();

    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerdown", () => {
      InteractionTracker.instance().activeGraphNodePort = this;
    });

    let defaultActive: typeof this.active;
    this.on("pointerover", () => {
      defaultActive = this.active;
      InteractionTracker.instance().hoveredGraphNodePort = this;
    });

    this.on("pointerout", () => {
      InteractionTracker.instance().hoveredGraphNodePort = null;
      this.active = defaultActive;
    });
  }

  set radius(radius: number) {
    this.#radius = radius;
    this.#isDirty = true;
  }

  get radius() {
    return this.#radius;
  }

  set active(active: boolean) {
    this.#active = active;
    this.#isDirty = true;
  }

  get active() {
    return this.#active;
  }

  render(renderer: PIXI.Renderer): void {
    if (this.#isDirty) {
      this.#isDirty = false;
      this.#draw();
    }
    super.render(renderer);
  }

  #draw() {
    // Adjust the hit area so it's a bit bigger.
    this.hitArea = new PIXI.Rectangle(
      -this.#radius * 2,
      -this.#radius * 2,
      this.#radius * 4,
      this.#radius * 4
    );

    this.lineStyle({
      color: this.#active ? this.#borderActiveColor : this.#borderInactiveColor,
      width: 1,
    });
    this.beginFill(this.#active ? this.#activeColor : this.#inactiveColor);
    this.drawCircle(0, 0, this.#radius);
    this.endFill();
  }
}

class GraphEdge extends PIXI.Graphics {
  #isDirty = true;
  #edge: InspectableEdge | null = null;
  #edgeColor = 0xaaaaaa;
  #padding = 25;
  #overrideInLocation: PIXI.ObservablePoint<unknown> | null = null;
  #overrideOutLocation: PIXI.ObservablePoint<unknown> | null = null;

  constructor(
    public fromNode: GraphNode,
    public toNode: GraphNode,
    public readonly temporary = false
  ) {
    super();
  }

  set edge(edge: InspectableEdge | null) {
    this.#edge = edge;
    this.#isDirty = true;
  }

  get edge() {
    return this.#edge;
  }

  set overrideInLocation(
    overrideInLocation: PIXI.ObservablePoint<unknown> | null
  ) {
    this.#overrideInLocation = overrideInLocation;
    this.#isDirty = true;
  }

  get overrideInLocation() {
    return this.#overrideInLocation;
  }

  set overrideOutLocation(
    overrideOutLocation: PIXI.ObservablePoint<unknown> | null
  ) {
    this.#overrideOutLocation = overrideOutLocation;
    this.#isDirty = true;
  }

  get overrideOutLocation() {
    return this.#overrideOutLocation;
  }

  render(renderer: PIXI.Renderer) {
    if (this.#isDirty) {
      this.#draw();
      this.#isDirty = false;
    }
    super.render(renderer);
  }

  forceRedraw() {
    this.#isDirty = true;
  }

  #draw() {
    if (!this.#edge) {
      return;
    }

    this.clear();

    let inLocation = this.toNode.inPortLocation(this.#edge.in);
    let outLocation = this.fromNode.outPortLocation(this.#edge.out);

    if (this.#overrideInLocation) {
      inLocation = this.#overrideInLocation;
    }

    if (this.#overrideOutLocation) {
      outLocation = this.#overrideOutLocation;
    }

    if (!(outLocation && inLocation)) {
      return;
    }

    // Take a copy rather than modifying the original values.
    outLocation = outLocation.clone();
    inLocation = inLocation.clone();

    // Convert to graph-centric values.
    outLocation.x += this.fromNode.position.x;
    outLocation.y += this.fromNode.position.y;

    inLocation.x += this.toNode.position.x;
    inLocation.y += this.toNode.position.y;

    const midX = Math.round((inLocation.x - outLocation.x) / 2);
    const midY = Math.round((inLocation.y - outLocation.y) / 2);

    this.lineStyle(2, this.#edgeColor);
    this.moveTo(outLocation.x, outLocation.y);

    if (
      this.fromNode === this.toNode &&
      !this.#overrideInLocation &&
      !this.#overrideOutLocation
    ) {
      // Loopback
      this.lineTo(outLocation.x + this.#padding, outLocation.y);
      this.lineTo(
        outLocation.x + this.#padding,
        outLocation.y + this.fromNode.height / 2 + this.#padding
      );
      this.lineTo(
        inLocation.x - this.#padding,
        outLocation.y + this.fromNode.height / 2 + this.#padding
      );
      this.lineTo(inLocation.x - this.#padding, inLocation.y);
      this.lineTo(inLocation.x, inLocation.y);
      return;
    }

    const curve = 5;
    let curveY = outLocation.y > inLocation.y ? -curve : curve;
    let curveX = curve;
    if (Math.abs(outLocation.y - inLocation.y) < 4 * curve) {
      curveY = 0;
    }

    if (midX > this.#padding) {
      this.lineTo(outLocation.x + midX - curve, outLocation.y);
      this.quadraticCurveTo(
        outLocation.x + midX,
        outLocation.y,
        outLocation.x + midX,
        outLocation.y + curveY
      );
      this.lineTo(outLocation.x + midX, inLocation.y - curveY);
      this.quadraticCurveTo(
        outLocation.x + midX,
        inLocation.y,
        outLocation.x + midX + curveX,
        inLocation.y
      );
      this.lineTo(inLocation.x, inLocation.y);
    } else {
      // Ensure the edge won't come back on itself in the middle.
      if (
        inLocation.x - this.#padding + curveX >
        outLocation.x + this.#padding - curveX
      ) {
        curveX = 0;
      }

      this.lineTo(outLocation.x + this.#padding - curveX, outLocation.y);
      this.quadraticCurveTo(
        outLocation.x + this.#padding,
        outLocation.y,
        outLocation.x + this.#padding,
        outLocation.y + curveY
      );
      this.lineTo(outLocation.x + this.#padding, outLocation.y + midY - curveY);
      this.quadraticCurveTo(
        outLocation.x + this.#padding,
        outLocation.y + midY,
        outLocation.x + this.#padding - curveX,
        outLocation.y + midY
      );
      this.lineTo(inLocation.x - this.#padding + curveX, outLocation.y + midY);
      this.quadraticCurveTo(
        inLocation.x - this.#padding,
        outLocation.y + midY,
        inLocation.x - this.#padding,
        outLocation.y + midY + curveY
      );
      this.lineTo(inLocation.x - this.#padding, inLocation.y - curveY);
      this.quadraticCurveTo(
        inLocation.x - this.#padding,
        inLocation.y,
        inLocation.x - this.#padding + curveX,
        inLocation.y
      );
      this.lineTo(inLocation.x, inLocation.y);
    }
  }
}

export class GraphNode extends PIXI.Graphics {
  #width = 0;
  #height = 0;

  #isDirty = true;
  #id = "";
  #type = "";
  // A title that is provided in the constructor, not
  // the one that shows up in the graph.
  #nodeTtitle = "";
  // The title that shows up in the graph.
  #title = "";
  #titleText: PIXI.Text | null = null;
  #borderRadius = 3;
  #color = 0x333333;
  #titleTextColor = 0x333333;
  #portTextColor = 0x333333;
  #textSize = 12;
  #backgroundColor = 0x333333;
  #padding = 10;
  #portLabelVerticalPadding = 5;
  #portLabelHorizontalPadding = 20;
  #portPadding = 6;
  #portRadius = 3;
  #inPorts: Map<InspectablePort, PIXI.Text | null> = new Map();
  #outPorts: Map<InspectablePort, PIXI.Text | null> = new Map();
  #inPortLocations: Map<string, PIXI.ObservablePoint<unknown>> = new Map();
  #outPortLocations: Map<string, PIXI.ObservablePoint<unknown>> = new Map();

  constructor(id: string, type: string, title: string) {
    super();

    this.#nodeTtitle = title;
    this.id = id;
    this.type = type;

    switch (type) {
      case "input":
        this.color = 0xc9daf8;
        this.titleTextColor = 0x2c5598;
        break;

      case "secrets":
        this.color = 0xf4cccc;
        this.titleTextColor = 0xac342a;
        break;

      case "output":
        this.color = 0xb6d7a8;
        this.titleTextColor = 0x2a5a15;
        break;

      case "slot":
      case "passthrough":
        this.color = 0xead1dc;
        this.titleTextColor = 0x87365e;
        break;

      default:
        this.color = 0xfff2cc;
        this.titleTextColor = 0xb3772c;
        break;
    }

    this.backgroundColor = 0xffffff;
    this.portTextColor = 0x333333;

    this.eventMode = "static";
    this.cursor = "pointer";

    this.on("pointerdown", () => {
      InteractionTracker.instance().activeGraphNode = this;
    });

    this.on("pointerover", () => {
      InteractionTracker.instance().hoveredGraphNode = this;
    });

    this.on("pointerout", () => {
      InteractionTracker.instance().hoveredGraphNode = null;
    });
  }

  #clearOldTitle() {
    if (!this.#titleText) {
      return;
    }

    this.#titleText.removeFromParent();
    this.#titleText.destroy();
    this.#titleText = null;
  }

  get id() {
    return this.#id;
  }

  set id(id: string) {
    this.#id = id;
  }

  get type() {
    return this.#type;
  }

  set type(type: string) {
    this.#type = type;
    this.#title = `${type} (${this.#nodeTtitle})`;
    this.#clearOldTitle();

    this.#isDirty = true;
  }

  set borderRadius(borderRadius: number) {
    this.#borderRadius = borderRadius;
    this.#isDirty = true;
  }

  get borderRadius() {
    return this.#borderRadius;
  }

  set color(color: number) {
    this.#color = color;
    this.#isDirty = true;
  }

  get color() {
    return this.#color;
  }

  set titleTextColor(titleTextColor: number) {
    this.#titleTextColor = titleTextColor;
    this.#isDirty = true;
  }

  get titleTextColor() {
    return this.#titleTextColor;
  }

  set portTextColor(portTextColor: number) {
    this.#portTextColor = portTextColor;
    this.#isDirty = true;
  }

  get portTextColor() {
    return this.#portTextColor;
  }

  set textSize(textSize: number) {
    this.#textSize = textSize;
    this.#isDirty = true;
  }

  get textSize() {
    return this.#textSize;
  }

  set backgroundColor(backgroundColor: number) {
    this.#backgroundColor = backgroundColor;
    this.#isDirty = true;
  }

  get backgroundColor() {
    return this.#backgroundColor;
  }

  set padding(padding: number) {
    this.#padding = padding;
    this.#isDirty = true;
  }

  get padding() {
    return this.#padding;
  }

  set portLabelVerticalPadding(portLabelVerticalPadding: number) {
    this.#portLabelVerticalPadding = portLabelVerticalPadding;
    this.#isDirty = true;
  }

  get portLabelVerticalPadding() {
    return this.#portLabelVerticalPadding;
  }

  get dimensions() {
    return { width: this.#width, height: this.#height };
  }

  render(renderer: PIXI.Renderer): void {
    if (this.#isDirty) {
      this.#isDirty = false;
      this.#draw();

      // We use this to trigger the edge drawing.
      this.emit(GRAPH_NODE_DRAWN);
    }
    super.render(renderer);
  }

  set inPorts(ports: InspectablePort[]) {
    this.#inPorts.clear();
    for (const port of ports) {
      this.#inPorts.set(port, null);
    }

    this.#isDirty = true;
  }

  set outPorts(ports: InspectablePort[]) {
    this.#outPorts.clear();
    for (const port of ports) {
      this.#outPorts.set(port, null);
    }

    this.#isDirty = true;
  }

  forceUpdateDimensions() {
    this.#createPortTextsIfNeeded();
    this.#createTitleTextIfNeeded();
    this.#updateDimensions();
    this.#enforceEvenDimensions();
  }

  #createTitleTextIfNeeded() {
    if (this.#titleText) {
      return;
    }

    this.#titleText = new PIXI.Text(this.#title, {
      fontFamily: "Arial",
      fontSize: this.#textSize,
      fill: this.#titleTextColor,
      align: "left",
    });
  }

  #createPortTextsIfNeeded() {
    this.#createPortTextLabels(this.#inPorts, "left");
    this.#createPortTextLabels(this.#outPorts, "right");
  }

  #createPortTextLabels(
    ports: Map<InspectablePort, PIXI.Text | null>,
    align: "left" | "right"
  ) {
    for (const [port, text] of ports) {
      if (text !== null) {
        continue;
      }

      const textLabel = new PIXI.Text(port.name, {
        fontFamily: "Arial",
        fontSize: this.#textSize,
        fill: this.#portTextColor,
        align,
      });

      ports.set(port, textLabel);
    }
  }

  /**
   * Ensure that we have an even number of pixels just so we don't get fuzzy
   * rendering on half pixels.
   */
  #enforceEvenDimensions() {
    if (this.#width % 2 === 1) {
      this.#width++;
    }

    if (this.#height % 2 === 1) {
      this.#height++;
    }
  }

  #updateDimensions() {
    const portRowHeight = this.#textSize + 2 * this.#portLabelVerticalPadding;
    const portCount = Math.max(this.#inPorts.size, this.#outPorts.size);

    // Height calculations.
    let height = this.#padding + (this.#titleText?.height || 0) + this.#padding;
    height += this.#padding + portCount * portRowHeight + this.#padding;

    // Width calculations.
    let width = this.#padding + (this.#titleText?.width || 0) + this.#padding;
    const inPortLabels = Array.from(this.#inPorts.values());
    const outPortLabels = Array.from(this.#outPorts.values());
    for (let p = 0; p < portCount; p++) {
      const inPortWidth = inPortLabels[p]?.width || 0;
      const outPortWidth = outPortLabels[p]?.width || 0;

      width = Math.max(
        width,
        this.#padding + // Left hand side.
          2 * this.#portRadius + // Left hand port diameter.
          this.#portPadding + // Left hand port padding on right.
          inPortWidth + // Left label at this row.
          2 * this.#portLabelHorizontalPadding + // Port label padding for both sides.
          outPortWidth + // Right label at this row.
          this.#portPadding + // Right hand port padding on right.
          2 * this.#portRadius + // Right hand port diameter.
          this.#padding // Right hand side padding.
      );
    }

    this.#width = width;
    this.#height = height;
  }

  #draw() {
    this.forceUpdateDimensions();
    this.removeChildren();
    this.clear();

    this.#drawBackground();
    const portStartY = this.#drawTitle();
    this.#drawInPorts(portStartY);
    this.#drawOutPorts(portStartY);
  }

  #drawBackground() {
    this.beginFill(0xbbbbbb);
    this.drawRoundedRect(
      -1,
      -1,
      this.#width + 2,
      this.#height + 2,
      this.#borderRadius + 1
    );
    this.endFill();

    this.beginFill(this.#backgroundColor);
    this.drawRoundedRect(0, 0, this.#width, this.#height, this.#borderRadius);
    this.endFill();
  }

  #drawTitle() {
    let portStartY = 0;
    if (this.#titleText) {
      const titleHeight =
        this.#padding + this.#titleText.height + this.#padding;
      this.beginFill(this.#color);
      this.drawRoundedRect(0, 0, this.#width, titleHeight, this.#borderRadius);
      this.drawRect(
        0,
        titleHeight - 2 * this.#borderRadius,
        this.#width,
        2 * this.#borderRadius
      );
      this.endFill();

      this.#titleText.eventMode = "none";
      this.#titleText.x = this.#padding;
      this.#titleText.y = this.#padding;
      this.addChild(this.#titleText);

      // Move the labels a padding's distance from the bottom of the title.
      portStartY += titleHeight + this.#padding;
    }

    return portStartY;
  }

  #drawInPorts(portStartY = 0) {
    this.#inPortLocations.clear();
    const portRowHeight = this.#textSize + 2 * this.#portLabelVerticalPadding;

    let portY = portStartY;
    for (const [port, label] of this.#inPorts) {
      if (!label) {
        console.warn(`No label for ${port.name}`);
        continue;
      }

      const nodePort = new GraphNodePort(GraphNodePortType.IN);
      nodePort.name = port.name;
      nodePort.radius = this.#portRadius;
      nodePort.x = this.#padding + this.#portRadius;
      nodePort.y = portY + label.height * 0.5;

      // TODO: Display other port statuses.
      nodePort.active = port.status === "connected";
      this.addChild(nodePort);
      this.#inPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x + this.#portRadius + this.#portPadding;
      label.y = portY;
      label.interactive = false;
      this.addChild(label);

      portY += portRowHeight;
    }
  }

  #drawOutPorts(portStartY = 0) {
    this.#outPortLocations.clear();
    const portRowHeight = this.#textSize + 2 * this.#portLabelVerticalPadding;

    let portY = portStartY;
    for (const [port, label] of this.#outPorts) {
      if (!label) {
        console.warn(`No label for ${port.name}`);
        continue;
      }

      const nodePort = new GraphNodePort(GraphNodePortType.OUT);
      nodePort.name = port.name;
      nodePort.radius = this.#portRadius;
      nodePort.x = this.#width - this.#padding - this.#portRadius;
      nodePort.y = portY + label.height * 0.5;
      // TODO: Display other port statuses.
      nodePort.active = port.status === "connected";

      this.addChild(nodePort);
      this.#outPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x - this.#portRadius - this.#portPadding - label.width;
      label.y = portY;
      label.interactive = false;
      this.addChild(label);

      portY += portRowHeight;
    }
  }

  inPortLocation(name: string): PIXI.ObservablePoint<unknown> | null {
    return this.#inPortLocations.get(name) || null;
  }

  outPortLocation(name: string): PIXI.ObservablePoint<unknown> | null {
    return this.#outPortLocations.get(name) || null;
  }
}

export class Graph extends PIXI.Container {
  #isDirty = true;
  #edgeContainer = new PIXI.Container();
  #edgeGraphics = new Map<InspectableEdge, GraphEdge>();
  #edges: InspectableEdge[] | null = null;
  #nodes: InspectableNode[] | null = null;
  #ports: Map<string, InspectableNodePorts> | null = null;
  #nodeById = new Map<string, GraphNode>();
  #layout = new Map<string, { x: number; y: number; pendingSize?: boolean }>();
  #highlightedNodeId: string | null = null;
  #highlightedNode = new PIXI.Graphics();
  #highlightPadding = 10;

  constructor() {
    super();

    this.eventMode = "static";
    this.sortableChildren = true;

    this.on("pointerdown", () => {
      InteractionTracker.instance().activeGraph = this;
    });

    // TODO: Add layout reset option.
  }

  setNodeLayoutPosition(
    node: string,
    position: PIXI.IPointData,
    pendingSize = true
  ) {
    this.#layout.set(node, { ...this.toLocal(position), pendingSize });
  }

  layout() {
    if (!this.#edges) {
      return;
    }

    const g = new Dagre.graphlib.Graph();
    g.setGraph({ marginx: 0, marginy: 0, nodesep: 20, rankdir: "LR" });
    g.setDefaultEdgeLabel(() => ({}));

    let nodesAdded = 0;
    for (const node of this.children) {
      if (!(node instanceof GraphNode)) {
        continue;
      }

      // Skip any nodes where the layout has already been set by the user.
      if (this.#layout.has(node.id)) {
        continue;
      }
      nodesAdded++;
      g.setNode(node.id, node.dimensions);
    }

    let edgesAdded = 0;
    for (const edge of this.#edges) {
      edgesAdded++;
      g.setEdge(edge.from.descriptor.id, edge.to.descriptor.id);
    }

    // Only run Dagre if there are edges & children to account for. Otherwise
    // it will throw an error.
    if (nodesAdded > 0 && edgesAdded > 0) {
      Dagre.layout(g);

      for (const id of g.nodes()) {
        const data = g.node(id);
        if (!data) {
          continue;
        }

        const { x, y } = g.node(id);
        this.#layout.set(id, { x, y });
      }
    }

    // Step through any Dagre-set and custom set locations.
    for (const [id, position] of this.#layout) {
      const graphNode = this.#nodeById.get(id);
      if (!graphNode) {
        continue;
      }

      graphNode.position.set(position.x, position.y);
    }

    this.#drawEdges();
  }

  render(renderer: PIXI.Renderer) {
    if (this.#isDirty) {
      this.#isDirty = false;
      this.#drawEdges();
      this.#drawNodes();
      this.#drawNodeHighlight();
    }

    super.render(renderer);
  }

  set edges(edges: InspectableEdge[] | null) {
    this.#edges = edges;
    this.#isDirty = true;
  }

  get edges() {
    return this.#edges;
  }

  set nodes(nodes: InspectableNode[] | null) {
    this.#nodes = nodes;
    this.#isDirty = true;
  }

  get nodes() {
    return this.#nodes;
  }

  set ports(ports: Map<string, InspectableNodePorts> | null) {
    this.#ports = ports;
    this.#isDirty = true;
  }

  get ports() {
    return this.#ports;
  }

  set highlightedNodeId(highlightedNodeId: string | null) {
    this.#highlightedNodeId = highlightedNodeId;
    this.#drawNodeHighlight();
  }

  get highlightedNodeId() {
    return this.#highlightedNodeId;
  }

  findEdge(id: string, port: GraphNodePort): GraphEdge | null {
    if (!this.#edges) {
      return null;
    }

    const predicateForInputPorts = (edge: InspectableEdge) =>
      edge.to.descriptor.id === id && edge.in === port.name;
    const predicateForOutputPorts = (edge: InspectableEdge) =>
      edge.from.descriptor.id === id && edge.out === port.name;

    const edge = this.#edges.find(
      port.type === GraphNodePortType.IN
        ? predicateForInputPorts
        : predicateForOutputPorts
    );

    if (!edge) {
      return null;
    }

    return this.#edgeGraphics.get(edge) || null;
  }

  #onChildMoved(this: { graph: Graph; id: string }, x: number, y: number) {
    this.graph.setNodeLayoutPosition(
      this.id,
      this.graph.toGlobal({ x, y }),
      false
    );

    this.graph.#drawEdges();
    this.graph.#drawNodeHighlight();
  }

  #drawNodeHighlight() {
    if (!this.#nodeById) {
      return;
    }

    if (!this.#highlightedNodeId) {
      this.#highlightedNode.clear();
      return;
    }

    const graphNode = this.#nodeById.get(this.#highlightedNodeId);
    if (!graphNode) {
      return;
    }

    this.#highlightedNode.clear();
    this.#highlightedNode.lineStyle({ width: 5, color: 0xff04a4, alpha: 0.5 });
    this.#highlightedNode.drawRoundedRect(
      graphNode.x - this.#highlightPadding,
      graphNode.y - this.#highlightPadding,
      graphNode.width + (this.#highlightPadding - 1) * 2,
      graphNode.height + (this.#highlightPadding - 1) * 2,
      graphNode.borderRadius + this.#highlightPadding
    );

    this.addChild(this.#highlightedNode);
  }

  #drawNodes() {
    if (!this.#nodes || !this.#ports) {
      return;
    }

    /**
     * We only position the graph on the initial draw, and we need the graph to
     * be drawn before we can query its dimensions. So we check the layout map,
     * which should only be empty on the first render. We then track each node
     * render, and when all have drawn we notify the graph itself that it can
     * centralize the graph.
     */
    const isInitialDraw = this.#layout.size === 0;
    let nodesLeftToDraw = this.#nodes.length;
    const onDraw = function (this: GraphNode) {
      this.off(GRAPH_NODE_DRAWN, onDraw, this);
      nodesLeftToDraw--;

      if (nodesLeftToDraw === 0) {
        this.parent.emit(GRAPH_INITIAL_DRAW);
      }
    };

    const adjustLayoutForDroppedNode = function (this: {
      graphNode: GraphNode;
      layout: { x: number; y: number; pendingSize?: boolean };
    }) {
      this.graphNode.off(GRAPH_NODE_DRAWN, adjustLayoutForDroppedNode, this);
      this.layout.x -= this.graphNode.width / 2;
      this.layout.y -= this.graphNode.height / 2;
      this.layout.pendingSize = false;

      this.graphNode.position.set(this.layout.x, this.layout.y);
    };

    for (const node of this.#nodes) {
      const { id } = node.descriptor;
      let graphNode = this.#nodeById.get(id);
      if (!graphNode) {
        graphNode = new GraphNode(id, node.descriptor.type, node.title());
        this.#nodeById.set(id, graphNode);

        // This is a dropped node.
        const layout = this.#layout.get(id);
        if (layout && layout.pendingSize) {
          graphNode.on(GRAPH_NODE_DRAWN, adjustLayoutForDroppedNode, {
            graphNode,
            layout,
          });
        }
      }

      const portInfo = this.#ports.get(id);
      if (!portInfo) {
        console.warn(`Unable to locate port info for ${id}`);
        continue;
      }

      graphNode.name = id;
      graphNode.inPorts = portInfo.inputs.ports;
      graphNode.outPorts = portInfo.outputs.ports;

      graphNode.forceUpdateDimensions();
      graphNode.on(GRAPH_NODE_MOVED, this.#onChildMoved, {
        graph: this,
        id,
      });

      if (isInitialDraw) {
        graphNode.on(GRAPH_NODE_DRAWN, onDraw, graphNode);
      }

      this.addChild(graphNode);
    }

    this.layout();
  }

  // TODO: Merge this with below.
  createTemporaryEdge(edge: InspectableEdge): GraphEdge | null {
    const fromNode = this.#nodeById.get(edge.from.descriptor.id);
    const toNode = this.#nodeById.get(edge.to.descriptor.id);

    if (!(fromNode && toNode)) {
      return null;
    }

    const edgeGraphic = new GraphEdge(fromNode, toNode, true);
    edgeGraphic.edge = edge;
    this.#edgeContainer.addChild(edgeGraphic);

    return edgeGraphic;
  }

  #drawEdges() {
    if (!this.#edges) {
      return;
    }

    for (const edge of this.#edges) {
      let edgeGraphic = this.#edgeGraphics.get(edge);
      if (!edgeGraphic) {
        const fromNode = this.#nodeById.get(edge.from.descriptor.id);
        const toNode = this.#nodeById.get(edge.to.descriptor.id);

        // Only create the edge when the nodes are present.
        if (!(fromNode && toNode)) {
          continue;
        }
        edgeGraphic = new GraphEdge(fromNode, toNode);

        this.#edgeGraphics.set(edge, edgeGraphic);
        this.#edgeContainer.addChild(edgeGraphic);
      }

      edgeGraphic.edge = edge;
    }

    // If there's a mismatch of sizes it likely means an edge has been removed
    // so find that edge and dispose of it.

    if (this.#edgeGraphics.size !== this.#edges.length) {
      for (const [edge, edgeGraphic] of this.#edgeGraphics) {
        if (this.#edges.includes(edge)) {
          continue;
        }

        edgeGraphic.clear();
        edgeGraphic.removeFromParent();
        edgeGraphic.destroy();
        this.#edgeGraphics.delete(edge);
      }
    }

    this.addChildAt(this.#edgeContainer, 0);
  }
}

@customElement("bb-graph-renderer")
export class GraphRenderer extends LitElement {
  #app = new PIXI.Application({
    background: "rgb(244, 247, 252)",
    resizeTo: this,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio,
    eventMode: "static",
    eventFeatures: {
      globalMove: true,
      move: true,
      click: true,
      wheel: true,
    },
  });
  #padding = 50;
  #container = new PIXI.Container();
  #background: PIXI.TilingSprite | null = null;

  static styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }

    canvas {
      display: block;
    }
  `;

  @property({ reflect: true })
  editable = false;

  constructor(
    private minScale = 0.1,
    private maxScale = 4,
    private zoomFactor = 100
  ) {
    super();

    this.#app.stage.addChild(this.#container);
    this.#app.stage.eventMode = "static";

    let lastClickTime = Number.NEGATIVE_INFINITY;
    this.#app.stage.on(
      "pointerdown",
      function (this: GraphRenderer, evt) {
        const interactionTracker = InteractionTracker.instance();
        const activeGraphNodePort = interactionTracker.activeGraphNodePort;
        const activeGraphNode = interactionTracker.activeGraphNode;
        const activeGraph = interactionTracker.activeGraph;
        const target =
          activeGraphNodePort || activeGraphNode || this.#container;

        const now = window.performance.now();
        const timeDelta = now - lastClickTime;
        lastClickTime = now;

        // Double click - edit the node.
        if (timeDelta < 500 && target instanceof GraphNode) {
          interactionTracker.clear();
          this.dispatchEvent(new GraphNodeDblClickEvent(target.id));
          return;
        }

        let onPointerUp: (evt: PointerEvent) => void;
        let onPointerMove: (evt: PointerEvent) => void;
        if (activeGraphNodePort && activeGraphNode && activeGraph) {
          if (!this.editable) {
            return;
          }

          if (!activeGraphNode.name) {
            console.warn("Unnamed graph node.");
            return;
          }

          let edgeGraphic = activeGraph.findEdge(
            activeGraphNode.name,
            activeGraphNodePort
          );

          let snapToPort = true;
          let portType = activeGraphNodePort.type;
          if (!edgeGraphic) {
            edgeGraphic = activeGraph.createTemporaryEdge({
              from: { descriptor: { id: activeGraphNode.name } },
              to: { descriptor: { id: activeGraphNode.name } },
              out: activeGraphNodePort.name,
              in: activeGraphNodePort.name,
            } as InspectableEdge);

            // Swap the port type for temporary edges because if we're dragging
            // from an OUT port we are inherently creating an IN port elsewhere.
            portType =
              portType === GraphNodePortType.IN
                ? GraphNodePortType.OUT
                : GraphNodePortType.IN;
            snapToPort = false;
          }

          if (!edgeGraphic || !edgeGraphic.edge) {
            console.warn("Unable to create graphic");
            return;
          }

          // Hide a temporary edge until the user drags it away.
          if (edgeGraphic.temporary) {
            edgeGraphic.visible = false;
          }

          // Snapshot some values here so that we can use them whenever the
          // user hovers and we need to start tracking again.
          const overrideBaseLocation = activeGraphNodePort.position.clone();
          const edgeIn = edgeGraphic.edge.in;
          const edgeOut = edgeGraphic.edge.out;
          const toNode = edgeGraphic.toNode;
          const fromNode = edgeGraphic.fromNode;

          onPointerMove = () => {
            if (!edgeGraphic || !edgeGraphic.edge) {
              return;
            }

            edgeGraphic.forceRedraw();

            // If hovering over a port, snap to it.
            if (
              interactionTracker.hoveredGraphNode &&
              interactionTracker.hoveredGraphNodePort &&
              portType === interactionTracker.hoveredGraphNodePort.type &&
              snapToPort
            ) {
              edgeGraphic.overrideInLocation = null;
              edgeGraphic.overrideOutLocation = null;

              const name = interactionTracker.hoveredGraphNodePort.name || "";
              if (portType === GraphNodePortType.IN) {
                edgeGraphic.edge.in = name;
                edgeGraphic.toNode = interactionTracker.hoveredGraphNode;
              } else {
                edgeGraphic.edge.out = name;
                edgeGraphic.fromNode = interactionTracker.hoveredGraphNode;
              }

              interactionTracker.hoveredGraphNodePort.active = true;
              return;
            }

            // Otherwise track to the mouse.
            if (
              interactionTracker.hoveredGraphNodePort === null &&
              !snapToPort
            ) {
              snapToPort = true;
              edgeGraphic.visible = true;
            }

            if (portType === GraphNodePortType.IN) {
              if (!edgeGraphic.overrideInLocation) {
                edgeGraphic.overrideInLocation = overrideBaseLocation;
                edgeGraphic.edge.in = edgeIn;
                edgeGraphic.edge.out = edgeOut;
                edgeGraphic.toNode = toNode;
                edgeGraphic.fromNode = fromNode;
              }

              activeGraphNode.toLocal(
                evt.global,
                undefined,
                edgeGraphic.overrideInLocation
              );
            } else {
              if (!edgeGraphic.overrideOutLocation) {
                edgeGraphic.overrideOutLocation = overrideBaseLocation;
                edgeGraphic.edge.in = edgeIn;
                edgeGraphic.edge.out = edgeOut;
                edgeGraphic.toNode = toNode;
                edgeGraphic.fromNode = fromNode;
              }

              activeGraphNode.toLocal(
                evt.global,
                undefined,
                edgeGraphic.overrideOutLocation
              );
            }
          };

          onPointerUp = () => {
            if (edgeGraphic && edgeGraphic.temporary) {
              edgeGraphic.removeFromParent();
              edgeGraphic.destroy();
            }

            // Snapshot everything we need, then clear it out. After that we
            // do the value processing.
            const hoveredGraphNode = interactionTracker.hoveredGraphNode;
            const hoveredGraphNodePort =
              interactionTracker.hoveredGraphNodePort;
            const activeGraphNodePort = interactionTracker.activeGraphNodePort;
            const hoveredGraphNodePortType =
              interactionTracker.hoveredGraphNodePort?.type;

            interactionTracker.clear();
            document.removeEventListener("pointermove", onPointerMove);

            if (
              // The ports exist
              hoveredGraphNodePort &&
              activeGraphNodePort &&
              // The port types match
              hoveredGraphNodePortType === portType
            ) {
              // Update existing.
              if (!edgeGraphic || !edgeGraphic.edge) {
                console.warn("Unable to attach - no edge found");
                return;
              }
              if (!hoveredGraphNode) {
                console.warn("Unable to attach - no node found");
                return;
              }
              const newTargetNodeName = hoveredGraphNode.name;
              const newTargetNodePortName = hoveredGraphNodePort.name;
              const newTargetNode = activeGraph.nodes?.find(
                (node) => node.descriptor.id === newTargetNodeName
              );
              if (!newTargetNode || !newTargetNodePortName) {
                console.warn("Unable to attach - no edge found");
                return;
              }

              // Reset the original edge.
              const from = edgeGraphic.edge;
              from.in = edgeIn;
              from.out = edgeOut;

              // Create the new edge from the original.
              let to: InspectableEdge;
              if (portType === GraphNodePortType.IN) {
                to = {
                  ...edgeGraphic.edge,
                  in: newTargetNodePortName,
                  to: newTargetNode,
                };
              } else {
                to = {
                  ...edgeGraphic.edge,
                  out: newTargetNodePortName,
                  from: newTargetNode,
                };
              }

              if (edgeGraphic.temporary) {
                this.dispatchEvent(new GraphNodeEdgeAttach(to));
              } else {
                this.dispatchEvent(new GraphNodeEdgeChange(from, to));
              }
            } else {
              if (!edgeGraphic || !edgeGraphic.edge) {
                console.warn("Unable to update - no edge found");
                return;
              }

              if (edgeGraphic.temporary) {
                return;
              }

              // Detach.
              this.dispatchEvent(new GraphNodeEdgeDetach(edgeGraphic.edge));
            }
          };
        } else {
          const zIndex = target.parent.children.length;
          const dragStart = this.#app.stage.toLocal(evt.global);
          const originalPosition = target.position.clone();

          let tilePosition: PIXI.ObservablePoint<unknown> | null = null;
          if (this.#background && target === this.#container) {
            tilePosition = this.#background.tilePosition.clone();
          }

          onPointerMove = () => {
            if (!dragStart) {
              return;
            }

            const dragPosition = this.#app.stage.toLocal(evt.global);
            let dragDeltaX = dragPosition.x - dragStart.x;
            let dragDeltaY = dragPosition.y - dragStart.y;

            if (target !== this.#container) {
              dragDeltaX /= this.#container.scale.x;
              dragDeltaY /= this.#container.scale.y;
            }

            target.x = originalPosition.x + dragDeltaX;
            target.y = originalPosition.y + dragDeltaY;
            target.zIndex = zIndex;

            // For container moves we update the background position.
            if (
              this.#background &&
              target === this.#container &&
              tilePosition
            ) {
              this.#background.tilePosition.x = tilePosition.x + dragDeltaX;
              this.#background.tilePosition.y = tilePosition.y + dragDeltaY;
            } else {
              target.emit(GRAPH_NODE_MOVED, target.x, target.y);
            }
          };

          onPointerUp = () => {
            if (target.zIndex) {
              target.zIndex = Math.max(0, target.parent.children.length - 1);
            }

            interactionTracker.clear();
            document.removeEventListener("pointermove", onPointerMove);
          };
        }

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp, { once: true });
      },
      this
    );

    this.#app.stage.on(
      "wheel",
      function (this: GraphRenderer, evt) {
        let delta = 1 + evt.deltaY / this.zoomFactor;
        const newScale = this.#container.scale.x * delta;
        if (newScale < this.minScale || newScale > this.maxScale) {
          delta = 1;
        }

        const pivot = this.#app.stage.toLocal(evt.global);
        const matrix = this.#scaleContainerAroundPoint(delta, pivot);

        if (!this.#background) {
          return;
        }

        this.#background.tileTransform.setFromMatrix(matrix);
      },
      this
    );
  }

  #scaleContainerAroundPoint(delta: number, pivot: PIXI.IPointData) {
    const m = new PIXI.Matrix();
    m.identity()
      .scale(this.#container.scale.x, this.#container.scale.y)
      .translate(this.#container.x, this.#container.y);

    // Update with the mousewheel position & delta.
    m.translate(-pivot.x, -pivot.y)
      .scale(delta, delta)
      .translate(pivot.x, pivot.y);

    // Apply back to the container.
    this.#container.transform.setFromMatrix(m);
    return m;
  }

  addGraph(graph: Graph) {
    graph.on(GRAPH_INITIAL_DRAW, () => {
      const graphPosition = graph.getGlobalPosition();
      const graphBounds = graph.getBounds();
      const rendererBounds = this.getBoundingClientRect();

      // Dagre isn't guaranteed to start the layout at 0, 0, so we adjust things
      // back here so that the scaling calculations work out.
      graphBounds.x -= graphPosition.x;
      graphBounds.y -= graphPosition.y;
      graph.position.set(-graphBounds.x, -graphBounds.y);
      this.#container.position.set(
        (rendererBounds.width - graphBounds.width) * 0.5,
        (rendererBounds.height - graphBounds.height) * 0.5
      );
      const delta = Math.min(
        (rendererBounds.width - 2 * this.#padding) / graphBounds.width,
        (rendererBounds.height - 2 * this.#padding) / graphBounds.height,
        1
      );

      if (delta < this.minScale) {
        this.minScale = delta;
      }

      const pivot = {
        x: rendererBounds.width / 2,
        y: rendererBounds.height / 2,
      };
      this.#scaleContainerAroundPoint(delta, pivot);

      graph.layout();
    });

    this.#container.addChild(graph);
  }

  removeGraph(graph: Graph) {
    graph.removeFromParent();
    graph.destroy();
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.#app.resize();
    this.#app.renderer.addListener("resize", () => {
      if (!this.#background) {
        return;
      }

      this.#background.width = this.#app.renderer.width;
      this.#background.height = this.#app.renderer.height;
    });

    if (!this.#background) {
      PIXI.Texture.fromURL("/images/pattern.png").then((texture) => {
        console.log("Loaded texture");

        this.#background = new PIXI.TilingSprite(texture);
        this.#background.width = this.#app.renderer.width;
        this.#background.height = this.#app.renderer.height;

        this.#app.stage.addChildAt(this.#background, 0);
      });
    } else {
      this.#app.stage.addChildAt(this.#background, 0);
    }
  }

  render() {
    return html`${this.#app.view}`;
  }
}

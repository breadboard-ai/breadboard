/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectablePort, PortStatus } from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import { GRAPH_OPERATIONS, GraphNodePortType } from "./types.js";
import { GraphNodePort } from "./graph-node-port.js";
import { GraphOverflowMenu } from "./graph-overflow-menu.js";

const documentStyles = getComputedStyle(document.documentElement);

function getGlobalColor(name: string, defaultValue = "#333333") {
  const value = documentStyles.getPropertyValue(name)?.replace(/^#/, "");
  return parseInt(value || defaultValue, 16);
}

const borderColor = getGlobalColor("--bb-neutral-300");
const nodeTextColor = getGlobalColor("--bb-neutral-900");

const defaultNodeColor = getGlobalColor("--bb-nodes-100");
const inputNodeColor = getGlobalColor("--bb-inputs-100");
const secretNodeColor = getGlobalColor("--bb-inputs-100");
const outputNodeColor = getGlobalColor("--bb-output-100");
// TODO: Enable board node coloring.
// const boardNodeColor = getGlobalColor('--bb-boards-100');

const DBL_CLICK_DELTA = 450;

export class GraphNode extends PIXI.Graphics {
  #width = 0;
  #height = 0;

  #isDirty = true;
  #id = "";
  #type = "";
  // A title that is provided in the constructor, not
  // the one that shows up in the graph.
  #nodeTitle = "";
  // The title that shows up in the graph.
  #title = "";
  #titleText: PIXI.Text | null = null;
  #borderRadius = 8;
  #color = nodeTextColor;
  #titleTextColor = nodeTextColor;
  #portTextColor = nodeTextColor;
  #borderColor = borderColor;
  #selectedColor = 0x0084ff;
  #textSize = 12;
  #backgroundColor = 0x333333;
  #padding = 10;
  #menuPadding = 4;
  #portLabelVerticalPadding = 5;
  #portLabelHorizontalPadding = 20;
  #portPadding = 6;
  #portRadius = 3;
  #inPorts: Map<
    string,
    { port: InspectablePort; label: PIXI.Text; nodePort: GraphNodePort } | null
  > = new Map();
  #outPorts: Map<
    string,
    { port: InspectablePort; label: PIXI.Text; nodePort: GraphNodePort } | null
  > = new Map();
  #inPortLocations: Map<string, PIXI.ObservablePoint<unknown>> = new Map();
  #outPortLocations: Map<string, PIXI.ObservablePoint<unknown>> = new Map();
  #editable = false;
  #selected = false;
  #collapsed = false;
  #emitCollapseToggleEventOnNextDraw = false;

  #overflowMenu = new GraphOverflowMenu();
  #headerInPort = new GraphNodePort(GraphNodePortType.IN);
  #headerOutPort = new GraphNodePort(GraphNodePortType.OUT);
  #lastClickTime = 0;

  constructor(id: string, type: string, title: string) {
    super();

    this.#nodeTitle = title;
    this.id = id;
    this.type = type;

    switch (type) {
      case "input":
        this.color = inputNodeColor;
        break;

      case "secrets":
        this.color = secretNodeColor;
        break;

      case "output":
        this.color = outputNodeColor;
        break;

      default:
        this.color = defaultNodeColor;
        break;
    }

    this.backgroundColor = 0xffffff;
    this.portTextColor = nodeTextColor;

    this.eventMode = "static";
    this.cursor = "pointer";

    this.addChild(this.#headerInPort);
    this.addChild(this.#headerOutPort);

    this.#headerInPort.editable = false;
    this.#headerOutPort.editable = false;

    this.#headerInPort.visible = false;
    this.#headerOutPort.visible = false;

    this.#overflowMenu.on(
      GRAPH_OPERATIONS.GRAPH_NODE_MENU_CLICKED,
      (location: PIXI.ObservablePoint) => {
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MENU_REQUESTED, this, location);
      }
    );
  }

  addPointerEventListeners() {
    let dragStart: PIXI.IPointData | null = null;
    let originalPosition: PIXI.ObservablePoint<unknown> | null = null;
    let hasMoved = false;

    this.addEventListener("click", (evt: PIXI.FederatedPointerEvent) => {
      const clickDelta = window.performance.now() - this.#lastClickTime;
      this.#lastClickTime = window.performance.now();

      if (clickDelta > DBL_CLICK_DELTA) {
        return;
      }

      if (!this.#titleText) {
        return;
      }

      const titleHeight =
        this.#padding + this.#titleText.height + this.#padding;

      const nodeGlobal = this.getBounds();
      const titleY = this.toGlobal({ x: 0, y: titleHeight }).y;

      const isInHeaderArea =
        evt.global.x > nodeGlobal.left &&
        evt.global.x < nodeGlobal.right &&
        evt.global.y > nodeGlobal.top &&
        evt.global.y < titleY;

      if (!isInHeaderArea) {
        return;
      }

      this.collapsed = !this.collapsed;
      this.#lastClickTime = 0;
    });

    this.addEventListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      if (!(evt.target instanceof GraphNode)) {
        return;
      }

      hasMoved = false;
      dragStart = evt.global.clone();
      originalPosition = this.position.clone();
    });

    this.addEventListener(
      "globalpointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!dragStart || !originalPosition) {
          return;
        }

        const scale = this.worldTransform.a;
        const dragPosition = evt.global;
        const dragDeltaX = (dragPosition.x - dragStart.x) / scale;
        const dragDeltaY = (dragPosition.y - dragStart.y) / scale;

        this.x = Math.round(originalPosition.x + dragDeltaX);
        this.y = Math.round(originalPosition.y + dragDeltaY);
        hasMoved = true;

        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, false);
      }
    );

    const onPointerUp = () => {
      dragStart = null;
      originalPosition = null;
      if (!hasMoved) {
        return;
      }

      hasMoved = false;
      this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, true);
    };

    this.addEventListener("pointerupoutside", onPointerUp);
    this.addEventListener("pointerup", onPointerUp);
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

  get nodeTitle() {
    return this.#nodeTitle;
  }

  set nodeTitle(nodeTitle: string) {
    this.#nodeTitle = nodeTitle;
    if (!this.#titleText) {
      return;
    }

    this.#titleText.text = this.#nodeTitle;
    this.#isDirty = true;
  }

  get selected() {
    return this.#selected;
  }

  set selected(selected: boolean) {
    this.#selected = selected;
    this.#isDirty = true;
  }

  get collapsed() {
    return this.#collapsed;
  }

  set collapsed(collapsed: boolean) {
    this.#collapsed = collapsed;
    this.#emitCollapseToggleEventOnNextDraw = true;
    this.#isDirty = true;
  }

  get type() {
    return this.#type;
  }

  set type(type: string) {
    this.#type = type;
    this.#title = `${this.#nodeTitle}`;
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

  set editable(editable: boolean) {
    this.#editable = editable;
  }

  get editable() {
    return this.#editable;
  }

  render(renderer: PIXI.Renderer): void {
    super.render(renderer);

    if (this.#isDirty) {
      this.#isDirty = false;
      this.clear();
      this.#draw();

      this.emit(GRAPH_OPERATIONS.GRAPH_NODE_DRAWN);
    }

    if (this.#emitCollapseToggleEventOnNextDraw) {
      this.#emitCollapseToggleEventOnNextDraw = false;
      this.emit(GRAPH_OPERATIONS.GRAPH_NODE_EXPAND_COLLAPSE);
    }
  }

  set inPorts(ports: InspectablePort[]) {
    for (const port of ports) {
      let portItem = this.#inPorts.get(port.name);
      if (!portItem) {
        const label = new PIXI.Text(port.title, {
          fontFamily: "Arial",
          fontSize: this.#textSize,
          fill: this.#portTextColor,
          align: "left",
        });

        this.addChild(label);
        label.visible = false;

        const nodePort = new GraphNodePort(GraphNodePortType.IN);
        this.addChild(nodePort);
        nodePort.visible = false;

        portItem = { label, port, nodePort };
        this.#inPorts.set(port.name, portItem);
      }

      if (portItem.label.text !== port.title) {
        portItem.label.text = port.title;
      }

      portItem.port = port;
    }

    for (const [inPortName, portItem] of this.#inPorts) {
      if (!ports.find((inPort) => inPort.name === inPortName)) {
        portItem?.label.removeFromParent();
        portItem?.label?.destroy();

        portItem?.nodePort.removeFromParent();
        portItem?.nodePort.destroy();

        this.#inPorts.delete(inPortName);
      }
    }

    this.#isDirty = true;
  }

  set outPorts(ports: InspectablePort[]) {
    for (const port of ports) {
      let portItem = this.#outPorts.get(port.name);
      if (!portItem) {
        const label = new PIXI.Text(port.title, {
          fontFamily: "Arial",
          fontSize: this.#textSize,
          fill: this.#portTextColor,
          align: "right",
        });

        this.addChild(label);
        label.visible = false;

        const nodePort = new GraphNodePort(GraphNodePortType.OUT);
        this.addChild(nodePort);
        nodePort.visible = false;

        portItem = { label, port, nodePort };
        this.#outPorts.set(port.name, portItem);
      }

      if (portItem.label.text !== port.title) {
        portItem.label.text = port.title;
      }

      portItem.port = port;
    }

    for (const [outPortName, portItem] of this.#outPorts) {
      if (!ports.find((outPort) => outPort.name === outPortName)) {
        portItem?.label.removeFromParent();
        portItem?.label.destroy();

        portItem?.nodePort.removeFromParent();
        portItem?.nodePort.destroy();

        this.#outPorts.delete(outPortName);
      }
    }

    this.#isDirty = true;
  }

  forceUpdateDimensions() {
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

    // Only add the port heights on when the node is expanded.
    if (!this.collapsed) {
      height += this.#padding + portCount * portRowHeight + this.#padding;
    }

    // Width calculations.
    let width =
      this.#padding +
      (this.#titleText?.width || 0) +
      this.#padding +
      GraphOverflowMenu.width +
      this.#menuPadding;
    const inPortLabels = Array.from(this.#inPorts.values());
    const outPortLabels = Array.from(this.#outPorts.values());
    for (let p = 0; p < portCount; p++) {
      const inPortWidth = inPortLabels[p]?.label.width || 0;
      const outPortWidth = outPortLabels[p]?.label.width || 0;

      width = Math.max(
        width,
        this.#padding + // Left hand side.
          this.#portPadding + // Left hand port padding on right.
          inPortWidth + // Left label at this row.
          2 * this.#portLabelHorizontalPadding + // Port label padding for both sides.
          outPortWidth + // Right label at this row.
          this.#portPadding + // Right hand port padding on right.
          this.#padding // Right hand side padding.
      );
    }

    this.#width = width;
    this.#height = height;
  }

  #draw() {
    this.forceUpdateDimensions();
    this.#drawBackground();
    const portStartY = this.#drawTitle();

    if (this.collapsed) {
      this.#hideAllPorts();
      this.#showHeaderPorts();
    } else {
      this.#drawInPorts(portStartY);
      this.#drawOutPorts(portStartY);
      this.#hideHeaderPorts();
    }
    this.#drawOverflowMenu();
  }

  #drawOverflowMenu() {
    this.addChild(this.#overflowMenu);

    const titleHeight =
      this.#padding + (this.#titleText?.height || 0) + this.#padding;

    this.#overflowMenu.x =
      this.#width - this.#menuPadding - GraphOverflowMenu.width;
    this.#overflowMenu.y = (titleHeight - GraphOverflowMenu.height) * 0.5;
  }

  #showHeaderPorts() {
    this.#headerInPort.visible = true;
    this.#headerOutPort.visible = true;

    const titleHeight =
      this.#padding + (this.#titleText?.height || 0) + this.#padding;

    this.#headerInPort.y = titleHeight / 2;
    this.#headerOutPort.y = titleHeight / 2;

    this.#headerInPort.x = 0;
    this.#headerOutPort.x = this.#width;

    let inPortStatus = this.#headerInPort.status;
    for (const inPort of this.#inPorts.values()) {
      if (!inPort) {
        continue;
      }

      if (inPort.port.status === PortStatus.Connected) {
        inPortStatus = PortStatus.Connected;
        break;
      }
    }

    if (inPortStatus !== this.#headerInPort.status) {
      this.#headerInPort.status = inPortStatus;
    }

    let outPortStatus = this.#headerOutPort.status;
    for (const outPort of this.#outPorts.values()) {
      if (!outPort) {
        continue;
      }

      if (outPort.port.status === PortStatus.Connected) {
        outPortStatus = PortStatus.Connected;
        break;
      }
    }

    if (outPortStatus !== this.#headerOutPort.status) {
      this.#headerOutPort.status = outPortStatus;
    }
  }

  #hideHeaderPorts() {
    this.#headerInPort.visible = false;
    this.#headerOutPort.visible = false;
  }

  #hideAllPorts() {
    for (const portItem of this.#inPorts.values()) {
      if (!portItem) {
        continue;
      }

      portItem.label.visible = false;
      portItem.nodePort.visible = false;
    }

    for (const portItem of this.#outPorts.values()) {
      if (!portItem) {
        continue;
      }

      portItem.label.visible = false;
      portItem.nodePort.visible = false;
    }

    this.#inPortLocations.clear();
    this.#outPortLocations.clear();
  }

  #drawBackground() {
    if (this.selected) {
      const borderSize = 2;
      this.beginFill(this.#selectedColor);
      this.drawRoundedRect(
        -borderSize,
        -borderSize,
        this.#width + 2 * borderSize,
        this.#height + 2 * borderSize,
        this.#borderRadius + borderSize
      );
      this.endFill();
    }

    const borderSize = 1;
    this.beginFill(this.#borderColor);
    this.drawRoundedRect(
      -borderSize,
      -borderSize,
      this.#width + 2 * borderSize,
      this.#height + 2 * borderSize,
      this.#borderRadius + borderSize
    );
    this.endFill();

    this.beginFill(this.#backgroundColor);
    this.drawRoundedRect(0, 0, this.#width, this.#height, this.#borderRadius);
    this.endFill();

    if (this.#titleText) {
      const titleHeight =
        this.#padding + this.#titleText.height + this.#padding;
      this.beginFill(this.#color);
      this.drawRoundedRect(0, 0, this.#width, titleHeight, this.#borderRadius);

      if (!this.collapsed) {
        this.drawRect(
          0,
          titleHeight - 2 * this.#borderRadius,
          this.#width,
          2 * this.#borderRadius
        );
      }
      this.endFill();
    }
  }

  #drawTitle() {
    let portStartY = 0;
    if (this.#titleText) {
      this.#titleText.eventMode = "none";
      this.#titleText.x = this.#padding;
      this.#titleText.y = this.#padding;
      this.addChild(this.#titleText);

      const titleHeight =
        this.#padding + this.#titleText.height + this.#padding;

      // Move the labels a padding's distance from the bottom of the title.
      portStartY += titleHeight + this.#padding;
    }

    return portStartY;
  }

  #drawInPorts(portStartY = 0) {
    this.#inPortLocations.clear();
    const portRowHeight = this.#textSize + 2 * this.#portLabelVerticalPadding;

    let portY = portStartY;
    for (const [portName, portItem] of this.#inPorts) {
      if (!portItem) {
        console.warn(`No data for ${portName}`);
        continue;
      }

      const { port, label, nodePort } = portItem;
      nodePort.name = portName;
      nodePort.radius = this.#portRadius;
      nodePort.x = 0;
      nodePort.y = portY + label.height * 0.5;
      nodePort.editable = this.editable;
      nodePort.status = port.status;
      nodePort.visible = true;

      this.#inPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x + this.#portRadius + this.#portPadding;
      label.y = portY;
      label.eventMode = "none";
      label.visible = true;

      portY += portRowHeight;
    }
  }

  #drawOutPorts(portStartY = 0) {
    this.#outPortLocations.clear();
    const portRowHeight = this.#textSize + 2 * this.#portLabelVerticalPadding;

    let portY = portStartY;
    for (const [portName, portItem] of this.#outPorts) {
      if (!portItem) {
        console.warn(`No label for ${portName}`);
        continue;
      }

      const { port, label, nodePort } = portItem;
      nodePort.name = port.name;
      nodePort.radius = this.#portRadius;
      nodePort.x = this.#width;
      nodePort.y = portY + label.height * 0.5;
      nodePort.editable = this.editable;
      nodePort.status = port.status;
      nodePort.visible = true;

      this.#outPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x - this.#portRadius - this.#portPadding - label.width;
      label.y = portY;
      label.eventMode = "none";
      label.visible = true;

      portY += portRowHeight;
    }
  }

  inPortLocation(name: string): PIXI.ObservablePoint<unknown> | null {
    if (this.collapsed) {
      return this.#headerInPort.position;
    }

    return this.#inPortLocations.get(name) || null;
  }

  outPortLocation(name: string): PIXI.ObservablePoint<unknown> | null {
    if (this.collapsed) {
      return this.#headerOutPort.position;
    }

    return this.#outPortLocations.get(name) || null;
  }
}

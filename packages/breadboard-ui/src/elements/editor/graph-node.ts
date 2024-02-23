/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectablePort } from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import { InteractionTracker } from "./interaction-tracker.js";
import { GRAPH_NODE_DRAWN, GraphNodePortType } from "./types.js";
import { GraphNodePort } from "./graph-node-port.js";

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
  #editable = false;
  #selected = false;
  #background = new PIXI.Graphics();
  #selectedBackground = new PIXI.Graphics();

  public edgeColor: number;
  public portConnectedColor: number;

  constructor(id: string, type: string, title: string) {
    super();

    this.#nodeTtitle = title;
    this.id = id;
    this.type = type;
    this.edgeColor = 0xcccccc;

    switch (type) {
      case "input":
        this.color = 0xc9daf8;
        this.edgeColor = 0xb1c1dc;
        this.portConnectedColor = 0xaced8f;
        this.titleTextColor = 0x2c5598;
        break;

      case "secrets":
        this.color = 0xf4cccc;
        this.edgeColor = 0xdeb5b5;
        this.portConnectedColor = 0xaced8f;
        this.titleTextColor = 0xac342a;
        break;

      case "output":
        this.color = 0xb6d7a8;
        this.edgeColor = 0xbdd2b5;
        this.portConnectedColor = 0xaced8f;
        this.titleTextColor = 0x2a5a15;
        break;

      case "slot":
      case "passthrough":
        this.color = 0xead1dc;
        this.edgeColor = 0xe3a7c5;
        this.portConnectedColor = 0xaced8f;
        this.titleTextColor = 0x87365e;
        break;

      default:
        this.color = 0xfff2cc;
        this.edgeColor = 0xe4d2b6;
        this.portConnectedColor = 0xaced8f;
        this.titleTextColor = 0xb3772c;
        break;
    }

    this.backgroundColor = 0xffffff;
    this.portTextColor = 0x333333;

    this.eventMode = "static";
    this.#background.cursor = "pointer";

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

  get selected() {
    return this.#selected;
  }

  set selected(selected: boolean) {
    this.#selected = selected;
    if (selected) {
      this.addChildAt(this.#selectedBackground, 0);
    } else {
      this.#selectedBackground.removeFromParent();
    }
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
      this.#draw();

      // We use this to trigger the edge drawing.
      this.emit(GRAPH_NODE_DRAWN);
    }
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
    this.clear();

    this.removeChildren();
    this.addChildAt(this.#background, 0);
    if (this.selected) {
      this.addChildAt(this.#selectedBackground, 0);
    }

    this.#drawSelectedBackground();
    this.#drawBackground();
    const portStartY = this.#drawTitle();
    this.#drawInPorts(portStartY);
    this.#drawOutPorts(portStartY);
  }

  #drawSelectedBackground() {
    const borderSize = 2;
    this.#selectedBackground.clear();
    this.#selectedBackground.beginFill(0x999999);
    this.#selectedBackground.drawRoundedRect(
      -borderSize,
      -borderSize,
      this.#width + 2 * borderSize,
      this.#height + 2 * borderSize,
      this.#borderRadius + borderSize
    );
    this.#selectedBackground.endFill();
  }

  #drawBackground() {
    const borderSize = 1;
    this.#background.clear();
    this.#background.beginFill(0xbbbbbb);
    this.#background.drawRoundedRect(
      -borderSize,
      -borderSize,
      this.#width + 2 * borderSize,
      this.#height + 2 * borderSize,
      this.#borderRadius + borderSize
    );
    this.#background.endFill();

    this.#background.beginFill(this.#backgroundColor);
    this.#background.drawRoundedRect(
      0,
      0,
      this.#width,
      this.#height,
      this.#borderRadius
    );
    this.#background.endFill();

    if (this.#titleText) {
      const titleHeight =
        this.#padding + this.#titleText.height + this.#padding;
      this.#background.beginFill(this.#color);
      this.#background.drawRoundedRect(
        0,
        0,
        this.#width,
        titleHeight,
        this.#borderRadius
      );
      this.#background.drawRect(
        0,
        titleHeight - 2 * this.#borderRadius,
        this.#width,
        2 * this.#borderRadius
      );
      this.#background.endFill();
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
      nodePort.editable = this.editable;
      nodePort.status = port.status;
      nodePort.connectedColor = this.portConnectedColor;

      this.addChild(nodePort);
      this.#inPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x + this.#portRadius + this.#portPadding;
      label.y = portY;
      label.eventMode = "none";
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
      nodePort.editable = this.editable;
      nodePort.status = port.status;
      nodePort.connectedColor = this.portConnectedColor;

      this.addChild(nodePort);
      this.#outPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x - this.#portRadius - this.#portPadding - label.width;
      label.y = portY;
      label.eventMode = "none";
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

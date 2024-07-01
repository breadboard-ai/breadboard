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
import { GraphAssets } from "./graph-assets.js";
import { DBL_CLICK_DELTA, getGlobalColor } from "./utils.js";

const borderColor = getGlobalColor("--bb-neutral-500");
const nodeTextColor = getGlobalColor("--bb-neutral-900");

const defaultNodeColor = getGlobalColor("--bb-nodes-100");
const inputNodeColor = getGlobalColor("--bb-inputs-100");
const secretNodeColor = getGlobalColor("--bb-inputs-100");
const selectedNodeColor = getGlobalColor("--bb-ui-600");
const highlightForAdHocNodeColor = getGlobalColor("--bb-boards-500");
const outputNodeColor = getGlobalColor("--bb-boards-200");

const ICON_SCALE = 0.42;

export class GraphNode extends PIXI.Container {
  #width = 0;
  #height = 0;

  #isDirty = true;
  #id = "";
  #type = "";
  #title = "";
  #titleText: PIXI.Text | null = null;
  #borderRadius = 8;
  #color = nodeTextColor;
  #titleTextColor = nodeTextColor;
  #portTextColor = nodeTextColor;
  #borderColor = borderColor;
  #selectedColor = selectedNodeColor;
  #highlightForAdHocColor = highlightForAdHocNodeColor;
  #textSize = 12;
  #backgroundColor = 0x333333;
  #padding = 10;
  #menuPadding = 4;
  #iconPadding = 8;
  #portLabelVerticalPadding = 5;
  #portLabelHorizontalPadding = 20;
  #portPadding = 6;
  #portRadius = 3;
  #background = new PIXI.Graphics();
  #inPorts: InspectablePort[] | null = null;
  #inPortsData: Map<
    string,
    { port: InspectablePort; label: PIXI.Text; nodePort: GraphNodePort } | null
  > = new Map();
  #inPortsSortedByName: Array<{
    port: InspectablePort;
    label: PIXI.Text;
    nodePort: GraphNodePort;
  }> = [];
  #outPorts: InspectablePort[] | null = null;
  #outPortsData: Map<
    string,
    { port: InspectablePort; label: PIXI.Text; nodePort: GraphNodePort } | null
  > = new Map();
  #outPortsSortedByName: Array<{
    port: InspectablePort;
    label: PIXI.Text;
    nodePort: GraphNodePort;
  }> = [];
  #inPortLocations: Map<string, PIXI.ObservablePoint> = new Map();
  #outPortLocations: Map<string, PIXI.ObservablePoint> = new Map();
  #editable = false;
  #selected = false;
  #highlightForAdHoc = false;
  #collapsed = false;
  #emitCollapseToggleEventOnNextDraw = false;

  #showNodeTypeDescriptions = false;
  #overflowMenu = new GraphOverflowMenu();
  #headerInPort = new GraphNodePort(GraphNodePortType.IN);
  #headerOutPort = new GraphNodePort(GraphNodePortType.OUT);
  #lastClickTime = 0;
  #icon: string | null = null;
  #iconSprite: PIXI.Sprite | null = null;

  readOnly = false;

  constructor(
    id: string,
    type: string,
    title: string,
    public fixedInputs = true,
    public fixedOutputs = true
  ) {
    super();

    this.title = title;
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

    this.#background.eventMode = "auto";
    this.addChild(this.#background);
    this.addChild(this.#headerInPort);
    this.addChild(this.#headerOutPort);

    this.#headerInPort.label = "_header-port-in";
    this.#headerOutPort.label = "_header-port-out";
    this.#headerInPort.visible = false;
    this.#headerOutPort.visible = false;

    this.#overflowMenu.on(
      GRAPH_OPERATIONS.GRAPH_NODE_MENU_CLICKED,
      (location: PIXI.ObservablePoint) => {
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MENU_REQUESTED, this, location);
      }
    );

    this.onRender = () => {
      if (this.#isDirty) {
        this.#isDirty = false;
        this.#draw();

        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_DRAWN);
      }

      if (this.#emitCollapseToggleEventOnNextDraw) {
        this.#emitCollapseToggleEventOnNextDraw = false;
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_EXPAND_COLLAPSE);
      }
    };
  }

  addPointerEventListeners() {
    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let hasMoved = false;

    this.addEventListener("click", (evt: PIXI.FederatedPointerEvent) => {
      if (this.readOnly) {
        return;
      }

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

    this.addEventListener("pointerover", () => {
      if (this.readOnly) {
        return;
      }

      this.cursor = "pointer";
    });

    this.addEventListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      if (
        !(evt.target instanceof GraphNode) ||
        !evt.isPrimary ||
        this.readOnly
      ) {
        return;
      }

      hasMoved = false;
      dragStart = evt.global.clone();
      originalPosition = this.position.clone();
    });

    this.addEventListener(
      "globalpointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!dragStart || !originalPosition || !evt.isPrimary) {
          return;
        }

        const scale = this.worldTransform.a;
        const dragPosition = evt.global;
        const dragDeltaX = (dragPosition.x - dragStart.x) / scale;
        const dragDeltaY = (dragPosition.y - dragStart.y) / scale;

        this.x = Math.round(originalPosition.x + dragDeltaX);
        this.y = Math.round(originalPosition.y + dragDeltaY);
        hasMoved = true;

        this.cursor = "grabbing";
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
      this.cursor = "pointer";
      this.emit(GRAPH_OPERATIONS.GRAPH_NODE_MOVED, this.x, this.y, true);
    };

    this.addEventListener("pointerupoutside", onPointerUp);
    this.addEventListener("pointerup", onPointerUp);
  }

  get id() {
    return this.#id;
  }

  set id(id: string) {
    this.#id = id;
  }

  get title() {
    return this.#title;
  }

  set title(title: string) {
    this.#title = title;
    this.#isDirty = true;
  }

  get icon() {
    return this.#icon;
  }

  set icon(icon: string | null) {
    this.#icon = icon;
    if (icon) {
      if (!this.#iconSprite) {
        const texture = GraphAssets.instance().get(icon);
        this.#iconSprite = texture ? new PIXI.Sprite(texture) : null;

        if (this.#iconSprite) {
          this.#iconSprite.scale.x = ICON_SCALE;
          this.#iconSprite.scale.y = ICON_SCALE;
        }
      }
    } else {
      this.#iconSprite = null;
    }

    this.#isDirty = true;
  }

  set showNodeTypeDescriptions(showNodeTypeDescriptions: boolean) {
    if (this.#showNodeTypeDescriptions === showNodeTypeDescriptions) {
      return;
    }

    this.#showNodeTypeDescriptions = showNodeTypeDescriptions;
    this.#isDirty = true;
  }

  get showNodeTypeDescriptions() {
    return this.#showNodeTypeDescriptions;
  }

  get selected() {
    return this.#selected;
  }

  set selected(selected: boolean) {
    this.#selected = selected;
    this.#isDirty = true;
  }

  get highlightForAdHoc() {
    return this.#highlightForAdHoc;
  }

  set highlightForAdHoc(highlightForAdHoc: boolean) {
    if (this.fixedInputs && this.fixedOutputs) {
      return;
    }

    this.#highlightForAdHoc = highlightForAdHoc;
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

  set inPorts(ports: InspectablePort[] | null) {
    this.#inPorts = ports;
    this.#isDirty = true;
    if (!ports) {
      return;
    }

    for (const port of ports) {
      let portItem = this.#inPortsData.get(port.name);
      if (!portItem) {
        const label = new PIXI.Text({
          text: port.title,
          style: {
            fontFamily: "Arial",
            fontSize: this.#textSize,
            fill: this.#portTextColor,
            align: "left",
          },
        });

        this.addChild(label);
        label.visible = false;

        const nodePort = new GraphNodePort(GraphNodePortType.IN);
        this.addChild(nodePort);
        nodePort.visible = false;

        portItem = { label, port, nodePort };
        this.#inPortsData.set(port.name, portItem);

        nodePort.addEventListener("mouseover", (event) => {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSEENTER,
            // Port objects can change! The local `port` variable we have might
            // get out of date, so we need to grab the latest version. (This
            // pattern repeated a few times below).
            this.#inPortsData.get(port.name)?.port,
            event.client
          );
        });
        nodePort.addEventListener("mouseleave", (event) => {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSELEAVE,
            this.#inPortsData.get(port.name)?.port,
            event.client
          );
        });
      }

      if (portItem.label.text !== port.title) {
        portItem.label.text = port.title;
      }

      portItem.port = port;
    }

    for (const [inPortName, portItem] of this.#inPortsData) {
      if (!ports.find((inPort) => inPort.name === inPortName)) {
        portItem?.label.removeFromParent();
        portItem?.label?.destroy();

        portItem?.nodePort.removeFromParent();
        portItem?.nodePort.destroy();

        this.#inPortsData.delete(inPortName);
      }
    }

    this.#inPortsSortedByName.length = 0;
    for (const portItem of this.#inPortsData.values()) {
      if (!portItem) {
        continue;
      }

      this.#inPortsSortedByName.push(portItem);
    }

    this.#inPortsSortedByName.sort((portA, portB) => {
      if (portA.label.text > portB.label.text) {
        return 1;
      }

      return -1;
    });
  }

  get inPorts() {
    return this.#inPorts;
  }

  set outPorts(ports: InspectablePort[] | null) {
    this.#outPorts = ports;
    this.#isDirty = true;
    if (!ports) {
      return;
    }

    for (const port of ports) {
      let portItem = this.#outPortsData.get(port.name);
      if (!portItem) {
        const label = new PIXI.Text({
          text: port.title,
          style: {
            fontFamily: "Arial",
            fontSize: this.#textSize,
            fill: this.#portTextColor,
            align: "right",
          },
        });

        this.addChild(label);
        label.visible = false;

        const nodePort = new GraphNodePort(GraphNodePortType.OUT);
        this.addChild(nodePort);
        nodePort.visible = false;

        portItem = { label, port, nodePort };
        this.#outPortsData.set(port.name, portItem);

        nodePort.addEventListener("mouseover", (event) => {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSEENTER,
            this.#outPortsData.get(port.name)?.port,
            event.client
          );
        });
        nodePort.addEventListener("mouseleave", (event) => {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSELEAVE,
            this.#outPortsData.get(port.name)?.port,
            event.client
          );
        });
      }

      if (portItem.label.text !== port.title) {
        portItem.label.text = port.title;
      }

      portItem.port = port;
    }

    for (const [outPortName, portItem] of this.#outPortsData) {
      if (!ports.find((outPort) => outPort.name === outPortName)) {
        portItem?.label.removeFromParent();
        portItem?.label.destroy();

        portItem?.nodePort.removeFromParent();
        portItem?.nodePort.destroy();

        this.#outPortsData.delete(outPortName);
      }
    }

    this.#outPortsSortedByName.length = 0;
    for (const portItem of this.#outPortsData.values()) {
      if (!portItem) {
        continue;
      }

      this.#outPortsSortedByName.push(portItem);
    }

    this.#outPortsSortedByName.sort((portA, portB) => {
      if (portA.label.text > portB.label.text) {
        return 1;
      }

      return -1;
    });
  }

  get outPorts() {
    return this.#outPorts;
  }

  forceUpdateDimensions() {
    this.#createTitleTextIfNeeded();
    this.#updateDimensions();
    this.#enforceEvenDimensions();
  }

  #createTitleTextIfNeeded() {
    const nodeTitle = `${this.#title}${this.showNodeTypeDescriptions ? ` (${this.#type})` : ""}`;
    if (this.#titleText) {
      if (this.#titleText.text !== nodeTitle) {
        this.#titleText.text = nodeTitle;
      }
      return;
    }

    this.#titleText = new PIXI.Text({
      text: nodeTitle,
      style: {
        fontFamily: "Arial",
        fontSize: this.#textSize,
        fill: this.#titleTextColor,
        align: "left",
      },
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
    const portCount = Math.max(this.#inPortsData.size, this.#outPortsData.size);

    // Height calculations.
    let height = this.#padding + (this.#titleText?.height || 0) + this.#padding;

    // Only add the port heights on when the node is expanded.
    if (!this.collapsed) {
      height += this.#padding + portCount * portRowHeight + this.#padding;
    }

    // Width calculations.
    let width =
      this.#padding +
      (this.#icon ? (this.#iconSprite?.width || 0) + this.#iconPadding : 0) +
      (this.#titleText?.width || 0) +
      this.#padding +
      GraphOverflowMenu.width +
      this.#menuPadding;
    const inPortLabels = Array.from(this.#inPortsData.values());
    const outPortLabels = Array.from(this.#outPortsData.values());
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

    this.#headerInPort.editable = this.editable;
    this.#headerOutPort.editable = this.editable;

    const titleHeight =
      this.#padding + (this.#titleText?.height || 0) + this.#padding;

    this.#headerInPort.y = titleHeight / 2;
    this.#headerOutPort.y = titleHeight / 2;

    this.#headerInPort.x = 0;
    this.#headerOutPort.x = this.#width;

    let connectedInPorts = 0;
    let inPortConfigured = false;
    for (const inPort of this.#inPortsData.values()) {
      if (!inPort) {
        continue;
      }

      if (inPort.port.status === PortStatus.Connected) {
        connectedInPorts++;
      }

      if (inPort.port.configured) {
        inPortConfigured = true;
      }
    }

    if (connectedInPorts > 0) {
      if (this.#headerInPort.status !== PortStatus.Connected) {
        this.#headerInPort.status = PortStatus.Connected;
      }

      if (connectedInPorts === 1) {
        if (this.#headerInPort.configured !== inPortConfigured) {
          this.#headerInPort.configured = inPortConfigured;
        }
      } else {
        if (this.#headerInPort.configured) {
          this.#headerInPort.configured = false;
        }
      }
    } else {
      if (this.#headerInPort.status !== PortStatus.Indeterminate) {
        this.#headerInPort.status = PortStatus.Indeterminate;
      }
    }

    let connectedOutPorts = 0;
    let outPortConfigured = false;
    for (const outPort of this.#outPortsData.values()) {
      if (!outPort) {
        continue;
      }

      if (outPort.port.status === PortStatus.Connected) {
        connectedOutPorts++;
      }

      if (outPort.port.configured) {
        outPortConfigured = true;
      }
    }

    if (connectedOutPorts > 0) {
      if (this.#headerOutPort.status !== PortStatus.Connected) {
        this.#headerOutPort.status = PortStatus.Connected;
      }

      if (connectedOutPorts === 1) {
        if (this.#headerOutPort.configured !== outPortConfigured) {
          this.#headerOutPort.configured = outPortConfigured;
        }
      } else {
        if (this.#headerOutPort.configured) {
          this.#headerOutPort.configured = false;
        }
      }
    } else {
      if (this.#headerOutPort.status !== PortStatus.Indeterminate) {
        this.#headerOutPort.status = PortStatus.Indeterminate;
      }
    }
  }

  #hideHeaderPorts() {
    this.#headerInPort.visible = false;
    this.#headerOutPort.visible = false;
  }

  #hideAllPorts() {
    for (const portItem of this.#inPortsData.values()) {
      if (!portItem) {
        continue;
      }

      portItem.label.visible = false;
      portItem.nodePort.visible = false;
    }

    for (const portItem of this.#outPortsData.values()) {
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
    // Toggling cacheAsBitmap back to false for the background seems to trip up
    // PIXI, so instead we swap it out for a new Graphics instance, and we
    // schedule its removal in the next frame.
    if (this.#background) {
      const existingBackground = this.#background;
      existingBackground.removeFromParent();
      requestAnimationFrame(() => {
        existingBackground.destroy();
      });

      this.#background = new PIXI.Graphics();
      this.#background.eventMode = "auto";
      this.addChildAt(this.#background, 0);
    }

    const borderSize = this.selected || this.#highlightForAdHoc ? 2 : 1;
    this.#background.beginPath();
    this.#background.roundRect(
      -borderSize,
      -borderSize,
      this.#width + 2 * borderSize,
      this.#height + 2 * borderSize,
      this.#borderRadius + borderSize
    );
    this.#background.closePath();
    this.#background.fill({
      color: this.#highlightForAdHoc
        ? this.#highlightForAdHocColor
        : this.selected
          ? this.#selectedColor
          : this.#borderColor,
    });

    this.#background.beginPath();
    this.#background.roundRect(
      0,
      0,
      this.#width,
      this.#height,
      this.#borderRadius
    );
    this.#background.closePath();
    this.#background.fill({ color: this.#backgroundColor });

    if (this.#titleText) {
      const titleHeight =
        this.#padding + this.#titleText.height + this.#padding;
      this.#background.beginPath();
      this.#background.roundRect(
        0,
        0,
        this.#width,
        titleHeight,
        this.#borderRadius
      );

      if (!this.collapsed) {
        this.#background.rect(
          0,
          titleHeight - 2 * this.#borderRadius,
          this.#width,
          2 * this.#borderRadius
        );
      }
      this.#background.closePath();
      this.#background.fill({ color: this.#color });
    }
  }

  #drawTitle() {
    const titleHeight =
      this.#padding + (this.#titleText?.height || 0) + this.#padding;

    let titleStartX = this.#padding;
    if (this.#iconSprite) {
      this.#iconSprite.scale.x = ICON_SCALE;
      this.#iconSprite.scale.y = ICON_SCALE;
      this.#iconSprite.eventMode = "none";
      this.#iconSprite.x = titleStartX;
      this.#iconSprite.y = (titleHeight - this.#iconSprite.height) / 2;
      titleStartX += this.#iconSprite.width + this.#iconPadding;
      this.addChild(this.#iconSprite);
    }

    let portStartY = 0;
    if (this.#titleText) {
      this.#titleText.eventMode = "none";
      this.#titleText.x = titleStartX;
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
    for (const portItem of this.#inPortsSortedByName) {
      const { port, label, nodePort } = portItem;
      nodePort.label = port.name;
      nodePort.radius = this.#portRadius;
      nodePort.x = 0;
      nodePort.y = portY + label.height * 0.5;
      nodePort.editable = this.editable;
      nodePort.overrideStatus = null;
      nodePort.status = port.status;
      nodePort.configured = port.configured && port.edges.length === 0;
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
    for (const portItem of this.#outPortsSortedByName) {
      const { port, label, nodePort } = portItem;
      nodePort.label = port.name;
      nodePort.radius = this.#portRadius;
      nodePort.x = this.#width;
      nodePort.y = portY + label.height * 0.5;
      nodePort.editable = this.editable;
      nodePort.overrideStatus = null;
      nodePort.status = port.status;
      nodePort.configured = port.configured && port.edges.length === 0;
      nodePort.visible = true;

      this.#outPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x - this.#portRadius - this.#portPadding - label.width;
      label.y = portY;
      label.eventMode = "none";
      label.visible = true;

      portY += portRowHeight;
    }
  }

  inPortLocation(name: string): PIXI.ObservablePoint | null {
    if (this.collapsed) {
      return this.#headerInPort.position;
    }

    return this.#inPortLocations.get(name) || null;
  }

  outPortLocation(name: string): PIXI.ObservablePoint | null {
    if (this.collapsed) {
      return this.#headerOutPort.position;
    }

    return this.#outPortLocations.get(name) || null;
  }
}

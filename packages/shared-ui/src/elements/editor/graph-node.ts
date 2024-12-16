/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableModules,
  InspectablePort,
  NodeIdentifier,
  PortIdentifier,
  PortStatus,
} from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import {
  ComponentExpansionState,
  GRAPH_OPERATIONS,
  GraphNodePortType,
  GraphNodeReferences,
} from "./types.js";
import { GraphNodePort } from "./graph-node-port.js";
import { GraphOverflowMenu } from "./graph-overflow-menu.js";
import { GraphAssets } from "./graph-assets.js";
import {
  computeNextExpansionState,
  DBL_CLICK_DELTA,
  getGlobalColor,
} from "./utils.js";
import { GraphNodePortList } from "./graph-node-port-list.js";
import { GraphPortLabel as GraphNodePortLabel } from "./graph-port-label.js";
import { ComponentActivityItem } from "../../types/types.js";
import { GraphNodeActivityMarker } from "./graph-node-activity-marker.js";
import { GraphNodeReferenceContainer } from "./graph-node-reference-container.js";
import {
  isBoardArrayBehavior,
  isBoardBehavior,
  isConfigurableBehavior,
} from "../../utils/index.js";

const borderColor = getGlobalColor("--bb-neutral-500");
const nodeTextColor = getGlobalColor("--bb-neutral-900");
const segmentDividerColor = getGlobalColor("--bb-neutral-300");
const portsDividerColor = getGlobalColor("--bb-neutral-100");

const selectedNodeColor = getGlobalColor("--bb-ui-600");
const highlightForAdHocNodeColor = getGlobalColor("--bb-boards-500");
const highlightForBoardPortNodeColor = getGlobalColor("--bb-joiner-500");

const ICON_SCALE = 0.42;
const ICON_ALPHA_OVER = 1;
const ICON_ALPHA_OUT = 0.7;
const MIN_NODE_WIDTH = 200;
const MAX_NODE_TITLE_LENGTH = 30;

export class GraphNode extends PIXI.Container {
  #width = 0;
  #height = 0;

  #isDirty = true;
  #id = "";
  #type = "";
  #title = "";
  #titleText: PIXI.Text | null = null;
  #typeTitle: string;
  #borderRadius = 8;
  #color = nodeTextColor;

  #titleTextColor = nodeTextColor;
  #titleTextSize = 14;

  #portTextColor = nodeTextColor;
  #borderColor = borderColor;
  #segmentDividerColor = segmentDividerColor;
  #portsDividerColor = portsDividerColor;
  #selectedColor = selectedNodeColor;
  #highlightForAdHocColor = highlightForAdHocNodeColor;
  #highlightForBoardPortColor = highlightForBoardPortNodeColor;
  #textSize = 12;
  #backgroundColor = 0x333333;
  #padding = 12;
  #menuPadding = 8;
  #iconPadding = 8;
  #portLabelVerticalPadding = 8;
  #portRadius = 4;
  #background = new PIXI.Graphics();
  #collapsedPortList = new GraphNodePortList();
  #referenceContainer = new GraphNodeReferenceContainer();
  #references: GraphNodeReferences | null = null;
  #inPorts: InspectablePort[] | null = null;
  #inPortsData: Map<
    string,
    {
      port: InspectablePort;
      label: GraphNodePortLabel;
      nodePort: GraphNodePort;
    } | null
  > = new Map();
  #inPortsSortedByName: Array<{
    port: InspectablePort;
    label: GraphNodePortLabel;
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
  #inPortLocations: Map<PortIdentifier, PIXI.ObservablePoint> = new Map();
  #outPortLocations: Map<PortIdentifier, PIXI.ObservablePoint> = new Map();
  #modules: InspectableModules | null = null;
  #selected = false;
  #selectedReferences: Map<PortIdentifier, number[]> | null = null;
  #highlightForAdHoc = false;
  #highlightForBoardPort = false;
  #expansionState: ComponentExpansionState = "expanded";
  #emitCollapseToggleEventOnNextDraw = false;

  #showNodePreviewValues = false;
  #showNodeRunnerButton = false;
  #showBoardReferenceMarkers = false;

  #overflowMenu = new GraphOverflowMenu();
  #headerInPort = new GraphNodePort(GraphNodePortType.IN);
  #headerOutPort = new GraphNodePort(GraphNodePortType.OUT);
  #lastClickTime = 0;
  #icon: string | null = null;
  #iconSprite: PIXI.Sprite | null = null;

  #activityMarker = new GraphNodeActivityMarker();
  #runnerButton: PIXI.Sprite | null = null;

  readOnly = false;
  hitZone: PIXI.Rectangle | null = null;

  constructor(
    id: string,
    type: string,
    title: string,
    typeTitle: string,
    public fixedInputs = true,
    public fixedOutputs = true
  ) {
    super();

    this.title = title;
    this.id = id;
    this.type = type;
    this.#typeTitle = typeTitle;

    this.backgroundColor = 0xffffff;
    this.portTextColor = nodeTextColor;

    this.eventMode = "static";

    this.#background.eventMode = "auto";
    this.addChild(this.#background);
    this.addChild(this.#headerInPort);
    this.addChild(this.#headerOutPort);
    this.addChild(this.#collapsedPortList);
    this.addChild(this.#activityMarker);
    this.addChild(this.#referenceContainer);

    this.#referenceContainer.x = -10;
    this.#referenceContainer.y = 0;
    this.#referenceContainer.on(
      GRAPH_OPERATIONS.GRAPH_REFERENCE_TOGGLE_SELECTED,
      (portId: PortIdentifier, index: number, isCtrlCommand: boolean) => {
        this.emit(
          GRAPH_OPERATIONS.GRAPH_REFERENCE_TOGGLE_SELECTED,
          portId,
          index,
          isCtrlCommand
        );
      }
    );

    this.#referenceContainer.on(
      GRAPH_OPERATIONS.GRAPH_REFERENCE_GOTO,
      (...args: unknown[]) => {
        this.emit(GRAPH_OPERATIONS.GRAPH_REFERENCE_GOTO, ...args);
      }
    );

    const playIcon = GraphAssets.instance().get("play-filled");
    if (playIcon) {
      this.#runnerButton = new PIXI.Sprite(playIcon);
      this.#runnerButton.scale.x = ICON_SCALE;
      this.#runnerButton.scale.y = ICON_SCALE;
      this.#runnerButton.alpha = ICON_ALPHA_OUT;
      this.#runnerButton.cursor = "pointer";

      this.#runnerButton.addEventListener(
        "pointerover",
        (evt: PIXI.FederatedPointerEvent) => {
          evt.target.alpha = ICON_ALPHA_OVER;
          const message = "Run this component";
          const x = evt.clientX;
          const y = evt.clientY;

          this.emit(GRAPH_OPERATIONS.GRAPH_SHOW_TOOLTIP, message, x, y);
        }
      );

      this.#runnerButton.addEventListener(
        "pointerout",
        (evt: PIXI.FederatedPointerEvent) => {
          evt.target.alpha = ICON_ALPHA_OUT;

          this.emit(GRAPH_OPERATIONS.GRAPH_HIDE_TOOLTIP);
        }
      );

      this.#runnerButton.addEventListener("click", () => {
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_RUN_REQUESTED, this.label);
      });

      this.addChild(this.#runnerButton);
    }

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

    this.#activityMarker.on(
      GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED,
      (...args: unknown[]) => {
        this.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_ACTIVITY_SELECTED,
          this.title,
          ...args
        );
      }
    );

    this.#collapsedPortList.on(
      GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
      (...args: unknown[]) => {
        // Propagate to the parent graph.
        this.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
          this.label,
          ...args
        );
      }
    );

    this.onRender = () => {
      if (this.#isDirty) {
        this.#isDirty = false;
        this.#draw();
        this.#updateHitZone();

        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_DRAWN);
      }

      if (this.#emitCollapseToggleEventOnNextDraw) {
        this.#emitCollapseToggleEventOnNextDraw = false;
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_EXPAND_COLLAPSE);
      }
    };

    this.on("destroyed", () => {
      // Prevent future renderings.
      this.#isDirty = false;

      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });
  }

  addPointerEventListeners() {
    let dragStart: PIXI.PointData | null = null;
    let originalPosition: PIXI.ObservablePoint | null = null;
    let hasMoved = false;

    this.addEventListener("click", (evt: PIXI.FederatedPointerEvent) => {
      const clickDelta = window.performance.now() - this.#lastClickTime;
      this.#lastClickTime = window.performance.now();

      if (clickDelta > DBL_CLICK_DELTA) {
        return;
      }

      this.#lastClickTime = 0;
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

      const isMac = navigator.platform.indexOf("Mac") === 0;
      const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;
      if (isCtrlCommand) {
        this.expansionState = computeNextExpansionState(this.expansionState);
      } else {
        this.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_EDIT,
          this.label,
          evt.clientX,
          evt.clientY
        );
      }
      this.#lastClickTime = 0;
    });

    this.cursor = "pointer";

    let isMoveOp = false;
    let isCloneOp = false;
    let cursorStartPosition: PIXI.PointData | null = null;

    this.addEventListener("pointerdown", (evt: PIXI.FederatedPointerEvent) => {
      if (!(evt.target instanceof GraphNode) || !evt.isPrimary) {
        return;
      }

      hasMoved = false;
      dragStart = evt.global.clone();
      cursorStartPosition = { x: evt.screen.x, y: evt.screen.y };
      originalPosition = this.position.clone();
      isMoveOp = evt.shiftKey;
      isCloneOp = evt.altKey;
    });

    this.addEventListener(
      "globalpointermove",
      (evt: PIXI.FederatedPointerEvent) => {
        if (!dragStart || !originalPosition || !evt.isPrimary) {
          return;
        }

        const isSettled = false;

        const scale = this.worldTransform.a;
        const dragPosition = evt.global;
        const dragDeltaX = (dragPosition.x - dragStart.x) / scale;
        const dragDeltaY = (dragPosition.y - dragStart.y) / scale;

        this.cursor = "grabbing";
        hasMoved = true;

        const x = Math.round(originalPosition.x + dragDeltaX);
        const y = Math.round(originalPosition.y + dragDeltaY);

        this.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_MOVED,
          x,
          y,
          isSettled,
          isMoveOp,
          isCloneOp,
          dragPosition
        );
      }
    );

    const onPointerUp = (evt: PIXI.FederatedPointerEvent) => {
      if (!dragStart || !originalPosition || !evt.isPrimary) {
        return;
      }

      const scale = this.worldTransform.a;
      const dragPosition = evt.global;
      const dragDeltaX = (dragPosition.x - dragStart.x) / scale;
      const dragDeltaY = (dragPosition.y - dragStart.y) / scale;

      this.cursor = "grabbing";
      hasMoved = true;

      const x = Math.round(originalPosition.x + dragDeltaX);
      const y = Math.round(originalPosition.y + dragDeltaY);

      dragStart = null;
      originalPosition = null;
      if (!hasMoved) {
        isMoveOp = false;
        isCloneOp = false;
        return;
      }

      const isSettled = true;
      this.cursor = "pointer";
      this.emit(
        GRAPH_OPERATIONS.GRAPH_NODE_MOVED,
        x,
        y,
        isSettled,
        isMoveOp,
        isCloneOp,
        cursorStartPosition
      );

      cursorStartPosition = null;
      hasMoved = false;
      isMoveOp = false;
      isCloneOp = false;
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

  get borderColor() {
    return this.#borderColor;
  }

  set borderColor(borderColor: number) {
    this.#borderColor = borderColor;
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

  set showNodeRunnerButton(showNodeRunnerButton: boolean) {
    if (showNodeRunnerButton === this.#showNodeRunnerButton) {
      return;
    }

    this.#showNodeRunnerButton = showNodeRunnerButton;
    this.#isDirty = true;
  }

  get showNodeRunnerButton() {
    return this.#showNodeRunnerButton;
  }

  set showNodePreviewValues(showNodePreviewValues: boolean) {
    if (this.#showNodePreviewValues === showNodePreviewValues) {
      return;
    }

    this.#showNodePreviewValues = showNodePreviewValues;
    this.#isDirty = true;
  }

  get showNodePreviewValues() {
    return this.#showNodePreviewValues;
  }

  get selected() {
    return this.#selected;
  }

  set selected(selected: boolean) {
    this.#selected = selected;
    this.#isDirty = true;
  }

  set showBoardReferenceMarkers(showBoardReferenceMarkers: boolean) {
    this.#showBoardReferenceMarkers = showBoardReferenceMarkers;
    this.#isDirty = true;
  }

  get showBoardReferenceMarkers() {
    return this.#showBoardReferenceMarkers;
  }

  get references() {
    return this.#references;
  }

  set references(references: GraphNodeReferences | null) {
    this.#references = references;
    this.#isDirty = true;
  }

  set selectedReferences(
    selectedReferences: Map<PortIdentifier, number[]> | null
  ) {
    this.#selectedReferences = selectedReferences;
    this.#isDirty = true;
  }

  get selectedReferences() {
    return this.#selectedReferences;
  }

  get highlightForAdHoc() {
    return this.#highlightForAdHoc;
  }

  set highlightForAdHoc(highlightForAdHoc: boolean) {
    if (this.fixedInputs && this.fixedOutputs) {
      return;
    }

    if (highlightForAdHoc === this.#highlightForAdHoc) {
      return;
    }

    this.#highlightForAdHoc = highlightForAdHoc;
    this.#isDirty = true;
  }

  get highlightForBoardPort() {
    return this.#highlightForBoardPort;
  }

  set highlightForBoardPort(highlightForBoardPort: boolean) {
    if (highlightForBoardPort === this.#highlightForBoardPort) {
      return;
    }

    this.#highlightForBoardPort = highlightForBoardPort;
    this.#isDirty = true;
  }

  get expansionState() {
    return this.#expansionState;
  }

  set expansionState(state: ComponentExpansionState) {
    this.#expansionState = state;
    this.#emitCollapseToggleEventOnNextDraw = true;
    this.#isDirty = true;
    for (const child of this.children) {
      if (child instanceof GraphNodePortLabel) {
        child.expansionState = state;
      }
    }
  }

  get collapsed() {
    return this.#expansionState === "collapsed";
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

  set activity(activity: ComponentActivityItem[] | null) {
    this.#activityMarker.activity = activity;
  }

  get activity() {
    return this.#activityMarker.activity;
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

  set sidePorts(ports: InspectablePort[] | null) {
    if (!ports?.length) {
      return;
    }

    // TODO.
    // console.log("✨ got side ports", ports);
  }

  get sidePorts() {
    return null;
  }

  set modules(modules: InspectableModules | null) {
    this.#modules = modules;
    this.#isDirty = true;
  }

  get modules() {
    return this.#modules;
  }

  set inPorts(ports: InspectablePort[] | null) {
    this.#collapsedPortList.readOnly = this.readOnly;
    this.#collapsedPortList.inPorts = ports;
    this.#inPorts = ports;
    this.#isDirty = true;

    if (!ports) {
      return;
    }

    for (const port of ports) {
      let portItem = this.#inPortsData.get(port.name);
      if (!portItem) {
        const label = new GraphNodePortLabel(
          port,
          this.#showNodePreviewValues,
          this.#modules
        );
        label.expansionState = this.#expansionState;
        label.on(
          GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
          (...args: unknown[]) => {
            // Propagate to the parent graph.
            this.emit(
              GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
              this.label,
              ...args
            );
          }
        );

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

      portItem.label.readOnly = this.readOnly;
      portItem.label.showNodePreviewValues = this.showNodePreviewValues;
      portItem.label.port = port;
      portItem.port = port;
      portItem.nodePort.readOnly = this.readOnly;
    }

    for (const [inPortName, portItem] of this.#inPortsData) {
      if (!ports.find((inPort) => inPort.name === inPortName)) {
        portItem?.label.removeFromParent();
        portItem?.label.destroy({ children: true });

        portItem?.nodePort.removeFromParent();
        portItem?.nodePort.destroy({ children: true });

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
      // This is a bit of a gross hack to group items.
      // If the port name has dashes, it should be sorted to the bottom.
      // Enables grouping ports a bit. Just add dashes to the port names to
      // put them into a separate group.
      // TODO: Come up with a better way to group ports.
      const portAHasDashes = portA.port.name.includes("-");
      const portBHasDashes = portB.port.name.includes("-");
      if (portAHasDashes && !portBHasDashes) {
        return 1;
      }
      if (!portAHasDashes && portBHasDashes) {
        return -1;
      }
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

        nodePort.addEventListener("pointerover", (event) => {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_NODE_PORT_MOUSEENTER,
            this.#outPortsData.get(port.name)?.port,
            event.client
          );
        });
        nodePort.addEventListener("pointerleave", (event) => {
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
        portItem?.label.destroy({ children: true });

        portItem?.nodePort.removeFromParent();
        portItem?.nodePort.destroy({ children: true });

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
    let nodeTitle = this.#title;
    if (nodeTitle.length > MAX_NODE_TITLE_LENGTH) {
      nodeTitle = `${nodeTitle.slice(0, MAX_NODE_TITLE_LENGTH - 3)}...`;
    }

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
        fontSize: this.#titleTextSize,
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
    const portCount = Math.max(this.#inPortsData.size, this.#outPortsData.size);
    const collapsedPortListEmpty = this.#collapsedPortList.empty;
    const collapsedPortListDimension = this.#collapsedPortList.dimensions;

    // Height calculations.
    let height = this.#padding + (this.#titleText?.height || 0) + this.#padding;

    // Only add the port heights on when the node is expanded.
    if (this.collapsed && !collapsedPortListEmpty) {
      height += collapsedPortListDimension.height;
    }

    // Width calculations.
    let width =
      // Icon
      this.#padding +
      (this.#icon ? (this.#iconSprite?.width || 0) + this.#iconPadding : 0) +
      // Title
      (this.#titleText?.width || 0) +
      // ActivityMarker
      this.#padding +
      this.#activityMarker.dimensions.width +
      // Run Button
      this.#padding +
      (this.#runnerButton ? this.#runnerButton.width : 0) +
      // Menu
      this.#menuPadding +
      GraphOverflowMenu.width +
      this.#menuPadding;

    const inPortLabels = Array.from(this.#inPortsData.values());
    const outPortLabels = Array.from(this.#outPortsData.values());

    let maxInPortWidth = 0;
    let inPortHeight =
      this.collapsed || inPortLabels.length === 0 ? this.#padding : 0;
    for (let i = 0; i < inPortLabels.length; i++) {
      const inPort = inPortLabels[i];
      if (!inPort) {
        continue;
      }

      maxInPortWidth = Math.max(maxInPortWidth, inPort.label.dimensions.width);
      if (this.collapsed || this.#shouldHidePort(inPort.port)) {
        continue;
      }

      inPortHeight +=
        inPort.label.dimensions.height +
        (i < inPortLabels.length - 1 ? this.#portLabelVerticalPadding : 0);
    }

    let maxOutPortWidth = 0;
    let outPortHeight = 0;
    for (let i = 0; i < outPortLabels.length; i++) {
      const outPort = outPortLabels[i];
      if (!outPort) {
        continue;
      }

      maxOutPortWidth = Math.max(maxOutPortWidth, outPort.label.width);
      if (this.collapsed || this.#shouldHidePort(outPort.port, "$error")) {
        continue;
      }

      outPortHeight +=
        outPort.label.height +
        (i < outPortLabels.length - 1 ? this.#portLabelVerticalPadding : 0);
    }

    // If we have any output ports showing, add some padding.
    if (outPortHeight > 0) {
      outPortHeight += this.#padding;
    }

    width = Math.max(
      MIN_NODE_WIDTH,

      width,

      // Input Ports.
      2 * this.#padding + maxInPortWidth,

      // Output ports.
      2 * this.#padding + maxOutPortWidth
    );

    if (!this.collapsed && portCount > 0) {
      height += inPortHeight + outPortHeight;
      if (inPortHeight > 0) {
        height += 2 * this.#padding;
      }

      if (outPortHeight > 0) {
        height += this.#padding;
      }
    }

    if (!collapsedPortListEmpty && collapsedPortListDimension.width > width) {
      width = collapsedPortListDimension.width;
    }

    this.#width = width;
    this.#height = height;
  }

  #draw() {
    this.forceUpdateDimensions();
    const portStartY = this.#drawTitle();

    let portsOutStartY = null;
    if (this.collapsed) {
      this.#hideAllPorts();
      this.#showHeaderPorts();
    } else {
      portsOutStartY = this.#drawInPorts(portStartY + this.#padding);
      const portsOutEndY = this.#drawOutPorts(portsOutStartY);
      if (portsOutStartY === portsOutEndY) {
        portsOutStartY = null;
      }
      this.#hideHeaderPorts();
    }
    this.#drawBackground(portsOutStartY);
    this.#drawOverflowMenu();
    this.#drawCollapsedPortListIfNeeded();
    this.#drawActivityMarkerIfNeeded();
    this.#drawRunnerButtonIfNeeded();
    this.#drawReferences();
  }

  #updateHitZone() {
    this.hitZone = new PIXI.Rectangle(
      0,
      0,
      this.#background.width,
      this.#background.height
    );
  }

  #drawRunnerButtonIfNeeded() {
    if (!this.#runnerButton) {
      return;
    }

    const titleHeight =
      this.#padding + (this.#titleText?.height || 0) + this.#padding;

    const x =
      this.#width -
      this.#menuPadding * 2 -
      GraphOverflowMenu.width -
      this.#runnerButton.width;

    this.#runnerButton.x = x;
    this.#runnerButton.y = (titleHeight - this.#runnerButton.height) / 2;
    this.#runnerButton.visible = this.showNodeRunnerButton;
  }

  #drawActivityMarkerIfNeeded() {
    const titleHeight =
      this.#padding + (this.#titleText?.height || 0) + this.#padding;

    const x = // Icon
      this.#width -
      this.#menuPadding * 2 -
      GraphOverflowMenu.width -
      (this.#runnerButton ? this.#runnerButton.width : 0) -
      this.#padding -
      this.#activityMarker.dimensions.width;

    this.#activityMarker.x = x;
    this.#activityMarker.y =
      (titleHeight - this.#activityMarker.dimensions.height) * 0.5;
  }

  #drawCollapsedPortListIfNeeded() {
    this.#collapsedPortList.visible = this.collapsed;
    this.#collapsedPortList.y =
      this.#height - this.#collapsedPortList.dimensions.height;
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

    let missingInPorts = 0;
    let connectedInPorts = 0;
    let inPortConfigured = false;
    for (const inPort of this.#inPortsData.values()) {
      if (!inPort) {
        continue;
      }

      if (inPort.port.status === PortStatus.Missing) {
        missingInPorts++;
      }

      if (inPort.port.status === PortStatus.Connected) {
        connectedInPorts++;
      }

      if (inPort.port.configured) {
        inPortConfigured = true;
      }
    }

    if (missingInPorts > 0) {
      this.#headerInPort.status = PortStatus.Missing;
    } else if (connectedInPorts > 0) {
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

  #drawBackground(portsDivider: number | null = null) {
    // Toggling cacheAsBitmap back to false for the background seems to trip up
    // PIXI, so instead we swap it out for a new Graphics instance, and we
    // schedule its removal in the next frame.
    if (this.#background) {
      const existingBackground = this.#background;
      existingBackground.removeFromParent();
      requestAnimationFrame(() => {
        existingBackground.destroy({ children: true });
      });

      this.#background = new PIXI.Graphics();
      this.#background.eventMode = "auto";
      this.addChildAt(this.#background, 0);
    }

    const borderSize =
      this.selected || this.#highlightForAdHoc || this.#highlightForBoardPort
        ? 2
        : 1;
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
        : this.#highlightForBoardPort
          ? this.#highlightForBoardPortColor
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

    if (this.#titleText && !this.collapsed) {
      const titleHeight =
        this.#padding + this.#titleText.height + this.#padding;
      this.#background.beginPath();
      this.#background.moveTo(0, titleHeight);
      this.#background.lineTo(this.#width, titleHeight);
      this.#background.closePath();
      this.#background.stroke({ color: this.#segmentDividerColor });
    }

    // Collapsed Port List.
    const footerTop = Math.round(this.#height) + 0.5;
    if (this.collapsed && !this.#collapsedPortList.empty) {
      const y = footerTop - this.#collapsedPortList.dimensions.height;
      this.#background.beginPath();
      this.#background.moveTo(0, y);
      this.#background.lineTo(this.#width, y);
      this.#background.closePath();
      this.#background.stroke({ color: this.#segmentDividerColor });
    }

    if (portsDivider !== null) {
      // Ensure a clean line.
      portsDivider = Math.round(portsDivider) + 0.5;

      this.#background.beginPath();
      this.#background.moveTo(0, portsDivider);
      this.#background.lineTo(this.#width, portsDivider);
      this.#background.closePath();
      this.#background.stroke({ color: this.#portsDividerColor });
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
      portStartY += titleHeight;
    }

    return portStartY;
  }

  #drawInPorts(portStartY = 0) {
    this.#inPortLocations.clear();

    let portY = portStartY;
    for (let p = 0; p < this.#inPortsSortedByName.length; p++) {
      const portItem = this.#inPortsSortedByName[p];
      if (this.#shouldHidePort(portItem.port)) {
        continue;
      }
      const { port, label, nodePort } = portItem;
      const isBoard =
        isBoardBehavior(port.schema) || isBoardArrayBehavior(port.schema);
      const hidePortBubble =
        (isConfigurableBehavior(port.schema) || port.configured) &&
        !isBoard &&
        this.#expansionState !== "advanced" &&
        port.edges.length === 0;

      nodePort.label = port.name;
      nodePort.radius = hidePortBubble ? 0 : this.#portRadius;
      nodePort.x = 0;
      nodePort.y = portY + this.#textSize * 0.5 + 0.5;
      nodePort.overrideStatus = null;
      nodePort.status = port.status;
      nodePort.configured = port.configured && port.edges.length === 0;
      nodePort.visible = true;
      nodePort.readOnly =
        isConfigurableBehavior(port.schema) &&
        this.#expansionState !== "advanced";

      nodePort.showBoardReferenceMarker =
        isBoard && this.#showBoardReferenceMarkers;

      this.#inPortLocations.set(port.name, nodePort.position);

      label.x = this.#padding;
      label.y = portY;
      label.visible = true;

      portY +=
        label.dimensions.height +
        (p < this.#inPortsSortedByName.length - 1
          ? this.#portLabelVerticalPadding
          : 0);
    }

    return portY + this.#padding;
  }

  #drawOutPorts(portStartY = 0) {
    this.#outPortLocations.clear();

    let haveAddedPadding = false;
    let portY = portStartY;
    for (let p = 0; p < this.#outPortsSortedByName.length; p++) {
      const portItem = this.#outPortsSortedByName[p];
      if (this.#shouldHidePort(portItem.port, "$error")) {
        continue;
      }

      if (!haveAddedPadding) {
        haveAddedPadding = true;
        portY += this.#padding;
      }

      const { port, label, nodePort } = portItem;
      nodePort.label = port.name;
      nodePort.radius = this.#portRadius;
      nodePort.x = this.#width;
      nodePort.y = portY + label.height * 0.5;
      nodePort.overrideStatus = null;
      nodePort.status = port.status;
      nodePort.configured = port.configured && port.edges.length === 0;
      nodePort.visible = true;

      this.#outPortLocations.set(port.name, nodePort.position);

      label.x = nodePort.x - this.#padding - label.width;
      label.y = portY;
      label.eventMode = "none";
      label.visible = true;

      portY +=
        this.#textSize +
        (p < this.#outPortsSortedByName.length - 1
          ? this.#portLabelVerticalPadding
          : 0);
    }

    return portY;
  }

  /**
   * Note that these should be drawn after the ports so that the port locations
   * are known.
   */
  #drawReferences() {
    this.#referenceContainer.visible = this.#expansionState !== "collapsed";
    this.#referenceContainer.inPortLocations = this.#inPortLocations;
    this.#referenceContainer.references = this.#references;
    this.#referenceContainer.selectedReferences = this.#selectedReferences;

    this.addChildAt(this.#referenceContainer, 0);
  }

  referenceRects(): Array<{ id: string; rect: PIXI.Rectangle }> {
    return this.#referenceContainer.getReferenceRects();
  }

  intersectingBoardPort(
    point: PIXI.PointData
  ): { nodeId: NodeIdentifier; portId: PortIdentifier } | false {
    if (!this.#inPortsData) {
      return false;
    }

    for (const port of this.#inPortsData.values()) {
      if (!port) {
        continue;
      }

      if (
        port.label.getBounds().containsPoint(point.x, point.y) ||
        port.nodePort.getBounds().containsPoint(point.x, point.y)
      ) {
        if (
          isBoardBehavior(port.port.schema) ||
          isBoardArrayBehavior(port.port.schema)
        ) {
          return { nodeId: this.label, portId: port.port.name };
        }

        return false;
      }
    }
    return false;
  }

  inPortLocation(name: string): PIXI.ObservablePoint | null {
    if (this.expansionState === "collapsed") {
      return this.#headerInPort.position;
    }

    return this.#inPortLocations.get(name) || null;
  }

  outPortLocation(name: string): PIXI.ObservablePoint | null {
    if (this.expansionState === "collapsed") {
      return this.#headerOutPort.position;
    }

    return this.#outPortLocations.get(name) || null;
  }

  #shouldHidePort(port: InspectablePort | undefined, ...exclude: string[]) {
    if (!port) return true;
    if (this.expansionState === "advanced") {
      return false;
    }
    if (port.status === PortStatus.Connected) {
      return false;
    }
    if (port.star || port.name === "") {
      return true;
    }
    if (exclude.includes(port.name)) {
      return true;
    }
    return false;
  }
}

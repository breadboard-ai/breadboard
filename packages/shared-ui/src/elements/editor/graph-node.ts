/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("Editor");

import {
  InspectableModules,
  InspectablePort,
  NodeIdentifier,
  OutputValues,
  PortIdentifier,
  PortStatus,
} from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import {
  ComponentExpansionState,
  GRAPH_OPERATIONS,
  GraphNodeColorScheme,
  GraphNodePortType,
  GraphNodeReferences,
} from "./types.js";
import { GraphNodePort } from "./graph-node-port.js";
import { GraphAssets } from "./graph-assets.js";
import {
  computeNextExpansionState,
  DBL_CLICK_DELTA,
  getGlobalColor,
  GRID_SIZE,
  isConfigurablePort,
} from "./utils.js";
import { GraphNodePortList } from "./graph-node-port-list.js";
import { GraphPortLabel as GraphNodePortLabel } from "./graph-port-label.js";
import { GraphNodeReferenceContainer } from "./graph-node-reference-container.js";
import {
  isBoardArrayBehavior,
  isBoardBehavior,
  isConfigurableBehavior,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
} from "../../utils/index.js";
import { GraphNodeOutput } from "./graph-node-output.js";
import { isMainPortBehavior } from "../../utils/behaviors.js";
import { defaultColorScheme, GraphNodeColors } from "./graph-node-colors.js";

const borderColor = getGlobalColor("--bb-neutral-500");
const nodeTextColor = getGlobalColor("--bb-neutral-900");
const portsDividerColor = getGlobalColor("--bb-neutral-100");

const grabHandleColor = getGlobalColor("--bb-neutral-300");
const nodeBackgroundColor = getGlobalColor("--bb-neutral-0");
const highlightForAdHocNodeColor = getGlobalColor("--bb-boards-500");
const highlightForBoardPortNodeColor = getGlobalColor("--bb-joiner-500");

const edgeTextColor = getGlobalColor("--bb-neutral-600");
const edgeColor = getGlobalColor("--bb-neutral-200");
const edgeTextSize = 11;

const ICON_SCALE = 0.42;
const ICON_ALPHA_OVER = 1;
const ICON_ALPHA_OUT = 0.7;
const MAX_NODE_TITLE_LENGTH = 30;
const GRAPH_NODE_WIDTH = 260;
const MIN_OUTPUT_HEIGHT = 44;
const ARROW_HEAD_PADDING = 3;

const INITIAL_HEADER_PORT_LABEL = "_header-port";

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
  #titleTextSize = 14;
  #outputHeight = 44;

  #portTextColor = nodeTextColor;
  #borderColor = borderColor;
  #portsDividerColor = portsDividerColor;
  #highlightForAdHocColor = highlightForAdHocNodeColor;
  #highlightForBoardPortColor = highlightForBoardPortNodeColor;
  #textSize = 12;
  #backgroundColor = nodeBackgroundColor;
  #grabHandleColor = grabHandleColor;

  #padding = 12;
  #menuPadding = 8;
  #iconPadding = 8;
  #portLabelVerticalPadding = 8;
  #portRadius = 4;
  #background = new PIXI.Graphics();
  #grabHandle = new PIXI.Graphics();
  #quickAdd = new PIXI.Container();
  #quickAddIcon: PIXI.Sprite | null = null;
  #quickAddBackground = new PIXI.Graphics();
  #quickAddTitle = new PIXI.Text({
    text: Strings.from("LABEL_ADD_ITEM"),
    style: {
      fontFamily: "Arial",
      fontSize: edgeTextSize,
      fill: edgeTextColor,
      align: "left",
      lineHeight: 24,
    },
  });
  #collapsedPortList = new GraphNodePortList();
  #referenceContainer = new GraphNodeReferenceContainer();
  #references: GraphNodeReferences | null = null;

  #nodeOutput = new GraphNodeOutput();
  #nodeOutputMask = new PIXI.Graphics();

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
  #updating = true;
  #selected = false;
  #selectedReferences: Map<PortIdentifier, number[]> | null = null;
  #highlightForAdHoc = false;
  #highlightForBoardPort = false;
  #expansionState: ComponentExpansionState = "expanded";
  #emitCollapseToggleEventOnNextDraw = false;

  #showNodePreviewValues = false;
  #showNodeRunnerButton = false;
  #showBoardReferenceMarkers = false;

  #headerInPort = new GraphNodePort(GraphNodePortType.IN);
  #headerOutPort = new GraphNodePort(GraphNodePortType.OUT);
  #lastClickTime = 0;
  #icon: string | null = null;
  #iconSprite: PIXI.Sprite | null = null;
  #colorScheme: GraphNodeColorScheme = defaultColorScheme;

  #runnerButton: PIXI.Sprite | null = null;

  #canShowQuickAdd = false;
  readOnly = false;
  hitZone: PIXI.Rectangle | null = null;

  constructor(
    id: string,
    type: string,
    title: string,
    _typeTitle: string,
    public fixedInputs = true,
    public fixedOutputs = true
  ) {
    super();

    this.title = title;
    this.id = id;
    this.type = type;

    this.portTextColor = nodeTextColor;

    this.eventMode = "static";

    this.#background.eventMode = "auto";
    this.addChild(this.#background);
    this.addChild(this.#headerInPort);
    this.addChild(this.#headerOutPort);
    this.addChild(this.#collapsedPortList);
    this.addChild(this.#referenceContainer);

    this.#quickAdd.eventMode = "static";
    this.#quickAddTitle.eventMode = "none";
    this.#quickAddBackground.cursor = "pointer";
    const quickAddIcon = GraphAssets.instance().get("library-add");
    if (quickAddIcon) {
      this.#quickAddIcon = new PIXI.Sprite(quickAddIcon);
      this.#quickAddIcon.scale.x = ICON_SCALE;
      this.#quickAddIcon.scale.y = ICON_SCALE;
      this.#quickAdd.addChild(this.#quickAddIcon);
    }

    this.#quickAdd.addChild(this.#quickAddBackground);
    this.#quickAdd.addChild(this.#quickAddTitle);
    this.#quickAdd.addEventListener(
      "click",
      (evt: PIXI.FederatedPointerEvent) => {
        evt.stopImmediatePropagation();

        this.emit(
          GRAPH_OPERATIONS.GRAPH_NODE_QUICK_ADD,
          this.label,
          this.#headerOutPort.label,
          evt.x,
          evt.y,
          false
        );
      }
    );

    if (this.#hasVisibleOutputs()) {
      this.#grabHandle.beginPath();
      this.#grabHandle.moveTo(12, 2);
      this.#grabHandle.lineTo(2, 12);

      this.#grabHandle.moveTo(12, 6);
      this.#grabHandle.lineTo(6, 12);

      this.#grabHandle.moveTo(12, 10);
      this.#grabHandle.lineTo(10, 12);

      this.#grabHandle.stroke({
        color: this.#grabHandleColor,
        cap: "round",
        width: 1.5,
      });

      this.#grabHandle.closePath();
      this.#grabHandle.hitArea = new PIXI.Polygon([
        -2, -2, -2, 20, 20, 20, 20, -2,
      ]);

      let resizing = false;
      let resizeStart = 0;
      let outputSizeStart = 0;

      this.#grabHandle.addEventListener("pointerdown", (evt) => {
        resizing = true;
        resizeStart = evt.pageY;
        outputSizeStart = this.#outputHeight;
      });

      this.#grabHandle.addEventListener("globalpointermove", (evt) => {
        if (!resizing) {
          return;
        }

        const delta =
          Math.round(
            (evt.pageY - resizeStart) / this.worldTransform.a / GRID_SIZE
          ) * GRID_SIZE;
        this.outputHeight = outputSizeStart + delta;
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_RESIZED, false);
      });

      const stopResize = (evt: PIXI.FederatedPointerEvent) => {
        if (!resizing) {
          return;
        }

        const delta =
          Math.round(
            (evt.pageY - resizeStart) / this.worldTransform.a / GRID_SIZE
          ) * GRID_SIZE;
        this.outputHeight = outputSizeStart + delta;
        resizing = false;
        this.emit(GRAPH_OPERATIONS.GRAPH_NODE_RESIZED, true);
      };
      this.#grabHandle.addEventListener("pointerup", stopResize);
      this.#grabHandle.addEventListener("pointerupoutside", stopResize);

      this.addChild(this.#grabHandle);
      this.addChild(this.#nodeOutput);
    }

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

    this.#headerInPort.label = INITIAL_HEADER_PORT_LABEL;
    this.#headerOutPort.label = INITIAL_HEADER_PORT_LABEL;
    this.#headerInPort.visible = false;
    this.#headerOutPort.visible = false;

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

        const x =
          Math.round((originalPosition.x + dragDeltaX) / GRID_SIZE) * GRID_SIZE;
        const y =
          Math.round((originalPosition.y + dragDeltaY) / GRID_SIZE) * GRID_SIZE;

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

      const x =
        Math.round((originalPosition.x + dragDeltaX) / GRID_SIZE) * GRID_SIZE;
      const y =
        Math.round((originalPosition.y + dragDeltaY) / GRID_SIZE) * GRID_SIZE;

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

  set outputHeight(outputHeight: number) {
    if (outputHeight < MIN_OUTPUT_HEIGHT) {
      outputHeight = MIN_OUTPUT_HEIGHT;
    }

    if (outputHeight === this.#outputHeight) {
      return;
    }

    this.#outputHeight = outputHeight;
    this.#isDirty = true;
  }

  get outputHeight() {
    return this.#outputHeight;
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
          this.#colorScheme = GraphNodeColors.get(icon) || defaultColorScheme;
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

  get canShowQuickAdd() {
    return this.#canShowQuickAdd;
  }

  set canShowQuickAdd(canShowQuickAdd: boolean) {
    this.#canShowQuickAdd = canShowQuickAdd;
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
      if (portAHasDashes && portBHasDashes) {
        return portA.port.name.localeCompare(portB.port.name);
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

  set values(values: OutputValues[] | null) {
    this.#nodeOutput.values = values;
  }

  get values() {
    return this.#nodeOutput.values;
  }

  get updating() {
    return this.#updating;
  }

  set updating(value: boolean) {
    this.#updating = value;
  }

  #hasVisibleOutputs() {
    return this.type !== "input";
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
    const width = GRAPH_NODE_WIDTH;

    const inPortLabels = Array.from(this.#inPortsData.values());
    const outPortLabels = Array.from(this.#outPortsData.values());

    let inPortHeight =
      this.collapsed || inPortLabels.length === 0 ? this.#padding : 0;
    for (let i = 0; i < inPortLabels.length; i++) {
      const inPort = inPortLabels[i];
      if (!inPort) {
        continue;
      }

      if (this.collapsed || this.#shouldHidePort(inPort.port)) {
        continue;
      }

      inPortHeight +=
        inPort.label.dimensions.height +
        (i < inPortLabels.length - 1 ? this.#portLabelVerticalPadding : 0);
    }

    let outPortHeight = 0;
    for (let i = 0; i < outPortLabels.length; i++) {
      const outPort = outPortLabels[i];
      if (!outPort) {
        continue;
      }

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

    if (!this.collapsed && portCount > 0) {
      height += inPortHeight + outPortHeight;
      if (inPortHeight > 0) {
        height += 2 * this.#padding;
      }

      if (outPortHeight > 0) {
        height += this.#padding;
      }
    }

    if (this.#hasVisibleOutputs() && !this.collapsed) {
      height += this.#outputHeight;
    }

    this.#width = width;
    this.#height = height;
  }

  #isContextOnly() {
    if (!this.inPorts || !this.outPorts) {
      return true;
    }

    // Confirm that the only non-configurable ports are LLM ones
    for (const inPort of this.inPorts) {
      if (
        inPort.name === "" ||
        inPort.name === "*" ||
        inPort.star ||
        inPort.name === "$error"
      ) {
        continue;
      }

      if (
        !isConfigurablePort(inPort) &&
        !(
          isLLMContentBehavior(inPort.schema) ||
          isLLMContentArrayBehavior(inPort.schema)
        )
      ) {
        if (isBoardArrayBehavior(inPort.schema)) {
          continue;
        }

        return false;
      }
    }

    for (const outPort of this.outPorts) {
      if (
        outPort.name === "" ||
        outPort.name === "*" ||
        outPort.star ||
        outPort.name === "$error"
      ) {
        continue;
      }

      if (
        !isConfigurablePort(outPort) &&
        !(
          isLLMContentBehavior(outPort.schema) ||
          isLLMContentArrayBehavior(outPort.schema)
        )
      ) {
        return false;
      }
    }

    return true;
  }

  #draw() {
    this.forceUpdateDimensions();
    const portStartY = this.#drawTitle();

    let portsOutStartY = null;
    if (this.collapsed) {
      this.#hideAllPorts();
      this.#showHeaderPorts();
    } else {
      if (this.#isContextOnly()) {
        this.#showHeaderPorts();
      } else {
        this.#hideHeaderPorts();
      }

      portsOutStartY = this.#drawInPorts(portStartY + this.#padding);
      const portsOutEndY = this.#drawOutPorts(portsOutStartY);
      if (portsOutStartY === portsOutEndY) {
        portsOutStartY = null;
      }
    }
    this.#drawBackground(portsOutStartY);
    this.#drawCollapsedPortListIfNeeded();
    this.#drawRunnerButtonIfNeeded();
    this.#drawReferences();
    this.#drawNodeOutput();
    this.#drawQuickAddIfNeeded();
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

    const x = this.#width - this.#menuPadding - this.#runnerButton.width;

    this.#runnerButton.x = x;
    this.#runnerButton.y = (titleHeight - this.#runnerButton.height) / 2;
    this.#runnerButton.visible = this.showNodeRunnerButton;
  }

  #drawCollapsedPortListIfNeeded() {
    this.#collapsedPortList.visible = this.collapsed;
    this.#collapsedPortList.y =
      this.#height - this.#collapsedPortList.dimensions.height;
  }

  #initializeHeaderPorts(): boolean {
    if (this.updating) return false;
    if (
      this.#headerInPort.label !== INITIAL_HEADER_PORT_LABEL &&
      this.#headerInPort.label !== INITIAL_HEADER_PORT_LABEL
    ) {
      return true;
    }

    const inHeaderPort = pickPort(this.inPorts);
    if (!inHeaderPort) return false;

    const outHeaderPort = pickPort(this.outPorts);
    if (!outHeaderPort) return false;

    this.#headerInPort.label = inHeaderPort.name;
    this.#headerOutPort.label = outHeaderPort.name;

    return true;

    function pickPort(ports: InspectablePort[] | null) {
      if (!ports) return undefined;
      // Order of precedence:
      // 1) First "main-port" labeled port
      // 2) First LLMContent[] port
      // 3) Any first port
      let firstContext: InspectablePort | undefined = undefined;
      for (const port of ports) {
        if (isMainPortBehavior(port.schema)) {
          return port;
        }
        if (isLLMContentArrayBehavior(port.schema) && !firstContext) {
          firstContext = port;
        }
      }
      return firstContext || ports.at(0);
    }
  }

  #showHeaderPorts() {
    if (!this.#initializeHeaderPorts()) return;

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
          : this.#colorScheme.mainBorder,
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
      this.#background.moveTo(0, 0);
      this.#background.roundRect(
        0,
        0,
        this.#width,
        titleHeight,
        this.#borderRadius
      );
      this.#background.rect(
        0,
        titleHeight - this.#borderRadius,
        this.#width,
        this.#borderRadius
      );
      this.#background.closePath();
      this.#background.fill({ color: this.#colorScheme.background });

      if (!this.collapsed) {
        this.#background.beginPath();
        this.#background.moveTo(0, titleHeight);
        this.#background.lineTo(this.#width, titleHeight);
        this.#background.closePath();
        this.#background.stroke({ color: this.#colorScheme.headerBorder });
      }
    }

    // Collapsed Port List.
    const footerTop = Math.round(this.#height) + 0.5;
    if (this.collapsed && !this.#collapsedPortList.empty) {
      const y = footerTop - this.#collapsedPortList.dimensions.height;
      this.#background.beginPath();
      this.#background.moveTo(0, y);
      this.#background.lineTo(this.#width, y);
      this.#background.closePath();
      this.#background.stroke({ color: this.#colorScheme.headerBorder });
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

    if (this.#hasVisibleOutputs() && this.#expansionState !== "collapsed") {
      const y = Math.round(this.#height - this.#outputHeight) + 0.5;
      this.#background.beginPath();
      this.#background.moveTo(0, y);
      this.#background.lineTo(this.#width, y);
      this.#background.closePath();
      this.#background.stroke({ color: this.#colorScheme.headerBorder });

      this.#background.beginPath();
      this.#background.moveTo(0, y + 0.5);
      this.#background.rect(0, y + 0.5, this.#width, 4);
      this.#background.closePath();
      this.#background.fill({ color: this.#colorScheme.background });
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
      const { port, label, nodePort } = portItem;
      const isBoard =
        isBoardBehavior(port.schema) || isBoardArrayBehavior(port.schema);
      const hidePortBubble =
        (isConfigurableBehavior(port.schema) || port.configured) &&
        !isBoard &&
        this.#expansionState !== "advanced" &&
        port.edges.length === 0;

      if (this.#shouldHidePort(portItem.port)) {
        nodePort.visible = false;
        label.visible = false;
        continue;
      }

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
      label.expansionState = this.#expansionState;

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
      const { port, label, nodePort } = portItem;

      if (this.#shouldHidePort(portItem.port, "$error")) {
        nodePort.visible = false;
        label.visible = false;
        continue;
      }

      if (!haveAddedPadding) {
        haveAddedPadding = true;
        portY += this.#padding;
      }

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
    return;

    // TODO: Bring this back when references are clearer.
    this.#referenceContainer.visible = this.#expansionState !== "collapsed";
    this.#referenceContainer.inPortLocations = this.#inPortLocations;
    this.#referenceContainer.references = this.#references;
    this.#referenceContainer.selectedReferences = this.#selectedReferences;

    this.addChildAt(this.#referenceContainer, 0);
  }

  #drawNodeOutput() {
    if (this.#expansionState === "collapsed") {
      this.#nodeOutput.visible = false;
      this.#grabHandle.visible = false;
      return;
    }

    this.#nodeOutput.visible = true;
    this.#grabHandle.visible = true;

    this.#nodeOutput.x = 16;
    this.#nodeOutput.y = this.#height - this.#outputHeight + 16;

    this.addChild(this.#nodeOutputMask);
    this.#nodeOutputMask.clear();
    this.#nodeOutputMask.beginPath();
    this.#nodeOutputMask.rect(
      16,
      this.#height - this.#outputHeight + 16,
      this.#width,
      this.#outputHeight - 20
    );

    this.#nodeOutputMask.closePath();
    this.#nodeOutputMask.fill();

    this.#nodeOutput.setMask({ mask: this.#nodeOutputMask });
    this.#grabHandle.x = this.#width - 18;
    this.#grabHandle.y = this.#height - 18;
  }

  #isConnectedOut() {
    if (!this.#outPorts) {
      return false;
    }

    return this.#outPorts.some((port) => port.edges.length > 0);
  }

  #drawQuickAddIfNeeded() {
    if (!this.selected || this.#isConnectedOut() || !this.#canShowQuickAdd) {
      this.#quickAdd.removeFromParent();
      return;
    }

    const x = this.#width;
    const lineLength = 56;
    const lineWidth = 2;
    const padding = 4;
    const iconWidth = 20;

    const y = 7;
    const quickAddHeight = 24;
    const lineY = y + (quickAddHeight + lineWidth) * 0.5;

    this.addChildAt(this.#quickAdd, 0);

    // Title.
    this.#quickAddTitle.x = x + lineLength + iconWidth + 4 * padding;
    this.#quickAddTitle.y = y + 1;

    // Icon.
    if (this.#quickAddIcon) {
      this.#quickAddIcon.x = x + lineLength + 3 * padding;
      this.#quickAddIcon.y = y + 3;
      this.#quickAddIcon.alpha = 0.6;
    }

    // Arrow and rounded rect.
    this.#quickAddBackground.clear();
    this.#quickAddBackground.beginPath();
    this.#quickAddBackground.roundRect(
      x + lineLength + padding,
      y + 1,
      this.#quickAddTitle.width + 6 * padding + iconWidth,
      24
    );
    this.#quickAddBackground.closePath();
    this.#quickAddBackground.stroke({ color: edgeColor });
    this.#quickAddBackground.fill({ color: 0xffffff, alpha: 0.0001 });

    this.#quickAddBackground.beginPath();
    this.#quickAddBackground.moveTo(x, lineY);
    this.#quickAddBackground.lineTo(x + lineLength, lineY);
    this.#quickAddBackground.closePath();
    this.#quickAddBackground.stroke({ color: edgeColor, width: lineWidth });

    this.#quickAddBackground.beginPath();
    this.#quickAddBackground.moveTo(x + lineLength, lineY);
    this.#quickAddBackground.lineTo(
      x + lineLength - ARROW_HEAD_PADDING - 4,
      lineY - 6
    );
    this.#quickAddBackground.stroke({
      cap: "round",
      width: lineWidth,
      color: edgeColor,
    });
    this.#quickAddBackground.moveTo(x + lineLength, lineY);
    this.#quickAddBackground.lineTo(
      x + lineLength - ARROW_HEAD_PADDING - 4,
      lineY + 6
    );
    this.#quickAddBackground.stroke({
      cap: "round",
      width: lineWidth,
      color: edgeColor,
    });
    this.#quickAddBackground.closePath();
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
    if (this.expansionState === "collapsed" || this.#isContextOnly()) {
      return this.#headerInPort.position;
    }

    return this.#inPortLocations.get(name) || null;
  }

  outPortLocation(name: string): PIXI.ObservablePoint | null {
    if (this.expansionState === "collapsed" || this.#isContextOnly()) {
      return this.#headerOutPort.position;
    }

    return this.#outPortLocations.get(name) || null;
  }

  #shouldHidePort(port: InspectablePort | undefined, ...exclude: string[]) {
    if (!port) return true;
    if (this.#isContextOnly() && !isConfigurablePort(port)) {
      return true;
    }

    if (
      this.#isContextOnly() &&
      isConfigurablePort(port) &&
      port.value === undefined
    ) {
      return true;
    }

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

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectablePort, PortStatus } from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import { getGlobalColor, isConfigurablePort } from "./utils";
import { GraphNodePort } from "./graph-node-port";
import { GRAPH_OPERATIONS, GraphNodePortType } from "./types";

const portTextColor = getGlobalColor("--bb-neutral-900");

export class GraphNodePortList extends PIXI.Container {
  #width = 300;
  #height = 40;
  #textSize = 12;
  #portTextColor = portTextColor;
  #padding = 12;
  #itemPadding = 16;
  #spacing = 4;
  #inPorts: InspectablePort[] | null = null;
  #inPortsData: Map<
    string,
    { port: InspectablePort; label: PIXI.Text; nodePort: GraphNodePort } | null
  > = new Map();

  readOnly = false;

  constructor() {
    super();

    this.on("destroyed", () => {
      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });
  }

  get empty() {
    return this.#inPortsData.size === 0;
  }

  set inPorts(ports: InspectablePort[] | null) {
    this.#inPorts = ports;
    this.#width = 0;

    if (!ports) {
      return;
    }

    this.#width = this.#padding;

    for (const port of ports) {
      if (!isConfigurablePort(port)) {
        continue;
      }

      if (port.status !== PortStatus.Missing && port.value === undefined) {
        continue;
      }

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

        const nodePort = new GraphNodePort(GraphNodePortType.INERT);

        this.addChild(label);
        this.addChild(nodePort);

        portItem = { label, port, nodePort };
        this.#inPortsData.set(port.name, portItem);
      }

      if (portItem.label.text !== port.title) {
        portItem.label.text = port.title;
      }

      portItem.port = port;
      portItem.nodePort.status = port.status;
      portItem.nodePort.configured = port.configured;

      portItem.nodePort.x = this.#width;
      portItem.nodePort.y = this.#height * 0.5;

      portItem.label.x =
        portItem.nodePort.x + portItem.nodePort.radius * 2 + this.#spacing;
      portItem.label.y = (this.#height - portItem.label.height) * 0.5;

      this.#width +=
        portItem.nodePort.radius * 2 +
        this.#spacing +
        portItem.label.width +
        this.#itemPadding;

      // Now that all the render-centric stuff is set up, check the read-only
      // state to determine if click handlers etc should be added.
      portItem.label.removeAllListeners();
      if (this.readOnly) {
        return;
      }

      portItem.label.alpha = 0.65;
      portItem.label.cursor = "pointer";

      portItem.label.addEventListener(
        "click",
        (evt: PIXI.FederatedPointerEvent) => {
          this.emit(
            GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
            portItem.port,
            portItem.port.name,
            evt.clientX,
            evt.clientY
          );
        }
      );

      portItem.label.addEventListener("pointerover", (evt) => {
        const ptrEvent = evt.nativeEvent as PointerEvent;
        const [top] = ptrEvent.composedPath();
        if (!(top instanceof HTMLElement)) {
          return;
        }

        if (top.tagName !== "CANVAS") {
          return;
        }
        portItem.label.alpha = 1;
      });

      portItem.label.addEventListener("pointerout", () => {
        portItem.label.alpha = 0.65;
      });
    }

    for (const [inPortName, portItem] of this.#inPortsData) {
      const port = ports.find((inPort) => inPort.name === inPortName);
      if (!port) {
        continue;
      }

      // Unless the port is missing a value, we can remove it when it has
      // no value set.
      if (port.status !== PortStatus.Missing && port.value === undefined) {
        portItem?.label.removeFromParent();
        portItem?.label.destroy({ children: true });

        portItem?.nodePort.removeFromParent();
        portItem?.nodePort.destroy({ children: true });

        this.#inPortsData.delete(inPortName);
      }
    }
  }

  get inPorts() {
    return this.#inPorts;
  }

  get dimensions() {
    return { width: this.#width, height: this.#height };
  }
}

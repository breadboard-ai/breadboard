/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableModules,
  InspectablePort,
  isInlineData,
  isLLMContent,
  isLLMContentArray,
  isStoredData,
  isTextCapabilityPart,
  PortStatus,
} from "@google-labs/breadboard";
import * as PIXI from "pixi.js";
import { getGlobalColor, isConfigurablePort } from "./utils";
import { ComponentExpansionState, GRAPH_OPERATIONS } from "./types";
import {
  isBoardArrayBehavior,
  isBoardBehavior,
  isLLMContentArrayBehavior,
  isLLMContentBehavior,
  isModuleBehavior,
} from "../../utils";

const hoverColor = getGlobalColor("--bb-ui-50");
const nodeTextColor = getGlobalColor("--bb-neutral-900");
const previewTextColor = getGlobalColor("--bb-neutral-500");

const PREVIEW_WIDTH = 270;

export class GraphPortLabel extends PIXI.Container {
  #isDirty = false;

  #width = 0;
  #height = 0;
  #textSize = 12;
  #portTextColor = nodeTextColor;
  #spacing = 4;
  #radius = 4;
  #paddingLeft = 4;
  #paddingTop = 4;
  #paddingBottom = 4;
  #paddingRight = 4;
  #expansionState: ComponentExpansionState = "expanded";

  #previewTextSize = 12;
  #previewTextColor = previewTextColor;

  #port: InspectablePort | null = null;
  #label: PIXI.Text;
  #valuePreview: PIXI.HTMLText;
  #hoverZone = new PIXI.Graphics();

  #showNodePreviewValues = false;
  #isConfigurable = false;
  #modules: InspectableModules | null = null;

  readOnly = false;

  constructor(
    port: InspectablePort,
    showNodePreviewValues: boolean,
    modules: InspectableModules | null = null
  ) {
    super();

    this.#modules = modules;

    this.#label = new PIXI.Text({
      text: port.title,
      style: {
        fontFamily: "Arial",
        fontSize: this.#textSize,
        fill: this.#portTextColor,
        align: "left",
      },
    });

    this.#valuePreview = new PIXI.HTMLText({
      text: this.#createTruncatedValue(port),
      style: {
        fontFamily: "Arial",
        fontSize: this.#previewTextSize,
        tagStyles: {
          div: {
            fontStyle: "italic",
            lineHeight: this.#previewTextSize * 1.5,
          },
        },
        fill: this.#previewTextColor,
        align: "left",
        wordWrap: true,
        wordWrapWidth: PREVIEW_WIDTH,
        breakWords: false,
      },
    });

    this.#label.eventMode = "none";
    this.#valuePreview.eventMode = "none";

    this.addChild(this.#hoverZone);
    this.addChild(this.#label);
    this.addChild(this.#valuePreview);

    this.#hoverZone.visible = false;
    this.#valuePreview.visible = false;
    this.showNodePreviewValues = showNodePreviewValues;
    this.port = port;
    this.#calculateDimensions();

    this.onRender = () => {
      if (!this.#isDirty) {
        return;
      }
      this.#isDirty = false;
      this.#calculateDimensions();
      this.#draw();
    };

    this.on("destroyed", () => {
      // Prevent future renderings.
      this.#isDirty = false;

      for (const child of this.children) {
        child.destroy({ children: true });
      }
    });

    this.addEventListener("pointerover", (evt: PIXI.FederatedPointerEvent) => {
      if (!this.isConfigurable) {
        return;
      }

      const ptrEvent = evt.nativeEvent as PointerEvent;
      const [top] = ptrEvent.composedPath();
      if (!(top instanceof HTMLElement)) {
        return;
      }

      if (top.tagName !== "CANVAS") {
        return;
      }

      this.#hoverZone.alpha = 1;
    });

    this.addEventListener("pointerout", () => {
      if (!this.isConfigurable) {
        return;
      }

      this.#hoverZone.alpha = 0;
    });

    this.addEventListener("click", (evt: PIXI.FederatedPointerEvent) => {
      if (!this.isConfigurable || this.readOnly) {
        return;
      }

      this.emit(
        GRAPH_OPERATIONS.GRAPH_NODE_PORT_VALUE_EDIT,
        this.port,
        this.#port?.name,
        evt.clientX,
        evt.clientY
      );
    });
  }

  set expansionState(expansionState: ComponentExpansionState) {
    if (expansionState === this.#expansionState) {
      return;
    }

    this.#expansionState = expansionState;
    this.isConfigurable =
      !!this.#port && isConfigurablePort(this.#port, this.#expansionState);
    this.#isDirty = true;
  }

  get expansionState() {
    return this.#expansionState;
  }

  set port(port: InspectablePort | null) {
    this.#port = port;
    this.#isDirty = true;

    const portTitle = port?.title || "";
    if (portTitle !== this.#label.text) {
      this.#label.text = portTitle;
    }

    const valuePreview = this.#createTruncatedValue(port);
    if (valuePreview !== this.#valuePreview.text) {
      this.#valuePreview.text = valuePreview;
    }

    if (!port) {
      this.isConfigurable = false;
      return;
    }

    // Value preview may change the dimensions. Let's compute them now,
    // because we may be computing dimensions for the node, and it needs
    // the new values.
    this.#calculateDimensions();

    this.isConfigurable = isConfigurablePort(port, this.#expansionState);
  }

  get port() {
    return this.#port;
  }

  get dimensions() {
    return { width: this.#width, height: this.#height };
  }

  set isConfigurable(isConfigurable: boolean) {
    if (isConfigurable === this.#isConfigurable) {
      return;
    }

    this.#isConfigurable = isConfigurable;
    this.#isDirty = true;

    if (isConfigurable && !this.readOnly) {
      this.eventMode = "static";
      this.#hoverZone.cursor = "pointer";
    } else {
      this.eventMode = "none";
      this.#hoverZone.cursor = "default";
    }
  }

  get isConfigurable() {
    return this.#isConfigurable;
  }

  get showNodePreviewValues() {
    return this.#showNodePreviewValues;
  }

  set showNodePreviewValues(showNodePreviewValues: boolean) {
    if (showNodePreviewValues === this.#showNodePreviewValues) {
      return;
    }

    this.#calculateDimensions();
    this.#showNodePreviewValues = showNodePreviewValues;
    this.#isDirty = true;
  }

  get text() {
    return this.#label.text ?? "";
  }

  get value() {
    return this.#valuePreview.text ?? "";
  }

  #draw() {
    this.#hoverZone.clear();

    if (!this.isConfigurable || this.readOnly) {
      return;
    }

    this.#hoverZone.beginPath();
    this.#hoverZone.roundRect(
      -this.#paddingLeft,
      -this.#paddingTop,
      this.#width + this.#paddingLeft + this.#paddingRight,
      this.#height + this.#paddingTop + this.#paddingBottom,
      this.#radius
    );
    this.#hoverZone.closePath();
    this.#hoverZone.fill({ color: hoverColor });

    this.#hoverZone.alpha = 0;
    this.#hoverZone.visible = true;
  }

  #calculateDimensions() {
    this.#label.x = 0;
    this.#label.y = 0;
    this.#valuePreview.x = 0;
    this.#valuePreview.y = this.#label.height + this.#spacing;

    this.#width = Math.max(this.#label.width, this.#valuePreview.width);
    this.#height = this.#label.height;

    if (this.#valuePreview.text !== "" && this.#showNodePreviewValues) {
      this.#valuePreview.visible = true;
      this.#width = PREVIEW_WIDTH;
      this.#height += this.#spacing + this.#valuePreview.height;
    }
  }

  #createTruncatedValue(port: InspectablePort | null) {
    if (!port) {
      return "";
    }

    if (!this.#showNodePreviewValues) {
      return "";
    }

    let { value } = port;
    if (value === null || value === undefined) {
      if (isConfigurablePort(port, this.#expansionState)) {
        const isLLMContent =
          isLLMContentBehavior(port.schema) ||
          isLLMContentArrayBehavior(port.schema);
        if (isLLMContent && port.schema.default) {
          try {
            value = JSON.parse(port.schema.default);
          } catch (err) {
            return "(empty)";
          }
        } else {
          if (port.status === PortStatus.Missing && !port.schema.default) {
            return "(not configured)";
          }

          if (port.schema.default !== undefined && !isLLMContent) {
            if (port.schema.type === "array") {
              try {
                const items = JSON.parse(port.schema.default);
                if (items.length === 0) {
                  return "(empty list)";
                }
              } catch (err) {
                return "(empty)";
              }
            }

            let defaultValue =
              typeof port.schema.default === "object"
                ? JSON.stringify(port.schema.default)
                : `${port.schema.default}`;

            if (defaultValue.length > 30) {
              defaultValue = `${defaultValue.slice(0, 27)}...`;
            }

            return defaultValue;
          }

          return "";
        }
      }
    }

    // Catch the cases where we still fail to refine the preview value.
    if (value === null || value === undefined) {
      return "";
    }

    if (isModuleBehavior(port.schema)) {
      if (
        this.#modules &&
        typeof port.value === "string" &&
        this.#modules[port.value]
      ) {
        return this.#modules[port.value].metadata().title ?? port.value;
      }

      return "Unspecified Module";
    }

    // TODO: Pass through a user-friendly label for boards & board arrays?
    if (isBoardBehavior(port.schema)) {
      return "1 item";
    }

    if (isBoardArrayBehavior(port.schema) && Array.isArray(port.value)) {
      return `${port.value.length} item${port.value.length !== 1 ? "s" : ""}`;
    }

    let valStr = "";
    if (typeof value === "object") {
      if (isLLMContent(value)) {
        value = [value];
      }

      if (isLLMContentArray(value)) {
        const firstValue = value[0];
        if (firstValue) {
          const firstPart = firstValue.parts[0];
          if (isTextCapabilityPart(firstPart)) {
            valStr = firstPart.text;
            if (valStr === "") {
              valStr = "(empty text)";
            }
          } else if (isInlineData(firstPart)) {
            valStr = firstPart.inlineData.mimeType;
          } else if (isStoredData(firstPart)) {
            valStr = firstPart.storedData.mimeType;
          } else {
            valStr = "LLM Content Part";
          }
        } else {
          valStr = "0 items";
        }
      } else if (Array.isArray(value)) {
        valStr = `${value.length} item${value.length === 1 ? "" : "s"}`;
      } else if ("preview" in value) {
        valStr = value.preview as string;
      }
    } else {
      valStr = value.toString();
    }

    if (valStr.length > 60) {
      valStr = `${valStr.substring(0, 60)}...`;
    }

    return valStr;
  }
}

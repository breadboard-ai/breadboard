/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UnifiedUpdate, type GulfData } from "../types/types.js";
import {
  Card,
  Column,
  Component,
  ComponentRef,
  ComponentUpdateMessage,
  List,
  Row,
} from "../types/component-update.js";
import {
  DataModelUpdateMessage,
  DataObject,
  DataValue,
} from "../types/data-update.js";
import { deep } from "signal-utils/deep";
import { SignalObject } from "signal-utils/object";
import { SignalMap } from "signal-utils/map";
import { StreamHeaderMessage } from "../types/stream-header.js";
import { BeginRenderingMessage } from "../types/begin-rendering.js";

export { DataModel };

const componentsWithChildren = ["Row", "Column", "List"] as const;
const componentsWithChild = ["Card"] as const;

type ComponentsWithChildren = (typeof componentsWithChildren)[number];
type ComponentsWithChild = (typeof componentsWithChild)[number];

function isComponentWithChildren(key: string): key is ComponentsWithChildren {
  return (componentsWithChildren as readonly string[]).includes(key);
}

function isComponentWithChild(key: string): key is ComponentsWithChild {
  return (componentsWithChild as readonly string[]).includes(key);
}

function isStreamHeader(msg: unknown): msg is StreamHeaderMessage {
  return "version" in (msg as StreamHeaderMessage);
}

function isBeginRendering(msg: unknown): msg is BeginRenderingMessage {
  return "root" in (msg as BeginRenderingMessage);
}

function isComponentUpdate(msg: unknown): msg is ComponentUpdateMessage {
  return "components" in (msg as ComponentUpdateMessage);
}

function isDataModelUpdate(msg: unknown): msg is DataModelUpdateMessage {
  return "contents" in (msg as DataModelUpdateMessage);
}

class DataModel {
  #data: GulfData;
  #watchers = new Map<string, Array<(data: DataValue) => void>>();
  #components: Component[] = [];

  constructor(data: UnifiedUpdate) {
    let streamHeader: StreamHeaderMessage | undefined = undefined;
    let beginRendering;
    for (const msg of data) {
      if (isStreamHeader(msg)) {
        streamHeader = msg;
      } else if (isBeginRendering(msg)) {
        beginRendering = msg;
      } else if (isComponentUpdate(msg)) {
        this.#components.push(...msg.components);
      }
    }

    if (!streamHeader) {
      streamHeader = {
        version: "0.7",
      };
    }

    if (!beginRendering) {
      console.warn("WARN: Unable to load; messages were not received");
      this.#data = {} as GulfData;
      return;
    }

    const root = this.#getComponentCopy(beginRendering.root);
    if (!root) {
      console.warn("WARN: Unable to load; no root provided");
      this.#data = {} as GulfData;
      return;
    }

    console.log(`INFO: GULF v${streamHeader.version}`);
    console.log(`INFO: New Render on ${beginRendering.root}`);

    this.#data = new SignalObject({
      version: streamHeader.version,
      root,
      data: new SignalMap() as DataObject,
    });

    this.#buildComponentTree(root);

    for (const msg of data) {
      if (!isDataModelUpdate(msg)) {
        continue;
      }

      this.#buildDataTree(msg);
    }
  }

  get data(): GulfData {
    return this.#data;
  }

  #getComponentCopy(id: string) {
    const component = this.#components.find((c) => c.id === id);
    if (component) {
      return deep(structuredClone(component));
    }

    return null;
  }

  #buildComponentTree(target: Component, dataPrefix = "") {
    target.dataPrefix = dataPrefix;

    const handleExplicitList = (
      target: Row | Column | List | Card,
      children: string[]
    ) => {
      target.children = [];
      for (const child of children) {
        const component = this.#getComponentCopy(child);
        if (component) {
          target.children.push(component);
          this.#buildComponentTree(component, dataPrefix);
        }
      }
    };

    const handleTemplate = (
      target: Row | Column | List | Card,
      template: ComponentRef["template"]
    ) => {
      if (!template) {
        return;
      }
      target.children = [];
      this.getDataProperty(template.dataBinding, dataPrefix).then(
        (value: DataValue | null) => {
          target.children = [];

          if (!value || !Array.isArray(value)) {
            return;
          }

          for (let i = 0; i < value.length; i++) {
            const component = this.#getComponentCopy(template.componentId);

            if (component) {
              component.id = globalThis.crypto.randomUUID();
              target.children.push(component);
              this.#buildComponentTree(
                component,
                `${template.dataBinding}/${i}`
              );
            }
          }
        }
      );
    };

    /**
     * Processes components that have a 'children' property (Row, Column, List)
     */
    function processMultiChild(component: Row | Column | List | undefined) {
      if (!component) {
        return;
      }

      const children = component.children;
      if ("explicitList" in children && children.explicitList) {
        handleExplicitList(component, children.explicitList);
      } else if ("template" in children && children.template) {
        handleTemplate(component, children.template);
      }
    }

    /**
     * Processes components that have a single 'child' property (Card)
     */
    function processSingleChild(component: Card | undefined) {
      if (!component) {
        return;
      }

      const child = component.child;
      if (typeof child === "string") {
        // Treat the single string child as an explicit list of one
        handleExplicitList(component, [child]);
      }
    }

    for (const key of Object.keys(target.componentProperties)) {
      if (isComponentWithChildren(key)) {
        // 'key' is now correctly typed as 'Row' | 'Column' | 'List'
        // We pass the component to its specific handler
        processMultiChild(target.componentProperties[key]);
      } else if (isComponentWithChild(key)) {
        // 'key' is now correctly typed as 'Card'
        processSingleChild(target.componentProperties[key]);
      }
    }
  }

  #buildDataTree(update: DataModelUpdateMessage) {
    if (Array.isArray(update.contents)) {
      const path = update.path ?? "/";
      this.setDataProperty(path, "", update.contents as unknown as DataObject);
    } else {
      const path = update.path ?? "/";
      for (const [id, obj] of Object.entries(update.contents)) {
        this.setDataProperty(id, path, obj as DataObject);
      }
    }
  }

  #fixDataPropertyKey(key: string, dataPrefix: string) {
    if (dataPrefix) {
      if (key.startsWith("item.")) {
        key = key.replace(/^item\./, "");
      }

      let joiner = "";
      if (dataPrefix !== "/" && !key.startsWith("/")) {
        joiner = "/";
      }

      key = `${dataPrefix}${joiner}${key}`;
    } else {
      if (!key.startsWith("/")) {
        key = `/${key}`;
      }
    }

    return key;
  }

  async getDataProperty(
    key: string,
    dataPrefix = ""
  ): Promise<DataValue | null> {
    key = this.#fixDataPropertyKey(key, dataPrefix);

    let target = this.#data.data;
    const parts = key.split("/");
    const finalPart = parts.at(-1);
    if (!finalPart) {
      console.warn("Unable to set value");
      return null;
    }

    for (let p = 0; p < parts.length - 1; p++) {
      const part = parts[p];
      if (part === "") {
        target = this.#data.data;
      }

      if (target instanceof Map && target.has(part)) {
        target = target.get(part) as DataObject;
      } else if (
        Array.isArray(target) &&
        !Number.isNaN(Number.parseInt(part))
      ) {
        target = target[Number.parseInt(part)];
      } else {
        return new Promise((resolve) => {
          const callbacks = this.#watchers.get(key) ?? [];
          callbacks.push((data) => {
            resolve(data);
          });
          this.#watchers.set(key, callbacks);
        });
      }
    }

    if (target instanceof Map) {
      return target.get(finalPart) ?? null;
    } else {
      return target[finalPart];
    }
  }

  async setDataProperty(key: string, dataPrefix = "", value: DataValue) {
    key = this.#fixDataPropertyKey(key, dataPrefix);

    let target = this.#data.data;
    const parts = key.split("/");
    const finalPart = parts.at(-1);
    if (!finalPart) {
      console.warn("Unable to set value");
      return;
    }

    for (let p = 0; p < parts.length - 1; p++) {
      const part = parts[p];
      if (part === "") {
        target = this.#data.data;
      }

      if (target instanceof Map && target.has(part)) {
        target = target.get(part) as DataObject;
      } else {
        const newTarget: DataObject = new SignalMap();
        target.set(part, newTarget);
        target = newTarget;
      }
    }

    // Convert objects to Maps.
    let storedValue: DataValue | null = null;
    if (
      typeof value === "object" &&
      !(value instanceof Map) &&
      !Array.isArray(value)
    ) {
      if (value) {
        storedValue = new SignalMap(Object.entries(value));
      }
    } else {
      storedValue = deep(value);
    }

    target.set(finalPart, storedValue);

    const watcherCallbacks = this.#watchers.get(key);
    if (watcherCallbacks) {
      for (const watcher of watcherCallbacks) {
        watcher.call(null, storedValue);
      }
    }
    this.#watchers.delete(key);
  }
}

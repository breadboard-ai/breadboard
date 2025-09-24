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
  #rootChanged = false;
  #model: GulfData = new SignalObject({
    data: new SignalMap() as DataObject,
  }) as GulfData;
  #watchers = new Map<string, Array<(data: DataValue) => void>>();
  #components: Component[] = [];
  #finalized = false;

  constructor(updates?: UnifiedUpdate) {
    if (!updates) {
      return;
    }

    this.append(updates);
  }

  get current(): Required<GulfData> | null {
    if (!this.#model) {
      return null;
    }

    if (!this.#model.rootName) {
      throw new Error("Unable to get current; no root name");
    }

    if (!this.#model.root) {
      throw new Error("Unable to get current; no root");
    }

    if (!this.#model.data) {
      throw new Error("Unable to get current; no data");
    }

    if (!this.#model.version) {
      throw new Error("Unable to get current; no version");
    }

    return this.#model as Required<GulfData>;
  }

  async append(data: UnifiedUpdate) {
    for (const msg of data) {
      if (isStreamHeader(msg)) {
        this.#model.version = this.#model.version ?? msg.version;
      } else if (isBeginRendering(msg)) {
        this.#model.rootName = msg.root;
        this.#rootChanged = true;
      } else if (isComponentUpdate(msg)) {
        this.#components.push(...msg.components);

        if (this.#rootChanged) {
          this.#rootChanged = false;

          if (!this.#model.rootName) {
            throw new Error("Unable to retrieve current model; no root name");
          }

          const root = this.#getComponentCopy(this.#model.rootName);
          if (!root) {
            throw new Error("Unable to retrieve current model; no root");
          }
          this.#model.root = root;
          this.#buildComponentTree(root);
        }
      } else if (isDataModelUpdate(msg)) {
        await this.#buildDataTree(msg);
      }
    }
  }

  finalize() {
    this.#finalized = true;
  }

  #getComponentCopy(id: string) {
    const component = this.#components.find((c) => c.id === id);
    if (component) {
      return deep(structuredClone(component));
    }

    return null;
  }

  async #buildComponentTree(target: Component, dataPrefix = "") {
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

    const handleTemplate = async (
      target: Row | Column | List | Card,
      template: ComponentRef["template"]
    ) => {
      if (!template) {
        return;
      }
      target.children = [];
      const value: DataValue | null = await this.getDataProperty(
        template.dataBinding,
        dataPrefix
      );
      target.children = [];

      if (!value || !Array.isArray(value)) {
        return;
      }

      for (let i = 0; i < value.length; i++) {
        const component = this.#getComponentCopy(template.componentId);

        if (component) {
          component.id = globalThis.crypto.randomUUID();
          target.children.push(component);
          this.#buildComponentTree(component, `${template.dataBinding}/${i}`);
        }
      }
    };

    /**
     * Processes components that have a 'children' property (Row, Column, List)
     */
    async function processMultiChild(
      component: Row | Column | List | undefined
    ) {
      if (!component) {
        return;
      }

      const children = component.children;
      if ("explicitList" in children && children.explicitList) {
        handleExplicitList(component, children.explicitList);
      } else if ("template" in children && children.template) {
        await handleTemplate(component, children.template);
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
        await processMultiChild(target.componentProperties[key]);
      } else if (isComponentWithChild(key)) {
        // 'key' is now correctly typed as 'Card'
        processSingleChild(target.componentProperties[key]);
      }
    }
  }

  async #buildDataTree(update: DataModelUpdateMessage) {
    if (Array.isArray(update.contents)) {
      const path = update.path ?? "/";
      this.setDataProperty(path, "", update.contents as unknown as DataObject);
    } else {
      const path = update.path ?? "/";
      for (const [id, obj] of Object.entries(update.contents)) {
        await this.setDataProperty(id, path, obj as DataObject);
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
    }

    if (!key.startsWith("/")) {
      key = `/${key}`;
    }

    return key;
  }

  async getDataProperty(
    key: string,
    dataPrefix = ""
  ): Promise<DataValue | null> {
    key = this.#fixDataPropertyKey(key, dataPrefix);

    let target = this.#model.data;
    const parts = key.split("/");
    const finalPart = parts.at(-1);
    if (!finalPart) {
      console.warn("Unable to set value");
      return null;
    }

    for (let p = 0; p < parts.length - 1; p++) {
      const part = parts[p];
      if (part === "") {
        target = this.#model.data;
        continue;
      }

      if (target instanceof Map && target.has(part)) {
        target = target.get(part) as DataObject;
      } else if (
        Array.isArray(target) &&
        !Number.isNaN(Number.parseInt(part))
      ) {
        target = target[Number.parseInt(part)];
      } else if (this.#finalized) {
        return null;
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
    } else if (target) {
      return target[finalPart];
    } else {
      return null;
    }
  }

  async setDataProperty(key: string, dataPrefix = "", value: DataValue) {
    key = this.#fixDataPropertyKey(key, dataPrefix);

    let target = this.#model.data;
    const parts = key.split("/");
    const finalPart = parts.at(-1);
    if (!finalPart) {
      console.warn("Unable to set value");
      return;
    }

    for (let p = 0; p < parts.length - 1; p++) {
      const part = parts[p];
      if (part === "") {
        target = this.#model.data;
        continue;
      }

      if (target instanceof Map && target.has(part)) {
        target = target.get(part) as DataObject;
      } else if (target) {
        const newTarget: DataObject = new SignalMap();
        target.set(part, newTarget);
        target = newTarget;
      } else {
        return;
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

    if (target) {
      target.set(finalPart, storedValue);
    } else {
      console.warn("Unable to set on model; no receiver");
      return;
    }

    const watcherCallbacks = this.#watchers.get(key);
    if (watcherCallbacks) {
      for (const watcher of watcherCallbacks) {
        watcher.call(null, storedValue);
      }
    }
    this.#watchers.delete(key);
  }
}

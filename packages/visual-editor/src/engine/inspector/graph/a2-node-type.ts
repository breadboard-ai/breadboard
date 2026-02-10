/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InspectableNodePorts,
  InspectableNodeType,
  NodeHandler,
  NodeHandlerMetadata,
  NodeTypeIdentifier,
} from "@breadboard-ai/types";
import { A2_COMPONENT_MAP } from "../../../a2/a2-registry.js";
import { portsFromHandler } from "./ports.js";

export { A2NodeType };

class A2NodeType implements InspectableNodeType {
  #type: string;

  constructor(type: string) {
    this.#type = type;
  }

  metadata(): Promise<NodeHandlerMetadata> {
    return Promise.resolve(this.currentMetadata());
  }

  currentMetadata(): NodeHandlerMetadata {
    const component = A2_COMPONENT_MAP.get(this.#type);
    if (!component) {
      return { title: this.#type };
    }
    return {
      title: component.title,
      description: component.description,
      icon: component.icon,
    };
  }

  type(): NodeTypeIdentifier {
    return this.#type;
  }

  async ports(): Promise<InspectableNodePorts> {
    const component = A2_COMPONENT_MAP.get(this.#type);
    if (!component) {
      return portsFromHandler(this.#type, undefined as unknown as NodeHandler);
    }
    const handler: NodeHandler = {
      invoke: component.invoke,
      describe: component.describe,
    };
    return portsFromHandler(this.#type, handler);
  }
}

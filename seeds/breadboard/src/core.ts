/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  NodeHandler,
  NodeHandlers,
  OutputValues,
} from "@google-labs/graph-runner";
import type { BreadboardSlotSpec, InspectorDetails } from "./types.js";
import { Board } from "./board.js";

const CORE_HANDLERS = ["include", "reflect", "slot", "passthrough"];

type SlotInput = {
  slot: string;
  args: InputValues;
};

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

type EventTransform = (event: Event) => Event;

class NestedInspector extends EventTarget {
  #inspector: EventTarget;
  #transform: EventTransform;

  constructor(inspector: EventTarget, transform: EventTransform) {
    super();
    this.#inspector = inspector;
    this.#transform = transform;
  }

  dispatchEvent(event: Event): boolean {
    return this.#inspector.dispatchEvent(this.#transform(event));
  }

  static create(
    inspector?: EventTarget,
    source?: string
  ): EventTarget | undefined {
    if (!inspector) return undefined;
    return new NestedInspector(inspector, (e) => {
      const inspectorEvent = e as CustomEvent<InspectorDetails>;
      return new CustomEvent(inspectorEvent.type, {
        detail: {
          ...inspectorEvent.detail,
          nesting: (inspectorEvent.detail.nesting || 0) + 1,
          sources: [...(inspectorEvent.detail.sources || []), source],
        },
      });
    });
  }
}

export class Core {
  #graph: GraphDescriptor;
  #slots: BreadboardSlotSpec;
  #inspector?: EventTarget;
  handlers: NodeHandlers;

  constructor(
    graph: GraphDescriptor,
    slots: BreadboardSlotSpec,
    inspector?: EventTarget
  ) {
    this.#graph = graph;
    this.#slots = slots;
    this.#inspector = inspector;
    this.handlers = CORE_HANDLERS.reduce((handlers, type) => {
      const that = this as unknown as Record<string, NodeHandler>;
      handlers[type] = that[type].bind(this);
      return handlers;
    }, {} as NodeHandlers);
  }

  async include(inputs: InputValues): Promise<OutputValues> {
    const { path, $ref, slotted, ...args } = inputs as {
      path?: string;
      $ref?: string;
      slotted?: BreadboardSlotSpec;
      args: InputValues;
    };
    // TODO: Please fix the $ref/path mess.
    const source = path || $ref || "";
    const board = await Board.load(source, slotted);
    return await board.runOnce(
      args,
      NestedInspector.create(this.#inspector, source)
    );
  }

  async reflect(_inputs: InputValues): Promise<OutputValues> {
    const graph = deepCopy(this.#graph);
    return { graph };
  }

  async slot(inputs: InputValues): Promise<OutputValues> {
    const { slot, ...args } = inputs as SlotInput;
    if (!slot) throw new Error("To use a slot, we need to specify its name");
    const graph = this.#slots[slot];
    if (!graph) throw new Error(`No graph found for slot ${slot}`);
    const slottedBreadboard = Board.fromGraphDescriptor(graph);
    return await slottedBreadboard.runOnce(
      args,
      NestedInspector.create(this.#inspector, slot)
    );
  }

  async passthrough(inputs: InputValues): Promise<OutputValues> {
    return inputs;
  }
}

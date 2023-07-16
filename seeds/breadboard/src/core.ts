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
import type { BreadboardSlotSpec, ProbeDetails } from "./types.js";
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

class NestedProbe extends EventTarget {
  #probe: EventTarget;
  #transform: EventTransform;

  constructor(probe: EventTarget, transform: EventTransform) {
    super();
    this.#probe = probe;
    this.#transform = transform;
  }

  dispatchEvent(event: Event): boolean {
    return this.#probe.dispatchEvent(this.#transform(event));
  }

  static create(probe?: EventTarget, source?: string): EventTarget | undefined {
    if (!probe) return undefined;
    return new NestedProbe(probe, (e) => {
      const probeEvent = e as CustomEvent<ProbeDetails>;
      return new CustomEvent(probeEvent.type, {
        detail: {
          ...probeEvent.detail,
          nesting: (probeEvent.detail.nesting || 0) + 1,
          sources: [...(probeEvent.detail.sources || []), source],
        },
      });
    });
  }
}

export class Core {
  #graph: GraphDescriptor;
  #slots: BreadboardSlotSpec;
  #probe?: EventTarget;
  handlers: NodeHandlers;

  constructor(
    graph: GraphDescriptor,
    slots: BreadboardSlotSpec,
    probe?: EventTarget
  ) {
    this.#graph = graph;
    this.#slots = slots;
    this.#probe = probe;
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
    return await board.runOnce(args, NestedProbe.create(this.#probe, source));
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
    const slottedBreadboard = await Board.fromGraphDescriptor(graph);
    return await slottedBreadboard.runOnce(
      args,
      NestedProbe.create(this.#probe, slot)
    );
  }

  async passthrough(inputs: InputValues): Promise<OutputValues> {
    return inputs;
  }
}

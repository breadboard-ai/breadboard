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
import type {
  BreadboardSlotSpec,
  BreadboardValidator,
  IncludeNodeInputs,
  SlotNodeInputs,
} from "./types.js";
import { Board } from "./board.js";
import { NestedProbe } from "./nested-probe.js";

const CORE_HANDLERS = ["include", "reflect", "slot", "passthrough"];

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

export class Core {
  #graph: GraphDescriptor;
  #slots: BreadboardSlotSpec;
  #validators: BreadboardValidator[];
  #probe?: EventTarget;
  handlers: NodeHandlers;

  constructor(
    graph: GraphDescriptor,
    slots: BreadboardSlotSpec,
    validators: BreadboardValidator[],
    probe?: EventTarget
  ) {
    this.#graph = graph;
    this.#slots = slots;
    this.#validators = validators;
    this.#probe = probe;
    this.handlers = CORE_HANDLERS.reduce((handlers, type) => {
      const that = this as unknown as Record<string, NodeHandler>;
      handlers[type] = that[type].bind(this);
      return handlers;
    }, {} as NodeHandlers);
  }

  async include(inputs: InputValues): Promise<OutputValues> {
    const { path, $ref, graph, slotted, parent, ...args } =
      inputs as IncludeNodeInputs;

    // Add the current graph's URL as the url of the slotted graph,
    // if there isn't an URL already.
    const slottedWithUrls: BreadboardSlotSpec = {};
    if (slotted) {
      for (const key in slotted) {
        slottedWithUrls[key] = { url: this.#graph.url, ...slotted[key] };
      }
    }

    // TODO: Please fix the $ref/path mess.
    const source = path || $ref || "";
    const board = graph
      ? await Board.fromGraphDescriptor(graph)
      : await Board.load(source, {
          slotted: slottedWithUrls,
          base: this.#graph.url,
        });
    for (const validator of this.#validators)
      board.addValidator(
        validator.getSubgraphValidator(parent, Object.keys(args))
      );
    return await board.runOnce(args, NestedProbe.create(this.#probe, source));
  }

  async reflect(_inputs: InputValues): Promise<OutputValues> {
    const graph = deepCopy(this.#graph);
    return { graph };
  }

  async slot(inputs: InputValues): Promise<OutputValues> {
    const { slot, parent, ...args } = inputs as SlotNodeInputs;
    if (!slot) throw new Error("To use a slot, we need to specify its name");
    const graph = this.#slots[slot];
    if (!graph) throw new Error(`No graph found for slot "${slot}"`);
    const slottedBreadboard = await Board.fromGraphDescriptor(graph);
    for (const validator of this.#validators)
      slottedBreadboard.addValidator(validator.getSubgraphValidator(parent));
    return await slottedBreadboard.runOnce(
      args,
      NestedProbe.create(this.#probe, slot)
    );
  }

  async passthrough(inputs: InputValues): Promise<OutputValues> {
    return inputs;
  }
}

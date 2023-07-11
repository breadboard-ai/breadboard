/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TraversalMachine } from "./traversal/machine.js";
import type {
  NodeDescriptor,
  GraphDescriptor,
  GraphTraversalContext,
  InputValues,
  NodeHandlers,
} from "./types.js";

const handle = async (
  nodeHandlers: NodeHandlers,
  descriptor: NodeDescriptor,
  context: GraphTraversalContext,
  inputs?: InputValues | null
) => {
  const handler = nodeHandlers[descriptor.type];
  if (!handler)
    throw new Error(`No handler for node type "${descriptor.type}"`);

  const aggregate = { ...descriptor.configuration, ...inputs };
  const result = await handler(context, aggregate);
  return result;
};

const deepCopy = (graph: GraphDescriptor): GraphDescriptor => {
  return JSON.parse(JSON.stringify(graph));
};

/**
 * A slightly less dumb, but incredibly unkempt edge follower.
 * @todo implement nicer traversal, something like a topology sort with feedback problem resolution.
 * @param graph graph to follow
 */

export const traverseGraph = async (
  context: GraphTraversalContext,
  graph: GraphDescriptor
) => {
  const source = "traverseGraph";
  const log = context.log.bind(context);

  context.setCurrentGraph(deepCopy(graph));

  const machine = new TraversalMachine(graph);

  log({
    source,
    type: "traversal-start",
    text: "Starting traversal",
  });

  for await (const result of machine) {
    const { inputs, missingInputs, descriptor } = result;

    Object.entries(inputs).forEach(([key, value]) => {
      log({
        source,
        type: "input",
        key,
        value: JSON.stringify(value),
        text: `- Input "${key}": ${value}`,
      });
    });

    log({
      source,
      type: "missing-inputs",
      key: descriptor.id,
      value: JSON.stringify(missingInputs),
      text: `Missing inputs: ${missingInputs.join(", ")}, Skipping node "${
        descriptor.id
      }"`,
    });
    if (!result.skip) {
      log({
        source,
        type: "node",
        value: descriptor.id,
        nodeType: descriptor.type,
        text: `Handling: "${descriptor.id}", type: "${descriptor.type}"`,
      });

      const outputs =
        (await handle(context.handlers, descriptor, context, inputs)) || {};

      // TODO: Make it not a special case.
      const exit = outputs.exit as boolean;
      if (exit) return;

      result.outputs = outputs;

      Object.entries(outputs).forEach(([key, value]) => {
        log({
          source,
          type: "output",
          key,
          value: JSON.stringify(value),
          text: `- Output "${key}": ${value}`,
        });
      });
    }

    const opportunitiesTo = machine.opportunities.map(
      (opportunity) => opportunity.to
    );
    log({
      source,
      type: "opportunities",
      value: opportunitiesTo,
      text: `Opportunities: ${opportunitiesTo.join(", ")}`,
    });
  }

  log({
    source,
    type: "traversal-end",
    text: "Traversal complete",
  });
};

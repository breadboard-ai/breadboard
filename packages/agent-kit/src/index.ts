/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";

import kit from "./kit.js";
import {
  addKit,
  type NewNodeFactory,
  type NewNodeValue,
} from "@google-labs/breadboard";
import { WorkerType } from "./boards/worker.js";
import { ToolWorkerType } from "./boards/tool-worker.js";
import { SpecialistType } from "./boards/specialist.js";

// TODO: Replace with the actual URL.
const KIT_BASE_URL =
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/main/packages/agent-kit/graphs/kit.json";

const adapter = await GraphToKitAdapter.create(kit, KIT_BASE_URL, []);

const builder = new KitBuilder(
  adapter.populateDescriptor({
    url: "npm:@google-labs/agent-kit",
    // TODO: This currently doesn't work, because "addKit" below translates
    // handler id directly into the node name. We need to make it work without
    // prefix.
    // namespacePrefix: "agent-",
  })
);

const AgentKit = builder.build({
  worker: adapter.handlerForNode("worker"),
  repeater: adapter.handlerForNode("repeater"),
  structuredWorker: adapter.handlerForNode("structured-worker"),
  toolWorker: adapter.handlerForNode("tool-worker"),
  human: adapter.handlerForNode("human"),
  specialist: adapter.handlerForNode("specialist"),
  looper: adapter.handlerForNode("looper"),
  joiner: adapter.handlerForNode("joiner"),
  content: adapter.handlerForNode("content"),
});

export type AgentKit = InstanceType<typeof AgentKit>;

export type AgentKitType = {
  /**
   * The essential building block of the Agent Kit.
   */
  worker: WorkerType;
  /**
   * A worker whose job it is to repeat the same thing over and over,
   * until some condition is met or the max count of repetitions is reached.
   */
  repeater: NewNodeFactory<
    {
      /**
       * The initial conversation context.
       */
      context?: NewNodeValue;
      /**
       * The worker to repeat.
       */
      worker: NewNodeValue;
      /**
       * The maximum number of repetitions to make (set to -1 to go infinitely).
       */
      max?: NewNodeValue;
    },
    {
      /**
       * The final context after the repetitions.
       */
      context: NewNodeValue;
    }
  >;
  /**
   * A worker that reliably outputs structured data (JSON). Just give it
   * a JSON schema along with an instruction, and it will stay within the bounds
   * of the schema.
   */
  structuredWorker: NewNodeFactory<
    {
      /**
       * The context to use for the worker.
       */
      context?: NewNodeValue;
      /**
       * The instruction we want to give to the worker so that shapes its
       * character and orients it a bit toward the task we want to give it.
       */
      instruction: NewNodeValue;
      /**
       * The JSON schema to use for the worker.
       */
      schema?: NewNodeValue;
    },
    {
      /**
       * The context after generation. Pass this to the next agent when chaining
       * them together.
       */
      context: NewNodeValue;
      /**
       * The output from the agent. Use this to just get the output without any
       * previous context.
       */
      json: NewNodeValue;
    }
  >;
  /**
   * A worker that can use multiple tools to accomplish a task.
   * Give it a list of boards and an instruction, and watch it do its magic.
   */
  toolWorker: ToolWorkerType;
  /**
   * A human in the loop. Use this node to to insert a real person (user input)
   * into your team of synthetic team.
   */
  human: NewNodeFactory<
    {
      context: NewNodeValue;
      title?: NewNodeValue;
      description?: NewNodeValue;
    },
    {
      context: NewNodeValue;
      again: NewNodeValue;
      text: NewNodeValue;
    }
  >;
  /**
   * All-in-one worker. A work in progress, incorporates all the learnings from making previous workers.
   */
  specialist: SpecialistType;
  /**
   * Facilitate looping, A work in progress.
   */
  looper: NewNodeFactory<
    {
      /**
       * The initial conversation context.
       */
      context?: NewNodeValue;
    },
    {
      /**
       * The final context after the repetitions.
       */
      context: NewNodeValue;
    }
  >;
  /**
   * Combine multiple context into one.
   */
  joiner: NewNodeFactory<
    {
      context?: NewNodeValue;
    },
    {
      context: NewNodeValue;
    }
  >;
};

export default AgentKit;

/**
 * The Agent Kit. Use members of this object to create nodes to create
 * agent-like experiences.
 */
export const agents = addKit(AgentKit) as unknown as AgentKitType;

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";

import kit from "./kit.js";
import { addKit } from "@google-labs/breadboard";
import worker, { WorkerType } from "./boards/worker.js";
import { addDescriber } from "./hacks.js";
import repeater, { RepeaterType } from "./boards/repeater.js";
import structuredWorker, {
  StructuredWorkerType,
} from "./boards/structured-worker.js";
import human, { HumanType } from "./boards/human.js";

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
  worker: await addDescriber(adapter.handlerForNode("worker"), worker),
  repeater: await addDescriber(adapter.handlerForNode("repeater"), repeater),
  structuredWorker: await addDescriber(
    adapter.handlerForNode("structured-worker"),
    structuredWorker
  ),
  human: await addDescriber(adapter.handlerForNode("human"), human),
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
  repeater: RepeaterType;
  /** A worker that reliably outputs structured data (JSON). Just give it
   * a JSON schema along with an instruction, and it will stay within the bounds
   * of the schema.
   */
  structuredWorker: StructuredWorkerType;
  /**
   * A human in the loop. Use this node to to insert a real person (user input)
   * into your team of synthetic team.
   */
  human: HumanType;
};

export default AgentKit;

/**
 * The Agent Kit. Use members of this object to create nodes to create
 * agent-like experiences.
 */
export const agents = addKit(AgentKit) as unknown as AgentKitType;

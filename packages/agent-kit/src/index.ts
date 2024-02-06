/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";

import kit from "./kit.js";
import { addKit } from "@google-labs/breadboard";
import { WorkerType } from "./boards/worker.js";
import { InstructionType } from "./boards/instruction.js";

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
  instruction: adapter.handlerForNode("instruction"),
});

export type AgentKit = InstanceType<typeof AgentKit>;

export type AgentKitType = {
  /**
   * The essential building block of the Agent Kit.
   */
  worker: WorkerType;
  instruction: InstructionType;
};

export default AgentKit;

/**
 * The Agent Kit. Use members of this object to create nodes to create
 * agent-like experiences.
 */
export const agents = addKit(AgentKit) as unknown as AgentKitType;

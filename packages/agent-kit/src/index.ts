/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphToKitAdapter, KitBuilder } from "@google-labs/breadboard/kits";

import kit from "./kit.js";
import { NewNodeFactory, NewNodeValue, addKit } from "@google-labs/breadboard";

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
});

export type AgentKit = InstanceType<typeof AgentKit>;

export type AgentKitType = {
  /**
   * The essential building block of the Agent Kit.
   */
  worker: NewNodeFactory<
    {
      /**
       * The generator to use for the agent.
       */
      generator?: NewNodeValue;
      /**
       * The context to use for the agent.
       */
      context: NewNodeValue;
      /**
       * The stop sequences to use for the agent.
       */
      stopSequences: NewNodeValue;
    },
    {
      /**
       * The context after generation.
       */
      context: NewNodeValue;
      /**
       * The output from the agent.
       */
      text: NewNodeValue;
    }
  >;
};

export default AgentKit;

/**
 * The Agent Kit. Use members of this object to create nodes to create
 * agent-like experiences.
 */
export const agents = addKit(AgentKit) as unknown as AgentKitType;

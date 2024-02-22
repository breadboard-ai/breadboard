/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";
import credentials from "./nodes/credentials.js";
import driveList from "./nodes/drive-list.js";
import transformStream from "./nodes/transform-stream.js";
import listToStream from "./nodes/list-to-stream.js";

const NodeNurseryWeb = new KitBuilder({
  title: "Node Nursery (Web)",
  description:
    "A kit that holds nodes that run in a Web-based environment, and are still WIP",
  url: "npm:@google-labs/node-nursery-web",
}).build({
  credentials,
  driveList,
  transformStream,
  listToStream,
});

export default NodeNurseryWeb;
export type NodeNurseryWeb = InstanceType<typeof NodeNurseryWeb>;
export { NodeNurseryWeb };

/**
 * This is a wrapper around existing kits for the new syntax to add types.
 *
 * This should transition to a codegen step, with typescript types constructed
 * from .describe() calls.
 */
import {
  addKit,
  NewNodeValue as NodeValue,
  NewNodeFactory as NodeFactory,
} from "@google-labs/breadboard";

export const nursery = addKit(NodeNurseryWeb) as unknown as {
  transformStream: NodeFactory<
    { stream: NodeValue; board: NodeValue; decode?: boolean },
    { stream: NodeValue }
  >;
  listToStream: NodeFactory<{ list: NodeValue[] }, { stream: NodeValue }>;
  // TODO: Other NodeNurseryWeb nodes.
};

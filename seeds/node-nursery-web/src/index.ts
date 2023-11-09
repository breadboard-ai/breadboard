/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";
import credentials from "./nodes/credentials.js";
import driveList from "./nodes/drive-list.js";
import transformStream from "./nodes/transform-stream.js";

const NodeNurseryWeb = new KitBuilder({
  url: "npm:@google-labs/node-nursery-web",
}).build({
  credentials,
  driveList,
  transformStream,
});

export default NodeNurseryWeb;
export type NodeNurseryWeb = InstanceType<typeof NodeNurseryWeb>;
export { NodeNurseryWeb };

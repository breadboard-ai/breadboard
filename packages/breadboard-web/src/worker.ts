/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MessageController,
  WorkerRuntime,
  WorkerTransport,
} from "@google-labs/breadboard/worker";
import { Board, asRuntimeKit } from "@google-labs/breadboard";
import { Starter } from "@google-labs/llm-starter";
import { Core } from "@google-labs/core-kit";
import { Pinecone } from "@google-labs/pinecone-kit";
import { NodeNurseryWeb } from "@google-labs/node-nursery-web";
import JSONKit from "@google-labs/json-kit";
import {
  ProxyClient,
  WorkerClientTransport,
} from "@google-labs/breadboard/remote";

const worker = self as unknown as Worker;

const controller = new MessageController(new WorkerTransport(worker));
const runtime = new WorkerRuntime(controller);

const url = await runtime.onload();

const runner = await Board.load(url);

const kits = [
  asRuntimeKit(Starter),
  asRuntimeKit(Core),
  asRuntimeKit(Pinecone),
  asRuntimeKit(NodeNurseryWeb),
  asRuntimeKit(JSONKit),
];

const proxyClient = new ProxyClient(new WorkerClientTransport(worker));
const proxyKit = proxyClient.createProxyKit([
  "palm-generateText",
  "palm-embedText",
  "secrets",
  "fetch",
]);

await runtime.run(runner, [proxyKit, ...kits]);

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
import { Board } from "@google-labs/breadboard";
import {
  PortDispatcher,
  ProxyClient,
  RunServer,
  WorkerClientTransport,
  WorkerServerTransport,
} from "@google-labs/breadboard/remote";
import { proxyConfig } from "./config";

const worker = self as unknown as Worker;

const dispatcher = new PortDispatcher(worker);

const controller = new MessageController(new WorkerTransport(worker));
const runtime = new WorkerRuntime(controller);

const url = await runtime.onload();

const runner = await Board.load(url);

const proxyClient = new ProxyClient(
  new WorkerClientTransport(dispatcher.send("proxy"))
);
const proxyKit = proxyClient.createProxyKit(proxyConfig.proxy);

const server = new RunServer(
  new WorkerServerTransport(dispatcher.receive("run"))
);
const kits = [proxyKit, ...proxyConfig.kits];
await server.serve(runner, true, { kits });

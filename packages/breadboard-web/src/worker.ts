/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "@google-labs/breadboard";
import {
  InitServer,
  PortDispatcher,
  ProxyClient,
  RunServer,
  WorkerClientTransport,
  WorkerServerTransport,
} from "@google-labs/breadboard/remote";
import { proxyConfig } from "./config";

const worker = self as unknown as Worker;

const dispatcher = new PortDispatcher(worker);

const initServer = new InitServer(
  new WorkerServerTransport(dispatcher.receive("load"))
);
const url = await initServer.serve();
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

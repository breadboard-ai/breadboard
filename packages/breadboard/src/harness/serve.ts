/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "../board.js";
import { InitServer } from "../remote/init.js";
import { ProxyClient } from "../remote/proxy.js";
import { RunServer } from "../remote/run.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../remote/worker.js";
import { Kit } from "../types.js";

export type ProxyKitConfig = {
  proxy: string[] | undefined;
};

export type ServeConfig = {
  transport: "worker";
  /**
   * The URL of the board to load. If not specified, the server will ask the
   * client for the URL.
   */
  url?: string;
  kits: (Kit | ProxyKitConfig)[];
};

const isProxyKitConfig = (
  kitOrConfig: Kit | ProxyKitConfig
): kitOrConfig is ProxyKitConfig => {
  return "proxy" in kitOrConfig;
};

const configureKits = (
  kits: (Kit | ProxyKitConfig)[],
  factory: TransportFactory
) => {
  return kits.map((kit) => {
    if (isProxyKitConfig(kit)) {
      const proxyClient = new ProxyClient(factory.client("proxy"));
      return proxyClient.createProxyKit(kit.proxy);
    }
    return kit;
  });
};

const isInWorker = () => {
  return (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    typeof WorkerGlobalScope !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    self instanceof WorkerGlobalScope
  );
};

const maybeCreateWorker = () => {
  throw new Error("Not implemented");
};

class TransportFactory {
  #dispatcher: PortDispatcher;

  constructor(dispatcher: PortDispatcher) {
    this.#dispatcher = dispatcher;
  }

  client<Request, Response>(label: string) {
    return new WorkerClientTransport<Request, Response>(
      this.#dispatcher.send(label)
    );
  }

  server<Request, Response>(label: string) {
    return new WorkerServerTransport<Request, Response>(
      this.#dispatcher.receive(label)
    );
  }
}

const getBoardURL = async (config: ServeConfig, factory: TransportFactory) => {
  const url = config.url;
  if (url) return url;

  const initServer = new InitServer(factory.server("load"));
  return await initServer.serve();
};

export const serve = async (config: ServeConfig) => {
  if (config.transport !== "worker") {
    throw new Error("Only worker transport is supported at this time.");
  }
  const inWorker = isInWorker();
  const worker = inWorker ? (self as unknown as Worker) : maybeCreateWorker();
  const factory = new TransportFactory(new PortDispatcher(worker));
  const kits = configureKits(config.kits, factory);
  // TODO: Figure out how to initalize.
  const isRunServer = true;
  if (!isRunServer) return;

  const server = new RunServer(factory.server("run"));
  const url = await getBoardURL(config, factory);
  const runner = await Board.load(url);
  return server.serve(runner, true, { kits });
};

export const defineServeConfig = (config: ServeConfig) => {
  return config;
};

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Board } from "../board.js";
import { InitServer } from "../remote/init.js";
import { RunServer } from "../remote/run.js";
import {
  PortDispatcher,
  WorkerClientTransport,
  WorkerServerTransport,
} from "../remote/worker.js";
import { KitConfig, configureKits } from "./kits.js";
import { TransportFactory } from "./types.js";

/**
 * The Breadboard Serve configuration.
 */
export type ServeConfig = {
  /**
   * The transport to use. Currently, only "worker" is supported.
   */
  transport: "worker";
  /**
   * The URL of the board to load. If not specified, the server will ask the
   * client for the URL.
   */
  url?: string;
  /**
   * The kits to use for serving breadboard. Accepts an array of kits or
   * proxy configurations.
   * If the kit is specified directly, it will be used as-is.
   * If the kit is specified as a proxy configuration, a proxy kit will be
   * created and and a proxy client will be started.
   */
  kits: KitConfig[];
  /**
   * Whether to enable diagnostics. Defaults to false.
   * When diagnostics are enabled, the server will send graphstart/graphend and
   * nodestart/nodeend messages to the client.
   */
  diagnostics?: boolean;
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

class WorkerTransportFactory {
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

/**
 * Start the Breadboard run server. Currently, this function is somewhat
 * specialized to the worker transport, but (one hopes) will eventually
 * grow up to be more general and flexible.
 * @param config - The configuration for the server.
 * @returns - a promise that resolves when the server is done serving.
 */
export const serve = async (config: ServeConfig) => {
  if (config.transport !== "worker") {
    throw new Error("Only worker transport is supported at this time.");
  }
  const inWorker = isInWorker();
  const worker = inWorker ? (self as unknown as Worker) : maybeCreateWorker();
  const factory = new WorkerTransportFactory(new PortDispatcher(worker));
  const kits = configureKits(config.kits, factory);
  // TODO: Figure out how to initalize.
  const isRunServer = true;
  if (!isRunServer) return;

  const server = new RunServer(factory.server("run"));
  const url = await getBoardURL(config, factory);
  const runner = await Board.load(url);
  return server.serve(runner, !!config.diagnostics, { kits });
};

/**
 * A helper function to define a serve configuration. Especially useful in
 * TypeScript, where the type of the configuration is inferred from the
 * argument.
 * @param config - The configuration for the server.
 * @returns - The configuration for the server.
 */
export const defineServeConfig = (config: ServeConfig) => {
  return config;
};

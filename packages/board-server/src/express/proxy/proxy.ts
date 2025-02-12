/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type Request, type Response } from "express";
import { asyncHandler } from "../support.js";

// class ResponseAdapter implements ProxyServerResponse {
//   #response: Response;

//   constructor(response: Response) {
//     this.#response = response;
//   }

//   header(field: string, value: string): unknown {
//     this.#response.setHeader(field, value);
//     return this;
//   }

//   write(chunk: unknown): boolean {
//     return this.#response.write(chunk);
//   }

//   end(): unknown {
//     this.#response.end();
//     return this;
//   }
// }

const proxy = async (_req: Request, _res: Response): Promise<void> => {
  throw new Error("Not implemented");
  // if (!getUserKey(req)) {
  //   res.status(401).json({
  //     error: "Need a valid server key to access the node proxy.",
  //     timestamp: timestamp(),
  //   });
  //   return;
  // }

  // const server = new ProxyServer(
  //   new HTTPServerTransport({ body: req.body }, new ResponseAdapter(res))
  // );
  // const store = getDataStore();
  // store.createGroup("run-board");

  // const tunnel = await buildSecretsTunnel();
  // const config: ProxyServerConfig = {
  //   kits: [secretsKit, asRuntimeKit(Core)],
  //   store,
  //   proxy: ["fetch", { node: "secrets", tunnel }],
  // };

  // try {
  //   await server.serve(config);
  // } catch (e) {
  //   res.status(500).json({ error: (e as Error).message });
  // }

  // store.releaseAll();
};

const proxyHandler = asyncHandler(proxy);
export { proxyHandler as proxy };

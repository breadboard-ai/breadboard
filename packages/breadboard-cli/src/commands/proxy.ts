/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Kit, asRuntimeKit } from "@google-labs/breadboard";
import { ProxyOptions } from "./commandTypes.js";
import { startServer as startProxyServer } from "./lib/proxy-server.js";

export const proxy = async (options: ProxyOptions) => {
  const kitDeclarations = options.kit as string[] | undefined;
  const proxyNodeDeclarations = options.proxyNode as string[] | undefined;
  const port = options.port;

  const kits: Kit[] = [];

  if (kitDeclarations != undefined) {
    // We should warn if we are importing code and the associated risks
    for (const kitDetail of kitDeclarations) {
      const kitImport = await import(kitDetail);
      kits.push(asRuntimeKit(kitImport.default));
    }
  } else {
    throw new Error("You must specify at least one kit.");
  }

  if (proxyNodeDeclarations != undefined && proxyNodeDeclarations.length == 0) {
    throw new Error(
      "You must specify at least one proxy node if you are using a proxy."
    );
  }

  await startProxyServer(options.dist || process.cwd(), port, {
    kits,
    proxy: proxyNodeDeclarations,
  });
};

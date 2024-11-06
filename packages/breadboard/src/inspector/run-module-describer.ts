/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor } from "@breadboard-ai/types";
import { InspectableGraphOptions } from "./types.js";
import { Kit, NodeDescriberFunction, NodeHandlerObject } from "../types.js";

const MODULE_PROTOCOL = "module:";

export { tryModuleDescriber };

function findHandler(handlerName: string, kits?: Kit[]): NodeHandlerObject {
  const handler = kits
    ?.flatMap((kit) => Object.entries(kit.handlers))
    .find(([name]) => name === handlerName)
    ?.at(1);

  return handler as NodeHandlerObject;
}

function tryModuleDescriber(
  url: string,
  graph: GraphDescriptor,
  options: InspectableGraphOptions
): NodeDescriberFunction | undefined | false {
  if (url.startsWith(MODULE_PROTOCOL)) {
    const moduleId = url.slice(MODULE_PROTOCOL.length);
    if (moduleId) {
      const module = graph.modules?.[moduleId];
      if (module) {
        const handler = findHandler("runModule", options.kits);
        if (handler) {
          console.log("🌻 describe", handler.describe);
          return handler.describe;
        }
      }
    }
  } else {
    // Return "false" indicating that this is not a module describer.
    return false;
  }
}

/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues, NodeHandlers } from "./types.js";
import { Kit, InputValues as OriginalInputValues } from "../../types.js";

// TODO: This is wraps classic handlers that expected resolved inputs into
// something that accepts promises. We should either change all handlers to
// support promises or add a flag or something to support either mode. (Almost
// all handlers will immediately await, so it's a bit of a pain...)
export function handlersFromKit(kit: Kit): NodeHandlers {
  return Object.fromEntries(
    Object.entries(kit.handlers).map(([name, handler]) => {
      const handlerFunction =
        handler instanceof Function ? handler : handler.invoke;
      const describeFunction =
        handler instanceof Function ? undefined : handler.describe;
      const describe = describeFunction ? { describe: describeFunction } : {};

      return [
        name,
        {
          invoke: async (inputs) => {
            return handlerFunction(
              (await inputs) as OriginalInputValues,
              {}
            ) as Promise<OutputValues>;
          },
          ...describe,
        },
      ];
    })
  );
}

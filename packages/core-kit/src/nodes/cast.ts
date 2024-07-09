/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defineNodeType,
  object,
  toJSONSchema,
  unsafeCast,
  unsafeType,
} from "@breadboard-ai/build";
import { type OutputPortReference } from "@breadboard-ai/build/internal/common/port.js";
import type {
  BreadboardType,
  ConvertBreadboardType,
  JsonSerializable,
} from "@breadboard-ai/build/internal/type-system/type.js";

export function cast<O extends JsonSerializable, B extends BreadboardType>(
  value: OutputPortReference<O>,
  type: B
): OutputPortReference<ConvertBreadboardType<B>> {
  return unsafeCast(
    castNode({ value, type: toJSONSchema(type) }).unsafeOutput("value"),
    type
  );
}

export const castNode = defineNodeType({
  name: "cast",
  inputs: {
    value: {
      type: "unknown",
      description: "The value to cast",
      primary: true,
    },
    type: {
      type: object({}, "unknown"),
      description: "The JSON schema to cast the value to",
    },
  },
  outputs: {
    // TODO(aomarks) It's not currently possible to say "there is always a value
    // port, but we don't know what the type is until later".
    "*": {
      type: "unknown",
    },
  },
  describe: ({ type }) => {
    return {
      outputs: {
        value: {
          type: type ? unsafeType(type) : "unknown",
        },
      },
    };
  },
  invoke: ({ value }) => ({ value }),
});

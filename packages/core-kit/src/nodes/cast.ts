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

/**
 * Cast a value to the given JSON schema.
 */
export function cast<O extends JsonSerializable, B extends BreadboardType>(
  value: OutputPortReference<O>,
  type: B
): OutputPortReference<ConvertBreadboardType<B>> {
  return unsafeCast(
    castNode({ value, type: toJSONSchema(type) }).unsafeOutput("value"),
    type
  );
}

/**
 * Cast a value to the given JSON schema.
 *
 * When using TypeScript, prefer the {@link cast} function which also provides
 * compile-time type-checking.
 */
export const castNode = defineNodeType({
  name: "cast",
  metadata: {
    title: "Cast",
    description: "Cast a value to the given JSON schema.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-cast-component",
    },
  },
  inputs: {
    value: {
      type: "unknown",
      description: "The value to cast",
      primary: true,
    },
    type: {
      type: object({}, "unknown"),
      description: "The JSON schema to cast the value to",
      behavior: ["json-schema"],
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

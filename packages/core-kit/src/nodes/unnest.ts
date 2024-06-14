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
  unsafeSchema,
  unsafeType,
} from "@breadboard-ai/build";
import type {
  OutputPort,
  OutputPortReference,
} from "@breadboard-ai/build/internal/common/port.js";
import type { JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";

export function unnest<T extends { [K: string]: JsonSerializable }>(
  nested: OutputPortReference<T>
): { [K in keyof T]-?: OutputPort<T[K]> } {
  const instance = unnestNode({ nested });
  const type = nested["__output"].type;
  const schema = toJSONSchema(type);
  if (schema.type !== "object") {
    throw new Error(
      `Expected schema.type to be "object" but was "${schema.type}"`
    );
  }
  const outputs = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([name, schema]) => {
      return [
        name,
        unsafeCast(instance.unsafeOutput(name), unsafeType(schema)),
      ];
    })
  );
  return outputs as { [K in keyof T]-?: OutputPort<T[K]> };
}

export const unnestNode = defineNodeType({
  name: "unnest",
  inputs: {
    nested: {
      type: object({}, "unknown"),
      description: "The nested object",
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  describe: (_, __, context) => {
    return {
      outputs: context?.inputSchema ? unsafeSchema(context.inputSchema) : {},
    };
  },
  invoke: ({ nested }) => {
    return nested;
  },
});

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

/**
 * Expose all properties of the given JSON object as separate output ports.
 */
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

/**
 * Expose all properties of the given JSON object as separate output ports.
 *
 * When using TypeScript, prefer the {@link unnest} function which also provides
 * compile-time type-checking.
 */
export const unnestNode = defineNodeType({
  name: "unnest",
  metadata: {
    title: "Unnest",
    description:
      "Expose all properties of the given JSON object as separate output ports.",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/core/#the-unnest-component",
    },
  },
  inputs: {
    nested: {
      type: object({}, "unknown"),
      description: "The nested object",
      primary: true,
    },
  },
  outputs: {
    "*": {
      type: "unknown",
    },
  },
  describe: async (_, __, context) => {
    const nestedSchema =
      await context?.wires.incoming["nested"]?.outputPort?.describe();
    return {
      outputs: nestedSchema ? unsafeSchema(nestedSchema) : { "*": "unknown" },
    };
  },
  invoke: ({ nested }) => {
    return nested;
  },
});

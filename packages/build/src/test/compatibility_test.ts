/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defineNodeType,
  type NodeFactoryFromDefinition,
} from "@breadboard-ai/build";
import { test } from "node:test";
import { anyOf } from "../type.js";

test("NodeFactory from monomorphic node definition", () => {
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
      in2: {
        type: anyOf("string", "number"),
      },
    },
    {
      out1: {
        type: "boolean",
      },
      out2: {
        type: anyOf("number", "boolean"),
      },
    },
    () => ({
      out1: true,
      out2: 42,
    })
  );
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType NodeFactory<{ in1: string; in2: string | number; }, { out1: boolean; out2: number | boolean; }>
  type _ = NodeFactoryFromDefinition<typeof definition>;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

test("NodeFactory from polymorphic node definition", () => {
  const definition = defineNodeType(
    {
      in1: {
        type: "string",
      },
      "*": {
        type: anyOf("string", "number"),
      },
    },
    {
      out1: {
        type: "boolean",
      },
    },
    () => ({
      out1: true,
    })
  );
  /* eslint-disable @typescript-eslint/no-unused-vars */
  // $ExpectType NodeFactory<{ in1: string; } & Record<string, unknown>, { out1: boolean; } & Record<string, unknown>>
  type _ = NodeFactoryFromDefinition<typeof definition>;
  /* eslint-enable @typescript-eslint/no-unused-vars */
});

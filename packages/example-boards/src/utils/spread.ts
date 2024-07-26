/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OutputValues, code as breadboardCode } from "@google-labs/breadboard";
import { code } from "@google-labs/core-kit";
import { CodeOutputConfig } from "../../../core-kit/dist/src/nodes/code";
import { BreadboardType, JsonSerializable } from "@breadboard-ai/build/internal/type-system/type.js";
import { Input } from "@breadboard-ai/build/internal/board/input.js";
import { OutputPort } from "@breadboard-ai/build/internal/common/port.js";

const spread = breadboardCode<{ object: object }, OutputValues>((inputs) => {
  const object = inputs.object;
  if (typeof object !== "object") {
    throw new Error(`object is of type ${typeof object} not object`);
  }
  return { ...object };
}); // TODO(Tina): This can be removed after boards switch to using `createSpreadNode` instead

type spread = typeof spread;

export { spread };

export function createSpreadNode<T extends Record<string, BreadboardType | CodeOutputConfig>>(obj: Input<object & JsonSerializable> | OutputPort<JsonSerializable>, returnType: T) {
  const spread = code(
      {
          $metadata: {
              title: "Spread",
              description: "Spread the properties of an object into a new object",
          },
          obj
      },
      returnType,
      ({ obj }) => {
          if (typeof obj !== "object") {
              throw new Error(`object is of type ${typeof obj} not object`);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return { ...obj } as any;

      }
  );
  return spread;
}
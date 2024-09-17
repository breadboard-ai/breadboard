/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  board,
  input,
  inputNode,
  object,
  outputNode,
} from "@breadboard-ai/build";
import {
  type ConvertBreadboardType,
  type JsonSerializable,
} from "@breadboard-ai/build/internal/type-system/type.js";
import { code, coreKit } from "@google-labs/core-kit";
import { resultFormatterFunction } from "../../function-calling.js";

const itemType = object({ $flags: "unknown" }, "unknown");
type Item = ConvertBreadboardType<typeof itemType>;
type Flags = JsonSerializable;

const item = input({ type: itemType });

const unpackArgs = code(
  {
    $id: "fn-3",
    $metadata: {
      title: "Unpack args",
      description: "Unpacking board arguments",
    },
    item,
  },
  {},
  ({ item }: { item: Item }): Record<string, JsonSerializable> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { $flags, ...result } = item;
    return result;
  }
);

const getFlags = code(
  {
    $id: "fn-4",
    $metadata: {
      title: "Get flags",
      description: "Getting flags for the board invocation",
    },
    item,
  },
  { flags: "unknown" },
  ({ item }: { item: Item }): { flags: Flags } => {
    const { $flags } = item;
    return { flags: $flags };
  }
);

const invoker = coreKit.invoke({
  $id: "invoke-5",
  $metadata: {
    title: "Invoke board",
    description: "Invoking the board with unpacked arguments",
  },
  ["*" as string]: unpackArgs.unsafeOutput("*"),
});

const packResults = code(
  {
    $id: "fn-6",
    $metadata: { title: "Pack results", description: "Packing results" },
    "*": invoker.unsafeOutput("*"),
  },
  { result: "unknown" },
  (result) => ({ result })
);

const formatResults = code(
  {
    $id: "fn-7",
    $metadata: { title: "Format results", description: "Formatting results" },
    result: packResults.outputs.result,
    flags: getFlags.outputs.flags,
  },
  {
    item: "unknown",
  },
  resultFormatterFunction
);

export default board({
  title: "Invoke Board With Args",
  description:
    "Takes one item of `boardInvocationAssembler` output and invokes it as a board with arguments.",
  version: "0.0.1",
  inputs: inputNode({ item }, { id: "input-1" }),
  outputs: outputNode({ item: formatResults.outputs.item }, { id: "output-2" }),
});

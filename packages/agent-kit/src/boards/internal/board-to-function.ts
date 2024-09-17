/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  board,
  input,
  inputNode,
  object,
  outputNode,
} from "@breadboard-ai/build";
import { code, coreKit } from "@google-labs/core-kit";
import { llmContentType } from "../../context.js";
import {
  functionCallFlagsType,
  functionDeclarationType,
  functionSignatureFromBoardFunction,
} from "../../function-calling.js";

const item = input();
const context = input({ type: llmContentType });

const importBoard = coreKit.curry({
  $id: "curry-3",
  $board: item,
  context,
});

const getFunctionSignature = code(
  {
    $id: "fn-4",
    $metadata: { title: "Get Function Signature from board" },
    board: importBoard.outputs.board,
  },
  {
    function: functionDeclarationType,
    board: annotate(object({}, "unknown"), { behavior: ["board"] }),
    flags: functionCallFlagsType,
  },
  functionSignatureFromBoardFunction
);

export default board({
  title: "Board to functions",
  description:
    "Use this board to convert specified boards into function-calling signatures",
  inputs: [inputNode({ item, context }, { id: "input-1" })],
  outputs: outputNode(
    {
      function: getFunctionSignature.outputs.function,
      boardURL: getFunctionSignature.outputs.board,
      flags: getFunctionSignature.outputs.flags,
    },
    { id: "output-2" }
  ),
});

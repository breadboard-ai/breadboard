/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NewNodeFactory, base, board, code } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";
import { json } from "@google-labs/json-kit";

import { contextAssembler, contextBuilder } from "../context.js";
import { gemini } from "@google-labs/gemini-kit";
import {
  boardInvokeAssembler,
  boardResponseExtractor,
  functionCallOrText,
  functionResponseFormatter,
} from "../function-calling.js";

export type ToolWorkerType = NewNodeFactory<
  {
    /**
     * The context to use for the worker.
     */
    context?: unknown;
    /**
     * The instruction we want to give to the worker so that shapes its
     * character and orients it a bit toward the task we want to give it.
     */
    instruction: unknown;
    /**
     * The array of board URLs to use as tools for the worker
     */
    tools?: unknown;
  },
  {
    /**
     * The context after generation. Pass this to the next agent when chaining
     * them together.
     */
    context: unknown;
    /**
     * The output from the agent. Use this to just get the output without any
     * previous context.
     */
    text: unknown;
  }
>;

const sampleContext = "What is the square root of e?";

const sampleInstruction = `You are a hip, fun-loving mathematician who loves to help solve problems and chat about math. You also love finding answers to questions using Search. Use the right tool for solving the problems and reply without engaging tools otherwise. After using the tool, make sure to summarize and expand the answer in a hip, humorous way to help the user enjoy the beauty of math.`;

const sampleTools = JSON.stringify([
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/b5577943bdd0956bed3874244b34ea80f1589eaa/packages/breadboard-web/public/graphs/search-summarize.json",
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/b5577943bdd0956bed3874244b34ea80f1589eaa/packages/breadboard-web/public/graphs/math.json",
]);

type FunctionSignatureItem = {
  function: { name: string };
  boardURL: string;
};

const formatResults = code(({ list }) => {
  const tools: unknown[] = [];
  const urlMap: Record<string, string> = {};
  (list as FunctionSignatureItem[]).forEach((item) => {
    tools.push(item.function);
    urlMap[item.function.name] = item.boardURL;
  });
  return { tools, urlMap };
});

const boardToFunction = board(({ item }) => {
  const url = item.isString();
  const getBoard = core.fetch({
    url,
  });

  // TODO: Convert to `code`.
  const getFunctionSignature = json.jsonata({
    $id: "getFunctionSignature",
    expression: `
      (
        $adjustType := function ($type) {
            $type = "object" or $type = "array" ? "string" : $type
        };

        {
        "function": {
            "name": $replace(title, /\\W/, "_"),
            "description": description,
            "parameters": {
                "type": "object",
                "properties": nodes[type="input"][0].configuration.schema.properties ~> $each(function($v, $k) {
                { $k: {
                    "type": $v.type ~> $adjustType,
                    "description": $v.description
                } }
                }) ~> $merge
            }
        },
        "returns": nodes[type="output"][0].configuration.schema ~> | ** | {}, 'title' |
        }
    )`,
    json: getBoard.response,
    raw: true,
  });

  return { function: getFunctionSignature.function, boardURL: url };
});

export default await board(({ context, instruction, tools }) => {
  context
    .title("Context")
    .isArray()
    .behavior("llm-content")
    .optional()
    .default(sampleContext);
  instruction
    .title("Instruction")
    .format("multiline")
    .examples(sampleInstruction);
  tools
    .title("Tools")
    .isArray()
    .behavior("board")
    .optional()
    .examples(sampleTools)
    .default("[]");

  const buildContext = contextBuilder({
    $metadata: {
      title: "Build Context",
    },
    context,
    instruction,
  });

  const turnBoardsToFunctions = core.map({
    $metadata: { title: "Turn Boards into Functions" },
    board: boardToFunction,
    list: tools.isArray(),
  });

  const formatFunctionDeclarations = formatResults({
    $metadata: {
      title: "Format Function Declarations",
    },
    list: turnBoardsToFunctions.list,
  });

  const doWork = gemini.text({
    $metadata: { title: "Do Work" },
    tools: formatFunctionDeclarations.tools,
    context: buildContext.context,
    text: "unused", // A gross hack (see TODO in gemini-generator.ts)
  });

  const router = functionCallOrText({
    $metadata: { title: "Router" },
    context: doWork.context,
  });

  const assembleBoardInvoke = boardInvokeAssembler({
    $metadata: { title: "Assemble Board Invoke" },
    urlMap: formatFunctionDeclarations.urlMap,
    context: router.context,
    functionCall: router.functionCall,
  });

  const invokeBoard = core.invoke({
    $metadata: { title: "Invoke Board" },
    ...assembleBoardInvoke,
  });

  const extractBoardResponse = boardResponseExtractor({
    $metadata: { title: "Format Board Response" },
    ...invokeBoard,
  });

  const formatFunctionResponse = functionResponseFormatter({
    $metadata: { title: "Format Function Response" },
    context: buildContext.context,
    generated: router.context,
    functionCall: router.functionCall,
    response: extractBoardResponse.response,
  });

  const replyToFunction = gemini.text({
    $metadata: { title: "Reply to Function" },
    tools: formatFunctionDeclarations.tools,
    context: formatFunctionResponse.context,
    text: "unused", // A gross hack (see TODO in gemini-generator.ts)
  });

  const assembleContext = contextAssembler({
    $metadata: { title: "Assemble Context" },
    generated: replyToFunction.context,
    context: formatFunctionResponse.context,
  });

  base.output({
    $metadata: { title: "Function Call" },
    context: assembleContext.context,
    text: replyToFunction.text,
  });

  return {
    context: router.context,
    text: router.text,
  };
}).serialize({
  title: "Tool Worker",
  description: "A worker that can use tools to accomplish tasks.",
  version: "0.0.1",
});

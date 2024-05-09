/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NewNodeFactory, base, board } from "@google-labs/breadboard";
import { core } from "@google-labs/core-kit";

import {
  contextAssembler,
  contextBuilderWithoutSystemInstruction,
} from "../context.js";
import { gemini } from "@google-labs/gemini-kit";
import {
  boardInvokeAssembler,
  boardResponseExtractor,
  functionOrTextRouter,
  functionResponseFormatter,
  boardToFunction,
  functionDeclarationsFormatter,
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

const sampleInstruction = `You are a hip, fun-loving mathematician who loves to help solve problems and chat about math. You also love finding answers to questions using Search. Use the right tool for solving the problems and reply without engaging tools otherwise. After using the tool, make sure to summarize and expand the answer in a hip, humorous way to help the user enjoy the beauty of math.

In situations where the tool use is not necessary, just carry the conversation with the user.`;

const sampleTools = JSON.stringify([
  "https://raw.githubusercontent.com/breadboard-ai/breadboard/b5577943bdd0956bed3874244b34ea80f1589eaa/packages/breadboard-web/public/graphs/search-summarize.json",
  {
    title: "The Calculator Board",
    description:
      "A simple AI pattern that leans on the power of the LLMs to generate language to solve math problems.",
    version: "0.0.2",
    edges: [
      {
        from: "compute",
        to: "answer",
        out: "*",
        in: "",
      },
      {
        from: "generator",
        to: "compute",
        out: "text",
        in: "code",
      },
      {
        from: "math-question",
        to: "math-function",
        out: "question",
        in: "question",
      },
      {
        from: "math-question",
        to: "generator",
        out: "generator",
        in: "path",
      },
      {
        from: "math-function",
        to: "generator",
        out: "prompt",
        in: "text",
      },
    ],
    nodes: [
      {
        id: "answer",
        type: "output",
        configuration: {
          schema: {
            type: "object",
            properties: {
              result: {
                type: "string",
                title: "Answer",
                description: "The answer to the math problem",
              },
            },
            required: ["text"],
          },
        },
      },
      {
        id: "compute",
        type: "runJavascript",
        configuration: {
          name: "compute",
        },
      },
      {
        id: "generator",
        type: "invoke",
        configuration: {},
      },
      {
        id: "math-question",
        type: "input",
        configuration: {
          schema: {
            type: "object",
            properties: {
              question: {
                type: "string",
                title: "Math problem",
                description: "Ask a math question",
                examples: ["What is the square root of pi?"],
              },
              generator: {
                type: "string",
                title: "Generator",
                description: "The URL of the generator to call",
                default: "text-generator.json",
              },
            },
            required: ["text"],
          },
        },
      },
      {
        id: "math-function",
        type: "promptTemplate",
        configuration: {
          template:
            "Translate the math problem below into a self-contained,\nzero-argument JavaScript function named `compute` that can be executed\nto provide the answer to the problem.\n\nDo not use any dependencies or libraries.\n\nMath Problem: {{question}}\n\nSolution:",
        },
      },
    ],
    graphs: {},
  },
]);

const toolWorker = await board(({ context, instruction, tools, retry }) => {
  context
    .title("Context In")
    .isArray()
    .behavior("llm-content")
    .optional()
    .default(sampleContext);
  instruction
    .title("Instruction")
    .description(
      "Describe the worker persona and the task given: the skills and various capabilities, the mindset, the thinking process, etc. The ideal task is a call to action with the necessary details on how to best complete this action."
    )
    .format("multiline")
    .examples(sampleInstruction);
  tools
    .title("Tools")
    .description("The boards to use as tools")
    .isArray()
    .behavior("board")
    .optional()
    .examples(sampleTools)
    .default("[]");
  retry
    .title("Retry Count")
    .description("How many times to retry in case of LLM error")
    .isNumber()
    .optional()
    .default("5");

  const buildContext = contextBuilderWithoutSystemInstruction({
    $id: "buildContext",
    $metadata: {
      title: "Build Context",
      description:
        "Combining the context and instruction into a single context",
    },
    context,
    instruction,
  });

  const turnBoardsToFunctions = core.map({
    $id: "turnBoardsToFunctions",
    $metadata: {
      title: "Turn Boards into Functions",
      description: "Turning provided boards into functions",
    },
    board: "#boardToFunction",
    list: tools.isArray(),
  });

  const formatFunctionDeclarations = functionDeclarationsFormatter({
    $id: "formatFunctionDeclarations",
    $metadata: {
      title: "Format Function Declarations",
      description: "Formatting the function declarations",
    },
    list: turnBoardsToFunctions.list,
  });

  const doWork = gemini.text({
    $id: "doWork",
    $metadata: { title: "Do Work", description: "Using Gemini to do the work" },
    tools: formatFunctionDeclarations.tools,
    context: buildContext.context,
    systemInstruction: instruction,
  });

  const router = functionOrTextRouter({
    $id: "router",
    $metadata: {
      title: "Router",
      description: "Routing to either function call invocation or text reply",
    },
    context: doWork.context,
  });

  const assembleBoardInvoke = boardInvokeAssembler({
    $id: "assembleBoardInvoke",
    $metadata: {
      title: "Assemble Board Invoke",
      description: "Assembling the board invocation based on Gemini response",
    },
    urlMap: formatFunctionDeclarations.urlMap,
    context: router.context,
    functionCall: router.functionCall,
  });

  const invokeBoard = core.invoke({
    $id: "invokeBoard",
    $metadata: { title: "Invoke Board", description: "Invoking the board" },
    ...assembleBoardInvoke,
  });

  const extractBoardResponse = boardResponseExtractor({
    $id: "extractBoardResponse",
    $metadata: {
      title: "Format Board Response",
      description: "Extracting the board response from the invocation",
    },
    ...invokeBoard,
  });

  const formatFunctionResponse = functionResponseFormatter({
    $id: "formatFunctionResponse",
    $metadata: {
      title: "Format Function Response",
      description: "Formatting the function response",
    },
    context: buildContext.context,
    generated: router.context,
    functionCall: router.functionCall,
    response: extractBoardResponse.response,
  });

  const replyToFunction = gemini.text({
    $id: "replyToFunction",
    $metadata: {
      title: "Reply to Function",
      description: "Using Gemini to reply to function results",
    },
    tools: formatFunctionDeclarations.tools,
    context: formatFunctionResponse.context,
    retry,
  });

  const assembleContext = contextAssembler({
    $id: "assembleContext",
    $metadata: {
      title: "Assemble Context",
      description: "Assembling the final context for the output",
    },
    generated: replyToFunction.context,
    context: formatFunctionResponse.context,
  });

  base.output({
    $id: "functionOutput",
    $metadata: {
      title: "Function Call Output",
      description: "Outputting the function call results",
    },
    context: assembleContext.context,
    text: replyToFunction.text,
  });

  const assembleNonFunctionCallContext = contextAssembler({
    $metadata: {
      title: "Assemble Non-function call Context",
      description: "Assembling the final context for the output",
    },
    generated: router.context,
    context: buildContext.context,
  });

  return {
    context: assembleNonFunctionCallContext.context,
    text: router.text,
  };
}).serialize({
  title: "Tool Worker",
  description: "A worker that can use tools to accomplish tasks.",
  version: "0.0.1",
});

toolWorker.graphs = {
  boardToFunction: boardToFunction,
};

export default toolWorker;

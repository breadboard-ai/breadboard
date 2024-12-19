/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  enumeration,
  input,
  inputNode,
  object,
  output,
  outputNode,
  starInputs,
  Value,
} from "@breadboard-ai/build";
import { code, coreKit } from "@google-labs/core-kit";
import geminiKit from "@google-labs/gemini-kit";
import {
  addUserParts,
  checkAreWeDoneFunction,
  combineContextsFunction,
  Context,
  contextType,
  functionCallType,
  type LlmContent,
  llmContentType,
  looperProgressType,
  looperTaskAdderFn,
  readProgress as readProgressFn,
  splitStartAdderFunction,
} from "../context.js";
import {
  boardInvocationArgsType,
  boardInvocationAssemblerFunction,
  functionDeclarationsFormatterFn,
  functionOrTextRouterFunction,
  type FunctionSignatureItem,
  responseCollatorFunction,
  type ToolResponse,
  urlMapType,
} from "../function-calling.js";
import boardToFunction from "./internal/board-to-function.js";
import invokeBoardWithArgs from "./internal/invoke-board-with-args.js";
import specialistDescriber from "./internal/specialist-describer.js";
import { GenericBoardDefinition } from "@breadboard-ai/build/internal/board/board.js";
import { substitute } from "../generated/substitute.js";

const inputs = starInputs({ type: object({}, "unknown") });

const tools = input({
  title: "Tools",
  description:
    "(Optional) Add a list of boards to invoke by the model. The title and description of each board will be converted to a function call declaration.",
  type: annotate(
    array(annotate(object({}, "unknown"), { behavior: ["board"] })),
    { behavior: ["config"] }
  ),
  default: [],
});

const model = input({
  title: "Model Name",
  description: "Choose the specific model to use.",
  type: annotate(
    enumeration(
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
      "gemini-2.0-flash-exp",
      "gemini-2.0-flash-thinking-exp",
      "gemini-exp-1206",
      "gemini-exp-1121",
      "learnlm-1.5-pro-experimental",
      "gemini-1.5-pro-001",
      "gemini-1.5-pro-002",
      "gemini-1.5-pro-exp-0801",
      "gemini-1.5-pro-exp-0827",
      "gemini-1.5-flash-001",
      "gemini-1.5-flash-002",
      "gemini-1.5-flash-8b-exp-0924",
      "gemini-1.5-flash-8b-exp-0827",
      "gemini-1.5-flash-exp-0827"
    ),
    {
      behavior: ["config"],
    }
  ),
  default: "gemini-1.5-flash-latest",
  examples: ["gemini-1.5-flash-latest"],
});

const substituteParams = substitute({
  $metadata: {
    title: "Substitute Parameters",
    description: "Performing parameter substitution, if needed.",
  },
  "*": inputs,
});

const addTask = code(
  {
    $metadata: {
      title: "Add Task",
      description: "Adding task to the prompt.",
    },
    context: substituteParams.outputs.in,
    toAdd: substituteParams.outputs.task,
  },
  { context: array(contextType) },
  addUserParts
);

const readProgress = code(
  {
    $metadata: { title: "Read Progress so far" },
    context: substituteParams.outputs.in,
    forkOutputs: false,
  },
  {
    progress: array(looperProgressType),
    context: array(contextType),
  },
  readProgressFn
);

const addLooperTask = code(
  {
    $metadata: {
      title: "Add Looper Task",
      description: "If there is a pending Looper task, add it.",
    },
    context: addTask.outputs.context,
    progress: readProgress.outputs.progress,
  },
  {
    context: array(contextType),
  },
  looperTaskAdderFn
);

const addSplitStart = code(
  {
    $metadata: {
      title: "Add Split Start",
      description: "Marking the start of parallel processing in the context",
    },
    context: addLooperTask.outputs.context,
  },
  {
    id: "string",
    context: array(contextType),
  },
  splitStartAdderFunction
);

const boardToFunctionWithContext = coreKit.curry({
  $metadata: {
    title: "Add Context",
    description: "Adding context to the board to function converter",
  },
  $board: boardToFunction,
  context: addSplitStart.outputs.context,
});

const turnBoardsToFunctions = coreKit.map({
  $id: "turnBoardsToFunctions",
  $metadata: {
    title: "Turn Boards into Functions",
    description: "Turning provided boards into functions",
  },
  board: boardToFunctionWithContext.outputs.board,
  list: tools,
});

const formatFunctionDeclarations = code(
  {
    $id: "formatFunctionDeclarations",
    $metadata: {
      title: "Format Function Declarations",
      description: "Formatting the function declarations",
    },
    // TODO(aomarks) Cast needed because coreKit.map doesn't know the schema of
    // the board that was passed to it (interfaces would fix this).
    list: turnBoardsToFunctions.outputs.list as Value<FunctionSignatureItem[]>,
    routes: substituteParams.outputs.outs,
  },
  {
    tools: array("unknown"),
    urlMap: urlMapType,
  },
  functionDeclarationsFormatterFn
);

const generator = geminiKit.text({
  $metadata: {
    title: "Gemini API Call",
    description: "Applying Gemini to do work",
  },
  systemInstruction: substituteParams.outputs.persona,
  tools: formatFunctionDeclarations.outputs.tools,
  context: addLooperTask.outputs.context,
  model,
});

const routeToFunctionsOrText = code(
  {
    $id: "router",
    $metadata: {
      title: "Router",
      description: "Routing to either function call invocation or text reply",
    },
    // TODO(aomarks) Our types and gemini's types seem not aligned.
    context: generator.outputs.context as Value<LlmContent>,
  },
  {
    context: llmContentType,
    text: "string",
    functionCalls: array(functionCallType),
  },
  functionOrTextRouterFunction
);

const assembleInvocations = code(
  {
    $id: "assembleBoardInvoke",
    $metadata: {
      title: "Assemble Tool Invoke",
      description: "Assembling tool invocation based on Gemini response",
    },
    urlMap: formatFunctionDeclarations.outputs.urlMap,
    context: routeToFunctionsOrText.outputs.context,
    functionCalls: routeToFunctionsOrText.outputs.functionCalls,
  },
  {
    list: array(boardInvocationArgsType),
    routes: array("string"),
  },
  boardInvocationAssemblerFunction
);

const mapInvocations = coreKit.map({
  $metadata: {
    title: "Invoke Tools in Parallel",
    description: "Invoking tools in parallel",
  },
  list: assembleInvocations.outputs.list,
  board: invokeBoardWithArgs,
});

const formatToolResponse = code(
  {
    $metadata: {
      title: "Format Tool Response",
      description: "Formatting tool response",
    },
    // TODO(aomarks) There's inconsistency between use of LlmContent and Context
    // across these nodes. Sometimes we need to cast to the other type because
    // of that.
    context: addSplitStart.outputs.context as Value<LlmContent[]>,
    response: mapInvocations.outputs.list as Value<ToolResponse[]>,
    generated: generator.outputs.context as Value<LlmContent>,
  },
  {},
  responseCollatorFunction
);

const addToolResponseToContext = code(
  {
    $metadata: {
      title: "Add Tool Response",
      description: "Adding tool response to context",
    },
    // TODO(aomarks) A nicer way to do star wiring. Also, why does the input port have
    // to be "" instead of "*" (it doesn't work with "*").
    "": formatToolResponse.unsafeOutput("*"),
  },
  {
    context: array(contextType),
  },
  combineContextsFunction
);

const routeToolOutput = code(
  {
    $metadata: {
      title: "Route Tool Output",
      description: "Routing tool output as needed",
    },
    context: addToolResponseToContext.outputs.context,
    routes: assembleInvocations.outputs.routes,
  },
  {},
  ({ context, routes }) => {
    const out: Record<string, Context[]> = {};
    const hasRoutes = routes.length > 0;
    if (!hasRoutes) {
      return { out: context };
    }

    // filter out $metadata: it's not useful for routes
    context = context.filter((item) => item.role !== "$metadata");
    // filter out the functionCall from the last "model"
    // @ts-expect-error - TS doesn't know about findLastIndex
    const modelIndex = context.findLastIndex((item) => item.role === "model");
    if (modelIndex < 0) {
      throw new Error("Unable to find model response when routing.");
    }
    const model = context[modelIndex] as LlmContent;
    const parts = model.parts.filter((part) => !("functionCall" in part));
    // If there aren't any text parts, clip both the model and user response
    if (!parts.length) {
      context.splice(modelIndex - 1, 2);
    } else {
      model.parts = parts;
    }

    for (const route of routes) {
      out[`p-${route}`] = context;
    }

    return out;
  }
);

const toolOutput = outputNode({
  $metadata: {
    title: "Tool Output",
    description: "Return tool results as output",
  },
  "": routeToolOutput.unsafeOutput("*"),
});

const areWeDoneChecker = code(
  {
    $metadata: {
      title: "Done Check",
      description: "Checking for the 'Done' marker",
    },
    context: addLooperTask.outputs.context,
    generated: routeToFunctionsOrText.outputs.context,
    text: routeToFunctionsOrText.outputs.text,
  },
  {
    context: array(contextType),
  },
  checkAreWeDoneFunction
);

const mainOutput = outputNode({
  out: output(areWeDoneChecker.outputs.context, { title: "Context out" }),
});

export default board({
  title: "Model",
  metadata: {
    icon: "smart-toy",
    help: {
      url: "https://breadboard-ai.github.io/breadboard/docs/kits/agents/#specialist",
    },
  },
  version: "2.1.0",
  description:
    "Makes a single LLM call using supplied conversation context as prompt, optionally calling tools. Adds a “model” turn to the conversation. When tools are called, adds an extra “user” turn containing tool call outputs. Returns updated conversation context.",
  inputs: [
    inputNode({
      "*": inputs,
    }),
    inputNode(
      { tools },
      {
        title: "Tools Input",
        description: "Specify the tools to use",
      }
    ),
    inputNode(
      { model },
      {
        title: "Model Input",
        description: "Ask which model to use",
      }
    ),
  ],
  outputs: [toolOutput, mainOutput],
  describer: specialistDescriber as GenericBoardDefinition,
});

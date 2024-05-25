/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  NewNodeFactory,
  NewNodeValue,
  base,
  board,
} from "@google-labs/breadboard";
import {
  LlmContent,
  LlmContentRole,
  checkAreWeDone,
  combineContexts,
  looperTaskAdder,
  progressReader,
  userPartsAdder,
} from "../context.js";
import { gemini } from "@google-labs/gemini-kit";
import { core } from "@google-labs/core-kit";
import {
  boardInvocationAssembler,
  boardToFunction,
  functionDeclarationsFormatter,
  functionOrTextRouter,
  invokeBoardWithArgs,
  responseCollator,
} from "../function-calling.js";

export type SpecialistType = NewNodeFactory<
  {
    in: NewNodeValue;
  },
  {
    out: NewNodeValue;
  }
>;

const contextFromText = (text: string, role?: LlmContentRole): LlmContent => {
  const parts = [{ text }];
  return role ? { role, parts } : { parts };
};

const sampleContext: LlmContent[] = [
  contextFromText(
    `
book description: This book will be about breadboards and how awesome they are
chapter target: 10
page target: 400
fiction genre: space opera
setting: the planet where there are no breadboards
story arc: A girl named Aurora invents a breadboard on the planet where breadboards are strictly forbidden. Through struggles and determination, and with the help of trusted friends, Aurora overcomes many challenges and changes the whole planet for the better. 
tonality: futuristic struggle, but optimistic
working title: Aurora
`,
    "user"
  ),
];

const samplePersona: LlmContent = contextFromText(`
You are a famous author.  You are writing a novel.

Your well-established process starts with collecting the book description, chapter target, page target, fiction genre, setting, story arc, tonality and the working title.

Then, your first step is to write a detailed outline for the novel.  You keep the page target in mind for the finished novel, so your outline typically contains contain key bullets for the story arc across the chapters. You usually create a part of the outline for each chapter. You also keep in mind that the outline must cover at least the target number of chapters.

You are very creative and you pride yourself in adding interesting twists and unexpected turns of the story, something that keeps the reader glued to your book.
`);

const sampleTask: LlmContent = contextFromText(`
Write an outline for a novel, following the provided specs.
`);

const specialist = await board(({ in: context, persona, task, tools }) => {
  context
    .title("Context in")
    .description("Incoming conversation context")
    .isArray()
    .behavior("llm-content")
    .examples(JSON.stringify(sampleContext, null, 2));
  persona
    .title("Persona")
    .description(
      "Describe the worker's skills, capabilities, mindset, and thinking process"
    )
    .isObject()
    .behavior("llm-content", "config")
    .examples(JSON.stringify(samplePersona, null, 2));
  task
    .title("Task")
    .description(
      "(Optional) Provide a specific task with clear instructions for the worker to complete using the conversation context"
    )
    .isObject()
    .optional()
    .default(JSON.stringify({}))
    .behavior("llm-content", "config")
    .examples(JSON.stringify(sampleTask, null, 2));
  tools
    .title("Tools")
    .description(
      "(Optional) Add tools to this list for the worker to use when needed"
    )
    .isArray()
    .behavior("board", "config")
    .optional()
    .default("[]");

  const addTask = userPartsAdder({
    $metadata: { title: "Add Task", description: "Adding task to the prompt." },
    context,
    toAdd: task,
  });

  const readProgress = progressReader({
    $metadata: { title: "Read Progress so far" },
    context,
  });

  const addLooperTask = looperTaskAdder({
    $metadata: {
      title: "Add Looper Task",
      description: "If there is a pending Looper task, add it.",
    },
    context: addTask.context,
    progress: readProgress.progress,
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

  const generator = gemini.text({
    $metadata: {
      title: "Gemini API Call",
      description: "Applying Gemini to do work",
    },
    systemInstruction: persona,
    tools: formatFunctionDeclarations.tools,
    context: addLooperTask.context,
  });

  const routeToFunctionsOrText = functionOrTextRouter({
    $id: "router",
    $metadata: {
      title: "Router",
      description: "Routing to either function call invocation or text reply",
    },
    context: generator.context,
  });

  const assembleInvocations = boardInvocationAssembler({
    $id: "assembleBoardInvoke",
    $metadata: {
      title: "Assemble Tool Invoke",
      description: "Assembling the tool invocation based on Gemini response",
    },
    urlMap: formatFunctionDeclarations.urlMap,
    context: routeToFunctionsOrText.context,
    functionCalls: routeToFunctionsOrText.functionCalls,
  });

  const mapInvocations = core.map({
    $metadata: {
      title: "Invoke Tools in Parallel",
      description: "Invoking tools in parallel",
    },
    list: assembleInvocations.list.isArray(),
    board: "#invokeBoardWithArgs",
  });

  const formatToolResponse = responseCollator({
    $metadata: {
      title: "Format Tool Response",
      description: "Formatting tool response",
    },
    response: mapInvocations.list,
  });

  const addToolResponseToContext = combineContexts({
    $metadata: {
      title: "Add Tool Response",
      description: "Adding tool response to context",
    },
    context: addTask.context,
    toAdd: formatToolResponse.response,
  });

  base.output({
    $metadata: {
      title: "Tool Output",
      description: "Return tool results as output",
    },
    out: addToolResponseToContext.context.title("Context out"),
  });

  const areWeDoneChecker = checkAreWeDone({
    $metadata: {
      title: "Done Check",
      description: "Checking for the 'Done' marker",
    },
    context: addLooperTask.context,
    generated: routeToFunctionsOrText.context,
    text: routeToFunctionsOrText.text,
  });

  return { out: areWeDoneChecker.context.title("Context out") };
}).serialize({
  title: "Specialist",
  metadata: {
    icon: "smart-toy",
  },
  description:
    "All-in-one worker. A work in progress, incorporates all the learnings from making previous workers.",
});

specialist.graphs = { boardToFunction, invokeBoardWithArgs };

export default specialist;

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
  looperTaskAdder,
  progressReader,
  userPartsAdder,
} from "../context.js";
import { gemini } from "@google-labs/gemini-kit";
import { core } from "@google-labs/core-kit";
import {
  boardInvokeAssembler,
  boardToFunction,
  functionDeclarationsFormatter,
  functionOrTextRouter,
  toolResponseFormatter,
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
    .description("The source material for the worker")
    .isArray()
    .behavior("llm-content")
    .examples(JSON.stringify(sampleContext, null, 2));
  persona
    .title("Persona")
    .description(
      "Describe the worker persona: the skills and various capabilities, the mindset, the thinking process, etc."
    )
    .isObject()
    .behavior("llm-content", "config")
    .examples(JSON.stringify(samplePersona, null, 2));
  task
    .title("Task")
    .description(
      "Optional. Give it a task to perform on the provided source materials. The ideal task is a call to action with the necessary details on how to best complete this action."
    )
    .isObject()
    .optional()
    .default(JSON.stringify({}))
    .behavior("llm-content", "config")
    .examples(JSON.stringify(sampleTask, null, 2));
  tools
    .title("Tools")
    .description(
      "Optional. Equip it with tools by adding them to this list. If specified, the worker will invoke them when the job calls for it."
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

  const toolInvocationAssembler = boardInvokeAssembler({
    $id: "assembleBoardInvoke",
    $metadata: {
      title: "Assemble Tool Invoke",
      description: "Assembling the tool invocation based on Gemini response",
    },
    urlMap: formatFunctionDeclarations.urlMap,
    context: routeToFunctionsOrText.context,
    functionCall: routeToFunctionsOrText.functionCall,
  });

  const toolInvoker = core.invoke({
    $id: "invokeBoard",
    $metadata: { title: "Invoke Tool", description: "Invoking the board" },
    ...toolInvocationAssembler,
  });

  const formatToolResponse = toolResponseFormatter({
    $metadata: {
      title: "Format Tool Response",
      description: "Formatting tool response",
    },
    ...toolInvoker,
  });

  const addToolResponseToContext = userPartsAdder({
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

specialist.graphs = { boardToFunction };

export default specialist;

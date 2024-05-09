/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NewNodeFactory, NewNodeValue, board } from "@google-labs/breadboard";
import {
  LlmContent,
  LlmContentRole,
  checkAreWeDone,
  looperTaskAdder,
  progressReader,
  userPartsAdder,
} from "../context.js";
import { gemini } from "@google-labs/gemini-kit";

export type SuperWorkerType = NewNodeFactory<
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

export default await board(({ in: context, persona, task }) => {
  context
    .title("Context In")
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

  const generator = gemini.text({
    $metadata: {
      title: "Gemini API Call",
      description: "Applying Gemini to do work",
    },
    systemInstruction: persona,
    context: addLooperTask.context,
  });

  const areWeDoneChecker = checkAreWeDone({
    $metadata: {
      title: "Done Check",
      description: "Checking for the 'Done' marker",
    },
    context: addTask.context,
    generated: generator.context,
  });

  return { out: areWeDoneChecker.context.title("Context Out") };
}).serialize({
  title: "Super Worker",
  metadata: {
    icon: "smart-toy",
  },
  description:
    "All-in-one worker. A work in progress, incorporates all the learnings from making previous workers.",
});

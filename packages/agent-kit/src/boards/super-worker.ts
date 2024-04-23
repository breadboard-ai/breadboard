/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NewNodeFactory, NewNodeValue, board } from "@google-labs/breadboard";
import { ContextItem, contextAssembler, userPartsAdder } from "../context.js";
import { gemini } from "@google-labs/gemini-kit";

export type SuperWorkerType = NewNodeFactory<
  {
    in: NewNodeValue;
  },
  {
    out: NewNodeValue;
  }
>;

const contextFromText = (text: string, role?: string): ContextItem => {
  const parts = [{ text }];
  return role ? { role, parts } : { parts };
};

const sampleContext: ContextItem[] = [
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

const samplePersona: ContextItem = contextFromText(`
You are a famous author.  You are writing a novel.

Your well-established process starts with collecting the book description, chapter target, page target, fiction genre, setting, story arc, tonality and the working title.

Then, your first step is to write a detailed outline for the novel.  You keep the page target in mind for the finished novel, so your outline typically contains contain key bullets for the story arc across the chapters. You usually create a part of the outline for each chapter. You also keep in mind that the outline must cover at least the target number of chapters.

You are very creative and you pride yourself in adding interesting twists and unexpected turns of the story, something that keeps the reader glued to your book.
`);

const sampleTask: ContextItem = contextFromText(`
Write an outline for a novel, following the provided specs.
`);

export default await board(({ in: context, persona, task }) => {
  context
    .title("In")
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
      "Give it the task to perform on the provided source materials. Ideally, the task is a call to action with the necessary details on how to best complete this action."
    )
    .isObject()
    .behavior("llm-content", "config")
    .examples(JSON.stringify(sampleTask, null, 2));

  const addTask = userPartsAdder({
    $metadata: { title: "Add Task", description: "Adding task to the prompt." },
    context,
    toAdd: task,
  });

  const generator = gemini.text({
    $metadata: {
      title: "Gemini API Call",
      description: "Applying Gemini to do work",
    },
    systemInstruction: persona,
    context: addTask.context,
  });

  const addGenerated = contextAssembler({
    $metadata: {
      title: "Add Generated",
      description: "Adding work to the output to pass along",
    },
    context: addTask.context,
    generated: generator.context,
  });

  return { out: addGenerated.context };
}).serialize({
  title: "Super Worker",
  description:
    "All-in-one worker. A work in progress, incorporates all the learnings from making previous workers.",
});

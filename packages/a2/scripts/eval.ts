/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvalHarness } from "../src/eval-harness";
import { getUIDataUpdatePrompt } from "../src/agent/prompts/create-data-update";
import { getDesignSurfaceSpecsPrompt } from "../src/agent/prompts/design-surface-specs";
import { getCreateUILayoutPrompt } from "../src/agent/prompts/create-ui-layout";
import { llm } from "../src/a2/utils";
import { config } from "dotenv";
import { ok, toJson } from "@breadboard-ai/utils";
import { exit } from "process";
import inquirer from "inquirer";
import { ParsedSurfaces, Surface } from "./surface";
import { WorkItem } from "./work-item";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const emit = { time: true, result: false };

const objective =
  llm`Play a learning quiz on the following subject with a high school student, using a series of multiple-choice questions:

<subject>Fall of Communism in Soviet Russia</subject>

As the student answers the question, regulate the difficulty of questions. Start with the easy ones, and if the student is answering them correctly, proceed to the more challenging ones.

When the student fails to answer the question correctly, give them a brief historical overview and re-ask the question again in a slightly different way to test their knowledge.

After 5 questions, congratulate the student and exit the quiz. A student may decide to exit early and that is okay.

Before exiting, record the answers and the summary of the session for the teacher:

- questions asked and student's responses
- whether or not the student completed the quiz
- what the student learned
-  where the student should concentrate on learning`.asContent();

async function generateSpec(harness: EvalHarness): Promise<ParsedSurfaces> {
  const surfaces = await harness.run(getDesignSurfaceSpecsPrompt([objective]));
  if (!ok(surfaces)) {
    console.log("ERROR", surfaces.$error);
    exit(-1);
  }

  const parsedSurfaces: { surfaces: Surface[] } | undefined = toJson([
    surfaces.candidates.at(0)!.content!,
  ]);
  if (!parsedSurfaces) {
    console.log("ERROR", "No surfaces found");
    exit(-1);
  }

  return parsedSurfaces;
}

async function chooseSurfaces(
  parsedSurfaces: ParsedSurfaces
): Promise<{ surface: number; real: boolean }> {
  return inquirer.prompt([
    {
      type: "list",
      name: "surface",
      message: "Which surface do you want?",
      choices: [
        ...parsedSurfaces.surfaces.map((surface) => surface.surfaceId),
        "All",
      ],
      filter: (choice) =>
        parsedSurfaces.surfaces.findIndex(
          (surface) => surface.surfaceId === choice
        ),
    },
    {
      type: "confirm",
      name: "real",
      message: "Generate real data?",
      default: true,
    },
  ]);
}

async function renderSurface(harness: EvalHarness, renderableSurface: Surface) {
  console.log(`Rendering ${renderableSurface.surfaceId}`);
  const prompt = getCreateUILayoutPrompt([
    llm`${JSON.stringify(renderableSurface)}`.asContent(),
  ]);

  const ui = await harness.run(prompt);
  if (!ok(ui)) {
    console.log("ERROR", ui.$error);
    exit(-1);
  }

  return toJson([ui.candidates.at(0)!.content!]);
}

async function createDataUpdate(
  harness: EvalHarness,
  renderableSurface: Surface
) {
  console.log(`Creating additional data for ${renderableSurface.surfaceId}`);
  const prompt = getUIDataUpdatePrompt([
    llm`Create some data akin to the example data for this surface:

    ${JSON.stringify(renderableSurface)}`.asContent(),
  ]);

  const ui = await harness.run(prompt);
  if (!ok(ui)) {
    console.log("ERROR", ui.$error);
    exit(-1);
  }

  return toJson([ui.candidates.at(0)!.content!]);
}

async function evaluate() {
  const harness = new EvalHarness({ apiKey: GEMINI_API_KEY });
  const parsedSurfaces = await generateSpec(harness);
  const choices = await chooseSurfaces(parsedSurfaces);

  const chosenSurfaces =
    choices.surface === -1
      ? parsedSurfaces.surfaces
      : [parsedSurfaces.surfaces.at(choices.surface)!];

  const workload = chosenSurfaces.map((surface) =>
    new WorkItem().run(`ui`, harness, surface, renderSurface, emit)
  );
  if (choices.real) {
    workload.push(
      ...chosenSurfaces.map((surface) =>
        new WorkItem().run("data", harness, surface, createDataUpdate, emit)
      )
    );
  }

  const renderWork = await Promise.all(workload);
  console.table(
    renderWork.map((item) => ({ guid: item.uuid, duration: item.duration }))
  );

  const listAll = await inquirer.prompt([
    {
      type: "confirm",
      name: "list",
      message: "List all results?",
      default: true,
    },
  ]);

  if (listAll.list) {
    renderWork.forEach((item) =>
      console.log(JSON.stringify(item.result, null, 2))
    );
  }
}

evaluate();

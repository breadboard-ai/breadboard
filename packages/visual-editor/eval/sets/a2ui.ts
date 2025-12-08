/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../../src/a2/a2/utils.js";
import { config } from "dotenv";
import { ok } from "@breadboard-ai/utils";
import { session } from "../eval.js";
import { AgentFileSystem } from "../../src/a2/agent/file-system.js";
import { PidginTranslator } from "../../src/a2/agent/pidgin-translator.js";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

session({ name: "A2UI", apiKey: GEMINI_API_KEY }, async (session) => {
  const SmartLayoutPipeline = (
    await import("../../src/a2/agent/a2ui/smart-layout-pipeline.js")
  ).SmartLayoutPipeline;

  async function evalObjective(filename: string, only = false) {
    const { objective, title } = await import(filename);
    const params: Parameters<typeof session.eval> = [
      title,
      async ({ caps, moduleArgs, logger }) => {
        const fileSystem = new AgentFileSystem();
        const translator = new PidginTranslator(caps, moduleArgs, fileSystem);
        const pipeline = new SmartLayoutPipeline({
          caps,
          moduleArgs,
          fileSystem,
          translator,
        });

        const result = await pipeline.run(llm`${objective}`.asContent(), {});
        if (!ok(result)) {
          logger.log({
            type: "warning",
            data: result.$error,
          });
          return;
        }
        logger.log({ type: "a2ui", data: result });
      },
    ];

    if (only) {
      session.evalOnly(...params);
    } else {
      session.eval(...params);
    }
  }

  await evalObjective("./data/comparison.js");
  await evalObjective("./data/costume.js");
  await evalObjective("./data/flight.js");
  await evalObjective("./data/katamari.js");
  await evalObjective("./data/language-tutor.js");
  await evalObjective("./data/menu-planner.js");
  await evalObjective("./data/person-info.js");
  await evalObjective("./data/podcast.js");
  await evalObjective("./data/poem-w-picture.js");
  await evalObjective("./data/prompting-tutor.js");
  await evalObjective("./data/quiz.js");
  await evalObjective("./data/secret-santa.js");
  await evalObjective("./data/timer.js");
  await evalObjective("./data/story-chooser.js");
});

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils";
import { llm } from "../../../src/a2/a2/utils.js";
import { AgentFileSystem } from "../../../src/a2/agent/file-system.js";
import { PidginTranslator } from "../../../src/a2/agent/pidgin-translator.js";
import { session } from "../../eval.js";

session({ name: "A2UI" }, async (session) => {
  const SmartLayoutPipeline = (
    await import("../../../src/a2/agent/a2ui/smart-layout-pipeline.js")
  ).SmartLayoutPipeline;

  async function evalObjective(filename: string, only = false) {
    const { objective, title } = await import(filename);
    const params: Parameters<typeof session.eval> = [
      title,
      async ({ caps, moduleArgs, logger }) => {
        const fileSystem = new AgentFileSystem(null);
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

  await evalObjective("./comparison.js");
  await evalObjective("./costume.js");
  await evalObjective("./flight.js");
  await evalObjective("./katamari.js");
  await evalObjective("./language-tutor.js");
  await evalObjective("./menu-planner.js");
  await evalObjective("./person-info.js");
  await evalObjective("./podcast.js");
  await evalObjective("./poem-w-picture.js");
  await evalObjective("./prompting-tutor.js");
  await evalObjective("./quiz.js");
  await evalObjective("./secret-santa.js");
  await evalObjective("./timer.js");
  await evalObjective("./story-chooser.js");
});

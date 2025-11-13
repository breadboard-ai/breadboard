/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../src/a2/utils";
import { config } from "dotenv";
import { ok } from "@breadboard-ai/utils";
import { session } from "../scripts/eval";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

session({ name: "A2UI", apiKey: GEMINI_API_KEY }, async (session) => {
  const SmartLayoutPipeline = (
    await import("../src/agent/a2ui/smart-layout-pipeline")
  ).SmartLayoutPipeline;

  function evalObjective(title: string, filename: string, only = false) {
    if (only) {
      // eslint-disable-next-line no-restricted-syntax
      session.evalOnly(title, async ({ caps, moduleArgs, logger }) => {
        const { objective } = await import(filename);

        const pipeline = new SmartLayoutPipeline(caps, moduleArgs);

        const result = await pipeline.run(llm`${objective}`.asContent(), {});
        if (!ok(result)) {
          logger.log({
            type: "warning",
            data: result.$error,
          });
          return;
        }
        logger.log({ type: "a2ui", data: result });
      });
    } else {
      session.eval(title, async ({ caps, moduleArgs, logger }) => {
        const { objective } = await import(filename);

        const pipeline = new SmartLayoutPipeline(caps, moduleArgs);

        const result = await pipeline.run(llm`${objective}`.asContent(), {});
        if (!ok(result)) {
          logger.log({
            type: "warning",
            data: result.$error,
          });
          return;
        }
        logger.log({ type: "a2ui", data: result });
      });
    }
  }

  evalObjective("Simple poem w/picture", "./data/poem-w-picture.js");
  evalObjective("Katamari (e2e)", "./data/katamari.js");
  evalObjective("Quiz (e2e)", "./data/quiz.js");
  evalObjective("Costume Maker", "./data/costume.js");
  evalObjective("Personal Info", "./data/person-info.js");
  evalObjective("Podcast App", "./data/podcast.js");
  evalObjective("Flight Form", "./data/flight.js");
  evalObjective("Comparison Table", "./data/comparison.js");
});

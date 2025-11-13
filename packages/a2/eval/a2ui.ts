/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../src/a2/utils";
import { config } from "dotenv";
import { ok } from "@breadboard-ai/utils";
import { session } from "../scripts/eval";
import { makeFunction } from "../src/agent/a2ui/make-function";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

session({ name: "A2UI", apiKey: GEMINI_API_KEY }, async (session) => {
  const generateSpec = (await import("../src/agent/a2ui/generate-spec"))
    .generateSpec;
  const generateTemplate = (await import("../src/agent/a2ui/generate-template"))
    .generateTemplate;

  const SmartLayoutPipeline = (
    await import("../src/agent/a2ui/smart-layout-pipeline")
  ).SmartLayoutPipeline;

  session.eval("Quiz (e2e)", async ({ moduleArgs, logger }) => {
    // 1. Start with the objective.
    const { objective } = await import("./data/quiz/objective.js");

    // 2. Create a spec from the objective.
    const spec = await generateSpec(llm`${objective}`.asContent(), moduleArgs);
    if (!ok(spec)) {
      logger.log({ type: "warning", data: "Unable to generate spec" });
      return [];
    }
    logger.log({ type: "spec", data: spec });

    // 3. For each spec, generate the A2UI.
    await Promise.all(
      spec.map(async (surfaceSpec) => {
        const a2UIPayload = await generateTemplate(surfaceSpec, moduleArgs);
        logger.log({ type: "template", data: spec });

        // 4. Create a function handler.
        const functionHandler = makeFunction(surfaceSpec, a2UIPayload, {
          render: async (payload: unknown[]) => {
            logger.log({ type: "a2ui", data: payload });
            // TODO: Figure out how to handle actions
            return { success: true };
          },
        });

        // 5. Call it with the surface's example data.
        await functionHandler.handler(
          surfaceSpec.exampleData as Record<string, unknown>,
          (status) => {
            console.log("Status update", status);
          }
        );
      })
    );
  });

  session.eval("Katamari (e2e)", async ({ caps, moduleArgs, logger }) => {
    const katamariData = (await import("./data/katamari/data.json")).default;

    const pipeline = new SmartLayoutPipeline(caps, moduleArgs);

    const result = await pipeline.run({ parts: katamariData }, {});
    if (!ok(result)) {
      logger.log({
        type: "warning",
        data: result.$error,
      });
      return;
    }
    logger.log({ type: "a2ui", data: result });
  });

  session.eval(
    "Simple poem w/picture",
    async ({ caps, moduleArgs, logger }) => {
      const pipeline = new SmartLayoutPipeline(caps, moduleArgs);

      const content = llm`

Place the poem in the left column, and a picture in the right, with the caption
under the picture. Put the picture and the caption into a separate card.

Picture:
A Shattered Rainbow in a stone, It holds the ocean, the sunset's moan. With fire-filled milk and shifting light, A dreamy flicker, cold and bright. The earth's own magic, deep and sweet, Where all the colors gently meet.

Caption:
The picture of a shattered Rainbow opal

Picture:
`.asContent();

      content.parts.push({
        storedData: { handle: "fakehandle", mimeType: "image/png" },
      });

      const result = await pipeline.run(content, {});
      if (!ok(result)) {
        logger.log({
          type: "warning",
          data: result.$error,
        });
        return;
      }
      logger.log({ type: "a2ui", data: result });
    }
  );
});

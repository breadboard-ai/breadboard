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

  session.eval("Quiz (e2e)", async ({ caps, moduleArgs, logger }) => {
    const { objective } = await import("./data/quiz.js");

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

  session.eval("Katamari (e2e)", async ({ caps, moduleArgs, logger }) => {
    const katamariData = (await import("./data/katamari.json")).default;

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

  session.eval("Costume Maker", async ({ caps, moduleArgs, logger }) => {
    const pipeline = new SmartLayoutPipeline(caps, moduleArgs);

    const content = (await import("./data/costume.js")).content;

    const result = await pipeline.run(content, {});
    if (!ok(result)) {
      logger.log({
        type: "warning",
        data: result.$error,
      });
      return;
    }
    logger.log({ type: "a2ui", data: result });
  });

  session.eval("Personal Info", async ({ caps, moduleArgs, logger }) => {
    const pipeline = new SmartLayoutPipeline(caps, moduleArgs);

    const content = (await import("./data/person-info.js")).content;

    const result = await pipeline.run(content, {});
    if (!ok(result)) {
      logger.log({
        type: "warning",
        data: result.$error,
      });
      return;
    }
    logger.log({ type: "a2ui", data: result });
  });

  session.evalOnly("Podcast App", async ({ caps, moduleArgs, logger }) => {
    const pipeline = new SmartLayoutPipeline(caps, moduleArgs);

    const content = (await import("./data/podcast.js")).content;

    const result = await pipeline.run(content, {});
    if (!ok(result)) {
      logger.log({
        type: "warning",
        data: result.$error,
      });
      return;
    }
    logger.log({ type: "a2ui", data: result });
  });
});

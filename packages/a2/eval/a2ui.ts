/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { llm } from "../src/a2/utils";
import { config } from "dotenv";
import { ok } from "@breadboard-ai/utils";
import { session } from "../scripts/eval";
import { AgentFileSystem } from "../src/agent/file-system";
import { PidginTranslator } from "../src/agent/pidgin-translator";
import { makeFunction } from "../src/agent/a2ui/make-function";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

session({ name: "A2UI", apiKey: GEMINI_API_KEY }, async (session) => {
  const generateSpec = (await import("../src/agent/a2ui/generate-spec"))
    .generateSpec;
  const generateTemplate = (await import("../src/agent/a2ui/generate-template"))
    .generateTemplate;

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
    // 1. Start with the data.
    const katamariData = (await import("./data/katamari/data.json")).default;

    const fileSystem = new AgentFileSystem();
    const translator = new PidginTranslator(caps, moduleArgs, fileSystem);

    const text = await translator.toPidgin({ parts: katamariData }, {});

    // 2. Create a spec from the data.
    const spec = await generateSpec(llm`${text}`.asContent(), moduleArgs);
    if (!ok(spec)) {
      console.warn("Unable to generate spec");
      return [];
    }

    if (spec.length > 1) {
      logger.log({
        type: "warning",
        data: "More than one surface was generated",
      });
    }

    if (spec.length === 0) {
      logger.log({
        type: "warning",
        data: "No surfaces were generated",
      });
    }

    // 3. For each spec, generate A2UI
    await Promise.all(
      spec.map(async (surfaceSpec) => {
        const a2UIPayload = await generateTemplate(surfaceSpec, moduleArgs);

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
});

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getUIDataUpdatePrompt } from "../src/agent/a2ui/prompts/create-data-update";
import { llm } from "../src/a2/utils";
import { config } from "dotenv";
import { ok, toJson } from "@breadboard-ai/utils";
import { exit } from "process";
import { session } from "../scripts/eval";
import { AgentFileSystem } from "../src/agent/file-system";
import { PidginTranslator } from "../src/agent/pidgin-translator";
import { SurfaceSpec } from "../src/agent/a2ui/generate-spec";
import { isTextCapabilityPart } from "@breadboard-ai/data";
import { A2ModuleArgs } from "../src/runnable-module-factory.js";
import { LLMContent, Outcome } from "@breadboard-ai/types";
import { getUIDataFunctionPrompt } from "../src/agent/a2ui/prompts/create-data-function";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

session({ name: "A2UI", apiKey: GEMINI_API_KEY }, async (session) => {
  const generateContent = (await import("../src/a2/gemini")).generateContent;
  const generateSpec = (await import("../src/agent/a2ui/generate-spec"))
    .generateSpec;
  const generateTemplate = (await import("../src/agent/a2ui/generate-template"))
    .generateTemplate;

  const renderExampleData = async (
    promptSource: LLMContent[],
    moduleArgs: A2ModuleArgs
  ) => {
    const prompt = getUIDataUpdatePrompt(promptSource);
    const data = await generateContent(
      "gemini-flash-latest",
      prompt,
      moduleArgs
    );
    if (!ok(data)) {
      console.log("ERROR", data.$error);
      exit(-1);
    }

    const firstPart = data.candidates.at(0)!.content?.parts.at(0);
    if (isTextCapabilityPart(firstPart)) {
      try {
        const content = JSON.parse(firstPart.text);
        return content;
      } catch (err) {
        console.warn(err);
        return "";
      }
    }

    return toJson<unknown[]>([data.candidates.at(0)!.content!]);
  };

  const renderDataFunction = async (
    promptSource: LLMContent[],
    moduleArgs: A2ModuleArgs
  ): Promise<Outcome<string>> => {
    const prompt = getUIDataFunctionPrompt(promptSource);
    const data = await generateContent(
      "gemini-flash-latest",
      prompt,
      moduleArgs
    );
    if (!ok(data)) {
      console.log("ERROR", data.$error);
      exit(-1);
    }

    const firstPart = data.candidates.at(0)!.content?.parts.at(0);
    if (isTextCapabilityPart(firstPart)) {
      try {
        const content = firstPart.text;
        return content;
      } catch (err) {
        console.warn(err);
        return { $error: String(err) };
      }
    }

    return { $error: "Unable to generate" };
  };

  session.eval("Quiz (spec)", async ({ moduleArgs }) => {
    const { objective } = await import("./data/quiz/objective.js");
    return generateSpec(llm`${objective}`.asContent(), moduleArgs);
  });

  session.eval("Quiz (surface)", async ({ moduleArgs }) => {
    const parsedSurfaces = (await import("./data/quiz/spec.json"))
      .default as unknown as SurfaceSpec[];

    return Promise.all(
      parsedSurfaces.map((surface) =>
        generateTemplate(surface, moduleArgs).then((a2ui) => ({ a2ui }))
      )
    );
  });

  session.eval("Quiz (function maker)", async ({ moduleArgs }) => {
    const quizSpec = await import("./data/quiz/spec.json");
    const quizQuestionSurface = (await import("./data/quiz/surface.json"))
      .default;

    const promptSource = [
      llm`This is the specification: ${JSON.stringify(quizSpec)}`.asContent(),
      llm`This is the UI that was generated: ${JSON.stringify(quizQuestionSurface)}`.asContent(),
    ];

    return renderDataFunction(promptSource, moduleArgs);
  });

  session.eval("Quiz (example data)", async ({ moduleArgs }) => {
    const { objective } = await import("./data/quiz/objective.js");
    const quizQuestionSurface = (await import("./data/quiz/surface.json"))
      .default;

    const promptSource = [
      llm`This is the objective: ${objective}`.asContent(),
      llm`This is the UI that was generated: ${JSON.stringify(quizQuestionSurface)}`.asContent(),
    ];

    const dataUpdate = await renderExampleData(promptSource, moduleArgs);
    if (!dataUpdate) {
      console.log("No data generated");
      return;
    }
    return [{ a2ui: [...quizQuestionSurface, ...dataUpdate] }];
  });

  session.eval("Quiz (e2e)", async ({ moduleArgs }) => {
    // 1. Start with the objective.
    const { objective } = await import("./data/quiz/objective.js");

    // 2. Create a spec from the objective.
    const spec = await generateSpec(llm`${objective}`.asContent(), moduleArgs);
    if (!ok(spec)) {
      console.warn("Unable to generate spec");
      return [];
    }

    // 3. From the spec, choose a random one and generate the A2UI.
    const finalSurface = spec.at(Math.floor(Math.random() * spec.length));
    if (!finalSurface) {
      console.warn("Unable to find surface");
      return [];
    }

    const a2UIPayload = await generateTemplate(finalSurface, moduleArgs);

    // 4. Create a data update function for this surface.
    const promptSource = [
      llm`This is the specification: ${JSON.stringify(spec)}`.asContent(),
      llm`This is the UI that was generated: ${JSON.stringify(a2UIPayload)}`.asContent(),
    ];
    const dataFunction = await renderDataFunction(promptSource, moduleArgs);
    if (!ok(dataFunction)) {
      console.warn("Unable to render data function");
      return [];
    }

    // 5. Call it with the surface's example data, combine and return.
    try {
      const dataMessage = eval(
        `(${dataFunction})(${JSON.stringify(finalSurface.exampleData)})`
      );
      return [{ a2ui: [...a2UIPayload, dataMessage] }];
    } catch (err) {
      console.warn(err);
      return [];
    }
  });

  session.eval("Katamari discernment (spec)", async ({ caps, moduleArgs }) => {
    const katamariData = (await import("./data/katamari/data.json")).default;

    const fileSystem = new AgentFileSystem();
    const translator = new PidginTranslator(caps, moduleArgs, fileSystem);

    const text = await translator.toPidgin({ parts: katamariData }, {});

    return generateSpec(llm`${text}`.asContent(), moduleArgs);
  });

  session.eval("Katamari discernment (surface)", async ({ moduleArgs }) => {
    const parsedSurfaces = (await import("./data/katamari/spec.json"))
      .default as unknown as SurfaceSpec[];

    return Promise.all(
      parsedSurfaces.map((surface) =>
        generateTemplate(surface, moduleArgs).then((a2ui) => ({ a2ui }))
      )
    );
  });

  session.eval(
    "Katamari discernment (example data)",
    async ({ moduleArgs }) => {
      const katamari = (await import("./data/katamari/surface.json")).default;
      const promptSource = [
        llm`This is the UI that was generated: ${JSON.stringify(katamari)}`.asContent(),
        llm`Ensure all paths are absolute to the current origin, i.e., /video.mp4, /image.jpg etc`.asContent(),
      ];
      const dataUpdate = await renderExampleData(promptSource, moduleArgs);
      if (!dataUpdate) {
        console.log("No data generated");
        return;
      }
      return [{ a2ui: [...katamari, ...dataUpdate] }];
    }
  );
});

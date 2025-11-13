/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { AgentFileSystem } from "../file-system";
import { PidginTranslator } from "../pidgin-translator";
import { A2ModuleArgs } from "../../runnable-module-factory";
import { Params } from "../../a2/common";
import { generateSpec, SurfaceSpec } from "./generate-spec";
import { llm, ok } from "../../a2/utils";
import { err } from "@breadboard-ai/utils";
import { generateTemplate } from "./generate-template";
import { makeFunction } from "./make-function";
import { generateOutputViaFunction } from "./generate-output";

export { SmartLayoutPipeline };

/**
 * The full "Smart Layout" pipeline
 */
class SmartLayoutPipeline {
  constructor(
    private readonly caps: Capabilities,
    private readonly moduleArgs: A2ModuleArgs
  ) {}

  async run(content: LLMContent, params: Params): Promise<Outcome<unknown[]>> {
    const { caps, moduleArgs } = this;
    const fileSystem = new AgentFileSystem();
    const translator = new PidginTranslator(caps, moduleArgs, fileSystem);

    const translated = await translator.toPidgin(content, params);
    if (!ok(translated)) return translated;

    // 1. Create a spec from the data.
    const spec = await generateSpec(
      llm`${translated.text}`.asContent(),
      moduleArgs
    );
    if (!ok(spec)) return spec;

    if (spec.length === 0) {
      return err(`No surfaces were generated`);
    }

    // 2. Set up the handler for processing a single surface.
    const processSurface = async (surfaceSpec: SurfaceSpec) => {
      const a2UIPayload = await generateTemplate(surfaceSpec, moduleArgs);
      let resolver: (payload: Outcome<unknown[]>) => void;
      const layoutResult = new Promise<Outcome<unknown[]>>((resolve) => {
        resolver = resolve;
      });

      // 2a. Create a function definition for populating the data.
      const functionDefinition = makeFunction(surfaceSpec, a2UIPayload, {
        render: async (payload: unknown[]) => {
          resolver(payload);
          return { success: true };
        },
      });

      // 2b. Call it with the surface's example data.
      await functionDefinition.handler(
        surfaceSpec.exampleData as Record<string, unknown>,
        (status) => {
          console.log("Status update", status);
        }
      );

      // 2c. Generate consistent UI, which will create the full payload and
      // ultimately trigger the functionDefinition render above, which will then
      // resolve the layoutResult.
      const output = await generateOutputViaFunction(
        llm`${translated.text}`.asContent(),
        functionDefinition,
        moduleArgs
      );
      if (!ok(output)) return output;
      return layoutResult;
    };

    // 3. Process all the surfaces in parallel.
    const results = await Promise.all(
      spec.map((surfaceSpec) => processSurface(surfaceSpec))
    );
    const errors = results
      .map((result) => (!ok(result) ? result.$error : null))
      .filter((error) => error !== null);
    if (errors.length > 0) {
      return err(errors.join("\n"));
    }

    return results;
  }
}

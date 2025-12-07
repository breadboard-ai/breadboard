/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capabilities, LLMContent, Outcome } from "@breadboard-ai/types";
import { AgentFileSystem } from "../file-system.js";
import { PidginTranslator } from "../pidgin-translator.js";
import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { Params } from "../../a2/common.js";
import { generateSpec, SurfaceSpec } from "./generate-spec.js";
import { llm, ok } from "../../a2/utils.js";
import { err } from "@breadboard-ai/utils";
import { generateTemplate } from "./generate-template.js";
import { makeFunction } from "./make-function.js";
import { generateOutputViaFunction } from "./generate-output.js";
import { FunctionDefinition } from "../function-definition.js";
import { A2UIRenderer } from "../types.js";

export { SmartLayoutPipeline };

const SPEC_MODEL = "gemini-flash-latest";
const TEMPLATE_MODEL = "gemini-flash-latest";

export type SmartLayoutPipelineArgs = {
  caps: Capabilities;
  moduleArgs: A2ModuleArgs;
  fileSystem: AgentFileSystem;
  translator: PidginTranslator;
  ui?: A2UIRenderer;
};

/**
 * The full "Smart Layout" pipeline
 */
class SmartLayoutPipeline {
  constructor(private readonly args: SmartLayoutPipelineArgs) {}

  async prepareFunctionDefinitions(
    content: LLMContent,
    params: Params
  ): Promise<Outcome<FunctionDefinition[]>> {
    const { ui, moduleArgs, translator } = this.args;
    if (!ui) {
      return err(
        `No renderer provided, unable to prepare function definitions`
      );
    }

    const translated = await translator.toPidgin(content, params);
    if (!ok(translated)) return translated;

    // 1. Create a spec from the data.
    const spec = await generateSpec(
      llm`${translated.text}`.asContent(),
      moduleArgs,
      SPEC_MODEL
    );
    if (!ok(spec)) return spec;

    if (spec.length === 0) {
      return err(`No surfaces were generated`);
    }

    // 2. Create function definitions.
    const results = await Promise.all(
      spec.map(async (surfaceSpec) => {
        const a2UIPayload = await generateTemplate(
          surfaceSpec,
          moduleArgs,
          TEMPLATE_MODEL
        );
        if (!ok(a2UIPayload)) return a2UIPayload;
        return makeFunction(surfaceSpec, a2UIPayload, ui);
      })
    );
    const errors = results
      .map((result) => (!ok(result) ? result.$error : null))
      .filter((error) => error !== null);
    if (errors.length > 0) {
      return err(errors.join("\n"));
    }
    return results as FunctionDefinition[];
  }

  async run(content: LLMContent, params: Params): Promise<Outcome<unknown[]>> {
    const { caps, moduleArgs } = this.args;
    const fileSystem = new AgentFileSystem();
    const translator = new PidginTranslator(caps, moduleArgs, fileSystem);

    const translated = await translator.toPidgin(content, params);
    if (!ok(translated)) return translated;

    // 1. Create a spec from the data.
    const spec = await generateSpec(
      llm`${translated.text}`.asContent(),
      moduleArgs,
      SPEC_MODEL
    );
    if (!ok(spec)) return spec;

    if (spec.length === 0) {
      return err(`No surfaces were generated`);
    }

    // 2. Set up the handler for processing a single surface.
    const processSurface = async (
      surfaceSpec: SurfaceSpec
    ): Promise<Outcome<unknown[]>> => {
      const a2UIPayload = await generateTemplate(
        surfaceSpec,
        moduleArgs,
        TEMPLATE_MODEL
      );
      if (!ok(a2UIPayload)) return a2UIPayload;

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

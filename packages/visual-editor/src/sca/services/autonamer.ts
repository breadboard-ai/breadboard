/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CapabilitiesManagerImpl } from "../../engine/runtime/legacy.js";
import type { MutableGraph, NodeHandlerContext } from "@breadboard-ai/types";
import {
  GraphDescriptor,
  GraphStoreArgs,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { RunnableModuleFactory } from "@breadboard-ai/types/sandbox.js";
import { ok } from "@breadboard-ai/utils";

export { Autonamer };

class Autonamer {
  constructor(
    _args: GraphStoreArgs,
    private readonly moduleFactory: RunnableModuleFactory
  ) {}

  async autoname(
    inputs: LLMContent[],
    signal: AbortSignal
  ): Promise<Outcome<LLMContent[]>> {
    const context: NodeHandlerContext = {
      signal,
    };
    const module = await this.moduleFactory.createRunnableModule(
      {} as unknown as MutableGraph,
      {
        url: "embed://a2/autoname.bgl.json#module:main",
      } as unknown as GraphDescriptor,
      context,
      new CapabilitiesManagerImpl()
    );
    if (!ok(module)) return module;
    const results = await module.invoke("main", { context: inputs });
    return (results as { context: LLMContent[] }).context;
  }
}

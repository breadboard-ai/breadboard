/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LLMContent, Outcome } from "@breadboard-ai/types";
import type { A2ModuleFactory } from "../../a2/runnable-module-factory.js";
import autonameInvoke from "../../a2/autoname/main.js";
import { ok } from "@breadboard-ai/utils";

export { Autonamer };

class Autonamer {
  constructor(private readonly moduleFactory: A2ModuleFactory) {}

  async autoname(
    inputs: LLMContent[],
    signal: AbortSignal
  ): Promise<Outcome<LLMContent[]>> {
    const moduleArgs = this.moduleFactory.createModuleArgs({ signal });
    const results = await autonameInvoke({ context: inputs }, moduleArgs);
    if (!ok(results)) return results;
    return (results as { context: LLMContent[] }).context;
  }
}

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DataPart,
  FunctionCallCapabilityPart,
  FunctionResponseCapabilityPart,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { FunctionDefinition } from "./function-definition";
import { SimplifiedToolManager } from "../a2/tool-manager";
import { err, ok } from "@breadboard-ai/utils";

export { FunctionCaller };

class FunctionCaller {
  #functionPromises: Promise<Outcome<FunctionResponseCapabilityPart>>[] = [];

  constructor(
    private readonly builtIn: Map<string, FunctionDefinition>,
    private readonly custom: SimplifiedToolManager
  ) {}

  async #callBuiltIn(
    part: FunctionCallCapabilityPart
  ): Promise<Outcome<FunctionResponseCapabilityPart>> {
    const { functionCall } = part;
    const { name, args } = functionCall;
    const definition = this.builtIn.get(name)!;
    console.log("CALLING SYSTEM FUNCTION", name);
    const response = await definition.handler(args as Record<string, string>);
    if (!ok(response)) return response;
    return {
      functionResponse: {
        name,
        response,
      },
    };
  }

  async #callCustom(
    part: FunctionCallCapabilityPart
  ): Promise<Outcome<FunctionResponseCapabilityPart>> {
    console.log("CALLING FUNCTION");
    const callingTool = await this.custom.callTool(part);
    if (!ok(callingTool)) return callingTool;
    const parts = callingTool.results
      .at(0)
      ?.parts?.filter((part) => "functionResponse" in part);
    if (!parts || parts.length === 0) {
      return err(`Empty response from function "${name}"`);
    }
    return parts.at(0)!;
  }

  describe(part: FunctionCallCapabilityPart): string {
    const { name, args } = part.functionCall;
    const builtInFunction = this.builtIn.get(name);
    if (builtInFunction) {
      return builtInFunction.describer(args);
    }
    return `Calling "${name}"`;
  }

  call(part: FunctionCallCapabilityPart): void {
    const name = part.functionCall.name;
    if (this.builtIn.has(name)) {
      this.#functionPromises.push(this.#callBuiltIn(part));
    } else {
      this.#functionPromises.push(this.#callCustom(part));
    }
  }

  async getResults(): Promise<Outcome<LLMContent | null>> {
    if (this.#functionPromises.length === 0) {
      return null;
    }
    const functionResponses = await Promise.all(this.#functionPromises);
    const errors = functionResponses
      .map((response) => (!ok(functionResponses) ? response : null))
      .filter((response) => response !== null);
    if (errors.length > 0) {
      return err(errors.join(","));
    }
    return { parts: functionResponses as DataPart[] };
  }
}

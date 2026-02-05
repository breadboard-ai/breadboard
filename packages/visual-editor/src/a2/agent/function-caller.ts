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
import {
  FunctionDefinition,
  StatusUpdateCallback,
} from "./function-definition.js";
import { SimplifiedToolManager } from "../a2/tool-manager.js";
import { err, ok } from "@breadboard-ai/utils";
import { FunctionCaller } from "./types.js";

export { FunctionCallerImpl };

export type FunctionCallResult = {
  callId: string;
  response: FunctionResponseCapabilityPart;
};

class FunctionCallerImpl implements FunctionCaller {
  #functionPromises: Promise<Outcome<FunctionCallResult>>[] = [];

  constructor(
    private readonly builtIn: Map<string, FunctionDefinition>,
    private readonly custom: SimplifiedToolManager
  ) {}

  async #callBuiltIn(
    part: FunctionCallCapabilityPart,
    statusUpdateCallback: StatusUpdateCallback
  ): Promise<Outcome<FunctionResponseCapabilityPart>> {
    const { functionCall } = part;
    const { name, args } = functionCall;
    const definition = this.builtIn.get(name)!;
    console.log("CALLING SYSTEM FUNCTION", name);
    const response = await definition.handler(
      args as Record<string, string>,
      statusUpdateCallback
    );
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

  call(
    callId: string,
    part: FunctionCallCapabilityPart,
    statusUpdateCallback: StatusUpdateCallback
  ): void {
    const name = part.functionCall.name;
    if (this.builtIn.has(name)) {
      this.#functionPromises.push(
        this.#callBuiltIn(part, statusUpdateCallback).then((result) =>
          ok(result) ? { callId, response: result } : result
        )
      );
    } else {
      this.#functionPromises.push(
        this.#callCustom(part).then((result) =>
          ok(result) ? { callId, response: result } : result
        )
      );
    }
  }

  async getResults(): Promise<
    Outcome<{ combined: LLMContent; results: FunctionCallResult[] } | null>
  > {
    if (this.#functionPromises.length === 0) {
      return null;
    }
    const functionResponses = await Promise.all(this.#functionPromises);
    const errors = functionResponses.filter(
      (
        response
      ): response is Outcome<FunctionCallResult> & { $error: string } =>
        !ok(response)
    );
    if (errors.length > 0) {
      return err(errors.map((e) => e.$error).join(","));
    }
    const successResults = functionResponses.filter(ok) as FunctionCallResult[];
    const combined: LLMContent = {
      parts: successResults.map((r) => r.response) as DataPart[],
      role: "user",
    };
    return { combined, results: successResults };
  }
}

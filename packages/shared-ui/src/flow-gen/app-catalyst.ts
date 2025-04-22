/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  OutputValues,
} from "@breadboard-ai/types";
import type { SideBoardRuntime } from "../sideboards/types.js";
import AppCatalystChatBgl from "../sideboards/sideboards-bgl/app-catalyst-chat.bgl.json" with { type: "json" };

export interface AppCatalystChatRequest {
  messages: AppCatalystContentChunk[];
  appOptions: {
    format: "FORMAT_GEMINI_FLOWS";
  };
}

export interface AppCatalyistChatResponse {
  messages: AppCatalystContentChunk[];
}

export interface AppCatalystContentChunk {
  mimetype: "text/plain" | "text/breadboard";
  data: string;
}

export class AppCatalystApiClient {
  #sideBoardRuntime: SideBoardRuntime;

  constructor(sideBoardRuntime: SideBoardRuntime) {
    this.#sideBoardRuntime = sideBoardRuntime;
  }

  async chat(
    request: AppCatalystChatRequest
  ): Promise<AppCatalyistChatResponse> {
    const runner = await this.#sideBoardRuntime.createRunner({
      ...(AppCatalystChatBgl as GraphDescriptor),
    });
    const inputs = { request } as object as InputValues;
    const outputs = await new Promise<OutputValues[]>((resolve, reject) => {
      const outputs: OutputValues[] = [];
      runner.addEventListener("input", () => void runner.run(inputs));
      runner.addEventListener("output", (event) =>
        outputs.push(event.data.outputs)
      );
      runner.addEventListener("end", () => resolve(outputs));
      runner.addEventListener("error", (event) => reject(event.data.error));
      void runner.run();
    });
    if (outputs.length !== 1) {
      throw new Error(`Expected 1 output, got ${JSON.stringify(outputs)}`);
    }
    return (outputs[0] as object as { response: AppCatalyistChatResponse })
      .response;
  }
}

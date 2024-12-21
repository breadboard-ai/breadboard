/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "../components/activate-modal.js";
import type { EmptyObject } from "../util/empty-object.js";
import type { Result } from "../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "./tool-types.js";

interface Inputs {
  artifactId: string;
}

type Outputs = EmptyObject;

type Callback = (artifactId: string) => Result<void>;

export class DisplayArtifact implements BBRTTool<Inputs, Outputs> {
  #callback: Callback;

  constructor(callback: Callback) {
    this.#callback = callback;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "display_artifact",
    title: "Display Artifact",
    description:
      "Display a Breadboard artifact to the user in a prominent way.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<BBRTToolAPI>> {
    return {
      ok: true as const,
      value: {
        inputSchema: {
          type: "object",
          properties: {
            artifactId: {
              type: "string",
              description: "The ID of the artifact to display.",
            },
          },
        },
        outputSchema: {
          type: "object",
          properties: {},
        },
      } satisfies BBRTToolAPI,
    };
  }

  execute(args: Inputs) {
    return { result: this.#execute(args) };
  }

  async #execute({ artifactId }: Inputs): Promise<Result<{ data: Outputs }>> {
    const result = this.#callback(artifactId);
    if (!result.ok) {
      return result;
    }
    return { ok: true, value: { data: {} } };
  }
}

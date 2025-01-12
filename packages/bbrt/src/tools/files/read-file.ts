/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ArtifactHandle } from "../../artifacts/artifact-interface.js";
import type { ArtifactStore } from "../../artifacts/artifact-store.js";
import type { Result } from "../../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "../tool-types.js";

interface Inputs {
  path: string;
}

interface Outputs {
  type: "text";
  text: string;
}

export class ReadFile implements BBRTTool<Inputs, Outputs> {
  #artifacts: ArtifactStore;

  constructor(artifacts: ArtifactStore) {
    this.#artifacts = artifacts;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "read_file",
    title: "Read File",
    description: "Read and return the content of the file at the given path.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<BBRTToolAPI>> {
    return {
      ok: true,
      value: {
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path of the file.",
            },
          },
          required: ["path"],
        },
        outputSchema: {
          type: "object",
          properties: {
            type: {
              enum: ["text"],
            },
            text: {
              type: "string",
              description: "Text content of the file.",
            },
          },
          required: ["type", "content"],
        },
      } satisfies BBRTToolAPI,
    };
  }

  execute(args: Inputs) {
    return { result: this.#execute(args) };
  }

  async #execute({ path }: Inputs): Promise<
    Result<{
      data: Outputs;
      artifacts: ArtifactHandle[];
    }>
  > {
    const text = await this.#artifacts.entry(path).text.complete;
    return {
      ok: true,
      value: {
        data: {
          type: "text",
          text,
        },
        artifacts: [],
      },
    };
  }
}

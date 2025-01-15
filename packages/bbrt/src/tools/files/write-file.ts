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
  mimeType: string;
  content: string;
}

interface Outputs {}

type Callback = (path: string) => unknown;

export class WriteFile implements BBRTTool<Inputs, Outputs> {
  #artifacts: ArtifactStore;
  #callback: Callback;

  constructor(artifacts: ArtifactStore, callback: Callback) {
    this.#artifacts = artifacts;
    this.#callback = callback;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "write_file",
    title: "Write File",
    description:
      "Write the given content to a file, creating the file if it doesn't" +
      " already exist, and replacing all contents if it does.",
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
            mimeType: {
              type: "string",
              description: "MIME type of the file.",
            },
            content: {
              type: "string",
              description: "Text content of the file.",
            },
          },
          required: ["path", "mimeType", "content"],
        },
        outputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      } satisfies BBRTToolAPI,
    };
  }

  execute(args: Inputs) {
    return { result: this.#execute(args) };
  }

  async #execute({ path, mimeType, content }: Inputs): Promise<
    Result<{
      data: Outputs;
      artifacts: ArtifactHandle[];
    }>
  > {
    const entry = this.#artifacts.entry(path);
    using transaction = await entry.acquireExclusiveReadWriteLock();
    const blob = new Blob([content], { type: mimeType });
    const write = await transaction.write(blob);
    if (!write.ok) {
      return { ok: false, error: write.error };
    }
    this.#callback(path);
    return { ok: true, value: { data: {}, artifacts: [] } };
  }
}

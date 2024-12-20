/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@google-labs/breadboard";
import type { ArtifactHandle } from "../artifacts/artifact-interface.js";
import type { ArtifactStore } from "../artifacts/artifact-store.js";
import "../components/activate-modal.js";
import type { Result } from "../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "./tool-types.js";

interface Inputs {
  name: string;
}

interface Outputs {
  artifactId: string;
}

export class CreateBoard implements BBRTTool<Inputs, Outputs> {
  #artifacts: ArtifactStore;

  constructor(artifacts: ArtifactStore) {
    this.#artifacts = artifacts;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "create_board",
    title: "Create Board",
    description:
      "Create a new Breadboard. Note that create_board must be performed to" +
      " completion in a separate turn, before any other operations can run on" +
      " it, because you must wait for a response to find out what identifier" +
      " was assigned.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<BBRTToolAPI>> {
    return {
      ok: true as const,
      value: {
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the board to create.",
            },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "A long-term identifier for the created board.",
            },
          },
        },
      } satisfies BBRTToolAPI,
    };
  }

  execute(args: Inputs) {
    return { result: this.#execute(args) };
  }

  async #execute({ name }: Inputs): Promise<
    Result<{
      data: Outputs;
      artifacts: ArtifactHandle[];
    }>
  > {
    const bgl: GraphDescriptor = {
      metadata: { name },
      nodes: [],
      edges: [],
    };

    const artifactId = crypto.randomUUID();
    const entry = this.#artifacts.entry(artifactId);
    using transaction = await entry.acquireExclusiveReadWriteLock();

    const blob = new Blob([JSON.stringify(bgl)], {
      type: "application/vnd.breadboard.board",
    });
    const write = await transaction.write(blob);
    if (!write.ok) {
      return { ok: false, error: write.error };
    }
    return {
      ok: true,
      value: {
        data: { artifactId },
        artifacts: [
          {
            kind: "handle",
            id: artifactId,
            mimeType: blob.type,
          },
        ],
      },
    };
  }
}

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@google-labs/breadboard";
import { html, nothing } from "lit";
import { Signal } from "signal-polyfill";
import type { ArtifactStore } from "../artifacts/artifact-store.js";
import "../components/activate-modal.js";
import { coercePresentableError } from "../util/presentable-error.js";
import type { Result } from "../util/result.js";
import type {
  BBRTTool,
  ToolAPI,
  ToolInvocation,
  ToolInvocationState,
  ToolMetadata,
} from "./tool.js";

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

  readonly metadata: ToolMetadata = {
    id: "create_board",
    title: "Create Board",
    description:
      "Create a new Breadboard. Note that create_board must be performed to" +
      " completion in a separate turn, before any other operations can run on" +
      " it, because you must wait for a response to find out what identifier" +
      " was assigned.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<ToolAPI>> {
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
      } satisfies ToolAPI,
    };
  }

  invoke(args: Inputs) {
    return new CreateBoardInvocation(this.#artifacts, args);
  }
}

class CreateBoardInvocation implements ToolInvocation<Outputs> {
  readonly #artifacts: ArtifactStore;
  readonly #args: Inputs;
  readonly state = new Signal.State<ToolInvocationState<Outputs>>({
    status: "unstarted",
  });

  constructor(artifacts: ArtifactStore, args: Inputs) {
    this.#artifacts = artifacts;
    this.#args = args;
  }

  render() {
    return html` Creating board... `;
  }

  renderContent() {
    return nothing;
  }

  async start(): Promise<void> {
    if (this.state.get().status !== "unstarted") {
      return;
    }
    this.state.set({ status: "running" });

    const bgl: GraphDescriptor = {
      metadata: {
        name: this.#args.name,
      },
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
      this.state.set({
        status: "error",
        error: coercePresentableError(write.error),
      });
      return;
    }

    this.state.set({
      status: "success",
      value: {
        output: {
          artifactId: artifactId,
        },
        artifacts: [
          {
            kind: "handle",
            id: artifactId,
            mimeType: blob.type,
          },
        ],
      },
    });
  }
}

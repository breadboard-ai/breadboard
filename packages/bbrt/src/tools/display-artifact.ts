/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing } from "lit";
import { Signal } from "signal-polyfill";
import "../components/activate-modal.js";
import type { EmptyObject } from "../util/empty-object.js";
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
  artifactId: string;
}

type Outputs = EmptyObject;

type Callback = (artifactId: string) => Result<void>;

export class DisplayArtifact implements BBRTTool<Inputs, Outputs> {
  callback: Callback;

  constructor(callback: Callback) {
    this.callback = callback;
  }

  readonly metadata: ToolMetadata = {
    id: "display_artifact",
    title: "Display Artifact",
    description:
      "Display a Breadboard artifact to the user in a prominent way.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<ToolAPI>> {
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
      } satisfies ToolAPI,
    };
  }

  invoke(args: Inputs) {
    return new DisplayArtifactInvocation(args, this.callback);
  }
}

class DisplayArtifactInvocation implements ToolInvocation<Outputs> {
  readonly #callback: Callback;
  readonly #args: Inputs;
  readonly state = new Signal.State<ToolInvocationState<Outputs>>({
    status: "unstarted",
  });

  constructor(args: Inputs, callback: Callback) {
    this.#args = args;
    this.#callback = callback;
  }

  render() {
    return html`Displaying Artifact ...`;
  }

  renderContent() {
    return nothing;
  }

  async start(): Promise<void> {
    if (this.state.get().status !== "unstarted") {
      return;
    }
    this.state.set({ status: "running" });
    const result = this.#callback(this.#args.artifactId);
    if (!result.ok) {
      this.state.set({
        status: "error",
        error: coercePresentableError(result.error),
      });
      return;
    }
    this.state.set({
      status: "success",
      value: { output: {}, artifacts: [] },
    });
  }
}

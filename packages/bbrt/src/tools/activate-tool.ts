/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing } from "lit";
import { Signal } from "signal-polyfill";
import type { SignalArray } from "signal-utils/array";
import type { SignalSet } from "signal-utils/set";
import "../components/activate-modal.js";
import { Deferred } from "../util/deferred.js";
import type { EmptyObject } from "../util/empty-object.js";
import type { Result } from "../util/result.js";
import type { ToolProvider } from "./tool-provider.js";
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

type Outputs = EmptyObject;

export class ActivateTool implements BBRTTool<Inputs, Outputs> {
  #toolProviders: SignalArray<ToolProvider>;
  #activeTools: SignalSet<BBRTTool>;

  constructor(
    toolProviders: SignalArray<ToolProvider>,
    activeTools: SignalSet<BBRTTool>
  ) {
    this.#toolProviders = toolProviders;
    this.#activeTools = activeTools;
  }

  readonly metadata: ToolMetadata = {
    id: "activate_tool",
    title: "Activate Tool",
    description: "Activate a tool, asking the user's permission if necessary.",
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
              description: "The name of the tool to activate.",
            },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
            },
          },
        },
      } satisfies ToolAPI,
    };
  }

  invoke(args: Inputs) {
    return new ActivateToolInvocation(
      this.#toolProviders,
      this.#activeTools,
      args
    );
  }
}

class ActivateToolInvocation implements ToolInvocation<Outputs> {
  readonly #toolProviders: SignalArray<ToolProvider>;
  readonly #activeTools: SignalSet<BBRTTool>;
  readonly #args: Inputs;
  readonly #outcome = new Deferred<"allow" | "deny">();
  readonly state = new Signal.State<ToolInvocationState<Outputs>>({
    status: "unstarted",
  });

  constructor(
    toolProviders: SignalArray<ToolProvider>,
    activeTools: SignalSet<BBRTTool>,
    args: Inputs
  ) {
    this.#toolProviders = toolProviders;
    this.#activeTools = activeTools;
    this.#args = args;
  }

  render() {
    return html`
      <bbrt-activate-modal
        .name=${this.#args.name}
        @allow=${() => this.#outcome.resolve("allow")}
        @deny=${() => this.#outcome.resolve("deny")}
      >
      </bbrt-activate-modal>
    `;
  }

  renderContent() {
    return nothing;
  }

  async start(): Promise<void> {
    if (this.state.get().status !== "unstarted") {
      return;
    }
    this.state.set({ status: "running" });

    const result = await this.#outcome.promise;
    switch (result) {
      case "allow": {
        const match = await this.#findTool(this.#args.name);
        if (match !== undefined) {
          this.#activeTools.add(match);
          this.state.set({
            status: "success",
            value: { output: {}, artifacts: [] },
          });
        } else {
          this.state.set({
            status: "error",
            error: "Error finding tool",
          });
        }
        break;
      }
      case "deny": {
        this.state.set({
          status: "error",
          error: "User disallowed tool",
        });
        break;
      }
      default: {
        result satisfies never;
        console.error("Unknown result:", result);
        this.state.set({
          status: "error",
          error: "Internal error",
        });
        break;
      }
    }
  }

  async #findTool(name: string): Promise<BBRTTool | undefined> {
    for (const provider of this.#toolProviders) {
      for (const tool of provider.tools()) {
        if (tool.metadata.id === name) {
          return tool;
        }
      }
    }
    return undefined;
  }
}

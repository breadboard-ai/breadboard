/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing } from "lit";
import type { SignalArray } from "signal-utils/array";
import type { SignalSet } from "signal-utils/set";
import "../components/activate-modal.js";
import type {
  GeminiFunctionDeclaration,
  GeminiParameterSchema,
} from "../llm/gemini.js";
import { Deferred } from "../util/deferred.js";
import { type Result } from "../util/result.js";
import type { ToolProvider } from "./tool-provider.js";
import type { BBRTTool, BBRTToolAPI } from "./tool.js";

interface ActivateToolInputs {
  name: string;
}

type ActivateToolOutputs =
  | { status: "success" }
  | { status: "error"; error: string };

export class ActivateTool
  implements BBRTTool<ActivateToolInputs, ActivateToolOutputs>
{
  // TODO(aomarks) A bit complicated and leaks memory. There should be a better
  // way to track the lifecycle of one invocation. A separate class, probably?
  #requests = new Map<string, Deferred<"allow" | "deny">>();
  #toolProviders: SignalArray<ToolProvider>;
  #activeTools: SignalSet<BBRTTool>;

  constructor(
    toolProviders: SignalArray<ToolProvider>,
    activeTools: SignalSet<BBRTTool>
  ) {
    this.#toolProviders = toolProviders;
    this.#activeTools = activeTools;
  }

  get displayName() {
    return "Activate a tool.";
  }

  get icon() {
    return "/bbrt/images/tool.svg";
  }

  renderCard({ name }: ActivateToolInputs) {
    return html`
      <bbrt-activate-modal
        .name=${name}
        @allow=${() => this.#allow(name)}
        @deny=${() => this.#deny(name)}
      >
      </bbrt-activate-modal>
    `;
  }

  #allow(name: string) {
    this.#getOrCreateInvocation(name).resolve("allow");
  }

  #deny(name: string) {
    this.#getOrCreateInvocation(name).resolve("deny");
  }

  #getOrCreateInvocation(name: string) {
    let invocation = this.#requests.get(name);
    if (invocation === undefined) {
      invocation = new Deferred();
      this.#requests.set(name, invocation);
    }
    return invocation;
  }

  renderResult() {
    return nothing;
  }

  declaration(): GeminiFunctionDeclaration {
    const schema = this.describe();
    let parameters: GeminiParameterSchema;
    if (schema.ok) {
      parameters = schema.value.inputSchema as GeminiParameterSchema;
    } else {
      console.error("Error getting board schema", schema);
      parameters = {};
    }
    return {
      name: "activate_tool",
      description:
        "Activate a tool, asking the user's permission if necessary.",
      parameters,
    };
  }

  describe(): Result<BBRTToolAPI> {
    return {
      ok: true,
      value: {
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name of the board to activate.",
            },
          },
          required: ["name"],
        },
        outputSchema: {},
      },
    };
  }

  async invoke({ name }: ActivateToolInputs) {
    const result = await this.#getOrCreateInvocation(name).promise;
    switch (result) {
      case "allow": {
        const match = await this.#findTool(name);
        if (match === undefined) {
          return {
            ok: true as const,
            value: {
              artifacts: [],
              output: {
                status: "error",
                error: "Error finding tool",
              } satisfies ActivateToolOutputs,
            },
          };
        }
        this.#activeTools.add(match);
        return {
          ok: true as const,
          value: {
            artifacts: [],
            output: { status: "success" } satisfies ActivateToolOutputs,
          },
        };
      }
      case "deny": {
        return {
          ok: true as const,
          value: {
            artifacts: [],
            output: {
              status: "error",
              error: "User disallowed tool.",
            } satisfies ActivateToolOutputs,
          },
        };
      }
      default: {
        result satisfies never;
        console.error("Unknown result:", result);
        return {
          ok: true as const,
          value: {
            artifacts: [],
            output: {
              status: "error",
              error: "Internal error",
            } satisfies ActivateToolOutputs,
          },
        };
      }
    }
  }

  async #findTool(name: string): Promise<BBRTTool | undefined> {
    for (const provider of this.#toolProviders) {
      for (const tool of provider.tools()) {
        // TODO(aomarks) Slow.
        if ((await tool.declaration()).name === name) {
          return tool;
        }
      }
    }
    return undefined;
  }
}

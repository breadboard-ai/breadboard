/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeToolSafeName } from "../breadboard/make-tool-safe-name.js";
import type { GeminiFunctionDeclaration } from "../drivers/gemini-types.js";
import type { EmptyObject } from "../util/empty-object.js";
import type { Result } from "../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "./tool-types.js";

type Outputs = { tools: GeminiFunctionDeclaration[] };

export class BoardLister implements BBRTTool<EmptyObject, Outputs> {
  #tools: Promise<BBRTTool[]>;

  constructor(tools: Promise<BBRTTool[]>) {
    this.#tools = tools;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "list_tools",
    title: "List Tools",
    description:
      "List all of the additional tools available for activation in this chat session." +
      " Useful if the currently provided tools are not sufficient for responding to the" +
      " user. Note that the model cannot invoke these tools directly, they must first request" +
      " to the user if they tool may be installed using the `activate_tool` function.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<BBRTToolAPI>> {
    return {
      ok: true,
      value: {
        inputSchema: {
          type: "object",
          properties: {},
        },
        outputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
            },
          },
        },
      },
    };
  }

  execute(): { result: Promise<Result<{ data: Outputs }>> } {
    return {
      result: (async () => {
        const tools = (await this.#tools).map(
          async (tool): Promise<GeminiFunctionDeclaration> => ({
            // TODO(aomarks) Server namespace should be included here.
            name: makeToolSafeName(tool.metadata.id),
            // TODO(aomarks) Get the real description.
            description: tool.metadata.title,
          })
        );
        return {
          ok: true,
          value: {
            data: {
              tools: await Promise.all(tools),
            },
          },
        };
      })(),
    };
  }
}

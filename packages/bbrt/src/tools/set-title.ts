/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "../components/activate-modal.js";
import type { EmptyObject } from "../util/empty-object.js";
import type { Result } from "../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "./tool-types.js";

interface Inputs {
  title: string;
}

type Callback = (title: string) => Result<void>;

export class SetTitleTool implements BBRTTool<Inputs, EmptyObject> {
  #callback: Callback;

  constructor(callback: Callback) {
    this.#callback = callback;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "set_title",
    title: "Set Title",
    description: "Set the title of the conversation.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<BBRTToolAPI>> {
    return {
      ok: true as const,
      value: {
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "The new title.",
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

  async #execute({ title }: Inputs): Promise<Result<{ data: EmptyObject }>> {
    const result = this.#callback(title);
    if (!result.ok) {
      return result;
    }
    return { ok: true, value: { data: {} } };
  }
}

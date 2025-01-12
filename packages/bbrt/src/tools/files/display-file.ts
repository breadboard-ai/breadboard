/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EmptyObject } from "../../util/empty-object.js";
import type { Result } from "../../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "../tool-types.js";

interface Inputs {
  path: string;
}

type Outputs = EmptyObject;

type Callback = (path: string) => Result<void>;

export class DisplayFile implements BBRTTool<Inputs, Outputs> {
  #callback: Callback;

  constructor(callback: Callback) {
    this.#callback = callback;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "display_file",
    title: "Display File",
    description:
      "Display a file to the user in a prominent manner so that they can see " +
      "and interact with it.",
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
              description: "The path of the file to display.",
            },
          },
          required: [],
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

  async #execute({ path }: Inputs): Promise<Result<{ data: Outputs }>> {
    const result = this.#callback(path);
    if (!result.ok) {
      return result;
    }
    return { ok: true, value: { data: {} } };
  }
}

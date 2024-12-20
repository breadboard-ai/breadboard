/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html } from "lit";
import "../components/activate-modal.js";
import type { ReactiveSessionState } from "../state/session.js";
import type { Result } from "../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "./tool-types.js";

export class ActivateTool
  implements BBRTTool<{ name: string }, { allowed: boolean }>
{
  #activatableToolIds: Promise<ReadonlySet<string>>;
  // TODO(aomarks) I don't love that this is passed down. Should it be the
  // session (there's an initialization order issue that makes this annoying),
  // or something else?
  #sessionState: ReactiveSessionState;

  constructor(
    activatableToolIds: Promise<ReadonlySet<string>>,
    sessionState: ReactiveSessionState
  ) {
    this.#activatableToolIds = activatableToolIds;
    this.#sessionState = sessionState;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "activate_tool",
    title: "Activate Tool",
    description: "Activate a tool, asking the user's permission if necessary.",
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
              description: "The name of the tool to activate.",
            },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            allowed: {
              type: "boolean",
            },
          },
        },
      } satisfies BBRTToolAPI,
    };
  }

  execute(args: { name: string }): {
    render?: () => unknown;
    result: Promise<Result<{ data: { allowed: boolean } }>>;
  } {
    const allowed = Promise.withResolvers<boolean>();
    return {
      render: () => html`
        <bbrt-activate-modal
          .name=${args.name}
          @allow=${() => allowed.resolve(true)}
          @deny=${() => allowed.resolve(false)}
        >
        </bbrt-activate-modal>
      `,
      result: (async (): Promise<Result<{ data: { allowed: boolean } }>> => {
        const activatableToolIds = await this.#activatableToolIds;
        if (!activatableToolIds.has(args.name)) {
          return {
            ok: false,
            error: {
              message: `No tool found with name ${JSON.stringify(args.name)}.`,
            },
          };
        }
        const state = this.#sessionState;
        if (await allowed.promise) {
          if (!state.activeToolIds.has(args.name)) {
            state.activeToolIds = [...state.activeToolIds, args.name];
          }
          return { ok: true, value: { data: { allowed: true } } };
        } else {
          if (state.activeToolIds.has(args.name)) {
            state.activeToolIds = [...state.activeToolIds].filter(
              (id) => id !== args.name
            );
          }
          return { ok: true, value: { data: { allowed: false } } };
        }
      })(),
    };
  }
}

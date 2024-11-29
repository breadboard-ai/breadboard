/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing } from "lit";
import type { BreadboardServer } from "../breadboard/breadboard-server.js";
import { makeToolSafeName } from "../breadboard/make-tool-safe-name.js";
import "../components/content.js";
import type { GeminiFunctionDeclaration } from "../llm/gemini.js";
import type { EmptyObject } from "../util/empty-object.js";
import { type Result } from "../util/result.js";
import type { BBRTInvokeResult, BBRTTool, BBRTToolAPI } from "./tool.js";

export class BoardLister
  implements BBRTTool<EmptyObject, { tools: GeminiFunctionDeclaration[] }>
{
  #servers: BreadboardServer[];

  constructor(servers: BreadboardServer[]) {
    this.#servers = servers;
  }

  get displayName() {
    return "List all boards";
  }

  get icon() {
    return "/bbrt/images/tool.svg";
  }

  renderCard() {
    return html`<span>Listing all boards</span>`;
  }

  renderResult() {
    return nothing;
  }

  declaration(): GeminiFunctionDeclaration {
    return {
      name: "list_tools",
      description:
        "List all of the additional tools available for activation in this chat session. " +
        "Useful if the currently provided tools are not sufficient for responding to the " +
        "user. Note that the model cannot invoke these tools directly, they must first request " +
        " to the user if they tool may be installed using the `activate_tool` function.",
      parameters: {},
    };
  }

  describe(): Result<BBRTToolAPI> {
    return { ok: true, value: { inputSchema: {}, outputSchema: {} } };
  }

  async invoke(): Promise<
    Result<BBRTInvokeResult<{ tools: GeminiFunctionDeclaration[] }>>
  > {
    const tools = (
      await Promise.all(this.#servers.map((server) => server.boardsDetailed()))
    )
      .flat()
      .map(({ path, bgl }) => {
        if (!path || !bgl.description) {
          return null;
        }
        return {
          name: makeToolSafeName(path),
          description: bgl.description,
        } satisfies GeminiFunctionDeclaration;
      })
      .filter((tool) => tool !== null);
    return { ok: true, value: { artifacts: [], output: { tools } } };
  }
}

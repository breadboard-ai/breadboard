/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { html, nothing } from "lit";
import { Signal } from "signal-polyfill";
import type { BreadboardServer } from "../breadboard/breadboard-server.js";
import { makeToolSafeName } from "../breadboard/make-tool-safe-name.js";
import "../components/content.js";
import type { GeminiFunctionDeclaration } from "../llm/gemini.js";
import type { EmptyObject } from "../util/empty-object.js";
import { resultify, type Result } from "../util/result.js";
import type {
  BBRTTool,
  ToolAPI,
  ToolInvocation,
  ToolInvocationState,
  ToolMetadata,
} from "./tool.js";

type Inputs = EmptyObject;
type Outputs = { tools: GeminiFunctionDeclaration[] };

export class BoardLister implements BBRTTool<Inputs, Outputs> {
  #servers: BreadboardServer[];

  constructor(servers: BreadboardServer[]) {
    this.#servers = servers;
  }

  readonly metadata: ToolMetadata = {
    id: "list_tools",
    title: "List Tools",
    description:
      "List all of the additional tools available for activation in this chat session. " +
      "Useful if the currently provided tools are not sufficient for responding to the " +
      "user. Note that the model cannot invoke these tools directly, they must first request " +
      " to the user if they tool may be installed using the `activate_tool` function.",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<ToolAPI>> {
    return {
      ok: true,
      value: {
        inputSchema: {},
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

  invoke() {
    return new ListToolsInvocation(this.#servers);
  }
}

class ListToolsInvocation implements ToolInvocation<Outputs> {
  #servers: BreadboardServer[];
  readonly state = new Signal.State<ToolInvocationState<Outputs>>({
    status: "running",
  });

  render() {
    return html`<span>Listing all boards</span>`;
  }

  renderContent() {
    return nothing;
  }

  constructor(servers: BreadboardServer[]) {
    this.#servers = servers;
    void this.#start();
  }

  async #start(): Promise<void> {
    const toolResults = (
      await Promise.all(
        this.#servers.map((server) => this.#getToolsFromServer(server))
      )
    ).flat();
    const tools = [];
    for (const tool of toolResults) {
      if (!tool.ok) {
        this.state.set({
          status: "error",
          error: tool.error,
        });
        return;
      }
      tools.push(tool.value);
    }
    this.state.set({
      status: "success",
      value: { output: { tools }, artifacts: [] },
    });
  }

  async #getToolsFromServer(
    server: BreadboardServer
  ): Promise<Array<Result<GeminiFunctionDeclaration>>> {
    const boards = await resultify(server.boardsDetailed());
    if (!boards.ok) {
      return [boards];
    }
    return boards.value
      .map(({ path, bgl }) => {
        if (!path || !bgl.description) {
          return null;
        }
        return {
          ok: true as const,
          value: {
            name: makeToolSafeName(server.url + "_" + path),
            description: bgl.description,
          } satisfies GeminiFunctionDeclaration,
        };
      })
      .filter((tool) => tool !== null);
  }
}

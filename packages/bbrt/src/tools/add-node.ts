/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  enumeration,
  object,
  toJSONSchema,
  type ConvertBreadboardType,
} from "@breadboard-ai/build";
import type { GraphDescriptor } from "@google-labs/breadboard";
import type { JSONSchema7 } from "json-schema";
import { html, nothing } from "lit";
import { Signal } from "signal-polyfill";
import type { ArtifactReaderWriter } from "../artifacts/artifact-store-interface.js";
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

const inputs = object({
  board: object({ id: "string" }),
  node: object({
    id: "string",
    title: "string",
    description: "string",
    type: enumeration("input", "output"),
  }),
});

type Inputs = ConvertBreadboardType<typeof inputs>;

type Outputs = EmptyObject;

export class AddNode implements BBRTTool<Inputs, Outputs> {
  #artifacts: ArtifactReaderWriter;

  constructor(artifacts: ArtifactReaderWriter) {
    this.#artifacts = artifacts;
  }

  readonly metadata: ToolMetadata = {
    id: "add_node_to_board",
    title: "Add Node To Board",
    description: "Add a node to the currently displayed Breadboard",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<ToolAPI>> {
    return {
      ok: true as const,
      value: {
        // TODO(aomarks) toJSONSchema should use JSONSchema7.
        inputSchema: toJSONSchema(inputs) as JSONSchema7,
        outputSchema: {
          type: "object",
          properties: {},
        },
      } satisfies ToolAPI,
    };
  }

  invoke(args: Inputs) {
    return new AddNodeInvocation(args, this.#artifacts);
  }
}

class AddNodeInvocation implements ToolInvocation<Outputs> {
  readonly #args: Inputs;
  readonly #artifacts: ArtifactReaderWriter;
  readonly state = new Signal.State<ToolInvocationState<Outputs>>({
    status: "unstarted",
  });

  constructor(args: Inputs, artifacts: ArtifactReaderWriter) {
    this.#args = args;
    this.#artifacts = artifacts;
  }

  render() {
    return html`Adding node... `;
  }

  renderContent() {
    return nothing;
  }

  async start(): Promise<void> {
    if (this.state.get().status !== "unstarted") {
      return;
    }
    this.state.set({ status: "running" });
    const boardId = this.#args.board.id;
    const artifact = await this.#artifacts.read(boardId);
    if (!artifact.ok) {
      this.state.set({
        status: "error",
        error: coercePresentableError(artifact.error),
      });
      return;
    }
    const blob = artifact.value.blob;
    if (blob.type !== "application/vnd.breadboard.board") {
      this.state.set({
        status: "error",
        error: {
          message:
            `Expected Artifact ${JSON.stringify(this.#args.board.id)} to` +
            ` have type "application/vnd.breadboard.board", but got` +
            ` ${JSON.stringify(blob.type)}.`,
        },
      });
      return;
    }
    const buffer = await blob.arrayBuffer();
    const board = JSON.parse(
      new TextDecoder().decode(buffer)
    ) as GraphDescriptor;
    const { id, type, title, description } = this.#args.node;

    board.nodes.push({
      id,
      type,
      metadata: {
        title,
        description,
        visual: {
          // TODO(aomarks) A smarter layout algorithm.
          x: getRandomIntInclusive(-400, 400),
          y: getRandomIntInclusive(-400, 400),
          collapsed: false,
        },
      },
    });

    if (board.nodes.length > 1) {
      // TODO(aomarks) Obviously wrong wiring, just to have something to look
      // at.
      board.edges.push({
        from: board.nodes.at(-2)!.id,
        out: "output",
        to: board.nodes.at(-1)!.id,
        in: "output",
      });
    }

    const written = await this.#artifacts.write({
      id: boardId,
      kind: "blob",
      blob: new Blob([JSON.stringify(board)], {
        type: "application/vnd.breadboard.board",
      }),
    });
    if (!written.ok) {
      this.state.set({
        status: "error",
        error: coercePresentableError(written.error),
      });
      return;
    }
    this.state.set({ status: "success", value: { output: {}, artifacts: [] } });
  }
}

function getRandomIntInclusive(min: number, max: number) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

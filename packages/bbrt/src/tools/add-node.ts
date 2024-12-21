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
import type { ArtifactStore } from "../artifacts/artifact-store.js";
import "../components/activate-modal.js";
import type { EmptyObject } from "../util/empty-object.js";
import type { Result } from "../util/result.js";
import type { BBRTTool, BBRTToolAPI, BBRTToolMetadata } from "./tool-types.js";

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
  #artifacts: ArtifactStore;

  constructor(artifacts: ArtifactStore) {
    this.#artifacts = artifacts;
  }

  readonly metadata: BBRTToolMetadata = {
    id: "add_node_to_board",
    title: "Add Node To Board",
    description: "Add a node to the currently displayed Breadboard",
    icon: "/bbrt/images/tool.svg",
  };

  async api(): Promise<Result<BBRTToolAPI>> {
    return {
      ok: true as const,
      value: {
        // TODO(aomarks) toJSONSchema should use JSONSchema7.
        inputSchema: toJSONSchema(inputs) as JSONSchema7,
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

  async #execute(args: Inputs): Promise<Result<{ data: Outputs }>> {
    const entry = this.#artifacts.entry(args.board.id);
    using transaction = await entry.acquireExclusiveReadWriteLock();
    const artifact = await transaction.read();
    if (!artifact.ok) {
      return { ok: false, error: artifact.error };
    }

    const blob = artifact.value.blob;
    if (blob.type !== "application/vnd.breadboard.board") {
      return {
        ok: false,
        error: {
          message:
            `Expected Artifact ${JSON.stringify(args.board.id)} to` +
            ` have type "application/vnd.breadboard.board", but got` +
            ` ${JSON.stringify(blob.type)}.`,
        },
      };
    }
    const buffer = await blob.arrayBuffer();
    const board = JSON.parse(
      new TextDecoder().decode(buffer)
    ) as GraphDescriptor;
    const { id, type, title, description } = args.node;

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

    const written = await transaction.write(
      new Blob([JSON.stringify(board)], {
        type: "application/vnd.breadboard.board",
      })
    );
    if (!written.ok) {
      return { ok: false, error: written.error };
    }
    return { ok: true, value: { data: {} } };
  }
}

function getRandomIntInclusive(min: number, max: number) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

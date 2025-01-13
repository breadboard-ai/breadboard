/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type GraphDescriptor,
  type Kit,
  type NodeDescriberFunction,
  type NodeDescriptor,
  type NodeHandler,
} from "@google-labs/breadboard";
import type { ArtifactHandle } from "../artifacts/artifact-interface.js";
import type { ArtifactStore } from "../artifacts/artifact-store.js";
import type { SecretsProvider } from "../secrets/secrets-provider.js";
import type {
  BBRTTool,
  BBRTToolAPI,
  BBRTToolMetadata,
} from "../tools/tool-types.js";
import type { JsonSerializableObject } from "../util/json-serializable.js";
import type { Result } from "../util/result.js";
import { BreadboardToolInvocation } from "./breadboard-tool.js";
import { makeToolSafeName } from "./make-tool-safe-name.js";

export class BreadboardComponentTool implements BBRTTool {
  readonly #kit: Kit;
  readonly #id: string;
  readonly #describe?: NodeDescriberFunction;
  readonly #secrets: SecretsProvider;
  readonly #artifacts: ArtifactStore;
  readonly #kits: Kit[];

  constructor(
    kit: Kit,
    id: string,
    handler: NodeHandler,
    secrets: SecretsProvider,
    artifacts: ArtifactStore,
    kits: Kit[]
  ) {
    this.#kit = kit;
    this.#id = id;
    this.#secrets = secrets;
    this.#artifacts = artifacts;
    this.#kits = kits;
    if ("describe" in handler) {
      this.#describe = handler.describe;
    }
  }

  get metadata(): BBRTToolMetadata {
    return {
      id: makeToolSafeName(`${this.#kit.url}_${this.#id}`),
      title: `${this.#kit.title}: ${this.#id}`,
      description: "TODO",
      icon: "/bbrt/images/tool.svg",
    };
  }

  async api(): Promise<Result<BBRTToolAPI>> {
    if (this.#describe) {
      return { ok: true, value: (await this.#describe()) as BBRTToolAPI };
    }
    return {
      ok: true,
      value: {
        inputSchema: {},
        outputSchema: {},
      },
    };
  }

  execute(args: JsonSerializableObject) {
    return { result: this.#execute(args) };
  }

  async #execute(
    args: JsonSerializableObject
  ): Promise<
    Result<{ data: JsonSerializableObject; artifacts: ArtifactHandle[] }>
  > {
    const component: NodeDescriptor = {
      id: "component",
      type: this.#id,
      configuration: args,
    };
    const bgl: GraphDescriptor = {
      nodes: [component],
      edges: [],
    };
    const invocation = new BreadboardToolInvocation(
      args,
      async () => ({ ok: true, value: bgl }),
      this.#secrets,
      this.#artifacts,
      this.#kits
    );
    await invocation.start();
    const state = invocation.state.get();
    if (state.status === "success") {
      return {
        ok: true,
        value: {
          data: state.value.output as JsonSerializableObject,
          artifacts: state.value.artifacts,
        },
      };
    } else if (state.status === "error") {
      return { ok: false, error: state.error };
    } else {
      state.status satisfies "running" | "unstarted";
      return { ok: false, error: `Internal error: state was ${state.status}` };
    }
  }
}

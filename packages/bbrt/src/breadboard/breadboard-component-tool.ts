/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createGraphStore,
  createLoader,
  type GraphDescriptor,
  type Kit,
  type NodeDescriberFunction,
  type NodeDescriptor,
  type NodeHandler,
} from "@google-labs/breadboard";
import type { TokenVendor } from "../../../connection-client/dist/src/types.js";
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
import { BreadboardToolInvocation } from "./breadboard-invocation.js";
import { makeToolSafeName } from "./make-tool-safe-name.js";
import { standardizeBreadboardSchema } from "./standardize-breadboard-schema.js";

export class BreadboardComponentTool implements BBRTTool {
  readonly #kit: Kit;
  readonly #id: string;
  readonly #describe?: NodeDescriberFunction;
  readonly #secrets: SecretsProvider;
  readonly #tokenVendor: TokenVendor;
  readonly #artifacts: ArtifactStore;
  readonly #kits: Kit[];

  constructor(
    kit: Kit,
    id: string,
    handler: NodeHandler,
    secrets: SecretsProvider,
    tokenVendor: TokenVendor,
    artifacts: ArtifactStore,
    kits: Kit[]
  ) {
    this.#kit = kit;
    this.#id = id;
    this.#secrets = secrets;
    this.#tokenVendor = tokenVendor;
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
    const graphStore = createGraphStore({
      kits: this.#kits,
      loader: createLoader(),
      sandbox: {
        runModule: () => {
          throw new Error("TODO: runModule not implemented");
        },
      },
      fileSystem: {
        read() {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
        write() {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
        addStream() {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
        query() {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
        close: function (): Promise<void> {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
        createRunFileSystem: function () {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
        createModuleFileSystem: function () {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
        env: function () {
          throw new Error(
            "Non-existent filesystem: Terrible Options were used."
          );
        },
      },
    });

    if (this.#describe) {
      const { inputSchema, outputSchema } = await this.#describe(
        undefined,
        undefined,
        undefined,
        {
          graphStore,
          outerGraph: { nodes: [], edges: [] },
          wires: { incoming: {}, outgoing: {} },
        }
      );
      return {
        ok: true,
        value: {
          inputSchema: standardizeBreadboardSchema(inputSchema),
          outputSchema: standardizeBreadboardSchema(outputSchema),
        },
      };
    }
    return {
      ok: true,
      value: {
        inputSchema: { type: "object", properties: {}, required: [] },
        outputSchema: { type: "object", properties: {}, required: [] },
      },
    };
  }

  execute(args: JsonSerializableObject) {
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
      this.#tokenVendor,
      this.#artifacts,
      this.#kits
    );
    return {
      result: this.#execute(invocation),
    };
  }

  async #execute(
    invocation: BreadboardToolInvocation
  ): Promise<
    Result<{ data: JsonSerializableObject; artifacts: ArtifactHandle[] }>
  > {
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

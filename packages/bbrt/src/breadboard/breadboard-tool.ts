/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GraphDescriptor, type Kit } from "@google-labs/breadboard";
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
import type {
  BreadboardBoardListing,
  BreadboardServiceClient,
} from "./breadboard-server.js";
import { getDefaultSchema } from "./get-default-schema.js";
import { makeToolSafeName } from "./make-tool-safe-name.js";
import { standardizeBreadboardSchema } from "./standardize-breadboard-schema.js";

export class BreadboardTool implements BBRTTool {
  readonly #listing: BreadboardBoardListing;
  readonly #server: BreadboardServiceClient;
  readonly #secrets: SecretsProvider;
  readonly #tokenVendor: TokenVendor;
  readonly #artifacts: ArtifactStore;
  readonly #kits: Kit[];

  constructor(
    listing: BreadboardBoardListing,
    server: BreadboardServiceClient,
    secrets: SecretsProvider,
    tokenVendor: TokenVendor,
    artifacts: ArtifactStore,
    kits: Kit[]
  ) {
    this.#listing = listing;
    this.#server = server;
    this.#secrets = secrets;
    this.#tokenVendor = tokenVendor;
    this.#artifacts = artifacts;
    this.#kits = kits;
  }

  get metadata(): BBRTToolMetadata {
    return {
      id: makeToolSafeName(this.#server.url + "_" + this.#listing.path),
      title: this.#listing.title,
      description: "TODO",
      icon: "/bbrt/images/tool.svg",
    };
  }

  #api?: Promise<Result<BBRTToolAPI>>;
  async api(): Promise<Result<BBRTToolAPI>> {
    return (this.#api ??= (async () => {
      const bgl = await this.bgl();
      if (!bgl.ok) {
        return bgl;
      }
      const desc = await getDefaultSchema(bgl.value);
      if (!desc.ok) {
        return desc;
      }
      return {
        ok: true,
        value: {
          inputSchema: standardizeBreadboardSchema(desc.value.inputSchema),
          outputSchema: standardizeBreadboardSchema(desc.value.outputSchema),
        },
      };
    })());
  }

  execute(args: JsonSerializableObject) {
    const invocation = new BreadboardToolInvocation(
      args,
      () => this.bgl(),
      this.#secrets,
      this.#tokenVendor,
      this.#artifacts,
      this.#kits
    );
    return {
      result: this.#execute(invocation),
      render: () => invocation.render(),
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

  #bglCache?: Promise<Result<GraphDescriptor>>;
  bgl(): Promise<Result<GraphDescriptor>> {
    return (this.#bglCache ??= this.#server.board(this.#listing.path));
  }
}

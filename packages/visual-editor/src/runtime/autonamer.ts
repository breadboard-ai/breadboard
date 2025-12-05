/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createFileSystemBackend } from "../idb/index.js";
import { CapabilitiesManagerImpl } from "@breadboard-ai/runtime/legacy.js";
import type {
  Kit,
  MutableGraph,
  NodeHandlerContext,
} from "@breadboard-ai/types";
import { GraphDescriptor, LLMContent } from "@breadboard-ai/types";
import { RunnableModuleFactory } from "@breadboard-ai/types/sandbox.js";
import { ok } from "@breadboard-ai/utils";
import {
  composeFileSystemBackends,
  createEphemeralBlobStore,
  createFileSystem,
  FileSystem,
  GraphStoreArgs,
  Outcome,
} from "@google-labs/breadboard";

export { Autonamer };

class Autonamer {
  #kits: Kit[];
  #fileSystem: FileSystem;

  constructor(
    args: GraphStoreArgs,
    fileSystem: FileSystem | undefined,
    private readonly moduleFactory: RunnableModuleFactory
  ) {
    this.#fileSystem = createFileSystem({
      env: fileSystem?.env() || [],
      local: createFileSystemBackend(createEphemeralBlobStore()),
      mnt: composeFileSystemBackends(new Map()),
    });
    this.#kits = args.kits;
  }

  async autoname(
    inputs: LLMContent[],
    signal: AbortSignal
  ): Promise<Outcome<LLMContent[]>> {
    const context: NodeHandlerContext = {
      kits: this.#kits,
      fileSystem: this.#fileSystem,
      signal,
    };
    const module = await this.moduleFactory.createRunnableModule(
      {} as unknown as MutableGraph,
      {
        url: "embed://a2/autoname.bgl.json#module:main",
      } as unknown as GraphDescriptor,
      context,
      new CapabilitiesManagerImpl(context)
    );
    if (!ok(module)) return module;
    const results = await module.invoke("main", { context: inputs });
    return (results as { context: LLMContent[] }).context;
  }
}

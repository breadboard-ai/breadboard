/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CapabilitiesManagerImpl } from "../../engine/runtime/legacy.js";
import type { MutableGraph, NodeHandlerContext } from "@breadboard-ai/types";
import {
  FileSystem,
  GraphDescriptor,
  GraphStoreArgs,
  LLMContent,
  Outcome,
} from "@breadboard-ai/types";
import { RunnableModuleFactory } from "@breadboard-ai/types/sandbox.js";
import { ok } from "@breadboard-ai/utils";
import { composeFileSystemBackends } from "../../engine/file-system/composed-peristent-backend.js";
import { createEphemeralBlobStore } from "../../engine/file-system/ephemeral-blob-store.js";
import { createFileSystem } from "../../engine/file-system/index.js";
import { createFileSystemBackend } from "../../idb/index.js";

export { Autonamer };

class Autonamer {
  #fileSystem: FileSystem;

  constructor(
    _args: GraphStoreArgs,
    fileSystem: FileSystem | undefined,
    private readonly moduleFactory: RunnableModuleFactory
  ) {
    this.#fileSystem = createFileSystem({
      env: fileSystem?.env() || [],
      local: createFileSystemBackend(createEphemeralBlobStore()),
      mnt: composeFileSystemBackends(new Map()),
    });
  }

  async autoname(
    inputs: LLMContent[],
    signal: AbortSignal
  ): Promise<Outcome<LLMContent[]>> {
    const context: NodeHandlerContext = {
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

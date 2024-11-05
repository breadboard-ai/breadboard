/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Module as ModuleType,
  GraphDescriptor,
  ModuleCode,
  ModuleIdentifier,
  ModuleMetadata,
} from "@breadboard-ai/types";
import {
  InspectableModule,
  InspectableModuleCache,
  InspectableModules,
} from "./types.js";

class Module implements InspectableModule {
  #code: ModuleCode | undefined;
  #metadata: ModuleMetadata | undefined;

  constructor({ code, metadata }: ModuleType) {
    this.#code = code;
    this.#metadata = metadata;
  }

  code(): ModuleCode {
    return this.#code ?? "";
  }

  metadata(): ModuleMetadata {
    return this.#metadata ?? {};
  }
}

export class ModuleCache implements InspectableModuleCache {
  #modules: Record<ModuleIdentifier, InspectableModule> = {};

  get(id: ModuleIdentifier): InspectableModule | undefined {
    return this.#modules[id];
  }

  add(id: ModuleIdentifier, module: ModuleType): void {
    this.#modules[id] = new Module(module);
  }

  remove(id: ModuleIdentifier): void {
    if (!this.#modules[id]) {
      return;
    }

    delete this.#modules[id];
  }

  modules(): InspectableModules {
    return this.#modules ?? {};
  }

  populate(graph: GraphDescriptor) {
    if (!graph.modules) {
      return;
    }

    for (const [id, module] of Object.entries(graph.modules)) {
      this.add(id, module);
    }
  }
}

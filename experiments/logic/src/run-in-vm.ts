/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, Module, SourceTextModule } from "vm";

export async function runInVm<T>(code: string): Promise<T> {
  const context = createContext({});
  let module: SourceTextModule;
  try {
    module = new SourceTextModule(code, { context });
  } catch (e) {
    throw new Error(`Syntax Error: ${(e as Error).message}`);
  }
  const linker = async (specifier: string): Promise<Module> => {
    throw new Error(
      `Dynamic import not allowed: cannot resolve '${specifier}'`
    );
  };

  await module.link(linker);
  await module.evaluate();

  const defaultExport = (module.namespace as { default: object }).default;

  if (!defaultExport) {
    throw new Error("The module must have a default export.");
  }
  if (typeof defaultExport !== "function") {
    throw new Error(
      `The default export must be a function, but received type '${typeof defaultExport}'.`
    );
  }
  return defaultExport as T;
}

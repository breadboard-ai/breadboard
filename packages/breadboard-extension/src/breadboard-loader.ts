/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import ts from "typescript";
import vm from "node:vm";
import * as vscode from "vscode";

/**
 * This loader transpiles TypeScript on the fly and into a graph that can be
 * rendered in the Webview or passed to the debugger.
 *
 * We load in Breadboard and all of the kits. From here we take the TypeScript,
 * run it through the TS compiler to get JS. We then ask Node to run it using
 * node:vm, and we provide to it all of the kits that it would need in order to
 * serialize the graph.
 *
 * If the compilation fails for any reason we will just leave it as-is.
 */
export class BreadboardLoader {
  #mods:
    | [
        typeof import("@google-labs/breadboard"),
        typeof import("@google-labs/core-kit"),
        typeof import("@google-labs/json-kit"),
        typeof import("@google-labs/template-kit"),
        typeof import("@google-labs/node-nursery-web"),
        typeof import("@google-labs/palm-kit")
      ]
    | null = null;

  async #lazyLoadModulesIfNeeded() {
    if (this.#mods) {
      return this.#mods;
    }

    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: false,
        title: "Loading renderer...",
      },
      async () => {
        return await Promise.all([
          import("@google-labs/breadboard"),
          import("@google-labs/core-kit"),
          import("@google-labs/json-kit"),
          import("@google-labs/template-kit"),
          import("@google-labs/node-nursery-web"),
          import("@google-labs/palm-kit"),
        ]);
      }
    );
  }

  async #loadFromResource(resource: vscode.Uri) {
    if (!this.#mods) {
      this.#mods = await this.#lazyLoadModulesIfNeeded();
    }

    // Step 1. Load in the file contents.
    const fileContents = await vscode.workspace.fs.readFile(resource);
    const typeScriptContents = fileContents.toString();

    // Step 2. Transpile using the TypeScript Compiler.
    const result = ts.transpileModule(typeScriptContents, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ESNext,
      },
    });

    // Step 3. Wrap it into something that looks like an iife.
    const code = `(async (require) => {
      const exports = globalThis.exports || {};
      ${result.outputText}

      return exports.default;
    })`;

    const [breadboard, coreKit, jsonKit, templateKit, nodeNurseryWeb, palmKit] =
      this.#mods;

    // Step 4. Try running the code. Where kits are requested, hand in the
    // ones we already loaded here.
    const descriptor = await vm.runInNewContext(code, {
      filename: "board.js",
    })((specifier: string) => {
      switch (specifier) {
        case "@google-labs/breadboard": {
          return breadboard;
        }

        case "@google-labs/core-kit": {
          return coreKit;
        }

        case "@google-labs/json-kit": {
          return jsonKit;
        }

        case "@google-labs/template-kit": {
          return templateKit;
        }

        case "@google-labs/node-nursery-web": {
          return nodeNurseryWeb;
        }
        case "@google-labs/palm-kit": {
          return palmKit;
        }

        default:
          throw new Error("Unexpected import");
      }
    });

    // Step 5. Return the descriptor.
    return descriptor;
  }

  async loadGraphFromResource(resource: vscode.Uri) {
    if (!this.#mods) {
      this.#mods = await this.#lazyLoadModulesIfNeeded();
    }

    const [breadboard] = this.#mods;
    const descriptor = await this.#loadFromResource(resource);
    return breadboard.toMermaid(descriptor);
  }

  async loadBoardFromResource(resource: vscode.Uri) {
    return this.#loadFromResource(resource);
  }
}

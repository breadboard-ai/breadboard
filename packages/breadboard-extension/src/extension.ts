/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as ts from "typescript";
import vm from "node:vm";
import * as vscode from "vscode";
import { BreadboardDebugSession } from "./breadboard-debug-session.js";

class BreadboardSessionFactory implements vscode.DebugAdapterDescriptorFactory {
  constructor(private output: vscode.OutputChannel) {}

  createDebugAdapterDescriptor(): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(
      new BreadboardDebugSession(this.output)
    );
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Breadboard");
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory(
      "breadboard",
      new BreadboardSessionFactory(output)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "breadboard.getBoardPath",
      async (resource: vscode.Uri) => {
        let fileForDebuggging: string | undefined = resource.path;
        if (!fileForDebuggging && vscode.window.activeTextEditor) {
          fileForDebuggging = await vscode.window.showInputBox({
            title: "Your board",
            prompt: "Please enter the path",
            value: vscode.workspace.asRelativePath(
              vscode.window.activeTextEditor.document.uri.path
            ),
          });
        }

        if (!fileForDebuggging) {
          vscode.window.showErrorMessage("No board selected for debugging!");
          return;
        }

        const matches = await vscode.workspace.findFiles(fileForDebuggging);
        if (matches.length !== 1) {
          vscode.window.showErrorMessage(
            `Board does not exist: ${fileForDebuggging}`
          );
          return;
        }

        return fileForDebuggging;
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "breaboard.runBoard",
      (resource: vscode.Uri) => {
        let fileForDebuggging = resource;
        if (!fileForDebuggging && vscode.window.activeTextEditor) {
          fileForDebuggging = vscode.window.activeTextEditor.document.uri;
        }

        if (!fileForDebuggging) {
          vscode.window.showErrorMessage("No board selected for debugging!");
          return;
        }

        vscode.debug.startDebugging(undefined, {
          type: "breadboard",
          name: "Debug Board",
          request: "launch",
          board: fileForDebuggging.fsPath,
          stopOnEntry: true,
        });
      }
    )
  );

  /**
   * Here we offer the "render board" command. To do that, however, we need to
   * be able to transpile TypeScript on the fly and into a graph that can be
   * rendered in the Webview.
   *
   * What we therefore do is wait until the first invocation of the command to
   * load in Breadboard and all of the kits. From here we proceed to create the
   * panel and a watcher for when the file is changed or deleted. When the
   * contents of the file are changed we take the TypeScript, run it through
   * the TS compiler to get JS. We then ask Node to run it using node:vm, and we
   * provide to it all of the kits that it would need in order to serialize the
   * graph.
   *
   * If the compilation fails for any reason we will just leave it as-is. If,
   * however, we get a new graph, we will post it to the webview and ask for it
   * to be rendered.
   */

  let panelJS: string | null = null;
  let mods:
    | [
        typeof import("@google-labs/breadboard"),
        typeof import("@google-labs/core-kit"),
        typeof import("@google-labs/json-kit"),
        typeof import("@google-labs/template-kit"),
        typeof import("@google-labs/node-nursery-web"),
        typeof import("@google-labs/palm-kit")
      ]
    | null = null;

  let hasLoaded = false;
  async function lazyLoadModulesIfNeeded() {
    if (hasLoaded) {
      return;
    }

    const panelJSUri = vscode.Uri.joinPath(
      context.extensionUri,
      "./dist/renderer.js"
    );

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: false,
        title: "Loading renderer...",
      },
      async () => {
        panelJS = (await vscode.workspace.fs.readFile(panelJSUri)).toString();
        mods = await Promise.all([
          import("@google-labs/breadboard"),
          import("@google-labs/core-kit"),
          import("@google-labs/json-kit"),
          import("@google-labs/template-kit"),
          import("@google-labs/node-nursery-web"),
          import("@google-labs/palm-kit"),
        ]);
      }
    );

    hasLoaded = true;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "breaboard.renderBoard",
      async (resource: vscode.Uri) => {
        if (!resource && vscode.window.activeTextEditor) {
          resource = vscode.window.activeTextEditor.document.uri;
        }

        if (!resource) {
          vscode.window.showErrorMessage("No board selected for debugging!");
          return;
        }

        const watcher = vscode.workspace.createFileSystemWatcher(
          resource.fsPath,
          true,
          false,
          false
        );

        const panel = vscode.window.createWebviewPanel(
          "board-render",
          "Board Diagram",
          vscode.ViewColumn.Two,
          { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.onDidDispose(() => {
          watcher.dispose();
        });

        panel.webview.onDidReceiveMessage((message: { msg: string }) => {
          vscode.window.showInformationMessage(message.msg);
        });

        // Lazy load all the things...
        await lazyLoadModulesIfNeeded();

        const sendGraphToPanel = async (resource: vscode.Uri) => {
          if (!panel || !mods) {
            return;
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

          const [
            breadboard,
            coreKit,
            jsonKit,
            templateKit,
            nodeNurseryWeb,
            palmKit,
          ] = mods;

          // Step 4. Try running the code. Where kits are requested, hand in the
          // ones we already loaded here.
          try {
            const descriptor = await vm.runInNewContext(code, {
              filename: "board.js",
            })((specifier: string) => {
              if (!mods) {
                throw new Error("Unexpected import");
              }

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

            const boardDesription =
              await breadboard.BoardRunner.fromGraphDescriptor(descriptor);
            panel.title = `Board Diagram (${
              boardDesription.title || "Untitled Board"
            })`;

            // Step 5. Post the graph over to the web view for rendering.
            const graph = breadboard.toMermaid(descriptor);
            panel.webview.postMessage({ graph });
          } catch (err) {
            // Likely failed to compile...";
            console.warn(err);
            return;
          }
        };

        panel.webview.html = `<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Board Render</title>
              <style>
                html, body {
                  margin: 0;
                  padding: 0;
                  height: 100%;
                }

                body {
                  background: #FFF;
                }

                main {
                  box-sizing: border-box;
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 32px;
                }

                svg {
                  width: 100%;
                  height: 100%;
                }
              </style>
            </head>
            <body>
              <main>Loading...</main>
              <script type="module">
              (function() {
                ${panelJS}
              })();
              </script>
            </body>
            </html>`;

        watcher.onDidDelete(() => {
          panel?.dispose();
        });

        watcher.onDidChange(async (resource) => {
          if (!panel) {
            watcher.dispose();
            return;
          }

          await sendGraphToPanel(resource);
        });

        await sendGraphToPanel(resource);
      }
    )
  );
}

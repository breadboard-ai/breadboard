/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { BreadboardDebugSession } from "./breadboard-debug-session.js";
import { BreadboardLoader } from "./breadboard-loader.js";

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
      "breaboard.debugBoard",
      async (resource: vscode.Uri) => {
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

  let panelJS: string | null = null;
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

        const loader = new BreadboardLoader();
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

        const sendGraphToPanel = async (resource: vscode.Uri) => {
          if (!panel) {
            return;
          }

          try {
            const graph = await loader.loadGraphFromResource(resource);
            panel.webview.postMessage({ graph });
          } catch (err) {
            // Likely failed to compile...";
            console.warn(err);
            return;
          }
        };

        const panelJSUri = vscode.Uri.joinPath(
          context.extensionUri,
          "./dist/renderer.js"
        );

        if (!panelJS) {
          panelJS = (await vscode.workspace.fs.readFile(panelJSUri)).toString();
        }

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

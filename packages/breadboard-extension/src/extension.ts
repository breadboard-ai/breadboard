/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

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
}

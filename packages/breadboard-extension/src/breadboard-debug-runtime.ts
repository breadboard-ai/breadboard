/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebugProtocol } from "@vscode/debugprotocol";
import { EventEmitter } from "events";
import { parse } from "dotenv";
import { StackFrame } from "@vscode/debugadapter";
import {
  type BreadboardLaunchRequestArguments,
  type InputValues,
  type JSONObject,
  type NodeValue,
  type Resolver,
  BOARD_VARIABLES,
  DEBUGGER_RUNTIME_EVENTS,
  RUNTIME_MODE,
  RUN_RESULT_VARIABLES,
} from "./types";
import * as fs from "fs/promises";
import * as vscode from "vscode";
import path from "path";
import { BreadboardLoader } from "./breadboard-loader";

/**
 * Responsible for invoking Breadboard against a given board. Emits events to,
 * and receives messages from, the Debug Session instance.
 */
export class BreadboardDebugRuntime extends EventEmitter {
  mode = RUNTIME_MODE.STEP;
  nodeBreakpoints: DebugProtocol.FunctionBreakpoint[] = [];

  #notificationSubscribers: Array<Resolver> = [];
  #currentFrame: StackFrame;
  #frameId = 0;
  #globalVariableReferenceId = 100_000;
  #variables = new Map<number, DebugProtocol.Variable[]>();
  #variablesSeen = new Set<number>();
  #env: Record<string, string> = {};

  constructor(private output: vscode.OutputChannel) {
    super();

    this.#currentFrame = {
      id: this.#frameId++,
      name: "Initializing",
      line: 0,
      column: 0,
      canRestart: true,
      presentationHint: "subtle",
    };
  }

  async initialize(args: BreadboardLaunchRequestArguments) {
    await this.#loadEnvIfPossible(args.board);

    this.#info(`Beginning debug of board ${args.board}`);

    const debug = !args.noDebug;
    let boardUrl = args.board;
    if (boardUrl.endsWith(".ts") || boardUrl.endsWith(".js")) {
      // Handle the TypeScript/JavaScript case by transpiling on the fly and
      // creating a temporary URL.
      const loader = new BreadboardLoader();
      const descriptor = await loader.loadBoardFromResource(
        vscode.Uri.parse(boardUrl)
      );
      const data = new Blob([JSON.stringify(descriptor)], {
        type: "application/json",
      });
      boardUrl = URL.createObjectURL(data);
    }

    // Must be a dynamic import so it can be mapped to a require.
    const { Board } = await import("@google-labs/breadboard");
    const base = new URL(`file://${args.board}`);
    const boardData = await Board.load(boardUrl, {
      base,
    });

    this.convertToVariables(
      boardData as unknown as JSONObject,
      BOARD_VARIABLES
    );

    this.#currentFrame = {
      id: this.#frameId++,
      name: "Board loaded",
      line: 0,
      column: 0,
      canRestart: true,
      presentationHint: "subtle",
    };

    if (debug && args.stopOnEntry) {
      this.emit(DEBUGGER_RUNTIME_EVENTS.STOP_ON_ENTRY);
      this.mode = await this.#subscribeForNotify();

      if (this.mode === RUNTIME_MODE.CANCELLED) {
        this.#exit();
        return;
      }
    }

    await this.#run(boardUrl, base, debug);

    if (boardUrl.startsWith("blob:")) {
      URL.revokeObjectURL(boardUrl);
    }

    this.#exit();
  }

  async #run(url: string, base: URL, debug: boolean) {
    const { asRuntimeKit } = await import("@google-labs/breadboard");
    const { run } = await import("@google-labs/breadboard/harness");

    // These need to be set as dynamic imports with strings because of the
    // transpilation process. They can't be - say - and array of strings that
    // get mapped at runtime because then the transpiler won't pick them up.
    const coreKit = import("@google-labs/core-kit");
    const jsonKit = import("@google-labs/json-kit");
    const templateKit = import("@google-labs/template-kit");
    const nodeNurseryWeb = import("@google-labs/node-nursery-web");
    const palmKit = import("@google-labs/palm-kit");
    // TODO: Figure out the top level await for Pinecone.
    // const pineconeKit = import("@google-labs/pinecone-kit");

    // TODO: Figure out if these should be auto-loaded for all boards.
    const kits = await Promise.all(
      [coreKit, jsonKit, templateKit, nodeNurseryWeb, palmKit].map((kit) =>
        kit.then((kitConstructor) => asRuntimeKit(kitConstructor.default))
      )
    );

    this.#info("Loaded kits");

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        cancellable: false,
        title: "Running board",
      },
      async (progress) => {
        mainLoop: for await (const result of run({
          url,
          kits,
          diagnostics: true,
          base,
        })) {
          this.#currentFrame = {
            id: this.#frameId++,
            name: result.type,
            line: 0,
            column: 0,
            canRestart: true,
            presentationHint: "subtle",
          };

          if (
            result.type === "nodestart" ||
            result.type === "nodeend" ||
            result.type === "input" ||
            result.type === "output"
          ) {
            progress.report({
              message: `${result.data.node.type} (${result.data.node.id})`,
            });

            this.#info(
              `${result.type} (${result.data.node.id})`,
              result.data.timestamp
            );
          } else {
            this.#info(`${result.type}`, result.data.timestamp);
          }

          this.clearOldVariables();
          this.convertToVariables(
            result.data as unknown as JSONObject,
            RUN_RESULT_VARIABLES,
            true
          );

          if (debug) {
            switch (this.mode) {
              case RUNTIME_MODE.STEP: {
                this.emit(DEBUGGER_RUNTIME_EVENTS.STOP_ON_STEP);
                this.mode = await this.#subscribeForNotify();
                break;
              }

              case RUNTIME_MODE.CONTINUE: {
                const breakpoint = this.nodeBreakpoints.find((breakpoint) => {
                  if (
                    result.type === "nodestart" ||
                    result.type === "nodeend" ||
                    result.type === "input" ||
                    result.type === "output"
                  ) {
                    return result.data.node.id === breakpoint.name;
                  }
                });

                if (breakpoint) {
                  this.emit(DEBUGGER_RUNTIME_EVENTS.STOP_ON_BREAKPOINT);
                  this.mode = await this.#subscribeForNotify();
                }
                break;
              }

              case RUNTIME_MODE.CANCELLED: {
                this.#exit();
                break mainLoop;
              }
            }
          }

          switch (result.type) {
            case "secret": {
              const inputs: InputValues = {};
              for (const key of result.data.keys) {
                // Use the env if possible.
                if (this.#env[key]) {
                  inputs[key] = this.#env[key];
                } else {
                  const userInput = await vscode.window.showInputBox({
                    title: "Please enter a secret",
                    ignoreFocusOut: true,
                    prompt: `Enter secret key ${key}`,
                    password: true,
                  });

                  if (userInput === undefined) {
                    vscode.window.showErrorMessage(
                      "User input not send - stopping debug session"
                    );

                    this.#exit();
                    return;
                  }

                  inputs[key] = userInput;
                }
              }

              result.reply({ inputs });
              break;
            }

            case "input": {
              const inputs: InputValues = {};
              const schema = result.data.inputArguments.schema;
              if (!schema || !schema.properties) {
                vscode.window.showErrorMessage(
                  "No input schema provided - stopping debug session"
                );
                this.#exit();
                return;
              }

              for (const [id, input] of Object.entries(schema.properties)) {
                // TODO: Figure out how to intake multipart data.
                if (input.format === "multipart") {
                  const error =
                    "The debugger does not support multipart inputs";
                  vscode.window.showErrorMessage(error);
                  this.#error(error);
                  this.#exit();
                  return;
                }

                let userInput: NodeValue = await vscode.window.showInputBox({
                  title: input.title,
                  ignoreFocusOut: true,
                  prompt: input.description ?? input.title,
                  value: input.examples?.join("") ?? input.default ?? "",
                });

                if (userInput === undefined) {
                  vscode.window.showErrorMessage(
                    "User input not send - stopping debug session"
                  );

                  this.#exit();
                  return;
                }

                switch (input.type) {
                  case "object":
                  case "array": {
                    userInput = JSON.parse(userInput) || [];
                    break;
                  }

                  case "boolean": {
                    userInput = userInput === "true";
                    break;
                  }
                }

                inputs[id] = userInput;
              }

              result.reply({ inputs });
              break;
            }

            case "output": {
              this.emit(DEBUGGER_RUNTIME_EVENTS.OUTPUT, result.data.outputs);
              break;
            }

            case "end": {
              this.#info("Board finished");
              break;
            }

            case "error": {
              vscode.window.showErrorMessage(result.data.error);
              this.#error(result.data.error);
              this.#exit();
              break;
            }
          }
        }
      }
    );
  }

  getCurrentFrameInfo() {
    return this.#currentFrame;
  }

  getVariables(id: number) {
    return this.#variables.get(id) || [];
  }

  clearOldVariables() {
    for (const id of this.#variablesSeen) {
      this.#variables.delete(id);
    }

    this.#variablesSeen.clear();
  }

  convertToVariables(item: JSONObject, id = BOARD_VARIABLES, track = false) {
    const variables = Object.entries(item).map(([name, value]) => {
      const descriptor: DebugProtocol.Variable = {
        name,
        type: typeof value,
        value: JSON.stringify(value),
        variablesReference: 0,
      };

      if (typeof value === "object" && value !== null) {
        const id = this.#globalVariableReferenceId++;
        descriptor.namedVariables = Object.keys(value).length;
        descriptor.variablesReference = id;

        if (track) {
          this.#variablesSeen.add(id);
        }

        this.convertToVariables(value, id, track);
      }

      if (typeof value === "undefined") {
        descriptor.value = "undefined";
      }

      return descriptor;
    });

    this.#variables.set(id, variables);
  }

  notify(mode: RUNTIME_MODE) {
    for (const subscriber of this.#notificationSubscribers) {
      subscriber.call(null, mode);
    }

    this.#notificationSubscribers.length = 0;
  }

  #subscribeForNotify() {
    return new Promise<RUNTIME_MODE>((resolve) => {
      this.#notificationSubscribers.push(resolve);
    });
  }

  #info(message: string, timestamp?: number) {
    this.output.appendLine(
      `[INFO]: ${
        timestamp ? `[${timestamp.toFixed(2).padStart(6)}ms] ` : ""
      }${message}`
    );
  }

  #error(message: string) {
    this.output.appendLine(`[ERROR]: ${message}`);
  }

  async #loadEnvIfPossible(boardUrl: string) {
    const envFileLocations: string[] = [];
    if (vscode.workspace.workspaceFolders) {
      for (const workspace of vscode.workspace.workspaceFolders) {
        // It may be that we have a file open that sits outside of the current
        // workspace, and as such the call to asRelativePath will return an
        // absolute path. That means we should skip the workspace in our
        // search for a relevant env file.
        if (path.isAbsolute(vscode.workspace.asRelativePath(boardUrl, false))) {
          continue;
        }

        envFileLocations.push(path.join(workspace.uri.path, ".env"));
      }
    }

    for (const envFileLocation of envFileLocations) {
      try {
        this.#env = parse(await fs.readFile(envFileLocation));
        this.#info(`Using .env file from ${envFileLocation}`);
        break;
      } catch (err) {
        ("Not found in this location - carrying on");
      }
    }

    if (Object.keys(this.#env).length === 0) {
      this.#info("No .env file found");
    }
  }

  #exit() {
    this.#info("Ending debug of board");
    this.emit(DEBUGGER_RUNTIME_EVENTS.END);
  }
}

/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Handles,
  InitializedEvent,
  LoggingDebugSession,
  OutputEvent,
  Scope,
  Source,
  StoppedEvent,
  TerminatedEvent,
  Thread,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { BreadboardDebugRuntime } from "./breadboard-debug-runtime";
import {
  RUNTIME_MODE,
  type BreadboardLaunchRequestArguments,
  DEBUGGER_RUNTIME_EVENTS,
} from "./types";
import path from "path";
import * as vscode from "vscode";

/**
 * The DAP handler. Mediates requests between VS Code and the Breadboard
 * Debugger Runtime.
 *
 * @see https://microsoft.github.io/debug-adapter-protocol/
 */
export class BreadboardDebugSession extends LoggingDebugSession {
  static ThreadID = 1;

  #runtime: BreadboardDebugRuntime;
  #boardName: string | null = null;
  #boardPath: string | null = null;
  #variableHandles = new Handles<"runresult" | "board">();
  #handles = new Map([
    [this.#variableHandles.create("runresult"), "Run Result"],
    [this.#variableHandles.create("board"), "Board"],
  ]);

  constructor(private output: vscode.OutputChannel) {
    super(undefined);

    this.#runtime = new BreadboardDebugRuntime(this.output);

    this.#runtime.on(DEBUGGER_RUNTIME_EVENTS.STOP_ON_ENTRY, () => {
      this.sendEvent(
        new StoppedEvent("entry", BreadboardDebugSession.ThreadID)
      );
    });

    this.#runtime.on(DEBUGGER_RUNTIME_EVENTS.STOP_ON_STEP, () => {
      this.sendEvent(new StoppedEvent("step", BreadboardDebugSession.ThreadID));
    });

    this.#runtime.on(DEBUGGER_RUNTIME_EVENTS.STOP_ON_BREAKPOINT, () => {
      this.sendEvent(
        new StoppedEvent("breakpoint", BreadboardDebugSession.ThreadID)
      );
    });

    this.#runtime.on(
      DEBUGGER_RUNTIME_EVENTS.OUTPUT,
      (values: Record<string, unknown>) => {
        const outputEvent = new OutputEvent(
          `${JSON.stringify(values, null, 2)}\n`,
          "output",
          values
        );
        this.sendEvent(outputEvent);
      }
    );

    this.#runtime.on(DEBUGGER_RUNTIME_EVENTS.END, () => {
      this.sendEvent(new TerminatedEvent());
    });
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse
  ): void {
    response.body = response.body || {};

    response.body.supportsConfigurationDoneRequest = false;
    response.body.supportsStepBack = false;
    response.body.supportsStepInTargetsRequest = false;
    response.body.supportsEvaluateForHovers = false;
    response.body.supportSuspendDebuggee = false;

    // Breakpoint support.
    response.body.supportsBreakpointLocationsRequest = false;
    response.body.supportsDataBreakpoints = false;
    response.body.supportsFunctionBreakpoints = true;
    response.body.supportsConditionalBreakpoints = false;
    response.body.supportsHitConditionalBreakpoints = false;
    response.body.supportsInstructionBreakpoints = false;
    response.body.supportsHitConditionalBreakpoints = false;

    this.sendResponse(response);

    this.sendEvent(new InitializedEvent());
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: BreadboardLaunchRequestArguments
  ): Promise<void> {
    this.#boardName = path.basename(args.board);
    this.#boardPath = args.board;

    let boardLocations: string | undefined = vscode.workspace
      .getConfiguration()
      .get("breadboard.boardLocations");

    if (!boardLocations) {
      const locations = await vscode.workspace.findFiles(
        "packages/breadboard-web/public/graphs/*.json"
      );

      const value = await vscode.window.showInformationMessage(
        "You need to choose your board locations",
        "Okay",
        "No thanks"
      );

      if (value !== "Okay") {
        vscode.window.showErrorMessage(
          "No board locations provided - stopping"
        );
      }

      const boardPath = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: locations[0],
        title: "Please select board locations",
      });

      if (!boardPath || boardPath.length === 0) {
        vscode.window.showErrorMessage(
          "No board locations provided - stopping"
        );
        return;
      }

      boardLocations = boardPath[0].path;
      vscode.workspace
        .getConfiguration()
        .update("breadboard.boardLocations", boardLocations);
    }

    await this.#runtime.initialize(args, boardLocations);
    this.sendResponse(response);
  }

  protected continueRequest(response: DebugProtocol.ContinueResponse): void {
    this.#runtime.notify(RUNTIME_MODE.CONTINUE);
    this.sendResponse(response);
  }

  protected stepInRequest(response: DebugProtocol.StepInResponse): void {
    this.#runtime.notify(RUNTIME_MODE.STEP);
    this.sendResponse(response);
  }

  protected nextRequest(response: DebugProtocol.NextResponse): void {
    this.#runtime.notify(RUNTIME_MODE.STEP);
    this.sendResponse(response);
  }

  protected stepOverRequest(response: DebugProtocol.StepInResponse): void {
    this.#runtime.notify(RUNTIME_MODE.STEP);
    this.sendResponse(response);
  }

  protected stepOutRequest(response: DebugProtocol.StepOutResponse): void {
    this.#runtime.notify(RUNTIME_MODE.STEP);
    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse
  ): void {
    this.#runtime.notify(RUNTIME_MODE.CANCELLED);
    this.sendResponse(response);
  }

  protected scopesRequest(response: DebugProtocol.StepOutResponse): void {
    response.body = {
      scopes: [...this.#handles.entries()].map(
        ([handle, name]) => new Scope(name, handle, false)
      ),
    };
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse
  ): void {
    const frame = this.#runtime.getCurrentFrameInfo();
    frame.source = new Source(
      this.#boardName || "Unknown board",
      this.#boardPath || "Unknown path"
    );

    // TODO: Handle nested boards with multiple stack frames.
    response.body = {
      stackFrames: [frame],
      totalFrames: 1,
    };

    this.sendResponse(response);
  }

  protected setFunctionBreakPointsRequest(
    response: DebugProtocol.SetFunctionBreakpointsResponse,
    args: DebugProtocol.SetFunctionBreakpointsArguments
  ): void {
    this.#runtime.nodeBreakpoints = args.breakpoints;
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): void {
    const target = this.#handles.get(args.variablesReference);
    switch (target) {
      case "Board": {
        response.body = {
          variables: this.#runtime.getVariables(0),
        };
        break;
      }

      case "Run Result": {
        response.body = {
          variables: this.#runtime.getVariables(1),
        };
        break;
      }

      default: {
        response.body = {
          variables: this.#runtime.getVariables(args.variablesReference),
        };
      }
    }

    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    // We have to respond to the thread request from DAP, but since we're
    // single-threaded we can just respond with a static thread ID.
    response.body = {
      threads: [new Thread(BreadboardDebugSession.ThreadID, "main thread")],
    };

    this.sendResponse(response);
  }
}

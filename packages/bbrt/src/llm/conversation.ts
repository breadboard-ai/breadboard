/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { AsyncComputed } from "signal-utils/async-computed";
import type {
  BBRTDriver,
  BBRTDriverInfo,
} from "../drivers/driver-interface.js";
import { ReactiveFunctionCallState } from "../state/function-call.js";
import {
  ReactiveSessionEventState,
  type ReactiveSessionEventTurn,
} from "../state/session-event.js";
import { ReactiveSessionState } from "../state/session.js";
import { ReactiveTurnState } from "../state/turn.js";
import type { BBRTTool } from "../tools/tool-types.js";
import type { Clock } from "../util/clock-type.js";
import type { JsonSerializableObject } from "../util/json-serializable.js";
import { coercePresentableError } from "../util/presentable-error.js";
import type { Result } from "../util/result.js";

export interface ConversationOptions {
  state: ReactiveSessionState;
  drivers: Map<string, BBRTDriver>;
  availableToolsPromise: Promise<Map<string, BBRTTool>>;
  clock?: Clock;
  idGenerator?: () => string;
}

export class Conversation {
  readonly #state: ReactiveSessionState;
  readonly #drivers: Map<string, BBRTDriver>;
  readonly #availableToolsPromise: Promise<Map<string, BBRTTool>>;
  readonly #clock: Clock;
  readonly #idGenerator: () => string;
  @signal accessor #status: "ready" | "busy" = "ready";

  constructor({
    state,
    drivers,
    availableToolsPromise,
    clock,
    idGenerator,
  }: ConversationOptions) {
    this.#state = state;
    this.#drivers = drivers;
    this.#availableToolsPromise = availableToolsPromise;
    this.#clock = clock ?? Date;
    this.#idGenerator = idGenerator ?? (() => crypto.randomUUID());
  }

  get status() {
    return this.#status;
  }

  get turns() {
    return this.#state.turns;
  }

  // TODO(aomarks) Should this pattern be a decorator, or is there a simpler
  // pattern?
  get availableTools() {
    return this.#availableToolsComputed.value;
  }
  readonly #availableToolsComputed = new AsyncComputed<
    ReadonlyMap<string, BBRTTool>
  >(() => this.#availableToolsPromise);

  send(text: string): Result<{ done: Promise<void> }> {
    if (this.#status === "busy") {
      return { ok: false, error: new Error("Session is busy") };
    }
    this.#status satisfies "ready";
    this.#status = "busy";

    const driver = this.#getDriver();
    if (!driver.ok) {
      this.#status = "ready";
      return driver;
    }

    const initialTimestamp = this.#clock.now();
    const systemPrompt = this.#state.systemPrompt ?? "";
    const userTurn = new ReactiveTurnState({
      role: "user",
      // TODO(aomarks) We should probably model a state to indicate whether a
      // user has been sent to the model yet.
      status: "done",
      chunks: [{ kind: "text", timestamp: initialTimestamp, text }],
    });
    this.#state.events.push(
      new ReactiveSessionEventState({
        id: this.#idGenerator(),
        timestamp: initialTimestamp,
        detail: { kind: "turn", turn: userTurn },
      })
    );

    const done = (async (): Promise<void> => {
      const activeTools = await this.#getActiveTools();
      const { functionCalls } = await this.#callModel(
        driver.value,
        activeTools,
        initialTimestamp,
        systemPrompt
      );
      if (functionCalls.length > 0) {
        await Promise.all(
          functionCalls.map((call) =>
            this.#executeFunctionCall(call, activeTools)
          )
        );
        await this.#callModel(
          driver.value,
          undefined,
          this.#clock.now(),
          systemPrompt
        );
      }
      this.#status = "ready";
    })();

    return { ok: true, value: { done } };
  }

  #getDriver(): Result<BBRTDriver> {
    const driverId = this.#state.driverId;
    if (!driverId) {
      return {
        ok: false,
        error: new Error(`Session driver ID was missing or empty`),
      };
    }
    const driver = this.#drivers.get(driverId);
    if (!driver) {
      return {
        ok: false,
        error: new Error(
          `Driver was not found with id ${JSON.stringify(driverId)}`
        ),
      };
    }
    return { ok: true, value: driver };
  }

  async #getActiveTools(): Promise<Map<string, BBRTTool>> {
    const availableTools = await this.#availableToolsPromise;
    const tools = new Map<string, BBRTTool>();
    for (const toolId of this.#state.activeToolIds) {
      const tool = availableTools.get(toolId);
      if (!tool) {
        // TODO(aomarks) Something visible to the user.
        console.error(`Tool not found: ${JSON.stringify(toolId)}`);
        continue;
      }
      tools.set(toolId, tool);
    }
    return tools;
  }

  async #callModel(
    driver: BBRTDriver,
    tools: Map<string, BBRTTool> | undefined,
    timestamp: number,
    systemPrompt: string
  ): Promise<{ functionCalls: ReactiveFunctionCallState[] }> {
    // TODO(aomarks) This is a little weird. The natural thing to do would seem
    // to be to create a ReactiveSessionEventTurn, and pass it in. But in fact
    // our State constructors treat all initializer data as pure data, so that
    // means it gets initialized to a clone of the ReactiveSessionEventTurn we
    // passed in. Maybe we should detect such instances, or maybe the pattern
    // should be a little different -- like constructor always takes Reactive
    // instances, and there's a separate static method to initialize from JSON.
    const event = new ReactiveSessionEventState({
      id: this.#idGenerator(),
      timestamp,
      detail: {
        kind: "turn",
        turn: {
          role: "model",
          status: "pending",
          chunks: [],
        },
      },
    });
    this.#state.events.push(event);
    const turn = (event.detail as ReactiveSessionEventTurn).turn;

    // Don't include the pending turn we just created.
    const slice = this.#state.turns.slice(0, -1);
    const chunks = driver.send({
      systemPrompt,
      tools,
      turns: slice,
    });
    const functionCalls = [];
    for await (const chunk of chunks) {
      if (chunk.kind === "function-call") {
        if (tools !== undefined) {
          const call = new ReactiveFunctionCallState(chunk.call);
          functionCalls.push(call);
          turn.chunks.push({
            kind: "function-call",
            timestamp: chunk.timestamp,
            call: call,
          });
        } else {
          turn.chunks.push({
            kind: "error",
            timestamp: chunk.timestamp,
            error: {
              message:
                `Model made unexpected function call: ` +
                JSON.stringify(chunk.call),
            },
          });
        }
      } else {
        turn.chunks.push(chunk);
      }
    }
    turn.status = "done";
    return { functionCalls };
  }

  async #executeFunctionCall(
    call: ReactiveFunctionCallState,
    tools: Map<string, BBRTTool>
  ): Promise<void> {
    const { functionId } = call;
    const tool = tools.get(functionId);
    if (tool === undefined) {
      call.response = {
        status: "error",
        error: { message: `Tool not found: ${JSON.stringify(functionId)}` },
      };
      return;
    }
    const execution = tool.execute(call.args);
    call.response = { status: "executing" };
    // TODO(aomarks) Feels like we should set the render earlier, since we
    // should be able to know it before we even start executing. Right now
    // render is a signal for that reason, but it doesn't need to be.
    call.render = execution.render;
    const result = await execution.result;
    if (result.ok) {
      call.response = {
        status: "success",
        result: result.value.data as JsonSerializableObject,
        artifacts: result.value.artifacts ?? [],
      };
    } else {
      call.response = {
        status: "error",
        error: coercePresentableError(result.error),
      };
    }
  }

  get activeDriverId() {
    return this.#state.driverId ?? "gemini";
  }

  set activeDriverId(driverId: string) {
    const lastEvent = this.#state.events.at(-1);
    if (lastEvent?.detail.kind === "set-driver") {
      this.#state.events.pop();
    }
    this.#state.events.push(
      new ReactiveSessionEventState({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        detail: {
          kind: "set-driver",
          driverId,
        },
      })
    );
  }

  get driverInfo(): Map<string, BBRTDriverInfo> {
    return this.#drivers;
  }

  get activeToolIds(): ReadonlySet<string> {
    return this.#state.activeToolIds;
  }

  set activeToolIds(toolIds: string[]) {
    this.#state.activeToolIds = toolIds;
  }
}

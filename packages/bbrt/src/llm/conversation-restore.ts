/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";
import { SignalArray } from "signal-utils/array";
import type { SignalSet } from "signal-utils/set";
import type { BBRTTool } from "../tools/tool.js";
import { BufferedMultiplexStream } from "../util/buffered-multiplex-stream.js";
import type {
  SerializableBBRTToolCall,
  SerializableBBRTToolResponse,
  SerializableBBRTTurn,
} from "./conversation-serialization-types.js";
import type {
  BBRTToolCall,
  BBRTToolResponse,
  BBRTTurn,
} from "./conversation-types.js";

export function restoreTurns(
  turns: SerializableBBRTTurn[],
  availableTools: SignalSet<BBRTTool>
): BBRTTurn[] {
  // TODO(aomarks) Tools should already be a map.
  const availableToolsMap = new Map(
    [...availableTools].map((tool) => [tool.metadata.id, tool])
  );
  return turns.map((turn) => restoreTurn(turn, availableToolsMap));
}

function restoreTurn(
  turn: SerializableBBRTTurn,
  availableTools: Map<string, BBRTTool>
): BBRTTurn {
  if (turn.kind === "user-content") {
    return {
      kind: turn.kind,
      role: turn.role,
      status: new Signal.State(turn.status),
      content: turn.content,
    };
  } else if (turn.kind === "user-tool-responses") {
    return {
      kind: turn.kind,
      role: turn.role,
      status: new Signal.State(turn.status),
      responses: turn.responses.map((response) =>
        restoreToolResponse(response, availableTools)
      ),
    };
  } else if (turn.kind === "model") {
    const content = BufferedMultiplexStream.finished(turn.content);
    return {
      kind: turn.kind,
      role: turn.role,
      status: new Signal.State(turn.status),
      content,
      toolCalls: turn.toolCalls
        ? new SignalArray(
            [...turn.toolCalls].map((call) =>
              restoreToolCall(call, availableTools)
            )
          )
        : undefined,
      // TODO(aomarks) Lossy errors, see serialize file.
      error: turn.error,
    };
  } else if (turn.kind === "error") {
    return {
      kind: "error",
      role: turn.role,
      status: new Signal.State(turn.status),
      // TODO(aomarks) Lossy errors, see serialize file.
      error: turn.error,
    };
  }
  turn satisfies never;
  const msg =
    `Internal Error: Unhandled turn kind: ` +
    `${JSON.stringify((turn as BBRTTurn).kind)})`;
  console.error(msg);
  throw new Error(msg);
}

function restoreToolResponse(
  response: SerializableBBRTToolResponse,
  availableTools: Map<string, BBRTTool>
): BBRTToolResponse {
  const tool = availableTools.get(response.toolId);
  if (tool === undefined) {
    const msg =
      `Internal Error: Tool ${response.toolId} not found` +
      ` during state restoration`;
    console.error(msg);
    throw new Error(msg);
  }
  const invocation = tool.invoke(response.args);
  invocation.state.set(response.invocationState);
  return {
    id: response.id,
    tool,
    invocation,
    args: response.args,
    response: response.response,
  };
}

function restoreToolCall(
  call: SerializableBBRTToolCall,
  availableTools: Map<string, BBRTTool>
): BBRTToolCall {
  const tool = availableTools.get(call.toolId);
  if (tool === undefined) {
    const msg =
      `Internal Error: Tool ${call.toolId} not found` +
      ` during state restoration`;
    console.error(msg);
    throw new Error(msg);
  }
  const invocation = tool.invoke(call.args);
  // TODO(aomarks) Feels like there is some unnecessary duplication between tool
  // responses and calls. Refactor the data structures a bit?
  invocation.state.set(call.invocationState);
  return {
    id: call.id,
    tool,
    args: call.args,
    invocation,
  };
}
